const { ipcMain } = require('electron');
const path = require('path');
const { getDb } = require('../database');
const { parseInvoiceCsv } = require('../parser/invoiceParser');

function registerImportHandlers(dataPath) {
  // Preview a single CSV file (also checks for duplicates in DB)
  ipcMain.handle('import:previewInvoice', async (_, filePath) => {
    try {
      // Validate file path - must be a string and end with .csv
      if (typeof filePath !== 'string' || !filePath.toLowerCase().endsWith('.csv')) {
        return { success: false, error: 'ไฟล์ต้องเป็น CSV เท่านั้น' };
      }
      const data = parseInvoiceCsv(filePath);
      const nonCancelled = data.invoices.filter(i => !i.is_cancelled);
      const cancelled = data.invoices.filter(i => i.is_cancelled);

      // Check which invoices already exist in DB and detect changes
      const db = getDb();
      // For credit notes, invoice_no + company must be unique (SR numbers may overlap between companies)
      const checkExisting = db.prepare(
        'SELECT id, is_paid, subtotal, vat, total, is_cancelled FROM invoice WHERE invoice_no = ? AND company = ?'
      );
      let duplicateCount = 0;
      let updatedPaidCount = 0;
      let dataChangedCount = 0;
      const changedInvoices = [];
      for (const inv of data.invoices) {
        const existing = checkExisting.get(inv.invoice_no, data.company);
        if (existing) {
          duplicateCount++;
          if (existing.is_paid !== inv.is_paid) updatedPaidCount++;
          // Check if financial data differs
          const isCancelledNum = inv.is_cancelled ? 1 : 0;
          if (Math.abs(existing.subtotal - inv.subtotal) > 0.01 ||
              Math.abs(existing.vat - inv.vat) > 0.01 ||
              Math.abs(existing.total - inv.total) > 0.01 ||
              existing.is_cancelled !== isCancelledNum) {
            dataChangedCount++;
            changedInvoices.push({
              invoice_no: inv.invoice_no,
              changes: {
                subtotal: existing.subtotal !== inv.subtotal ? { old: existing.subtotal, new: inv.subtotal } : null,
                vat: existing.vat !== inv.vat ? { old: existing.vat, new: inv.vat } : null,
                total: existing.total !== inv.total ? { old: existing.total, new: inv.total } : null,
                is_cancelled: existing.is_cancelled !== isCancelledNum ? { old: existing.is_cancelled, new: isCancelledNum } : null,
              },
            });
          }
        }
      }
      const newCount = data.invoices.length - duplicateCount;

      const companyLabel = data.company === 'kitchai' ? 'กิจชัย' : 'ทาเลนท์';
      const docTypeLabel = data.doc_type === 'credit_note' ? 'ใบลดหนี้' : 'ใบขาย';

      return {
        success: true,
        filename: path.basename(filePath),
        salesperson: data.salesperson,
        period: data.period,
        company: data.company,
        company_label: companyLabel,
        doc_type: data.doc_type,
        doc_type_label: docTypeLabel,
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
        sr_count: nonCancelled.filter(i => i.invoice_type === 'SR').length,
        subtotal: data.summary.subtotal,
        vat: data.summary.vat,
        total: data.summary.total,
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // Import multiple CSV files
  ipcMain.handle('import:invoices', async (_, filePaths) => {
    const results = [];

    for (const filePath of filePaths) {
      try {
        // Validate each file path
        if (typeof filePath !== 'string' || !filePath.toLowerCase().endsWith('.csv')) {
          results.push({ success: false, filename: String(filePath), error: 'ไฟล์ต้องเป็น CSV เท่านั้น' });
          continue;
        }
        const data = parseInvoiceCsv(filePath);
        const saved = saveInvoiceData(data, path.basename(filePath));
        results.push(saved);
      } catch (err) {
        results.push({
          success: false,
          filename: path.basename(String(filePath)),
          error: err.message,
        });
      }
    }

    return { results };
  });
}

function saveInvoiceData(data, filename) {
  const db = getDb();
  const company = data.company || 'talent';
  const docType = data.doc_type || 'invoice';

  // Check duplicates using company-scoped lookup
  const checkExisting = db.prepare(
    'SELECT id, is_paid, subtotal, vat, total, is_cancelled FROM invoice WHERE invoice_no = ? AND company = ?'
  );
  const updateInvoice = db.prepare(
    'UPDATE invoice SET is_paid = ?, subtotal = ?, vat = ?, total = ?, is_cancelled = ? WHERE id = ?'
  );
  let skipped = 0;
  let imported = 0;
  let updated = 0;

  // Pre-scan: update existing invoices where data changed
  for (const inv of data.invoices) {
    const existing = checkExisting.get(inv.invoice_no, company);
    if (existing) {
      skipped++;
      const isCancelledNum = inv.is_cancelled ? 1 : 0;
      const paidChanged = existing.is_paid !== inv.is_paid;
      const dataChanged = Math.abs(existing.subtotal - inv.subtotal) > 0.01 ||
                          Math.abs(existing.vat - inv.vat) > 0.01 ||
                          Math.abs(existing.total - inv.total) > 0.01 ||
                          existing.is_cancelled !== isCancelledNum;
      if (paidChanged || dataChanged) {
        updateInvoice.run(inv.is_paid, inv.subtotal, inv.vat, inv.total, isCancelledNum, existing.id);
        updated++;
      }
    }
  }

  // If all invoices are duplicates, skip creating batch entirely
  if (skipped === data.invoices.length) {
    return {
      success: true,
      filename,
      salesperson: data.salesperson,
      company,
      doc_type: docType,
      imported: 0,
      skipped,
      updated,
      total: data.invoices.length,
      total_amount: 0,
    };
  }

  // Get or create salesperson
  const sp = data.salesperson;
  let spRow = db.prepare('SELECT id FROM salesperson WHERE name = ?').get(sp.name);
  let spId;
  if (spRow) {
    spId = spRow.id;
  } else {
    const info = db.prepare('INSERT INTO salesperson (name, nickname) VALUES (?, ?)').run(sp.name, sp.nickname);
    spId = info.lastInsertRowid;
  }

  // Create import batch
  const nonCancelled = data.invoices.filter(i => !i.is_cancelled);
  const totalAmount = nonCancelled.reduce((sum, i) => sum + i.total, 0);

  const batchInfo = db.prepare(`
    INSERT INTO import_batch (filename, salesperson_id, period_start, period_end,
                              total_invoices, total_amount, company, doc_type)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(filename, spId, data.period.start, data.period.end,
         data.invoices.length, totalAmount, company, docType);
  const batchId = batchInfo.lastInsertRowid;

  // Prepared statements for batch insert
  const insertInvoice = db.prepare(`
    INSERT INTO invoice (batch_id, invoice_no, invoice_type, date,
      customer_name, vat_type, discount_pct, subtotal, vat, total,
      due_date, so_ref, is_paid, is_cancelled, company, doc_type, ref_invoice_no)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertItem = db.prepare(`
    INSERT INTO invoice_item (invoice_id, line_no, product_code,
      description, quantity, unit, unit_price, discount, amount, so_line_ref, is_returned)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // Reset counters for actual insert (updated already counted above)
  skipped = 0;
  imported = 0;

  // Use transaction for performance
  const insertAll = db.transaction(() => {
    for (const inv of data.invoices) {
      const existing = checkExisting.get(inv.invoice_no, company);
      if (existing) {
        skipped++;
        continue;
      }

      const invInfo = insertInvoice.run(
        batchId, inv.invoice_no, inv.invoice_type, inv.date,
        inv.customer_name, inv.vat_type, inv.discount_pct,
        inv.subtotal, inv.vat, inv.total,
        inv.due_date, inv.so_ref || '', inv.is_paid,
        inv.is_cancelled ? 1 : 0,
        company, docType, inv.ref_invoice_no || ''
      );
      const invId = invInfo.lastInsertRowid;

      for (const item of inv.items) {
        insertItem.run(
          invId, item.line_no, item.product_code,
          item.description, item.quantity, item.unit,
          item.unit_price, item.discount, item.amount,
          item.so_line_ref, item.is_returned || 'N'
        );
      }
      imported++;
    }
  });

  insertAll();

  // If no invoices were actually imported, delete the empty batch
  if (imported === 0) {
    db.prepare('DELETE FROM import_batch WHERE id = ?').run(batchId);
  } else {
    // Update batch to reflect actual imported count
    db.prepare('UPDATE import_batch SET total_invoices = ? WHERE id = ?').run(imported, batchId);
  }

  // Auto-create product entries (without cost) for new product codes
  const newProducts = db.prepare(`
    SELECT ii.product_code, MAX(ii.description) as name, MAX(ii.unit) as unit
    FROM invoice_item ii
    WHERE ii.product_code IS NOT NULL AND ii.product_code != ''
      AND ii.product_code NOT IN (SELECT code FROM product WHERE code IS NOT NULL)
    GROUP BY ii.product_code
  `).all();

  if (newProducts.length > 0) {
    const insertProduct = db.prepare(
      'INSERT OR IGNORE INTO product (code, name, unit, std_price) VALUES (?, ?, ?, NULL)'
    );
    const insertAllProducts = db.transaction(() => {
      for (const p of newProducts) {
        insertProduct.run(p.product_code, p.name, p.unit);
      }
    });
    insertAllProducts();
  }

  return {
    success: true,
    filename,
    salesperson: sp,
    company,
    doc_type: docType,
    imported,
    skipped,
    updated,
    total: data.invoices.length,
    total_amount: totalAmount,
    missing_cost_count: newProducts.length,
  };
}

module.exports = { registerImportHandlers };
