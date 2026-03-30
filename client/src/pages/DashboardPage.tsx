import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  TrendingUp,
  FileText,
  Receipt,
  CheckCircle,
  DollarSign,
  Award,
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
const fmtShort = (n: number) => {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(0) + "K";
  return n.toFixed(0);
};

export function DashboardPage() {
  const navigate = useNavigate();
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
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [year, month]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
        <span className="text-slate-500 text-sm">กำลังโหลด...</span>
      </div>
    );
  }
  if (error) return <div className="glass-card p-6 text-center"><p className="text-red-400">{error}</p></div>;
  if (!data) return null;

  const { stats, topProducts, topProductsBySalesperson, costCoverage } = data;

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 animate-fade-in-up">
        <select value={year} onChange={(e) => setYear(Number(e.target.value))}
          className="glass-card-sm px-3 py-2 text-sm text-slate-300 focus:outline-none cursor-pointer">
          {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map((y) => (
            <option key={y} value={y} className="bg-slate-900">{y + 543}</option>
          ))}
        </select>
        <select value={month} onChange={(e) => setMonth(Number(e.target.value))}
          className="glass-card-sm px-3 py-2 text-sm text-slate-300 focus:outline-none cursor-pointer">
          <option value={0} className="bg-slate-900">ทั้งปี</option>
          {["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."].map((m, i) => (
            <option key={i} value={i + 1} className="bg-slate-900">{m}</option>
          ))}
        </select>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-7 gap-3">
        {([
          { icon: TrendingUp, label: "รายได้ (มีต้นทุน)", value: fmtMoney(stats.qualified_revenue || 0), color: "primary" as const },
          { icon: Receipt, label: "ยอดขายทั้งหมด", value: fmtMoney(stats.total_amount), color: "primary" as const },
          { icon: CheckCircle, label: "กำไร", value: fmtMoney(stats.total_profit || 0), color: "success" as const },
          { icon: DollarSign, label: "ต้นทุน", value: fmtMoney(stats.total_cost || 0), color: "warning" as const },
          { icon: FileText, label: "IV", value: fmtNum(stats.iv_count), color: "primary" as const },
          { icon: FileText, label: "IS (ลดหนี้)", value: fmtNum(stats.is_count), color: "warning" as const },
          { icon: Award, label: "คะแนนคอมรวม", value: (stats.total_points || 0).toFixed(1), color: "success" as const },
        ]).map((s, i) => (
          <div key={s.label} className={`animate-fade-in-up stagger-${i + 1}`}>
            <StatCard icon={s.icon} label={s.label} value={s.value} color={s.color} />
          </div>
        ))}
      </div>

      {/* Cost Coverage Warning */}
      {costCoverage && costCoverage.codes_missing > 0 && (
        <div className="glass-card px-5 py-3 flex items-center justify-between animate-fade-in-up cursor-pointer hover:border-amber-500/30 transition-colors"
          onClick={() => navigate("/costs?filter=no_cost")}
          style={{ borderColor: "rgba(245, 158, 11, 0.15)", background: "rgba(245, 158, 11, 0.03)" }}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "rgba(245, 158, 11, 0.1)" }}>
              <DollarSign className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <p className="text-sm text-amber-400 font-medium">สินค้า {costCoverage.codes_missing} รายการยังไม่มีต้นทุน</p>
              <p className="text-[11px] text-slate-500">กดเพื่อไปจัดการต้นทุน — รายได้ที่ไม่มีต้นทุนจะไม่ถูกนับ</p>
            </div>
          </div>
          <span className="text-xs text-slate-500">{costCoverage.codes_with_cost}/{costCoverage.total_codes}</span>
        </div>
      )}

      {/* Monthly Chart */}
      {data.monthlyTrend && data.monthlyTrend.length > 0 && (
        <div className="glass-card p-5 animate-fade-in-up stagger-3">
          <h3 className="text-sm font-semibold text-slate-400 mb-5 uppercase tracking-wider">ยอดขายรายเดือน</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.monthlyTrend}>
                <defs>
                  <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#60a5fa" stopOpacity={0.9} />
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.6} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.06)" vertical={false} />
                <XAxis dataKey="month" tick={{ fill: "#64748b", fontSize: 12 }} axisLine={{ stroke: "rgba(148,163,184,0.06)" }} tickLine={false} />
                <YAxis tick={{ fill: "#64748b", fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={fmtShort} />
                <Tooltip contentStyle={{ background: "rgba(15,23,42,0.95)", border: "1px solid rgba(148,163,184,0.1)", borderRadius: "12px", color: "#f1f5f9" }}
                  formatter={(v) => v != null ? fmtMoney(Number(v)) : ""} cursor={{ fill: "rgba(59,130,246,0.04)" }} />
                <Legend />
                <Bar dataKey="total_amount" name="ยอดขาย" fill="url(#barGradient)" radius={[6,6,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Salesperson Summary */}
      <div className="glass-card overflow-hidden animate-fade-in-up stagger-4">
        <div className="px-5 py-4" style={{ borderBottom: "1px solid rgba(148,163,184,0.06)" }}>
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">สรุปตามพนักงานขาย</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(148,163,184,0.06)" }}>
                <th className="px-4 py-2.5 text-left text-[11px] text-slate-500 font-medium">พนักงาน</th>
                <th className="px-4 py-2.5 text-right text-[11px] text-slate-500 font-medium">รายได้</th>
                <th className="px-4 py-2.5 text-right text-[11px] text-slate-500 font-medium">กำไร</th>
                <th className="px-4 py-2.5 text-right text-[11px] text-slate-500 font-medium">%กำไร</th>
                <th className="px-4 py-2.5 text-right text-[11px] text-slate-500 font-medium">คอม</th>
                <th className="px-4 py-2.5 text-right text-[11px] text-slate-500 font-medium">บิล</th>
                <th className="px-4 py-2.5 text-right text-[11px] text-slate-500 font-medium">ใบลดหนี้</th>
                <th className="px-4 py-2.5 text-right text-[11px] text-slate-500 font-medium">ยอดลดหนี้</th>
              </tr>
            </thead>
            <tbody>
              {data.salespersons.map((s: any, i: number) => {
                const profitPct = s.qualified_revenue > 0 ? ((s.profit / s.qualified_revenue) * 100) : 0;
                return (
                  <tr key={i} className="table-row-hover cursor-pointer" style={{ borderBottom: "1px solid rgba(148,163,184,0.03)" }}
                    onClick={() => navigate(`/invoices?salesperson=${encodeURIComponent(s.nickname)}`)}>
                    <td className="px-4 py-2.5 text-slate-300 font-medium align-middle">{s.nickname}</td>
                    <td className="px-4 py-2.5 text-right text-slate-300 align-middle">{fmtMoney(s.qualified_revenue || 0)}</td>
                    <td className="px-4 py-2.5 text-right text-emerald-400 font-medium align-middle">{fmtMoney(s.profit || 0)}</td>
                    <td className="px-4 py-2.5 text-right align-middle">
                      <span className={`text-xs px-1.5 py-0.5 rounded ${profitPct >= 30 ? "text-emerald-400" : profitPct >= 20 ? "text-amber-400" : "text-red-400"}`}
                        style={{ background: profitPct >= 30 ? "rgba(52,211,153,0.1)" : profitPct >= 20 ? "rgba(251,191,36,0.1)" : "rgba(248,113,113,0.1)" }}>
                        {profitPct.toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right text-amber-400 font-medium align-middle">{(s.total_points || 0).toFixed(1)}</td>
                    <td className="px-4 py-2.5 text-right text-slate-500 align-middle">{s.invoice_count}</td>
                    <td className="px-4 py-2.5 text-right align-middle">
                      {(s.credit_note_count || 0) > 0 ? (
                        <span className="text-red-400 text-xs px-1.5 py-0.5 rounded" style={{ background: "rgba(248,113,113,0.1)" }}>
                          {s.credit_note_count}
                        </span>
                      ) : <span className="text-slate-600">-</span>}
                    </td>
                    <td className="px-4 py-2.5 text-right align-middle">
                      {(s.credit_note_amount || 0) > 0 ? (
                        <span className="text-red-400 text-xs">{fmtMoney(s.credit_note_amount)}</span>
                      ) : <span className="text-slate-600">-</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Top 10 Products */}
      <div className="glass-card overflow-hidden animate-fade-in-up stagger-5">
        <div className="px-5 py-4" style={{ borderBottom: "1px solid rgba(148,163,184,0.06)" }}>
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">10 อันดับสินค้าขายดี</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(148,163,184,0.06)" }}>
                <th className="px-4 py-2.5 text-left text-[11px] text-slate-500 font-medium w-10">#</th>
                <th className="px-4 py-2.5 text-left text-[11px] text-slate-500 font-medium">รหัส</th>
                <th className="px-4 py-2.5 text-left text-[11px] text-slate-500 font-medium">สินค้า</th>
                <th className="px-4 py-2.5 text-right text-[11px] text-slate-500 font-medium">จำนวน</th>
                <th className="px-4 py-2.5 text-right text-[11px] text-slate-500 font-medium">ยอดเงิน</th>
                <th className="px-4 py-2.5 text-right text-[11px] text-slate-500 font-medium">บิล</th>
              </tr>
            </thead>
            <tbody>
              {(topProducts || []).map((p: any, i: number) => (
                <tr key={i} className="table-row-hover" style={{ borderBottom: "1px solid rgba(148,163,184,0.03)" }}>
                  <td className="px-4 py-2.5 align-middle">
                    <span className={`inline-flex items-center justify-center w-5 h-5 rounded-md text-[10px] font-bold ${i < 3 ? "text-amber-300" : "text-slate-500"}`}
                      style={i < 3 ? { background: "rgba(245,158,11,0.1)" } : {}}>
                      {i + 1}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-slate-500 font-mono text-xs align-middle">{p.product_code}</td>
                  <td className="px-4 py-2.5 text-slate-300 truncate max-w-48 align-middle">{p.description}</td>
                  <td className="px-4 py-2.5 text-right text-slate-400 align-middle">{fmtNum(p.total_qty)}</td>
                  <td className="px-4 py-2.5 text-right text-slate-300 font-medium align-middle">{fmtMoney(p.total_amount)}</td>
                  <td className="px-4 py-2.5 text-right text-slate-500 align-middle">{p.invoice_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Top 5 Products per Salesperson */}
      {topProductsBySalesperson && topProductsBySalesperson.length > 0 && (
        <div className="animate-fade-in-up stagger-6">
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">5 อันดับสินค้าขายดี — แยกตามพนักงาน</h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {topProductsBySalesperson.map((sp: any) => (
              <div key={sp.salesperson} className="glass-card overflow-hidden">
                <div className="px-4 py-3 flex items-center gap-2 cursor-pointer hover:bg-white/[0.02] transition-colors"
                  onClick={() => navigate(`/invoices?salesperson=${encodeURIComponent(sp.salesperson)}`)}
                  style={{ borderBottom: "1px solid rgba(148,163,184,0.06)" }}>
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-[10px] font-bold">
                    {(sp.salesperson || "?").charAt(0)}
                  </div>
                  <span className="text-sm font-medium text-slate-300">{sp.salesperson}</span>
                </div>
                <table className="w-full text-xs">
                  <tbody>
                    {(sp.products || []).slice(0, 5).map((p: any, i: number) => (
                      <tr key={i} className="table-row-hover" style={{ borderBottom: "1px solid rgba(148,163,184,0.02)" }}>
                        <td className="px-3 py-2 w-6 align-middle">
                          <span className={`text-[10px] font-bold ${i < 3 ? "text-amber-400" : "text-slate-600"}`}>{i + 1}</span>
                        </td>
                        <td className="px-3 py-2 text-slate-400 truncate max-w-32 align-middle">{p.description}</td>
                        <td className="px-3 py-2 text-right text-slate-500 align-middle">{fmtNum(p.total_qty)}</td>
                        <td className="px-3 py-2 text-right text-slate-300 font-medium align-middle">{fmtMoney(p.total_amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
