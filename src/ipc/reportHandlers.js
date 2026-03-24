const { ipcMain, BrowserWindow } = require('electron');
const { getDb } = require('../database');

// Escape cell values to prevent Excel formula injection
function escapeExcelValue(val) {
  if (typeof val === 'string' && /^[=+\-@\t\r]/.test(val)) {
    return "'" + val;
  }
  return val;
}

function escapeRow(obj) {
  const result = {};
  for (const [k, v] of Object.entries(obj)) {
    result[k] = escapeExcelValue(v);
  }
  return result;
}

function buildDateWhere(params, dateCol) {
  const { year, month, week_start, week_end } = params || {};
  const clauses = [];
  const args = [];
  if (year && month && week_start && week_end) {
    clauses.push(`${dateCol} >= ? AND ${dateCol} <= ?`);
    args.push(week_start, week_end);
  } else if (year && month) {
    clauses.push(`substr(${dateCol}, 1, 7) = ?`);
    args.push(`${year}-${String(month).padStart(2, '0')}`);
  } else if (year) {
    clauses.push(`substr(${dateCol}, 1, 4) = ?`);
    args.push(String(year));
  }
  return { clauses, args };
}

function registerReportHandlers(dataPath) {
  // Dashboard
  ipcMain.handle('report:dashboard', async (_, params) => {
    const db = getDb();
    const dw = buildDateWhere(params, 'date');
    const dwInv = buildDateWhere(params, 'inv.date');
    const dwI = buildDateWhere(params, 'i.date');

    // Stats
    const statsWhere = dw.clauses.length > 0 ? 'WHERE ' + dw.clauses.join(' AND ') : '';
    const stats = db.prepare(`
      SELECT
        COUNT(*) as total_invoices,
        SUM(CASE WHEN invoice_type = 'IV' AND is_cancelled = 0 THEN 1 ELSE 0 END) as iv_count,
        SUM(CASE WHEN invoice_type = 'IS' AND is_cancelled = 0 THEN 1 ELSE 0 END) as is_count,
        SUM(CASE WHEN is_cancelled = 1 THEN 1 ELSE 0 END) as cancelled_count,
        SUM(CASE WHEN is_cancelled = 0 THEN subtotal ELSE 0 END) as total_subtotal,
        SUM(CASE WHEN is_cancelled = 0 THEN vat ELSE 0 END) as total_vat,
        SUM(CASE WHEN is_cancelled = 0 THEN total ELSE 0 END) as total_amount
      FROM invoice
      ${statsWhere}
    `).get(...dw.args);

    // Paid / Unpaid
    const payWhere = ['1=1', ...dw.clauses].join(' AND ');
    const payStats = db.prepare(`
      SELECT
        SUM(CASE WHEN is_paid = 'Y' AND is_cancelled = 0 THEN total ELSE 0 END) as paid_amount,
        SUM(CASE WHEN is_paid = 'Y' AND is_cancelled = 0 THEN 1 ELSE 0 END) as paid_count,
        SUM(CASE WHEN is_paid != 'Y' AND is_cancelled = 0 THEN total ELSE 0 END) as unpaid_amount,
        SUM(CASE WHEN is_paid != 'Y' AND is_cancelled = 0 THEN 1 ELSE 0 END) as unpaid_count
      FROM invoice
      WHERE ${payWhere}
    `).get(...dw.args);

    // Salespersons — date filter in JOIN ON clause to preserve LEFT JOIN
    const spDateOn = dwI.clauses.length > 0 ? ' AND ' + dwI.clauses.join(' AND ') : '';
    const salespersons = db.prepare(`
      SELECT s.id, s.name, s.nickname,
        COUNT(CASE WHEN i.is_cancelled = 0 THEN 1 END) as invoice_count,
        COALESCE(SUM(CASE WHEN i.is_cancelled = 0 THEN i.subtotal ELSE 0 END), 0) as subtotal,
        COALESCE(SUM(CASE WHEN i.is_cancelled = 0 THEN i.vat ELSE 0 END), 0) as vat,
        COALESCE(SUM(CASE WHEN i.is_cancelled = 0 THEN i.total ELSE 0 END), 0) as total,
        COALESCE(SUM(CASE WHEN i.is_paid = 'Y' AND i.is_cancelled = 0 THEN i.total ELSE 0 END), 0) as paid_amount,
        COALESCE(SUM(CASE WHEN i.is_paid != 'Y' AND i.is_cancelled = 0 THEN i.total ELSE 0 END), 0) as unpaid_amount
      FROM salesperson s
      LEFT JOIN import_batch ib ON ib.salesperson_id = s.id
      LEFT JOIN invoice i ON i.batch_id = ib.id${spDateOn}
      GROUP BY s.id
      ORDER BY total DESC
    `).all(...dwI.args);

    // Top 10 customers
    const custDateWhere = dw.clauses.length > 0 ? ' AND ' + dw.clauses.join(' AND ') : '';
    const topCustomers = db.prepare(`
      SELECT customer_name,
        COUNT(*) as invoice_count,
        SUM(total) as total_amount
      FROM invoice
      WHERE is_cancelled = 0${custDateWhere}
      GROUP BY customer_name
      ORDER BY total_amount DESC
      LIMIT 10
    `).all(...dw.args);

    // Top 10 products
    const prodDateWhere = dwInv.clauses.length > 0 ? ' AND ' + dwInv.clauses.join(' AND ') : '';
    const topProducts = db.prepare(`
      SELECT
        ii.product_code,
        MAX(ii.description) as description,
        SUM(ii.quantity) as total_qty,
        SUM(ii.amount) as total_amount,
        COUNT(DISTINCT inv.id) as invoice_count
      FROM invoice_item ii
      JOIN invoice inv ON ii.invoice_id = inv.id
      WHERE inv.is_cancelled = 0${prodDateWhere}
      GROUP BY ii.product_code
      ORDER BY total_amount DESC
      LIMIT 10
    `).all(...dwInv.args);

    const batches = db.prepare(`
      SELECT ib.*, s.nickname as salesperson, ib.company, ib.doc_type
      FROM import_batch ib
      LEFT JOIN salesperson s ON ib.salesperson_id = s.id
      ORDER BY ib.import_date DESC
    `).all();

    // Cost coverage stats
    const costCoverage = db.prepare(`
      SELECT
        COUNT(*) as total_codes,
        SUM(CASE WHEN std_price IS NOT NULL THEN 1 ELSE 0 END) as codes_with_cost
      FROM product
    `).get();

    // Total points + profit + cost
    const pointsWhere = dwInv.clauses.length > 0 ? ' AND ' + dwInv.clauses.join(' AND ') : '';
    const pointsRow = db.prepare(`
      SELECT
        SUM(
          CASE WHEN COALESCE(p.no_commission, 0) = 0 THEN
            (CAST(((ii.amount - p.std_price * ii.quantity)) / 100 AS INTEGER) * 100) / 1000.0
          ELSE 0 END
        ) as total_points,
        SUM(ii.amount - (ii.quantity * p.std_price)) as total_profit,
        SUM(ii.quantity * p.std_price) as total_cost
      FROM invoice_item ii
      JOIN invoice inv ON ii.invoice_id = inv.id
      JOIN product p ON ii.product_code = p.code AND p.std_price IS NOT NULL
      WHERE inv.is_cancelled = 0${pointsWhere}
    `).get(...dwInv.args);

    // Points + profit per salesperson
    const spPoints = db.prepare(`
      SELECT s.nickname,
        SUM(
          CASE WHEN COALESCE(p.no_commission, 0) = 0 THEN
            (CAST(((ii.amount - p.std_price * ii.quantity)) / 100 AS INTEGER) * 100) / 1000.0
          ELSE 0 END
        ) as total_points,
        SUM(ii.amount - (ii.quantity * p.std_price)) as profit
      FROM invoice_item ii
      JOIN invoice inv ON ii.invoice_id = inv.id
      JOIN product p ON ii.product_code = p.code AND p.std_price IS NOT NULL
      LEFT JOIN import_batch ib ON inv.batch_id = ib.id
      LEFT JOIN salesperson s ON ib.salesperson_id = s.id
      WHERE inv.is_cancelled = 0${pointsWhere}
      GROUP BY s.nickname
    `).all(...dwInv.args);
    const spExtraMap = {};
    spPoints.forEach(r => {
      spExtraMap[r.nickname] = { total_points: r.total_points || 0, profit: r.profit || 0 };
    });
    salespersons.forEach(sp => {
      const ex = spExtraMap[sp.nickname] || {};
      sp.total_points = ex.total_points || 0;
      sp.profit = ex.profit || 0;
    });

    // Monthly trend (only when not filtered to single month/week)
    let monthlyTrend = [];
    if (!(params && params.month)) {
      const trendWhere = dw.clauses.length > 0 ? ' AND ' + dw.clauses.join(' AND ') : '';
      monthlyTrend = db.prepare(`
        SELECT
          substr(date, 1, 7) as month,
          SUM(CASE WHEN is_cancelled = 0 THEN total ELSE 0 END) as total_amount,
          COUNT(CASE WHEN is_cancelled = 0 THEN 1 END) as invoice_count
        FROM invoice
        WHERE 1=1${trendWhere}
        GROUP BY substr(date, 1, 7)
        ORDER BY month
      `).all(...dw.args);
    }

    // Top 5 products per salesperson
    const spTopProducts = db.prepare(`
      SELECT
        s.nickname as salesperson,
        ii.product_code,
        MAX(ii.description) as description,
        SUM(ii.quantity) as total_qty,
        SUM(ii.amount) as total_amount,
        COUNT(DISTINCT inv.id) as invoice_count
      FROM invoice_item ii
      JOIN invoice inv ON ii.invoice_id = inv.id
      LEFT JOIN import_batch ib ON inv.batch_id = ib.id
      LEFT JOIN salesperson s ON ib.salesperson_id = s.id
      WHERE inv.is_cancelled = 0${prodDateWhere}
      GROUP BY s.nickname, ii.product_code
      ORDER BY s.nickname, total_amount DESC
    `).all(...dwInv.args);

    // Group and take top 5 per salesperson
    const spTopProductsGrouped = {};
    spTopProducts.forEach(r => {
      if (!spTopProductsGrouped[r.salesperson]) spTopProductsGrouped[r.salesperson] = [];
      if (spTopProductsGrouped[r.salesperson].length < 5) {
        spTopProductsGrouped[r.salesperson].push(r);
      }
    });
    const topProductsBySalesperson = Object.entries(spTopProductsGrouped).map(([sp, products]) => ({
      salesperson: sp,
      products,
    }));

    // Credit note stats
    const cnWhere = dw.clauses.length > 0 ? 'WHERE doc_type = \'credit_note\' AND ' + dw.clauses.join(' AND ') : "WHERE doc_type = 'credit_note'";
    const cnStats = db.prepare(`
      SELECT
        COUNT(CASE WHEN is_cancelled = 0 THEN 1 END) as cn_count,
        COALESCE(SUM(CASE WHEN is_cancelled = 0 THEN subtotal ELSE 0 END), 0) as cn_subtotal,
        COALESCE(SUM(CASE WHEN is_cancelled = 0 THEN vat ELSE 0 END), 0) as cn_vat,
        COALESCE(SUM(CASE WHEN is_cancelled = 0 THEN total ELSE 0 END), 0) as cn_total
      FROM invoice
      ${cnWhere}
    `).get(...dw.args);

    // Net salesperson summary (sales - credit notes) per salesperson
    const spNetDateOn = dwI.clauses.length > 0 ? ' AND ' + dwI.clauses.join(' AND ') : '';
    const spNetSales = db.prepare(`
      SELECT s.nickname,
        COALESCE(SUM(CASE WHEN i.doc_type = 'invoice' AND i.is_cancelled = 0 THEN i.total ELSE 0 END), 0) as sales_total,
        COALESCE(SUM(CASE WHEN i.doc_type = 'credit_note' AND i.is_cancelled = 0 THEN i.total ELSE 0 END), 0) as cn_total,
        COALESCE(SUM(CASE WHEN i.doc_type = 'invoice' AND i.is_cancelled = 0 THEN i.total ELSE 0 END), 0) -
        COALESCE(SUM(CASE WHEN i.doc_type = 'credit_note' AND i.is_cancelled = 0 THEN i.total ELSE 0 END), 0) as net_total
      FROM salesperson s
      LEFT JOIN import_batch ib ON ib.salesperson_id = s.id
      LEFT JOIN invoice i ON i.batch_id = ib.id${spNetDateOn}
      GROUP BY s.id
    `).all(...dwI.args);
    const spNetMap = {};
    spNetSales.forEach(r => { spNetMap[r.nickname] = r; });
    salespersons.forEach(sp => {
      const net = spNetMap[sp.nickname] || {};
      sp.cn_total = net.cn_total || 0;
      sp.net_total = net.net_total || sp.total;
    });

    const activeCount = (stats.total_invoices || 0) - (stats.cancelled_count || 0);
    const avgOrderValue = activeCount > 0 ? (stats.total_amount || 0) / activeCount : 0;

    return {
      stats: {
        total_invoices: stats.total_invoices || 0,
        iv_count: stats.iv_count || 0,
        is_count: stats.is_count || 0,
        cancelled_count: stats.cancelled_count || 0,
        total_subtotal: stats.total_subtotal || 0,
        total_vat: stats.total_vat || 0,
        total_amount: stats.total_amount || 0,
        cn_count: cnStats.cn_count || 0,
        cn_subtotal: cnStats.cn_subtotal || 0,
        cn_vat: cnStats.cn_vat || 0,
        cn_total: cnStats.cn_total || 0,
        net_amount: (stats.total_amount || 0) - (cnStats.cn_total || 0),
        total_points: (pointsRow && pointsRow.total_points) || 0,
        total_profit: (pointsRow && pointsRow.total_profit) || 0,
        total_cost: (pointsRow && pointsRow.total_cost) || 0,
        paid_amount: payStats.paid_amount || 0,
        paid_count: payStats.paid_count || 0,
        unpaid_amount: payStats.unpaid_amount || 0,
        unpaid_count: payStats.unpaid_count || 0,
        avg_order_value: avgOrderValue,
      },
      salespersons,
      topCustomers,
      topProducts,
      topProductsBySalesperson,
      monthlyTrend,
      batches,
      costCoverage: {
        total_codes: costCoverage.total_codes || 0,
        codes_with_cost: costCoverage.codes_with_cost || 0,
        codes_missing: (costCoverage.total_codes || 0) - (costCoverage.codes_with_cost || 0),
      },
    };
  });

  // Monthly report — with cost/profit/points via 2-query approach + split by salesperson
  ipcMain.handle('report:monthly', async (_, params) => {
    const db = getDb();
    const { salesperson } = params || {};
    const dw = buildDateWhere(params, 'i.date');
    const dwInv = buildDateWhere(params, 'inv.date');

    let where = 'i.is_cancelled = 0';
    let args = [];
    if (salesperson) {
      where += ' AND s.nickname = ?';
      args.push(salesperson);
    }
    if (dw.clauses.length > 0) {
      where += ' AND ' + dw.clauses.join(' AND ');
      args.push(...dw.args);
    }

    // Overall monthly query
    const rows = db.prepare(`
      SELECT
        substr(i.date, 1, 7) as month,
        COUNT(*) as invoice_count,
        SUM(i.subtotal) as subtotal,
        SUM(i.vat) as vat,
        SUM(i.total) as total
      FROM invoice i
      LEFT JOIN import_batch ib ON i.batch_id = ib.id
      LEFT JOIN salesperson s ON ib.salesperson_id = s.id
      WHERE ${where}
      GROUP BY substr(i.date, 1, 7)
      ORDER BY month
    `).all(...args);

    // Cost + points query
    let costWhere = 'inv.is_cancelled = 0';
    let costArgs = [];
    if (salesperson) {
      costWhere += ' AND s.nickname = ?';
      costArgs.push(salesperson);
    }
    if (dwInv.clauses.length > 0) {
      costWhere += ' AND ' + dwInv.clauses.join(' AND ');
      costArgs.push(...dwInv.args);
    }

    const costRows = db.prepare(`
      SELECT
        substr(inv.date, 1, 7) as month,
        SUM(ii.quantity * p.std_price) as total_cost,
        SUM(ii.amount - (ii.quantity * p.std_price)) as profit,
        SUM(
          CASE WHEN COALESCE(p.no_commission, 0) = 0 THEN
            (CAST(((ii.amount - p.std_price * ii.quantity)) / 100 AS INTEGER) * 100) / 1000.0
          ELSE 0 END
        ) as points
      FROM invoice_item ii
      JOIN invoice inv ON ii.invoice_id = inv.id
      JOIN product p ON ii.product_code = p.code AND p.std_price IS NOT NULL
      LEFT JOIN import_batch ib ON inv.batch_id = ib.id
      LEFT JOIN salesperson s ON ib.salesperson_id = s.id
      WHERE ${costWhere}
      GROUP BY substr(inv.date, 1, 7)
    `).all(...costArgs);

    // Merge cost data into rows
    const costByMonth = {};
    costRows.forEach(r => { costByMonth[r.month] = r; });
    rows.forEach(r => {
      const c = costByMonth[r.month];
      r.total_cost = c ? c.total_cost : null;
      r.profit = c ? c.profit : null;
      r.profit_pct = (c && r.subtotal > 0) ? (c.profit / r.subtotal * 100) : null;
      r.points = c ? c.points : 0;
    });

    // Split by salesperson (only when no specific salesperson filter)
    let bySalesperson = [];
    if (!salesperson) {
      const spDateWhere = dw.clauses.length > 0 ? ' AND ' + dw.clauses.join(' AND ') : '';
      const spRows = db.prepare(`
        SELECT
          s.nickname as salesperson,
          substr(i.date, 1, 7) as month,
          COUNT(*) as invoice_count,
          SUM(i.subtotal) as subtotal,
          SUM(i.vat) as vat,
          SUM(i.total) as total
        FROM invoice i
        LEFT JOIN import_batch ib ON i.batch_id = ib.id
        LEFT JOIN salesperson s ON ib.salesperson_id = s.id
        WHERE i.is_cancelled = 0${spDateWhere}
        GROUP BY s.nickname, substr(i.date, 1, 7)
        ORDER BY s.nickname, month
      `).all(...dw.args);

      const spCostDateWhere = dwInv.clauses.length > 0 ? ' AND ' + dwInv.clauses.join(' AND ') : '';
      const spCostRows = db.prepare(`
        SELECT
          s.nickname as salesperson,
          substr(inv.date, 1, 7) as month,
          SUM(ii.quantity * p.std_price) as total_cost,
          SUM(ii.amount - (ii.quantity * p.std_price)) as profit,
          SUM(
            CASE WHEN COALESCE(p.no_commission, 0) = 0 THEN
              (CAST(((ii.amount - p.std_price * ii.quantity)) / 100 AS INTEGER) * 100) / 1000.0
            ELSE 0 END
          ) as points
        FROM invoice_item ii
        JOIN invoice inv ON ii.invoice_id = inv.id
        JOIN product p ON ii.product_code = p.code AND p.std_price IS NOT NULL
        LEFT JOIN import_batch ib ON inv.batch_id = ib.id
        LEFT JOIN salesperson s ON ib.salesperson_id = s.id
        WHERE inv.is_cancelled = 0${spCostDateWhere}
        GROUP BY s.nickname, substr(inv.date, 1, 7)
      `).all(...dwInv.args);

      // Build cost lookup: salesperson+month → cost data
      const spCostMap = {};
      spCostRows.forEach(r => {
        spCostMap[r.salesperson + '|' + r.month] = r;
      });

      // Group by salesperson
      const spGroup = {};
      spRows.forEach(r => {
        if (!spGroup[r.salesperson]) spGroup[r.salesperson] = [];
        const c = spCostMap[r.salesperson + '|' + r.month];
        r.total_cost = c ? c.total_cost : null;
        r.profit = c ? c.profit : null;
        r.profit_pct = (c && r.subtotal > 0) ? (c.profit / r.subtotal * 100) : null;
        r.points = c ? c.points : 0;
        spGroup[r.salesperson].push(r);
      });

      bySalesperson = Object.entries(spGroup).map(([sp, months]) => ({
        salesperson: sp,
        months,
      }));
    }

    return { months: rows, bySalesperson };
  });

  // Customer report — with cost/profit/points + split by salesperson
  ipcMain.handle('report:customer', async (_, params) => {
    const db = getDb();
    const { salesperson, search, page = 1, per_page = 50 } = params || {};
    const dw = buildDateWhere(params, 'i.date');
    const dwInv = buildDateWhere(params, 'inv.date');

    let where = ['i.is_cancelled = 0'];
    let args = [];
    if (salesperson) {
      where.push('s.nickname = ?');
      args.push(salesperson);
    }
    if (search) {
      where.push('i.customer_name LIKE ?');
      args.push(`%${search}%`);
    }
    if (dw.clauses.length > 0) {
      where.push(...dw.clauses);
      args.push(...dw.args);
    }
    const whereClause = where.join(' AND ');

    const countRow = db.prepare(`
      SELECT COUNT(DISTINCT i.customer_name) as total
      FROM invoice i
      LEFT JOIN import_batch ib ON i.batch_id = ib.id
      LEFT JOIN salesperson s ON ib.salesperson_id = s.id
      WHERE ${whereClause}
    `).get(...args);

    const total = countRow.total;
    const totalPages = Math.ceil(total / per_page) || 1;
    const offset = (page - 1) * per_page;

    const rows = db.prepare(`
      SELECT
        i.customer_name,
        COUNT(*) as invoice_count,
        SUM(i.subtotal) as subtotal,
        SUM(i.vat) as vat,
        SUM(i.total) as total
      FROM invoice i
      LEFT JOIN import_batch ib ON i.batch_id = ib.id
      LEFT JOIN salesperson s ON ib.salesperson_id = s.id
      WHERE ${whereClause}
      GROUP BY i.customer_name
      ORDER BY total DESC
      LIMIT ? OFFSET ?
    `).all(...args, per_page, offset);

    // Cost + points query
    let costWhere = ['inv.is_cancelled = 0'];
    let costArgs = [];
    if (salesperson) {
      costWhere.push('s.nickname = ?');
      costArgs.push(salesperson);
    }
    if (search) {
      costWhere.push('inv.customer_name LIKE ?');
      costArgs.push(`%${search}%`);
    }
    if (dwInv.clauses.length > 0) {
      costWhere.push(...dwInv.clauses);
      costArgs.push(...dwInv.args);
    }
    const costWhereClause = costWhere.join(' AND ');

    const costRows = db.prepare(`
      SELECT
        inv.customer_name,
        SUM(ii.quantity * p.std_price) as total_cost,
        SUM(ii.amount - (ii.quantity * p.std_price)) as profit,
        SUM(
          CASE WHEN COALESCE(p.no_commission, 0) = 0 THEN
            (CAST(((ii.amount - p.std_price * ii.quantity)) / 100 AS INTEGER) * 100) / 1000.0
          ELSE 0 END
        ) as points
      FROM invoice_item ii
      JOIN invoice inv ON ii.invoice_id = inv.id
      JOIN product p ON ii.product_code = p.code AND p.std_price IS NOT NULL
      LEFT JOIN import_batch ib ON inv.batch_id = ib.id
      LEFT JOIN salesperson s ON ib.salesperson_id = s.id
      WHERE ${costWhereClause}
      GROUP BY inv.customer_name
    `).all(...costArgs);

    // Merge cost data
    const costByCustomer = {};
    costRows.forEach(r => { costByCustomer[r.customer_name] = r; });
    rows.forEach(r => {
      const c = costByCustomer[r.customer_name];
      r.total_cost = c ? c.total_cost : null;
      r.profit = c ? c.profit : null;
      r.profit_pct = (c && r.subtotal > 0) ? (c.profit / r.subtotal * 100) : null;
      r.points = c ? c.points : 0;
    });

    // Split by salesperson (only when no specific salesperson filter)
    let bySalesperson = [];
    if (!salesperson) {
      const spDateWhere = dw.clauses.length > 0 ? ' AND ' + dw.clauses.join(' AND ') : '';
      const spRows = db.prepare(`
        SELECT
          s.nickname as salesperson,
          i.customer_name,
          COUNT(*) as invoice_count,
          SUM(i.subtotal) as subtotal,
          SUM(i.vat) as vat,
          SUM(i.total) as total
        FROM invoice i
        LEFT JOIN import_batch ib ON i.batch_id = ib.id
        LEFT JOIN salesperson s ON ib.salesperson_id = s.id
        WHERE i.is_cancelled = 0${spDateWhere}
        GROUP BY s.nickname, i.customer_name
        ORDER BY s.nickname, total DESC
      `).all(...dw.args);

      const spCostDateWhere = dwInv.clauses.length > 0 ? ' AND ' + dwInv.clauses.join(' AND ') : '';
      const spCostRows = db.prepare(`
        SELECT
          s.nickname as salesperson,
          inv.customer_name,
          SUM(ii.quantity * p.std_price) as total_cost,
          SUM(ii.amount - (ii.quantity * p.std_price)) as profit,
          SUM(
            CASE WHEN COALESCE(p.no_commission, 0) = 0 THEN
              (CAST(((ii.amount - p.std_price * ii.quantity)) / 100 AS INTEGER) * 100) / 1000.0
            ELSE 0 END
          ) as points
        FROM invoice_item ii
        JOIN invoice inv ON ii.invoice_id = inv.id
        JOIN product p ON ii.product_code = p.code AND p.std_price IS NOT NULL
        LEFT JOIN import_batch ib ON inv.batch_id = ib.id
        LEFT JOIN salesperson s ON ib.salesperson_id = s.id
        WHERE inv.is_cancelled = 0${spCostDateWhere}
        GROUP BY s.nickname, inv.customer_name
      `).all(...dwInv.args);

      const spCostMap = {};
      spCostRows.forEach(r => {
        spCostMap[r.salesperson + '|' + r.customer_name] = r;
      });

      const spGroup = {};
      spRows.forEach(r => {
        if (!spGroup[r.salesperson]) spGroup[r.salesperson] = [];
        const c = spCostMap[r.salesperson + '|' + r.customer_name];
        r.total_cost = c ? c.total_cost : null;
        r.profit = c ? c.profit : null;
        r.profit_pct = (c && r.subtotal > 0) ? (c.profit / r.subtotal * 100) : null;
        r.points = c ? c.points : 0;
        spGroup[r.salesperson].push(r);
      });

      // Top 20 per salesperson
      bySalesperson = Object.entries(spGroup).map(([sp, customers]) => ({
        salesperson: sp,
        customers: customers.slice(0, 20),
      }));
    }

    return { customers: rows, total, total_pages: totalPages, page, bySalesperson };
  });

  // Product report — with cost, profit, points + split by salesperson
  ipcMain.handle('report:product', async (_, params) => {
    const db = getDb();
    const { salesperson, search, page = 1, per_page = 50 } = params || {};
    const dwInv = buildDateWhere(params, 'inv.date');

    let where = ['inv.is_cancelled = 0'];
    let args = [];
    if (salesperson) {
      where.push('s.nickname = ?');
      args.push(salesperson);
    }
    if (search) {
      where.push('(ii.product_code LIKE ? OR ii.description LIKE ?)');
      args.push(`%${search}%`, `%${search}%`);
    }
    if (dwInv.clauses.length > 0) {
      where.push(...dwInv.clauses);
      args.push(...dwInv.args);
    }
    const whereClause = where.join(' AND ');

    const countRow = db.prepare(`
      SELECT COUNT(DISTINCT ii.product_code) as total
      FROM invoice_item ii
      JOIN invoice inv ON ii.invoice_id = inv.id
      LEFT JOIN import_batch ib ON inv.batch_id = ib.id
      LEFT JOIN salesperson s ON ib.salesperson_id = s.id
      WHERE ${whereClause}
    `).get(...args);

    const total = countRow.total;
    const totalPages = Math.ceil(total / per_page) || 1;
    const offset = (page - 1) * per_page;

    const rows = db.prepare(`
      SELECT
        ii.product_code,
        MAX(ii.description) as description,
        MAX(ii.unit) as unit,
        SUM(ii.quantity) as total_qty,
        SUM(ii.amount) as total_amount,
        COUNT(DISTINCT inv.id) as invoice_count,
        MAX(p.std_price) as cost_price,
        CASE WHEN MAX(p.std_price) IS NOT NULL
          THEN SUM(ii.quantity) * MAX(p.std_price)
          ELSE NULL END as total_cost,
        CASE WHEN MAX(p.std_price) IS NOT NULL
          THEN SUM(ii.amount) - (SUM(ii.quantity) * MAX(p.std_price))
          ELSE NULL END as profit,
        CASE WHEN MAX(p.std_price) IS NOT NULL AND COALESCE(MAX(p.no_commission), 0) = 0
          THEN SUM(
            (CAST(((ii.amount - p.std_price * ii.quantity)) / 100 AS INTEGER) * 100) / 1000.0
          )
          ELSE NULL END as points
      FROM invoice_item ii
      JOIN invoice inv ON ii.invoice_id = inv.id
      LEFT JOIN import_batch ib ON inv.batch_id = ib.id
      LEFT JOIN salesperson s ON ib.salesperson_id = s.id
      LEFT JOIN product p ON ii.product_code = p.code
      WHERE ${whereClause}
      GROUP BY ii.product_code
      ORDER BY total_amount DESC
      LIMIT ? OFFSET ?
    `).all(...args, per_page, offset);

    // Compute profit_pct in JS
    rows.forEach(r => {
      r.profit_pct = (r.profit !== null && r.total_amount > 0)
        ? (r.profit / r.total_amount * 100)
        : null;
    });

    // Split by salesperson (only when no specific salesperson filter)
    let bySalesperson = [];
    if (!salesperson) {
      const spDateWhere = dwInv.clauses.length > 0 ? ' AND ' + dwInv.clauses.join(' AND ') : '';
      const spRows = db.prepare(`
        SELECT
          s.nickname as salesperson,
          ii.product_code,
          MAX(ii.description) as description,
          MAX(ii.unit) as unit,
          SUM(ii.quantity) as total_qty,
          SUM(ii.amount) as total_amount,
          COUNT(DISTINCT inv.id) as invoice_count,
          MAX(p.std_price) as cost_price,
          CASE WHEN MAX(p.std_price) IS NOT NULL
            THEN SUM(ii.quantity) * MAX(p.std_price)
            ELSE NULL END as total_cost,
          CASE WHEN MAX(p.std_price) IS NOT NULL
            THEN SUM(ii.amount) - (SUM(ii.quantity) * MAX(p.std_price))
            ELSE NULL END as profit,
          CASE WHEN MAX(p.std_price) IS NOT NULL AND COALESCE(MAX(p.no_commission), 0) = 0
            THEN SUM(
              (CAST(((ii.amount - p.std_price * ii.quantity)) / 100 AS INTEGER) * 100) / 1000.0
            )
            ELSE NULL END as points
        FROM invoice_item ii
        JOIN invoice inv ON ii.invoice_id = inv.id
        LEFT JOIN import_batch ib ON inv.batch_id = ib.id
        LEFT JOIN salesperson s ON ib.salesperson_id = s.id
        LEFT JOIN product p ON ii.product_code = p.code
        WHERE inv.is_cancelled = 0${spDateWhere}
        GROUP BY s.nickname, ii.product_code
        ORDER BY s.nickname, total_amount DESC
      `).all(...dwInv.args);

      const spGroup = {};
      spRows.forEach(r => {
        if (!spGroup[r.salesperson]) spGroup[r.salesperson] = [];
        r.profit_pct = (r.profit !== null && r.total_amount > 0)
          ? (r.profit / r.total_amount * 100) : null;
        spGroup[r.salesperson].push(r);
      });

      // Top 20 per salesperson
      bySalesperson = Object.entries(spGroup).map(([sp, products]) => ({
        salesperson: sp,
        products: products.slice(0, 20),
      }));
    }

    return { products: rows, total, total_pages: totalPages, page, bySalesperson };
  });

  // Export report to Excel
  ipcMain.handle('report:exportExcel', async (event, type) => {
    const { dialog } = require('electron');
    const XLSX = require('xlsx');
    const db = getDb();
    const win = BrowserWindow.fromWebContents(event.sender);

    const typeLabels = { monthly: 'สรุปรายเดือน', customer: 'ตามลูกค้า', product: 'ตามสินค้า' };
    const label = typeLabels[type] || type;

    const result = await dialog.showSaveDialog(win, {
      title: 'บันทึกรายงาน',
      defaultPath: `รายงาน_${label}_${new Date().toISOString().slice(0,10)}.xlsx`,
      filters: [{ name: 'Excel', extensions: ['xlsx'] }],
    });
    if (result.canceled) return { success: false, cancelled: true };

    const wb = XLSX.utils.book_new();

    if (type === 'monthly') {
      // Monthly overall
      const rows = db.prepare(`
        SELECT substr(i.date, 1, 7) as month, COUNT(*) as invoice_count,
          SUM(i.subtotal) as subtotal, SUM(i.vat) as vat, SUM(i.total) as total
        FROM invoice i WHERE i.is_cancelled = 0
        GROUP BY substr(i.date, 1, 7) ORDER BY month
      `).all();
      const costRows = db.prepare(`
        SELECT substr(inv.date, 1, 7) as month,
          SUM(ii.quantity * p.std_price) as total_cost,
          SUM(ii.amount - (ii.quantity * p.std_price)) as profit,
          SUM(CASE WHEN COALESCE(p.no_commission, 0) = 0 THEN (CAST(((ii.amount - p.std_price * ii.quantity)) / 100 AS INTEGER) * 100) / 1000.0 ELSE 0 END) as points
        FROM invoice_item ii
        JOIN invoice inv ON ii.invoice_id = inv.id
        JOIN product p ON ii.product_code = p.code AND p.std_price IS NOT NULL
        WHERE inv.is_cancelled = 0
        GROUP BY substr(inv.date, 1, 7)
      `).all();
      const costMap = {};
      costRows.forEach(r => { costMap[r.month] = r; });
      const data = rows.map(r => {
        const c = costMap[r.month];
        return {
          'เดือน': r.month, 'จำนวนใบ': r.invoice_count,
          'มูลค่า': r.subtotal, 'VAT': r.vat, 'รวม': r.total,
          'ต้นทุน': c ? c.total_cost : null, 'กำไร': c ? c.profit : null,
          'คะแนน': c ? c.points : null,
        };
      });
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data.map(escapeRow)), 'ภาพรวม');

      // Per-salesperson monthly
      const spRows = db.prepare(`
        SELECT s.nickname as salesperson, substr(i.date, 1, 7) as month,
          COUNT(*) as invoice_count, SUM(i.subtotal) as subtotal, SUM(i.vat) as vat, SUM(i.total) as total
        FROM invoice i
        LEFT JOIN import_batch ib ON i.batch_id = ib.id
        LEFT JOIN salesperson s ON ib.salesperson_id = s.id
        WHERE i.is_cancelled = 0
        GROUP BY s.nickname, substr(i.date, 1, 7) ORDER BY s.nickname, month
      `).all();
      const spCostRows = db.prepare(`
        SELECT s.nickname as salesperson, substr(inv.date, 1, 7) as month,
          SUM(ii.quantity * p.std_price) as total_cost,
          SUM(ii.amount - (ii.quantity * p.std_price)) as profit,
          SUM(CASE WHEN COALESCE(p.no_commission, 0) = 0 THEN (CAST(((ii.amount - p.std_price * ii.quantity)) / 100 AS INTEGER) * 100) / 1000.0 ELSE 0 END) as points
        FROM invoice_item ii JOIN invoice inv ON ii.invoice_id = inv.id
        JOIN product p ON ii.product_code = p.code AND p.std_price IS NOT NULL
        LEFT JOIN import_batch ib ON inv.batch_id = ib.id
        LEFT JOIN salesperson s ON ib.salesperson_id = s.id
        WHERE inv.is_cancelled = 0
        GROUP BY s.nickname, substr(inv.date, 1, 7)
      `).all();
      const spCostMap = {};
      spCostRows.forEach(r => { spCostMap[r.salesperson + '|' + r.month] = r; });
      const spData = spRows.map(r => {
        const c = spCostMap[r.salesperson + '|' + r.month];
        return {
          'พนักงาน': r.salesperson, 'เดือน': r.month, 'จำนวนใบ': r.invoice_count,
          'มูลค่า': r.subtotal, 'VAT': r.vat, 'รวม': r.total,
          'ต้นทุน': c ? c.total_cost : null, 'กำไร': c ? c.profit : null,
          'คะแนน': c ? c.points : null,
        };
      });
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(spData.map(escapeRow)), 'แยกตามพนักงาน');

    } else if (type === 'customer') {
      const rows = db.prepare(`
        SELECT i.customer_name, COUNT(*) as invoice_count,
          SUM(i.subtotal) as subtotal, SUM(i.vat) as vat, SUM(i.total) as total
        FROM invoice i WHERE i.is_cancelled = 0
        GROUP BY i.customer_name ORDER BY total DESC
      `).all();
      const costRows = db.prepare(`
        SELECT inv.customer_name,
          SUM(ii.quantity * p.std_price) as total_cost,
          SUM(ii.amount - (ii.quantity * p.std_price)) as profit,
          SUM(CASE WHEN COALESCE(p.no_commission, 0) = 0 THEN (CAST(((ii.amount - p.std_price * ii.quantity)) / 100 AS INTEGER) * 100) / 1000.0 ELSE 0 END) as points
        FROM invoice_item ii JOIN invoice inv ON ii.invoice_id = inv.id
        JOIN product p ON ii.product_code = p.code AND p.std_price IS NOT NULL
        WHERE inv.is_cancelled = 0 GROUP BY inv.customer_name
      `).all();
      const costMap = {};
      costRows.forEach(r => { costMap[r.customer_name] = r; });
      const data = rows.map(r => {
        const c = costMap[r.customer_name];
        return {
          'ลูกค้า': r.customer_name, 'จำนวนใบ': r.invoice_count,
          'มูลค่า': r.subtotal, 'รวม': r.total,
          'ต้นทุน': c ? c.total_cost : null, 'กำไร': c ? c.profit : null,
          'คะแนน': c ? c.points : null,
        };
      });
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data.map(escapeRow)), 'ลูกค้าทั้งหมด');

      // Per-salesperson customer
      const spRows = db.prepare(`
        SELECT s.nickname as salesperson, i.customer_name,
          COUNT(*) as invoice_count, SUM(i.subtotal) as subtotal, SUM(i.total) as total
        FROM invoice i
        LEFT JOIN import_batch ib ON i.batch_id = ib.id
        LEFT JOIN salesperson s ON ib.salesperson_id = s.id
        WHERE i.is_cancelled = 0
        GROUP BY s.nickname, i.customer_name ORDER BY s.nickname, total DESC
      `).all();
      const spCostRows = db.prepare(`
        SELECT s.nickname as salesperson, inv.customer_name,
          SUM(ii.quantity * p.std_price) as total_cost,
          SUM(ii.amount - (ii.quantity * p.std_price)) as profit,
          SUM(CASE WHEN COALESCE(p.no_commission, 0) = 0 THEN (CAST(((ii.amount - p.std_price * ii.quantity)) / 100 AS INTEGER) * 100) / 1000.0 ELSE 0 END) as points
        FROM invoice_item ii JOIN invoice inv ON ii.invoice_id = inv.id
        JOIN product p ON ii.product_code = p.code AND p.std_price IS NOT NULL
        LEFT JOIN import_batch ib ON inv.batch_id = ib.id
        LEFT JOIN salesperson s ON ib.salesperson_id = s.id
        WHERE inv.is_cancelled = 0 GROUP BY s.nickname, inv.customer_name
      `).all();
      const spCostMap = {};
      spCostRows.forEach(r => { spCostMap[r.salesperson + '|' + r.customer_name] = r; });
      const spData = spRows.map(r => {
        const c = spCostMap[r.salesperson + '|' + r.customer_name];
        return {
          'พนักงาน': r.salesperson, 'ลูกค้า': r.customer_name, 'จำนวนใบ': r.invoice_count,
          'มูลค่า': r.subtotal, 'รวม': r.total,
          'ต้นทุน': c ? c.total_cost : null, 'กำไร': c ? c.profit : null,
          'คะแนน': c ? c.points : null,
        };
      });
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(spData.map(escapeRow)), 'แยกตามพนักงาน');

    } else if (type === 'product') {
      const rows = db.prepare(`
        SELECT ii.product_code, MAX(ii.description) as description, MAX(ii.unit) as unit,
          SUM(ii.quantity) as total_qty, SUM(ii.amount) as total_amount,
          COUNT(DISTINCT inv.id) as invoice_count,
          MAX(p.std_price) as cost_price,
          CASE WHEN MAX(p.std_price) IS NOT NULL THEN SUM(ii.quantity) * MAX(p.std_price) ELSE NULL END as total_cost,
          CASE WHEN MAX(p.std_price) IS NOT NULL THEN SUM(ii.amount) - (SUM(ii.quantity) * MAX(p.std_price)) ELSE NULL END as profit,
          CASE WHEN MAX(p.std_price) IS NOT NULL AND COALESCE(MAX(p.no_commission), 0) = 0
            THEN SUM((CAST(((ii.amount - p.std_price * ii.quantity)) / 100 AS INTEGER) * 100) / 1000.0)
            ELSE NULL END as points
        FROM invoice_item ii
        JOIN invoice inv ON ii.invoice_id = inv.id
        LEFT JOIN product p ON ii.product_code = p.code
        WHERE inv.is_cancelled = 0
        GROUP BY ii.product_code ORDER BY total_amount DESC
      `).all();
      const data = rows.map(r => ({
        'รหัส': r.product_code, 'รายละเอียด': r.description, 'หน่วย': r.unit,
        'จำนวนรวม': r.total_qty, 'ยอดเงินรวม': r.total_amount, 'จำนวนใบ': r.invoice_count,
        'ต้นทุนรวม': r.total_cost, 'กำไร': r.profit,
        '%กำไร': r.profit !== null && r.total_amount > 0 ? +(r.profit / r.total_amount * 100).toFixed(1) : null,
        'คะแนน': r.points,
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data.map(escapeRow)), 'สินค้าทั้งหมด');

      // Per-salesperson products
      const spRows = db.prepare(`
        SELECT s.nickname as salesperson, ii.product_code, MAX(ii.description) as description,
          SUM(ii.quantity) as total_qty, SUM(ii.amount) as total_amount,
          CASE WHEN MAX(p.std_price) IS NOT NULL THEN SUM(ii.amount) - (SUM(ii.quantity) * MAX(p.std_price)) ELSE NULL END as profit,
          CASE WHEN MAX(p.std_price) IS NOT NULL AND COALESCE(MAX(p.no_commission), 0) = 0
            THEN SUM((CAST(((ii.amount - p.std_price * ii.quantity)) / 100 AS INTEGER) * 100) / 1000.0)
            ELSE NULL END as points
        FROM invoice_item ii
        JOIN invoice inv ON ii.invoice_id = inv.id
        LEFT JOIN import_batch ib ON inv.batch_id = ib.id
        LEFT JOIN salesperson s ON ib.salesperson_id = s.id
        LEFT JOIN product p ON ii.product_code = p.code
        WHERE inv.is_cancelled = 0
        GROUP BY s.nickname, ii.product_code ORDER BY s.nickname, total_amount DESC
      `).all();
      const spData = spRows.map(r => ({
        'พนักงาน': r.salesperson, 'รหัส': r.product_code, 'รายละเอียด': r.description,
        'จำนวน': r.total_qty, 'ยอดเงิน': r.total_amount,
        'กำไร': r.profit, 'คะแนน': r.points,
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(spData.map(escapeRow)), 'แยกตามพนักงาน');
    }

    const fs = require('fs');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    fs.writeFileSync(result.filePath, buf);
    return { success: true, filePath: result.filePath };
  });
}

module.exports = { registerReportHandlers };
