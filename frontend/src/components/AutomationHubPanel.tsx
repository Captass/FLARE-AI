"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowUpRight,
  Bot,
  CheckCircle2,
  Crown,
  Lock,
  MessageCircle,
  PenTool,
  Settings,
  Target,
  Users,
  Wallet,
  Workflow,
  Zap,
} from "lucide-react";
import { getChatbotOverview, type ChatbotOverview } from "@/lib/api";

interface AutomationHubPanelProps {
  onNavigate?: (view: string) => void;
  token?: string | null;
}

const LOCKED_MODULES = [
  {
    id: "prospection",
    title: "Prospection automatique",
    description: "Trouver, classer et relancer de nouveaux clients automatiquement.",
    icon: Target,
  },
  {
    id: "content",
    title: "Studio contenu",
    description: "Préparer posts, visuels et campagnes dans un seul endroit.",
    icon: PenTool,
  },
  {
    id: "followup",
    title: "Suivi clients & CRM",
    description: "Rappels, offres et prochaines actions pour chaque client.",
    icon: Workflow,
  },
  {
    id: "agents",
    title: "Agents FLARE",
    description: "Agents autonomes capables de finir un travail complet.",
    icon: Crown,
  },
];

export default function AutomationHubPanel({ onNavigate, token }: AutomationHubPanelProps) {
  const [overview, setOverview] = useState<ChatbotOverview | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    getChatbotOverview(token)
      .then(setOverview)
      .catch(() => setOverview(null))
      .finally(() => setLoading(false));
  }, [token]);

  const isComplete = overview?.step === "complete";
  const activePage = overview?.active_page;
  const prefs = overview?.preferences;

  const chatbotStatusLabel = !overview || loading
    ? "Chargement..."
    : isComplete
      ? "Opérationnel"
      : overview.step === "connect_page"
        ? "Page non connectée"
        : "Configuration requise";

  return (
    <div className="flex-1 overflow-y-auto bg-[var(--background)]">
      <div className="mx-auto flex w-full max-w-[920px] flex-col gap-8 px-4 py-8 md:px-6 md:py-12">
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-[28px] border border-[var(--border-default)] bg-[var(--bg-card)] p-6 md:p-8"
        >
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-orange-500/20 bg-orange-500/10 px-3 py-1 text-xs font-semibold text-orange-600 dark:text-orange-300">
            <Workflow size={14} />
            Automatisations Business
          </div>
          <h1 className="text-3xl font-black tracking-tight text-[var(--text-primary)] md:text-4xl">
            Vos outils automatisés
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-[var(--text-secondary)]">
            {isComplete
              ? "Votre chatbot est actif. Gérez vos conversations, leads et dépenses."
              : "Configurez votre chatbot Facebook pour démarrer les automatisations utiles."}
          </p>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
        >
          <button
            type="button"
            className="group w-full rounded-[24px] border border-[var(--border-default)] bg-[var(--bg-card)] p-5 text-left shadow-[0_12px_30px_rgba(15,23,42,0.04)] transition-all hover:border-orange-500/25 hover:bg-[var(--surface-subtle)]"
            onClick={() => onNavigate?.("chatbot")}
          >
            <div className="flex flex-col gap-4 md:flex-row md:items-start">
              <div
                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${
                  isComplete
                    ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                    : "bg-orange-500/10 text-orange-500"
                }`}
              >
                <Bot size={21} />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl font-bold text-[var(--text-primary)]">Chatbot Facebook</h2>
                  {isComplete ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                      <CheckCircle2 size={12} />
                      Actif
                    </span>
                  ) : (
                    <span className="rounded-full border border-orange-500/20 bg-orange-500/10 px-2.5 py-1 text-xs font-semibold text-orange-600 dark:text-orange-300">
                      {loading ? "Chargement" : "Action requise"}
                    </span>
                  )}
                </div>

                {activePage ? (
                  <p className="mt-2 text-sm text-[var(--text-secondary)]">
                    Page connectée : <span className="font-semibold text-[var(--text-primary)]">{activePage.page_name}</span>
                  </p>
                ) : null}

                {prefs ? (
                  <p className="mt-1 text-sm text-[var(--text-secondary)]">
                    Assistant : {prefs.bot_name} · Ton {prefs.tone}
                  </p>
                ) : null}

                {!isComplete && !loading ? (
                  <p className="mt-2 text-sm text-[var(--text-secondary)]">{chatbotStatusLabel}</p>
                ) : null}

                <div className="mt-4 flex flex-wrap gap-2">
                  {isComplete ? (
                    <>
                      <HubButton icon={MessageCircle} label="Conversations" onClick={() => onNavigate?.("conversations")} />
                      <HubButton icon={Users} label="Leads" onClick={() => onNavigate?.("leads")} />
                      <HubButton icon={Wallet} label="Budget" onClick={() => onNavigate?.("expenses")} />
                      <HubButton icon={Settings} label="Paramètres" onClick={() => onNavigate?.("chatbot")} />
                    </>
                  ) : (
                    <HubButton
                      icon={Zap}
                      label={overview?.step === "connect_page" ? "Connecter ma page" : "Terminer la configuration"}
                      onClick={() => onNavigate?.("chatbot")}
                      tone="orange"
                    />
                  )}
                </div>
              </div>

              <ArrowUpRight size={17} className="hidden shrink-0 text-orange-500 md:block" />
            </div>
          </button>
        </motion.section>

        <section>
          <p className="mb-4 px-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--text-secondary)]">
            Prochainement
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            {LOCKED_MODULES.map((module, index) => {
              const Icon = module.icon;
              return (
                <motion.div
                  key={module.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.08 + index * 0.04 }}
                  className="rounded-[22px] border border-[var(--border-default)] bg-[var(--bg-card)] p-5"
                >
                  <div className="flex items-start gap-3">
                    <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--surface-subtle)] text-[var(--text-secondary)]">
                      <Icon size={17} />
                      <div className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full border border-[var(--border-default)] bg-[var(--bg-card)]">
                        <Lock size={8} className="text-[var(--text-secondary)]" />
                      </div>
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-bold text-[var(--text-primary)]">{module.title}</h3>
                        <span className="rounded-full border border-[var(--border-default)] bg-[var(--surface-subtle)] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                          Bientôt
                        </span>
                      </div>
                      <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{module.description}</p>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}

function HubButton({
  icon: Icon,
  label,
  onClick,
  tone = "neutral",
}: {
  icon: typeof MessageCircle;
  label: string;
  onClick: () => void;
  tone?: "neutral" | "orange";
}) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-[11px] font-bold uppercase tracking-[0.08em] transition-all ${
        tone === "orange"
          ? "border-orange-500/20 bg-orange-500/10 text-orange-600 hover:bg-orange-500/20"
          : "border-[var(--border-default)] bg-[var(--surface-subtle)] text-[var(--text-secondary)] hover:bg-[var(--surface-raised)] hover:text-[var(--text-primary)]"
      }`}
    >
      <Icon size={12} />
      {label}
    </button>
  );
}
