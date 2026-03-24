const { ipcMain } = require('electron');
const { getDb } = require('../database');

function registerQueryHandlers(dataPath) {
  // Get available year-months for date filter
  ipcMain.handle('query:invoiceDateRange', async () => {
    const db = getDb();
    const rows = db.prepare(
      "SELECT DISTINCT substr(date, 1, 7) as ym FROM invoice WHERE date IS NOT NULL ORDER BY ym"
    ).all();
    return { yearMonths: rows.map(r => r.ym) };
  });

  // List invoices with filters and pagination
  ipcMain.handle('query:invoices', async (_, params) => {
    const db = getDb();
    const raw = params || {};
    // Sanitize pagination params
    const page = Math.max(1, parseInt(raw.page, 10) || 1);
    const per_page = Math.min(200, Math.max(1, parseInt(raw.per_page, 10) || 50));
    const { search, salesperson, type, is_paid, year, month, week_start, week_end, company, doc_type } = raw;

    let where = ['1=1'];
    let args = [];

    // Date cascading filter
    if (year && month && week_start && week_end) {
      where.push('i.date >= ? AND i.date <= ?');
      args.push(week_start, week_end);
    } else if (year && month) {
      where.push("substr(i.date, 1, 7) = ?");
      args.push(`${year}-${String(month).padStart(2, '0')}`);
    } else if (year) {
      where.push("substr(i.date, 1, 4) = ?");
      args.push(String(year));
    }

    if (search) {
      where.push('(i.invoice_no LIKE ? OR i.customer_name LIKE ?)');
      args.push(`%${search}%`, `%${search}%`);
    }
    if (salesperson) {
      where.push('s.nickname = ?');
      args.push(salesperson);
    }
    if (type) {
      where.push('i.invoice_type = ?');
      args.push(type);
    }
    if (is_paid) {
      where.push('i.is_paid = ?');
      args.push(is_paid);
    }
    if (company) {
      where.push('i.company = ?');
      args.push(company);
    }
    if (doc_type) {
      where.push('i.doc_type = ?');
      args.push(doc_type);
    }

    const whereClause = where.join(' AND ');

    const countRow = db.prepare(`
      SELECT COUNT(*) as total
      FROM invoice i
      LEFT JOIN import_batch ib ON i.batch_id = ib.id
      LEFT JOIN salesperson s ON ib.salesperson_id = s.id
      WHERE ${whereClause}
    `).get(...args);
    const total = countRow.total;
    const totalPages = Math.ceil(total / per_page) || 1;
    const offset = (page - 1) * per_page;

    const invoices = db.prepare(`
      SELECT i.*, s.nickname as salesperson, i.company, i.doc_type, i.ref_invoice_no,
        ic.total_cost, ic.total_points
      FROM invoice i
      LEFT JOIN import_batch ib ON i.batch_id = ib.id
      LEFT JOIN salesperson s ON ib.salesperson_id = s.id
      LEFT JOIN (
        SELECT ii.invoice_id,
          SUM(ii.quantity * p.std_price) as total_cost,
          SUM(
            CASE WHEN COALESCE(p.no_commission, 0) = 0 THEN
              (CAST(((ii.amount - p.std_price * ii.quantity)) / 100 AS INTEGER) * 100) / 1000.0
            ELSE 0 END
          ) as total_points
        FROM invoice_item ii
        JOIN product p ON ii.product_code = p.code AND p.std_price IS NOT NULL
        GROUP BY ii.invoice_id
      ) ic ON ic.invoice_id = i.id
      WHERE ${whereClause}
      ORDER BY i.date DESC, i.invoice_no DESC
      LIMIT ? OFFSET ?
    `).all(...args, per_page, offset);

    return { invoices, total, total_pages: totalPages, page };
  });

  // Get invoice detail with items
  ipcMain.handle('query:invoiceDetail', async (_, id) => {
    const db = getDb();
    const invoice = db.prepare(`
      SELECT i.*, s.nickname as salesperson
      FROM invoice i
      LEFT JOIN import_batch ib ON i.batch_id = ib.id
      LEFT JOIN salesperson s ON ib.salesperson_id = s.id
      WHERE i.id = ?
    `).get(id);

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
    `).all(id);

    return { invoice, items };
  });

  // List salespersons
  ipcMain.handle('query:salespersons', async () => {
    const db = getDb();
    return db.prepare(`
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
    `).all();
  });

  // Delete batch (cascade deletes invoices + items)
  ipcMain.handle('query:deleteBatch', async (_, batchId) => {
    // Validate batchId is a positive integer
    const id = parseInt(batchId, 10);
    if (!Number.isFinite(id) || id <= 0) {
      return { success: false, error: 'Invalid batch ID' };
    }
    const db = getDb();
    db.prepare('DELETE FROM import_batch WHERE id = ?').run(id);
    return { success: true };
  });
}

module.exports = { registerQueryHandlers };
