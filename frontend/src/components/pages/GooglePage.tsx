"use client";

import { motion } from "framer-motion";
import { BarChart3, Target, TrendingUp } from "lucide-react";
import PlatformCard from "@/components/PlatformCard";

const MODULES = [
  {
    id: "prospection",
    label: "Prospection",
    description: "Identifiez les bons prospects Google et captez la demande plus vite.",
    icon: Target,
  },
  {
    id: "google-ads",
    label: "Google Ads",
    description: "Pilotez vos campagnes et priorisez les actions qui ont un vrai impact.",
    icon: TrendingUp,
  },
  {
    id: "tableau-de-bord",
    label: "Tableau de bord",
    description: "Suivez les performances et les signaux utiles sans bruit inutile.",
    icon: BarChart3,
  },
];

export default function GooglePage() {
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto flex w-full max-w-[860px] flex-col gap-8 px-4 py-8 md:px-8 md:py-12">
        <motion.header
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="flex items-center gap-4"
        >
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-[var(--border-default)] bg-[var(--surface-subtle)]">
            <svg width="28" height="28" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
          </div>
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight text-[var(--text-primary)]">Google</h1>
            <p className="text-lg text-[var(--text-secondary)]">Modules a venir</p>
          </div>
        </motion.header>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="rounded-2xl border border-[var(--accent-navy)]/20 bg-[var(--accent-navy)]/6 px-5 py-4"
        >
          <p className="text-sm font-medium text-[var(--text-primary)]">
            Les modules Google arrivent prochainement. L&apos;objectif est de relier acquisition, suivi
            et pilotage dans un flux simple a utiliser.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3" role="list" aria-label="Modules Google">
          {MODULES.map((module, idx) => {
            const Icon = module.icon;
            return (
              <motion.div
                key={module.id}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.08 + idx * 0.06, ease: [0.16, 1, 0.3, 1] }}
                role="listitem"
              >
                <PlatformCard
                  icon={<Icon size={24} strokeWidth={1.8} className="text-[var(--text-secondary)]" />}
                  label={module.label}
                  description={module.description}
                  locked
                />
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
