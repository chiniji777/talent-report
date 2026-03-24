export interface User {
  username: string;
  token: string;
}

export interface DashboardStats {
  total_sales: number;
  iv_count: number;
  is_count: number;
  invoice_count: number;
  paid_amount: number;
  unpaid_amount: number;
  monthly_data: MonthlyData[];
  top_customers: TopCustomer[];
  salesperson_summary: SalespersonSummary[];
}

export interface MonthlyData {
  month: number;
  month_name: string;
  total: number;
  paid: number;
  unpaid: number;
}

export interface TopCustomer {
  customer_name: string;
  total_amount: number;
  invoice_count: number;
}

export interface SalespersonSummary {
  salesperson: string;
  total_sales: number;
  iv_count: number;
  is_count: number;
  invoice_count: number;
}

export interface Invoice {
  id: number;
  invoice_no: string;
  type: "IV" | "IS";
  date: string;
  customer_name: string;
  subtotal: number;
  vat: number;
  total: number;
  is_paid: boolean;
  salesperson: string;
}

export interface InvoiceDetail extends Invoice {
  items: InvoiceItem[];
}

export interface InvoiceItem {
  line_no: number;
  product_code: string;
  description: string;
  qty: number;
  unit: string;
  unit_price: number;
  discount: number;
  amount: number;
  cost_price: number;
  profit: number;
  points: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

export interface ImportPreview {
  filename: string;
  salesperson: string;
  period: string;
  new_count: number;
  duplicate_count: number;
  total_amount: number;
}

export interface ImportResult {
  imported: number;
  skipped: number;
  errors: string[];
}

export interface CostProduct {
  id: number;
  product_code: string;
  product_name: string;
  unit: string;
  cost_price: number | null;
  no_commission: boolean;
}

export interface CostSummary {
  total_products: number;
  with_cost: number;
  missing_cost: number;
  no_commission_count: number;
}

export interface ReportMonthly {
  month: number;
  month_name: string;
  iv_total: number;
  is_total: number;
  total: number;
}

export interface ReportSalesperson {
  salesperson: string;
  iv_total: number;
  is_total: number;
  total: number;
  invoice_count: number;
}

export interface BackupSlot {
  slot: number;
  filename: string;
  size: string;
  created_at: string;
}

export interface DbInfo {
  size: string;
  invoice_count: number;
  product_count: number;
}
