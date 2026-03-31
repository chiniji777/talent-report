const fs = require('fs');
const iconv = require('iconv-lite');

/**
 * Parse Thai Buddhist date DD/MM/BBBB or DD/MM/BB to ISO YYYY-MM-DD.
 * Supports both 4-digit (2569) and 2-digit (69) Buddhist year.
 */
function parseDate(dateStr) {
  if (!dateStr || !dateStr.trim()) return null;
  const m = dateStr.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (!m) return null;
  const day = parseInt(m[1], 10);
  const month = parseInt(m[2], 10);
  let yearBE = parseInt(m[3], 10);
  // Handle 2-digit year: assume 25xx Buddhist era
  if (yearBE < 100) yearBE += 2500;
  const yearCE = yearBE - 543;
  const d = new Date(yearCE, month - 1, day);
  if (isNaN(d.getTime())) return null;
  return `${yearCE}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * Parse a number string, return 0 if empty.
 */
function parseFloat2(val) {
  if (!val || !val.trim()) return 0;
  const n = parseFloat(val.replace(/,/g, '').trim());
  return isNaN(n) ? 0 : n;
}

/**
 * Parse discount percentage like '6.54%' or empty.
 */
function parseDiscountPct(val) {
  if (!val || !val.trim()) return 0;
  const m = val.trim().match(/([\d.]+)%/);
  return m ? parseFloat(m[1]) : 0;
}

/**
 * Parse CSV line respecting quotes.
 */
function parseCsvLine(line) {
  const cols = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"' && current === '') {
        inQuotes = true;
      } else if (ch === '"') {
        current += ch;
      } else if (ch === ',') {
        cols.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
  }
  cols.push(current);
  return cols;
}

/**
 * Detect if the file is in single-column fixed-width format.
 * In this format, each line is a single quoted value with no commas.
 */
function isFixedWidthFormat(lines) {
  let singleColCount = 0;
  let multiColCount = 0;
  const checkCount = Math.min(15, lines.length);
  for (let i = 0; i < checkCount; i++) {
    const line = lines[i].replace(/\r$/, '').trim();
    if (!line) continue;
    // Count commas outside quotes
    let commas = 0;
    let inQ = false;
    for (const ch of line) {
      if (ch === '"') inQ = !inQ;
      else if (ch === ',' && !inQ) commas++;
    }
    if (commas === 0) singleColCount++;
    else multiColCount++;
  }
  return singleColCount > multiColCount;
}

/**
 * Detect company from the first line of the report.
 * Returns 'talent' or 'kitchai'.
 */
function detectCompany(content) {
  if (content.includes('กิจชัย')) return 'kitchai';
  return 'talent';
}

/**
 * Detect document type from the report header.
 * Returns 'invoice' or 'credit_note'.
 */
function detectDocType(content) {
  // Check first 5 lines for credit note header
  const head = content.substring(0, 1000);
  if (head.includes('ใบลดหนี้') || head.includes('รับคืนสินค้า')) return 'credit_note';
  return 'invoice';
}

/**
 * Parse a fixed-width (single-column) invoice report.
 * Each line is either a bare text line or wrapped in quotes as one CSV field.
 */
function parseFixedWidthReport(content) {
  const lines = content.split('\n');

  const result = {
    company: detectCompany(content),
    doc_type: detectDocType(content),
    salesperson: { name: '', nickname: '' },
    period: { start: '', end: '' },
    invoices: [],
    summary: { total_invoices: 0, subtotal: 0, vat: 0, total: 0 },
    cancelled_count: 0,
  };

  // Strip CSV quotes from each line
  const cleanLines = lines.map(l => {
    l = l.replace(/\r$/, '');
    if (l.startsWith('"') && l.endsWith('"')) {
      l = l.slice(1, -1).replace(/""/g, '"');
    }
    return l;
  });

  let currentInvoice = null;
  let salespersonFound = false;

  // Regex for invoice header line
  // e.g.: "  IS2505396    05/01/69 อู่ สีกรุงเทพ 2000                       2                  4570.00       319.90        4889.90  05/01/69 SO0117504   Y"
  // Also: " *IV6900814    14/01/69 ..."  (cancelled with *)
  const invHeaderRe = /^\s*(\*?)\s*((?:IV|IS)\d+)\s+(\d{1,2}\/\d{1,2}\/\d{2,4})\s+(.+?)\s{2,}(\d)\s+(?:([\d.]+%)\s+)?([\d,.]+)\s+([\d,.]+)\s+([\d,.]+)\s+(\d{1,2}\/\d{1,2}\/\d{2,4})\s+((?:SO|QT)\d+)\s+([YN])\s*$/;

  // Regex for invoice item line
  // e.g.: "       1 01-ก004  กระดาษกาว อินเตอร์                   2.00กล่อง         2285.000                  4570.00                      SO0117504-  1"
  const itemWithAmountRe = /^\s+(\d+)\s+(\S+)\s+(.+?)\s+([\d,.]+)(\S+)\s+([\d,.]+)\s+(?:([\d]+%)\s+)?([\d,.]+)\s+(?:.*?)((?:SO|QT)\d+-\s*\d+)/;

  // Item line with no price/amount (free items)
  // e.g.: "       2 44-ฮ150  ฮาร์ดสีพื้น NASON 313-10             6.00กระป๋อง                                                              SO0117489-  8"
  const itemNoAmountRe = /^\s+(\d+)\s+(\S+)\s+(.+?)\s+([\d,.]+)(\S+)\s+(?:.*?)((?:SO|QT)\d+-\s*\d+)/;

  // Salesperson line: "  ประพันธ์ ครุธระเบียบ /ป๊อก"
  const salespersonRe = /^\s{2,}(.+?)\s+\/\s*(\S+)\s*$/;

  // Grand total line
  const grandTotalRe = /รวมทั้งสิ้น\s+(\d+)\s+ใบ\s+([\d,.]+)\s+([\d,.]+)\s+([\d,.]+)/;

  // Cancelled note
  const cancelledRe = /มี\s+(\d+)\s+ใบ/;

  for (const line of cleanLines) {
    if (!line.trim()) {
      if (currentInvoice) {
        result.invoices.push(currentInvoice);
        currentInvoice = null;
      }
      continue;
    }

    // End of report
    if (line.includes('จบรายงาน')) break;

    // Skip page headers, report titles, date ranges, separators
    if (/หน้า\s*:/.test(line) && (line.includes('บริษัท') || line.includes('กิจชัย'))) continue;
    if (line.includes('รายงานใบกำกับสินค้า')) continue;
    if (line.includes('รายงานใบลดหนี้')) continue;
    if (line.includes('วันที่จาก')) continue;
    if (line.includes('รหัสลูกค้า')) continue;
    if (line.includes('พนักงานขาย')) continue;
    if (line.includes('เลขที่') && line.includes('วันที่') && line.includes('ลูกค้า')) continue;
    if (line.includes('รายละเอียด') && line.includes('จำนวน')) continue;
    if (/^[\s"]*-{5,}/.test(line)) continue;
    if (/^[\s"]*={5,}/.test(line)) continue;

    // Grand total line
    const gtm = grandTotalRe.exec(line);
    if (gtm) {
      result.summary.total_invoices = parseInt(gtm[1]) || 0;
      result.summary.subtotal = parseFloat2(gtm[2]);
      result.summary.vat = parseFloat2(gtm[3]);
      result.summary.total = parseFloat2(gtm[4]);
      continue;
    }

    // Salesperson subtotal line (contains "รวม" + name)
    if (line.includes('รวม') && !line.includes('รวมทั้งสิ้น') && salespersonFound) {
      continue;
    }

    // Cancelled note
    if (line.includes('หมายเหตุ') || line.includes('ยกเลิก')) {
      const cm = cancelledRe.exec(line.replace(/\xa0/g, ' '));
      if (cm) result.cancelled_count = parseInt(cm[1]);
      continue;
    }

    // Skip other note/remark lines
    if (line.trim().startsWith('นำหน้า')) continue;

    // Salesperson name line (before any invoice)
    if (!salespersonFound) {
      const spm = salespersonRe.exec(line);
      if (spm) {
        result.salesperson.name = spm[1].trim();
        result.salesperson.nickname = spm[2].trim();
        salespersonFound = true;
        continue;
      }
    }

    // Invoice header line
    const ihm = invHeaderRe.exec(line);
    if (ihm) {
      if (currentInvoice) {
        result.invoices.push(currentInvoice);
      }
      currentInvoice = {
        invoice_no: ihm[2],
        invoice_type: ihm[2].startsWith('IV') ? 'IV' : 'IS',
        date: parseDate(ihm[3]),
        customer_name: ihm[4].trim(),
        vat_type: ihm[5],
        discount_pct: ihm[6] ? parseDiscountPct(ihm[6]) : 0,
        subtotal: parseFloat2(ihm[7]),
        vat: parseFloat2(ihm[8]),
        total: parseFloat2(ihm[9]),
        due_date: parseDate(ihm[10]),
        so_ref: ihm[11],
        is_paid: ihm[12],
        is_cancelled: ihm[1] === '*',
        ref_invoice_no: '',
        items: [],
      };
      continue;
    }

    // Invoice item line
    if (currentInvoice) {
      const itm = itemWithAmountRe.exec(line);
      if (itm) {
        currentInvoice.items.push({
          line_no: parseInt(itm[1]),
          product_code: itm[2].trim(),
          description: itm[3].trim(),
          quantity: parseFloat2(itm[4]),
          unit: itm[5].trim(),
          unit_price: parseFloat2(itm[6]),
          discount: itm[7] || '',
          amount: parseFloat2(itm[8]),
          so_line_ref: itm[9].trim(),
          is_returned: 'N',
        });
        continue;
      }
      // Try no-amount pattern (free items)
      const itm2 = itemNoAmountRe.exec(line);
      if (itm2) {
        currentInvoice.items.push({
          line_no: parseInt(itm2[1]),
          product_code: itm2[2].trim(),
          description: itm2[3].trim(),
          quantity: parseFloat2(itm2[4]),
          unit: itm2[5].trim(),
          unit_price: 0,
          discount: '',
          amount: 0,
          so_line_ref: itm2[6].trim(),
          is_returned: 'N',
        });
        continue;
      }
    }

    // Skip remark/note lines under invoices (e.g., "     หมายเหตุ:", "       Grace")
  }

  // Append last invoice
  if (currentInvoice) {
    result.invoices.push(currentInvoice);
  }

  // Extract period from invoice dates
  const nonCancelled = result.invoices.filter(inv => !inv.is_cancelled);
  const dates = nonCancelled.map(inv => inv.date).filter(Boolean);
  if (dates.length) {
    result.period.start = dates.reduce((a, b) => (a < b ? a : b));
    result.period.end = dates.reduce((a, b) => (a > b ? a : b));
  }

  return result;
}

/**
 * Parse a credit note CSV file (comma-separated, cp874 encoded).
 *
 * Credit note format differs from invoice:
 * - Document numbers start with SR (e.g., SR6902001)
 * - Has "อ้างถึงใบกำกับ" (reference invoice) column
 * - Has "คืน" (returned) Y/N column per item
 * - Has "ตัดหนี้แล้ว" (debt cleared) and "ประเภท" columns
 * - No "ครบกำหนด", "ใบสั่งขาย", "เก็บเงิน" columns
 */
function parseCreditNoteCsv(content) {
  const lines = content.split('\n');

  const result = {
    company: detectCompany(content),
    doc_type: 'credit_note',
    salesperson: { name: '', nickname: '' },
    period: { start: '', end: '' },
    invoices: [],
    summary: { total_invoices: 0, subtotal: 0, vat: 0, total: 0 },
    cancelled_count: 0,
  };

  let currentInvoice = null;
  let salespersonFound = false;

  for (const rawLine of lines) {
    const line = rawLine.replace(/\r?\n$/, '');
    if (!line.trim()) {
      if (currentInvoice) {
        result.invoices.push(currentInvoice);
        currentInvoice = null;
      }
      continue;
    }

    let cols;
    try {
      cols = parseCsvLine(line);
    } catch {
      continue;
    }

    if (cols.length < 2) continue;

    const col1 = (cols[1] || '').trim();

    // End of report
    if (col1.includes('จบรายงาน')) break;

    // Page header
    if (/หน้า\s*:/.test(col1) && (col1.includes('บริษัท') || col1.includes('กิจชัย'))) continue;

    // Report title
    if (col1.includes('รายงานใบลดหนี้') || col1.includes('รับคืนสินค้า')) continue;

    // Date range line
    if (col1.includes('วันที่จาก')) continue;

    // Customer code range
    if (col1.includes('รหัสลูกค้า')) continue;

    // Salesperson filter line
    if (col1.includes('พนักงานขาย')) continue;

    // Column header lines
    if (cols.length > 4 && (cols[4] || '').trim() === 'เลขที่') continue;
    if (cols.length > 7 && ((cols[7] || '').trim() === 'คืน' || (cols[7] || '').trim() === 'อ้างถึงใบกำกับ')) continue;

    // Separator lines
    if (cols.length > 10) {
      const col10 = (cols[10] || '').trim();
      if (col10.startsWith('---') || col10.startsWith('===')) continue;
    }

    // Grand total line: "","รวมทั้งสิ้น",6,"ใบ","","","","","","",19768.00,1383.76,21151.76
    if (col1.includes('รวมทั้งสิ้น')) {
      result.summary.total_invoices = parseInt((cols[2] || '').trim()) || 0;
      result.summary.subtotal = cols.length > 10 ? parseFloat2(cols[10]) : 0;
      result.summary.vat = cols.length > 11 ? parseFloat2(cols[11]) : 0;
      result.summary.total = cols.length > 12 ? parseFloat2(cols[12]) : 0;
      continue;
    }

    // Salesperson subtotal line: "","รวม","ภูมิพิชาติ กันทับทิม","เจต",...
    if (col1 === 'รวม' && salespersonFound) continue;

    // Cancelled note
    if (col1.includes('หมายเหตุ') || col1.includes('ยกเลิก')) {
      const m = col1.replace(/\xa0/g, ' ').match(/มี\s+(\d+)\s+ใบ/);
      if (m) result.cancelled_count = parseInt(m[1]);
      continue;
    }

    // Skip separator/note lines
    if (col1.includes('------') || col1.includes('นำหน้า')) continue;

    // Salesperson name line
    if (!salespersonFound && col1 && cols.length >= 3) {
      const col2 = (cols[2] || '').trim();
      const col4 = cols.length > 4 ? (cols[4] || '').trim() : '';
      const skipWords = ['บริษัท', 'ห้าง', 'รายงาน', 'วันที่', 'รหัส', 'พนักงาน', 'หมายเหตุ', '---', '===', 'รวม'];
      if (col2 && !col4 && !skipWords.some(kw => col1.includes(kw))) {
        result.salesperson.name = col1;
        result.salesperson.nickname = col2;
        salespersonFound = true;
        continue;
      }
    }

    // ---- Credit Note Header ----
    // Format: "","","","","SR6902001",02/02/2569,"ลูกค้า","IV6900920","2","",870.00,60.90,930.90,"N","2"
    if (cols.length > 4) {
      const docNo = (cols[4] || '').trim();
      if (docNo && docNo.startsWith('SR')) {
        if (currentInvoice) {
          result.invoices.push(currentInvoice);
        }

        const isCancelled = (cols[3] || '').includes('*');
        const refInvoice = cols.length > 7 ? (cols[7] || '').trim() : '';

        currentInvoice = {
          invoice_no: docNo,
          invoice_type: 'SR',
          date: cols.length > 5 ? parseDate(cols[5]) : null,
          customer_name: cols.length > 6 ? (cols[6] || '').trim() : '',
          ref_invoice_no: refInvoice,
          vat_type: cols.length > 8 ? (cols[8] || '').trim() : '',
          discount_pct: cols.length > 9 ? parseDiscountPct(cols[9]) : 0,
          subtotal: cols.length > 10 ? parseFloat2(cols[10]) : 0,
          vat: cols.length > 11 ? parseFloat2(cols[11]) : 0,
          total: cols.length > 12 ? parseFloat2(cols[12]) : 0,
          due_date: null,
          so_ref: '',
          is_paid: cols.length > 13 ? (cols[13] || '').trim() : 'N',
          is_cancelled: isCancelled,
          items: [],
        };
        continue;
      }
    }

    // ---- Credit Note Item ----
    // Format: "","","","","","","","Y",1,"36-ล209","แลคเกอร์ 3200",3.00,"แกลอน",290.000,"",870.00,"IV6900920-  1"
    if (currentInvoice && cols.length > 8) {
      const isReturned = (cols[7] || '').trim();
      const lineNoStr = (cols[8] || '').trim();
      if (lineNoStr && /^\d+$/.test(lineNoStr) && (isReturned === 'Y' || isReturned === 'N')) {
        currentInvoice.items.push({
          line_no: parseInt(lineNoStr),
          product_code: cols.length > 9 ? (cols[9] || '').trim() : '',
          description: cols.length > 10 ? (cols[10] || '').trim() : '',
          quantity: cols.length > 11 ? parseFloat2(cols[11]) : 0,
          unit: cols.length > 12 ? (cols[12] || '').trim() : '',
          unit_price: cols.length > 13 ? parseFloat2(cols[13]) : 0,
          discount: cols.length > 14 ? (cols[14] || '').trim() : '',
          amount: cols.length > 15 ? parseFloat2(cols[15]) : 0,
          so_line_ref: cols.length > 16 ? (cols[16] || '').trim() : '',
          is_returned: isReturned,
        });
        continue;
      }
    }
  }

  // Append last invoice
  if (currentInvoice) {
    result.invoices.push(currentInvoice);
  }

  // Extract period from invoice dates
  const nonCancelled = result.invoices.filter(inv => !inv.is_cancelled);
  const dates = nonCancelled.map(inv => inv.date).filter(Boolean);
  if (dates.length) {
    result.period.start = dates.reduce((a, b) => (a < b ? a : b));
    result.period.end = dates.reduce((a, b) => (a > b ? a : b));
  }

  return result;
}

/**
 * Parse a salesperson invoice or credit note CSV file (cp874 encoded).
 * Auto-detects: comma-separated vs fixed-width, invoice vs credit note, company.
 *
 * Returns: {
 *   company: 'talent' | 'kitchai',
 *   doc_type: 'invoice' | 'credit_note',
 *   salesperson: { name, nickname },
 *   period: { start, end },
 *   invoices: [{ invoice_no, invoice_type, date, customer_name, ref_invoice_no, ..., items: [...] }],
 *   summary: { total_invoices, subtotal, vat, total },
 *   cancelled_count: number
 * }
 */
function parseInvoiceCsv(filePath) {
  const raw = fs.readFileSync(filePath);
  const content = iconv.decode(raw, 'cp874');
  const lines = content.split('\n');

  // Auto-detect format
  if (isFixedWidthFormat(lines)) {
    return parseFixedWidthReport(content);
  }

  // Detect document type
  const docType = detectDocType(content);
  if (docType === 'credit_note') {
    return parseCreditNoteCsv(content);
  }

  // --- Original comma-separated invoice CSV parser ---
  const result = {
    company: detectCompany(content),
    doc_type: 'invoice',
    salesperson: { name: '', nickname: '' },
    period: { start: '', end: '' },
    invoices: [],
    summary: { total_invoices: 0, subtotal: 0, vat: 0, total: 0 },
    cancelled_count: 0,
  };

  let currentInvoice = null;
  let salespersonFound = false;

  for (const rawLine of lines) {
    const line = rawLine.replace(/\r?\n$/, '');
    if (!line.trim()) {
      if (currentInvoice) {
        result.invoices.push(currentInvoice);
        currentInvoice = null;
      }
      continue;
    }

    let cols;
    try {
      cols = parseCsvLine(line);
    } catch {
      continue;
    }

    if (cols.length < 2) continue;

    const col1 = (cols[1] || '').trim();

    // End of report
    if (col1.includes('จบรายงาน')) break;

    // Page header: company name + "หน้า :" pattern
    if (/หน้า\s*:/.test(col1) && (col1.includes('บริษัท') || col1.includes('กิจชัย'))) continue;

    // Report title
    if (col1.includes('รายงานใบกำกับสินค้า')) continue;

    // Date range line
    if (col1.includes('วันที่จาก')) continue;

    // Customer code range
    if (col1.includes('รหัสลูกค้า')) continue;

    // Salesperson filter line
    if (col1.includes('พนักงานขาย')) continue;

    // Column header lines
    if (cols.length > 4 && (cols[4] || '').trim() === 'เลขที่') {
      continue;
    }
    if (cols.length > 8) {
      const col8 = (cols[8] || '').trim();
      if (col8 === 'รายละเอียด' || col8 === 'ส่วนลด') continue;
    }

    // Summary separator lines
    if (cols.length > 9) {
      const col9 = (cols[9] || '').trim();
      if (col9.startsWith('---') || col9.startsWith('===')) continue;
    }

    // Grand total line
    if (cols.length > 6 && (cols[6] || '').trim().includes('รวมทั้งสิ้น')) {
      result.summary.total_invoices = parseInt((cols[7] || '').trim()) || 0;
      result.summary.subtotal = cols.length > 9 ? parseFloat2(cols[9]) : 0;
      result.summary.vat = cols.length > 11 ? parseFloat2(cols[11]) : 0;
      result.summary.total = cols.length > 13 ? parseFloat2(cols[13]) : 0;
      continue;
    }

    // Salesperson name line
    if (!salespersonFound && col1 && cols.length >= 3) {
      const col2 = (cols[2] || '').trim();
      const col4 = cols.length > 4 ? (cols[4] || '').trim() : '';
      const skipWords = ['บริษัท', 'ห้าง', 'รายงาน', 'วันที่', 'รหัส', 'พนักงาน', 'หมายเหตุ', '---', '==='];
      if (col2 && !col4 && !skipWords.some(kw => col1.includes(kw))) {
        result.salesperson.name = col1;
        result.salesperson.nickname = col2;
        salespersonFound = true;
        continue;
      }
    }

    // Salesperson subtotal (end section with amounts)
    if (cols.length >= 14 && col1 && salespersonFound) {
      const col9 = (cols[9] || '').trim();
      const col2 = (cols[2] || '').trim();
      if (col2 && col9 && /^[\d.]+$/.test(col9)) continue;
    }

    // Cancelled note line
    if (col1.includes('หมายเหตุ') || col1.includes('ยกเลิก')) {
      const m = col1.replace(/\xa0/g, ' ').match(/มี\s+(\d+)\s+ใบ/);
      if (m) result.cancelled_count = parseInt(m[1]);
      continue;
    }

    // Skip other note lines
    if (col1.includes('------') || col1.includes('นำหน้า')) continue;

    // ---- Invoice Header ----
    if (cols.length > 4) {
      const invNo = (cols[4] || '').trim();
      if (invNo && (invNo.startsWith('IV') || invNo.startsWith('IS'))) {
        if (currentInvoice) {
          result.invoices.push(currentInvoice);
        }

        const isCancelled = (cols[3] || '').includes('*');

        currentInvoice = {
          invoice_no: invNo,
          invoice_type: invNo.startsWith('IV') ? 'IV' : 'IS',
          date: cols.length > 5 ? parseDate(cols[5]) : null,
          customer_name: cols.length > 6 ? (cols[6] || '').trim() : '',
          vat_type: cols.length > 7 ? (cols[7] || '').trim() : '',
          discount_pct: cols.length > 8 ? parseDiscountPct(cols[8]) : 0,
          subtotal: cols.length > 9 ? parseFloat2(cols[9]) : 0,
          vat: cols.length > 11 ? parseFloat2(cols[11]) : 0,
          total: cols.length > 13 ? parseFloat2(cols[13]) : 0,
          due_date: cols.length > 14 ? parseDate(cols[14]) : null,
          so_ref: cols.length > 15 ? (cols[15] || '').trim() : '',
          is_paid: cols.length > 16 ? (cols[16] || '').trim() : 'N',
          is_cancelled: isCancelled,
          ref_invoice_no: '',
          items: [],
        };
        continue;
      }
    }

    // ---- Invoice Detail (line item) ----
    if (currentInvoice && cols.length > 7) {
      const lineNoStr = (cols[7] || '').trim();
      if (lineNoStr && /^\d+$/.test(lineNoStr)) {
        currentInvoice.items.push({
          line_no: parseInt(lineNoStr),
          product_code: cols.length > 8 ? (cols[8] || '').trim() : '',
          description: cols.length > 9 ? (cols[9] || '').trim() : '',
          quantity: cols.length > 10 ? parseFloat2(cols[10]) : 0,
          unit: cols.length > 11 ? (cols[11] || '').trim() : '',
          unit_price: cols.length > 12 ? parseFloat2(cols[12]) : 0,
          discount: cols.length > 13 ? (cols[13] || '').trim() : '',
          amount: cols.length > 14 ? parseFloat2(cols[14]) : 0,
          so_line_ref: cols.length > 15 ? (cols[15] || '').trim() : '',
          is_returned: 'N',
        });
      }
    }
  }

  // Append last invoice
  if (currentInvoice) {
    result.invoices.push(currentInvoice);
  }

  // Extract period from invoice dates
  const nonCancelled = result.invoices.filter(inv => !inv.is_cancelled);
  const dates = nonCancelled.map(inv => inv.date).filter(Boolean);
  if (dates.length) {
    result.period.start = dates.reduce((a, b) => (a < b ? a : b));
    result.period.end = dates.reduce((a, b) => (a > b ? a : b));
  }

  return result;
}

module.exports = { parseInvoiceCsv };
