"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Check, X } from "lucide-react";
import type { NavLevel } from "@/components/NavBreadcrumb";
import InfoTooltip from "@/components/InfoTooltip";
import { ColorfulBriefcaseIcon, ColorfulBuildingIcon, ColorfulCrownIcon } from "@/components/icons/WorkspaceIcons";
import { 
  emitWorkspaceChange, 
  FLARE_WORKSPACE_STORAGE_KEY, 
  type FlareWorkspaceId 
} from "@/lib/workspacePreferences";

function ColorfulSparklesIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M24 4L28 16L40 20L28 24L24 36L20 24L8 20L20 16L24 4Z" fill="#FF7A00" />
      <path d="M38 30L40 36L46 38L40 40L38 46L36 40L30 38L36 36L38 30Z" fill="#FFB266" />
      <path d="M10 6L11 9L14 10L11 11L10 14L9 11L6 10L9 9L10 6Z" fill="#2563EB" />
    </svg>
  );
}

interface HomePageProps {
  displayName: string;
  token?: string | null;
  onPush: (level: NavLevel) => void;
}

const DESK_CARDS = [
  {
    workspace: "business" as FlareWorkspaceId,
    title: "Business Desk",
    short: "Messages, leads et ventes.",
    detail: "FLARE AI automatise les messages Facebook, classe les leads, facilite le suivi client et garde vos ventes visibles.",
    badge: "Disponible",
    action: "Ouvrir",
    target: "business-desk" as NavLevel,
    icon: ColorfulBriefcaseIcon,
  },
  {
    workspace: "enterprise" as FlareWorkspaceId,
    title: "Enterprise Desk",
    short: "Demandes internes et pilotage.",
    detail: "FLARE AI centralise les demandes internes, prépare le suivi des équipes et pose les bases d'un assistant documentaire.",
    badge: "Démo",
    action: "Ouvrir",
    target: "enterprise-desk" as NavLevel,
    icon: ColorfulBuildingIcon,
  },
  {
    workspace: "executive" as FlareWorkspaceId,
    title: "Executive Desk",
    short: "Mails, planning et priorités.",
    detail: "FLARE AI organise vos mails, votre journée, vos contacts et vos fichiers pour garder l'essentiel au premier plan.",
    badge: "Nouveau",
    action: "Ouvrir",
    target: "executive-desk" as NavLevel,
    icon: ColorfulCrownIcon,
  },
];

export default function HomePage({ displayName, onPush }: HomePageProps) {
  const [recommendationOpen, setRecommendationOpen] = useState(false);
  const [defaultWorkspace, setDefaultWorkspace] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      return window.localStorage.getItem(FLARE_WORKSPACE_STORAGE_KEY);
    }
    return null;
  });

  const defineDefault = (workspace: FlareWorkspaceId) => {
    window.localStorage.setItem(FLARE_WORKSPACE_STORAGE_KEY, workspace);
    setDefaultWorkspace(workspace);
    emitWorkspaceChange(workspace);
  };

  const openWorkspace = (workspace: FlareWorkspaceId, target: NavLevel) => {
    defineDefault(workspace);
    onPush(target);
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto flex w-full max-w-[1040px] flex-col gap-6 px-4 py-8 md:px-8 md:py-10">
        <motion.header
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="relative overflow-hidden rounded-[32px] border border-[var(--border-default)] bg-[var(--bg-card)] p-8 md:p-10 shadow-xl shadow-slate-200/50"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-orange-500/5" />
          <div className="relative z-10 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-orange-500/20 bg-orange-500/5 px-4 py-1.5 text-xs font-black uppercase tracking-wider text-orange-600">
                <ColorfulSparklesIcon size={16} />
                Plateforme modulaire
              </div>
              <h1 className="text-4xl font-black tracking-tight text-[var(--text-primary)] md:text-5xl">
                Bonjour <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">{displayName || "Utilisateur"}</span>
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-relaxed text-[var(--text-secondary)] md:text-lg font-medium">
                Prêt pour une journée productive ? Choisissez votre bureau FLARE AI.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setRecommendationOpen(true)}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white border border-[var(--border-default)] px-6 py-4 text-sm font-black text-blue-600 shadow-sm transition-all hover:bg-blue-50 hover:border-blue-200 hover:-translate-y-0.5"
            >
              Que dois-je faire maintenant ?
            </button>
          </div>
        </motion.header>

        <section className="grid gap-4 lg:grid-cols-3">
          {DESK_CARDS.map((card, index) => {
            const Icon = card.icon;
            return (
              <motion.article
                key={card.title}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.26, delay: index * 0.05, ease: [0.16, 1, 0.3, 1] }}
                className="group relative rounded-[32px] border border-[var(--border-default)] bg-[var(--bg-card)] p-6 shadow-lg shadow-slate-200/50 transition-all hover:border-blue-500/30 hover:shadow-2xl hover:shadow-blue-500/5 hover:-translate-y-1"
              >
                <div className="absolute inset-0 overflow-hidden rounded-[32px]">
                  <div className="absolute inset-0 bg-gradient-to-br from-[var(--surface-subtle)] to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                </div>
                <div className="relative z-20 flex items-start justify-between gap-3">
                  <div className="flex h-14 w-14 items-center justify-center rounded-[20px] bg-white border border-[var(--border-default)] shadow-sm transition-transform group-hover:scale-110 group-hover:rotate-3">
                    <Icon size={32} />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full border border-orange-500/10 bg-orange-500/5 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-orange-600">
                      {card.badge}
                    </span>
                    <InfoTooltip text={card.detail} />
                  </div>
                </div>
                <h2 className="relative z-10 mt-6 text-2xl font-black tracking-tight text-[var(--text-primary)]">{card.title}</h2>
                <p className="relative z-10 mt-2 text-sm font-semibold leading-relaxed text-[var(--text-secondary)]">{card.short}</p>
                <div className="relative z-10 mt-8 flex flex-col gap-3">
                  <button
                    type="button"
                    onClick={() => openWorkspace(card.workspace, card.target)}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-4 text-sm font-black text-white shadow-lg shadow-blue-500/30 transition-all hover:bg-blue-700 hover:shadow-xl hover:shadow-blue-500/40"
                  >
                    {card.action}
                    <ArrowRight size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => defineDefault(card.workspace)}
                    disabled={defaultWorkspace === card.workspace}
                    className={`inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3.5 text-sm font-bold transition-all
                      ${defaultWorkspace === card.workspace
                        ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                        : "border border-[var(--border-default)] bg-[var(--surface-subtle)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
                      }`}
                  >
                    {defaultWorkspace === card.workspace && <Check size={16} />}
                    {defaultWorkspace === card.workspace ? "Défini par défaut" : "Définir par défaut"}
                  </button>
                </div>
              </motion.article>
            );
          })}
        </section>
      </div>

      <AnimatePresence>
        {recommendationOpen && (
          <motion.div
            className="fixed inset-0 z-[160] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setRecommendationOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: 14, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.98 }}
              className="w-full max-w-[420px] rounded-[26px] border border-[var(--border-default)] bg-[var(--bg-card)] p-5 shadow-[0_30px_80px_rgba(0,0,0,0.3)] backdrop-blur-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-orange-500">Conseil FLARE</p>
                  <h2 className="mt-1 text-xl font-black text-[var(--text-primary)]">Commencez par un espace.</h2>
                </div>
                <button type="button" onClick={() => setRecommendationOpen(false)} className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--surface-subtle)] text-[var(--text-secondary)]">
                  <X size={15} />
                </button>
              </div>
              <p className="mt-4 text-sm leading-relaxed text-[var(--text-secondary)]">
                Pour une démo rapide, ouvrez Executive Desk : vous verrez les mails, priorités, rendez-vous et fichiers à traiter en moins d&apos;une minute.
              </p>
              <button
                type="button"
                onClick={() => {
                  setRecommendationOpen(false);
                  openWorkspace("executive", "executive-desk");
                }}
                className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-orange-500 px-4 py-3 text-sm font-bold text-white hover:bg-orange-600"
              >
                Ouvrir Executive Desk
                <ArrowRight size={15} />
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
