// Chart instances stored outside Alpine reactive scope to prevent Proxy interference
const _charts = { spChart: null, dashTrendChart: null };

function app() {
  return {
    currentPage: 'dashboard',
    menuItems: [
      { id: 'dashboard', label: 'Dashboard', icon: '<svg class="w-[18px] h-[18px]" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" /></svg>' },
      { id: 'import', label: 'นำเข้าข้อมูล', icon: '<svg class="w-[18px] h-[18px]" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" /></svg>' },
      { id: 'invoices', label: 'ใบกำกับสินค้า', icon: '<svg class="w-[18px] h-[18px]" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>' },
      { id: 'salespersons', label: 'พนักงานขาย', icon: '<svg class="w-[18px] h-[18px]" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" /></svg>' },
      { id: 'cost', label: 'ต้นทุน', icon: '<svg class="w-[18px] h-[18px]" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>' },
      { id: 'database', label: 'ฐานข้อมูล', icon: '<svg class="w-[18px] h-[18px]" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" /></svg>' },
      { id: 'reports', label: 'รายงาน', icon: '<svg class="w-[18px] h-[18px]" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" /></svg>' },
      { id: 'settings', label: 'ตั้งค่า', icon: '<svg class="w-[18px] h-[18px]" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" /><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>' },
    ],

    // Loading states
    loading: {
      dashboard: false,
      invoices: false,
      salespersons: false,
      cost: false,
      database: false,
      reports: false,
    },

    // Toast notifications
    toasts: [],
    _toastId: 0,

    // Dashboard
    dashboard: null,
    // Chart instances stored in _charts (outside Alpine reactive scope)
    dashFilter: { year: '', month: '', week: '' },

    // Import
    importPreviews: [],
    importFilePaths: [],
    importing: false,

    // Invoices
    invoices: [],
    invTotal: 0,
    invPage: 1,
    invTotalPages: 1,
    invFilter: { search: '', salesperson: '', type: '', is_paid: '', year: '', month: '', week: '' },
    invYearMonths: [],
    salespersonList: [],

    // Invoice Detail Modal
    showModal: false,
    modalInvoice: null,
    modalItems: [],

    // Salesperson Report
    spReport: [],

    // Cost Management
    costSummary: null,
    costProducts: [],
    costTotal: 0,
    costPage: 1,
    costTotalPages: 1,
    costFilter: { search: '', filter: 'all' },
    costImporting: false,
    costImportResult: null,
    costEdits: {},
    costDeleteStep: 0,
    costDeleteCode: '',

    // Database Management
    dbBackups: null,
    dbOperating: false,
    dbResult: null,

    // Reports
    reportCostWarning: null,
    reportTab: 'monthly',
    reportFilter: { search: '' },
    reportDateFilter: { year: '', month: '', week: '' },
    monthlyReport: [],
    monthlySplit: [],
    customerReport: [],
    customerSplit: [],
    custReportTotal: 0,
    custReportPage: 1,
    custReportTotalPages: 1,
    productReport: [],
    productSplit: [],
    prodReportTotal: 0,
    prodReportPage: 1,
    prodReportTotalPages: 1,

    // Settings
    settings: {
      fontScale: 'normal',
      highContrast: false,
      tableSpacing: 'normal',
    },

    // ===== Toast System =====
    showToast(message, type = 'info', duration = 3500) {
      const id = ++this._toastId;
      this.toasts.push({ id, message, type });
      setTimeout(() => {
        this.toasts = this.toasts.filter(t => t.id !== id);
      }, duration);
    },

    // ===== Formatters =====
    fmt(n) {
      if (n === null || n === undefined) return '-';
      return Number(n).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    },

    fmtPts(n) {
      if (n === null || n === undefined || n === 0) return '0';
      return (Math.round(n * 10) / 10).toLocaleString('th-TH', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    },

    sumPts(arr, key) {
      return Math.round(arr.reduce((s, r) => s + (r[key] || 0), 0) * 10) / 10;
    },

    fmtSize(bytes) {
      if (!bytes) return '-';
      if (bytes < 1024) return bytes + ' B';
      if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
      return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    },

    fmtDateTime(iso) {
      if (!iso) return '-';
      const d = new Date(iso);
      return d.toLocaleDateString('th-TH') + ' ' + d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
    },

    // ===== Settings =====
    loadSettings() {
      try {
        const saved = localStorage.getItem('talentreport_settings');
        if (saved) {
          const parsed = JSON.parse(saved);
          this.settings = { ...this.settings, ...parsed };
        }
      } catch (e) { console.error('Load settings error:', e); }
      this.applySettings();
    },

    saveSettings() {
      try {
        localStorage.setItem('talentreport_settings', JSON.stringify(this.settings));
      } catch (e) { console.error('Save settings error:', e); }
      this.applySettings();
    },

    applySettings() {
      const html = document.documentElement;
      const body = document.body;
      // Font scale on <html> → all rem-based sizes scale automatically
      html.setAttribute('data-scale', this.settings.fontScale);
      // High contrast on body
      body.setAttribute('data-high-contrast', String(this.settings.highContrast));
      // Table spacing
      const spacingMap = { compact: '0.375rem', normal: '0.5rem', comfortable: '0.75rem' };
      html.style.setProperty('--table-row-padding', spacingMap[this.settings.tableSpacing] || '0.5rem');
    },

    setFontScale(scale) {
      this.settings.fontScale = scale;
      this.saveSettings();
    },

    toggleHighContrast() {
      this.settings.highContrast = !this.settings.highContrast;
      this.saveSettings();
    },

    setTableSpacing(spacing) {
      this.settings.tableSpacing = spacing;
      this.saveSettings();
    },

    resetSettings() {
      this.settings = { fontScale: 'normal', highContrast: false, tableSpacing: 'normal' };
      this.saveSettings();
      this.showToast('รีเซ็ตการตั้งค่าเรียบร้อย', 'info');
    },

    // ===== Init & Navigation =====
    async init() {
      this.loadSettings();
      await this.loadInvoiceDateRange();
      await this.loadDashboard();

      // Keyboard shortcuts
      document.addEventListener('keydown', (e) => {
        // Don't trigger if typing in input
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;

        // Alt+1-8 for page navigation
        if (e.altKey && e.key >= '1' && e.key <= '8') {
          e.preventDefault();
          const pages = ['dashboard', 'import', 'invoices', 'salespersons', 'cost', 'database', 'reports', 'settings'];
          this.navigateTo(pages[parseInt(e.key) - 1]);
        }

        // Escape to close modal
        if (e.key === 'Escape' && this.showModal) {
          this.showModal = false;
        }
      });
    },

    async navigateTo(page) {
      this.currentPage = page;
      if (page === 'dashboard') await this.loadDashboard();
      else if (page === 'import') await this.loadDashboard();
      else if (page === 'invoices') { await this.loadInvoiceDateRange(); await this.loadInvoices(1); }
      else if (page === 'salespersons') await this.loadSalespersons();
      else if (page === 'cost') {
        this.costEdits = {};
        this.costDeleteStep = 0;
        this.costDeleteCode = '';
        await this.loadCostSummary();
        await this.loadCostProducts(1);
      }
      else if (page === 'database') await this.loadDbBackups();
      else if (page === 'reports') {
        this.reportTab = 'monthly';
        this.reportDateFilter = { year: '', month: '', week: '' };
        await this.loadInvoiceDateRange();
        await this.loadReportCostWarning();
        await this.loadMonthlyReport();
      }
      else if (page === 'settings') { /* settings loaded from localStorage */ }
    },

    // ===== Dashboard =====
    async loadDashboard() {
      this.loading.dashboard = true;
      try {
        const params = {};
        if (this.dashFilter.year) params.year = this.dashFilter.year;
        if (this.dashFilter.month) params.month = this.dashFilter.month;
        if (this.dashFilter.week) {
          const [ws, we] = this.dashFilter.week.split('|');
          params.week_start = ws;
          params.week_end = we;
        }
        this.dashboard = await window.api.getDashboard(params);
        this.salespersonList = (this.dashboard.salespersons || []).map(s => s.nickname).filter(Boolean);
        this.$nextTick(() => {
          setTimeout(() => {
            try { this.renderChart(); } catch (e) { console.error('Chart render error:', e); }
            try { this.renderTrendChart(); } catch (e) { console.error('TrendChart render error:', e); }
          }, 100);
        });
      } catch (e) {
        console.error('Dashboard error:', e);
        this.showToast('โหลด Dashboard ผิดพลาด', 'error');
      }
      this.loading.dashboard = false;
    },

    // Dashboard date filter helpers
    getDashYears() {
      return this.getInvYears();
    },

    getDashMonths() {
      if (!this.dashFilter.year) return [];
      const prefix = this.dashFilter.year + '-';
      return this.invYearMonths
        .filter(ym => ym.startsWith(prefix))
        .map(ym => String(parseInt(ym.split('-')[1])))
        .sort((a, b) => parseInt(a) - parseInt(b));
    },

    _computeWeeks(y, m) {
      if (!y || !m) return [];
      const weeks = [];
      const firstDay = new Date(y, m - 1, 1);
      const lastDay = new Date(y, m, 0);
      let weekStart = new Date(firstDay);
      let weekNum = 1;
      while (weekStart <= lastDay) {
        let weekEnd;
        if (weekNum === 1) {
          const dayOfWeek = weekStart.getDay();
          const daysToSun = dayOfWeek === 0 ? 0 : (7 - dayOfWeek);
          weekEnd = new Date(y, m - 1, 1 + daysToSun);
        } else {
          weekEnd = new Date(weekStart);
          weekEnd.setDate(weekEnd.getDate() + 6);
        }
        if (weekEnd > lastDay) weekEnd = new Date(lastDay);
        const startStr = `${y}-${String(m).padStart(2,'0')}-${String(weekStart.getDate()).padStart(2,'0')}`;
        const endStr = `${y}-${String(m).padStart(2,'0')}-${String(weekEnd.getDate()).padStart(2,'0')}`;
        weeks.push({
          value: `${startStr}|${endStr}`,
          label: `สัปดาห์ ${weekNum} (${weekStart.getDate()}-${weekEnd.getDate()})`,
        });
        weekStart = new Date(weekEnd);
        weekStart.setDate(weekStart.getDate() + 1);
        weekNum++;
      }
      return weeks;
    },

    getDashWeeks() {
      return this._computeWeeks(parseInt(this.dashFilter.year), parseInt(this.dashFilter.month));
    },

    onDashYearChange() {
      const months = this.getDashMonths();
      this.dashFilter.month = months[months.length - 1] || '';
      this.dashFilter.week = '';
      this.loadDashboard();
    },

    onDashMonthChange() {
      this.dashFilter.week = '';
      this.loadDashboard();
    },

    onDashWeekChange() {
      this.loadDashboard();
    },

    renderChart() {
      if (typeof Chart === 'undefined') { console.error('Chart.js not loaded'); return; }
      const canvas = document.getElementById('spChart');
      if (!canvas || !this.dashboard || !this.dashboard.salespersons.length) return;
      if (_charts.spChart) { _charts.spChart.destroy(); _charts.spChart = null; }

      const data = this.dashboard.salespersons;
      const colors = ['#6366f1','#14b8a6','#f59e0b','#ef4444','#8b5cf6','#ec4899','#06b6d4','#84cc16','#f97316','#3b82f6'];

      _charts.spChart = new Chart(canvas, {
        type: 'bar',
        data: {
          labels: data.map(s => s.nickname),
          datasets: [{
            label: 'ยอดขาย (บาท)',
            data: data.map(s => s.total),
            backgroundColor: data.map((_, i) => colors[i % colors.length] + 'cc'),
            hoverBackgroundColor: data.map((_, i) => colors[i % colors.length]),
            borderRadius: 8,
            borderSkipped: false,
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: '#1e293b',
              titleFont: { size: 13, weight: '600' },
              bodyFont: { size: 12 },
              padding: 10,
              cornerRadius: 8,
              callbacks: {
                label: ctx => ctx.parsed.y.toLocaleString('th-TH', { minimumFractionDigits: 2 }) + ' บาท'
              }
            }
          },
          scales: {
            y: {
              grid: { color: 'rgba(0,0,0,0.04)', drawBorder: false },
              ticks: { callback: v => (v / 1e6).toFixed(1) + 'M', font: { size: 11 } },
              border: { display: false }
            },
            x: {
              grid: { display: false },
              ticks: { font: { size: 11 } },
              border: { display: false }
            }
          }
        }
      });
    },

    renderTrendChart() {
      if (typeof Chart === 'undefined') { console.error('Chart.js not loaded'); return; }
      const canvas = document.getElementById('trendChart');
      if (!canvas) return;
      if (_charts.dashTrendChart) { _charts.dashTrendChart.destroy(); _charts.dashTrendChart = null; }

      const trend = this.dashboard && this.dashboard.monthlyTrend;
      if (!trend || trend.length < 2) return;

      _charts.dashTrendChart = new Chart(canvas, {
        type: 'line',
        data: {
          labels: trend.map(t => t.month),
          datasets: [{
            label: 'ยอดขาย',
            data: trend.map(t => t.total_amount),
            borderColor: '#6366f1',
            backgroundColor: (ctx) => {
              const gradient = ctx.chart.ctx.createLinearGradient(0, 0, 0, 160);
              gradient.addColorStop(0, 'rgba(99, 102, 241, 0.15)');
              gradient.addColorStop(1, 'rgba(99, 102, 241, 0.01)');
              return gradient;
            },
            fill: true,
            tension: 0.4,
            pointRadius: 4,
            pointBackgroundColor: '#6366f1',
            pointBorderColor: '#ffffff',
            pointBorderWidth: 2,
            pointHoverRadius: 6,
            borderWidth: 2.5,
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: '#1e293b',
              titleFont: { size: 13, weight: '600' },
              bodyFont: { size: 12 },
              padding: 10,
              cornerRadius: 8,
              callbacks: {
                label: ctx => ctx.parsed.y.toLocaleString('th-TH', { minimumFractionDigits: 2 }) + ' บาท'
              }
            }
          },
          scales: {
            y: {
              grid: { color: 'rgba(0,0,0,0.04)', drawBorder: false },
              ticks: { callback: v => (v / 1e6).toFixed(1) + 'M', font: { size: 11 } },
              border: { display: false }
            },
            x: {
              grid: { display: false },
              ticks: { font: { size: 11 } },
              border: { display: false }
            }
          }
        }
      });
    },

    // ===== Import =====
    async selectInvoiceFiles() {
      const filePaths = await window.api.openFiles();
      if (!filePaths || filePaths.length === 0) return;
      await this.addFilesForImport(filePaths);
    },

    handleDrop(event) {
      const files = Array.from(event.dataTransfer.files);
      const csvFiles = files.filter(f => f.name.toLowerCase().endsWith('.csv'));
      if (csvFiles.length === 0) return;
      const filePaths = csvFiles.map(f => window.api.getPathForFile(f)).filter(Boolean);
      if (filePaths.length > 0) this.addFilesForImport(filePaths);
    },

    async addFilesForImport(newPaths) {
      const plainPaths = newPaths.map(p => String(p));
      const existingSet = new Set(this._rawFilePaths || []);
      const toAdd = plainPaths.filter(fp => fp && !existingSet.has(fp));
      if (toAdd.length === 0) return;

      if (!this._rawFilePaths) this._rawFilePaths = [];
      this._rawFilePaths.push(...toAdd);
      this.importFilePaths = [...this._rawFilePaths];

      const startIdx = this.importPreviews.length;
      for (const fp of toAdd) {
        this.importPreviews.push({
          filename: fp.split(/[\\/]/).pop(),
          filePath: fp,
          status: 'preview',
          salesperson: null, total_invoices: null, total: null, error: null,
        });
      }

      for (let i = 0; i < toAdd.length; i++) {
        const idx = startIdx + i;
        try {
          const data = await window.api.previewInvoice(toAdd[i]);
          if (data.success) {
            Object.assign(this.importPreviews[idx], data);
          } else {
            this.importPreviews[idx].status = 'error';
            this.importPreviews[idx].error = data.error;
          }
        } catch (e) {
          this.importPreviews[idx].status = 'error';
          this.importPreviews[idx].error = e.message;
        }
      }
    },

    async doImportInvoices() {
      if (this.importing) return; // race condition guard
      this.importing = true;
      const paths = [];
      const importingIndices = [];
      this.importPreviews.forEach((p, idx) => {
        if (p.status === 'preview') {
          p.status = 'importing';
          paths.push(String(p.filePath));
          importingIndices.push(idx);
        }
      });

      if (paths.length === 0) {
        this.importing = false;
        return;
      }

      try {
        const data = await window.api.importInvoices(paths);
        if (data.results) {
          let importedTotal = 0;
          data.results.forEach((r, i) => {
            const idx = importingIndices[i];
            if (idx === undefined) return;
            const preview = this.importPreviews[idx];
            if (!preview) return;

            if (r.success) {
              preview.imported = r.imported;
              preview.skipped = r.skipped;
              preview.updated = r.updated || 0;
              preview.missing_cost_count = r.missing_cost_count || 0;
              importedTotal += r.imported || 0;
              if (r.imported === 0 && r.skipped > 0) {
                preview.status = 'all_duplicate';
              } else {
                preview.status = 'done';
              }
            } else {
              preview.status = 'error';
              preview.error = r.error;
            }
          });
          if (importedTotal > 0) {
            this.showToast(`นำเข้าสำเร็จ ${importedTotal} รายการ`, 'success');
          }
        }
        await this.loadDashboard();
      } catch (e) {
        this.importPreviews.forEach(p => {
          if (p.status === 'importing') { p.status = 'error'; p.error = e.message; }
        });
        this.showToast('นำเข้าผิดพลาด: ' + e.message, 'error');
      }
      this.importing = false;
    },

    async deleteBatch(batchId) {
      if (!confirm('ต้องการลบข้อมูลชุดนี้?')) return;
      await window.api.deleteBatch(batchId);
      this.showToast('ลบข้อมูลชุดนี้แล้ว', 'success');
      await this.loadDashboard();
    },

    // ===== Invoices =====
    async loadInvoiceDateRange() {
      try {
        const data = await window.api.getInvoiceDateRange();
        this.invYearMonths = data.yearMonths || [];
        if (!this.invFilter.year) {
          const now = new Date();
          const curYear = String(now.getFullYear());
          const curMonth = String(now.getMonth() + 1);
          const years = this.getInvYears();
          this.invFilter.year = years.includes(curYear) ? curYear : (years[years.length - 1] || '');
          if (this.invFilter.year) {
            const months = this.getInvMonths();
            this.invFilter.month = months.includes(curMonth) ? curMonth : (months[months.length - 1] || '');
          }
        }
      } catch (e) {
        console.error('Date range error:', e);
      }
    },

    getInvYears() {
      const years = [...new Set(this.invYearMonths.map(ym => ym.split('-')[0]))];
      return years.sort();
    },

    getInvMonths() {
      if (!this.invFilter.year) return [];
      const prefix = this.invFilter.year + '-';
      return this.invYearMonths
        .filter(ym => ym.startsWith(prefix))
        .map(ym => String(parseInt(ym.split('-')[1])))
        .sort((a, b) => parseInt(a) - parseInt(b));
    },

    getInvWeeks() {
      return this._computeWeeks(parseInt(this.invFilter.year), parseInt(this.invFilter.month));
    },

    monthName(m) {
      const names = ['','ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
      return names[parseInt(m)] || m;
    },

    onInvYearChange() {
      const months = this.getInvMonths();
      this.invFilter.month = months[months.length - 1] || '';
      this.invFilter.week = '';
      this.loadInvoices(1);
    },

    onInvMonthChange() {
      this.invFilter.week = '';
      this.loadInvoices(1);
    },

    async loadInvoices(page) {
      if (page < 1) return;
      this.invPage = page;
      this.loading.invoices = true;
      try {
        const params = {
          page,
          per_page: 50,
          search: this.invFilter.search || undefined,
          salesperson: this.invFilter.salesperson || undefined,
          type: this.invFilter.type || undefined,
          is_paid: this.invFilter.is_paid || undefined,
          year: this.invFilter.year || undefined,
          month: this.invFilter.month || undefined,
        };
        if (this.invFilter.week) {
          const [ws, we] = this.invFilter.week.split('|');
          params.week_start = ws;
          params.week_end = we;
        }
        const data = await window.api.getInvoices(params);
        this.invoices = data.invoices;
        this.invTotal = data.total;
        this.invTotalPages = data.total_pages;
      } catch (e) {
        console.error('Load invoices error:', e);
        this.showToast('โหลดใบกำกับผิดพลาด', 'error');
      }
      this.loading.invoices = false;
    },

    async showInvoiceDetail(id) {
      try {
        const data = await window.api.getInvoiceDetail(id);
        this.modalInvoice = data.invoice;
        this.modalItems = data.items;
        this.showModal = true;
      } catch (e) {
        console.error('Invoice detail error:', e);
        this.showToast('โหลดรายละเอียดผิดพลาด', 'error');
      }
    },

    // ===== Salesperson Report =====
    async loadSalespersons() {
      this.loading.salespersons = true;
      try {
        this.spReport = await window.api.getSalespersons();
      } catch (e) {
        console.error('Salespersons error:', e);
        this.showToast('โหลดข้อมูลพนักงานผิดพลาด', 'error');
      }
      this.loading.salespersons = false;
    },

    // ===== Reports =====
    getReportYears() {
      return this.getInvYears();
    },

    getReportMonths() {
      if (!this.reportDateFilter.year) return [];
      const prefix = this.reportDateFilter.year + '-';
      return this.invYearMonths
        .filter(ym => ym.startsWith(prefix))
        .map(ym => String(parseInt(ym.split('-')[1])))
        .sort((a, b) => parseInt(a) - parseInt(b));
    },

    getReportWeeks() {
      return this._computeWeeks(parseInt(this.reportDateFilter.year), parseInt(this.reportDateFilter.month));
    },

    onReportYearChange() {
      const months = this.getReportMonths();
      this.reportDateFilter.month = months[months.length - 1] || '';
      this.reportDateFilter.week = '';
      this.refreshReport();
    },

    onReportMonthChange() {
      this.reportDateFilter.week = '';
      this.refreshReport();
    },

    onReportWeekChange() {
      this.refreshReport();
    },

    _reportDateParams() {
      const params = {};
      if (this.reportDateFilter.year) params.year = this.reportDateFilter.year;
      if (this.reportDateFilter.month) params.month = this.reportDateFilter.month;
      if (this.reportDateFilter.week) {
        const [ws, we] = this.reportDateFilter.week.split('|');
        params.week_start = ws;
        params.week_end = we;
      }
      return params;
    },

    refreshReport() {
      if (this.reportTab === 'monthly') this.loadMonthlyReport();
      else if (this.reportTab === 'customer') this.loadCustomerReport(1);
      else if (this.reportTab === 'product') this.loadProductReport(1);
    },

    async loadMonthlyReport() {
      this.loading.reports = true;
      try {
        const params = { ...this._reportDateParams() };
        const data = await window.api.getMonthlyReport(params);
        this.monthlyReport = data.months;
        this.monthlySplit = data.bySalesperson || [];
      } catch (e) {
        console.error('Monthly report error:', e);
        this.showToast('โหลดรายงานผิดพลาด', 'error');
      }
      this.loading.reports = false;
    },

    async loadCustomerReport(page) {
      if (page < 1) return;
      this.custReportPage = page;
      this.loading.reports = true;
      try {
        const data = await window.api.getCustomerReport({
          page,
          per_page: 50,
          search: this.reportFilter.search || undefined,
          ...this._reportDateParams(),
        });
        this.customerReport = data.customers;
        this.custReportTotal = data.total;
        this.custReportTotalPages = data.total_pages;
        this.customerSplit = data.bySalesperson || [];
      } catch (e) {
        console.error('Customer report error:', e);
        this.showToast('โหลดรายงานผิดพลาด', 'error');
      }
      this.loading.reports = false;
    },

    async loadProductReport(page) {
      if (page < 1) return;
      this.prodReportPage = page;
      this.loading.reports = true;
      try {
        const data = await window.api.getProductReport({
          page,
          per_page: 50,
          search: this.reportFilter.search || undefined,
          ...this._reportDateParams(),
        });
        this.productReport = data.products;
        this.prodReportTotal = data.total;
        this.prodReportTotalPages = data.total_pages;
        this.productSplit = data.bySalesperson || [];
      } catch (e) {
        console.error('Product report error:', e);
        this.showToast('โหลดรายงานผิดพลาด', 'error');
      }
      this.loading.reports = false;
    },

    async loadReportCostWarning() {
      try {
        this.reportCostWarning = await window.api.costGetSummary();
      } catch (e) {
        this.reportCostWarning = null;
      }
    },

    // Export report
    reportExporting: false,
    reportExportResult: null,

    async exportReport() {
      if (this.reportExporting) return; // race condition guard
      this.reportExporting = true;
      this.reportExportResult = null;
      try {
        const result = await window.api.exportReport(this.reportTab);
        if (result.success) {
          this.reportExportResult = { success: true, filePath: result.filePath };
          this.showToast('ส่งออก Excel สำเร็จ', 'success');
        } else if (!result.cancelled) {
          this.reportExportResult = { success: false, error: result.error };
          this.showToast('ส่งออกผิดพลาด: ' + result.error, 'error');
        }
      } catch (e) {
        this.reportExportResult = { success: false, error: e.message };
        this.showToast('ส่งออกผิดพลาด: ' + e.message, 'error');
      }
      this.reportExporting = false;
    },

    // ===== Cost Management =====
    async loadCostSummary() {
      try {
        this.costSummary = await window.api.costGetSummary();
      } catch (e) {
        console.error('Cost summary error:', e);
      }
    },

    async loadCostProducts(page) {
      if (page < 1) return;
      this.costPage = page;
      this.costEdits = {};
      this.loading.cost = true;
      try {
        const data = await window.api.costGetProducts({
          page,
          per_page: 50,
          search: this.costFilter.search || undefined,
          filter: this.costFilter.filter || 'all',
        });
        this.costProducts = data.products;
        this.costTotal = data.total;
        this.costTotalPages = data.total_pages;
      } catch (e) {
        console.error('Cost products error:', e);
        this.showToast('โหลดข้อมูลต้นทุนผิดพลาด', 'error');
      }
      this.loading.cost = false;
    },

    async importCostFile() {
      if (this.costImporting) return;
      this.costImporting = true;
      this.costImportResult = null;
      try {
        const filePath = await window.api.costOpenFile();
        if (!filePath) { this.costImporting = false; return; }
        const result = await window.api.costImport(filePath);
        this.costImportResult = result;
        if (result.success) {
          this.showToast(`นำเข้าต้นทุนสำเร็จ ${result.imported} รายการ`, 'success');
          await this.loadCostSummary();
          await this.loadCostProducts(1);
        }
      } catch (e) {
        this.costImportResult = { success: false, error: e.message };
        this.showToast('นำเข้าต้นทุนผิดพลาด', 'error');
      }
      this.costImporting = false;
    },

    async exportCostFile() {
      try {
        const result = await window.api.costExport();
        if (result.success) {
          this.costImportResult = { success: true, exported: true, totalRows: result.totalRows };
          this.showToast('ส่งออกต้นทุนสำเร็จ', 'success');
        } else if (!result.cancelled) {
          this.costImportResult = { success: false, error: result.error };
        }
      } catch (e) {
        this.costImportResult = { success: false, error: e.message };
      }
    },

    // Cost inline edit
    startEditCost(product) {
      this.costEdits[product.product_code] = {
        name: product.name || '',
        unit: product.unit || '',
        std_price: product.cost_price !== null ? String(product.cost_price) : '',
      };
    },

    cancelEditCost(code) {
      delete this.costEdits[code];
    },

    costEditCount() {
      return Object.keys(this.costEdits).length;
    },

    cancelAllEdits() {
      this.costEdits = {};
    },

    async saveAllCostEdits() {
      const items = Object.entries(this.costEdits).map(([code, data]) => ({
        code,
        name: data.name,
        unit: data.unit,
        std_price: data.std_price,
      }));
      if (items.length === 0) return;
      try {
        const result = await window.api.costUpdateProducts(items);
        if (result.success) {
          this.costEdits = {};
          this.showToast(`บันทึก ${items.length} รายการสำเร็จ`, 'success');
          await this.loadCostSummary();
          await this.loadCostProducts(this.costPage);
        }
      } catch (e) {
        console.error('Save cost error:', e);
        this.showToast('บันทึกผิดพลาด', 'error');
      }
    },

    async toggleCommission(product) {
      const newVal = product.no_commission ? 0 : 1;
      try {
        const result = await window.api.costToggleCommission({
          code: product.product_code,
          no_commission: newVal,
        });
        if (result.success) {
          product.no_commission = newVal;
          this.showToast(
            newVal ? `${product.product_code} ไม่คิดคอมแล้ว` : `${product.product_code} คิดคอมตามปกติ`,
            newVal ? 'warning' : 'success'
          );
          await this.loadCostSummary();
        }
      } catch (e) {
        console.error('Toggle commission error:', e);
        this.showToast('เกิดข้อผิดพลาด', 'error');
      }
    },

    async deleteAllCost() {
      if (this.costDeleteCode !== 'ลบทั้งหมด') return;
      try {
        const result = await window.api.costDeleteAll({ confirmCode: 'ลบทั้งหมด' });
        if (result.success) {
          this.costDeleteStep = 0;
          this.costDeleteCode = '';
          this.costImportResult = null;
          this.showToast('ลบข้อมูลต้นทุนทั้งหมดแล้ว', 'warning');
          await this.loadCostSummary();
          await this.loadCostProducts(1);
        }
      } catch (e) {
        console.error('Delete cost error:', e);
        this.showToast('ลบผิดพลาด', 'error');
      }
    },

    // ===== Database Management =====
    async loadDbBackups() {
      this.dbResult = null;
      this.loading.database = true;
      try {
        this.dbBackups = await window.api.dbGetBackups();
      } catch (e) {
        console.error('DB backups error:', e);
      }
      this.loading.database = false;
    },

    async dbBackupNow() {
      if (this.dbOperating) return;
      this.dbOperating = true;
      try {
        const result = await window.api.dbBackupNow();
        if (result.success) {
          this.dbResult = { success: true, message: 'สำรองข้อมูลสำเร็จ (slot ' + result.slot + ')' };
          this.showToast('สำรองข้อมูลสำเร็จ', 'success');
        } else {
          this.dbResult = { success: false, message: result.error };
          this.showToast('สำรองข้อมูลผิดพลาด', 'error');
        }
        await this.loadDbBackups();
      } catch (e) {
        this.dbResult = { success: false, message: e.message };
        this.showToast('สำรองข้อมูลผิดพลาด', 'error');
      }
      this.dbOperating = false;
    },

    async dbExportFile() {
      if (this.dbOperating) return;
      this.dbOperating = true;
      try {
        const result = await window.api.dbExport();
        if (result.success) {
          this.dbResult = { success: true, message: 'ส่งออกฐานข้อมูลสำเร็จ' };
          this.showToast('ส่งออกฐานข้อมูลสำเร็จ', 'success');
        } else if (!result.cancelled) {
          this.dbResult = { success: false, message: result.error };
        }
      } catch (e) {
        this.dbResult = { success: false, message: e.message };
      }
      this.dbOperating = false;
    },

    async dbImportFile() {
      if (!confirm('ข้อมูลปัจจุบันจะถูกสำรองก่อน แล้วแทนที่ด้วยไฟล์ที่เลือก\nดำเนินการต่อ?')) return;
      if (this.dbOperating) return;
      this.dbOperating = true;
      try {
        const result = await window.api.dbImport();
        if (result.success) {
          this.dbResult = { success: true, message: 'นำเข้าฐานข้อมูลสำเร็จ ข้อมูลเดิมถูกบันทึกเป็น talent_pre_restore.db' };
          this.showToast('นำเข้าฐานข้อมูลสำเร็จ', 'success');
          await this.loadDbBackups();
        } else if (!result.cancelled) {
          this.dbResult = { success: false, message: result.error };
          this.showToast('นำเข้าผิดพลาด: ' + result.error, 'error');
        }
      } catch (e) {
        this.dbResult = { success: false, message: e.message };
        this.showToast('นำเข้าผิดพลาด', 'error');
      }
      this.dbOperating = false;
    },

    async dbRestoreBackup(slot) {
      if (!confirm('ต้องการกู้คืนข้อมูลจาก slot ' + slot + '?')) return;
      if (!confirm('คำเตือน: ข้อมูลปัจจุบันจะถูกแทนที่ด้วยข้อมูลสำรอง\nข้อมูลปัจจุบันจะบันทึกเป็น talent_pre_restore.db\n\nยืนยันดำเนินการ?')) return;
      if (this.dbOperating) return;
      this.dbOperating = true;
      try {
        const result = await window.api.dbRestore(slot);
        if (result.success) {
          this.dbResult = { success: true, message: 'กู้คืนข้อมูลจาก slot ' + slot + ' สำเร็จ' };
          this.showToast('กู้คืนข้อมูลสำเร็จ', 'success');
          await this.loadDbBackups();
        } else {
          this.dbResult = { success: false, message: result.error };
          this.showToast('กู้คืนผิดพลาด: ' + result.error, 'error');
        }
      } catch (e) {
        this.dbResult = { success: false, message: e.message };
        this.showToast('กู้คืนผิดพลาด', 'error');
      }
      this.dbOperating = false;
    },
  };
}
