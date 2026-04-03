"use client";

import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import { Brush, SlidersHorizontal, BarChart3, Users, Loader2, MessageSquare, Bot } from "lucide-react";
import PlatformCard, { NotifBadge } from "@/components/PlatformCard";
import type { NavLevel } from "@/components/NavBreadcrumb";
import PageSelector from "@/components/PageSelector";
import {
  loadFacebookMessengerStatus,
  activateFacebookMessengerPage,
  resyncFacebookMessengerPages,
  runFacebookMessengerOAuthPopup,
  type FacebookMessengerPage,
} from "@/lib/facebookMessenger";

import { useState, useEffect, useCallback } from "react";
import { loadMessengerDashboardData, type MessengerDashboardData } from "@/lib/messengerDirect";
import { getChatbotOverview, type ChatbotOverview } from "@/lib/api";
import { KPI_POLL_INTERVAL_MS } from "@/lib/kpiPolling";
import type { ChatbotSetupStatus } from "@/lib/chatbotSetup";

const ChatbotSetupWizard = dynamic(() => import("@/components/ChatbotSetupWizard"), {
  ssr: false,
  loading: () => (
    <div className="flex justify-center py-16">
      <Loader2 className="h-8 w-8 animate-spin text-orange-400/80" aria-hidden />
    </div>
  ),
});

interface ChatbotHomePageProps {
  token?: string | null;
  getFreshToken?: (forceRefresh?: boolean) => Promise<string | null>;
  onPush: (level: NavLevel) => void;
  /** Nombre de conversations nécessitant une intervention humaine */
  pendingHumanCount?: number;
  pages?: FacebookMessengerPage[];
  selectedPageId?: string | null;
  onSelectPage?: (pageId: string) => void;
  /** Remonte la liste des pages (après OAuth ou activation) vers page.tsx */
  onPagesChanged?: (pages: FacebookMessengerPage[]) => void;
  /** Statut du parcours d’installation (connexion → préférences) */
  setupStatus?: ChatbotSetupStatus | null;
  onRefreshSetupStatus?: () => Promise<ChatbotSetupStatus | null>;
  onRequestOrganizationSelection?: () => void;
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

export default function ChatbotHomePage({
  token,
  getFreshToken,
  onPush,
  pendingHumanCount = 0,
  pages = [],
  selectedPageId = null,
  onSelectPage,
  onPagesChanged,
  setupStatus = null,
  onRefreshSetupStatus,
  onRequestOrganizationSelection,
}: ChatbotHomePageProps) {
  const [skipSetupWizard, setSkipSetupWizard] = useState(false);

  useEffect(() => {
    if (setupStatus?.step === "complete") {
      setSkipSetupWizard(false);
    }
  }, [setupStatus?.step]);

  const showSetupWizard =
    Boolean(setupStatus && setupStatus.step !== "complete" && !skipSetupWizard);

  const hasPageSelected = Boolean(selectedPageId);
  const [dashData, setDashData] = useState<MessengerDashboardData | null>(null);
  const [overview, setOverview] = useState<ChatbotOverview | null>(null);
  const [loadingKPIs, setLoadingKPIs] = useState(false);
  const [lastKpiUpdate, setLastKpiUpdate] = useState<Date | null>(null);
  const [canManageFb, setCanManageFb] = useState(false);
  const [fbBusyPageId, setFbBusyPageId] = useState<string | null>(null);
  const [pagesRefreshBusy, setPagesRefreshBusy] = useState(false);
  const [fbOauthBusy, setFbOauthBusy] = useState(false);
  const [activationNotice, setActivationNotice] = useState<string | null>(null);

  const resolveToken = useCallback(async () => {
    if (getFreshToken) return (await getFreshToken()) || token || null;
    return token ?? null;
  }, [getFreshToken, token]);

  const syncFacebookPages = useCallback(async () => {
    const t = await resolveToken();
    if (!t) return;
    try {
      const st = await loadFacebookMessengerStatus(t);
      setCanManageFb(st.can_manage_pages);
      if (st.pages?.length) onPagesChanged?.(st.pages);
    } catch {
      /* ignore: statut Meta optionnel au chargement hub */
    }
  }, [resolveToken, onPagesChanged]);

  useEffect(() => {
    void syncFacebookPages();
  }, [syncFacebookPages]);

  const handleActivatePage = useCallback(
    async (pageId: string) => {
      const t = await resolveToken();
      if (!t || !canManageFb) return;
      setFbBusyPageId(pageId);
      try {
        const responsePage = await activateFacebookMessengerPage(pageId, t);
        const st = await loadFacebookMessengerStatus(t);
        
        let shouldSelect = true;
        if (responsePage.page_id === selectedPageId) shouldSelect = false;

        onPagesChanged?.(st.pages);
        
        if (shouldSelect && onSelectPage) {
          onSelectPage(responsePage.page_id);
        }

        const name = st.pages.find((p) => p.page_id === pageId)?.page_name?.trim();
        setActivationNotice(
          name
            ? `« ${name} » est activée sur Messenger : le webhook est branché. Envoyez un message test à la Page.`
            : "Page activée sur Messenger : le webhook est branché. Envoyez un message test à la Page."
        );
        window.setTimeout(() => setActivationNotice(null), 12000);
      } catch (e) {
        console.error(e);
        const msg =
          e instanceof Error
            ? e.message
            : "Activation impossible. Ouvrez Paramètres et reconnectez Facebook si le problème continue.";
        alert(msg);
      } finally {
        setFbBusyPageId(null);
      }
    },
    [resolveToken, canManageFb, onPagesChanged, onSelectPage, selectedPageId]
  );

  const handleDeactivatePage = useCallback(
    async (pageId: string) => {
      const t = await resolveToken();
      if (!t || !canManageFb) return;
      setFbBusyPageId(pageId);
      try {
        const { deactivateFacebookMessengerPage } = await import("@/lib/facebookMessenger");
        await deactivateFacebookMessengerPage(pageId, t);
        const st = await loadFacebookMessengerStatus(t);
        onPagesChanged?.(st.pages);
      } catch (e) {
        console.error(e);
        const msg = e instanceof Error ? e.message : "Désactivation impossible.";
        alert(msg);
      } finally {
        setFbBusyPageId(null);
      }
    },
    [resolveToken, canManageFb, onPagesChanged]
  );

  const handleConnectMetaPages = useCallback(async () => {
    const t = await resolveToken();
    if (!t) {
      alert("Session expirée. Reconnectez-vous à FLARE.");
      return;
    }
    if (!canManageFb) {
      alert("Vous n’avez pas les droits pour lier Facebook. Demandez à un administrateur de l’espace, ou ouvrez Paramètres.");
      onPush("chatbot-parametres");
      return;
    }
    setFbOauthBusy(true);
    try {
      await runFacebookMessengerOAuthPopup(t);
      const st = await loadFacebookMessengerStatus(t);
      setCanManageFb(st.can_manage_pages);
      if (st.pages?.length) onPagesChanged?.(st.pages);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Connexion Meta interrompue.";
      alert(msg);
    } finally {
      setFbOauthBusy(false);
    }
  }, [resolveToken, canManageFb, onPagesChanged, onPush]);

  const handleSyncPagesList = useCallback(async () => {
    const t = await resolveToken();
    if (!t || !canManageFb) return;
    setPagesRefreshBusy(true);
    try {
      await resyncFacebookMessengerPages(t);
      const st = await loadFacebookMessengerStatus(t);
      onPagesChanged?.(st.pages);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (/expiré|Reconnectez|session|Reconnectez Facebook|actualiser la liste/i.test(msg)) {
        alert(
          `${msg}\n\nUtilisez le bouton « Ajouter des pages (Meta) » pour rouvrir Facebook et renouveler l’autorisation.`
        );
      } else {
        alert(msg || "Impossible d’actualiser la liste des pages.");
      }
    } finally {
      setPagesRefreshBusy(false);
    }
  }, [resolveToken, canManageFb, onPagesChanged]);

  const loadKPIs = useCallback(
    async (silent = false) => {
      let t = token;
      if (getFreshToken) t = await getFreshToken() || token;
      if (!t || !selectedPageId) {
        setDashData(null);
        setOverview(null);
        return;
      }
      if (!silent) setLoadingKPIs(true);
      try {
        const [dash, ov] = await Promise.allSettled([
          loadMessengerDashboardData(t, selectedPageId),
          getChatbotOverview(t, selectedPageId),
        ]);
        if (dash.status === "fulfilled") setDashData(dash.value);
        if (ov.status === "fulfilled") setOverview(ov.value);
        setLastKpiUpdate(new Date());
      } catch (e) {
        console.error(e);
      } finally {
        if (!silent) setLoadingKPIs(false);
      }
    },
    [token, getFreshToken, selectedPageId]
  );

  useEffect(() => {
    void loadKPIs(false);
    const intervalId = window.setInterval(() => void loadKPIs(true), KPI_POLL_INTERVAL_MS);
    const onVisibility = () => {
      if (document.visibilityState === "visible") void loadKPIs(true);
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [loadKPIs]);

  const messagesCeMois = dashData?.periodStats?.[0]?.messages ?? 0;
  const contactsCaptes = dashData?.totals?.contacts ?? 0;
  const alertCount = overview?.pending_human_count ?? pendingHumanCount;
  const botFullyLive =
    overview?.step === "complete" &&
    Boolean(overview?.active_page?.webhook_subscribed && overview?.active_page?.direct_service_synced);

  if (showSetupWizard && setupStatus) {
    return (
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl px-4 py-6 md:px-8 md:py-10 flex flex-col gap-6">
          <div className="rounded-2xl border border-fg/[0.08] bg-fg/[0.02] px-4 py-4 md:px-6 md:py-5">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-400/90">Mise en route</p>
            <h2 className="mt-2 text-xl font-semibold text-fg/90">Configurez votre chatbot</h2>
            <p className="mt-2 text-sm text-[var(--text-muted)] leading-relaxed">
              Connexion Facebook, page Messenger, identité et entreprise — tout au même endroit. Vous pourrez modifier
              chaque détail ensuite dans les autres sections.
            </p>
          </div>
          <ChatbotSetupWizard
            setupStatus={setupStatus}
            token={token}
            getFreshToken={getFreshToken}
            onComplete={async () => {
              await onRefreshSetupStatus?.(); 
            }}
            onSkip={() => setSkipSetupWizard(true)}
            onRequestOrganizationSelection={onRequestOrganizationSelection}
            onRefreshSetupStatus={onRefreshSetupStatus}
          />
          <div className="flex justify-center pb-8">
            <button
              type="button"
              onClick={() => setSkipSetupWizard(true)}
              className="text-sm text-fg/45 hover:text-fg/70 underline underline-offset-4 transition-colors"
            >
              Accéder à l’accueil du chatbot sans terminer
            </button>
          </div>
        </div>
      </div>
    );
  }

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
            
            {activationNotice ? (
              <div
                role="status"
                className="mb-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100/90"
              >
                {activationNotice}
              </div>
            ) : null}
            <PageSelector
                pages={pages}
                selectedPageId={selectedPageId}
                onSelect={(pid) => onSelectPage?.(pid)}
                onConnectMetaPages={() => void handleConnectMetaPages()}
                onSyncPagesList={pages.length > 0 && canManageFb ? () => void handleSyncPagesList() : undefined}
                connectMetaBusy={fbOauthBusy}
                syncListBusy={pagesRefreshBusy}
                onActivatePage={handleActivatePage}
                onDeactivatePage={handleDeactivatePage}
                canManagePages={canManageFb}
                busyPageId={fbBusyPageId}
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
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="grid grid-cols-1 md:grid-cols-3 gap-4"
          >
            {/* Statut (aligné spec + données réelles overview) */}
            <motion.div
              whileHover={{ scale: 1.02 }}
              className="p-4 rounded-2xl border border-fg/[0.08] bg-[var(--bg-glass)] backdrop-blur-md shadow-[var(--shadow-card)] flex items-center justify-between"
            >
              <div>
                <p className="text-sm font-medium text-[var(--text-muted)]">Statut chatbot</p>
                <div className="flex items-center gap-2 mt-1">
                  {loadingKPIs ? (
                    <div className="h-6 w-24 bg-white/[0.06] rounded-md animate-pulse" />
                  ) : (
                    <>
                      <span className="relative flex h-3 w-3">
                        {botFullyLive ? (
                          <>
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
                          </>
                        ) : (
                          <span className="relative inline-flex rounded-full h-3 w-3 bg-orange-400" />
                        )}
                      </span>
                      <p className="text-lg font-bold text-fg/90">{botFullyLive ? "Actif" : "Inactif"}</p>
                    </>
                  )}
                </div>
              </div>
              <div
                className={`p-2.5 rounded-xl ${
                  botFullyLive ? "bg-emerald-500/10 text-emerald-400" : "bg-orange-500/10 text-orange-400"
                }`}
              >
                <Bot size={20} />
              </div>
            </motion.div>

            {/* Messages ce mois */}
            <motion.div
              whileHover={{ scale: 1.02 }}
              className="p-4 rounded-2xl border border-fg/[0.08] bg-[var(--bg-glass)] backdrop-blur-md shadow-[var(--shadow-card)] flex items-center justify-between"
            >
              <div>
                <p className="text-sm font-medium text-[var(--text-muted)]">Messages traités ce mois</p>
                <div className="mt-1 h-7 flex items-center">
                  {loadingKPIs ? (
                    <div className="h-6 w-16 bg-white/[0.06] rounded-md animate-pulse" />
                  ) : (
                    <p className="text-lg font-bold text-fg/90">{messagesCeMois}</p>
                  )}
                </div>
              </div>
              <div className="bg-blue-500/10 text-blue-400 p-2.5 rounded-xl">
                <MessageSquare size={20} />
              </div>
            </motion.div>

            {/* Contacts */}
            <motion.div
              whileHover={{ scale: 1.02 }}
              className="p-4 rounded-2xl border border-fg/[0.08] bg-[var(--bg-glass)] backdrop-blur-md shadow-[var(--shadow-card)] flex items-center justify-between"
            >
              <div>
                <p className="text-sm font-medium text-[var(--text-muted)]">Contacts captés</p>
                <div className="mt-1 h-7 flex items-center">
                  {loadingKPIs ? (
                    <div className="h-6 w-16 bg-white/[0.06] rounded-md animate-pulse md:w-20" />
                  ) : (
                    <p className="text-lg font-bold text-fg/90">{contactsCaptes}</p>
                  )}
                </div>
              </div>
              <div className="bg-orange-500/10 text-orange-400 p-2.5 rounded-xl">
                <Users size={20} />
              </div>
            </motion.div>
          </motion.div>
        )}
        {hasPageSelected && lastKpiUpdate && !loadingKPIs && (
          <p className="text-sm text-[var(--text-muted)] -mt-4">
            Données synchronisées avec le serveur · actualisation automatique toutes les{" "}
            {Math.round(KPI_POLL_INTERVAL_MS / 1000)} s
          </p>
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
                    isClientsCard && alertCount > 0 ? <NotifBadge count={alertCount} /> : undefined
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
