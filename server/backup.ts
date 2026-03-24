import fs from 'fs'
import path from 'path'

interface BackupMeta {
  last_date: string
  last_slot: number
}

export function runBackup(dataPath: string): void {
  const dbPath = path.join(dataPath, 'talent.db')
  const backupDir = path.join(dataPath, 'backups')
  const metaPath = path.join(backupDir, 'backup_meta.json')

  if (!fs.existsSync(dbPath)) return

  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true })
  }

  let meta: BackupMeta = { last_date: '', last_slot: 0 }
  if (fs.existsSync(metaPath)) {
    try {
      meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'))
    } catch {
      // corrupted meta, reset
    }
  }

  const today = new Date().toISOString().slice(0, 10)
  if (meta.last_date === today) return

  const slot = (meta.last_slot % 3) + 1
  const backupPath = path.join(backupDir, `talent_backup_${slot}.db`)

  try {
    fs.copyFileSync(dbPath, backupPath)
    meta.last_date = today
    meta.last_slot = slot
    fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2))
  } catch (err: any) {
    console.error('Backup failed:', err.message)
  }
}

export function backupNow(dataPath: string): { success: boolean; slot?: number; error?: string } {
  const dbPath = path.join(dataPath, 'talent.db')
  const backupDir = path.join(dataPath, 'backups')
  const metaPath = path.join(backupDir, 'backup_meta.json')

  if (!fs.existsSync(dbPath)) return { success: false, error: 'ไม่พบฐานข้อมูล' }

  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true })
  }

  let meta: BackupMeta = { last_date: '', last_slot: 0 }
  if (fs.existsSync(metaPath)) {
    try { meta = JSON.parse(fs.readFileSync(metaPath, 'utf8')) } catch {}
  }

  const slot = (meta.last_slot % 3) + 1
  const backupPath = path.join(backupDir, `talent_backup_${slot}.db`)

  try {
    fs.copyFileSync(dbPath, backupPath)
    const now = new Date()
    meta.last_date = now.toISOString().slice(0, 10)
    meta.last_slot = slot
    fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2))
    return { success: true, slot }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

export function getBackupList(dataPath: string) {
  const backupDir = path.join(dataPath, 'backups')
  const metaPath = path.join(backupDir, 'backup_meta.json')

  let meta: BackupMeta = { last_date: '', last_slot: 0 }
  if (fs.existsSync(metaPath)) {
    try { meta = JSON.parse(fs.readFileSync(metaPath, 'utf8')) } catch {}
  }

  const backups = []
  for (let slot = 1; slot <= 3; slot++) {
    const filePath = path.join(backupDir, `talent_backup_${slot}.db`)
    if (fs.existsSync(filePath)) {
      const stat = fs.statSync(filePath)
      backups.push({
        slot,
        filename: `talent_backup_${slot}.db`,
        exists: true,
        size: stat.size,
        modified: stat.mtime.toISOString(),
        isCurrent: meta.last_slot === slot,
      })
    } else {
      backups.push({ slot, filename: `talent_backup_${slot}.db`, exists: false })
    }
  }

  const preRestorePath = path.join(dataPath, 'talent_pre_restore.db')
  const hasPreRestore = fs.existsSync(preRestorePath)
  let preRestore = null
  if (hasPreRestore) {
    const stat = fs.statSync(preRestorePath)
    preRestore = { size: stat.size, modified: stat.mtime.toISOString() }
  }

  return { backups, meta, preRestore }
}

export function restoreBackup(dataPath: string, slot: number): { success: boolean; error?: string } {
  const dbPath = path.join(dataPath, 'talent.db')
  const backupDir = path.join(dataPath, 'backups')
  const backupPath = path.join(backupDir, `talent_backup_${slot}.db`)
  const preRestorePath = path.join(dataPath, 'talent_pre_restore.db')

  if (!fs.existsSync(backupPath)) {
    return { success: false, error: `ไม่พบไฟล์สำรอง slot ${slot}` }
  }

  try {
    if (fs.existsSync(dbPath)) {
      fs.copyFileSync(dbPath, preRestorePath)
    }
    fs.copyFileSync(backupPath, dbPath)
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}
