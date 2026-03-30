import { useState, useEffect, useCallback, useRef } from "react";
import { Package, DollarSign, AlertTriangle, Upload, Download, Save, X, Undo2 } from "lucide-react";
import { StatCard } from "../components/StatCard";
import { api } from "../api";
import type { CostProduct, CostSummary, CostsProductsResponse } from "../types";

type FilterTab = "all" | "has_cost" | "no_cost" | "no_commission";

interface EditableProduct extends CostProduct {
  dirty?: boolean;
}

export function CostsPage() {
  const [products, setProducts] = useState<EditableProduct[]>([]);
  const [summary, setSummary] = useState<CostSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [filterTab, setFilterTab] = useState<FilterTab>("all");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [hasChanges, setHasChanges] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [activeRow, setActiveRow] = useState(0);
  const tableRef = useRef<HTMLTableSectionElement>(null);

  const fetchProducts = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), per_page: "100" });
    if (filterTab !== "all") params.set("filter", filterTab);
    api.get<CostsProductsResponse>(`/api/costs/products?${params}`).then((res) => {
      setProducts(res.products.map(p => ({ ...p, dirty: false })));
      setTotalPages(res.total_pages);
      setHasChanges(false);
      setActiveRow(0);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [filterTab, page]);

  const fetchSummary = () => {
    api.get<CostSummary>("/api/costs/summary").then(setSummary).catch(() => {});
  };

  useEffect(() => { fetchProducts(); }, [fetchProducts]);
  useEffect(() => { fetchSummary(); }, []);

  // Keyboard navigation: Arrow Up/Down to move rows, F5 to toggle commission
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (products.length === 0) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveRow(prev => {
          const next = Math.min(prev + 1, products.length - 1);
          // Focus the cost_price input of the new row
          setTimeout(() => {
            const row = tableRef.current?.children[next] as HTMLTableRowElement;
            const input = row?.querySelector("input[data-field=\"cost_price\"]") as HTMLInputElement;
            input?.focus();
          }, 0);
          return next;
        });
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveRow(prev => {
          const next = Math.max(prev - 1, 0);
          setTimeout(() => {
            const row = tableRef.current?.children[next] as HTMLTableRowElement;
            const input = row?.querySelector("input[data-field=\"cost_price\"]") as HTMLInputElement;
            input?.focus();
          }, 0);
          return next;
        });
      } else if (e.key === "F4") {
        e.preventDefault();
        const p = products[activeRow];
        if (p) toggleCommission(p.product_code);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [products, activeRow]);

  // Scroll active row into view
  useEffect(() => {
    if (tableRef.current && products.length > 0) {
      const row = tableRef.current.children[activeRow] as HTMLElement;
      row?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [activeRow, products.length]);

  const updateField = (code: string, field: string, value: any) => {
    setProducts(prev => prev.map(p => {
      if (p.product_code !== code) return p;
      return { ...p, [field]: value, dirty: true };
    }));
    setHasChanges(true);
    setSaveMsg("");
  };

  const toggleCommission = (code: string) => {
    setProducts(prev => prev.map(p => {
      if (p.product_code !== code) return p;
      return { ...p, no_commission: p.no_commission === 1 ? 0 : 1, dirty: true };
    }));
    setHasChanges(true);
    setSaveMsg("");
  };

  const saveAll = async () => {
    const dirtyItems = products.filter(p => p.dirty);
    if (dirtyItems.length === 0) return;

    setSaving(true);
    try {
      const costUpdates = dirtyItems.map(p => ({
        code: p.product_code,
        name: p.name,
        unit: p.unit,
        std_price: p.cost_price,
        no_commission: p.no_commission,
      }));
      await api.put("/api/costs/products/batch", costUpdates);

      setProducts(prev => prev.map(p => ({ ...p, dirty: false })));
      setHasChanges(false);
      setSaveMsg(`บันทึก ${dirtyItems.length} รายการสำเร็จ`);
      fetchSummary();
      setTimeout(() => setSaveMsg(""), 3000);
    } catch {
      setSaveMsg("เกิดข้อผิดพลาด กรุณาลองใหม่");
    } finally {
      setSaving(false);
    }
  };

  const discardChanges = () => {
    fetchProducts();
    setSaveMsg("");
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    try { await api.upload("/api/costs/import", fd); fetchProducts(); fetchSummary(); } catch { /* */ }
    e.target.value = "";
  };

  const handleExport = async () => {
    const token = localStorage.getItem("token");
    const res = await fetch("/api/costs/export", { headers: { Authorization: `Bearer ${token}` } });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "costs.xlsx"; a.click();
    URL.revokeObjectURL(url);
  };

  const handleRowFocus = (idx: number) => {
    setActiveRow(idx);
  };

  const dirtyCount = products.filter(p => p.dirty).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3 animate-fade-in-up">
        <h2 className="text-xl font-bold gradient-text">จัดการต้นทุน</h2>
        <div className="flex gap-2">
          <label className="flex items-center gap-2 text-white px-4 py-2 rounded-xl text-sm cursor-pointer transition-all btn-press hover:shadow-lg" style={{
            background: "linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)", boxShadow: "0 4px 12px rgba(59, 130, 246, 0.2)"
          }}>
            <Upload className="w-4 h-4" />Import Excel
            <input type="file" accept=".xlsx,.xls" onChange={handleImport} className="hidden" />
          </label>
          <button onClick={handleExport} className="flex items-center gap-2 text-white px-4 py-2 rounded-xl text-sm transition-all btn-press hover:shadow-lg" style={{
            background: "linear-gradient(135deg, #22c55e 0%, #10b981 100%)", boxShadow: "0 4px 12px rgba(34, 197, 94, 0.2)"
          }}>
            <Download className="w-4 h-4" />Export
          </button>
        </div>
      </div>

      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 animate-fade-in-up stagger-1">
          <StatCard icon={Package} label="สินค้าทั้งหมด" value={summary.product_count} />
          <StatCard icon={DollarSign} label="มีต้นทุน" value={summary.item_codes_with_cost} color="success" />
          <StatCard icon={AlertTriangle} label="ไม่มีต้นทุน" value={summary.item_codes_missing} color="danger" />
          <StatCard icon={X} label="ไม่คิดคอม" value={summary.no_commission_count} color="warning" />
        </div>
      )}

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="flex gap-1 glass-card-sm p-1 w-fit animate-fade-in-up stagger-2">
            {(["all", "has_cost", "no_cost", "no_commission"] as FilterTab[]).map((key) => {
              const labels = { all: "ทั้งหมด", has_cost: "มีต้นทุน", no_cost: "ไม่มีต้นทุน", no_commission: "ไม่คิดคอม" };
              return (
                <button key={key} onClick={() => { setFilterTab(key); setPage(1); }}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                    filterTab === key ? "text-white" : "text-slate-500 hover:text-slate-300"
                  }`}
                  style={filterTab === key ? {
                    background: "linear-gradient(135deg, rgba(59, 130, 246, 0.2) 0%, rgba(99, 102, 241, 0.15) 100%)",
                    boxShadow: "0 0 12px rgba(59, 130, 246, 0.1)"
                  } : undefined}
                >{labels[key]}</button>
              );
            })}
          </div>
          <span className="text-[10px] text-slate-600 hidden lg:block">↑↓ เลื่อนแถว • F4 สลับไม่คิดคอม</span>
        </div>

        {hasChanges && (
          <div className="flex items-center gap-2 animate-fade-in">
            <span className="text-xs text-amber-400">{dirtyCount} รายการที่แก้ไข</span>
            <button onClick={discardChanges}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-slate-400 hover:text-white transition-colors"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(148,163,184,0.1)" }}>
              <Undo2 className="w-3.5 h-3.5" />ยกเลิก
            </button>
            <button onClick={saveAll} disabled={saving}
              className="flex items-center gap-1.5 text-white px-4 py-1.5 rounded-lg text-sm font-medium transition-all disabled:opacity-50 btn-press"
              style={{
                background: "linear-gradient(135deg, #22c55e 0%, #10b981 100%)",
                boxShadow: "0 4px 12px rgba(34, 197, 94, 0.25)"
              }}>
              <Save className="w-3.5 h-3.5" />
              {saving ? "กำลังบันทึก..." : "บันทึกทั้งหมด"}
            </button>
          </div>
        )}
        {saveMsg && !hasChanges && (
          <span className="text-xs text-emerald-400 animate-fade-in">{saveMsg}</span>
        )}
      </div>

      <div className="glass-card overflow-hidden animate-fade-in-up stagger-3">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(148, 163, 184, 0.06)" }}>
                <th className="px-4 py-3.5 text-left text-[11px] text-slate-500 font-medium uppercase tracking-wider w-32">รหัส</th>
                <th className="px-4 py-3.5 text-left text-[11px] text-slate-500 font-medium uppercase tracking-wider">ชื่อสินค้า</th>
                <th className="px-4 py-3.5 text-left text-[11px] text-slate-500 font-medium uppercase tracking-wider w-24">หน่วย</th>
                <th className="px-4 py-3.5 text-right text-[11px] text-slate-500 font-medium uppercase tracking-wider w-36">ราคาต้นทุน</th>
                <th className="px-4 py-3.5 text-center text-[11px] text-slate-500 font-medium uppercase tracking-wider w-28">ไม่คิดคอม</th>
              </tr>
            </thead>
            <tbody ref={tableRef}>
              {loading ? (
                <tr><td colSpan={5} className="px-4 py-16 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
                    <span className="text-slate-500 text-sm">กำลังโหลด...</span>
                  </div>
                </td></tr>
              ) : products.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-16 text-center text-slate-500">ไม่พบข้อมูล</td></tr>
              ) : products.map((p, idx) => (
                <tr key={p.product_code}
                  className="table-row-hover"
                  style={{
                    borderBottom: "1px solid rgba(148, 163, 184, 0.03)",
                    ...(idx === activeRow
                      ? { background: "rgba(59, 130, 246, 0.08)", boxShadow: "inset 3px 0 0 #3b82f6" }
                      : p.dirty
                        ? { background: "rgba(59, 130, 246, 0.03)" }
                        : {}
                    )
                  }}
                  onClick={() => handleRowFocus(idx)}
                >
                  <td className="px-4 py-2 text-slate-400 font-mono text-xs">{p.product_code}</td>
                  <td className="px-4 py-2">
                    <input
                      type="text"
                      data-field="name"
                      value={p.name || ""}
                      onChange={(e) => updateField(p.product_code, "name", e.target.value)}
                      onFocus={() => setActiveRow(idx)}
                      className="w-full bg-transparent text-slate-300 text-sm border-0 outline-none focus:ring-1 focus:ring-blue-500/30 rounded px-1 py-0.5 -mx-1 transition-all"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="text"
                      data-field="unit"
                      value={p.unit || ""}
                      onChange={(e) => updateField(p.product_code, "unit", e.target.value)}
                      onFocus={() => setActiveRow(idx)}
                      className="w-full bg-transparent text-slate-500 text-sm border-0 outline-none focus:ring-1 focus:ring-blue-500/30 rounded px-1 py-0.5 -mx-1 transition-all"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="number"
                      step="0.01"
                      data-field="cost_price"
                      value={p.cost_price ?? ""}
                      onChange={(e) => updateField(p.product_code, "cost_price", e.target.value === "" ? null : parseFloat(e.target.value))}
                      onFocus={() => setActiveRow(idx)}
                      className={`w-full bg-transparent text-right text-sm border-0 outline-none focus:ring-1 focus:ring-blue-500/30 rounded px-1 py-0.5 transition-all ${
                        p.cost_price === null ? "text-red-400 placeholder:text-red-400/40" : "text-slate-300"
                      }`}
                      placeholder="ยังไม่มี"
                    />
                  </td>
                  <td className="px-4 py-2 text-center">
                    <button
                      onClick={() => toggleCommission(p.product_code)}
                      tabIndex={-1}
                      className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none"
                      style={{
                        background: p.no_commission === 1
                          ? "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)"
                          : "rgba(148, 163, 184, 0.15)"
                      }}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-md transition-transform duration-200 ${
                          p.no_commission === 1 ? "translate-x-6" : "translate-x-1"
                        }`}
                      />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between px-4 py-3" style={{ borderTop: "1px solid rgba(148, 163, 184, 0.06)" }}>
          <span className="text-xs text-slate-500">หน้า {page} จาก {totalPages} • แถว {activeRow + 1}/{products.length}</span>
          <div className="flex items-center gap-3">
            {hasChanges && (
              <button onClick={saveAll} disabled={saving}
                className="flex items-center gap-1.5 text-white px-4 py-1.5 rounded-lg text-sm font-medium transition-all disabled:opacity-50 btn-press"
                style={{
                  background: "linear-gradient(135deg, #22c55e 0%, #10b981 100%)",
                  boxShadow: "0 4px 12px rgba(34, 197, 94, 0.25)"
                }}>
                <Save className="w-3.5 h-3.5" />
                {saving ? "บันทึก..." : `บันทึก (${dirtyCount})`}
              </button>
            )}
            <div className="flex gap-1">
              <button onClick={() => setPage(page - 1)} disabled={page <= 1}
                className="px-3 py-1.5 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-white/[0.05] disabled:opacity-30 disabled:cursor-not-allowed transition-colors">ก่อนหน้า</button>
              <button onClick={() => setPage(page + 1)} disabled={page >= totalPages}
                className="px-3 py-1.5 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-white/[0.05] disabled:opacity-30 disabled:cursor-not-allowed transition-colors">ถัดไป</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
