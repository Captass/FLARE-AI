"use client";

import { motion } from "framer-motion";
import { ArrowRight, Bot, BriefcaseBusiness, Megaphone, Users } from "lucide-react";
import type { NavLevel } from "@/components/NavBreadcrumb";

interface BusinessDeskPageProps {
  onPush: (level: NavLevel) => void;
}

const BUSINESS_ACTIONS = [
  {
    title: "Chatbot Facebook",
    description: "Piloter le chatbot, les pages connectées et l’activation Messenger.",
    target: "chatbot" as NavLevel,
    icon: Bot,
  },
  {
    title: "Leads / Contacts",
    description: "Suivre les conversations et contacts issus de Facebook.",
    target: "chatbot-clients" as NavLevel,
    icon: Users,
  },
  {
    title: "Automatisations Business",
    description: "Voir les modules disponibles et les automatisations à venir.",
    target: "automationHub" as NavLevel,
    icon: Megaphone,
  },
];

export default function BusinessDeskPage({ onPush }: BusinessDeskPageProps) {
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
            <BriefcaseBusiness size={14} />
            Disponible
          </div>
          <h1 className="text-3xl font-black tracking-tight text-[var(--text-primary)] md:text-4xl">
            FLARE AI Business Desk
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-[var(--text-secondary)]">
            Automatisez vos messages, vos leads, vos ventes et votre relation client sans reconstruire votre parcours actuel.
          </p>
        </motion.header>

        <section className="grid gap-4 md:grid-cols-3">
          {BUSINESS_ACTIONS.map((action, index) => {
            const Icon = action.icon;
            return (
              <motion.button
                key={action.title}
                type="button"
                onClick={() => onPush(action.target)}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: index * 0.06 }}
                className="group rounded-[24px] border border-[var(--border-default)] bg-[var(--bg-card)] p-5 text-left transition-all hover:border-orange-500/25 hover:bg-[var(--surface-subtle)]"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-orange-500/10 text-orange-500">
                  <Icon size={21} />
                </div>
                <h2 className="mt-5 text-xl font-bold text-[var(--text-primary)]">{action.title}</h2>
                <p className="mt-2 min-h-[66px] text-sm leading-relaxed text-[var(--text-secondary)]">
                  {action.description}
                </p>
                <span className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-orange-500">
                  Ouvrir
                  <ArrowRight size={15} className="transition-transform group-hover:translate-x-1" />
                </span>
              </motion.button>
            );
          })}
        </section>

        <section className="rounded-[24px] border border-[var(--border-default)] bg-[var(--bg-card)] p-6">
          <h2 className="text-xl font-bold text-[var(--text-primary)]">Relation client / ventes</h2>
          <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">
            Cette première version conserve le cockpit Facebook existant comme module business principal. Les prochaines vues pourront étendre le suivi commercial sans modifier l’activation actuelle.
          </p>
        </section>
      </div>
    </div>
  );
}
