import iconv from 'iconv-lite'

export interface InvoiceItem {
  line_no: number
  product_code: string
  description: string
  quantity: number
  unit: string
  unit_price: number
  discount: string
  amount: number
  so_line_ref: string
}

export interface Invoice {
  invoice_no: string
  invoice_type: string
  date: string | null
  customer_name: string
  vat_type: string
  discount_pct: number
  subtotal: number
  vat: number
  total: number
  due_date: string | null
  so_ref: string
  is_paid: string
  is_cancelled: boolean
  items: InvoiceItem[]
}

export interface ParseResult {
  salesperson: { name: string; nickname: string }
  period: { start: string; end: string }
  invoices: Invoice[]
  summary: { total_invoices: number; subtotal: number; vat: number; total: number }
  cancelled_count: number
}

/**
 * Parse Thai Buddhist date DD/MM/BBBB or DD/MM/BB to ISO YYYY-MM-DD.
 */
function parseDate(dateStr: string): string | null {
  if (!dateStr || !dateStr.trim()) return null
  const m = dateStr.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/)
  if (!m) return null
  const day = parseInt(m[1], 10)
  const month = parseInt(m[2], 10)
  let yearBE = parseInt(m[3], 10)
  if (yearBE < 100) yearBE += 2500
  const yearCE = yearBE - 543
  const d = new Date(yearCE, month - 1, day)
  if (isNaN(d.getTime())) return null
  return `${yearCE}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function parseFloat2(val: string): number {
  if (!val || !val.trim()) return 0
  const n = parseFloat(val.replace(/,/g, '').trim())
  return isNaN(n) ? 0 : n
}

function parseDiscountPct(val: string): number {
  if (!val || !val.trim()) return 0
  const m = val.trim().match(/([\d.]+)%/)
  return m ? parseFloat(m[1]) : 0
}

/**
 * Parse CSV line respecting quotes.
 */
export function parseCsvLine(line: string): string[] {
  const cols: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        current += ch
      }
    } else {
      if (ch === '"') {
        inQuotes = true
      } else if (ch === ',') {
        cols.push(current)
        current = ''
      } else {
        current += ch
      }
    }
  }
  cols.push(current)
  return cols
}

function isFixedWidthFormat(lines: string[]): boolean {
  let singleColCount = 0
  let multiColCount = 0
  const checkCount = Math.min(15, lines.length)
  for (let i = 0; i < checkCount; i++) {
    const line = lines[i].replace(/\r$/, '').trim()
    if (!line) continue
    let commas = 0
    let inQ = false
    for (const ch of line) {
      if (ch === '"') inQ = !inQ
      else if (ch === ',' && !inQ) commas++
    }
    if (commas === 0) singleColCount++
    else multiColCount++
  }
  return singleColCount > multiColCount
}

function parseFixedWidthReport(content: string): ParseResult {
  const lines = content.split('\n')

  const result: ParseResult = {
    salesperson: { name: '', nickname: '' },
    period: { start: '', end: '' },
    invoices: [],
    summary: { total_invoices: 0, subtotal: 0, vat: 0, total: 0 },
    cancelled_count: 0,
  }

  const cleanLines = lines.map(l => {
    l = l.replace(/\r$/, '')
    if (l.startsWith('"') && l.endsWith('"')) {
      l = l.slice(1, -1).replace(/""/g, '"')
    }
    return l
  })

  let currentInvoice: Invoice | null = null
  let salespersonFound = false

  const invHeaderRe = /^\s*(\*?)\s*((?:IV|IS)\d+)\s+(\d{1,2}\/\d{1,2}\/\d{2,4})\s+(.+?)\s{2,}(\d)\s+(?:([\d.]+%)\s+)?([\d,.]+)\s+([\d,.]+)\s+([\d,.]+)\s+(\d{1,2}\/\d{1,2}\/\d{2,4})\s+((?:SO|QT)\d+)\s+([YN])\s*$/
  const itemWithAmountRe = /^\s+(\d+)\s+(\S+)\s+(.+?)\s+([\d,.]+)(\S+)\s+([\d,.]+)\s+(?:([\d]+%)\s+)?([\d,.]+)\s+(?:.*?)((?:SO|QT)\d+-\s*\d+)/
  const itemNoAmountRe = /^\s+(\d+)\s+(\S+)\s+(.+?)\s+([\d,.]+)(\S+)\s+(?:.*?)((?:SO|QT)\d+-\s*\d+)/
  const salespersonRe = /^\s{2,}(.+?)\s+\/\s*(\S+)\s*$/
  const grandTotalRe = /รวมทั้งสิ้น\s+(\d+)\s+ใบ\s+([\d,.]+)\s+([\d,.]+)\s+([\d,.]+)/
  const cancelledRe = /มี\s+(\d+)\s+ใบ/

  for (const line of cleanLines) {
    if (!line.trim()) {
      if (currentInvoice) {
        result.invoices.push(currentInvoice)
        currentInvoice = null
      }
      continue
    }

    if (line.includes('จบรายงาน')) break

    if (/หน้า\s*:/.test(line) && line.includes('บริษัท')) continue
    if (line.includes('รายงานใบกำกับสินค้า')) continue
    if (line.includes('วันที่จาก')) continue
    if (line.includes('รหัสลูกค้า')) continue
    if (line.includes('พนักงานขาย')) continue
    if (line.includes('เลขที่') && line.includes('วันที่') && line.includes('ลูกค้า')) continue
    if (line.includes('รายละเอียด') && line.includes('จำนวน')) continue
    if (/^[\s"]*-{5,}/.test(line)) continue
    if (/^[\s"]*={5,}/.test(line)) continue

    const gtm = grandTotalRe.exec(line)
    if (gtm) {
      result.summary.total_invoices = parseInt(gtm[1]) || 0
      result.summary.subtotal = parseFloat2(gtm[2])
      result.summary.vat = parseFloat2(gtm[3])
      result.summary.total = parseFloat2(gtm[4])
      continue
    }

    if (line.includes('รวม') && !line.includes('รวมทั้งสิ้น') && salespersonFound) {
      continue
    }

    if (line.includes('หมายเหตุ') || line.includes('ยกเลิก')) {
      const cm = cancelledRe.exec(line.replace(/\xa0/g, ' '))
      if (cm) result.cancelled_count = parseInt(cm[1])
      continue
    }

    if (line.trim().startsWith('นำหน้า')) continue

    if (!salespersonFound) {
      const spm = salespersonRe.exec(line)
      if (spm) {
        result.salesperson.name = spm[1].trim()
        result.salesperson.nickname = spm[2].trim()
        salespersonFound = true
        continue
      }
    }

    const ihm = invHeaderRe.exec(line)
    if (ihm) {
      if (currentInvoice) {
        result.invoices.push(currentInvoice)
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
        items: [],
      }
      continue
    }

    if (currentInvoice) {
      const itm = itemWithAmountRe.exec(line)
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
        })
        continue
      }
      const itm2 = itemNoAmountRe.exec(line)
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
        })
        continue
      }
    }
  }

  if (currentInvoice) {
    result.invoices.push(currentInvoice)
  }

  const nonCancelled = result.invoices.filter(inv => !inv.is_cancelled)
  const dates = nonCancelled.map(inv => inv.date).filter(Boolean) as string[]
  if (dates.length) {
    result.period.start = dates.reduce((a, b) => (a < b ? a : b))
    result.period.end = dates.reduce((a, b) => (a > b ? a : b))
  }

  return result
}

/**
 * Parse a salesperson invoice CSV (cp874 encoded).
 * Accepts Buffer (from file upload) instead of file path.
 * Auto-detects between comma-separated CSV and fixed-width single-column format.
 */
export function parseInvoiceCsv(buffer: Buffer): ParseResult {
  const content = iconv.decode(buffer, 'cp874')
  const lines = content.split('\n')

  if (isFixedWidthFormat(lines)) {
    return parseFixedWidthReport(content)
  }

  // --- Original comma-separated CSV parser ---
  const result: ParseResult = {
    salesperson: { name: '', nickname: '' },
    period: { start: '', end: '' },
    invoices: [],
    summary: { total_invoices: 0, subtotal: 0, vat: 0, total: 0 },
    cancelled_count: 0,
  }

  let currentInvoice: Invoice | null = null
  let salespersonFound = false

  for (const rawLine of lines) {
    const line = rawLine.replace(/\r?\n$/, '')
    if (!line.trim()) {
      if (currentInvoice) {
        result.invoices.push(currentInvoice)
        currentInvoice = null
      }
      continue
    }

    let cols: string[]
    try {
      cols = parseCsvLine(line)
    } catch {
      continue
    }

    if (cols.length < 2) continue

    const col1 = (cols[1] || '').trim()

    if (col1.includes('จบรายงาน')) break

    if (/หน้า\s*:/.test(col1) && col1.includes('บริษัท')) continue
    if (col1.includes('รายงานใบกำกับสินค้า')) continue
    if (col1.includes('วันที่จาก')) continue
    if (col1.includes('รหัสลูกค้า')) continue
    if (col1.includes('พนักงานขาย')) continue

    if (cols.length > 4 && (cols[4] || '').trim() === 'เลขที่') continue
    if (cols.length > 8) {
      const col8 = (cols[8] || '').trim()
      if (col8 === 'รายละเอียด' || col8 === 'ส่วนลด') continue
    }

    if (cols.length > 9) {
      const col9 = (cols[9] || '').trim()
      if (col9.startsWith('---') || col9.startsWith('===')) continue
    }

    if (cols.length > 6 && (cols[6] || '').trim().includes('รวมทั้งสิ้น')) {
      result.summary.total_invoices = parseInt((cols[7] || '').trim()) || 0
      result.summary.subtotal = cols.length > 9 ? parseFloat2(cols[9]) : 0
      result.summary.vat = cols.length > 11 ? parseFloat2(cols[11]) : 0
      result.summary.total = cols.length > 13 ? parseFloat2(cols[13]) : 0
      continue
    }

    if (!salespersonFound && col1 && cols.length >= 3) {
      const col2 = (cols[2] || '').trim()
      const col4 = cols.length > 4 ? (cols[4] || '').trim() : ''
      const skipWords = ['บริษัท', 'รายงาน', 'วันที่', 'รหัส', 'พนักงาน', 'หมายเหตุ', '---', '===']
      if (col2 && !col4 && !skipWords.some(kw => col1.includes(kw))) {
        result.salesperson.name = col1
        result.salesperson.nickname = col2
        salespersonFound = true
        continue
      }
    }

    if (cols.length >= 14 && col1 && salespersonFound) {
      const col9 = (cols[9] || '').trim()
      const col2 = (cols[2] || '').trim()
      if (col2 && col9 && /^[\d.]+$/.test(col9)) continue
    }

    if (col1.includes('หมายเหตุ') || col1.includes('ยกเลิก')) {
      const m = col1.replace(/\xa0/g, ' ').match(/มี\s+(\d+)\s+ใบ/)
      if (m) result.cancelled_count = parseInt(m[1])
      continue
    }

    if (col1.includes('------') || col1.includes('นำหน้า')) continue

    if (cols.length > 4) {
      const invNo = (cols[4] || '').trim()
      if (invNo && (invNo.startsWith('IV') || invNo.startsWith('IS'))) {
        if (currentInvoice) {
          result.invoices.push(currentInvoice)
        }

        const isCancelled = (cols[3] || '').includes('*')

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
          items: [],
        }
        continue
      }
    }

    if (currentInvoice && cols.length > 7) {
      const lineNoStr = (cols[7] || '').trim()
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
        })
      }
    }
  }

  if (currentInvoice) {
    result.invoices.push(currentInvoice)
  }

  const nonCancelled = result.invoices.filter(inv => !inv.is_cancelled)
  const dates = nonCancelled.map(inv => inv.date).filter(Boolean) as string[]
  if (dates.length) {
    result.period.start = dates.reduce((a, b) => (a < b ? a : b))
    result.period.end = dates.reduce((a, b) => (a > b ? a : b))
  }

  return result
}
