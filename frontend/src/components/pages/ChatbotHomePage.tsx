"use client";

import { motion } from "framer-motion";
import { Brush, SlidersHorizontal, BarChart3, Users } from "lucide-react";
import PlatformCard, { NotifBadge } from "@/components/PlatformCard";
import type { NavLevel } from "@/components/NavBreadcrumb";
import PageSelector from "@/components/PageSelector";
import type { FacebookMessengerPage } from "@/lib/facebookMessenger";

interface ChatbotHomePageProps {
  onPush: (level: NavLevel) => void;
  /** Nombre de conversations nécessitant une intervention humaine */
  pendingHumanCount?: number;
  pages?: FacebookMessengerPage[];
  selectedPageId?: string | null;
  onSelectPage?: (pageId: string) => void;
}

const ENTRIES = [
  {
    id: "chatbot-personnalisation" as NavLevel,
    label: "Personnalisation",
    description: "Identité, ton, langue, entreprise et offres du bot",
    icon: Brush,
    iconColor: "text-purple-400",
    iconBg: "bg-purple-500/12",
  },
  {
    id: "chatbot-parametres" as NavLevel,
    label: "Paramètres",
    description: "Catalogue, portfolio et connexion Facebook",
    icon: SlidersHorizontal,
    iconColor: "text-cyan-400",
    iconBg: "bg-cyan-500/12",
  },
  {
    id: "chatbot-dashboard" as NavLevel,
    label: "Tableau de bord",
    description: "Stats, statut d'activité et vérification Facebook",
    icon: BarChart3,
    iconColor: "text-emerald-400",
    iconBg: "bg-emerald-500/12",
  },
  {
    id: "chatbot-clients" as NavLevel,
    label: "Clients & Conversations",
    description: "Suivi, notifications et contrôle par client",
    icon: Users,
    iconColor: "text-orange-400",
    iconBg: "bg-orange-500/12",
  },
];

export default function ChatbotHomePage({ onPush, pendingHumanCount = 0, pages = [], selectedPageId = null, onSelectPage }: ChatbotHomePageProps) {
  const hasPageSelected = Boolean(selectedPageId);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-[860px] px-4 py-8 md:px-8 md:py-12 flex flex-col gap-8">

        {/* ── Header & Page Selector ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col gap-6 bg-fg/[0.02] border border-fg/[0.05] p-6 rounded-3xl relative overflow-hidden"
        >
          {/* Decorative glow */}
          <div className="absolute -top-24 -left-24 w-48 h-48 bg-orange-500/20 blur-[80px] rounded-full pointer-events-none" />
          
          <div className="relative z-10">
            <h1 className="text-3xl font-bold tracking-tight text-fg/90 mb-2">
              Chatbot IA Facebook
            </h1>
            <p className="text-lg text-[var(--text-muted)] mb-6">
              Sélectionnez la page Facebook que vous souhaitez configurer.
            </p>
            
            <PageSelector
              pages={pages}
              selectedPageId={selectedPageId}
              onSelect={(pid) => onSelectPage?.(pid)}
              onAddPage={() => onPush("chatbot-parametres")}
            />
          </div>
        </motion.div>

        {!hasPageSelected && pages.length > 0 && (
           <div className="text-center p-4 text-orange-400/80 bg-orange-500/10 rounded-xl border border-orange-500/20">
             Veuillez sélectionner une page ci-dessus pour configurer son Chatbot.
           </div>
        )}

        {/* ── Entry cards ── */}
        <div className={`grid grid-cols-1 gap-4 sm:grid-cols-2 transition-opacity duration-300 ${hasPageSelected ? 'opacity-100' : 'opacity-40 pointer-events-none'}`} role="list" aria-label="Sections du Chatbot IA">
          {ENTRIES.map((entry, idx) => {
            const Icon = entry.icon;
            const isClientsCard = entry.id === "chatbot-clients";

            return (
              <motion.div
                key={entry.id}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.06 + idx * 0.07, ease: [0.16, 1, 0.3, 1] }}
                role="listitem"
              >
                <PlatformCard
                  icon={
                    <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${entry.iconBg}`}>
                      <Icon size={20} strokeWidth={1.8} className={entry.iconColor} />
                    </div>
                  }
                  label={entry.label}
                  description={entry.description}
                  locked={false}
                  glowColor="#FF7C1A"
                  badge={
                    isClientsCard && pendingHumanCount > 0
                      ? <NotifBadge count={pendingHumanCount} />
                      : undefined
                  }
                  onClick={() => onPush(entry.id)}
                />
              </motion.div>
            );
          })}
        </div>

      </div>
    </div>
  );
}
