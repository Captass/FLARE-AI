"use client";

import { motion } from "framer-motion";
import { ArrowRight, BarChart3, BriefcaseBusiness, Building2, Crown } from "lucide-react";
import type { NavLevel } from "@/components/NavBreadcrumb";

interface GlobalDashboardPageProps {
  onPush: (level: NavLevel) => void;
}

const DESKS = [
  {
    title: "Business Desk",
    status: "Disponible",
    description: "Messages, leads, ventes et relation client.",
    metric: "1 module actif",
    target: "business-desk" as NavLevel,
    icon: BriefcaseBusiness,
  },
  {
    title: "Enterprise Desk",
    status: "Démo",
    description: "Demandes internes, base documentaire et reporting.",
    metric: "4 espaces prévus",
    target: "enterprise-desk" as NavLevel,
    icon: Building2,
  },
  {
    title: "Executive Desk",
    status: "Nouveau",
    description: "Mails, planning, contacts, priorités et fichiers.",
    metric: "5 vues prêtes",
    target: "executive-desk" as NavLevel,
    icon: Crown,
  },
];

export default function GlobalDashboardPage({ onPush }: GlobalDashboardPageProps) {
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto flex w-full max-w-[1080px] flex-col gap-8 px-4 py-8 md:px-8 md:py-12">
        <motion.header
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="rounded-[28px] border border-[var(--border-default)] bg-[var(--bg-card)] p-6 md:p-8"
        >
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div className="max-w-2xl">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-orange-500/20 bg-orange-500/10 px-3 py-1 text-xs font-semibold text-orange-600 dark:text-orange-300">
                <BarChart3 size={14} />
                Vue globale
              </div>
              <h1 className="text-3xl font-black tracking-tight text-[var(--text-primary)] md:text-4xl">
                Tableau de bord global
              </h1>
              <p className="mt-3 text-base leading-relaxed text-[var(--text-secondary)]">
                Suivez les espaces FLARE AI disponibles aujourd’hui et les modules prêts pour la démo.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onPush("executive-desk")}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-orange-500 px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-orange-600"
            >
              Ouvrir Executive Desk
              <ArrowRight size={16} />
            </button>
          </div>
        </motion.header>

        <section className="grid gap-4 md:grid-cols-3">
          {DESKS.map((desk, index) => {
            const Icon = desk.icon;
            return (
              <motion.button
                key={desk.title}
                type="button"
                onClick={() => onPush(desk.target)}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: index * 0.06 }}
                className="group rounded-[24px] border border-[var(--border-default)] bg-[var(--bg-card)] p-5 text-left shadow-[0_12px_30px_rgba(15,23,42,0.04)] transition-all hover:border-orange-500/25 hover:bg-[var(--surface-subtle)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-orange-500/10 text-orange-500">
                    <Icon size={21} />
                  </div>
                  <span className="rounded-full border border-[var(--border-default)] bg-[var(--surface-subtle)] px-2.5 py-1 text-[11px] font-semibold text-[var(--text-secondary)]">
                    {desk.status}
                  </span>
                </div>
                <h2 className="mt-5 text-xl font-bold text-[var(--text-primary)]">{desk.title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">{desk.description}</p>
                <div className="mt-5 flex items-center justify-between gap-3 border-t border-[var(--border-default)] pt-4">
                  <span className="text-sm font-semibold text-[var(--text-primary)]">{desk.metric}</span>
                  <ArrowRight size={15} className="text-orange-500 transition-transform group-hover:translate-x-1" />
                </div>
              </motion.button>
            );
          })}
        </section>
      </div>
    </div>
  );
}
