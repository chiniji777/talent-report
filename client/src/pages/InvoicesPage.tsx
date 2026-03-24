import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
import { DataTable, type Column } from "../components/DataTable";
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
        className={`px-2 py-0.5 rounded text-xs font-medium ${
          row.invoice_type === "IV"
            ? "bg-success/10 text-success"
            : "bg-warning/10 text-warning"
        }`}
      >
        {row.invoice_type}
      </span>
    ),
  },
  {
    key: "date",
    label: "วันที่",
    render: (row) => fmtDate(row.date),
  },
  { key: "customer_name", label: "ลูกค้า" },
  {
    key: "total",
    label: "ยอดรวม",
    render: (row) => fmtMoney(row.total),
    className: "text-right",
  },
  {
    key: "is_paid",
    label: "สถานะ",
    render: (row) => (
      <span
        className={`px-2 py-0.5 rounded text-xs font-medium ${
          row.is_paid === "Y"
            ? "bg-success/10 text-success"
            : "bg-danger/10 text-danger"
        }`}
      >
        {row.is_paid === "Y" ? "ชำระแล้ว" : "ค้างชำระ"}
      </span>
    ),
  },
  { key: "salesperson", label: "พนักงาน" },
];

export function InvoicesPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<InvoicesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [salesperson, setSalesperson] = useState("");
  const [type, setType] = useState("");
  const [isPaid, setIsPaid] = useState("");
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(0);
  const [page, setPage] = useState(1);

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

    api
      .get<InvoicesResponse>(`/api/invoices?${params}`)
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page, search, salesperson, type, isPaid, year, month]);

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">ใบแจ้งหนี้</h2>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="ค้นหาเลขที่ / ลูกค้า..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-300 placeholder:text-slate-500 focus:outline-none focus:border-primary"
          />
        </div>
        <input
          type="text"
          placeholder="พนักงาน"
          value={salesperson}
          onChange={(e) => {
            setSalesperson(e.target.value);
            setPage(1);
          }}
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-300 placeholder:text-slate-500 focus:outline-none focus:border-primary w-32"
        />
        <select
          value={type}
          onChange={(e) => {
            setType(e.target.value);
            setPage(1);
          }}
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-primary"
        >
          <option value="">ทุกประเภท</option>
          <option value="IV">IV</option>
          <option value="IS">IS</option>
        </select>
        <select
          value={isPaid}
          onChange={(e) => {
            setIsPaid(e.target.value);
            setPage(1);
          }}
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-primary"
        >
          <option value="">ทุกสถานะ</option>
          <option value="Y">ชำระแล้ว</option>
          <option value="N">ค้างชำระ</option>
        </select>
        <select
          value={year}
          onChange={(e) => {
            setYear(Number(e.target.value));
            setPage(1);
          }}
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-primary"
        >
          {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(
            (y) => (
              <option key={y} value={y}>
                {y + 543}
              </option>
            )
          )}
        </select>
        <select
          value={month}
          onChange={(e) => {
            setMonth(Number(e.target.value));
            setPage(1);
          }}
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-primary"
        >
          <option value={0}>ทุกเดือน</option>
          {[
            "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
            "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
          ].map((m, i) => (
            <option key={i} value={i + 1}>{m}</option>
          ))}
        </select>
      </div>

      <DataTable<Invoice>
        columns={columns}
        data={data?.invoices || []}
        loading={loading}
        onRowClick={(row) => navigate(`/invoices/${row.id}`)}
        page={data?.page || 1}
        totalPages={data?.total_pages || 1}
        onPageChange={setPage}
      />
    </div>
  );
}
