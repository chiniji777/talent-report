import { Hono } from "hono"
import path from "path"
import { getDb } from "../db"
import { parseInvoiceCsv, type ParseResult } from "../parser/invoiceParser"

const importRoutes = new Hono()

interface DataMismatch {
  invoice_no: string
  field: string
  existing: number | string
  incoming: number | string
}

// POST /api/import/preview — upload CSVs, parse + check duplicates, return preview array
importRoutes.post("/preview", async (c) => {
  try {
    const formData = await c.req.formData()
    const files = formData.getAll("files") as File[]
    if (!files.length) {
      return c.json({ message: "กรุณาเลือกไฟล์" }, 400)
    }

    const allPreviews = []
    for (const file of files) {
      if (!file.name.toLowerCase().endsWith(".csv")) {
        allPreviews.push({ filename: file.name, error: "ไฟล์ต้องเป็น CSV เท่านั้น" })
        continue
      }

      const buffer = Buffer.from(await file.arrayBuffer())
      const data = parseInvoiceCsv(buffer)

      const db = getDb()
      const checkExisting = db.prepare(
        "SELECT id, is_paid, subtotal, vat, total, is_cancelled FROM invoice WHERE invoice_no = ?"
      )
      let duplicateCount = 0
      let paidUpdateCount = 0
      const mismatches: DataMismatch[] = []

      for (const inv of data.invoices) {
        const existing = checkExisting.get(inv.invoice_no) as any
        if (existing) {
          duplicateCount++
          // Check if payment status changed
          if (existing.is_paid !== inv.is_paid) {
            paidUpdateCount++
          }
          // Check for data mismatches (warn only, won't update)
          const isCancelledNum = inv.is_cancelled ? 1 : 0
          if (Math.abs(existing.subtotal - inv.subtotal) > 0.01) {
            mismatches.push({ invoice_no: inv.invoice_no, field: "subtotal", existing: existing.subtotal, incoming: inv.subtotal })
          }
          if (Math.abs(existing.vat - inv.vat) > 0.01) {
            mismatches.push({ invoice_no: inv.invoice_no, field: "vat", existing: existing.vat, incoming: inv.vat })
          }
          if (Math.abs(existing.total - inv.total) > 0.01) {
            mismatches.push({ invoice_no: inv.invoice_no, field: "total", existing: existing.total, incoming: inv.total })
          }
          if (existing.is_cancelled !== isCancelledNum) {
            mismatches.push({ invoice_no: inv.invoice_no, field: "is_cancelled", existing: existing.is_cancelled, incoming: isCancelledNum })
          }
        }
      }
      const newCount = data.invoices.length - duplicateCount

      allPreviews.push({
        filename: file.name,
        salesperson: data.salesperson.name || data.salesperson,
        period: typeof data.period === "string" ? data.period : `${data.period.start} - ${data.period.end}`,
        total_invoices: data.invoices.length,
        new_count: newCount,
        duplicate_count: duplicateCount,
        paid_update_count: paidUpdateCount,
        total_amount: data.summary.total,
        mismatches: mismatches.slice(0, 50),
        mismatch_count: mismatches.length,
      })
    }

    return c.json(allPreviews)
  } catch (err: any) {
    return c.json({ message: err.message }, 500)
  }
})

// POST /api/import — upload CSV(s), parse + save to DB
importRoutes.post("/", async (c) => {
  try {
    const formData = await c.req.formData()
    const files = formData.getAll("files") as File[]
    if (!files.length) {
      return c.json({ message: "กรุณาเลือกไฟล์" }, 400)
    }

    let totalImported = 0
    let totalSkipped = 0
    let totalPaidUpdated = 0
    const errors: string[] = []
    const allWarnings: string[] = []

    for (const file of files) {
      try {
        if (!file.name.toLowerCase().endsWith(".csv")) {
          errors.push(`${file.name}: ไฟล์ต้องเป็น CSV เท่านั้น`)
          continue
        }
        const buffer = Buffer.from(await file.arrayBuffer())
        const data = parseInvoiceCsv(buffer)
        const saved = saveInvoiceData(data, file.name)
        totalImported += saved.imported
        totalSkipped += saved.skipped
        totalPaidUpdated += saved.paidUpdated
        if (saved.warnings.length > 0) {
          allWarnings.push(...saved.warnings)
        }
      } catch (err: any) {
        errors.push(`${file.name}: ${err.message}`)
      }
    }

    return c.json({
      imported: totalImported,
      skipped: totalSkipped,
      paid_updated: totalPaidUpdated,
      errors,
      warnings: allWarnings.slice(0, 100),
      warning_count: allWarnings.length,
    })
  } catch (err: any) {
    return c.json({ message: err.message }, 500)
  }
})

function autoCreateProducts(db: any) {
  const newProducts = db
    .prepare(
      `SELECT ii.product_code, MAX(ii.description) as name, MAX(ii.unit) as unit
    FROM invoice_item ii
    WHERE ii.product_code IS NOT NULL AND ii.product_code != ''
      AND ii.product_code NOT IN (SELECT code FROM product WHERE code IS NOT NULL)
    GROUP BY ii.product_code`
    )
    .all() as any[]

  if (newProducts.length > 0) {
    const insertProduct = db.prepare(
      "INSERT OR IGNORE INTO product (code, name, unit, std_price) VALUES (?, ?, ?, NULL)"
    )
    const insertAll = db.transaction(() => {
      for (const p of newProducts) {
        insertProduct.run(p.product_code, p.name, p.unit)
      }
    })
    insertAll()
  }
  return newProducts.length
}

function saveInvoiceData(data: ParseResult, filename: string) {
  const db = getDb()

  const checkExisting = db.prepare(
    "SELECT id, is_paid, subtotal, vat, total, is_cancelled FROM invoice WHERE invoice_no = ?"
  )
  // Only update is_paid — never touch other values
  const updatePaidOnly = db.prepare(
    "UPDATE invoice SET is_paid = ? WHERE id = ?"
  )

  let skipped = 0
  let imported = 0
  let paidUpdated = 0
  const warnings: string[] = []

  // Pre-scan: only update is_paid for existing invoices, warn on data mismatches
  for (const inv of data.invoices) {
    const existing = checkExisting.get(inv.invoice_no) as any
    if (existing) {
      skipped++
      const isCancelledNum = inv.is_cancelled ? 1 : 0

      // Only update payment status
      if (existing.is_paid !== inv.is_paid) {
        updatePaidOnly.run(inv.is_paid, existing.id)
        paidUpdated++
      }

      // Warn on data mismatches (do NOT update these values)
      if (Math.abs(existing.subtotal - inv.subtotal) > 0.01) {
        warnings.push(`${inv.invoice_no}: subtotal ต่างกัน (เดิม: ${existing.subtotal.toFixed(2)}, นำเข้า: ${inv.subtotal.toFixed(2)})`)
      }
      if (Math.abs(existing.vat - inv.vat) > 0.01) {
        warnings.push(`${inv.invoice_no}: VAT ต่างกัน (เดิม: ${existing.vat.toFixed(2)}, นำเข้า: ${inv.vat.toFixed(2)})`)
      }
      if (Math.abs(existing.total - inv.total) > 0.01) {
        warnings.push(`${inv.invoice_no}: total ต่างกัน (เดิม: ${existing.total.toFixed(2)}, นำเข้า: ${inv.total.toFixed(2)})`)
      }
      if (existing.is_cancelled !== isCancelledNum) {
        warnings.push(`${inv.invoice_no}: สถานะยกเลิกต่างกัน (เดิม: ${existing.is_cancelled}, นำเข้า: ${isCancelledNum})`)
      }
    }
  }

  if (skipped === data.invoices.length) {
    // Still check for missing products even when all invoices are duplicates
    autoCreateProducts(db)
    return { imported: 0, skipped, paidUpdated, warnings }
  }

  // Get or create salesperson
  const sp = data.salesperson
  let spRow = db.prepare("SELECT id FROM salesperson WHERE name = ?").get(sp.name) as any
  let spId: number
  if (spRow) {
    spId = spRow.id
  } else {
    const info = db.prepare("INSERT INTO salesperson (name, nickname) VALUES (?, ?)").run(sp.name, sp.nickname)
    spId = Number(info.lastInsertRowid)
  }

  const nonCancelled = data.invoices.filter((i) => !i.is_cancelled)
  const totalAmount = nonCancelled.reduce((sum, i) => sum + i.total, 0)

  const batchInfo = db
    .prepare(
      `INSERT INTO import_batch (filename, salesperson_id, period_start, period_end,
                              total_invoices, total_amount)
    VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(filename, spId, data.period.start, data.period.end, data.invoices.length, totalAmount)
  const batchId = Number(batchInfo.lastInsertRowid)

  const insertInvoice = db.prepare(`
    INSERT INTO invoice (batch_id, invoice_no, invoice_type, date,
      customer_name, vat_type, discount_pct, subtotal, vat, total,
      due_date, so_ref, is_paid, is_cancelled)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const insertItem = db.prepare(`
    INSERT INTO invoice_item (invoice_id, line_no, product_code,
      description, quantity, unit, unit_price, discount, amount, so_line_ref)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  skipped = 0
  imported = 0

  const insertAll = db.transaction(() => {
    for (const inv of data.invoices) {
      const existing = checkExisting.get(inv.invoice_no) as any
      if (existing) {
        skipped++
        continue
      }

      const invInfo = insertInvoice.run(
        batchId,
        inv.invoice_no,
        inv.invoice_type,
        inv.date,
        inv.customer_name,
        inv.vat_type,
        inv.discount_pct,
        inv.subtotal,
        inv.vat,
        inv.total,
        inv.due_date,
        inv.so_ref,
        inv.is_paid,
        inv.is_cancelled ? 1 : 0
      )
      const invId = Number(invInfo.lastInsertRowid)

      for (const item of inv.items) {
        insertItem.run(
          invId,
          item.line_no,
          item.product_code,
          item.description,
          item.quantity,
          item.unit,
          item.unit_price,
          item.discount,
          item.amount,
          item.so_line_ref
        )
      }
      imported++
    }
  })

  insertAll()

  if (imported === 0) {
    db.prepare("DELETE FROM import_batch WHERE id = ?").run(batchId)
  } else {
    db.prepare("UPDATE import_batch SET total_invoices = ? WHERE id = ?").run(imported, batchId)
  }

  // Auto-create products
  autoCreateProducts(db)

  return { imported, skipped, paidUpdated, warnings }
}

export { importRoutes }
