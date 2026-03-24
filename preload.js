const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // File dialog
  openFiles: (options) => ipcRenderer.invoke('dialog:openFiles', options),

  // Drag & drop: get real filesystem path from a dropped File object
  getPathForFile: (file) => webUtils.getPathForFile(file),

  // Import
  importInvoices: (filePaths) => ipcRenderer.invoke('import:invoices', filePaths),
  previewInvoice: (filePath) => ipcRenderer.invoke('import:previewInvoice', filePath),

  // Queries
  getInvoiceDateRange: () => ipcRenderer.invoke('query:invoiceDateRange'),
  getInvoices: (params) => ipcRenderer.invoke('query:invoices', params),
  getInvoiceDetail: (id) => ipcRenderer.invoke('query:invoiceDetail', id),
  getSalespersons: () => ipcRenderer.invoke('query:salespersons'),
  deleteBatch: (batchId) => ipcRenderer.invoke('query:deleteBatch', batchId),

  // Reports
  getDashboard: (params) => ipcRenderer.invoke('report:dashboard', params),
  getMonthlyReport: (params) => ipcRenderer.invoke('report:monthly', params),
  getCustomerReport: (params) => ipcRenderer.invoke('report:customer', params),
  getProductReport: (params) => ipcRenderer.invoke('report:product', params),
  exportReport: (type) => ipcRenderer.invoke('report:exportExcel', type),

  // Cost Management
  costOpenFile: () => ipcRenderer.invoke('cost:openFile'),
  costImport: (filePath) => ipcRenderer.invoke('cost:import', filePath),
  costExport: () => ipcRenderer.invoke('cost:export'),
  costGetProducts: (params) => ipcRenderer.invoke('cost:getProducts', params),
  costGetSummary: () => ipcRenderer.invoke('cost:getSummary'),
  costDeleteAll: (params) => ipcRenderer.invoke('cost:deleteAll', params),
  costUpdateProduct: (params) => ipcRenderer.invoke('cost:updateProduct', params),
  costUpdateProducts: (items) => ipcRenderer.invoke('cost:updateProducts', items),
  costToggleCommission: (params) => ipcRenderer.invoke('cost:toggleCommission', params),

  // Database Management
  dbGetBackups: () => ipcRenderer.invoke('db:getBackups'),
  dbRestore: (slot) => ipcRenderer.invoke('db:restore', slot),
  dbExport: () => ipcRenderer.invoke('db:export'),
  dbImport: () => ipcRenderer.invoke('db:import'),
  dbBackupNow: () => ipcRenderer.invoke('db:backupNow'),
});
