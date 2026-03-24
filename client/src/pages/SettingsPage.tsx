import { useState, useEffect } from "react";
import {
  Database,
  Save,
  RotateCcw,
  Download,
  Upload,
  HardDrive,
  AlertCircle,
  CheckCircle,
} from "lucide-react";
import { api } from "../api";

interface BackupEntry {
  slot: number;
  filename: string;
  exists: boolean;
  size?: number;
  modified?: string;
  isCurrent?: boolean;
}

interface BackupsResponse {
  backups: BackupEntry[];
  meta: { last_date: string; last_slot: number };
  preRestore: { size: number; modified: string } | null;
  currentDbSize: number;
}

const fmtSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export function SettingsPage() {
  const [data, setData] = useState<BackupsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState("");
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const fetchData = () => {
    setLoading(true);
    api
      .get<BackupsResponse>("/api/db/backups")
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchData();
  }, []);

  const showMessage = (type: "success" | "error", text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  const handleBackup = async () => {
    setActionLoading("backup");
    try {
      await api.post("/api/db/backup");
      showMessage("success", "สำรองข้อมูลเรียบร้อยแล้ว");
      fetchData();
    } catch (e) {
      showMessage("error", e instanceof Error ? e.message : "เกิดข้อผิดพลาด");
    } finally {
      setActionLoading("");
    }
  };

  const handleRestore = async (slot: number) => {
    if (!confirm(`คุณต้องการกู้คืนข้อมูลจาก Slot ${slot} ใช่หรือไม่?`)) return;
    setActionLoading(`restore-${slot}`);
    try {
      await api.post(`/api/db/restore/${slot}`);
      showMessage("success", `กู้คืนข้อมูลจาก Slot ${slot} เรียบร้อยแล้ว`);
      fetchData();
    } catch (e) {
      showMessage("error", e instanceof Error ? e.message : "เกิดข้อผิดพลาด");
    } finally {
      setActionLoading("");
    }
  };

  const handleExport = async () => {
    const token = localStorage.getItem("token");
    const res = await fetch("/api/db/export", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "database-export.db";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportDb = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!confirm("การนำเข้าจะแทนที่ฐานข้อมูลปัจจุบัน ต้องการดำเนินการต่อ?"))
      return;
    const fd = new FormData();
    fd.append("file", file);
    try {
      await api.upload("/api/db/import", fd);
      showMessage("success", "นำเข้าฐานข้อมูลเรียบร้อยแล้ว");
      fetchData();
    } catch (e) {
      showMessage(
        "error",
        e instanceof Error ? e.message : "เกิดข้อผิดพลาด"
      );
    }
    e.target.value = "";
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h2 className="text-xl font-bold">ตั้งค่า</h2>

      {message && (
        <div
          className={`flex items-center gap-2 rounded-lg px-4 py-3 text-sm ${
            message.type === "success"
              ? "bg-success/10 border border-success/30 text-success"
              : "bg-danger/10 border border-danger/30 text-danger"
          }`}
        >
          {message.type === "success" ? (
            <CheckCircle className="w-4 h-4 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0" />
          )}
          {message.text}
        </div>
      )}

      {/* DB Info */}
      {data && (
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
          <div className="flex items-center gap-3 mb-3">
            <HardDrive className="w-5 h-5 text-primary" />
            <h3 className="font-medium">ข้อมูลฐานข้อมูล</h3>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-slate-500">ขนาดฐานข้อมูล</p>
              <p className="text-slate-200">{fmtSize(data.currentDbSize)}</p>
            </div>
            <div>
              <p className="text-slate-500">สำรองล่าสุด</p>
              <p className="text-slate-200">
                {data.meta.last_date || "ยังไม่เคยสำรอง"}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Backup */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Database className="w-5 h-5 text-primary" />
            <h3 className="font-medium">สำรองข้อมูล</h3>
          </div>
          <button
            onClick={handleBackup}
            disabled={actionLoading === "backup"}
            className="flex items-center gap-2 bg-primary hover:bg-primary-hover text-white px-4 py-2 rounded-lg text-sm transition-colors disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {actionLoading === "backup" ? "กำลังสำรอง..." : "สำรองตอนนี้"}
          </button>
        </div>

        {loading ? (
          <p className="text-slate-400 text-sm">กำลังโหลด...</p>
        ) : (
          <div className="space-y-2">
            {(data?.backups || []).map((b) => (
              <div
                key={b.slot}
                className="flex items-center justify-between bg-slate-900 rounded-lg px-4 py-3"
              >
                <div>
                  <p className="text-sm text-slate-300">
                    Slot {b.slot} — {b.filename}
                    {b.isCurrent && (
                      <span className="ml-2 text-xs text-primary">(ล่าสุด)</span>
                    )}
                  </p>
                  <p className="text-xs text-slate-500">
                    {b.exists
                      ? `${fmtSize(b.size || 0)} • ${
                          b.modified
                            ? new Date(b.modified).toLocaleString("th-TH")
                            : ""
                        }`
                      : "ว่าง"}
                  </p>
                </div>
                {b.exists && (
                  <button
                    onClick={() => handleRestore(b.slot)}
                    disabled={actionLoading === `restore-${b.slot}`}
                    className="flex items-center gap-1.5 bg-warning/10 hover:bg-warning/20 text-warning px-3 py-1.5 rounded-lg text-xs transition-colors disabled:opacity-50"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    {actionLoading === `restore-${b.slot}`
                      ? "กำลังกู้คืน..."
                      : "กู้คืน"}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Export / Import */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
        <div className="flex items-center gap-3 mb-4">
          <Database className="w-5 h-5 text-primary" />
          <h3 className="font-medium">นำเข้า / ส่งออก ฐานข้อมูล</h3>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleExport}
            className="flex items-center gap-2 bg-success hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm transition-colors"
          >
            <Download className="w-4 h-4" />
            Export DB
          </button>
          <label className="flex items-center gap-2 bg-warning hover:bg-amber-600 text-white px-4 py-2 rounded-lg text-sm cursor-pointer transition-colors">
            <Upload className="w-4 h-4" />
            Import DB
            <input
              type="file"
              accept=".db,.sqlite"
              onChange={handleImportDb}
              className="hidden"
            />
          </label>
        </div>
      </div>
    </div>
  );
}
