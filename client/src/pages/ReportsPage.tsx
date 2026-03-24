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
import type { ReportMonthly, ReportSalesperson } from "../types";

const fmtMoney = (n: number) =>
  n.toLocaleString("th-TH", { minimumFractionDigits: 2 });

type Tab = "monthly" | "salesperson";

export function ReportsPage() {
  const [tab, setTab] = useState<Tab>("monthly");
  const [year, setYear] = useState(new Date().getFullYear());
  const [monthly, setMonthly] = useState<ReportMonthly[]>([]);
  const [salesperson, setSalesperson] = useState<ReportSalesperson[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = `?year=${year}`;
    if (tab === "monthly") {
      api
        .get<ReportMonthly[]>(`/api/reports/monthly${params}`)
        .then(setMonthly)
        .catch(() => {})
        .finally(() => setLoading(false));
    } else {
      api
        .get<ReportSalesperson[]>(`/api/reports/salesperson${params}`)
        .then(setSalesperson)
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

  const totalMonthly = monthly.reduce((s, m) => s + m.total, 0);

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
              <option key={y} value={y}>
                {y + 543}
              </option>
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
          { key: "salesperson" as Tab, label: "ตามพนักงาน" },
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
                <BarChart data={monthly}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis
                    dataKey="month_name"
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
                    formatter={(v: number) => fmtMoney(v)}
                  />
                  <Bar dataKey="iv_total" name="IV" fill="#22c55e" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="is_total" name="IS" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Table */}
          <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="px-4 py-3 text-left text-xs text-slate-500">
                    เดือน
                  </th>
                  <th className="px-4 py-3 text-right text-xs text-slate-500">
                    IV
                  </th>
                  <th className="px-4 py-3 text-right text-xs text-slate-500">
                    IS
                  </th>
                  <th className="px-4 py-3 text-right text-xs text-slate-500">
                    รวม
                  </th>
                </tr>
              </thead>
              <tbody>
                {monthly.map((m) => (
                  <tr key={m.month} className="border-b border-slate-700/50">
                    <td className="px-4 py-2 text-slate-300">{m.month_name}</td>
                    <td className="px-4 py-2 text-right text-success">
                      {fmtMoney(m.iv_total)}
                    </td>
                    <td className="px-4 py-2 text-right text-warning">
                      {fmtMoney(m.is_total)}
                    </td>
                    <td className="px-4 py-2 text-right text-slate-200 font-medium">
                      {fmtMoney(m.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-slate-600">
                  <td className="px-4 py-3 font-semibold">รวมทั้งปี</td>
                  <td className="px-4 py-3 text-right text-success font-semibold">
                    {fmtMoney(monthly.reduce((s, m) => s + m.iv_total, 0))}
                  </td>
                  <td className="px-4 py-3 text-right text-warning font-semibold">
                    {fmtMoney(monthly.reduce((s, m) => s + m.is_total, 0))}
                  </td>
                  <td className="px-4 py-3 text-right text-primary font-bold">
                    {fmtMoney(totalMonthly)}
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
                <th className="px-4 py-3 text-left text-xs text-slate-500">
                  พนักงาน
                </th>
                <th className="px-4 py-3 text-right text-xs text-slate-500">
                  IV
                </th>
                <th className="px-4 py-3 text-right text-xs text-slate-500">
                  IS
                </th>
                <th className="px-4 py-3 text-right text-xs text-slate-500">
                  รวม
                </th>
                <th className="px-4 py-3 text-right text-xs text-slate-500">
                  บิล
                </th>
              </tr>
            </thead>
            <tbody>
              {salesperson.map((s) => (
                <tr
                  key={s.salesperson}
                  className="border-b border-slate-700/50"
                >
                  <td className="px-4 py-2 text-slate-300">{s.salesperson}</td>
                  <td className="px-4 py-2 text-right text-success">
                    {fmtMoney(s.iv_total)}
                  </td>
                  <td className="px-4 py-2 text-right text-warning">
                    {fmtMoney(s.is_total)}
                  </td>
                  <td className="px-4 py-2 text-right text-slate-200 font-medium">
                    {fmtMoney(s.total)}
                  </td>
                  <td className="px-4 py-2 text-right text-slate-400">
                    {s.invoice_count}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-slate-600">
                <td className="px-4 py-3 font-semibold">รวม</td>
                <td className="px-4 py-3 text-right text-success font-semibold">
                  {fmtMoney(salesperson.reduce((s, r) => s + r.iv_total, 0))}
                </td>
                <td className="px-4 py-3 text-right text-warning font-semibold">
                  {fmtMoney(salesperson.reduce((s, r) => s + r.is_total, 0))}
                </td>
                <td className="px-4 py-3 text-right text-primary font-bold">
                  {fmtMoney(salesperson.reduce((s, r) => s + r.total, 0))}
                </td>
                <td className="px-4 py-3 text-right text-slate-400 font-semibold">
                  {salesperson.reduce((s, r) => s + r.invoice_count, 0)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
