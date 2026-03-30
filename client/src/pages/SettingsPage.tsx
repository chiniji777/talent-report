import { useState, useEffect } from "react";
import { Database, Save, RotateCcw, Download, Upload, HardDrive, AlertCircle, CheckCircle, UserPlus, Trash2, Key, Type } from "lucide-react";
import { api } from "../api";
import { useAuth } from "../contexts/AuthContext";

interface BackupEntry { slot: number; filename: string; exists: boolean; size?: number; modified?: string; isCurrent?: boolean; }
interface BackupsResponse { backups: BackupEntry[]; meta: { last_date: string; last_slot: number }; preRestore: { size: number; modified: string } | null; currentDbSize: number; }
interface UserEntry { id: number; username: string; display_name: string; role: string; created_at: string; }

const fmtSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const FONT_SIZES = [
  { label: "เล็ก", value: "text-xs", size: 12 },
  { label: "ปกติ", value: "text-sm", size: 14 },
  { label: "กลาง", value: "text-base", size: 16 },
  { label: "ใหญ่", value: "text-lg", size: 18 },
  { label: "ใหญ่มาก", value: "text-xl", size: 20 },
];

export function SettingsPage() {
  const { isAdmin } = useAuth();
  const [data, setData] = useState<BackupsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState("");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Font size
  const [fontSize, setFontSize] = useState(() => localStorage.getItem("talent-font-size") || "14");

  // Password change
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");

  // User management (admin)
  const [users, setUsers] = useState<UserEntry[]>([]);
  const [newUsername, setNewUsername] = useState("");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [newUserPw, setNewUserPw] = useState("");
  const [resetPwUserId, setResetPwUserId] = useState<number | null>(null);
  const [resetPwValue, setResetPwValue] = useState("");

  const fetchData = () => {
    if (isAdmin) {
      setLoading(true);
      api.get<BackupsResponse>("/api/db/backups").then(setData).catch(() => {}).finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  };
  const fetchUsers = () => {
    if (isAdmin) {
      api.get<{ users: UserEntry[] }>("/api/auth/users").then((r) => setUsers(r.users)).catch(() => {});
    }
  };

  useEffect(() => { fetchData(); fetchUsers(); }, []);

  const showMessage = (type: "success" | "error", text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  };

  // Font size change
  const handleFontSize = (size: string) => {
    setFontSize(size);
    localStorage.setItem("talent-font-size", size);
    document.documentElement.style.fontSize = size + "px";
  };

  // Password change
  const handleChangePassword = async () => {
    if (newPw !== confirmPw) { showMessage("error", "รหัสผ่านใหม่ไม่ตรงกัน"); return; }
    if (newPw.length < 4) { showMessage("error", "รหัสผ่านต้องมีอย่างน้อย 4 ตัวอักษร"); return; }
    try {
      await api.post("/api/auth/change-password", { current_password: currentPw, new_password: newPw });
      showMessage("success", "เปลี่ยนรหัสผ่านเรียบร้อยแล้ว");
      setCurrentPw(""); setNewPw(""); setConfirmPw("");
    } catch (e: any) { showMessage("error", e.message || "เกิดข้อผิดพลาด"); }
  };

  // Create user (admin)
  const handleCreateUser = async () => {
    if (!newUsername || !newUserPw) { showMessage("error", "กรอก username และรหัสผ่าน"); return; }
    try {
      await api.post("/api/auth/users", { username: newUsername, password: newUserPw, display_name: newDisplayName || newUsername });
      showMessage("success", `สร้าง ${newUsername} เรียบร้อยแล้ว`);
      setNewUsername(""); setNewDisplayName(""); setNewUserPw("");
      fetchUsers();
    } catch (e: any) { showMessage("error", e.message || "เกิดข้อผิดพลาด"); }
  };

  // Delete user (admin)
  const handleDeleteUser = async (id: number, name: string) => {
    if (!confirm(`ลบผู้ใช้ "${name}" ?`)) return;
    try {
      await api.delete(`/api/auth/users/${id}`);
      showMessage("success", `ลบ ${name} แล้ว`);
      fetchUsers();
    } catch (e: any) { showMessage("error", e.message || "เกิดข้อผิดพลาด"); }
  };

  // Reset password (admin)
  const handleResetPassword = async (id: number) => {
    if (resetPwValue.length < 4) { showMessage("error", "รหัสผ่านต้องมีอย่างน้อย 4 ตัวอักษร"); return; }
    try {
      await api.post(`/api/auth/users/${id}/reset-password`, { new_password: resetPwValue });
      showMessage("success", "รีเซ็ตรหัสผ่านเรียบร้อย");
      setResetPwUserId(null); setResetPwValue("");
    } catch (e: any) { showMessage("error", e.message || "เกิดข้อผิดพลาด"); }
  };

  // Backup handlers (admin only)
  const handleBackup = async () => {
    setActionLoading("backup");
    try { await api.post("/api/db/backup"); showMessage("success", "สำรองข้อมูลเรียบร้อยแล้ว"); fetchData(); }
    catch (e: any) { showMessage("error", e.message || "เกิดข้อผิดพลาด"); }
    finally { setActionLoading(""); }
  };
  const handleRestore = async (slot: number) => {
    if (!confirm(`กู้คืนจาก Slot ${slot} ?`)) return;
    setActionLoading(`restore-${slot}`);
    try { await api.post(`/api/db/restore/${slot}`); showMessage("success", `กู้คืน Slot ${slot} แล้ว`); fetchData(); }
    catch (e: any) { showMessage("error", e.message || "เกิดข้อผิดพลาด"); }
    finally { setActionLoading(""); }
  };
  const handleExport = async () => {
    const token = localStorage.getItem("token");
    const res = await fetch("/api/db/export", { headers: { Authorization: `Bearer ${token}` } });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "database-export.db"; a.click();
    URL.revokeObjectURL(url);
  };
  const handleImportDb = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!confirm("การนำเข้าจะแทนที่ฐานข้อมูลปัจจุบัน ต้องการดำเนินการต่อ?")) return;
    const fd = new FormData(); fd.append("file", file);
    try { await api.upload("/api/db/import", fd); showMessage("success", "นำเข้าฐานข้อมูลแล้ว"); fetchData(); }
    catch (e: any) { showMessage("error", e.message || "เกิดข้อผิดพลาด"); }
    (e.target as HTMLInputElement).value = "";
  };

  const inputStyle = "w-full rounded-xl px-3 py-2.5 text-sm text-slate-300 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500/30 transition-all";
  const inputBg = { background: "rgba(15, 23, 42, 0.5)", border: "1px solid rgba(148, 163, 184, 0.08)" };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h2 className="text-xl font-bold gradient-text animate-fade-in-up">ตั้งค่า</h2>

      {message && (
        <div className="flex items-center gap-2 rounded-xl px-4 py-3 text-sm animate-fade-in" style={{
          background: message.type === "success" ? "rgba(34, 197, 94, 0.06)" : "rgba(239, 68, 68, 0.06)",
          border: `1px solid ${message.type === "success" ? "rgba(34, 197, 94, 0.15)" : "rgba(239, 68, 68, 0.15)"}`,
          color: message.type === "success" ? "#4ade80" : "#f87171"
        }}>
          {message.type === "success" ? <CheckCircle className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
          {message.text}
        </div>
      )}

      {/* Font Size */}
      <div className="glass-card p-5 animate-fade-in-up stagger-1">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{
            background: "linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, rgba(99, 102, 241, 0.08) 100%)"
          }}>
            <Type className="w-4 h-4 text-blue-400" />
          </div>
          <h3 className="font-semibold text-white">ขนาดตัวอักษร</h3>
        </div>
        <div className="flex gap-2">
          {FONT_SIZES.map((f) => (
            <button key={f.size} onClick={() => handleFontSize(String(f.size))}
              className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                fontSize === String(f.size) ? "text-white" : "text-slate-500 hover:text-slate-300"
              }`}
              style={fontSize === String(f.size) ? {
                background: "linear-gradient(135deg, rgba(59, 130, 246, 0.2) 0%, rgba(99, 102, 241, 0.15) 100%)",
                border: "1px solid rgba(59, 130, 246, 0.2)",
              } : { background: "rgba(15, 23, 42, 0.5)", border: "1px solid rgba(148, 163, 184, 0.08)" }}
            >
              <span style={{ fontSize: f.size + "px" }}>{f.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Change Password */}
      <div className="glass-card p-5 animate-fade-in-up stagger-2">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{
            background: "linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, rgba(99, 102, 241, 0.08) 100%)"
          }}>
            <Key className="w-4 h-4 text-blue-400" />
          </div>
          <h3 className="font-semibold text-white">เปลี่ยนรหัสผ่าน</h3>
        </div>
        <div className="space-y-3 max-w-sm">
          <input type="password" placeholder="รหัสผ่านปัจจุบัน" value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} className={inputStyle} style={inputBg} />
          <input type="password" placeholder="รหัสผ่านใหม่" value={newPw} onChange={(e) => setNewPw(e.target.value)} className={inputStyle} style={inputBg} />
          <input type="password" placeholder="ยืนยันรหัสผ่านใหม่" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} className={inputStyle} style={inputBg} />
          <button onClick={handleChangePassword}
            className="flex items-center gap-2 text-white px-4 py-2 rounded-xl text-sm transition-all btn-press hover:shadow-lg"
            style={{ background: "linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)", boxShadow: "0 4px 12px rgba(59, 130, 246, 0.2)" }}>
            <Save className="w-4 h-4" />เปลี่ยนรหัสผ่าน
          </button>
        </div>
      </div>

      {/* User Management (admin only) */}
      {isAdmin && (
        <div className="glass-card p-5 animate-fade-in-up stagger-3">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{
              background: "linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, rgba(99, 102, 241, 0.08) 100%)"
            }}>
              <UserPlus className="w-4 h-4 text-blue-400" />
            </div>
            <h3 className="font-semibold text-white">จัดการผู้ใช้</h3>
          </div>

          {/* Current users */}
          <div className="space-y-2 mb-5">
            {users.map((u) => (
              <div key={u.id} className="flex items-center justify-between glass-card-sm px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold ${
                    u.role === "admin" ? "bg-gradient-to-br from-amber-400 to-orange-500" : "bg-gradient-to-br from-emerald-400 to-cyan-500"
                  }`}>
                    {(u.display_name || u.username).charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm text-slate-300 font-medium">{u.display_name || u.username}</p>
                    <p className="text-[11px] text-slate-500">@{u.username} &middot; {u.role}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {u.role !== "admin" && (
                    <>
                      {resetPwUserId === u.id ? (
                        <div className="flex items-center gap-1">
                          <input type="password" placeholder="รหัสใหม่" value={resetPwValue} onChange={(e) => setResetPwValue(e.target.value)}
                            className="w-28 rounded-lg px-2 py-1 text-xs text-slate-300 focus:outline-none" style={inputBg} />
                          <button onClick={() => handleResetPassword(u.id)}
                            className="p-1.5 text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors">
                            <CheckCircle className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => { setResetPwUserId(null); setResetPwValue(""); }}
                            className="p-1.5 text-slate-500 hover:bg-white/[0.04] rounded-lg transition-colors">
                            <AlertCircle className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <button onClick={() => setResetPwUserId(u.id)} title="รีเซ็ตรหัสผ่าน"
                          className="p-1.5 text-slate-500 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors">
                          <Key className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button onClick={() => handleDeleteUser(u.id, u.display_name || u.username)} title="ลบผู้ใช้"
                        className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                  {u.role === "admin" && (
                    <span className="text-[10px] text-amber-400 px-2 py-0.5 rounded-lg" style={{ background: "rgba(245, 158, 11, 0.1)" }}>Admin</span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Add new staff */}
          <div className="glass-card-sm p-4">
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-3">เพิ่ม Staff ใหม่</p>
            <div className="flex flex-wrap gap-2">
              <input type="text" placeholder="Username" value={newUsername} onChange={(e) => setNewUsername(e.target.value)} className="rounded-xl px-3 py-2 text-sm text-slate-300 placeholder:text-slate-600 focus:outline-none w-32" style={inputBg} />
              <input type="text" placeholder="ชื่อแสดง" value={newDisplayName} onChange={(e) => setNewDisplayName(e.target.value)} className="rounded-xl px-3 py-2 text-sm text-slate-300 placeholder:text-slate-600 focus:outline-none w-32" style={inputBg} />
              <input type="password" placeholder="รหัสผ่าน" value={newUserPw} onChange={(e) => setNewUserPw(e.target.value)} className="rounded-xl px-3 py-2 text-sm text-slate-300 placeholder:text-slate-600 focus:outline-none w-32" style={inputBg} />
              <button onClick={handleCreateUser}
                className="flex items-center gap-1.5 text-white px-4 py-2 rounded-xl text-sm transition-all btn-press hover:shadow-lg"
                style={{ background: "linear-gradient(135deg, #22c55e 0%, #10b981 100%)", boxShadow: "0 4px 12px rgba(34, 197, 94, 0.2)" }}>
                <UserPlus className="w-4 h-4" />เพิ่ม
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Database (admin only) */}
      {isAdmin && data && (
        <>
          <div className="glass-card gradient-border p-5 animate-fade-in-up stagger-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{
                background: "linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, rgba(99, 102, 241, 0.08) 100%)"
              }}>
                <HardDrive className="w-4 h-4 text-blue-400" />
              </div>
              <h3 className="font-semibold text-white">ฐานข้อมูล</h3>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-[11px] text-slate-500 uppercase tracking-wider">ขนาด</p>
                <p className="text-white font-medium mt-0.5">{fmtSize(data.currentDbSize)}</p>
              </div>
              <div>
                <p className="text-[11px] text-slate-500 uppercase tracking-wider">สำรองล่าสุด</p>
                <p className="text-white font-medium mt-0.5">{data.meta.last_date || "ยังไม่เคย"}</p>
              </div>
            </div>
          </div>

          <div className="glass-card p-5 animate-fade-in-up stagger-5">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{
                  background: "linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, rgba(99, 102, 241, 0.08) 100%)"
                }}>
                  <Database className="w-4 h-4 text-blue-400" />
                </div>
                <h3 className="font-semibold text-white">สำรองข้อมูล</h3>
              </div>
              <div className="flex gap-2">
                <button onClick={handleBackup} disabled={actionLoading === "backup"}
                  className="flex items-center gap-2 text-white px-3 py-1.5 rounded-xl text-xs transition-all disabled:opacity-50 btn-press"
                  style={{ background: "linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)" }}>
                  <Save className="w-3.5 h-3.5" />{actionLoading === "backup" ? "..." : "สำรอง"}
                </button>
                <button onClick={handleExport}
                  className="flex items-center gap-2 text-white px-3 py-1.5 rounded-xl text-xs transition-all btn-press"
                  style={{ background: "linear-gradient(135deg, #22c55e 0%, #10b981 100%)" }}>
                  <Download className="w-3.5 h-3.5" />Export
                </button>
                <label className="flex items-center gap-2 text-white px-3 py-1.5 rounded-xl text-xs cursor-pointer transition-all btn-press"
                  style={{ background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)" }}>
                  <Upload className="w-3.5 h-3.5" />Import
                  <input type="file" accept=".db,.sqlite" onChange={handleImportDb} className="hidden" />
                </label>
              </div>
            </div>
            {loading ? (
              <div className="flex justify-center py-6"><div className="w-6 h-6 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" /></div>
            ) : (
              <div className="space-y-2">
                {(data?.backups || []).map((b) => (
                  <div key={b.slot} className="flex items-center justify-between glass-card-sm px-4 py-2.5">
                    <div>
                      <p className="text-xs text-slate-300">Slot {b.slot} — <span className="text-slate-500">{b.filename}</span>
                        {b.isCurrent && <span className="ml-1 text-[10px] text-blue-400">(ล่าสุด)</span>}</p>
                      <p className="text-[10px] text-slate-600 mt-0.5">{b.exists ? `${fmtSize(b.size || 0)}` : "ว่าง"}</p>
                    </div>
                    {b.exists && (
                      <button onClick={() => handleRestore(b.slot)} disabled={actionLoading === `restore-${b.slot}`}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] text-amber-400 hover:text-amber-300 transition-colors"
                        style={{ background: "rgba(245, 158, 11, 0.06)", border: "1px solid rgba(245, 158, 11, 0.1)" }}>
                        <RotateCcw className="w-3 h-3" />กู้คืน
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
