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
  { path: "/", label: "แดชบอร์ด", icon: LayoutDashboard },
  { path: "/invoices", label: "ใบแจ้งหนี้", icon: FileText },
  { path: "/import", label: "นำเข้าข้อมูล", icon: Upload },
  { path: "/reports", label: "รายงาน", icon: BarChart3 },
  { path: "/costs", label: "ต้นทุน", icon: DollarSign },
  { path: "/settings", label: "ตั้งค่า", icon: Settings },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const { logout } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full w-60 bg-slate-900 border-r border-slate-700 z-50 transition-transform lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        } lg:static lg:z-auto`}
      >
        <div className="p-4 border-b border-slate-700">
          <h1 className="text-lg font-bold text-white flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-primary" />
            Talent Report
          </h1>
          <p className="text-xs text-slate-400 mt-1">ระบบรายงานการขาย</p>
        </div>

        <nav className="p-3 space-y-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  isActive
                    ? "bg-primary text-white"
                    : "text-slate-400 hover:text-white hover:bg-slate-800"
                }`}
              >
                <item.icon className="w-5 h-5 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-3 border-t border-slate-700">
          <button
            onClick={logout}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-slate-400 hover:text-danger hover:bg-slate-800 w-full transition-colors"
          >
            <LogOut className="w-5 h-5" />
            ออกจากระบบ
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 min-w-0">
        {/* Top bar */}
        <header className="h-14 bg-slate-900 border-b border-slate-700 flex items-center px-4 lg:px-6 sticky top-0 z-30">
          <button
            className="lg:hidden p-2 text-slate-400 hover:text-white -ml-2 mr-2"
            onClick={() => setSidebarOpen(true)}
          >
            {sidebarOpen ? (
              <X className="w-5 h-5" />
            ) : (
              <Menu className="w-5 h-5" />
            )}
          </button>
          <div className="text-sm text-slate-400">
            {navItems.find((n) => n.path === location.pathname)?.label ||
              "Talent Report"}
          </div>
        </header>

        <main className="p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
