import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { BarChart3, LogIn, AlertCircle, Eye, EyeOff } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(username, password);
      navigate("/");
    } catch {
      setError("ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden" style={{
      background: "radial-gradient(ellipse 80% 60% at 50% 40%, rgba(59, 130, 246, 0.08) 0%, transparent 60%), radial-gradient(ellipse 60% 50% at 20% 80%, rgba(99, 102, 241, 0.06) 0%, transparent 50%), radial-gradient(ellipse 50% 40% at 80% 20%, rgba(139, 92, 246, 0.04) 0%, transparent 50%), #060918"
    }}>
      {/* Ambient glow orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full opacity-20 blur-3xl pointer-events-none" style={{ background: "radial-gradient(circle, rgba(59, 130, 246, 0.15), transparent 70%)" }} />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full opacity-15 blur-3xl pointer-events-none" style={{ background: "radial-gradient(circle, rgba(139, 92, 246, 0.12), transparent 70%)" }} />

      <div className="w-full max-w-sm relative z-10">
        {/* Logo */}
        <div className="text-center mb-8 animate-fade-in-up">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5" style={{
            background: "linear-gradient(135deg, #3b82f6 0%, #6366f1 50%, #8b5cf6 100%)",
            boxShadow: "0 8px 32px rgba(59, 130, 246, 0.3)"
          }}>
            <BarChart3 className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold gradient-text">Talent Report</h1>
          <p className="text-slate-500 text-sm mt-1.5">ระบบรายงานการขาย</p>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="glass-card gradient-border p-6 space-y-5 animate-fade-in-up stagger-2"
        >
          {error && (
            <div className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm animate-fade-in" style={{
              background: "rgba(239, 68, 68, 0.08)",
              border: "1px solid rgba(239, 68, 68, 0.15)",
              color: "#f87171"
            }}>
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs text-slate-500 mb-1.5 uppercase tracking-wider font-medium">
              ชื่อผู้ใช้
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className="w-full rounded-xl px-4 py-3 text-white placeholder:text-slate-600 focus:outline-none transition-all duration-200"
              style={{
                background: "rgba(15, 23, 42, 0.6)",
                border: "1px solid rgba(148, 163, 184, 0.08)",
              }}
              placeholder="username"
            />
          </div>

          <div>
            <label className="block text-xs text-slate-500 mb-1.5 uppercase tracking-wider font-medium">
              รหัสผ่าน
            </label>
            <div className="relative">
              <input
                type={showPw ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full rounded-xl px-4 py-3 pr-11 text-white placeholder:text-slate-600 focus:outline-none transition-all duration-200"
                style={{
                  background: "rgba(15, 23, 42, 0.6)",
                  border: "1px solid rgba(148, 163, 184, 0.08)",
                }}
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPw(!showPw)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
              >
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full text-white font-semibold py-3 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 btn-press hover:shadow-xl"
            style={{
              background: "linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)",
              boxShadow: "0 4px 16px rgba(59, 130, 246, 0.3)"
            }}
          >
            <LogIn className="w-4 h-4" />
            {loading ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
          </button>
        </form>

        <p className="text-center text-[11px] text-slate-600 mt-6 animate-fade-in stagger-3">
          Talent Intertrade • ระบบภายใน
        </p>
      </div>
    </div>
  );
}
