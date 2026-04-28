"use client";

import { motion } from "framer-motion";
import { BarChart3, Bot, Building2, FileText, Inbox } from "lucide-react";

const ENTERPRISE_CARDS = [
  { title: "Demandes internes", description: "Centraliser les demandes et suivre leur traitement.", icon: Inbox },
  { title: "Assistant IA interne", description: "Aider les équipes à retrouver et préparer l’information.", icon: Bot },
  { title: "Base documentaire", description: "Structurer les documents utiles à l’organisation.", icon: FileText },
  { title: "Rapports & Dashboard", description: "Donner une vue claire aux responsables et directions.", icon: BarChart3 },
];

export default function EnterpriseDeskPage() {
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto flex w-full max-w-[980px] flex-col gap-8 px-4 py-8 md:px-8 md:py-12">
        <motion.header
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="rounded-[28px] border border-[var(--border-default)] bg-[var(--bg-card)] p-6 md:p-8"
        >
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-orange-500/20 bg-orange-500/10 px-3 py-1 text-xs font-semibold text-orange-600 dark:text-orange-300">
            <Building2 size={14} />
            Démo bientôt disponible
          </div>
          <h1 className="text-3xl font-black tracking-tight text-[var(--text-primary)] md:text-4xl">
            Enterprise Desk
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-[var(--text-secondary)]">
            Centralisez les demandes internes, automatisez le suivi et assistez vos équipes avec l’IA.
          </p>
        </motion.header>

        <section className="grid gap-4 sm:grid-cols-2">
          {ENTERPRISE_CARDS.map((card, index) => {
            const Icon = card.icon;
            return (
              <motion.div
                key={card.title}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: index * 0.06 }}
                className="rounded-[24px] border border-[var(--border-default)] bg-[var(--bg-card)] p-5"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-orange-500/10 text-orange-500">
                  <Icon size={21} />
                </div>
                <h2 className="mt-5 text-xl font-bold text-[var(--text-primary)]">{card.title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">{card.description}</p>
              </motion.div>
            );
          })}
        </section>
      </div>
    </div>
  );
}
