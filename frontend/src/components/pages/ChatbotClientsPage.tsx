"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { Loader2, AlertCircle, ArrowRight, User, BellRing } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import type { NavLevel } from "@/components/NavBreadcrumb";
import {
  loadMessengerDashboardData,
  type MessengerAlertSeverity,
  type MessengerConversationCard,
  type MessengerDashboardAlert,
} from "@/lib/messengerDirect";
import { setContactBotStatus } from "@/lib/api";

type FilterId = "all" | "leads" | "human" | "paused";

interface ChatbotClientsPageProps {
  token?: string | null;
  getFreshToken?: (forceRefresh?: boolean) => Promise<string | null>;
  onPush: (level: NavLevel) => void;
  onSelectContact?: (contactId: string) => void;
  selectedPageId?: string | null;
}

export default function ChatbotClientsPage({
  token,
  getFreshToken,
  onPush,
  onSelectContact,
  selectedPageId,
}: ChatbotClientsPageProps) {
  const [conversations, setConversations] = useState<MessengerConversationCard[]>([]);
  const [alerts, setAlerts] = useState<MessengerDashboardAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterId>("all");
  const [toggling, setToggling] = useState<Set<string>>(new Set());
  const [canSwitchMode, setCanSwitchMode] = useState(false);
  const [accessMessage, setAccessMessage] = useState<string | null>(null);
  const [flashMessage, setFlashMessage] = useState<string | null>(null);

  const resolveToken = useCallback(async () => {
    if (getFreshToken) return await getFreshToken();
    return token ?? null;
  }, [getFreshToken, token]);

  const loadContacts = useCallback(
    async (isSilent = false) => {
      const t = await resolveToken();
      if (!t) {
        if (!isSilent) {
          setError("Session expirée. Rechargez la page avant de consulter les conversations.");
          setLoading(false);
        }
        return;
      }
      if (!isSilent) setLoading(true);
      setError(null);
      try {
        const data = await loadMessengerDashboardData(t, selectedPageId);
        setConversations(data.conversations || []);
        setAlerts(data.alerts || []);
        setCanSwitchMode(Boolean(data.access?.canSwitchMode));
        setAccessMessage(data.access?.message || null);
      } catch {
        if (!isSilent) setError("Impossible de charger les contacts.");
      } finally {
        if (!isSilent) setLoading(false);
      }
    },
    [resolveToken, selectedPageId]
  );

  useEffect(() => {
    void loadContacts();
    const interval = setInterval(() => void loadContacts(true), 15000);
    return () => clearInterval(interval);
  }, [loadContacts]);

  const handleToggleMode = async (psid: string, currentMode: string) => {
    if (!canSwitchMode) {
      setError(
        accessMessage ||
          "Seuls le proprietaire ou un admin du compte peuvent changer le mode bot/humain."
      );
      return;
    }

    const nextEnabled = currentMode === "human";
    setToggling((prev) => new Set(prev).add(psid));
    try {
      const t = await resolveToken();
      await setContactBotStatus(psid, nextEnabled, t, selectedPageId);
      setConversations((prev) =>
        prev.map((conversation) =>
          conversation.psid === psid
            ? { ...conversation, mode: nextEnabled ? "agent" : "human" }
            : conversation
        )
      );
    } catch {
      setFlashMessage("Erreur lors du changement de mode.");
    } finally {
      setToggling((prev) => {
        const next = new Set(prev);
        next.delete(psid);
        return next;
      });
    }
  };

  const handleContactSelect = (contactId: string) => {
    onSelectContact?.(contactId);
    onPush("chatbot-client-detail");
  };

  const filteredConversations = useMemo(() => {
    return conversations.filter((conversation) => {
      if (filter === "all") return true;
      if (filter === "leads") {
        return (
          conversation.status?.toLowerCase().includes("lead") ||
          conversation.status?.toLowerCase().includes("hot")
        );
      }
      if (filter === "human") return conversation.humanTakeover;
      if (filter === "paused") return conversation.mode === "human";
      return true;
    });
  }, [conversations, filter]);

  const needsHumanCount = conversations.filter((conversation) => conversation.humanTakeover).length;
  const visibleAlerts = useMemo(() => alerts.slice(0, 6), [alerts]);
  const criticalAlerts = useMemo(
    () => alerts.filter((alert) => alert.severity === "critical").length,
    [alerts]
  );

  const alertToneClass = (severity: MessengerAlertSeverity): string => {
    if (severity === "critical") {
      return "border-red-500/35 bg-red-500/15 text-red-900 dark:text-red-100";
    }
    if (severity === "warning") {
      return "border-orange-500/40 bg-orange-500/16 text-orange-900 dark:text-orange-50";
    }
    return "border-navy-500/35 bg-navy-500/14 text-navy-800 dark:text-[rgb(220,232,255)]";
  };

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center py-20">
        <div className="flex items-center gap-3 text-fg/40">
          <Loader2 size={18} className="animate-spin" />
          <span className="text-base text-fg/50">Chargement des contacts...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-6 px-4 py-8 md:px-8">
        <motion.header
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="space-y-2"
        >
          <h1 className="text-3xl font-bold tracking-tight text-fg/90">Clients &amp; Conversations</h1>
          <p className="text-lg text-[var(--text-muted)]">Suivi, contrôle du bot et historique par contact</p>
        </motion.header>

        <AnimatePresence>
          {needsHumanCount > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="flex flex-col gap-3 rounded-xl border border-orange-500/35 bg-orange-500/14 p-4 text-orange-50 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <AlertCircle size={20} className="shrink-0" />
                  <p className="text-sm font-medium">
                    {needsHumanCount === 1
                      ? "1 conversation nécessite votre attention"
                      : `${needsHumanCount} conversations nécessitent votre attention`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setFilter("human")}
                  className="shrink-0 rounded-full bg-orange-500/28 px-4 py-2 text-sm font-semibold text-orange-50 ring-1 ring-orange-300/45 hover:bg-orange-500/36"
                >
                  Voir les alertes
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <section className="rounded-2xl border border-[var(--border-default)] bg-[var(--surface-base)] p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-fg/90">Notifications &amp; alertes</p>
              <p className="mt-1 text-xs text-fg/60">
                Signaux operationnels remontes par le backend Messenger.
              </p>
            </div>
            <span className="inline-flex items-center gap-2 rounded-full border border-orange-500/35 bg-orange-500/15 px-3 py-1 text-xs font-semibold text-orange-900 dark:text-orange-100">
              <BellRing size={12} />
              {alerts.length} total
            </span>
          </div>
          {visibleAlerts.length === 0 ? (
            <div className="mt-3 rounded-xl border border-[var(--border-default)] bg-[var(--surface-subtle)] px-3 py-2 text-xs text-fg/60">
              Aucune alerte backend active pour la page selectionnee.
            </div>
          ) : (
            <div className="mt-3 space-y-2">
              {visibleAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`rounded-xl border px-3 py-2 ${alertToneClass(alert.severity)}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold">{alert.title}</p>
                      <p className="mt-1 text-xs opacity-90">{alert.detail}</p>
                    </div>
                    {alert.psid ? (
                      <button
                        type="button"
                        onClick={() => handleContactSelect(alert.psid as string)}
                        className="shrink-0 rounded-md border border-black/25 bg-black/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-black hover:bg-black/20 dark:border-white/25 dark:bg-white/10 dark:text-white dark:hover:bg-white/20"
                      >
                        Ouvrir
                      </button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
          {criticalAlerts > 0 ? (
            <p className="mt-2 text-[11px] text-red-700 dark:text-red-200/90">
              {criticalAlerts} alerte(s) critique(s) demandent une reprise humaine rapide.
            </p>
          ) : null}
        </section>

        {error && <p className="text-red-400">{error}</p>}
        {flashMessage ? (
          <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-400">
            {flashMessage}
          </div>
        ) : null}

        {!canSwitchMode && accessMessage ? (
          <div className="rounded-xl border border-orange-500/25 bg-orange-500/10 px-4 py-3 text-sm text-orange-400">
            {accessMessage}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          {([
            { id: "all", label: "Tous" },
            { id: "leads", label: "Leads" },
            { id: "human", label: "Intervention requise" },
            { id: "paused", label: "Bot désactivé" },
          ] as const).map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setFilter(id)}
              className={`rounded-full px-4 py-1.5 text-sm transition-colors ${
                filter === id
                  ? "bg-orange-500 font-medium text-[#140b02]"
                  : "bg-fg/[0.05] text-fg/50 hover:bg-fg/[0.08]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="overflow-hidden rounded-2xl border border-fg/[0.08] bg-fg/[0.02]">
          {filteredConversations.length === 0 ? (
            <div className="p-8 text-center text-fg/40">Aucun contact trouvé pour ce filtre.</div>
          ) : (
            <div className="divide-y divide-fg/[0.04]">
              {filteredConversations.map((conversation) => {
                const isHandling = toggling.has(conversation.psid);
                const botEnabled = conversation.mode !== "human";
                return (
                  <div
                    key={conversation.psid}
                    className="flex flex-col justify-between gap-4 p-5 transition-colors hover:bg-fg/[0.02] sm:flex-row sm:items-center"
                  >
                    <div
                      className="flex flex-1 cursor-pointer items-center gap-4"
                      onClick={() => handleContactSelect(conversation.psid)}
                    >
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-fg/[0.05] text-fg/50">
                        {conversation.customer ? conversation.customer.charAt(0).toUpperCase() : <User size={20} />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate font-semibold text-fg/90">{conversation.customer || "Inconnu"}</p>
                          {conversation.status ? (
                            <span className="shrink-0 rounded-md border border-fg/[0.08] bg-fg/[0.05] px-2 py-0.5 text-sm font-medium uppercase tracking-wide text-fg/50">
                              {conversation.status}
                            </span>
                          ) : null}
                        </div>
                        <p className="max-w-sm truncate text-sm text-fg/50">
                          {conversation.lastMessage || "Aucun message récent"}
                        </p>
                      </div>
                    </div>

                    <div className="mt-2 flex w-full items-center justify-between gap-6 sm:mt-0 sm:w-auto sm:justify-end">
                      <div className="flex items-center gap-3">
                        <span className={`hidden text-xs font-semibold uppercase tracking-widest sm:inline-block ${
                          botEnabled ? "text-emerald-500 dark:text-emerald-200" : "text-red-400"
                        }`}>
                          {botEnabled ? "Bot ON" : "Bot OFF"}
                        </span>
                        <button
                          onClick={() => void handleToggleMode(conversation.psid, conversation.mode)}
                          disabled={isHandling || !canSwitchMode}
                          className={`relative flex h-7 w-12 items-center rounded-full border transition-colors ${
                            botEnabled
                              ? "border-emerald-500/40 bg-emerald-500/22"
                              : "border-red-500/35 bg-red-500/16"
                          }`}
                          title={
                            canSwitchMode
                              ? "Basculer le mode bot/humain"
                              : "Action réservée au propriétaire ou à un admin"
                          }
                        >
                          <motion.div
                            layout
                            transition={{ type: "spring", stiffness: 500, damping: 30 }}
                            className={`h-5 w-5 rounded-full shadow-sm ${
                              botEnabled ? "ml-[26px] bg-emerald-300" : "ml-1 bg-red-300"
                            }`}
                          />
                          {isHandling ? (
                            <Loader2
                              size={12}
                              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 animate-spin text-fg/50"
                            />
                          ) : null}
                        </button>
                      </div>

                      <button
                        onClick={() => handleContactSelect(conversation.psid)}
                        className="flex items-center gap-2 text-sm font-medium text-orange-400 hover:text-orange-300"
                      >
                        Voir
                        <ArrowRight size={16} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
