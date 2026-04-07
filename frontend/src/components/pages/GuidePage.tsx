"use client";

import { motion } from "framer-motion";
import { Rocket, Bot, BarChart3, ChevronRight } from "lucide-react";

const GUIDE_CARDS = [
  {
    id: "start",
    icon: Rocket,
    iconColor: "text-orange-500 dark:text-orange-300",
    iconBg: "bg-orange-500/12",
    title: "Demarrer en 5 min",
    description:
      "Connectez votre page Facebook, configurez l'identite de votre bot et lancez votre premier chatbot.",
    steps: ["Connecter une page Facebook", "Nommer le bot et definir son ton", "Ajouter vos produits ou services"],
  },
  {
    id: "chatbot",
    icon: Bot,
    iconColor: "text-[var(--accent-navy)] dark:text-[rgb(183,203,255)]",
    iconBg: "bg-[rgba(12,32,74,0.12)] dark:bg-[rgba(122,158,255,0.16)]",
    title: "Chatbot IA : comment ca marche",
    description:
      "Comprenez comment votre bot repond, qualifie les leads et vous signale les conversations qui necessitent votre attention.",
    steps: ["Le bot repond 24h/24 aux messages", "Il qualifie les prospects selon vos criteres", "Il vous alerte si une conversation depasse ses capacites"],
  },
  {
    id: "kpis",
    icon: BarChart3,
    iconColor: "text-orange-500 dark:text-orange-300",
    iconBg: "bg-orange-500/12",
    title: "Lire vos KPIs",
    description:
      "Interpretez les indicateurs cles de votre tableau de bord pour piloter votre activite efficacement.",
    steps: ["Messages traites = volume d'activite du bot", "Contacts captes = leads generes ce mois", "Intervention requise = conversations a traiter manuellement"],
  },
] as const;

export default function GuidePage() {
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto flex w-full max-w-[800px] flex-col gap-8 px-4 py-8 md:px-8 md:py-12">
        <motion.header
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="space-y-2"
        >
          <h1 className="text-3xl font-bold tracking-tight text-[var(--text-primary)]">Guide</h1>
          <p className="text-lg text-[var(--text-muted)]">
            Tout ce qu&apos;il faut savoir pour bien utiliser FLARE AI
          </p>
        </motion.header>

        <div className="flex flex-col gap-4">
          {GUIDE_CARDS.map((card, idx) => {
            const Icon = card.icon;
            return (
              <motion.div
                key={card.id}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.06 + idx * 0.07, ease: [0.16, 1, 0.3, 1] }}
                className="flex flex-col gap-5 rounded-2xl border border-[var(--border-default)] bg-[var(--surface-base)] px-6 py-6 shadow-[var(--shadow-card)]"
              >
                <div className="flex items-center gap-4">
                  <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${card.iconBg}`}>
                    <Icon size={21} strokeWidth={1.8} className={card.iconColor} />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold leading-tight text-[var(--text-primary)]">{card.title}</h2>
                    <p className="mt-1 text-sm leading-snug text-[var(--text-secondary)]">{card.description}</p>
                  </div>
                </div>

                <ul className="space-y-2 pl-2">
                  {card.steps.map((step, si) => (
                    <li key={si} className="flex items-start gap-2.5">
                      <ChevronRight size={14} className="mt-0.5 shrink-0 text-[var(--text-muted)]" />
                      <span className="text-sm leading-snug text-[var(--text-secondary)]">{step}</span>
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
