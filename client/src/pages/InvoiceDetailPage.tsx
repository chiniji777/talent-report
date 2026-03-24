import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, FileText } from "lucide-react";
import { api } from "../api";
import type { InvoiceDetail } from "../types";

const fmtMoney = (n: number) =>
  n.toLocaleString("th-TH", { minimumFractionDigits: 2 });
const fmtDate = (d: string) => new Date(d).toLocaleDateString("th-TH");

export function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get<InvoiceDetail>(`/api/invoices/${id}`)
      .then(setInvoice)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">
        กำลังโหลด...
      </div>
    );
  }
  if (error || !invoice) {
    return (
      <div className="text-center py-12">
        <p className="text-danger mb-4">{error || "ไม่พบข้อมูล"}</p>
        <Link to="/invoices" className="text-primary hover:underline text-sm">
          กลับไปหน้ารายการ
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link
        to="/invoices"
        className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-primary transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> กลับ
      </Link>

      {/* Header */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center shrink-0">
            <FileText className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-slate-500">เลขที่</p>
              <p className="font-semibold">{invoice.invoice_no}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">ประเภท</p>
              <span
                className={`px-2 py-0.5 rounded text-xs font-medium ${
                  invoice.type === "IV"
                    ? "bg-success/10 text-success"
                    : "bg-warning/10 text-warning"
                }`}
              >
                {invoice.type}
              </span>
            </div>
            <div>
              <p className="text-xs text-slate-500">วันที่</p>
              <p>{fmtDate(invoice.date)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">สถานะ</p>
              <span
                className={`px-2 py-0.5 rounded text-xs font-medium ${
                  invoice.is_paid
                    ? "bg-success/10 text-success"
                    : "bg-danger/10 text-danger"
                }`}
              >
                {invoice.is_paid ? "ชำระแล้ว" : "ค้างชำระ"}
              </span>
            </div>
            <div>
              <p className="text-xs text-slate-500">ลูกค้า</p>
              <p>{invoice.customer_name}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">พนักงาน</p>
              <p>{invoice.salesperson}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">ยอดก่อน VAT</p>
              <p>{fmtMoney(invoice.subtotal)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">ยอดรวม VAT</p>
              <p className="font-bold text-primary">{fmtMoney(invoice.total)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Items */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-700">
          <h3 className="text-sm font-medium text-slate-400">
            รายการสินค้า ({invoice.items.length} รายการ)
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700">
                {[
                  "#",
                  "รหัส",
                  "รายละเอียด",
                  "จำนวน",
                  "หน่วย",
                  "ราคา/หน่วย",
                  "ส่วนลด",
                  "จำนวนเงิน",
                  "ต้นทุน",
                  "กำไร",
                  "แต้ม",
                ].map((h) => (
                  <th
                    key={h}
                    className="px-3 py-2 text-left text-xs text-slate-500 whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {invoice.items.map((item) => (
                <tr
                  key={item.line_no}
                  className="border-b border-slate-700/50"
                >
                  <td className="px-3 py-2 text-slate-500">{item.line_no}</td>
                  <td className="px-3 py-2 text-slate-300 font-mono text-xs">
                    {item.product_code}
                  </td>
                  <td className="px-3 py-2 text-slate-300 max-w-48 truncate">
                    {item.description}
                  </td>
                  <td className="px-3 py-2 text-right text-slate-300">
                    {item.qty}
                  </td>
                  <td className="px-3 py-2 text-slate-400">{item.unit}</td>
                  <td className="px-3 py-2 text-right text-slate-300">
                    {fmtMoney(item.unit_price)}
                  </td>
                  <td className="px-3 py-2 text-right text-slate-400">
                    {fmtMoney(item.discount)}
                  </td>
                  <td className="px-3 py-2 text-right text-slate-200 font-medium">
                    {fmtMoney(item.amount)}
                  </td>
                  <td className="px-3 py-2 text-right text-slate-400">
                    {fmtMoney(item.cost_price)}
                  </td>
                  <td
                    className={`px-3 py-2 text-right font-medium ${
                      item.profit >= 0 ? "text-success" : "text-danger"
                    }`}
                  >
                    {fmtMoney(item.profit)}
                  </td>
                  <td className="px-3 py-2 text-right text-primary">
                    {item.points}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
