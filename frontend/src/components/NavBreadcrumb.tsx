"use client";

import { ChevronRight, ArrowLeft } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export type NavLevel =
  | "home"
  | "automations"
  | "facebook"
  | "google"
  | "chatbot"
  | "chatbot-personnalisation"
  | "chatbot-parametres"
  | "chatbot-dashboard"
  | "chatbot-clients"
  | "chatbot-client-detail"
  | "chatbot-orders"
  | "chatbot-activation"
  | "assistant"
  | "guide"
  | "billing"
  | "contact"
  | "settings";

export const NAV_LABELS: Record<NavLevel, string> = {
  home: "Accueil",
  automations: "Automatisations",
  facebook: "Facebook",
  google: "Google",
  chatbot: "Chatbot IA",
  "chatbot-personnalisation": "Personnalisation",
  "chatbot-parametres": "Paramètres",
  "chatbot-dashboard": "Tableau de bord",
  "chatbot-clients": "Clients & Conversations",
  "chatbot-client-detail": "Fiche client",
  "chatbot-orders": "Commandes",
  "chatbot-activation": "Activation",
  assistant: "Assistant IA",
  guide: "Guide",
  billing: "Abonnements",
  contact: "Contactez-nous",
  settings: "Paramètres",
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
      {/* Back button */}
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
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg
                       text-white/30 hover:text-white/70 hover:bg-white/[0.05]
                       transition-all duration-150"
          >
            <ArrowLeft size={15} />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Breadcrumb trail */}
      <nav
        aria-label="Navigation"
        className="flex items-center gap-1 min-w-0 overflow-hidden"
      >
        {navStack.map((level, idx) => {
          const isLast = idx === navStack.length - 1;
          const label = NAV_LABELS[level] ?? level;

          return (
            <span key={`${level}-${idx}`} className="flex items-center gap-1 min-w-0">
              {idx > 0 && (
                <ChevronRight
                  size={12}
                  className="shrink-0 text-white/15"
                  aria-hidden
                />
              )}
              <span
                className={`truncate text-sm font-medium transition-colors duration-150 ${
                  isLast
                    ? "text-white/80"
                    : "text-white/25 hover:text-white/50 cursor-default"
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
