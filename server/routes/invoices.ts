import { Hono } from 'hono'
import { getDb } from '../db'

const invoiceRoutes = new Hono()

// GET /api/invoices/date-range — available year-months
invoiceRoutes.get('/date-range', (c) => {
  const db = getDb()
  const rows = db.prepare(
    "SELECT DISTINCT substr(date, 1, 7) as ym FROM invoice WHERE date IS NOT NULL ORDER BY ym"
  ).all() as any[]
  return c.json({ yearMonths: rows.map(r => r.ym) })
})

// GET /api/invoices/:id — detail with items + cost calc
invoiceRoutes.get('/:id', (c) => {
  const id = parseInt(c.req.param('id'), 10)
  if (!Number.isFinite(id) || id <= 0) {
    return c.json({ error: 'Invalid ID' }, 400)
  }

  const db = getDb()
  const invoice = db.prepare(`
    SELECT i.*, s.nickname as salesperson
    FROM invoice i
    LEFT JOIN import_batch ib ON i.batch_id = ib.id
    LEFT JOIN salesperson s ON ib.salesperson_id = s.id
    WHERE i.id = ?
  `).get(id)

  const items = db.prepare(`
    SELECT ii.*,
      p.std_price as cost_price,
      CASE WHEN p.std_price IS NOT NULL
        THEN ii.amount - (ii.quantity * p.std_price)
        ELSE NULL END as line_profit,
      CASE WHEN p.std_price IS NOT NULL AND COALESCE(p.no_commission, 0) = 0
        THEN (CAST(((ii.amount - p.std_price * ii.quantity)) / 100 AS INTEGER) * 100) / 1000.0
        ELSE NULL END as line_points
    FROM invoice_item ii
    LEFT JOIN product p ON ii.product_code = p.code
    WHERE ii.invoice_id = ? ORDER BY ii.line_no
  `).all(id)

  return c.json({ invoice, items })
})

// GET /api/invoices — paginated list with filters
invoiceRoutes.get('/', (c) => {
  const db = getDb()
  const query = c.req.query()
  const page = Math.max(1, parseInt(query.page || '1', 10))
  const per_page = Math.min(200, Math.max(1, parseInt(query.per_page || '50', 10)))
  const { search, salesperson, type, is_paid, year, month, week_start, week_end } = query

  const where: string[] = ['1=1']
  const args: any[] = []

  if (year && month && week_start && week_end) {
    where.push('i.date >= ? AND i.date <= ?')
    args.push(week_start, week_end)
  } else if (year && month) {
    where.push("substr(i.date, 1, 7) = ?")
    args.push(`${year}-${String(parseInt(month)).padStart(2, '0')}`)
  } else if (year) {
    where.push("substr(i.date, 1, 4) = ?")
    args.push(String(year))
  }

  if (search) {
    where.push('(i.invoice_no LIKE ? OR i.customer_name LIKE ?)')
    args.push(`%${search}%`, `%${search}%`)
  }
  if (salesperson) {
    where.push('s.nickname = ?')
    args.push(salesperson)
  }
  if (type) {
    where.push('i.invoice_type = ?')
    args.push(type)
  }
  if (is_paid) {
    where.push('i.is_paid = ?')
    args.push(is_paid)
  }

  const has_loss = query.has_loss
  if (has_loss === 'Y') {
    where.push('ic.loss_item_count > 0')
  }

  const whereClause = where.join(' AND ')

  const countRow = db.prepare(`
    SELECT COUNT(*) as total
    FROM invoice i
    LEFT JOIN import_batch ib ON i.batch_id = ib.id
    LEFT JOIN salesperson s ON ib.salesperson_id = s.id
    LEFT JOIN (
      SELECT ii2.invoice_id,
        SUM(CASE WHEN (ii2.amount - (ii2.quantity * p2.std_price)) < 0 THEN 1 ELSE 0 END) as loss_item_count
      FROM invoice_item ii2
      JOIN product p2 ON ii2.product_code = p2.code AND p2.std_price IS NOT NULL
      GROUP BY ii2.invoice_id
    ) ic ON ic.invoice_id = i.id
    WHERE ${whereClause}
  `).get(...args) as any
  const total = countRow.total
  const totalPages = Math.ceil(total / per_page) || 1
  const offset = (page - 1) * per_page

  const invoices = db.prepare(`
    SELECT i.*, s.nickname as salesperson,
      ic.total_cost, ic.total_points, ic.total_profit, ic.qualified_revenue, ic.loss_item_count
    FROM invoice i
    LEFT JOIN import_batch ib ON i.batch_id = ib.id
    LEFT JOIN salesperson s ON ib.salesperson_id = s.id
    LEFT JOIN (
      SELECT ii.invoice_id,
        SUM(ii.quantity * p.std_price) as total_cost,
        SUM(ii.amount) as qualified_revenue,
        SUM(ii.amount - (ii.quantity * p.std_price)) as total_profit,
        SUM(
          CASE WHEN COALESCE(p.no_commission, 0) = 0 THEN
            (CAST(((ii.amount - p.std_price * ii.quantity)) / 100 AS INTEGER) * 100) / 1000.0
          ELSE 0 END
        ) as total_points,
        SUM(CASE WHEN (ii.amount - (ii.quantity * p.std_price)) < 0 THEN 1 ELSE 0 END) as loss_item_count
      FROM invoice_item ii
      JOIN product p ON ii.product_code = p.code AND p.std_price IS NOT NULL
      GROUP BY ii.invoice_id
    ) ic ON ic.invoice_id = i.id
    WHERE ${whereClause}
    ORDER BY i.date DESC, i.invoice_no DESC
    LIMIT ? OFFSET ?
  `).all(...args, per_page, offset)

  return c.json({ invoices, total, total_pages: totalPages, page })
})

// GET /api/salespersons — list with stats
invoiceRoutes.get('/salespersons/list', (c) => {
  const db = getDb()
  const rows = db.prepare(`
    SELECT s.id, s.name, s.nickname,
      COUNT(CASE WHEN i.is_cancelled = 0 THEN 1 END) as invoice_count,
      COUNT(CASE WHEN i.invoice_type = 'IV' AND i.is_cancelled = 0 THEN 1 END) as iv_count,
      COUNT(CASE WHEN i.invoice_type = 'IS' AND i.is_cancelled = 0 THEN 1 END) as is_count,
      COALESCE(SUM(CASE WHEN i.is_cancelled = 0 THEN i.subtotal ELSE 0 END), 0) as subtotal,
      COALESCE(SUM(CASE WHEN i.is_cancelled = 0 THEN i.vat ELSE 0 END), 0) as vat,
      COALESCE(SUM(CASE WHEN i.is_cancelled = 0 THEN i.total ELSE 0 END), 0) as total
    FROM salesperson s
    LEFT JOIN import_batch ib ON ib.salesperson_id = s.id
    LEFT JOIN invoice i ON i.batch_id = ib.id
    GROUP BY s.id
    ORDER BY total DESC
  `).all()
  return c.json(rows)
})

export { invoiceRoutes }
