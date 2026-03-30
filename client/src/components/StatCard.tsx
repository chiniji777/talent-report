import type { LucideIcon } from "lucide-react";

interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  color?: "primary" | "success" | "warning" | "danger";
}

const config = {
  primary: {
    icon: "text-blue-400",
    iconBg: "linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, rgba(99, 102, 241, 0.1) 100%)",
    glow: "stat-glow-blue",
    ring: "ring-blue-500/10",
  },
  success: {
    icon: "text-emerald-400",
    iconBg: "linear-gradient(135deg, rgba(34, 197, 94, 0.15) 0%, rgba(16, 185, 129, 0.1) 100%)",
    glow: "stat-glow-green",
    ring: "ring-emerald-500/10",
  },
  warning: {
    icon: "text-amber-400",
    iconBg: "linear-gradient(135deg, rgba(245, 158, 11, 0.15) 0%, rgba(234, 179, 8, 0.1) 100%)",
    glow: "stat-glow-amber",
    ring: "ring-amber-500/10",
  },
  danger: {
    icon: "text-red-400",
    iconBg: "linear-gradient(135deg, rgba(239, 68, 68, 0.15) 0%, rgba(220, 38, 38, 0.1) 100%)",
    glow: "stat-glow-red",
    ring: "ring-red-500/10",
  },
};

export function StatCard({ icon: Icon, label, value, color = "primary" }: StatCardProps) {
  const c = config[color];

  return (
    <div className={`glass-card-sm relative overflow-hidden p-4 transition-all duration-200 hover:scale-[1.02] hover:shadow-lg ${c.glow}`}>
      <div className="relative z-10 flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ring-1 ${c.ring}`} style={{ background: c.iconBg }}>
          <Icon className={`w-5 h-5 ${c.icon}`} />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] text-slate-500 truncate uppercase tracking-wider">{label}</p>
          <p className="text-lg font-bold text-white truncate mt-0.5">
            {typeof value === "number" ? value.toLocaleString("th-TH") : value}
          </p>
        </div>
      </div>
    </div>
  );
}
