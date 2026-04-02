"use client";

import { motion } from "framer-motion";
import { Rocket, Bot, BarChart3, ChevronRight } from "lucide-react";

const GUIDE_CARDS = [
  {
    id: "start",
    icon: Rocket,
    iconColor: "text-orange-400",
    iconBg: "bg-orange-500/12",
    title: "Démarrer en 5 min",
    description:
      "Connectez votre page Facebook, configurez l'identité de votre bot et lancez votre premier chatbot.",
    steps: ["Connecter une page Facebook", "Nommer le bot et définir son ton", "Ajouter vos produits ou services"],
  },
  {
    id: "chatbot",
    icon: Bot,
    iconColor: "text-blue-400",
    iconBg: "bg-blue-500/12",
    title: "Chatbot IA : comment ça marche",
    description:
      "Comprenez comment votre bot répond, qualifie les leads et vous signale les conversations qui nécessitent votre attention.",
    steps: ["Le bot répond 24h/24 aux messages", "Il qualifie les prospects selon vos critères", "Il vous alerte si une conversation dépasse ses capacités"],
  },
  {
    id: "kpis",
    icon: BarChart3,
    iconColor: "text-emerald-400",
    iconBg: "bg-emerald-500/12",
    title: "Lire vos KPIs",
    description:
      "Interprétez les indicateurs clés de votre tableau de bord pour piloter votre activité efficacement.",
    steps: ["Messages traités = volume d'activité du bot", "Contacts captés = leads générés ce mois", "Intervention requise = conversations à traiter manuellement"],
  },
];

export default function GuidePage() {
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-[800px] px-4 py-8 md:px-8 md:py-12 flex flex-col gap-8">

        {/* ── Header ── */}
        <motion.header
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="space-y-2"
        >
          <h1 className="text-3xl font-bold tracking-tight text-white/90">Guide</h1>
          <p className="text-lg text-[var(--text-muted)]">
            Tout ce qu&apos;il faut savoir pour bien utiliser FLARE AI
          </p>
        </motion.header>

        {/* ── Guide cards ── */}
        <div className="flex flex-col gap-4">
          {GUIDE_CARDS.map((card, idx) => {
            const Icon = card.icon;
            return (
              <motion.div
                key={card.id}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.06 + idx * 0.07, ease: [0.16, 1, 0.3, 1] }}
                className="rounded-2xl backdrop-blur-md bg-[var(--bg-glass)]
                           border border-[var(--border-glass)] shadow-[var(--shadow-card)]
                           px-6 py-6 flex flex-col gap-5"
              >
                <div className="flex items-center gap-4">
                  <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${card.iconBg}`}>
                    <Icon size={21} strokeWidth={1.8} className={card.iconColor} />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-white/90 leading-tight">{card.title}</h2>
                    <p className="mt-1 text-sm text-white/40 leading-snug">{card.description}</p>
                  </div>
                </div>

                <ul className="space-y-2 pl-2">
                  {card.steps.map((step, si) => (
                    <li key={si} className="flex items-start gap-2.5">
                      <ChevronRight size={14} className="mt-0.5 shrink-0 text-white/25" />
                      <span className="text-sm text-white/55 leading-snug">{step}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>
            );
          })}
        </div>

      </div>
    </div>
  );
}
