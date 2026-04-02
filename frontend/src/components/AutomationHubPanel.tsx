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
  const isConnected = overview?.step !== "connect_page" && overview?.step !== "need_org";
  const activePage = overview?.active_page;
  const prefs = overview?.preferences;

  const chatbotStatusLabel = !overview || loading
    ? "Chargement…"
    : isComplete
    ? "Opérationnel"
    : overview.step === "connect_page"
    ? "Page non connectée"
    : "Configuration requise";

  return (
    <div className="flex-1 overflow-y-auto bg-[var(--background)]">
      <div className="mx-auto flex w-full max-w-[860px] flex-col gap-8 px-4 py-8 md:px-6 md:py-12">

        {/* Header */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="px-1"
        >
          <p className="text-[10px] uppercase tracking-[0.14em] text-white/25 mb-5">Automatisations</p>
          <h1 className="text-[28px] md:text-[34px] font-semibold tracking-[-0.03em] text-white">
            Vos outils automatisés
          </h1>
          <p className="mt-2 text-[14px] text-white/35 font-light">
            {isComplete
              ? "Votre chatbot est actif. Gérez vos conversations, leads et dépenses."
              : "Configurez votre chatbot Facebook pour démarrer."}
          </p>
        </motion.section>

        {/* Chatbot Facebook — module actif */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
        >
          <div
            className="rounded-2xl bg-white/[0.03] p-5 hover:bg-white/[0.05] transition-all cursor-pointer"
            onClick={() => onNavigate?.("chatbot")}
          >
            <div className="flex items-start gap-4">
              <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${
                isComplete
                  ? "bg-emerald-500/10 text-emerald-400"
                  : "bg-orange-500/10 text-orange-400"
              }`}>
                <Bot size={20} />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-[17px] font-medium tracking-tight text-white">
                    Chatbot Facebook
                  </h2>
                  {isComplete ? (
                    <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-medium text-emerald-400 uppercase tracking-wide">
                      <CheckCircle2 size={9} />
                      Actif
                    </span>
                  ) : (
                    <span className="rounded-full bg-orange-500/10 px-2.5 py-0.5 text-[10px] font-medium text-orange-400 uppercase tracking-wide">
                      {loading ? "…" : "Action requise"}
                    </span>
                  )}
                </div>

                {activePage && (
                  <p className="mt-1 text-[13px] text-white/40">
                    Page connectée :{" "}
                    <span className="text-white/60 font-medium">{activePage.page_name}</span>
                  </p>
                )}

                {prefs && (
                  <p className="mt-0.5 text-[12px] text-white/25">
                    Assistant : {prefs.bot_name} · Ton {prefs.tone}
                  </p>
                )}

                {!isComplete && !loading && (
                  <p className="mt-1 text-[13px] text-white/30">{chatbotStatusLabel}</p>
                )}

                <div className="mt-4 flex flex-wrap gap-2">
                  {isComplete ? (
                    <>
                      <button
                        onClick={(e) => { e.stopPropagation(); onNavigate?.("conversations"); }}
                        className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-[11px] font-medium uppercase tracking-widest text-white/40 bg-white/[0.03] hover:bg-white/[0.06] hover:text-white transition-all"
                      >
                        <MessageCircle size={11} />
                        Conversations
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); onNavigate?.("leads"); }}
                        className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-[11px] font-medium uppercase tracking-widest text-white/40 bg-white/[0.03] hover:bg-white/[0.06] hover:text-white transition-all"
                      >
                        <Users size={11} />
                        Leads
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); onNavigate?.("expenses"); }}
                        className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-[11px] font-medium uppercase tracking-widest text-white/40 bg-white/[0.03] hover:bg-white/[0.06] hover:text-white transition-all"
                      >
                        <Wallet size={11} />
                        Budget
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); onNavigate?.("chatbot"); }}
                        className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-[11px] font-medium uppercase tracking-widest text-white/40 bg-white/[0.03] hover:bg-white/[0.06] hover:text-white transition-all"
                      >
                        <Settings size={11} />
                        Paramètres
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={(e) => { e.stopPropagation(); onNavigate?.("chatbot"); }}
                      className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-[11px] font-medium uppercase tracking-widest text-orange-400 bg-orange-500/10 hover:bg-orange-500/20 transition-all"
                    >
                      <Zap size={11} />
                      {overview?.step === "connect_page" ? "Connecter ma page" : "Terminer la configuration"}
                    </button>
                  )}
                </div>
              </div>

              <ArrowUpRight size={14} className="mt-1 shrink-0 text-white/15" />
            </div>
          </div>
        </motion.section>

        {/* Modules à venir */}
        <section>
          <p className="text-[10px] uppercase tracking-[0.14em] text-white/20 mb-4 px-1">
            Prochainement
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            {LOCKED_MODULES.map((mod, i) => (
              <motion.div
                key={mod.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.08 + i * 0.04 }}
                className="rounded-2xl bg-white/[0.015] p-5 opacity-60"
              >
                <div className="flex items-start gap-3">
                  <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.04] text-white/25">
                    <mod.icon size={17} />
                    <div className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--background)] border border-white/[0.06]">
                      <Lock size={8} className="text-white/30" />
                    </div>
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-[14px] font-medium text-white/60">{mod.title}</h3>
                      <span className="rounded-full bg-white/[0.04] px-2 py-0.5 text-[9px] font-medium text-white/20 uppercase tracking-wide">
                        Bientôt
                      </span>
                    </div>
                    <p className="mt-1 text-[12px] leading-5 text-white/25">{mod.description}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </section>

      </div>
    </div>
  );
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
