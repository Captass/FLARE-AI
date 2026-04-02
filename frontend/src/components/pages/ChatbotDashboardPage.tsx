"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Bot, MessageSquare, Users, AlertTriangle, ArrowRight } from "lucide-react";
import { getChatbotOverview, type ChatbotOverview, type ChatbotPageSummary } from "@/lib/api";
import { loadMessengerDashboardData, type MessengerDashboardData } from "@/lib/messengerDirect";
import { SkeletonCard } from "@/components/SkeletonLoader";
import FacebookVerificationBanner from "@/components/chatbot/FacebookVerificationBanner";
import type { FacebookMessengerPage } from "@/lib/facebookMessenger";

function pageSummaryToMessengerPage(p: ChatbotPageSummary): FacebookMessengerPage {
  return {
    id: p.page_id,
    page_id: p.page_id,
    page_name: p.page_name,
    page_picture_url: p.page_picture_url,
    page_category: p.page_category ?? "",
    page_tasks: [],
    status: p.status,
    is_active: p.is_active,
    webhook_subscribed: p.webhook_subscribed,
    direct_service_synced: p.direct_service_synced,
    connected_by_email: "",
    connected_at: p.connected_at,
    last_synced_at: p.last_synced_at ?? undefined,
    last_error: p.last_error ?? undefined,
  };
}

interface ChatbotDashboardPageProps {
  token?: string | null;
  getFreshToken?: (forceRefresh?: boolean) => Promise<string | null>;
  selectedPageId?: string | null;
}

export default function ChatbotDashboardPage({ token, getFreshToken, selectedPageId }: ChatbotDashboardPageProps) {
  const [overview, setOverview] = useState<ChatbotOverview | null>(null);
  const [dashData, setDashData] = useState<MessengerDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const resolveToken = useCallback(async () => {
    if (getFreshToken) return await getFreshToken();
    return token ?? null;
  }, [getFreshToken, token]);

  const loadAll = useCallback(async () => {
    const t = await resolveToken();
    if (!t) return;
    setLoading(true);
    setError(null);
    try {
      const [ov, dash] = await Promise.allSettled([
        getChatbotOverview(t, selectedPageId),
        loadMessengerDashboardData(t, selectedPageId)
      ]);
      if (ov.status === "fulfilled") setOverview(ov.value);
      if (dash.status === "fulfilled") setDashData(dash.value);
    } catch {
      setError("Erreur de chargement du tableau de bord.");
    } finally {
      setLoading(false);
    }
  }, [resolveToken, selectedPageId]);

  useEffect(() => {
    void loadAll();
  }, [loadAll, selectedPageId]);

  const isLive =
    overview?.step === "complete" &&
    Boolean(overview?.active_page?.webhook_subscribed && overview?.active_page?.direct_service_synced);
  const activePage = overview?.active_page;
  
  const messagesCeMois = dashData?.periodStats?.[0]?.messages ?? 0; // Utilise la première période
  const contactsCaptes = dashData?.totals?.contacts ?? 0;
  const recentMessages = dashData?.recentMessages?.slice(0, 10) || [];

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-[1100px] px-4 py-8 md:px-8 flex flex-col gap-8">
        
        {/* Header */}
        <motion.header
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="space-y-2"
        >
          <h1 className="text-3xl font-bold tracking-tight text-fg/90">Tableau de bord</h1>
          <p className="text-lg text-[var(--text-muted)]">Aperçu en temps réel de votre assistant</p>
        </motion.header>

        {error && (
          <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* Bannière vérification Facebook (spec : même logique que ChatbotStatusTab / FacebookVerificationBanner) */}
        {!loading && activePage && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <FacebookVerificationBanner
              page={pageSummaryToMessengerPage(activePage)}
              loading={loading}
              onRefresh={() => void loadAll()}
            />
          </motion.div>
        )}
        {!loading && !activePage && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center justify-between rounded-2xl border border-orange-500/20 bg-orange-500/5 px-5 py-4"
          >
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-500/20 text-orange-400">
                <AlertTriangle size={20} />
              </div>
              <div>
                <p className="font-semibold text-fg/90">Aucune page Facebook connectée</p>
                <p className="text-sm text-fg/50">Allez dans Paramètres pour associer une page.</p>
              </div>
            </div>
          </motion.div>
        )}

        {/* KPIs */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {loading ? (
            <>
              <SkeletonCard /><SkeletonCard /><SkeletonCard />
            </>
          ) : (
            <>
              {/* Statut Chatbot */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={{ scale: 1.02 }}
                transition={{ type: "spring", stiffness: 400, damping: 25 }}
                className="rounded-2xl border border-fg/[0.08] bg-fg/[0.02] p-5 shadow-[var(--shadow-card)]"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-[var(--text-muted)]">Statut chatbot</p>
                    <p className="mt-2 text-2xl font-bold text-fg/90">{isLive ? "Actif" : "Inactif"}</p>
                  </div>
                  <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${isLive ? "bg-emerald-500/10 text-emerald-400" : "bg-fg/[0.05] text-fg/30"}`}>
                    <Bot size={20} />
                  </div>
                </div>
              </motion.div>

              {/* Messages ce mois */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
                whileHover={{ scale: 1.02 }}
                className="rounded-2xl border border-fg/[0.08] bg-fg/[0.02] p-5 shadow-[var(--shadow-card)]"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-[var(--text-muted)]">Messages traités ce mois</p>
                    <p className="mt-2 text-2xl font-bold text-fg/90">{messagesCeMois}</p>
                  </div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400">
                    <MessageSquare size={20} />
                  </div>
                </div>
              </motion.div>

              {/* Contacts captés */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                whileHover={{ scale: 1.02 }}
                className="rounded-2xl border border-fg/[0.08] bg-fg/[0.02] p-5 shadow-[var(--shadow-card)]"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-[var(--text-muted)]">Contacts captés ce mois</p>
                    <p className="mt-2 text-2xl font-bold text-fg/90">{contactsCaptes}</p>
                  </div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/10 text-orange-400">
                    <Users size={20} />
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </div>

        {/* Activité récente */}
        <motion.div
           initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
           className="flex flex-col gap-4"
        >
          <h2 className="text-lg font-semibold text-fg/90">Activité récente</h2>
          <div className="rounded-2xl border border-fg/[0.08] bg-fg/[0.02] overflow-hidden">
            {loading ? (
              <div className="p-8 text-center text-fg/40">Chargement des conversations...</div>
            ) : recentMessages.length === 0 ? (
              <div className="p-8 text-center text-fg/40">Aucune conversation récente.</div>
            ) : (
              <div className="divide-y divide-fg/[0.04]">
                {recentMessages.map((msg, i) => (
                  <div key={i} className="flex items-center justify-between p-4 hover:bg-fg/[0.02] transition-colors">
                    <div className="flex items-center gap-4">
                      {/* Avatar placeholder */}
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-orange-500/20 text-orange-500 font-bold uppercase">
                        {msg.customer.charAt(0)}
                      </div>
                      <div>
                        <p className="font-medium text-fg/90">{msg.customer}</p>
                        <p className="text-sm text-fg/50 truncate max-w-[300px] md:max-w-[450px]">
                          {msg.message || "Attachement"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className={`text-sm px-2 py-1 rounded-full border ${
                        msg.mode === "agent" ? "border-emerald-500/20 text-emerald-400 bg-emerald-500/10"
                                           : "border-orange-500/20 text-orange-400 bg-orange-500/10"
                      }`}>
                        {msg.mode === "agent" ? "Bot" : "Humain"}
                      </span>
                      <button className="flex h-8 w-8 items-center justify-center rounded-full bg-fg/[0.05] text-fg/50 hover:bg-fg/[0.1] hover:text-fg transition-colors">
                        <ArrowRight size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </motion.div>

      </div>
    </div>
  );
}
