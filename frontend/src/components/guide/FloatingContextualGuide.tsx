"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { BookOpen, ChevronRight, Minimize2, Sparkles, X } from "lucide-react";
import {
  GuideContext,
  GuideViewKey,
  resolveGuideContent,
  resolveGuideViewKey,
} from "./guideAssistantContent";

type PanelState = "closed" | "peek" | "open";

interface FloatingContextualGuideProps {
  enabled: boolean;
  visible?: boolean;
  activeView: string;
  context: GuideContext;
  onNavigate: (target: GuideViewKey) => void;
  canAccessAdmin?: boolean;
  bottomClassName?: string;
}

function StepPill({ status }: { status?: "todo" | "done" | "blocked" | "next" }) {
  if (status === "done") {
    return <span className="rounded-full bg-green-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-green-600 dark:text-green-400">OK</span>;
  }
  if (status === "blocked") {
    return <span className="rounded-full bg-red-500/12 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-red-600 dark:text-red-400">Bloque</span>;
  }
  if (status === "next") {
    return <span className="rounded-full bg-orange-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-orange-600 dark:text-orange-400">Maintenant</span>;
  }
  return <span className="rounded-full bg-[var(--surface-subtle)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">A faire</span>;
}

export default function FloatingContextualGuide({
  enabled,
  visible = true,
  activeView,
  context,
  onNavigate,
  canAccessAdmin = false,
  bottomClassName,
}: FloatingContextualGuideProps) {
  const [panelState, setPanelState] = useState<PanelState>("peek");
  const viewKey = useMemo(() => resolveGuideViewKey(activeView), [activeView]);
  const content = useMemo(() => resolveGuideContent(viewKey, context), [viewKey, context]);
  const isAssistantSurface = activeView === "assistant" || activeView === "chat";

  useEffect(() => {
    if (!enabled) {
      setPanelState("closed");
      return;
    }
    setPanelState((prev) => (prev === "open" ? "open" : "peek"));
  }, [enabled, viewKey]);

  useEffect(() => {
    if (!visible && panelState === "open") {
      setPanelState("closed");
    }
  }, [panelState, visible]);

  if (!enabled || !visible) return null;

  const bottomClass = bottomClassName || (isAssistantSurface ? "bottom-28 md:bottom-6" : "bottom-4 md:bottom-6");
  const visibleCtas = content.ctas.filter((cta) => cta.target !== "admin" || canAccessAdmin);

  return (
    <div className={`pointer-events-none fixed right-4 z-40 ${bottomClass}`}>
      <AnimatePresence mode="wait">
        {panelState === "closed" && (
          <motion.button
            key="guide-closed"
            type="button"
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => setPanelState("open")}
            className="pointer-events-auto inline-flex h-12 items-center gap-2 rounded-2xl border border-orange-500/30 bg-[var(--surface-base)] px-4 text-[var(--text-primary)] shadow-[var(--shadow-card)] transition-colors hover:bg-[var(--surface-raised)]"
          >
            <BookOpen size={16} className="text-orange-500" />
            <span className="text-sm font-medium">Guide IA</span>
          </motion.button>
        )}

        {panelState === "peek" && (
          <motion.div
            key="guide-peek"
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            className="pointer-events-auto w-[min(92vw,360px)] rounded-2xl border border-[var(--border-default)] bg-[var(--surface-base)] p-4 shadow-[var(--shadow-card)]"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">Guide contextuel</p>
                <h3 className="mt-1 text-sm font-semibold text-[var(--text-primary)]">{content.title}</h3>
                <p className="mt-1 text-xs leading-relaxed text-[var(--text-secondary)]">{content.summary}</p>
              </div>
              <button
                type="button"
                onClick={() => setPanelState("closed")}
                className="rounded-lg p-1 text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]"
                aria-label="Fermer le guide"
              >
                <X size={14} />
              </button>
            </div>
            {visibleCtas[0] && (
              <button
                type="button"
                onClick={() => onNavigate(visibleCtas[0].target)}
                className="mt-3 inline-flex w-full items-center justify-between rounded-xl border border-orange-500/30 bg-orange-500/10 px-3 py-2 text-xs font-semibold text-orange-600 transition-colors hover:bg-orange-500/15 dark:text-orange-400"
              >
                {visibleCtas[0].label}
                <ChevronRight size={14} />
              </button>
            )}
            <button
              type="button"
              onClick={() => setPanelState("open")}
              className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]"
            >
              Ouvrir le guide detaille
              <ChevronRight size={12} />
            </button>
          </motion.div>
        )}

        {panelState === "open" && (
          <motion.aside
            key="guide-open"
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            className="pointer-events-auto w-[min(94vw,390px)] rounded-2xl border border-[var(--border-default)] bg-[var(--surface-base)] p-4 shadow-[var(--shadow-card)]"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border-default)] bg-[var(--surface-subtle)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-secondary)]">
                  <Sparkles size={12} className="text-orange-500" />
                  {content.audience === "operator" ? "Mode operateur" : "Mode utilisateur"}
                </div>
                <h3 className="mt-2 text-sm font-semibold text-[var(--text-primary)]">{content.title}</h3>
                <p className="mt-1 text-xs leading-relaxed text-[var(--text-secondary)]">{content.summary}</p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setPanelState("peek")}
                  className="rounded-lg p-1 text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]"
                  aria-label="Reduire le guide"
                >
                  <Minimize2 size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => setPanelState("closed")}
                  className="rounded-lg p-1 text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]"
                  aria-label="Fermer le guide"
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            {content.stageCard && (
              <div
                className={`mt-3 rounded-xl border px-3 py-2.5 text-xs ${
                  content.stageCard.tone === "success"
                    ? "border-green-500/25 bg-green-500/10 text-green-700 dark:text-green-300"
                    : content.stageCard.tone === "warning"
                      ? "border-orange-500/30 bg-orange-500/12 text-orange-700 dark:text-orange-300"
                      : "border-[var(--border-default)] bg-[var(--surface-subtle)] text-[var(--text-secondary)]"
                }`}
              >
                <p className="font-semibold">{content.stageCard.title}</p>
                <p className="mt-1 leading-relaxed">{content.stageCard.nextAction}</p>
                <p className="mt-1 text-[11px] opacity-90">Condition: {content.stageCard.unlockCondition}</p>
              </div>
            )}

            <div className="mt-3 space-y-2">
              {content.steps.map((step) => (
                <div key={step.id} className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-subtle)] px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-medium text-[var(--text-primary)]">{step.label}</p>
                    <StepPill status={step.status} />
                  </div>
                </div>
              ))}
            </div>

            {content.warnings.length > 0 && (
              <div className="mt-3 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2.5">
                {content.warnings.map((warning, idx) => (
                  <p key={`${warning}-${idx}`} className="text-xs leading-relaxed text-red-700 dark:text-red-300">
                    {warning}
                  </p>
                ))}
              </div>
            )}

            <div className="mt-3 grid gap-2">
              {visibleCtas.map((cta) => (
                <button
                  key={cta.id}
                  type="button"
                  onClick={() => onNavigate(cta.target)}
                  className={`inline-flex items-center justify-between rounded-xl border px-3 py-2 text-xs font-semibold transition-colors ${
                    cta.tone === "primary"
                      ? "border-orange-500/30 bg-orange-500/12 text-orange-700 hover:bg-orange-500/16 dark:text-orange-300"
                      : "border-[var(--border-default)] bg-[var(--surface-subtle)] text-[var(--text-primary)] hover:bg-[var(--surface-raised)]"
                  }`}
                >
                  {cta.label}
                  <ChevronRight size={14} />
                </button>
              ))}
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </div>
  );
}
