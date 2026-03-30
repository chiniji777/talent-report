import { useState } from "react";
import { Upload, CheckCircle, AlertCircle, Sparkles } from "lucide-react";
import { FileDropzone } from "../components/FileDropzone";
import { api } from "../api";
import type { ImportPreview, ImportResult } from "../types";

export function ImportPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<ImportPreview[]>([]);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [step, setStep] = useState<"upload" | "preview" | "done">("upload");

  const handleFiles = (selected: File[]) => {
    setFiles(selected);
    setResult(null);
    setError("");
    if (selected.length === 0) {
      setPreviews([]);
      setStep("upload");
    }
  };

  const handlePreview = async () => {
    if (files.length === 0) return;
    setLoading(true);
    setError("");
    try {
      const fd = new FormData();
      files.forEach((f) => fd.append("files", f));
      const data = await api.upload<ImportPreview[]>("/api/import/preview", fd);
      setPreviews(data);
      setStep("preview");
    } catch (e) {
      setError(e instanceof Error ? e.message : "เกิดข้อผิดพลาด");
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    setLoading(true);
    setError("");
    try {
      const fd = new FormData();
      files.forEach((f) => fd.append("files", f));
      const data = await api.upload<ImportResult>("/api/import", fd);
      setResult(data);
      setStep("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "เกิดข้อผิดพลาด");
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setFiles([]);
    setPreviews([]);
    setResult(null);
    setError("");
    setStep("upload");
  };

  const fmtMoney = (n: number) =>
    n.toLocaleString("th-TH", { minimumFractionDigits: 2 });

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h2 className="text-xl font-bold gradient-text animate-fade-in-up">นำเข้าข้อมูล</h2>

      {error && (
        <div className="flex items-center gap-2 rounded-xl px-4 py-3 text-sm animate-fade-in" style={{
          background: "rgba(239, 68, 68, 0.06)",
          border: "1px solid rgba(239, 68, 68, 0.12)",
          color: "#f87171"
        }}>
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {step === "upload" && (
        <div className="animate-fade-in-up stagger-1">
          <FileDropzone onFiles={handleFiles} accept=".csv" />
          {files.length > 0 && (
            <button
              onClick={handlePreview}
              disabled={loading}
              className="mt-4 text-white px-6 py-2.5 rounded-xl text-sm font-medium transition-all disabled:opacity-50 flex items-center gap-2 btn-press hover:shadow-lg"
              style={{
                background: "linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)",
                boxShadow: "0 4px 12px rgba(59, 130, 246, 0.25)"
              }}
            >
              <Upload className="w-4 h-4" />
              {loading ? "กำลังตรวจสอบ..." : "ตรวจสอบไฟล์"}
            </button>
          )}
        </div>
      )}

      {step === "preview" && (
        <div className="animate-fade-in-up">
          <div className="glass-card overflow-hidden">
            <div className="px-5 py-4" style={{ borderBottom: "1px solid rgba(148, 163, 184, 0.06)" }}>
              <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
                ผลตรวจสอบไฟล์
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(148, 163, 184, 0.06)" }}>
                    <th className="px-4 py-2.5 text-left text-[11px] text-slate-500 font-medium">ไฟล์</th>
                    <th className="px-4 py-2.5 text-left text-[11px] text-slate-500 font-medium">พนักงาน</th>
                    <th className="px-4 py-2.5 text-left text-[11px] text-slate-500 font-medium">งวด</th>
                    <th className="px-4 py-2.5 text-right text-[11px] text-slate-500 font-medium">ใหม่</th>
                    <th className="px-4 py-2.5 text-right text-[11px] text-slate-500 font-medium">ซ้ำ</th>
                    <th className="px-4 py-2.5 text-right text-[11px] text-slate-500 font-medium">อัพเดทชำระ</th>
                    <th className="px-4 py-2.5 text-right text-[11px] text-slate-500 font-medium">ยอดรวม</th>
                    <th className="px-4 py-2.5 text-right text-[11px] text-slate-500 font-medium">ข้อมูลต่าง</th>
                  </tr>
                </thead>
                <tbody>
                  {previews.map((p, i) => (
                    <tr key={i} className="table-row-hover" style={{ borderBottom: "1px solid rgba(148, 163, 184, 0.03)" }}>
                      <td className="px-4 py-2.5 text-slate-300 truncate max-w-40">{p.filename}</td>
                      <td className="px-4 py-2.5 text-slate-300">{p.salesperson}</td>
                      <td className="px-4 py-2.5 text-slate-500">{p.period}</td>
                      <td className="px-4 py-2.5 text-right text-emerald-400 font-medium">{p.new_count}</td>
                      <td className="px-4 py-2.5 text-right text-amber-400">{p.duplicate_count}</td>
                      <td className="px-4 py-2.5 text-right text-blue-400">{p.paid_update_count || 0}</td>
                      <td className="px-4 py-2.5 text-right text-slate-300 font-medium">{fmtMoney(p.total_amount)}</td>
                      <td className="px-4 py-2.5 text-right">
                        {(p.mismatch_count || 0) > 0 ? (
                          <span className="text-red-400 text-xs">{p.mismatch_count} รายการ</span>
                        ) : <span className="text-slate-600">-</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button
              onClick={handleImport}
              disabled={loading}
              className="text-white px-6 py-2.5 rounded-xl text-sm font-medium transition-all disabled:opacity-50 flex items-center gap-2 btn-press hover:shadow-lg"
              style={{
                background: "linear-gradient(135deg, #22c55e 0%, #10b981 100%)",
                boxShadow: "0 4px 12px rgba(34, 197, 94, 0.25)"
              }}
            >
              <CheckCircle className="w-4 h-4" />
              {loading ? "กำลังนำเข้า..." : "ยืนยันนำเข้า"}
            </button>
            <button
              onClick={reset}
              className="glass-card-sm px-6 py-2.5 text-sm text-slate-400 hover:text-white transition-colors"
            >
              ยกเลิก
            </button>
          </div>
        </div>
      )}

      {step === "done" && result && (
        <div className="glass-card gradient-border p-8 text-center animate-fade-in-up">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{
            background: "linear-gradient(135deg, rgba(34, 197, 94, 0.15) 0%, rgba(16, 185, 129, 0.08) 100%)"
          }}>
            <Sparkles className="w-8 h-8 text-emerald-400" />
          </div>
          <h3 className="text-lg font-bold mb-5 gradient-text">นำเข้าเสร็จสิ้น</h3>
          <div className="flex justify-center gap-10 text-sm">
            <div>
              <div className="text-3xl font-bold text-emerald-400">{result.imported}</div>
              <div className="text-slate-500 mt-1">นำเข้าสำเร็จ</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-amber-400">{result.skipped}</div>
              <div className="text-slate-500 mt-1">ข้ามรายการซ้ำ</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-blue-400">{result.paid_updated || 0}</div>
              <div className="text-slate-500 mt-1">อัพเดทการชำระ</div>
            </div>
          </div>
          {result.errors.length > 0 && (
            <div className="mt-5 rounded-xl p-3 text-left" style={{
              background: "rgba(239, 68, 68, 0.06)",
              border: "1px solid rgba(239, 68, 68, 0.1)"
            }}>
              <p className="text-red-400 text-sm font-medium mb-1">ข้อผิดพลาด:</p>
              {result.errors.map((e, i) => (
                <p key={i} className="text-red-400/70 text-xs">{e}</p>
              ))}
            </div>
          )}
          {(result.warnings || []).length > 0 && (
            <div className="mt-5 rounded-xl p-3 text-left" style={{
              background: "rgba(245, 158, 11, 0.06)",
              border: "1px solid rgba(245, 158, 11, 0.1)"
            }}>
              <p className="text-amber-400 text-sm font-medium mb-1">ข้อมูลที่ต่างกัน ({result.warning_count || result.warnings.length} รายการ):</p>
              <p className="text-amber-400/60 text-[11px] mb-2">อัพเดทเฉพาะสถานะชำระเงินเท่านั้น — ค่าอื่นๆ ไม่เปลี่ยนแปลง</p>
              {result.warnings.slice(0, 20).map((w: string, i: number) => (
                <p key={i} className="text-amber-400/70 text-xs">{w}</p>
              ))}
              {(result.warning_count || result.warnings.length) > 20 && (
                <p className="text-amber-400/50 text-xs mt-1">...และอีก {(result.warning_count || result.warnings.length) - 20} รายการ</p>
              )}
            </div>
          )}
          <button
            onClick={reset}
            className="mt-6 text-white px-6 py-2.5 rounded-xl text-sm transition-all btn-press hover:shadow-lg"
            style={{
              background: "linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)",
              boxShadow: "0 4px 12px rgba(59, 130, 246, 0.25)"
            }}
          >
            นำเข้าเพิ่มเติม
          </button>
        </div>
      )}
    </div>
  );
}
