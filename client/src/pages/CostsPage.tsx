import { useState, useEffect } from "react";
import {
  Package,
  DollarSign,
  AlertTriangle,
  Upload,
  Download,
  Check,
  X,
} from "lucide-react";
import { StatCard } from "../components/StatCard";
import { api } from "../api";
import type { CostProduct, CostSummary, CostsProductsResponse } from "../types";

const fmtMoney = (n: number | null) =>
  n !== null ? n.toLocaleString("th-TH", { minimumFractionDigits: 2 }) : "-";

type FilterTab = "all" | "has_cost" | "no_cost" | "no_commission";

export function CostsPage() {
  const [products, setProducts] = useState<CostProduct[]>([]);
  const [summary, setSummary] = useState<CostSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterTab, setFilterTab] = useState<FilterTab>("all");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const fetchProducts = () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), per_page: "50" });
    if (filterTab !== "all") params.set("filter", filterTab);
    api
      .get<CostsProductsResponse>(`/api/costs/products?${params}`)
      .then((res) => {
        setProducts(res.products);
        setTotalPages(res.total_pages);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  const fetchSummary = () => {
    api.get<CostSummary>("/api/costs/summary").then(setSummary).catch(() => {});
  };

  useEffect(() => {
    fetchProducts();
  }, [filterTab, page]);

  useEffect(() => {
    fetchSummary();
  }, []);

  const startEdit = (product: CostProduct) => {
    setEditingCode(product.product_code);
    setEditValue(product.cost_price?.toString() || "");
  };

  const saveEdit = async (code: string) => {
    try {
      const product = products.find((p) => p.product_code === code);
      await api.put(`/api/costs/products/${code}`, {
        name: product?.name || "",
        unit: product?.unit || "",
        std_price: editValue || null,
      });
      setEditingCode(null);
      fetchProducts();
      fetchSummary();
    } catch {
      // handle error silently
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    try {
      await api.upload("/api/costs/import", fd);
      fetchProducts();
      fetchSummary();
    } catch {
      // handle error
    }
    e.target.value = "";
  };

  const handleExport = async () => {
    const token = localStorage.getItem("token");
    const res = await fetch("/api/costs/export", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "costs.xlsx";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-xl font-bold">จัดการต้นทุน</h2>
        <div className="flex gap-2">
          <label className="flex items-center gap-2 bg-primary hover:bg-primary-hover text-white px-4 py-2 rounded-lg text-sm cursor-pointer transition-colors">
            <Upload className="w-4 h-4" />
            Import Excel
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleImport}
              className="hidden"
            />
          </label>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 bg-success hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm transition-colors"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

      {/* Summary */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            icon={Package}
            label="สินค้าทั้งหมด"
            value={summary.product_count}
          />
          <StatCard
            icon={DollarSign}
            label="มีต้นทุน"
            value={summary.item_codes_with_cost}
            color="success"
          />
          <StatCard
            icon={AlertTriangle}
            label="ไม่มีต้นทุน"
            value={summary.item_codes_missing}
            color="danger"
          />
          <StatCard
            icon={X}
            label="ไม่คิดคอม"
            value={summary.no_commission_count}
            color="warning"
          />
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-1 bg-slate-800 rounded-lg p-1 w-fit">
        {[
          { key: "all" as FilterTab, label: "ทั้งหมด" },
          { key: "has_cost" as FilterTab, label: "มีต้นทุน" },
          { key: "no_cost" as FilterTab, label: "ไม่มีต้นทุน" },
          { key: "no_commission" as FilterTab, label: "ไม่คิดคอม" },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => {
              setFilterTab(t.key);
              setPage(1);
            }}
            className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
              filterTab === t.key
                ? "bg-primary text-white"
                : "text-slate-400 hover:text-white"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="px-4 py-3 text-left text-xs text-slate-500">รหัส</th>
                <th className="px-4 py-3 text-left text-xs text-slate-500">ชื่อสินค้า</th>
                <th className="px-4 py-3 text-left text-xs text-slate-500">หน่วย</th>
                <th className="px-4 py-3 text-right text-xs text-slate-500">ราคาต้นทุน</th>
                <th className="px-4 py-3 text-center text-xs text-slate-500">ไม่คิดคอม</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-slate-400">
                    กำลังโหลด...
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-slate-400">
                    ไม่พบข้อมูล
                  </td>
                </tr>
              ) : (
                products.map((p) => (
                  <tr key={p.product_code} className="border-b border-slate-700/50">
                    <td className="px-4 py-2 text-slate-300 font-mono text-xs">
                      {p.product_code}
                    </td>
                    <td className="px-4 py-2 text-slate-300 max-w-64 truncate">
                      {p.name}
                    </td>
                    <td className="px-4 py-2 text-slate-400">{p.unit}</td>
                    <td className="px-4 py-2 text-right">
                      {editingCode === p.product_code ? (
                        <div className="flex items-center justify-end gap-1">
                          <input
                            type="number"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            className="w-24 bg-slate-900 border border-primary rounded px-2 py-1 text-right text-sm text-white focus:outline-none"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === "Enter") saveEdit(p.product_code);
                              if (e.key === "Escape") setEditingCode(null);
                            }}
                          />
                          <button
                            onClick={() => saveEdit(p.product_code)}
                            className="p-1 text-success hover:bg-success/10 rounded"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setEditingCode(null)}
                            className="p-1 text-slate-400 hover:bg-slate-700 rounded"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <span
                          onClick={() => startEdit(p)}
                          className={`cursor-pointer hover:text-primary transition-colors ${
                            p.cost_price === null ? "text-danger" : "text-slate-300"
                          }`}
                        >
                          {fmtMoney(p.cost_price)}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-center">
                      {p.no_commission === 1 && (
                        <span className="text-warning text-xs">ไม่คิด</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-700">
            <span className="text-xs text-slate-400">
              หน้า {page} จาก {totalPages}
            </span>
            <div className="flex gap-1">
              <button
                onClick={() => setPage(page - 1)}
                disabled={page <= 1}
                className="px-3 py-1.5 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                ก่อนหน้า
              </button>
              <button
                onClick={() => setPage(page + 1)}
                disabled={page >= totalPages}
                className="px-3 py-1.5 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                ถัดไป
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
