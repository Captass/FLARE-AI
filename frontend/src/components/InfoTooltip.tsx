"use client";

import { useState } from "react";
import { Info } from "lucide-react";

interface InfoTooltipProps {
  text: string;
  label?: string;
}

export default function InfoTooltip({ text, label = "Voir le detail" }: InfoTooltipProps) {
  const [open, setOpen] = useState(false);

  return (
    <span className="relative inline-flex shrink-0 items-center">
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        onClick={(event) => {
          event.stopPropagation();
          setOpen((current) => !current);
        }}
        onMouseLeave={() => setOpen(false)}
        className="group/info inline-flex h-8 w-8 items-center justify-center rounded-full border border-[var(--border-default)] bg-[var(--bg-card)] text-[var(--text-muted)] transition-all hover:border-orange-500/25 hover:bg-orange-500/10 hover:text-orange-500"
      >
        <Info size={14} />
      </button>
      <span
        role="tooltip"
        className={`pointer-events-none absolute right-0 top-10 z-50 w-[230px] rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-3 text-left text-xs font-medium leading-relaxed text-[var(--text-secondary)] opacity-0 shadow-[0_18px_45px_rgba(0,0,0,0.12)] backdrop-blur-xl transition-opacity group-hover/info:opacity-100 md:group-hover/info:opacity-100 ${
          open ? "opacity-100" : ""
        }`}
      >
        {text}
      </span>
    </span>
  );
}
