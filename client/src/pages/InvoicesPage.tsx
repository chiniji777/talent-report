import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
import { DataTable, type Column } from "../components/DataTable";
import { useAuth } from "../contexts/AuthContext";
import { api } from "../api";
import type { Invoice, InvoicesResponse } from "../types";

const fmtMoney = (n: number) =>
  n.toLocaleString("th-TH", { minimumFractionDigits: 2 });

const fmtDate = (d: string) => {
  if (!d) return "";
  const date = new Date(d);
  return date.toLocaleDateString("th-TH");
};

const columns: Column<Invoice>[] = [
  { key: "invoice_no", label: "เลขที่" },
  {
    key: "invoice_type",
    label: "ประเภท",
    render: (row) => (
      <span
        className="px-2.5 py-1 rounded-lg text-[11px] font-semibold"
        style={{
          background: row.invoice_type === "IV"
            ? "rgba(34, 197, 94, 0.1)" : "rgba(245, 158, 11, 0.1)",
          color: row.invoice_type === "IV" ? "#4ade80" : "#fbbf24",
        }}
      >
        {row.invoice_type}
      </span>
    ),
  },
  { key: "date", label: "วันที่", render: (row) => fmtDate(row.date) },
  { key: "customer_name", label: "ลูกค้า" },
  {
    key: "total",
    label: "ยอดรวม",
    render: (row) => <span className="font-medium">{fmtMoney(row.total)}</span>,
    className: "text-right",
  },
  {
    key: "is_paid",
    label: "สถานะ",
    render: (row) => (
      <span className="flex items-center gap-1.5">
        <span className="status-dot" style={{
          background: row.is_paid === "Y" ? "#4ade80" : "#f87171",
          boxShadow: row.is_paid === "Y" ? "0 0 6px rgba(74, 222, 128, 0.4)" : "0 0 6px rgba(248, 113, 113, 0.4)"
        }} />
        <span className={`text-xs font-medium ${row.is_paid === "Y" ? "text-emerald-400" : "text-red-400"}`}>
          {row.is_paid === "Y" ? "ชำระแล้ว" : "ค้างชำระ"}
        </span>
      </span>
    ),
  },
  {
    key: "total_profit" as any,
    label: "กำไร",
    render: (row: any) => {
      const profit = row.total_profit;
      if (profit == null) return <span className="text-slate-600">-</span>;
      const isLoss = profit < 0;
      return (
        <span className={isLoss ? "text-red-400 font-medium" : "text-emerald-400"}>
          {isLoss ? "" : "+"}{fmtMoney(profit)}
          {(row.loss_item_count || 0) > 0 && (
            <span className="ml-1 text-[10px] text-red-400/70">({row.loss_item_count} รายการ)</span>
          )}
        </span>
      );
    },
    className: "text-right",
  },
  { key: "salesperson", label: "พนักงาน" },
];

export function InvoicesPage() {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const [data, setData] = useState<InvoicesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [salesperson, setSalesperson] = useState("");
  const [type, setType] = useState("");
  const [isPaid, setIsPaid] = useState("");
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(0);
  const [page, setPage] = useState(1);
  const [hasLoss, setHasLoss] = useState(false);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      per_page: "50",
      year: String(year),
    });
    if (search) params.set("search", search);
    if (salesperson) params.set("salesperson", salesperson);
    if (type) params.set("type", type);
    if (isPaid) params.set("is_paid", isPaid);
    if (month > 0) params.set("month", String(month));
    if (hasLoss) params.set("has_loss", "Y");

    api
      .get<InvoicesResponse>(`/api/invoices?${params}`)
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page, search, salesperson, type, isPaid, year, month, hasLoss]);

  const inputStyle = {
    background: "rgba(15, 23, 42, 0.5)",
    border: "1px solid rgba(148, 163, 184, 0.08)",
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold gradient-text animate-fade-in-up">ใบแจ้งหนี้</h2>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 animate-fade-in-up stagger-1">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="ค้นหาเลขที่ / ลูกค้า..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full rounded-xl pl-9 pr-3 py-2.5 text-sm text-slate-300 placeholder:text-slate-600 focus:outline-none transition-all"
            style={inputStyle}
          />
        </div>
        <input
          type="text"
          placeholder="พนักงาน"
          value={salesperson}
          onChange={(e) => { setSalesperson(e.target.value); setPage(1); }}
          className="rounded-xl px-3 py-2.5 text-sm text-slate-300 placeholder:text-slate-600 focus:outline-none w-32"
          style={inputStyle}
        />
        {[
          { value: type, setter: (v: string) => { setType(v); setPage(1); }, options: [["" , "ทุกประเภท"], ["IV", "IV"], ["IS", "IS"]] },
          { value: isPaid, setter: (v: string) => { setIsPaid(v); setPage(1); }, options: [["", "ทุกสถานะ"], ["Y", "ชำระแล้ว"], ["N", "ค้างชำระ"]] },
          { value: String(year), setter: (v: string) => { setYear(Number(v)); setPage(1); }, options: Array.from({ length: 5 }, (_, i) => { const y = new Date().getFullYear() - i; return [String(y), String(y + 543)]; }) },
        ].map((f, fi) => (
          <select
            key={fi}
            value={f.value}
            onChange={(e) => f.setter(e.target.value)}
            className="rounded-xl px-3 py-2.5 text-sm text-slate-300 focus:outline-none cursor-pointer"
            style={inputStyle}
          >
            {f.options.map(([val, label]) => (
              <option key={val} value={val} className="bg-slate-900">{label}</option>
            ))}
          </select>
        ))}
        <select
          value={month}
          onChange={(e) => { setMonth(Number(e.target.value)); setPage(1); }}
          className="rounded-xl px-3 py-2.5 text-sm text-slate-300 focus:outline-none cursor-pointer"
          style={inputStyle}
        >
          <option value={0} className="bg-slate-900">ทุกเดือน</option>
          {["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."].map((m, i) => (
            <option key={i} value={i + 1} className="bg-slate-900">{m}</option>
          ))}
        </select>
        <button
          onClick={() => { setHasLoss(!hasLoss); setPage(1); }}
          className={"flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all " + (hasLoss ? "text-red-400" : "text-slate-500 hover:text-slate-300")}
          style={hasLoss ? { background: "rgba(248, 113, 113, 0.1)", border: "1px solid rgba(248, 113, 113, 0.2)" } : { background: "rgba(15, 23, 42, 0.5)", border: "1px solid rgba(148, 163, 184, 0.08)" }}
        >
          {hasLoss ? "🔴 ขาดทุน" : "ขาดทุน"}
        </button>
      </div>

      <div className="animate-fade-in-up stagger-2">
        <DataTable<Invoice>
          columns={isAdmin ? columns : columns.filter(col => (col.key as string) !== 'total_profit')}
          data={data?.invoices || []}
          loading={loading}
          onRowClick={(row) => navigate(`/invoices/${row.id}`)}
          page={data?.page || 1}
          totalPages={data?.total_pages || 1}
          onPageChange={setPage}
        />
      </div>
    </div>
  );
}
