"use client";

import { Moon, Sun } from "lucide-react";
import type { ThemePreference } from "@/lib/theme";

interface ThemeToggleProps {
  theme: ThemePreference;
  onToggle: () => void;
  className?: string;
  compact?: boolean;
}

export default function ThemeToggle({
  theme,
  onToggle,
  className = "",
  compact = false,
}: ThemeToggleProps) {
  const isLight = theme === "light";
  const label = isLight ? "Passer en mode sombre" : "Passer en mode clair";

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={label}
      title={label}
      className={`group inline-flex items-center gap-2 rounded-xl border border-[var(--border-default)] bg-[var(--surface-subtle)] px-2.5 py-1.5 text-[var(--text-secondary)] transition-all hover:border-[var(--border-strong)] hover:bg-[var(--surface-raised)] hover:text-[var(--text-primary)] ${className}`}
    >
      <span
        className={`inline-flex h-6 w-6 items-center justify-center rounded-lg border transition-colors ${
          isLight
            ? "border-orange-500/35 bg-orange-500/12 text-orange-500"
            : "border-navy-400/35 bg-navy-500/15 text-navy-300"
        }`}
      >
        {isLight ? <Sun size={13} /> : <Moon size={13} />}
      </span>
      {!compact && (
        <span className="text-[11px] font-semibold uppercase tracking-[0.08em]">
          {isLight ? "Clair" : "Sombre"}
        </span>
      )}
    </button>
  );
}
