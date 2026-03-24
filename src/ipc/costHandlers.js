const { ipcMain, dialog, BrowserWindow } = require('electron');
const { getDb } = require('../database');
const XLSX = require('xlsx');

function registerCostHandlers(dataPath) {
  // Open file dialog for Excel files
  ipcMain.handle('cost:openFile', async () => {
    const win = BrowserWindow.getFocusedWindow();
    const result = await dialog.showOpenDialog(win, {
      properties: ['openFile'],
      filters: [{ name: 'Excel Files', extensions: ['xlsx', 'xls'] }],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });

  // Import cost data from Excel file
  ipcMain.handle('cost:import', async (_, filePath) => {
    try {
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames.find(n => n.includes('ต้นทุน')) || workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

      const db = getDb();
      const upsert = db.prepare(`
        INSERT INTO product (code, name, unit, std_price)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(code) DO UPDATE SET
          name = excluded.name,
          unit = excluded.unit,
          std_price = excluded.std_price
      `);

      let imported = 0;
      let skipped = 0;
      let updated = 0;

      const checkExisting = db.prepare('SELECT id FROM product WHERE code = ?');

      const insertAll = db.transaction(() => {
        for (const row of rows) {
          const code = String(row['รหัสสินค้า'] || '').trim();
          const name = String(row['ชื่อสินค้า'] || '').trim();
          const unit = String(row['หน่วย'] || '').trim();
          const priceRaw = row['ราคาต่อหน่วย'];

          if (!code) { skipped++; continue; }

          // Skip rows with blank/null/undefined price (but keep price = 0)
          if (priceRaw === '' || priceRaw === null || priceRaw === undefined) {
            skipped++;
            continue;
          }

          const price = typeof priceRaw === 'number' ? priceRaw : parseFloat(String(priceRaw).replace(/,/g, ''));
          if (isNaN(price)) { skipped++; continue; }

          const existing = checkExisting.get(code);
          upsert.run(code, name, unit, price);
          if (existing) {
            updated++;
          } else {
            imported++;
          }
        }
      });

      insertAll();

      return { success: true, imported, updated, skipped, total: rows.length };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // Export cost data to Excel (product table + missing from invoice_items)
  ipcMain.handle('cost:export', async () => {
    try {
      const win = BrowserWindow.getFocusedWindow();
      const result = await dialog.showSaveDialog(win, {
        defaultPath: 'ต้นทุนสินค้า.xlsx',
        filters: [{ name: 'Excel Files', extensions: ['xlsx'] }],
      });

      if (result.canceled || !result.filePath) {
        return { success: false, cancelled: true };
      }

      const db = getDb();

      // All products from product table (includes auto-created entries with NULL price)
      const allProducts = db.prepare(`
        SELECT code AS product_code, name, unit, std_price AS price,
          COALESCE(no_commission, 0) as no_commission
        FROM product
        ORDER BY (CASE WHEN std_price IS NULL THEN 0 ELSE 1 END), code
      `).all();

      const wsData = [['รหัสสินค้า', 'ชื่อสินค้า', 'หน่วย', 'ราคาต่อหน่วย', 'ไม่คิดคอม']];
      for (const p of allProducts) {
        wsData.push([p.product_code, p.name, p.unit, p.price, p.no_commission ? 'ใช่' : '']);
      }

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      ws['!cols'] = [{ wch: 20 }, { wch: 40 }, { wch: 12 }, { wch: 15 }, { wch: 12 }];
      XLSX.utils.book_append_sheet(wb, ws, 'ต้นทุน');
      XLSX.writeFile(wb, result.filePath);

      return { success: true, filePath: result.filePath, totalRows: allProducts.length };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // Get products list with pagination and filter
  ipcMain.handle('cost:getProducts', async (_, params) => {
    const db = getDb();
    const { search, filter, page = 1, per_page = 50 } = params || {};

    if (filter === 'has_cost') {
      let where = ['p.std_price IS NOT NULL'];
      let args = [];
      if (search) {
        where.push('(p.code LIKE ? OR p.name LIKE ?)');
        args.push(`%${search}%`, `%${search}%`);
      }
      const whereStr = where.join(' AND ');

      const countRow = db.prepare(
        `SELECT COUNT(*) as total FROM product p WHERE ${whereStr}`
      ).get(...args);
      const total = countRow.total;
      const totalPages = Math.ceil(total / per_page) || 1;
      const offset = (page - 1) * per_page;

      const rows = db.prepare(`
        SELECT p.code as product_code, p.name, p.unit, p.std_price as cost_price,
          COALESCE(p.no_commission, 0) as no_commission
        FROM product p WHERE ${whereStr}
        ORDER BY p.code LIMIT ? OFFSET ?
      `).all(...args, per_page, offset);

      return { products: rows, total, total_pages: totalPages, page };

    } else if (filter === 'no_cost') {
      let where = ['p.std_price IS NULL'];
      let args = [];
      if (search) {
        where.push('(p.code LIKE ? OR p.name LIKE ?)');
        args.push(`%${search}%`, `%${search}%`);
      }
      const whereStr = where.join(' AND ');

      const countRow = db.prepare(
        `SELECT COUNT(*) as total FROM product p WHERE ${whereStr}`
      ).get(...args);
      const total = countRow.total;
      const totalPages = Math.ceil(total / per_page) || 1;
      const offset = (page - 1) * per_page;

      const rows = db.prepare(`
        SELECT p.code as product_code, p.name, p.unit, NULL as cost_price,
          COALESCE(p.no_commission, 0) as no_commission
        FROM product p WHERE ${whereStr}
        ORDER BY p.code LIMIT ? OFFSET ?
      `).all(...args, per_page, offset);

      return { products: rows, total, total_pages: totalPages, page };

    } else if (filter === 'no_commission') {
      let where = ['COALESCE(p.no_commission, 0) = 1'];
      let args = [];
      if (search) {
        where.push('(p.code LIKE ? OR p.name LIKE ?)');
        args.push(`%${search}%`, `%${search}%`);
      }
      const whereStr = where.join(' AND ');

      const countRow = db.prepare(
        `SELECT COUNT(*) as total FROM product p WHERE ${whereStr}`
      ).get(...args);
      const total = countRow.total;
      const totalPages = Math.ceil(total / per_page) || 1;
      const offset = (page - 1) * per_page;

      const rows = db.prepare(`
        SELECT p.code as product_code, p.name, p.unit, p.std_price as cost_price,
          COALESCE(p.no_commission, 0) as no_commission
        FROM product p WHERE ${whereStr}
        ORDER BY p.code LIMIT ? OFFSET ?
      `).all(...args, per_page, offset);

      return { products: rows, total, total_pages: totalPages, page };

    } else {
      // 'all' — all products from product table (includes auto-created entries with NULL cost)
      let where = ['1=1'];
      let args = [];
      if (search) {
        where.push('(p.code LIKE ? OR p.name LIKE ?)');
        args.push(`%${search}%`, `%${search}%`);
      }
      const whereStr = where.join(' AND ');

      const countRow = db.prepare(
        `SELECT COUNT(*) as total FROM product p WHERE ${whereStr}`
      ).get(...args);
      const total = countRow.total;
      const totalPages = Math.ceil(total / per_page) || 1;
      const offset = (page - 1) * per_page;

      const rows = db.prepare(`
        SELECT p.code as product_code, p.name, p.unit, p.std_price as cost_price,
          COALESCE(p.no_commission, 0) as no_commission
        FROM product p WHERE ${whereStr}
        ORDER BY (CASE WHEN p.std_price IS NULL THEN 0 ELSE 1 END), p.code LIMIT ? OFFSET ?
      `).all(...args, per_page, offset);

      return { products: rows, total, total_pages: totalPages, page };
    }
  });

  // Get cost coverage summary stats
  ipcMain.handle('cost:getSummary', async () => {
    const db = getDb();

    const stats = db.prepare(`
      SELECT
        COUNT(*) as product_count,
        SUM(CASE WHEN std_price IS NOT NULL THEN 1 ELSE 0 END) as with_cost,
        SUM(CASE WHEN std_price IS NULL THEN 1 ELSE 0 END) as missing_cost,
        SUM(CASE WHEN COALESCE(no_commission, 0) = 1 THEN 1 ELSE 0 END) as no_commission_count
      FROM product
    `).get();

    return {
      product_count: stats.product_count || 0,
      item_codes_total: stats.product_count || 0,
      item_codes_with_cost: stats.with_cost || 0,
      item_codes_missing: stats.missing_cost || 0,
      no_commission_count: stats.no_commission_count || 0,
    };
  });

  // Update single product field
  ipcMain.handle('cost:updateProduct', async (_, params) => {
    try {
      const db = getDb();
      const { code, name, unit, std_price } = params;
      if (!code) return { success: false, error: 'Missing code' };

      const priceVal = (std_price === '' || std_price === null || std_price === undefined)
        ? null
        : parseFloat(std_price);

      db.prepare(
        'UPDATE product SET name = ?, unit = ?, std_price = ? WHERE code = ?'
      ).run(name || '', unit || '', (priceVal !== null && !isNaN(priceVal)) ? priceVal : null, code);

      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // Batch update multiple products
  ipcMain.handle('cost:updateProducts', async (_, items) => {
    try {
      const db = getDb();
      const update = db.prepare(
        'UPDATE product SET name = ?, unit = ?, std_price = ? WHERE code = ?'
      );

      let count = 0;
      const updateAll = db.transaction(() => {
        for (const item of items) {
          const priceVal = (item.std_price === '' || item.std_price === null || item.std_price === undefined)
            ? null
            : parseFloat(item.std_price);
          update.run(
            item.name || '', item.unit || '',
            (priceVal !== null && !isNaN(priceVal)) ? priceVal : null,
            item.code
          );
          count++;
        }
      });
      updateAll();

      return { success: true, count };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // Toggle no_commission flag for a product
  ipcMain.handle('cost:toggleCommission', async (_, params) => {
    try {
      const db = getDb();
      const { code, no_commission } = params;
      if (!code) return { success: false, error: 'Missing code' };
      db.prepare(
        'UPDATE product SET no_commission = ? WHERE code = ?'
      ).run(no_commission ? 1 : 0, code);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // Delete all cost data (requires confirmation code)
  ipcMain.handle('cost:deleteAll', async (_, params) => {
    const { confirmCode } = params || {};
    if (confirmCode !== 'ลบทั้งหมด') {
      return { success: false, error: 'รหัสยืนยันไม่ถูกต้อง' };
    }
    const db = getDb();
    db.prepare('DELETE FROM product').run();
    return { success: true };
  });
}

module.exports = { registerCostHandlers };
