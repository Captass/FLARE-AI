"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { Loader2, AlertCircle, ArrowRight, User } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import type { NavLevel } from "@/components/NavBreadcrumb";
import { loadMessengerDashboardData, type MessengerConversationCard } from "@/lib/messengerDirect";
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterId>("all");
  const [toggling, setToggling] = useState<Set<string>>(new Set());
  const [canSwitchMode, setCanSwitchMode] = useState(false);
  const [accessMessage, setAccessMessage] = useState<string | null>(null);

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
          "Seuls le proprietaire ou un admin de cet espace peuvent changer le mode bot/humain."
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
      alert("Erreur lors du changement de mode.");
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
              <div className="flex flex-col gap-3 rounded-xl border border-orange-500/30 bg-orange-500/10 p-4 text-orange-400 sm:flex-row sm:items-center sm:justify-between">
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
                  className="shrink-0 rounded-full bg-orange-500/20 px-4 py-2 text-sm font-semibold text-orange-200 ring-1 ring-orange-400/30 hover:bg-orange-500/30"
                >
                  Voir les alertes
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {error && <p className="text-red-400">{error}</p>}

        {!canSwitchMode && accessMessage ? (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100/90">
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
                        <span className="hidden text-sm font-medium uppercase tracking-widest text-fg/40 sm:inline-block">
                          {botEnabled ? "Bot actif" : "Mode humain"}
                        </span>
                        <button
                          onClick={() => void handleToggleMode(conversation.psid, conversation.mode)}
                          disabled={isHandling || !canSwitchMode}
                          className={`relative flex h-7 w-12 items-center rounded-full transition-colors ${
                            botEnabled ? "bg-emerald-500/20" : "bg-fg/10"
                          }`}
                          title={
                            canSwitchMode
                              ? "Basculer le mode bot/humain"
                              : "Action réservée au propriétaire ou à un admin"
                          }
                        >
                          <motion.div
                            layout
                            className={`h-5 w-5 rounded-full shadow-sm ${
                              botEnabled ? "ml-[26px] bg-emerald-400" : "ml-1 bg-fg/40"
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
