const fs = require('fs');
const path = require('path');

function runBackup(dataPath) {
  const dbPath = path.join(dataPath, 'talent.db');
  const backupDir = path.join(dataPath, 'backups');
  const metaPath = path.join(backupDir, 'backup_meta.json');

  // No DB yet → nothing to backup
  if (!fs.existsSync(dbPath)) return;

  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  // Read meta
  let meta = { last_date: '', last_slot: 0 };
  if (fs.existsSync(metaPath)) {
    try {
      meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    } catch {
      // corrupted meta, reset
    }
  }

  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  if (meta.last_date === today) {
    // Already backed up today
    return;
  }

  // Rotate: slot 1 → 2 → 3 → 1 → ...
  const slot = (meta.last_slot % 3) + 1;
  const backupPath = path.join(backupDir, `talent_backup_${slot}.db`);

  try {
    fs.copyFileSync(dbPath, backupPath);
    meta.last_date = today;
    meta.last_slot = slot;
    fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));
  } catch (err) {
    console.error('Backup failed:', err.message);
  }
}

function backupNow(dataPath) {
  const dbPath = path.join(dataPath, 'talent.db');
  const backupDir = path.join(dataPath, 'backups');
  const metaPath = path.join(backupDir, 'backup_meta.json');

  if (!fs.existsSync(dbPath)) return { success: false, error: 'ไม่พบฐานข้อมูล' };

  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  let meta = { last_date: '', last_slot: 0 };
  if (fs.existsSync(metaPath)) {
    try { meta = JSON.parse(fs.readFileSync(metaPath, 'utf8')); } catch {}
  }

  const slot = (meta.last_slot % 3) + 1;
  const backupPath = path.join(backupDir, `talent_backup_${slot}.db`);

  try {
    fs.copyFileSync(dbPath, backupPath);
    const now = new Date();
    meta.last_date = now.toISOString().slice(0, 10);
    meta.last_slot = slot;
    fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));
    return { success: true, slot };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

function getBackupList(dataPath) {
  const backupDir = path.join(dataPath, 'backups');
  const metaPath = path.join(backupDir, 'backup_meta.json');

  let meta = { last_date: '', last_slot: 0 };
  if (fs.existsSync(metaPath)) {
    try { meta = JSON.parse(fs.readFileSync(metaPath, 'utf8')); } catch {}
  }

  const backups = [];
  for (let slot = 1; slot <= 3; slot++) {
    const filePath = path.join(backupDir, `talent_backup_${slot}.db`);
    if (fs.existsSync(filePath)) {
      const stat = fs.statSync(filePath);
      backups.push({
        slot,
        filename: `talent_backup_${slot}.db`,
        exists: true,
        size: stat.size,
        modified: stat.mtime.toISOString(),
        isCurrent: meta.last_slot === slot,
      });
    } else {
      backups.push({ slot, filename: `talent_backup_${slot}.db`, exists: false });
    }
  }

  // Check pre-restore backup
  const preRestorePath = path.join(dataPath, 'talent_pre_restore.db');
  const hasPreRestore = fs.existsSync(preRestorePath);
  let preRestoreInfo = null;
  if (hasPreRestore) {
    const stat = fs.statSync(preRestorePath);
    preRestoreInfo = { size: stat.size, modified: stat.mtime.toISOString() };
  }

  return { backups, meta, preRestore: preRestoreInfo };
}

function restoreBackup(dataPath, slot) {
  const dbPath = path.join(dataPath, 'talent.db');
  const backupDir = path.join(dataPath, 'backups');
  const backupPath = path.join(backupDir, `talent_backup_${slot}.db`);
  const preRestorePath = path.join(dataPath, 'talent_pre_restore.db');

  if (!fs.existsSync(backupPath)) {
    return { success: false, error: `ไม่พบไฟล์สำรอง slot ${slot}` };
  }

  try {
    // Save current DB before restore
    if (fs.existsSync(dbPath)) {
      fs.copyFileSync(dbPath, preRestorePath);
    }
    // Copy backup over current DB
    fs.copyFileSync(backupPath, dbPath);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

module.exports = { runBackup, backupNow, getBackupList, restoreBackup };
