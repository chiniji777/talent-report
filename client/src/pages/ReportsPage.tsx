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
      api
        .get<ReportMonthlyResponse>(`/api/reports/monthly${params}`)
        .then(setMonthlyData)
        .catch(() => {})
        .finally(() => setLoading(false));
    } else {
      api
        .get<ReportSalespersonResponse>(`/api/reports/salesperson${params}`)
        .then(setSpData)
        .catch(() => {})
        .finally(() => setLoading(false));
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
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-xl font-bold">รายงาน</h2>
        <div className="flex gap-3">
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-primary"
          >
            {Array.from(
              { length: 5 },
              (_, i) => new Date().getFullYear() - i
            ).map((y) => (
              <option key={y} value={y}>{y + 543}</option>
            ))}
          </select>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 bg-success hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm transition-colors"
          >
            <Download className="w-4 h-4" />
            Export Excel
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-800 rounded-lg p-1 w-fit">
        {[
          { key: "monthly" as Tab, label: "รายเดือน" },
          { key: "salesperson" as Tab, label: "ตามลูกค้า" },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-md text-sm transition-colors ${
              tab === t.key
                ? "bg-primary text-white"
                : "text-slate-400 hover:text-white"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-slate-400 text-center py-12">กำลังโหลด...</div>
      ) : tab === "monthly" ? (
        <>
          {/* Chart */}
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={months}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis
                    dataKey="month"
                    tick={{ fill: "#94a3b8", fontSize: 12 }}
                  />
                  <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1e293b",
                      border: "1px solid #334155",
                      borderRadius: "8px",
                      color: "#f1f5f9",
                    }}
                    formatter={(v) => v != null ? fmtMoney(Number(v)) : ""}
                  />
                  <Bar dataKey="total" name="ยอดรวม" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Table */}
          <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="px-4 py-3 text-left text-xs text-slate-500">เดือน</th>
                  <th className="px-4 py-3 text-right text-xs text-slate-500">บิล</th>
                  <th className="px-4 py-3 text-right text-xs text-slate-500">มูลค่า</th>
                  <th className="px-4 py-3 text-right text-xs text-slate-500">VAT</th>
                  <th className="px-4 py-3 text-right text-xs text-slate-500">รวม</th>
                </tr>
              </thead>
              <tbody>
                {months.map((m) => (
                  <tr key={m.month} className="border-b border-slate-700/50">
                    <td className="px-4 py-2 text-slate-300">{m.month}</td>
                    <td className="px-4 py-2 text-right text-slate-400">{m.invoice_count}</td>
                    <td className="px-4 py-2 text-right text-slate-300">{fmtMoney(m.subtotal)}</td>
                    <td className="px-4 py-2 text-right text-slate-400">{fmtMoney(m.vat)}</td>
                    <td className="px-4 py-2 text-right text-slate-200 font-medium">{fmtMoney(m.total)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-slate-600">
                  <td className="px-4 py-3 font-semibold">รวมทั้งปี</td>
                  <td className="px-4 py-3 text-right text-slate-400 font-semibold">
                    {months.reduce((s, m) => s + m.invoice_count, 0)}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-300 font-semibold">
                    {fmtMoney(months.reduce((s, m) => s + m.subtotal, 0))}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-400 font-semibold">
                    {fmtMoney(months.reduce((s, m) => s + m.vat, 0))}
                  </td>
                  <td className="px-4 py-3 text-right text-primary font-bold">
                    {fmtMoney(months.reduce((s, m) => s + m.total, 0))}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      ) : (
        <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="px-4 py-3 text-left text-xs text-slate-500">ลูกค้า</th>
                <th className="px-4 py-3 text-right text-xs text-slate-500">บิล</th>
                <th className="px-4 py-3 text-right text-xs text-slate-500">มูลค่า</th>
                <th className="px-4 py-3 text-right text-xs text-slate-500">รวม</th>
                <th className="px-4 py-3 text-right text-xs text-slate-500">แต้ม</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.customer_name} className="border-b border-slate-700/50">
                  <td className="px-4 py-2 text-slate-300 truncate max-w-64">{c.customer_name}</td>
                  <td className="px-4 py-2 text-right text-slate-400">{c.invoice_count}</td>
                  <td className="px-4 py-2 text-right text-slate-300">{fmtMoney(c.subtotal)}</td>
                  <td className="px-4 py-2 text-right text-slate-200 font-medium">{fmtMoney(c.total)}</td>
                  <td className="px-4 py-2 text-right text-primary">{c.points || 0}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-slate-600">
                <td className="px-4 py-3 font-semibold">รวม</td>
                <td className="px-4 py-3 text-right text-slate-400 font-semibold">
                  {customers.reduce((s, c) => s + c.invoice_count, 0)}
                </td>
                <td className="px-4 py-3 text-right text-slate-300 font-semibold">
                  {fmtMoney(customers.reduce((s, c) => s + c.subtotal, 0))}
                </td>
                <td className="px-4 py-3 text-right text-primary font-bold">
                  {fmtMoney(customers.reduce((s, c) => s + c.total, 0))}
                </td>
                <td className="px-4 py-3 text-right text-primary font-semibold">
                  {customers.reduce((s, c) => s + (c.points || 0), 0)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
