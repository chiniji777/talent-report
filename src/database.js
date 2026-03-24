const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

let db = null;
let dataPath = '';

function initDb(dataDirPath) {
  dataPath = dataDirPath;
  if (!fs.existsSync(dataPath)) {
    fs.mkdirSync(dataPath, { recursive: true });
  }
  const backupDir = path.join(dataPath, 'backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const dbPath = path.join(dataPath, 'talent.db');
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

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
  `);

  // Migration: add no_commission column to product table (for existing databases)
  try {
    db.exec('ALTER TABLE product ADD COLUMN no_commission INTEGER DEFAULT 0');
  } catch (_) {
    // Column already exists — ignore
  }

  // Migration: add company column to invoice table ('talent' | 'kitchai')
  try {
    db.exec("ALTER TABLE invoice ADD COLUMN company TEXT DEFAULT 'talent'");
  } catch (_) {}

  // Migration: add doc_type column to invoice table ('invoice' | 'credit_note')
  try {
    db.exec("ALTER TABLE invoice ADD COLUMN doc_type TEXT DEFAULT 'invoice'");
  } catch (_) {}

  // Migration: add ref_invoice_no for credit notes (references original invoice)
  try {
    db.exec('ALTER TABLE invoice ADD COLUMN ref_invoice_no TEXT');
  } catch (_) {}

  // Migration: add company column to import_batch
  try {
    db.exec("ALTER TABLE import_batch ADD COLUMN company TEXT DEFAULT 'talent'");
  } catch (_) {}

  // Migration: add doc_type column to import_batch
  try {
    db.exec("ALTER TABLE import_batch ADD COLUMN doc_type TEXT DEFAULT 'invoice'");
  } catch (_) {}

  // Migration: add is_returned column to invoice_item (for credit note items)
  try {
    db.exec("ALTER TABLE invoice_item ADD COLUMN is_returned TEXT DEFAULT 'N'");
  } catch (_) {}

  // Index for company + doc_type
  db.exec('CREATE INDEX IF NOT EXISTS idx_invoice_company ON invoice(company)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_invoice_doc_type ON invoice(doc_type)');

  // The original schema has UNIQUE(invoice_no) but now invoice_no can repeat across companies.
  // SQLite can't drop constraints, so we drop the old unique index if it exists
  // and rely on the composite index. The CREATE TABLE UNIQUE stays but we handle conflicts in code.
  // For new DBs this won't matter since we check (invoice_no, company) in importHandlers.
  try {
    db.exec('DROP INDEX IF EXISTS sqlite_autoindex_invoice_1');
  } catch (_) {}
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_invoice_no_company ON invoice(invoice_no, company)');
}

function getDb() {
  if (!db) throw new Error('Database not initialized');
  return db;
}

function getDataPath() {
  return dataPath;
}

module.exports = { initDb, getDb, getDataPath };
