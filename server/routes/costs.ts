import { Hono } from 'hono'
import XLSX from 'xlsx'
import { getDb } from '../db'

const costRoutes = new Hono()

// GET /api/costs/products — paginated, filtered
costRoutes.get('/products', (c) => {
  const db = getDb()
  const { search, filter, page: pageStr, per_page: ppStr } = c.req.query()
  const page = Math.max(1, parseInt(pageStr || '1', 10))
  const per_page = Math.min(200, Math.max(1, parseInt(ppStr || '50', 10)))

  let filterCondition: string
  if (filter === 'has_cost') {
    filterCondition = 'p.std_price IS NOT NULL'
  } else if (filter === 'no_cost') {
    filterCondition = 'p.std_price IS NULL'
  } else if (filter === 'no_commission') {
    filterCondition = 'COALESCE(p.no_commission, 0) = 1'
  } else {
    filterCondition = '1=1'
  }

  const where: string[] = [filterCondition]
  const args: any[] = []
  if (search) {
    where.push('(p.code LIKE ? OR p.name LIKE ?)')
    args.push(`%${search}%`, `%${search}%`)
  }
  const whereStr = where.join(' AND ')

  const countRow = db.prepare(
    `SELECT COUNT(*) as total FROM product p WHERE ${whereStr}`
  ).get(...args) as any
  const total = countRow.total
  const totalPages = Math.ceil(total / per_page) || 1
  const offset = (page - 1) * per_page

  const orderBy = filter === 'all' || !filter
    ? 'ORDER BY (CASE WHEN p.std_price IS NULL THEN 0 ELSE 1 END), p.code'
    : 'ORDER BY p.code'

  const rows = db.prepare(`
    SELECT p.code as product_code, p.name, p.unit,
      ${filter === 'no_cost' ? 'NULL' : 'p.std_price'} as cost_price,
      COALESCE(p.no_commission, 0) as no_commission
    FROM product p WHERE ${whereStr}
    ${orderBy} LIMIT ? OFFSET ?
  `).all(...args, per_page, offset)

  return c.json({ products: rows, total, total_pages: totalPages, page })
})

// GET /api/costs/summary — coverage stats
costRoutes.get('/summary', (c) => {
  const db = getDb()
  const stats = db.prepare(`
    SELECT
      COUNT(*) as product_count,
      SUM(CASE WHEN std_price IS NOT NULL THEN 1 ELSE 0 END) as with_cost,
      SUM(CASE WHEN std_price IS NULL THEN 1 ELSE 0 END) as missing_cost,
      SUM(CASE WHEN COALESCE(no_commission, 0) = 1 THEN 1 ELSE 0 END) as no_commission_count
    FROM product
  `).get() as any

  return c.json({
    product_count: stats.product_count || 0,
    item_codes_total: stats.product_count || 0,
    item_codes_with_cost: stats.with_cost || 0,
    item_codes_missing: stats.missing_cost || 0,
    no_commission_count: stats.no_commission_count || 0,
  })
})

// POST /api/costs/import — upload Excel
costRoutes.post('/import', async (c) => {
  try {
    const formData = await c.req.formData()
    const file = formData.get('file') as File | null
    if (!file) {
      return c.json({ success: false, error: 'กรุณาเลือกไฟล์' }, 400)
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const workbook = XLSX.read(buffer)
    const sheetName = workbook.SheetNames.find(n => n.includes('ต้นทุน')) || workbook.SheetNames[0]
    const sheet = workbook.Sheets[sheetName]
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' }) as any[]

    const db = getDb()
    const upsert = db.prepare(`
      INSERT INTO product (code, name, unit, std_price, no_commission)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(code) DO UPDATE SET
        name = excluded.name,
        unit = excluded.unit,
        std_price = excluded.std_price,
        no_commission = excluded.no_commission
    `)

    let imported = 0
    let skipped = 0
    let updated = 0

    const checkExisting = db.prepare('SELECT id FROM product WHERE code = ?')

    const insertAll = db.transaction(() => {
      for (const row of rows) {
        const code = String(row['รหัสสินค้า'] || '').trim()
        const name = String(row['ชื่อสินค้า'] || '').trim()
        const unit = String(row['หน่วย'] || '').trim()
        const priceRaw = row['ราคาต่อหน่วย']

        if (!code) { skipped++; continue }

        if (priceRaw === '' || priceRaw === null || priceRaw === undefined) {
          skipped++
          continue
        }

        const price = typeof priceRaw === 'number' ? priceRaw : parseFloat(String(priceRaw).replace(/,/g, ''))
        if (isNaN(price)) { skipped++; continue }

        const noComRaw = String(row['ไม่คิดคอม'] || '').trim()
        const noCommission = (noComRaw === 'ใช่' || noComRaw.toUpperCase() === 'Y') ? 1 : 0

        const existing = checkExisting.get(code)
        upsert.run(code, name, unit, price, noCommission)
        if (existing) {
          updated++
        } else {
          imported++
        }
      }
    })

    insertAll()

    return c.json({ success: true, imported, updated, skipped, total: rows.length })
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500)
  }
})

// GET /api/costs/export — download Excel
costRoutes.get('/export', (c) => {
  const db = getDb()
  const allProducts = db.prepare(`
    SELECT code AS product_code, name, unit, std_price AS price,
      COALESCE(no_commission, 0) as no_commission
    FROM product
    ORDER BY (CASE WHEN std_price IS NULL THEN 0 ELSE 1 END), code
  `).all() as any[]

  const wsData = [['รหัสสินค้า', 'ชื่อสินค้า', 'หน่วย', 'ราคาต่อหน่วย', 'ไม่คิดคอม']]
  for (const p of allProducts) {
    wsData.push([p.product_code, p.name, p.unit, p.price, p.no_commission ? 'Y' : 'N'])
  }

  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet(wsData)
  ws['!cols'] = [{ wch: 20 }, { wch: 40 }, { wch: 12 }, { wch: 15 }, { wch: 12 }]
  XLSX.utils.book_append_sheet(wb, ws, 'ต้นทุน')

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer

  return new Response(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${encodeURIComponent('ต้นทุนสินค้า.xlsx')}"`,
    },
  })
})

// PUT /api/costs/products/:code — update single
costRoutes.put('/products/:code', async (c) => {
  try {
    const db = getDb()
    const code = c.req.param('code')
    if (!code) return c.json({ success: false, error: 'Missing code' }, 400)

    const body = await c.req.json()
    const { name, unit, std_price } = body

    const priceVal = (std_price === '' || std_price === null || std_price === undefined)
      ? null
      : parseFloat(std_price)

    db.prepare(
      'UPDATE product SET name = ?, unit = ?, std_price = ? WHERE code = ?'
    ).run(name || '', unit || '', (priceVal !== null && !isNaN(priceVal)) ? priceVal : null, code)

    return c.json({ success: true })
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500)
  }
})

// PUT /api/costs/products/batch — batch update
costRoutes.put('/products/batch', async (c) => {
  try {
    const db = getDb()
    const items = await c.req.json() as any[]

    const update = db.prepare(
      'UPDATE product SET name = ?, unit = ?, std_price = ? WHERE code = ?'
    )

    let count = 0
    const updateAll = db.transaction(() => {
      for (const item of items) {
        const priceVal = (item.std_price === '' || item.std_price === null || item.std_price === undefined)
          ? null
          : parseFloat(item.std_price)
        update.run(
          item.name || '', item.unit || '',
          (priceVal !== null && !isNaN(priceVal)) ? priceVal : null,
          item.code
        )
        count++
      }
    })
    updateAll()

    return c.json({ success: true, count })
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500)
  }
})

// PATCH /api/costs/products/:code/commission — toggle
costRoutes.patch('/products/:code/commission', async (c) => {
  try {
    const db = getDb()
    const code = c.req.param('code')
    if (!code) return c.json({ success: false, error: 'Missing code' }, 400)

    const body = await c.req.json()
    const { no_commission } = body
    db.prepare(
      'UPDATE product SET no_commission = ? WHERE code = ?'
    ).run(no_commission ? 1 : 0, code)
    return c.json({ success: true })
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500)
  }
})

// DELETE /api/costs/products — delete all (requires confirmCode)
costRoutes.delete('/products', async (c) => {
  const body = await c.req.json()
  const { confirmCode } = body || {}
  if (confirmCode !== 'ลบทั้งหมด') {
    return c.json({ success: false, error: 'รหัสยืนยันไม่ถูกต้อง' }, 400)
  }
  const db = getDb()
  db.prepare('DELETE FROM product').run()
  return c.json({ success: true })
})

export { costRoutes }
