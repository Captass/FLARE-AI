"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Bot, MessageSquare, Users, AlertTriangle, ArrowRight } from "lucide-react";
import { getChatbotOverview, type ChatbotOverview, type ChatbotPageSummary } from "@/lib/api";
import { loadMessengerDashboardData, type MessengerDashboardData } from "@/lib/messengerDirect";
import { KPI_POLL_INTERVAL_MS } from "@/lib/kpiPolling";
import { SkeletonCard } from "@/components/SkeletonLoader";
import FacebookVerificationBanner from "@/components/chatbot/FacebookVerificationBanner";
import ChatbotRealtimeChart from "@/components/chatbot/ChatbotRealtimeChart";
import type { FacebookMessengerPage } from "@/lib/facebookMessenger";

function pageSummaryToMessengerPage(page: ChatbotPageSummary): FacebookMessengerPage {
  return {
    id: page.page_id,
    page_id: page.page_id,
    page_name: page.page_name,
    page_picture_url: page.page_picture_url,
    page_category: page.page_category ?? "",
    page_tasks: [],
    status: page.status,
    is_active: page.is_active,
    webhook_subscribed: page.webhook_subscribed,
    direct_service_synced: page.direct_service_synced,
    connected_by_email: "",
    connected_at: page.connected_at,
    last_synced_at: page.last_synced_at ?? undefined,
    last_error: page.last_error ?? undefined,
  };
}

interface ChatbotDashboardPageProps {
  token?: string | null;
  getFreshToken?: (forceRefresh?: boolean) => Promise<string | null>;
  selectedPageId?: string | null;
  onPush?: (level: "chatbot-clients" | "chatbot-client-detail") => void;
  onSelectContact?: (contactId: string) => void;
}

export default function ChatbotDashboardPage({
  token,
  getFreshToken,
  selectedPageId,
  onPush,
  onSelectContact,
}: ChatbotDashboardPageProps) {
  const [overview, setOverview] = useState<ChatbotOverview | null>(null);
  const [dashData, setDashData] = useState<MessengerDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastKpiUpdate, setLastKpiUpdate] = useState<Date | null>(null);

  const resolveToken = useCallback(async () => {
    if (getFreshToken) return await getFreshToken();
    return token ?? null;
  }, [getFreshToken, token]);

  const loadAll = useCallback(
    async (silent = false) => {
      const freshToken = await resolveToken();
      if (!freshToken) {
        if (!silent) {
          setOverview(null);
          setDashData(null);
          setLoading(false);
          setError("Session expiree. Reconnectez-vous a FLARE.");
        }
        return;
      }

      if (!silent) {
        setLoading(true);
        setError(null);
        setOverview(null);
        setDashData(null);
      }

      const [overviewResult, dashboardResult] = await Promise.allSettled([
        getChatbotOverview(freshToken, selectedPageId),
        loadMessengerDashboardData(freshToken, selectedPageId),
      ]);

      if (overviewResult.status === "fulfilled") {
        setOverview(overviewResult.value);
      } else if (!silent) {
        setOverview(null);
      }

      if (dashboardResult.status === "fulfilled") {
        setDashData(dashboardResult.value);
      } else if (!silent) {
        setDashData(null);
      }

      if (overviewResult.status === "rejected" && dashboardResult.status === "rejected" && !silent) {
        setError("Erreur de chargement du tableau de bord.");
      }

      if (overviewResult.status === "fulfilled" || dashboardResult.status === "fulfilled") {
        setLastKpiUpdate(new Date());
      }

      if (!silent) {
        setLoading(false);
      }
    },
    [resolveToken, selectedPageId]
  );

  useEffect(() => {
    void loadAll(false);

    const intervalId = window.setInterval(() => void loadAll(true), KPI_POLL_INTERVAL_MS);
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void loadAll(true);
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [loadAll, selectedPageId]);

  const isLive =
    overview?.step === "complete" &&
    Boolean(overview.active_page?.is_active && overview.active_page?.webhook_subscribed);
  const activePage = overview?.active_page ?? null;
  const hasImportedPages = (overview?.total_pages ?? 0) > 0;
  const messagesHandled = dashData?.totals?.messages24h ?? dashData?.periodStats?.[0]?.messages ?? 0;
  const trackedContacts = dashData?.totals?.contacts ?? 0;
  const pendingHuman = overview?.pending_human_count ?? dashData?.totals?.needsAttentionContacts ?? 0;
  const recentMessages = dashData?.recentMessages?.slice(0, 10) ?? [];

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-8 px-4 py-8 md:px-8">
        <motion.header
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="space-y-2"
        >
          <h1 className="text-3xl font-bold tracking-tight text-[var(--text-primary)]">Tableau de bord</h1>
          <p className="text-lg text-[var(--text-muted)]">Apercu en temps reel de votre chatbot et de vos conversations</p>
        </motion.header>

        {error ? (
          <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        ) : null}

        {!loading && dashData?.access?.scope !== "operator" && dashData?.access?.message ? (
          <div className="rounded-xl border border-orange-500/20 bg-orange-500/8 px-4 py-3 text-sm text-orange-500">
            {dashData.access.message}
          </div>
        ) : null}

        {!loading && activePage ? (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <FacebookVerificationBanner
              page={pageSummaryToMessengerPage(activePage)}
              loading={loading}
              onRefresh={() => void loadAll(false)}
            />
          </motion.div>
        ) : null}

        {!loading && !activePage ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center justify-between rounded-2xl border border-orange-500/20 bg-orange-500/8 px-5 py-4"
          >
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-500/15 text-orange-500">
                <AlertTriangle size={20} />
              </div>
              <div>
                <p className="font-semibold text-[var(--text-primary)]">
                  {hasImportedPages ? "Pages importees, aucune active" : "Aucune page Facebook connectee"}
                </p>
                <p className="text-sm text-[var(--text-secondary)]">
                  {hasImportedPages
                    ? "Activez une page dans Parametres pour lancer le chatbot."
                    : "Allez dans Parametres pour associer une page."}
                </p>
              </div>
            </div>
          </motion.div>
        ) : null}

        {lastKpiUpdate && !loading ? (
          <p className="-mt-4 text-sm text-[var(--text-muted)]">
            Donnees synchronisees avec le serveur - actualisation automatique toutes les{" "}
            {Math.round(KPI_POLL_INTERVAL_MS / 1000)} s
          </p>
        ) : null}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {loading ? (
            <>
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </>
          ) : (
            <>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={{ scale: 1.02 }}
                transition={{ type: "spring", stiffness: 400, damping: 25 }}
              className="rounded-2xl border border-[var(--border-default)] bg-[var(--surface-base)] p-5"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-[var(--text-muted)]">Statut chatbot</p>
                    <p className="mt-2 text-2xl font-bold text-[var(--text-primary)]">{isLive ? "Actif" : "Inactif"}</p>
                  </div>
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                      isLive ? "bg-navy-500/10 text-navy-400" : "bg-[var(--surface-subtle)] text-[var(--text-secondary)]"
                    }`}
                  >
                    <Bot size={20} />
                  </div>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
                whileHover={{ scale: 1.02 }}
                className="rounded-2xl border border-[var(--border-default)] bg-[var(--surface-base)] p-5"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-[var(--text-muted)]">Messages traites</p>
                    <p className="mt-2 text-2xl font-bold text-[var(--text-primary)]">{messagesHandled}</p>
                  </div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-navy-500/10 text-navy-400">
                    <MessageSquare size={20} />
                  </div>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                whileHover={{ scale: 1.02 }}
                className="rounded-2xl border border-[var(--border-default)] bg-[var(--surface-base)] p-5"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-[var(--text-muted)]">Contacts suivis</p>
                    <p className="mt-2 text-2xl font-bold text-[var(--text-primary)]">{trackedContacts}</p>
                  </div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/10 text-orange-500">
                    <Users size={20} />
                  </div>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                whileHover={{ scale: 1.02 }}
                className="rounded-2xl border border-[var(--border-default)] bg-[var(--surface-base)] p-5"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-[var(--text-muted)]">A reprendre</p>
                    <p className="mt-2 text-2xl font-bold text-[var(--text-primary)]">{pendingHuman}</p>
                  </div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/10 text-orange-500">
                    <AlertTriangle size={20} />
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </div>

        <ChatbotRealtimeChart data={dashData} loading={loading} />

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="flex flex-col gap-4"
        >
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">Activite recente</h2>
          <div className="overflow-hidden rounded-2xl border border-[var(--border-default)] bg-[var(--surface-base)]">
            {loading ? (
              <div className="p-8 text-center text-[var(--text-secondary)]">Chargement des conversations...</div>
            ) : recentMessages.length === 0 ? (
              <div className="p-8 text-center text-[var(--text-secondary)]">Aucune conversation recente.</div>
            ) : (
              <div className="divide-y divide-[var(--divider)]">
                {recentMessages.map((message, index) => {
                  const contactId = message.psid || null;
                  const canOpenDetail = Boolean(contactId && onSelectContact);
                  const canOpenList = Boolean(onPush);
                  const canOpen = canOpenDetail || canOpenList;

                  return (
                    <div
                      key={`${message.customer}-${message.time}-${index}`}
                      className="flex items-center justify-between p-4 transition-colors hover:bg-[var(--surface-subtle)]"
                    >
                      <div className="min-w-0 flex items-center gap-4">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-orange-500/12 font-bold uppercase text-orange-500">
                          {(message.customer || "C").charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-[var(--text-primary)]">{message.customer || "Client"}</p>
                          <p className="max-w-[300px] truncate text-sm text-[var(--text-secondary)] md:max-w-[450px]">
                            {message.message || "Message"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span
                          className={`rounded-full border px-2 py-1 text-sm ${
                            message.mode === "agent"
                              ? "border-navy-500/20 bg-navy-500/10 text-navy-400"
                              : "border-orange-500/20 bg-orange-500/10 text-orange-500"
                          }`}
                        >
                          {message.mode === "agent" ? "Bot" : "Humain"}
                        </span>
                        <button
                          type="button"
                          disabled={!canOpen}
                          onClick={() => {
                            if (contactId && onSelectContact) {
                              onSelectContact(contactId);
                              onPush?.("chatbot-client-detail");
                              return;
                            }
                            onPush?.("chatbot-clients");
                          }}
                          title={canOpenDetail ? "Ouvrir la fiche client" : canOpenList ? "Ouvrir les conversations" : "Fiche client indisponible"}
                          className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--surface-subtle)] text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-raised)] hover:text-[var(--text-primary)] disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <ArrowRight size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}





