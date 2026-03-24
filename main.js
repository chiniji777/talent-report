const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { initDb } = require('./src/database');
const { runBackup } = require('./src/backup');
const { registerImportHandlers } = require('./src/ipc/importHandlers');
const { registerQueryHandlers } = require('./src/ipc/queryHandlers');
const { registerReportHandlers } = require('./src/ipc/reportHandlers');
const { registerCostHandlers } = require('./src/ipc/costHandlers');
const { registerDbManageHandlers } = require('./src/ipc/dbManageHandlers');

let mainWindow;

function getDataPath() {
  // In production: next to the .exe; in dev: project root
  const base = app.isPackaged
    ? path.dirname(process.execPath)
    : __dirname;
  return path.join(base, 'data');
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'TalentReport - ระบบนำเข้าข้อมูลการขาย',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  mainWindow.setMenuBarVisibility(false);
}

app.whenReady().then(() => {
  const dataPath = getDataPath();

  // Initialize database
  initDb(dataPath);

  // Run backup on startup
  runBackup(dataPath);

  // Register IPC handlers
  registerImportHandlers(dataPath);
  registerQueryHandlers(dataPath);
  registerReportHandlers(dataPath);
  registerCostHandlers(dataPath);
  registerDbManageHandlers(dataPath);

  // File dialog handler (fixed: no longer spreads user options to prevent override)
  ipcMain.handle('dialog:openFiles', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'CSV Files', extensions: ['csv', 'CSV'] }],
    });
    return result.filePaths;
  });

  createWindow();
});

app.on('window-all-closed', () => {
  app.quit();
});
