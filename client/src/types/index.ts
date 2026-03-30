export interface User {
  username: string;
  token: string;
}

// GET /api/reports/dashboard response
export interface DashboardResponse {
  stats: {
    total_invoices: number;
    iv_count: number;
    is_count: number;
    cancelled_count: number;
    total_subtotal: number;
    total_vat: number;
    total_amount: number;
    total_points: number;
    total_profit: number;
    total_cost: number;
    qualified_revenue: number;
    paid_amount: number;
    paid_count: number;
    unpaid_amount: number;
    unpaid_count: number;
    avg_order_value: number;
  };
  salespersons: SalespersonSummary[];
  topCustomers: TopCustomer[];
  monthlyTrend: MonthlyTrend[];
  topProducts: TopProduct[];
  costCoverage: {
    total_codes: number;
    codes_with_cost: number;
    codes_missing: number;
  };
  topProductsBySalesperson: {
    salesperson: string;
    products: TopProduct[];
  }[];
}

export interface MonthlyTrend {
  month: string;
  total_amount: number;
  invoice_count: number;
}

export interface TopCustomer {
  customer_name: string;
  total_amount: number;
  invoice_count: number;
}

export interface TopProduct {
  product_code: string;
  description: string;
  total_qty: number;
  total_amount: number;
  invoice_count: number;
}

export interface SalespersonSummary {
  id: number;
  name: string;
  nickname: string;
  invoice_count: number;
  subtotal: number;
  vat: number;
  total: number;
  paid_amount: number;
  unpaid_amount: number;
  total_points: number;
  profit: number;
  qualified_revenue: number;
}

// GET /api/invoices response
export interface InvoicesResponse {
  invoices: Invoice[];
  total: number;
  total_pages: number;
  page: number;
}

export interface Invoice {
  id: number;
  invoice_no: string;
  invoice_type: "IV" | "IS";
  date: string;
  customer_name: string;
  subtotal: number;
  vat: number;
  total: number;
  is_paid: string; // "Y" | "N"
  is_cancelled: number;
  salesperson: string;
}

// GET /api/invoices/:id response
export interface InvoiceDetailResponse {
  invoice: Invoice;
  items: InvoiceItem[];
}

export interface InvoiceItem {
  line_no: number;
  product_code: string;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  discount: number;
  amount: number;
  cost_price: number | null;
  line_profit: number | null;
  line_points: number | null;
}

export interface ImportPreview {
  filename: string;
  salesperson: string;
  period: string;
  new_count: number;
  duplicate_count: number;
  paid_update_count: number;
  total_amount: number;
  mismatch_count: number;
  mismatches: { invoice_no: string; field: string; existing: number | string; incoming: number | string }[];
}

export interface ImportResult {
  imported: number;
  skipped: number;
  paid_updated: number;
  errors: string[];
  warnings: string[];
  warning_count: number;
}

// GET /api/costs/products response
export interface CostsProductsResponse {
  products: CostProduct[];
  total: number;
  total_pages: number;
  page: number;
}

export interface CostProduct {
  product_code: string;
  name: string;
  unit: string;
  cost_price: number | null;
  no_commission: number;
}

// GET /api/costs/summary response
export interface CostSummary {
  product_count: number;
  item_codes_total: number;
  item_codes_with_cost: number;
  item_codes_missing: number;
  no_commission_count: number;
}

// GET /api/reports/monthly response
export interface ReportMonthlyResponse {
  months: ReportMonth[];
  bySalesperson: {
    salesperson: string;
    months: ReportMonth[];
  }[];
}

export interface ReportMonth {
  month: string;
  invoice_count: number;
  subtotal: number;
  vat: number;
  total: number;
  total_cost: number | null;
  profit: number | null;
  profit_pct: number | null;
  points: number;
}

// GET /api/reports/salesperson response
export interface ReportSalespersonResponse {
  customers: ReportCustomer[];
  total: number;
  total_pages: number;
  page: number;
}

export interface ReportCustomer {
  customer_name: string;
  invoice_count: number;
  subtotal: number;
  vat: number;
  total: number;
  total_cost: number | null;
  profit: number | null;
  points: number;
}

// GET /api/db/backups response
export interface BackupsResponse {
  backups: BackupSlot[];
  meta: Record<string, unknown>;
  currentDbSize: number;
}

export interface BackupSlot {
  slot: number;
  filename: string;
  size: number;
  date: string;
}
