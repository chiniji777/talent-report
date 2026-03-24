import { Hono } from 'hono'
import path from 'path'
import { getDb } from '../db'
import { parseInvoiceCsv, type ParseResult } from '../parser/invoiceParser'

const importRoutes = new Hono()

// POST /api/import/preview — upload CSV, parse + check duplicates, return preview
importRoutes.post('/preview', async (c) => {
  try {
    const formData = await c.req.formData()
    const file = formData.get('file') as File | null
    if (!file) {
      return c.json({ success: false, error: 'กรุณาเลือกไฟล์' }, 400)
    }
    if (!file.name.toLowerCase().endsWith('.csv')) {
      return c.json({ success: false, error: 'ไฟล์ต้องเป็น CSV เท่านั้น' }, 400)
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const data = parseInvoiceCsv(buffer)
    const nonCancelled = data.invoices.filter(i => !i.is_cancelled)
    const cancelled = data.invoices.filter(i => i.is_cancelled)

    const db = getDb()
    const checkExisting = db.prepare(
      'SELECT id, is_paid, subtotal, vat, total, is_cancelled FROM invoice WHERE invoice_no = ?'
    )
    let duplicateCount = 0
    let updatedPaidCount = 0
    let dataChangedCount = 0
    const changedInvoices: any[] = []

    for (const inv of data.invoices) {
      const existing = checkExisting.get(inv.invoice_no) as any
      if (existing) {
        duplicateCount++
        if (existing.is_paid !== inv.is_paid) updatedPaidCount++
        const isCancelledNum = inv.is_cancelled ? 1 : 0
        if (Math.abs(existing.subtotal - inv.subtotal) > 0.01 ||
            Math.abs(existing.vat - inv.vat) > 0.01 ||
            Math.abs(existing.total - inv.total) > 0.01 ||
            existing.is_cancelled !== isCancelledNum) {
          dataChangedCount++
          changedInvoices.push({
            invoice_no: inv.invoice_no,
            changes: {
              subtotal: existing.subtotal !== inv.subtotal ? { old: existing.subtotal, new: inv.subtotal } : null,
              vat: existing.vat !== inv.vat ? { old: existing.vat, new: inv.vat } : null,
              total: existing.total !== inv.total ? { old: existing.total, new: inv.total } : null,
              is_cancelled: existing.is_cancelled !== isCancelledNum ? { old: existing.is_cancelled, new: isCancelledNum } : null,
            },
          })
        }
      }
    }
    const newCount = data.invoices.length - duplicateCount

    return c.json({
      success: true,
      filename: file.name,
      salesperson: data.salesperson,
      period: data.period,
      total_invoices: data.invoices.length,
      active_invoices: nonCancelled.length,
      cancelled_invoices: cancelled.length,
      new_count: newCount,
      duplicate_count: duplicateCount,
      updated_paid_count: updatedPaidCount,
      data_changed_count: dataChangedCount,
      changed_invoices: changedInvoices.slice(0, 20),
      iv_count: nonCancelled.filter(i => i.invoice_type === 'IV').length,
      is_count: nonCancelled.filter(i => i.invoice_type === 'IS').length,
      subtotal: data.summary.subtotal,
      vat: data.summary.vat,
      total: data.summary.total,
    })
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500)
  }
})

// POST /api/import — upload CSV(s), parse + save to DB
importRoutes.post('/', async (c) => {
  try {
    const formData = await c.req.formData()
    const files = formData.getAll('files') as File[]
    if (!files.length) {
      return c.json({ success: false, error: 'กรุณาเลือกไฟล์' }, 400)
    }

    const results = []
    for (const file of files) {
      try {
        if (!file.name.toLowerCase().endsWith('.csv')) {
          results.push({ success: false, filename: file.name, error: 'ไฟล์ต้องเป็น CSV เท่านั้น' })
          continue
        }
        const buffer = Buffer.from(await file.arrayBuffer())
        const data = parseInvoiceCsv(buffer)
        const saved = saveInvoiceData(data, file.name)
        results.push(saved)
      } catch (err: any) {
        results.push({ success: false, filename: file.name, error: err.message })
      }
    }

    return c.json({ results })
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500)
  }
})

function saveInvoiceData(data: ParseResult, filename: string) {
  const db = getDb()

  const checkExisting = db.prepare(
    'SELECT id, is_paid, subtotal, vat, total, is_cancelled FROM invoice WHERE invoice_no = ?'
  )
  const updateInvoice = db.prepare(
    'UPDATE invoice SET is_paid = ?, subtotal = ?, vat = ?, total = ?, is_cancelled = ? WHERE id = ?'
  )
  let skipped = 0
  let imported = 0
  let updated = 0

  // Pre-scan: update existing invoices where data changed
  for (const inv of data.invoices) {
    const existing = checkExisting.get(inv.invoice_no) as any
    if (existing) {
      skipped++
      const isCancelledNum = inv.is_cancelled ? 1 : 0
      const paidChanged = existing.is_paid !== inv.is_paid
      const dataChanged = Math.abs(existing.subtotal - inv.subtotal) > 0.01 ||
                          Math.abs(existing.vat - inv.vat) > 0.01 ||
                          Math.abs(existing.total - inv.total) > 0.01 ||
                          existing.is_cancelled !== isCancelledNum
      if (paidChanged || dataChanged) {
        updateInvoice.run(inv.is_paid, inv.subtotal, inv.vat, inv.total, isCancelledNum, existing.id)
        updated++
      }
    }
  }

  if (skipped === data.invoices.length) {
    return {
      success: true,
      filename,
      salesperson: data.salesperson,
      imported: 0,
      skipped,
      updated,
      total: data.invoices.length,
      total_amount: 0,
    }
  }

  // Get or create salesperson
  const sp = data.salesperson
  let spRow = db.prepare('SELECT id FROM salesperson WHERE name = ?').get(sp.name) as any
  let spId: number
  if (spRow) {
    spId = spRow.id
  } else {
    const info = db.prepare('INSERT INTO salesperson (name, nickname) VALUES (?, ?)').run(sp.name, sp.nickname)
    spId = Number(info.lastInsertRowid)
  }

  const nonCancelled = data.invoices.filter(i => !i.is_cancelled)
  const totalAmount = nonCancelled.reduce((sum, i) => sum + i.total, 0)

  const batchInfo = db.prepare(`
    INSERT INTO import_batch (filename, salesperson_id, period_start, period_end,
                              total_invoices, total_amount)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(filename, spId, data.period.start, data.period.end,
         data.invoices.length, totalAmount)
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
        batchId, inv.invoice_no, inv.invoice_type, inv.date,
        inv.customer_name, inv.vat_type, inv.discount_pct,
        inv.subtotal, inv.vat, inv.total,
        inv.due_date, inv.so_ref, inv.is_paid,
        inv.is_cancelled ? 1 : 0
      )
      const invId = Number(invInfo.lastInsertRowid)

      for (const item of inv.items) {
        insertItem.run(
          invId, item.line_no, item.product_code,
          item.description, item.quantity, item.unit,
          item.unit_price, item.discount, item.amount,
          item.so_line_ref
        )
      }
      imported++
    }
  })

  insertAll()

  if (imported === 0) {
    db.prepare('DELETE FROM import_batch WHERE id = ?').run(batchId)
  } else {
    db.prepare('UPDATE import_batch SET total_invoices = ? WHERE id = ?').run(imported, batchId)
  }

  // Auto-create product entries for new product codes
  const newProducts = db.prepare(`
    SELECT ii.product_code, MAX(ii.description) as name, MAX(ii.unit) as unit
    FROM invoice_item ii
    WHERE ii.product_code IS NOT NULL AND ii.product_code != ''
      AND ii.product_code NOT IN (SELECT code FROM product WHERE code IS NOT NULL)
    GROUP BY ii.product_code
  `).all() as any[]

  if (newProducts.length > 0) {
    const insertProduct = db.prepare(
      'INSERT OR IGNORE INTO product (code, name, unit, std_price) VALUES (?, ?, ?, NULL)'
    )
    const insertAllProducts = db.transaction(() => {
      for (const p of newProducts) {
        insertProduct.run(p.product_code, p.name, p.unit)
      }
    })
    insertAllProducts()
  }

  return {
    success: true,
    filename,
    salesperson: sp,
    imported,
    skipped,
    updated,
    total: data.invoices.length,
    total_amount: totalAmount,
    missing_cost_count: newProducts.length,
  }
}

export { importRoutes }
