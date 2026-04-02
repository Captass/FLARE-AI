"use client";

import type { MouseEvent } from "react";
import { motion } from "framer-motion";
import {
  ArrowUpRight,
  Bot,
  Crown,
  LockKeyhole,
  ShieldAlert,
  Sparkles,
  Workflow,
} from "lucide-react";

interface LockedModuleHighlight {
  title: string;
  description: string;
}

interface LockedModuleAction {
  label: string;
  description: string;
  view: string;
  tone?: "primary" | "secondary";
}

interface LockedModulePanelProps {
  eyebrow: string;
  title: string;
  summary: string;
  blockedReason: string;
  upgradeMessage: string;
  highlights: LockedModuleHighlight[];
  availableNow: LockedModuleAction[];
  onNavigate?: (view: string) => void;
  onRequestUpgrade?: () => void;
  requestLabel?: string;
}

function handlePointerMove(event: MouseEvent<HTMLElement>) {
  const rect = event.currentTarget.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width) * 100;
  const y = ((event.clientY - rect.top) / rect.height) * 100;
  event.currentTarget.style.setProperty("--pointer-x", `${x}%`);
  event.currentTarget.style.setProperty("--pointer-y", `${y}%`);
}

export default function LockedModulePanel({
  eyebrow,
  title,
  summary,
  blockedReason,
  upgradeMessage,
  highlights,
  availableNow,
  onNavigate,
  onRequestUpgrade,
  requestLabel = "Voir mon offre",
}: LockedModulePanelProps) {
  return (
    <div className="flex-1 overflow-y-auto bg-[var(--background)]">
      <div className="mx-auto flex w-full max-w-[1450px] flex-col gap-6 px-4 py-6 md:px-6 md:py-8">
        <div className="grid gap-4 xl:grid-cols-[1.08fr_0.92fr]">
          <motion.section
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            onMouseMove={handlePointerMove}
            className="flare-pointer-panel flare-panel rounded-[34px] border border-white/10 bg-[linear-gradient(135deg,rgba(27,52,96,0.24),rgba(255,126,32,0.1),rgba(8,10,15,0.96))] p-6 md:p-8"
          >
            <span className="flare-chip-blue">{eyebrow}</span>
            <h1 className="mt-4 max-w-[46rem] text-[34px] font-semibold tracking-[-0.05em] text-white md:text-[52px]">
              {title}
            </h1>
            <p className="mt-4 max-w-[46rem] text-[15px] leading-8 text-[var(--text-muted)]">
              {summary}
            </p>

            <div className="mt-6 rounded-[28px] border border-[rgba(255,126,32,0.18)] bg-[rgba(255,126,32,0.08)] p-5">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-[18px] border border-[rgba(255,126,32,0.18)] bg-black/20 text-[rgb(var(--brand-orange-soft))]">
                  <LockKeyhole size={18} />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] uppercase tracking-[0.24em] text-[rgb(var(--brand-orange-soft))]">
                    Module bloque
                  </p>
                  <p className="mt-2 text-base leading-7 text-white">{blockedReason}</p>
                  <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">{upgradeMessage}</p>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-3">
                {onRequestUpgrade ? (
                  <button onClick={onRequestUpgrade} className="ui-btn ui-btn-primary">
                    <Crown size={16} />
                    {requestLabel}
                  </button>
                ) : null}
                <button onClick={() => onNavigate?.("automationHub")} className="ui-btn ui-btn-secondary">
                  <Workflow size={16} />
                  Retour aux automatisations
                </button>
              </div>
            </div>
          </motion.section>

          <motion.section
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            onMouseMove={handlePointerMove}
            className="flare-pointer-panel flare-panel rounded-[34px] border border-white/10 p-6 md:p-8"
          >
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-[20px] border border-white/10 bg-white/[0.04] text-white">
                <ShieldAlert size={20} />
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.24em] text-[var(--text-muted)]">
                  Ce qui est clair maintenant
                </p>
                <h2 className="mt-3 text-[28px] font-semibold tracking-[-0.04em] text-white">
                  Vous savez pourquoi cette page est bloquee
                </h2>
                <p className="mt-3 text-[15px] leading-7 text-[var(--text-muted)]">
                  Cette page reste dans FLARE AI, explique ce qui manque et ne vous envoie pas vers un ecran inutile.
                </p>
              </div>
            </div>

            <div className="mt-6 grid gap-3">
              <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
                <p className="text-sm font-medium text-white">Rien ne se lance seul</p>
                <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
                  Aucune automation ou agent non pret ne tourne en fond. Le blocage est volontaire.
                </p>
              </div>
              <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
                <p className="text-sm font-medium text-white">Vous savez ou cliquer</p>
                <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
                  Vous voyez tout de suite si la page est disponible, bloquee ou deja utile pour votre equipe.
                </p>
              </div>
              <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
                <p className="text-sm font-medium text-white">Une action utile tout de suite</p>
                <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
                  Les raccourcis ci-dessous renvoient uniquement vers des pages deja utiles dans FLARE.
                </p>
              </div>
            </div>
          </motion.section>
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.02fr_0.98fr]">
          <motion.section
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 }}
            onMouseMove={handlePointerMove}
            className="flare-pointer-panel flare-panel rounded-[30px] border border-white/10 p-6"
          >
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-[18px] border border-white/10 bg-white/[0.04] text-white">
                <Sparkles size={18} />
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.24em] text-[var(--text-muted)]">
                  Quand cette page sera ouverte
                </p>
                <h2 className="mt-3 text-[28px] font-semibold tracking-[-0.04em] text-white">
                  Ce qu&apos;elle devra faire pour vous
                </h2>
              </div>
            </div>

            <div className="mt-6 grid gap-3 md:grid-cols-3">
              {highlights.map((item, index) => (
                <div key={`${item.title}-${index}`} className="rounded-[24px] border border-white/10 bg-white/[0.03] p-5">
                  <p className="text-sm font-medium text-white">{item.title}</p>
                  <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">
                    {item.description}
                  </p>
                </div>
              ))}
            </div>
          </motion.section>

          <motion.section
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12 }}
            onMouseMove={handlePointerMove}
            className="flare-pointer-panel flare-panel rounded-[30px] border border-white/10 p-6"
          >
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-[18px] border border-white/10 bg-white/[0.04] text-white">
                <Bot size={18} />
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.24em] text-[var(--text-muted)]">
                  Disponible maintenant
                </p>
                <h2 className="mt-3 text-[28px] font-semibold tracking-[-0.04em] text-white">
                  Ce que vous pouvez utiliser tout de suite
                </h2>
                <p className="mt-3 text-[15px] leading-7 text-[var(--text-muted)]">
                  Si vous voulez avancer maintenant, voici les pages qui marchent deja.
                </p>
              </div>
            </div>

            <div className="mt-6 grid gap-3">
              {availableNow.map((item, index) => (
                <button
                  key={`${item.label}-${index}`}
                  onClick={() => onNavigate?.(item.view)}
                  className="flex w-full flex-col items-start gap-3 rounded-[24px] border border-white/10 bg-white/[0.03] p-4 text-left transition-all hover:border-[rgba(255,126,32,0.2)] hover:bg-[rgba(255,126,32,0.06)]"
                >
                  <div className="flex w-full items-center justify-between gap-3">
                    <span className="text-sm font-medium text-white">{item.label}</span>
                    <ArrowUpRight size={16} className="text-[var(--text-muted)]" />
                  </div>
                  <p className="text-sm leading-6 text-[var(--text-muted)]">{item.description}</p>
                  <span className={item.tone === "primary" ? "flare-chip-orange" : "flare-chip-blue"}>
                    {item.tone === "primary" ? "A ouvrir maintenant" : "Deja disponible"}
                  </span>
                </button>
              ))}
            </div>
          </motion.section>
        </div>
      </div>
    </div>
  );
}
