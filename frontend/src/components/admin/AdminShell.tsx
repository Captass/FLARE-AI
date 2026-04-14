"use client";

import { ChevronLeft, RefreshCcw } from "lucide-react";
import type { ElementType, ReactNode } from "react";

interface AdminShellProps {
  title: string;
  description?: string;
  icon: ElementType;
  iconColor?: string;
  iconBg?: string;
  onBack?: () => void;
  live?: boolean;
  liveLabel?: string;
  loading?: boolean;
  onRefresh?: () => void;
  actions?: ReactNode;
  children: ReactNode;
}

export default function AdminShell({
  title,
  description,
  icon: Icon,
  iconColor = "text-orange-500",
  iconBg = "border-orange-500/20 bg-orange-500/10",
  onBack,
  live = false,
  liveLabel = "Temps réel",
  loading = false,
  onRefresh,
  actions,
  children,
}: AdminShellProps) {
  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-10 bg-[rgb(var(--background))]">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
        <div className="flex items-center gap-4">
          {onBack && (
            <button
              onClick={onBack}
              className="p-2 rounded-xl text-[var(--text-secondary)] transition-all hover:bg-[var(--surface-subtle)] hover:text-[var(--text-primary)]"
            >
              <ChevronLeft size={20} />
            </button>
          )}
          <div className={`flex h-12 w-12 items-center justify-center rounded-2xl border ${iconBg}`}>
            <Icon size={24} className={iconColor} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight">{title}</h1>
            {description && (
              <div className="flex items-center gap-2 mt-0.5">
                {live && <span className="h-1.5 w-1.5 rounded-full bg-orange-500 animate-pulse" />}
                <p className="text-[11px] font-medium tracking-[0.05em] text-[var(--text-secondary)]">
                  {live ? liveLabel : description}
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {actions}
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={loading}
              className="flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2 text-xs font-bold text-white transition-all hover:bg-orange-600 disabled:opacity-50"
            >
              <RefreshCcw size={14} className={loading ? "animate-spin" : ""} />
              {loading ? "Sync..." : "Refresh"}
            </button>
          )}
        </div>
      </div>

      {children}
    </div>
  );
}
