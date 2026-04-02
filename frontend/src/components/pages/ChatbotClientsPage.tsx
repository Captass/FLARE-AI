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

  const resolveToken = useCallback(async () => {
    if (getFreshToken) return await getFreshToken();
    return token ?? null;
  }, [getFreshToken, token]);

  const loadContacts = useCallback(async (isSilent = false) => {
    const t = await resolveToken();
    if (!t) return;
    if (!isSilent) setLoading(true);
    setError(null);
    try {
      const data = await loadMessengerDashboardData(t, selectedPageId);
      if (data.conversations) {
        setConversations(data.conversations);
      }
    } catch (err) {
      if (!isSilent) setError("Impossible de charger les contacts.");
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, [resolveToken, selectedPageId]);

  // Polling every 15s
  useEffect(() => {
    void loadContacts();
    const interval = setInterval(() => void loadContacts(true), 15000);
    return () => clearInterval(interval);
  }, [loadContacts]);

  const handleToggleMode = async (psid: string, currentMode: string) => {
    const nextEnabled = currentMode === "human"; // si c'était humain, on active le bot (agent)
    setToggling((prev) => new Set(prev).add(psid));
    try {
      const t = await resolveToken();
      await setContactBotStatus(psid, nextEnabled, t, selectedPageId);
      // Mettre à jour localement immédiatement pour être réactif
      setConversations((prev) =>
        prev.map((c) =>
          c.psid === psid ? { ...c, mode: nextEnabled ? "agent" : "human" } : c
        )
      );
    } catch {
      alert("Erreur lors du changement de mode.");
    } finally {
      setToggling((prev) => {
        const n = new Set(prev);
        n.delete(psid);
        return n;
      });
    }
  };

  const handleContactSelect = (contactId: string) => {
    onSelectContact?.(contactId);
    onPush("chatbot-client-detail");
  };

  const filteredConversations = useMemo(() => {
    return conversations.filter((c) => {
      if (filter === "all") return true;
      if (filter === "leads") return c.status?.toLowerCase().includes("lead") || c.status?.toLowerCase().includes("hot");
      if (filter === "human") return c.humanTakeover; // necessite attention (selon mapping)
      if (filter === "paused") return c.mode === "human"; // Bot désactivé pour ce contact
      return true;
    });
  }, [conversations, filter]);

  const needsHumanCount = conversations.filter((c) => c.humanTakeover).length; // Approximatif, dépend du mapping réel

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center py-20">
        <div className="flex items-center gap-3 text-fg/40">
          <Loader2 size={18} className="animate-spin" />
          <span className="text-sm">Chargement des contacts…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-[1100px] px-4 py-8 md:px-8 flex flex-col gap-6">

        {/* ── Header ── */}
        <motion.header
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="space-y-2"
        >
          <h1 className="text-3xl font-bold tracking-tight text-fg/90">
            Clients &amp; Conversations
          </h1>
          <p className="text-lg text-[var(--text-muted)]">
            Suivi, contrôle du bot et historique par contact
          </p>
        </motion.header>

        {/* ── Alert Banner ── */}
        <AnimatePresence>
          {needsHumanCount > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="flex items-center gap-3 rounded-xl border border-orange-500/30 bg-orange-500/10 p-4 text-orange-400">
                <AlertCircle size={20} className="shrink-0" />
                <p className="text-sm font-medium">
                  {needsHumanCount} conversation{needsHumanCount > 1 && "s"} nécessite{needsHumanCount > 1 && "nt"} votre intervention
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {error && <p className="text-red-400">{error}</p>}

        {/* ── Filters ── */}
        <div className="flex flex-wrap items-center gap-2">
          {([
            { id: "all", label: "Tous" },
            { id: "leads", label: "Leads" },
            { id: "human", label: "Intervention requise" },
            { id: "paused", label: "Bot désactivé" }
          ] as const).map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setFilter(id)}
              className={`rounded-full px-4 py-1.5 text-sm transition-colors ${
                filter === id 
                  ? "bg-orange-500 text-[#140b02] font-medium"
                  : "bg-fg/[0.05] text-fg/50 hover:bg-fg/[0.08]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ── List ── */}
        <div className="rounded-2xl border border-fg/[0.08] bg-fg/[0.02] overflow-hidden">
          {filteredConversations.length === 0 ? (
            <div className="p-8 text-center text-fg/40">Aucun contact trouvé pour ce filtre.</div>
          ) : (
            <div className="divide-y divide-fg/[0.04]">
              {filteredConversations.map((c) => {
                const isHandling = toggling.has(c.psid);
                const botEnabled = c.mode !== "human";
                return (
                  <div key={c.psid} className="flex flex-col sm:flex-row sm:items-center justify-between p-5 gap-4 hover:bg-fg/[0.02] transition-colors">
                    
                    {/* Profil info */}
                    <div className="flex items-center gap-4 cursor-pointer flex-1" onClick={() => handleContactSelect(c.psid)}>
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-fg/[0.05] text-fg/50">
                        {c.customer ? c.customer.charAt(0).toUpperCase() : <User size={20} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-fg/90 truncate">{c.customer || "Inconnu"}</p>
                          {c.status && (
                            <span className="shrink-0 rounded bg-fg/[0.05] px-1.5 py-0.5 text-[10px] uppercase text-fg/40 border border-fg/[0.05]">
                              {c.status}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-fg/50 truncate max-w-sm">
                          {c.lastMessage || "Aucun message récent"}
                        </p>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-between sm:justify-end gap-6 w-full sm:w-auto mt-2 sm:mt-0">
                      
                      {/* Toggle Bot */}
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-fg/40 uppercase tracking-widest hidden sm:inline-block">
                          {botEnabled ? "Bot Actif" : "Reprise Hub"}
                        </span>
                        <button
                          onClick={() => void handleToggleMode(c.psid, c.mode)}
                          disabled={isHandling}
                          className={`relative flex h-7 w-12 items-center rounded-full transition-colors ${
                            botEnabled ? "bg-emerald-500/20" : "bg-fg/10"
                          }`}
                        >
                          <motion.div
                            layout
                            className={`h-5 w-5 rounded-full shadow-sm ${
                              botEnabled ? "bg-emerald-400 ml-[26px]" : "bg-fg/40 ml-1"
                            }`}
                          />
                          {isHandling && <Loader2 size={12} className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 animate-spin text-fg/50" />}
                        </button>
                      </div>

                      {/* Detail btn */}
                      <button 
                         onClick={() => handleContactSelect(c.psid)}
                         className="flex items-center gap-2 text-sm text-orange-400 hover:text-orange-300 font-medium"
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
