import { useState, useEffect } from "react";
import {
  TrendingUp,
  FileText,
  FileMinus,
  Receipt,
  CheckCircle,
  XCircle,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { StatCard } from "../components/StatCard";
import { api } from "../api";
import type { DashboardResponse } from "../types";

const fmtNum = (n: number) => n.toLocaleString("th-TH");
const fmtMoney = (n: number) =>
  n.toLocaleString("th-TH", { minimumFractionDigits: 2 });

export function DashboardPage() {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(0);

  useEffect(() => {
    setLoading(true);
    setError("");
    const params = new URLSearchParams({ year: String(year) });
    if (month > 0) params.set("month", String(month));
    api
      .get<DashboardResponse>(`/api/reports/dashboard?${params}`)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [year, month]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">
        กำลังโหลด...
      </div>
    );
  }
  if (error) {
    return (
      <div className="bg-danger/10 border border-danger/30 text-danger rounded-xl p-4 text-center">
        {error}
      </div>
    );
  }
  if (!data) return null;

  const { stats, salespersons, topCustomers, monthlyTrend } = data;

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
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
          onChange={(e) => setMonth(Number(e.target.value))}
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-primary"
        >
          <option value={0}>ทั้งปี</option>
          {[
            "ม.ค.",
            "ก.พ.",
            "มี.ค.",
            "เม.ย.",
            "พ.ค.",
            "มิ.ย.",
            "ก.ค.",
            "ส.ค.",
            "ก.ย.",
            "ต.ค.",
            "พ.ย.",
            "ธ.ค.",
          ].map((m, i) => (
            <option key={i} value={i + 1}>
              {m}
            </option>
          ))}
        </select>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard
          icon={TrendingUp}
          label="ยอดขายรวม"
          value={fmtMoney(stats.total_amount)}
          color="primary"
        />
        <StatCard
          icon={FileText}
          label="จำนวน IV"
          value={fmtNum(stats.iv_count)}
          color="success"
        />
        <StatCard
          icon={FileMinus}
          label="จำนวน IS"
          value={fmtNum(stats.is_count)}
          color="warning"
        />
        <StatCard
          icon={Receipt}
          label="จำนวน Invoice"
          value={fmtNum(stats.total_invoices)}
        />
        <StatCard
          icon={CheckCircle}
          label="ชำระแล้ว"
          value={fmtMoney(stats.paid_amount)}
          color="success"
        />
        <StatCard
          icon={XCircle}
          label="ค้างชำระ"
          value={fmtMoney(stats.unpaid_amount)}
          color="danger"
        />
      </div>

      {/* Monthly Chart */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
        <h3 className="text-sm font-medium text-slate-400 mb-4">
          ยอดขายรายเดือน
        </h3>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthlyTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="month" tick={{ fill: "#94a3b8", fontSize: 12 }} />
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
              <Legend />
              <Bar
                dataKey="total_amount"
                name="ยอดขาย"
                fill="#3b82f6"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Tables */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Top Customers */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-700">
            <h3 className="text-sm font-medium text-slate-400">
              ลูกค้า Top 10
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="px-4 py-2 text-left text-xs text-slate-500">#</th>
                  <th className="px-4 py-2 text-left text-xs text-slate-500">
                    ลูกค้า
                  </th>
                  <th className="px-4 py-2 text-right text-xs text-slate-500">
                    ยอดรวม
                  </th>
                  <th className="px-4 py-2 text-right text-xs text-slate-500">
                    บิล
                  </th>
                </tr>
              </thead>
              <tbody>
                {topCustomers.map((c, i) => (
                  <tr key={i} className="border-b border-slate-700/50">
                    <td className="px-4 py-2 text-slate-500">{i + 1}</td>
                    <td className="px-4 py-2 text-slate-300 truncate max-w-48">
                      {c.customer_name}
                    </td>
                    <td className="px-4 py-2 text-right text-slate-300">
                      {fmtMoney(c.total_amount)}
                    </td>
                    <td className="px-4 py-2 text-right text-slate-400">
                      {c.invoice_count}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Salesperson */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-700">
            <h3 className="text-sm font-medium text-slate-400">
              สรุปตามพนักงานขาย
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="px-4 py-2 text-left text-xs text-slate-500">
                    พนักงาน
                  </th>
                  <th className="px-4 py-2 text-right text-xs text-slate-500">
                    ยอดขาย
                  </th>
                  <th className="px-4 py-2 text-right text-xs text-slate-500">
                    บิล
                  </th>
                  <th className="px-4 py-2 text-right text-xs text-slate-500">
                    ชำระแล้ว
                  </th>
                </tr>
              </thead>
              <tbody>
                {salespersons.map((s, i) => (
                  <tr key={i} className="border-b border-slate-700/50">
                    <td className="px-4 py-2 text-slate-300">{s.nickname}</td>
                    <td className="px-4 py-2 text-right text-slate-300">
                      {fmtMoney(s.total)}
                    </td>
                    <td className="px-4 py-2 text-right text-slate-400">
                      {s.invoice_count}
                    </td>
                    <td className="px-4 py-2 text-right text-success">
                      {fmtMoney(s.paid_amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
