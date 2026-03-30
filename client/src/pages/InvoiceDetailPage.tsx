import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, FileText } from "lucide-react";
import { api } from "../api";
import { useAuth } from "../contexts/AuthContext";
import type { InvoiceDetailResponse } from "../types";

const fmtMoney = (n: number | null) =>
  n != null ? n.toLocaleString("th-TH", { minimumFractionDigits: 2 }) : "-";
const fmtDate = (d: string) => (d ? new Date(d).toLocaleDateString("th-TH") : "");

export function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<InvoiceDetailResponse | null>(null);
  const { isAdmin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get<InvoiceDetailResponse>(`/api/invoices/${id}`)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
        <span className="text-slate-500 text-sm">กำลังโหลด...</span>
      </div>
    );
  }
  if (error || !data?.invoice) {
    return (
      <div className="text-center py-12">
        <p className="text-red-400 mb-4">{error || "ไม่พบข้อมูล"}</p>
        <Link to="/invoices" className="text-blue-400 hover:text-blue-300 text-sm transition-colors">
          กลับไปหน้ารายการ
        </Link>
      </div>
    );
  }

  const { invoice, items } = data;

  return (
    <div className="space-y-6">
      <Link
        to="/invoices"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-blue-400 transition-colors animate-fade-in"
      >
        <ArrowLeft className="w-4 h-4" /> กลับ
      </Link>

      {/* Header */}
      <div className="glass-card gradient-border p-6 animate-fade-in-up stagger-1">
        <div className="flex items-start gap-4">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{
            background: "linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, rgba(99, 102, 241, 0.08) 100%)"
          }}>
            <FileText className="w-5 h-5 text-blue-400" />
          </div>
          <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <p className="text-[11px] text-slate-500 uppercase tracking-wider">เลขที่</p>
              <p className="font-semibold text-white mt-0.5">{invoice.invoice_no}</p>
            </div>
            <div>
              <p className="text-[11px] text-slate-500 uppercase tracking-wider">ประเภท</p>
              <span
                className="inline-block mt-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold"
                style={{
                  background: invoice.invoice_type === "IV"
                    ? "rgba(34, 197, 94, 0.1)" : "rgba(245, 158, 11, 0.1)",
                  color: invoice.invoice_type === "IV" ? "#4ade80" : "#fbbf24",
                }}
              >
                {invoice.invoice_type}
              </span>
            </div>
            <div>
              <p className="text-[11px] text-slate-500 uppercase tracking-wider">วันที่</p>
              <p className="text-slate-300 mt-0.5">{fmtDate(invoice.date)}</p>
            </div>
            <div>
              <p className="text-[11px] text-slate-500 uppercase tracking-wider">สถานะ</p>
              <span className="flex items-center gap-1.5 mt-1">
                <span className="status-dot" style={{
                  background: invoice.is_paid === "Y" ? "#4ade80" : "#f87171",
                  boxShadow: invoice.is_paid === "Y" ? "0 0 6px rgba(74, 222, 128, 0.4)" : "0 0 6px rgba(248, 113, 113, 0.4)"
                }} />
                <span className={`text-xs font-medium ${invoice.is_paid === "Y" ? "text-emerald-400" : "text-red-400"}`}>
                  {invoice.is_paid === "Y" ? "ชำระแล้ว" : "ค้างชำระ"}
                </span>
              </span>
            </div>
            <div>
              <p className="text-[11px] text-slate-500 uppercase tracking-wider">ลูกค้า</p>
              <p className="text-slate-300 mt-0.5">{invoice.customer_name}</p>
            </div>
            <div>
              <p className="text-[11px] text-slate-500 uppercase tracking-wider">พนักงาน</p>
              <p className="text-slate-300 mt-0.5">{invoice.salesperson}</p>
            </div>
            <div>
              <p className="text-[11px] text-slate-500 uppercase tracking-wider">ยอดก่อน VAT</p>
              <p className="text-slate-300 mt-0.5">{fmtMoney(invoice.subtotal)}</p>
            </div>
            <div>
              <p className="text-[11px] text-slate-500 uppercase tracking-wider">ยอดรวม VAT</p>
              <p className="font-bold text-lg mt-0.5 gradient-text">{fmtMoney(invoice.total)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Items */}
      <div className="glass-card overflow-hidden animate-fade-in-up stagger-2">
        <div className="px-5 py-4" style={{ borderBottom: "1px solid rgba(148, 163, 184, 0.06)" }}>
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
            รายการสินค้า ({items.length} รายการ)
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(148, 163, 184, 0.06)" }}>
                {[
                  "#", "รหัส", "รายละเอียด", "จำนวน", "หน่วย",
                  "ราคา/หน่วย", "ส่วนลด", "จำนวนเงิน", ...(isAdmin ? ["ต้นทุน", "กำไร", "แต้ม"] : []),
                ].map((h) => (
                  <th
                    key={h}
                    className="px-3 py-3 text-left text-[11px] text-slate-500 font-medium whitespace-nowrap uppercase tracking-wider"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.line_no} className="table-row-hover" style={{ borderBottom: "1px solid rgba(148, 163, 184, 0.03)" }}>
                  <td className="px-3 py-2.5 text-slate-500">{item.line_no}</td>
                  <td className="px-3 py-2.5 text-slate-400 font-mono text-xs">{item.product_code}</td>
                  <td className="px-3 py-2.5 text-slate-300 max-w-48 truncate">{item.description}</td>
                  <td className="px-3 py-2.5 text-right text-slate-300">{item.quantity}</td>
                  <td className="px-3 py-2.5 text-slate-500">{item.unit}</td>
                  <td className="px-3 py-2.5 text-right text-slate-300">{fmtMoney(item.unit_price)}</td>
                  <td className="px-3 py-2.5 text-right text-slate-500">{fmtMoney(item.discount)}</td>
                  <td className="px-3 py-2.5 text-right text-white font-medium">{fmtMoney(item.amount)}</td>
                  {isAdmin && <>
                  <td className="px-3 py-2.5 text-right text-slate-500">{fmtMoney(item.cost_price)}</td>
                  <td className={`px-3 py-2.5 text-right font-medium ${
                    item.line_profit != null && item.line_profit >= 0 ? "text-emerald-400" : "text-red-400"
                  }`}>
                    {fmtMoney(item.line_profit)}
                  </td>
                  <td className="px-3 py-2.5 text-right text-blue-400">{item.line_points != null ? item.line_points : "-"}</td>
                  </>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
