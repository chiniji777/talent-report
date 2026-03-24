import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'

let db: Database.Database | null = null
let dataPath = ''

export function initDb(dataDirPath: string): void {
  dataPath = dataDirPath
  if (!fs.existsSync(dataPath)) {
    fs.mkdirSync(dataPath, { recursive: true })
  }
  const backupDir = path.join(dataPath, 'backups')
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true })
  }

  const dbPath = path.join(dataPath, 'talent.db')
  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  db.exec(`
    CREATE TABLE IF NOT EXISTS salesperson (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      nickname TEXT,
      code TEXT,
      UNIQUE(name)
    );

    CREATE TABLE IF NOT EXISTS import_batch (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL,
      import_date DATETIME DEFAULT (datetime('now','localtime')),
      salesperson_id INTEGER REFERENCES salesperson(id),
      period_start TEXT,
      period_end TEXT,
      total_invoices INTEGER DEFAULT 0,
      total_amount REAL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS invoice (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_id INTEGER REFERENCES import_batch(id) ON DELETE CASCADE,
      invoice_no TEXT NOT NULL,
      invoice_type TEXT NOT NULL,
      date TEXT,
      customer_name TEXT,
      vat_type TEXT,
      discount_pct REAL,
      subtotal REAL DEFAULT 0,
      vat REAL DEFAULT 0,
      total REAL DEFAULT 0,
      due_date TEXT,
      so_ref TEXT,
      is_paid TEXT DEFAULT 'N',
      is_cancelled INTEGER DEFAULT 0,
      UNIQUE(invoice_no)
    );

    CREATE TABLE IF NOT EXISTS invoice_item (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_id INTEGER REFERENCES invoice(id) ON DELETE CASCADE,
      line_no INTEGER,
      product_code TEXT,
      description TEXT,
      quantity REAL,
      unit TEXT,
      unit_price REAL,
      discount TEXT,
      amount REAL,
      so_line_ref TEXT
    );

    CREATE TABLE IF NOT EXISTS customer (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE,
      name TEXT NOT NULL,
      address TEXT,
      province TEXT,
      postal_code TEXT,
      phone TEXT,
      tax_id TEXT,
      credit_days INTEGER,
      credit_limit REAL,
      salesperson TEXT,
      zone TEXT
    );

    CREATE TABLE IF NOT EXISTS product (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE,
      name TEXT NOT NULL,
      unit TEXT,
      std_price REAL,
      category TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_invoice_batch ON invoice(batch_id);
    CREATE INDEX IF NOT EXISTS idx_invoice_type ON invoice(invoice_type);
    CREATE INDEX IF NOT EXISTS idx_invoice_date ON invoice(date);
    CREATE INDEX IF NOT EXISTS idx_invoice_customer ON invoice(customer_name);
    CREATE INDEX IF NOT EXISTS idx_invoice_is_cancelled ON invoice(is_cancelled);
    CREATE INDEX IF NOT EXISTS idx_invoice_is_paid ON invoice(is_paid);
    CREATE INDEX IF NOT EXISTS idx_item_invoice ON invoice_item(invoice_id);
    CREATE INDEX IF NOT EXISTS idx_item_product ON invoice_item(product_code);
  `)

  // Migration: add no_commission column to product table (for existing databases)
  try {
    db.exec('ALTER TABLE product ADD COLUMN no_commission INTEGER DEFAULT 0')
  } catch (_) {
    // Column already exists — ignore
  }
}

export function getDb(): Database.Database {
  if (!db) throw new Error('Database not initialized')
  return db
}

export function getDataPath(): string {
  return dataPath
}
