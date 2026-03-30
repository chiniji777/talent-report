import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  FileText,
  Upload,
  BarChart3,
  DollarSign,
  Settings,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";

const navItems = [
  { path: "/", label: "แดชบอร์ด", icon: LayoutDashboard, adminOnly: true },
  { path: "/invoices", label: "ใบแจ้งหนี้", icon: FileText, adminOnly: false },
  { path: "/import", label: "นำเข้าข้อมูล", icon: Upload, adminOnly: false },
    { path: "/costs", label: "ต้นทุน", icon: DollarSign, adminOnly: true },
  { path: "/settings", label: "ตั้งค่า", icon: Settings, adminOnly: false },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const { logout, user, isAdmin } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const visibleItems = navItems.filter(
    (item) => !item.adminOnly || isAdmin
  );

  return (
    <div className="flex min-h-screen app-bg">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden animate-fade-in"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full w-64 z-50 transition-transform duration-300 lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        } lg:static lg:z-auto flex flex-col sidebar-glow`}
        style={{
          background: "linear-gradient(180deg, rgba(15, 23, 42, 0.95) 0%, rgba(6, 9, 24, 0.98) 100%)",
          backdropFilter: "blur(24px)",
          borderRight: "1px solid rgba(148, 163, 184, 0.06)",
        }}
      >
        {/* Brand */}
        <div className="p-5 border-b border-white/[0.04]">
          <h1 className="text-lg font-bold text-white flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center relative" style={{
              background: "linear-gradient(135deg, #3b82f6 0%, #6366f1 50%, #8b5cf6 100%)",
              boxShadow: "0 4px 16px rgba(59, 130, 246, 0.3)"
            }}>
              <BarChart3 className="w-[18px] h-[18px] text-white" />
            </div>
            <span className="gradient-text">Talent Report</span>
          </h1>
          <p className="text-[11px] text-slate-500 mt-1.5 ml-[46px]">ระบบรายงานการขาย</p>
        </div>

        {/* User info */}
        <div className="px-3 py-3 mx-3 mt-3 rounded-xl glass-card-sm">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold ring-2 ring-emerald-500/20" style={{
              background: "linear-gradient(135deg, #34d399 0%, #06b6d4 100%)"
            }}>
              {user?.displayName?.charAt(0) || "U"}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-white truncate">{user?.displayName || "User"}</p>
              <p className="text-[11px] text-slate-500 capitalize">{user?.role || "staff"}</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 mt-2 space-y-0.5 overflow-y-auto">
          {visibleItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? "text-white"
                    : "text-slate-400 hover:text-white hover:bg-white/[0.04]"
                }`}
                style={isActive ? {
                  background: "linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, rgba(99, 102, 241, 0.1) 100%)",
                  boxShadow: "0 0 20px rgba(59, 130, 246, 0.1), inset 0 1px 0 rgba(255,255,255,0.05)"
                } : undefined}
              >
                <item.icon className={`w-[18px] h-[18px] shrink-0 transition-colors ${
                  isActive ? "text-blue-400" : "group-hover:text-slate-300"
                }`} />
                {item.label}
                {isActive && (
                  <div className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-400" style={{
                    boxShadow: "0 0 8px rgba(96, 165, 250, 0.6)"
                  }} />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Logout */}
        <div className="p-3 border-t border-white/[0.04]">
          <button
            onClick={logout}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-slate-500 hover:text-red-400 hover:bg-red-500/[0.06] w-full transition-all duration-200"
          >
            <LogOut className="w-[18px] h-[18px]" />
            ออกจากระบบ
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 min-w-0">
        {/* Top bar */}
        <header className="h-14 flex items-center justify-between px-4 lg:px-6 sticky top-0 z-30" style={{
          background: "rgba(6, 9, 24, 0.7)",
          backdropFilter: "blur(16px)",
          borderBottom: "1px solid rgba(148, 163, 184, 0.05)"
        }}>
          <div className="flex items-center gap-3">
            <button
              className="lg:hidden p-2 text-slate-400 hover:text-white -ml-2 rounded-xl hover:bg-white/[0.05] transition-colors"
              onClick={() => setSidebarOpen(true)}
            >
              {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <h2 className="text-sm font-medium text-slate-400">
              {visibleItems.find((n) => n.path === location.pathname)?.label || "Talent Report"}
            </h2>
          </div>
        </header>

        <main className="p-4 lg:p-6 animate-fade-in">{children}</main>
      </div>
    </div>
  );
}
