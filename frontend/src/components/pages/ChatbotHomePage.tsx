"use client";

import { motion } from "framer-motion";
import { Brush, SlidersHorizontal, BarChart3, Users } from "lucide-react";
import PlatformCard, { NotifBadge } from "@/components/PlatformCard";
import type { NavLevel } from "@/components/NavBreadcrumb";
import PageSelector from "@/components/PageSelector";
import type { FacebookMessengerPage } from "@/lib/facebookMessenger";

import { useState, useEffect, useCallback } from "react";
import { loadMessengerDashboardData, type MessengerDashboardData } from "@/lib/messengerDirect";
import { MessageSquare, Bot } from "lucide-react";

interface ChatbotHomePageProps {
  token?: string | null;
  getFreshToken?: (forceRefresh?: boolean) => Promise<string | null>;
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

export default function ChatbotHomePage({ token, getFreshToken, onPush, pendingHumanCount = 0, pages = [], selectedPageId = null, onSelectPage }: ChatbotHomePageProps) {
  const hasPageSelected = Boolean(selectedPageId);
  const [dashData, setDashData] = useState<MessengerDashboardData | null>(null);
  const [loadingKPIs, setLoadingKPIs] = useState(false);

  const loadKPIs = useCallback(async () => {
    let t = token;
    if (getFreshToken) t = await getFreshToken() || token;
    if (!t || !selectedPageId) {
      setDashData(null);
      return;
    }
    setLoadingKPIs(true);
    try {
      const dash = await loadMessengerDashboardData(t, selectedPageId);
      setDashData(dash);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingKPIs(false);
    }
  }, [token, getFreshToken, selectedPageId]);

  useEffect(() => {
    void loadKPIs();
  }, [loadKPIs]);

  const messagesCeMois = dashData?.periodStats?.[0]?.messages ?? 0;
  const contactsCaptes = dashData?.totals?.contacts ?? 0;

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

        {/* ── Aperçu KPIs (Si page sélectionnée) ── */}
        {hasPageSelected && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="grid grid-cols-1 md:grid-cols-3 gap-4"
          >
            {/* Statut Rapide */}
            <div className="p-4 rounded-2xl border border-fg/[0.08] bg-fg/[0.02] flex items-center justify-between hover:bg-fg/[0.03] transition-colors">
              <div>
                <p className="text-xs uppercase tracking-wider text-[var(--text-muted)] font-semibold">Statut Bot</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                  </span>
                  <p className="text-lg font-bold text-fg/90">En ligne</p>
                </div>
              </div>
              <div className="bg-emerald-500/10 text-emerald-400 p-2.5 rounded-xl">
                <Bot size={20} />
              </div>
            </div>

            {/* Messages Récents */}
            <div className="p-4 rounded-2xl border border-fg/[0.08] bg-fg/[0.02] flex items-center justify-between hover:bg-fg/[0.03] transition-colors">
              <div>
                <p className="text-xs uppercase tracking-wider text-[var(--text-muted)] font-semibold">Messages ce mois</p>
                <p className="mt-1 text-lg font-bold text-fg/90">{loadingKPIs ? "..." : messagesCeMois}</p>
              </div>
              <div className="bg-blue-500/10 text-blue-400 p-2.5 rounded-xl">
                <MessageSquare size={20} />
              </div>
            </div>

            {/* Contacts Captés */}
            <div className="p-4 rounded-2xl border border-fg/[0.08] bg-fg/[0.02] flex items-center justify-between hover:bg-fg/[0.03] transition-colors">
              <div>
                <p className="text-xs uppercase tracking-wider text-[var(--text-muted)] font-semibold">Contacts captés</p>
                <p className="mt-1 text-lg font-bold text-fg/90">{loadingKPIs ? "..." : contactsCaptes}</p>
              </div>
              <div className="bg-orange-500/10 text-orange-400 p-2.5 rounded-xl">
                <Users size={20} />
              </div>
            </div>
          </motion.div>
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
