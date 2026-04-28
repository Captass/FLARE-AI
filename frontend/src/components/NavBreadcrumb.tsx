"use client";

import { ChevronRight, ArrowLeft } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export type NavLevel =
  | "home"
  | "global-dashboard"
  | "business-desk"
  | "enterprise-desk"
  | "executive-desk"
  | "executive-mail"
  | "executive-planning"
  | "executive-contacts"
  | "executive-files"
  | "automations"
  | "facebook"
  | "google"
  | "chatbot"
  | "leads"
  | "conversations"
  | "expenses"
  | "chatbotFiles"
  | "chatbot-personnalisation"
  | "chatbot-parametres"
  | "chatbot-dashboard"
  | "chatbot-clients"
  | "chatbot-client-detail"
  | "chatbot-orders"
  | "chatbot-activation"
  | "admin"
  | "assistant"
  | "memory"
  | "prompts"
  | "knowledge"
  | "files"
  | "automationHub"
  | "prospection"
  | "content"
  | "followup"
  | "agents"
  | "guide"
  | "billing"
  | "contact"
  | "settings";

export const NAV_LABELS: Record<NavLevel, string> = {
  home: "Accueil",
  "global-dashboard": "Tableau de bord global",
  "business-desk": "Business Desk",
  "enterprise-desk": "Enterprise Desk",
  "executive-desk": "Vue du jour",
  "executive-mail": "Assistant Mail",
  "executive-planning": "Planning",
  "executive-contacts": "Contacts intelligents",
  "executive-files": "Organisation fichiers",
  automations: "Automatisations",
  facebook: "Facebook",
  google: "Google",
  chatbot: "Facebook",
  leads: "Leads Facebook",
  conversations: "Discussions Facebook",
  expenses: "Budget Facebook",
  chatbotFiles: "Fichiers Facebook",
  "chatbot-personnalisation": "Personnalisation",
  "chatbot-parametres": "Parametres",
  "chatbot-dashboard": "Tableau de bord Facebook",
  "chatbot-clients": "Clients & Conversations",
  "chatbot-client-detail": "Fiche client",
  "chatbot-orders": "Commandes",
  "chatbot-activation": "Activation Facebook",
  admin: "Administration",
  assistant: "Assistant IA",
  memory: "Memoire",
  prompts: "Prompts",
  knowledge: "Base de connaissances",
  files: "Fichiers",
  automationHub: "Hub",
  prospection: "Prospection",
  content: "Studio contenu",
  followup: "Suivi client",
  agents: "Agents",
  guide: "Guide",
  billing: "Abonnements",
  contact: "Contactez-nous",
  settings: "Parametres",
};

interface NavBreadcrumbProps {
  navStack: NavLevel[];
  onPop: () => void;
}

export default function NavBreadcrumb({ navStack, onPop }: NavBreadcrumbProps) {
  const canGoBack = navStack.length > 1;

  return (
    <motion.div
      key={navStack.join("-")}
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      className="flex items-center gap-2 px-4 py-3 md:px-6"
    >
      <AnimatePresence>
        {canGoBack && (
          <motion.button
            key="back-btn"
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -8 }}
            transition={{ duration: 0.18 }}
            onClick={onPop}
            aria-label="Retour"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--border-default)] bg-[var(--surface-subtle)] text-[var(--text-primary)] transition-all duration-150 hover:border-[var(--border-strong)] hover:bg-[var(--surface-raised)]"
          >
            <ArrowLeft size={15} />
          </motion.button>
        )}
      </AnimatePresence>

      <nav aria-label="Navigation" className="flex min-w-0 items-center gap-1 overflow-hidden">
        {navStack.map((level, idx) => {
          const isLast = idx === navStack.length - 1;
          const label = NAV_LABELS[level] ?? level;

          return (
            <span key={`${level}-${idx}`} className="flex min-w-0 items-center gap-1">
              {idx > 0 && <ChevronRight size={12} className="shrink-0 text-[var(--text-muted)]" aria-hidden />}
              <span
                className={`truncate text-sm font-medium transition-colors duration-150 ${
                  isLast
                    ? "text-[var(--text-primary)]"
                    : "cursor-default text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                }`}
              >
                {label}
              </span>
            </span>
          );
        })}
      </nav>
    </motion.div>
  );
}
