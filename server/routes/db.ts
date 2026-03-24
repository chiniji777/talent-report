import { Hono } from 'hono'
import path from 'path'
import fs from 'fs'
import { getDb, getDataPath, initDb } from '../db'
import { getBackupList, restoreBackup, backupNow } from '../backup'

const dbRoutes = new Hono()

// GET /api/db/backups — list backups
dbRoutes.get('/backups', (c) => {
  try {
    const dataPath = getDataPath()
    const info = getBackupList(dataPath)
    const dbPath = path.join(dataPath, 'talent.db')
    let currentDbSize = 0
    if (fs.existsSync(dbPath)) {
      currentDbSize = fs.statSync(dbPath).size
    }
    return c.json({ ...info, currentDbSize })
  } catch (err: any) {
    return c.json({ backups: [], meta: {}, error: err.message }, 500)
  }
})

// POST /api/db/backup — backup now
dbRoutes.post('/backup', (c) => {
  try {
    const db = getDb()
    db.exec('PRAGMA wal_checkpoint(TRUNCATE)')
    const dataPath = getDataPath()
    const result = backupNow(dataPath)
    return c.json(result)
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500)
  }
})

// POST /api/db/restore/:slot — restore from slot
dbRoutes.post('/restore/:slot', (c) => {
  const slotNum = parseInt(c.req.param('slot'), 10)
  if (![1, 2, 3].includes(slotNum)) {
    return c.json({ success: false, error: 'Invalid backup slot' }, 400)
  }
  try {
    const dataPath = getDataPath()
    const db = getDb()
    db.exec('PRAGMA wal_checkpoint(TRUNCATE)')
    db.close()

    const result = restoreBackup(dataPath, slotNum)
    initDb(dataPath)
    const newDb = getDb()
    const check = newDb.query('PRAGMA integrity_check').all() as any[]
    if (!check || check[0]?.integrity_check !== 'ok') {
      return c.json({ success: false, error: 'ฐานข้อมูลที่กู้คืนเสียหาย กรุณาลองใหม่' }, 500)
    }
    return c.json(result)
  } catch (err: any) {
    try { initDb(getDataPath()) } catch {}
    return c.json({ success: false, error: err.message }, 500)
  }
})

// GET /api/db/export — download .db file
dbRoutes.get('/export', (c) => {
  try {
    const dataPath = getDataPath()
    const dbPath = path.join(dataPath, 'talent.db')
    const db = getDb()
    db.exec('PRAGMA wal_checkpoint(TRUNCATE)')

    const fileBuffer = fs.readFileSync(dbPath)
    return new Response(fileBuffer, {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': 'attachment; filename="talent_export.db"',
      },
    })
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500)
  }
})

// POST /api/db/import — upload .db file
dbRoutes.post('/import', async (c) => {
  try {
    const formData = await c.req.formData()
    const file = formData.get('file') as File | null
    if (!file) {
      return c.json({ success: false, error: 'กรุณาเลือกไฟล์' }, 400)
    }

    const dataPath = getDataPath()
    const dbPath = path.join(dataPath, 'talent.db')
    const preRestorePath = path.join(dataPath, 'talent_pre_restore.db')

    const db = getDb()
    db.exec('PRAGMA wal_checkpoint(TRUNCATE)')
    db.close()

    // Save current DB before replacing
    if (fs.existsSync(dbPath)) {
      fs.copyFileSync(dbPath, preRestorePath)
    }

    // Write uploaded file
    const buffer = Buffer.from(await file.arrayBuffer())
    fs.writeFileSync(dbPath, buffer)

    // Re-init and verify integrity
    initDb(dataPath)
    const newDb = getDb()
    const check = newDb.query('PRAGMA integrity_check').all() as any[]
    if (!check || check[0]?.integrity_check !== 'ok') {
      newDb.close()
      if (fs.existsSync(preRestorePath)) {
        fs.copyFileSync(preRestorePath, dbPath)
      }
      initDb(dataPath)
      return c.json({ success: false, error: 'ไฟล์ที่นำเข้าเสียหายหรือไม่ใช่ฐานข้อมูลที่ถูกต้อง' }, 500)
    }
    return c.json({ success: true })
  } catch (err: any) {
    try { initDb(getDataPath()) } catch {}
    return c.json({ success: false, error: err.message }, 500)
  }
})

export { dbRoutes }
