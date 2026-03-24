import { useState } from "react";
import { Upload, CheckCircle, AlertCircle } from "lucide-react";
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
      <h2 className="text-xl font-bold">นำเข้าข้อมูล</h2>

      {error && (
        <div className="flex items-center gap-2 bg-danger/10 border border-danger/30 text-danger rounded-lg px-4 py-3 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {step === "upload" && (
        <>
          <FileDropzone onFiles={handleFiles} accept=".csv" />
          {files.length > 0 && (
            <button
              onClick={handlePreview}
              disabled={loading}
              className="bg-primary hover:bg-primary-hover text-white px-6 py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              <Upload className="w-4 h-4" />
              {loading ? "กำลังตรวจสอบ..." : "ตรวจสอบไฟล์"}
            </button>
          )}
        </>
      )}

      {step === "preview" && (
        <>
          <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-700">
              <h3 className="text-sm font-medium text-slate-400">
                ผลตรวจสอบไฟล์
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="px-4 py-2 text-left text-xs text-slate-500">
                      ไฟล์
                    </th>
                    <th className="px-4 py-2 text-left text-xs text-slate-500">
                      พนักงาน
                    </th>
                    <th className="px-4 py-2 text-left text-xs text-slate-500">
                      งวด
                    </th>
                    <th className="px-4 py-2 text-right text-xs text-slate-500">
                      ใหม่
                    </th>
                    <th className="px-4 py-2 text-right text-xs text-slate-500">
                      ซ้ำ
                    </th>
                    <th className="px-4 py-2 text-right text-xs text-slate-500">
                      ยอดรวม
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {previews.map((p, i) => (
                    <tr key={i} className="border-b border-slate-700/50">
                      <td className="px-4 py-2 text-slate-300 truncate max-w-40">
                        {p.filename}
                      </td>
                      <td className="px-4 py-2 text-slate-300">
                        {p.salesperson}
                      </td>
                      <td className="px-4 py-2 text-slate-400">{p.period}</td>
                      <td className="px-4 py-2 text-right text-success">
                        {p.new_count}
                      </td>
                      <td className="px-4 py-2 text-right text-warning">
                        {p.duplicate_count}
                      </td>
                      <td className="px-4 py-2 text-right text-slate-300">
                        {fmtMoney(p.total_amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleImport}
              disabled={loading}
              className="bg-success hover:bg-green-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              <CheckCircle className="w-4 h-4" />
              {loading ? "กำลังนำเข้า..." : "ยืนยันนำเข้า"}
            </button>
            <button
              onClick={reset}
              className="bg-slate-700 hover:bg-slate-600 text-white px-6 py-2.5 rounded-lg text-sm transition-colors"
            >
              ยกเลิก
            </button>
          </div>
        </>
      )}

      {step === "done" && result && (
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 text-center">
          <CheckCircle className="w-12 h-12 text-success mx-auto mb-3" />
          <h3 className="text-lg font-semibold mb-4">นำเข้าเสร็จสิ้น</h3>
          <div className="flex justify-center gap-8 text-sm">
            <div>
              <div className="text-2xl font-bold text-success">
                {result.imported}
              </div>
              <div className="text-slate-400">นำเข้าสำเร็จ</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-warning">
                {result.skipped}
              </div>
              <div className="text-slate-400">ข้ามรายการซ้ำ</div>
            </div>
          </div>
          {result.errors.length > 0 && (
            <div className="mt-4 bg-danger/10 rounded-lg p-3 text-left">
              <p className="text-danger text-sm font-medium mb-1">ข้อผิดพลาด:</p>
              {result.errors.map((e, i) => (
                <p key={i} className="text-danger/80 text-xs">
                  {e}
                </p>
              ))}
            </div>
          )}
          <button
            onClick={reset}
            className="mt-6 bg-primary hover:bg-primary-hover text-white px-6 py-2.5 rounded-lg text-sm transition-colors"
          >
            นำเข้าเพิ่มเติม
          </button>
        </div>
      )}
    </div>
  );
}
