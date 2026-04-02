"use client";

import { ArrowUpRight, Bot, Sparkles } from "lucide-react";

interface ComingSoonPanelProps {
  title: string;
  description: string;
  onNavigate?: (view: string) => void;
}

export default function ComingSoonPanel({
  title,
  description,
  onNavigate,
}: ComingSoonPanelProps) {
  return (
    <div className="flex-1 overflow-y-auto bg-[var(--background)]">
      <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-6 px-4 py-6 md:px-6 md:py-8">
        <div className="flare-panel rounded-[34px] border border-white/10 bg-[linear-gradient(135deg,rgba(27,52,96,0.28),rgba(255,126,32,0.08),rgba(8,10,15,0.94))] p-7 md:p-10">
          <span className="flare-chip-orange">En préparation</span>
          <h1 className="mt-5 text-[36px] font-semibold tracking-[-0.05em] text-white md:text-[52px]">
            {title}
          </h1>
          <p className="mt-4 max-w-[46rem] text-[15px] leading-8 text-[var(--text-muted)]">
            {description}
          </p>

          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <div className="rounded-[28px] border border-white/10 bg-black/20 p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-[18px] border border-white/10 bg-white/5">
                  <Bot size={18} className="text-white" />
                </div>
                <div>
                  <p className="text-base font-medium text-white">Le module métier arrive</p>
                  <p className="text-sm text-[var(--text-muted)]">
                    L&apos;interface l&apos;annonce clairement au lieu de laisser croire qu&apos;elle est prête.
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-[28px] border border-white/10 bg-black/20 p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-[18px] border border-white/10 bg-white/5">
                  <Sparkles size={18} className="text-white" />
                </div>
                <div>
                  <p className="text-base font-medium text-white">Alternative disponible</p>
                  <p className="text-sm text-[var(--text-muted)]">
                    L&apos;assistant IA reste accessible pour avancer sans bloquer l&apos;utilisateur.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <button onClick={() => onNavigate?.("dashboard")} className="ui-btn ui-btn-secondary">
              <ArrowUpRight size={16} />
              Retour au dashboard
            </button>
            <button onClick={() => onNavigate?.("chat")} className="ui-btn ui-btn-primary">
              <Sparkles size={16} />
              Ouvrir l&apos;assistant IA
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
