const { ipcMain, dialog, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const { getDb, initDb } = require('../database');
const { getBackupList, restoreBackup, backupNow } = require('../backup');

function registerDbManageHandlers(dataPath) {
  // Get backup list
  ipcMain.handle('db:getBackups', async () => {
    try {
      const info = getBackupList(dataPath);
      // Add current DB size
      const dbPath = path.join(dataPath, 'talent.db');
      let currentDbSize = 0;
      if (fs.existsSync(dbPath)) {
        currentDbSize = fs.statSync(dbPath).size;
      }
      return { ...info, currentDbSize };
    } catch (err) {
      return { backups: [], meta: {}, error: err.message };
    }
  });

  // Backup now
  ipcMain.handle('db:backupNow', async () => {
    try {
      // Close current DB connection before copying
      const db = getDb();
      db.pragma('wal_checkpoint(TRUNCATE)');
      const result = backupNow(dataPath);
      return result;
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // Restore from backup slot
  ipcMain.handle('db:restore', async (_, slot) => {
    // Validate slot is integer 1-3 to prevent path traversal
    const slotNum = parseInt(slot, 10);
    if (![1, 2, 3].includes(slotNum)) {
      return { success: false, error: 'Invalid backup slot' };
    }
    try {
      const db = getDb();
      db.pragma('wal_checkpoint(TRUNCATE)');
      db.close();

      const result = restoreBackup(dataPath, slotNum);
      // Re-init DB and verify integrity
      initDb(dataPath);
      const newDb = getDb();
      const check = newDb.pragma('integrity_check');
      if (!check || check[0]?.integrity_check !== 'ok') {
        return { success: false, error: 'ฐานข้อมูลที่กู้คืนเสียหาย กรุณาลองใหม่' };
      }
      return result;
    } catch (err) {
      // Try to re-init even on error
      try { initDb(dataPath); } catch {}
      return { success: false, error: err.message };
    }
  });

  // Export DB file
  ipcMain.handle('db:export', async () => {
    try {
      const win = BrowserWindow.getFocusedWindow();
      const result = await dialog.showSaveDialog(win, {
        defaultPath: 'talent_export.db',
        filters: [{ name: 'Database', extensions: ['db'] }],
      });

      if (result.canceled || !result.filePath) {
        return { success: false, cancelled: true };
      }

      const dbPath = path.join(dataPath, 'talent.db');
      const db = getDb();
      db.pragma('wal_checkpoint(TRUNCATE)');
      fs.copyFileSync(dbPath, result.filePath);
      return { success: true, filePath: result.filePath };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // Import DB file
  ipcMain.handle('db:import', async () => {
    try {
      const win = BrowserWindow.getFocusedWindow();
      const result = await dialog.showOpenDialog(win, {
        properties: ['openFile'],
        filters: [{ name: 'Database', extensions: ['db'] }],
      });

      if (result.canceled || result.filePaths.length === 0) {
        return { success: false, cancelled: true };
      }

      const importPath = result.filePaths[0];
      const dbPath = path.join(dataPath, 'talent.db');
      const preRestorePath = path.join(dataPath, 'talent_pre_restore.db');

      // Close current DB
      const db = getDb();
      db.pragma('wal_checkpoint(TRUNCATE)');
      db.close();

      // Save current DB before replacing
      if (fs.existsSync(dbPath)) {
        fs.copyFileSync(dbPath, preRestorePath);
      }

      // Replace with imported file
      fs.copyFileSync(importPath, dbPath);

      // Re-init DB and verify integrity
      initDb(dataPath);
      const newDb = getDb();
      const check = newDb.pragma('integrity_check');
      if (!check || check[0]?.integrity_check !== 'ok') {
        // Restore previous DB
        newDb.close();
        if (fs.existsSync(preRestorePath)) {
          fs.copyFileSync(preRestorePath, dbPath);
        }
        initDb(dataPath);
        return { success: false, error: 'ไฟล์ที่นำเข้าเสียหายหรือไม่ใช่ฐานข้อมูลที่ถูกต้อง' };
      }
      return { success: true };
    } catch (err) {
      // Try to re-init even on error
      try { initDb(dataPath); } catch {}
      return { success: false, error: err.message };
    }
  });
}

module.exports = { registerDbManageHandlers };
