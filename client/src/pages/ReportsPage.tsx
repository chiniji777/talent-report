import { useState, useEffect } from "react";
import { Download } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { api } from "../api";
import type {
  ReportMonthlyResponse,
  ReportSalespersonResponse,
} from "../types";

const fmtMoney = (n: number) =>
  n.toLocaleString("th-TH", { minimumFractionDigits: 2 });

type Tab = "monthly" | "salesperson";

export function ReportsPage() {
  const [tab, setTab] = useState<Tab>("monthly");
  const [year, setYear] = useState(new Date().getFullYear());
  const [monthlyData, setMonthlyData] = useState<ReportMonthlyResponse | null>(null);
  const [spData, setSpData] = useState<ReportSalespersonResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = `?year=${year}`;
    if (tab === "monthly") {
      api.get<ReportMonthlyResponse>(`/api/reports/monthly${params}`).then(setMonthlyData).catch(() => {}).finally(() => setLoading(false));
    } else {
      api.get<ReportSalespersonResponse>(`/api/reports/salesperson${params}`).then(setSpData).catch(() => {}).finally(() => setLoading(false));
    }
  }, [tab, year]);

  const handleExport = async () => {
    const token = localStorage.getItem("token");
    const res = await fetch(`/api/reports/export?year=${year}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `report-${year}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const months = monthlyData?.months || [];
  const customers = spData?.customers || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3 animate-fade-in-up">
        <h2 className="text-xl font-bold gradient-text">รายงาน</h2>
        <div className="flex gap-3">
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="glass-card-sm px-3 py-2 text-sm text-slate-300 focus:outline-none cursor-pointer"
          >
            {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map((y) => (
              <option key={y} value={y} className="bg-slate-900">{y + 543}</option>
            ))}
          </select>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 text-white px-4 py-2 rounded-xl text-sm transition-all btn-press hover:shadow-lg"
            style={{
              background: "linear-gradient(135deg, #22c55e 0%, #10b981 100%)",
              boxShadow: "0 4px 12px rgba(34, 197, 94, 0.2)"
            }}
          >
            <Download className="w-4 h-4" />
            Export Excel
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 glass-card-sm p-1 w-fit animate-fade-in-up stagger-1">
        {[
          { key: "monthly" as Tab, label: "รายเดือน" },
          { key: "salesperson" as Tab, label: "ตามลูกค้า" },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
              tab === t.key ? "text-white" : "text-slate-500 hover:text-slate-300"
            }`}
            style={tab === t.key ? {
              background: "linear-gradient(135deg, rgba(59, 130, 246, 0.2) 0%, rgba(99, 102, 241, 0.15) 100%)",
              boxShadow: "0 0 12px rgba(59, 130, 246, 0.1)"
            } : undefined}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
          <span className="text-slate-500 text-sm">กำลังโหลด...</span>
        </div>
      ) : tab === "monthly" ? (
        <>
          <div className="glass-card p-5 animate-fade-in-up stagger-2">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={months}>
                  <defs>
                    <linearGradient id="rptGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#60a5fa" stopOpacity={0.9} />
                      <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.6} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.06)" vertical={false} />
                  <XAxis dataKey="month" tick={{ fill: "#64748b", fontSize: 12 }} axisLine={{ stroke: "rgba(148, 163, 184, 0.06)" }} tickLine={false} />
                  <YAxis tick={{ fill: "#64748b", fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ background: "rgba(15, 23, 42, 0.95)", border: "1px solid rgba(148, 163, 184, 0.1)", borderRadius: "12px", color: "#f1f5f9", boxShadow: "0 8px 32px rgba(0,0,0,0.4)" }}
                    formatter={(v) => v != null ? fmtMoney(Number(v)) : ""}
                    cursor={{ fill: "rgba(59, 130, 246, 0.04)" }}
                  />
                  <Bar dataKey="total" name="ยอดรวม" fill="url(#rptGrad)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="glass-card overflow-hidden animate-fade-in-up stagger-3">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(148, 163, 184, 0.06)" }}>
                  <th className="px-4 py-3.5 text-left text-[11px] text-slate-500 font-medium uppercase tracking-wider">เดือน</th>
                  <th className="px-4 py-3.5 text-right text-[11px] text-slate-500 font-medium uppercase tracking-wider">บิล</th>
                  <th className="px-4 py-3.5 text-right text-[11px] text-slate-500 font-medium uppercase tracking-wider">มูลค่า</th>
                  <th className="px-4 py-3.5 text-right text-[11px] text-slate-500 font-medium uppercase tracking-wider">VAT</th>
                  <th className="px-4 py-3.5 text-right text-[11px] text-slate-500 font-medium uppercase tracking-wider">รวม</th>
                </tr>
              </thead>
              <tbody>
                {months.map((m) => (
                  <tr key={m.month} className="table-row-hover" style={{ borderBottom: "1px solid rgba(148, 163, 184, 0.03)" }}>
                    <td className="px-4 py-2.5 text-slate-300 font-medium">{m.month}</td>
                    <td className="px-4 py-2.5 text-right text-slate-500">{m.invoice_count}</td>
                    <td className="px-4 py-2.5 text-right text-slate-300">{fmtMoney(m.subtotal)}</td>
                    <td className="px-4 py-2.5 text-right text-slate-500">{fmtMoney(m.vat)}</td>
                    <td className="px-4 py-2.5 text-right text-white font-medium">{fmtMoney(m.total)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: "1px solid rgba(148, 163, 184, 0.1)" }}>
                  <td className="px-4 py-3.5 font-bold text-white">รวมทั้งปี</td>
                  <td className="px-4 py-3.5 text-right text-slate-400 font-semibold">{months.reduce((s, m) => s + m.invoice_count, 0)}</td>
                  <td className="px-4 py-3.5 text-right text-slate-300 font-semibold">{fmtMoney(months.reduce((s, m) => s + m.subtotal, 0))}</td>
                  <td className="px-4 py-3.5 text-right text-slate-400 font-semibold">{fmtMoney(months.reduce((s, m) => s + m.vat, 0))}</td>
                  <td className="px-4 py-3.5 text-right font-bold gradient-text text-lg">{fmtMoney(months.reduce((s, m) => s + m.total, 0))}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      ) : (
        <div className="glass-card overflow-hidden animate-fade-in-up stagger-2">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(148, 163, 184, 0.06)" }}>
                <th className="px-4 py-3.5 text-left text-[11px] text-slate-500 font-medium uppercase tracking-wider">ลูกค้า</th>
                <th className="px-4 py-3.5 text-right text-[11px] text-slate-500 font-medium uppercase tracking-wider">บิล</th>
                <th className="px-4 py-3.5 text-right text-[11px] text-slate-500 font-medium uppercase tracking-wider">มูลค่า</th>
                <th className="px-4 py-3.5 text-right text-[11px] text-slate-500 font-medium uppercase tracking-wider">รวม</th>
                <th className="px-4 py-3.5 text-right text-[11px] text-slate-500 font-medium uppercase tracking-wider">แต้ม</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.customer_name} className="table-row-hover" style={{ borderBottom: "1px solid rgba(148, 163, 184, 0.03)" }}>
                  <td className="px-4 py-2.5 text-slate-300 truncate max-w-64">{c.customer_name}</td>
                  <td className="px-4 py-2.5 text-right text-slate-500">{c.invoice_count}</td>
                  <td className="px-4 py-2.5 text-right text-slate-300">{fmtMoney(c.subtotal)}</td>
                  <td className="px-4 py-2.5 text-right text-white font-medium">{fmtMoney(c.total)}</td>
                  <td className="px-4 py-2.5 text-right text-blue-400">{c.points || 0}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: "1px solid rgba(148, 163, 184, 0.1)" }}>
                <td className="px-4 py-3.5 font-bold text-white">รวม</td>
                <td className="px-4 py-3.5 text-right text-slate-400 font-semibold">{customers.reduce((s, c) => s + c.invoice_count, 0)}</td>
                <td className="px-4 py-3.5 text-right text-slate-300 font-semibold">{fmtMoney(customers.reduce((s, c) => s + c.subtotal, 0))}</td>
                <td className="px-4 py-3.5 text-right font-bold gradient-text text-lg">{fmtMoney(customers.reduce((s, c) => s + c.total, 0))}</td>
                <td className="px-4 py-3.5 text-right text-blue-400 font-semibold">{customers.reduce((s, c) => s + (c.points || 0), 0)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
