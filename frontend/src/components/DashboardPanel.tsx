"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertCircle,
  ArrowRight,
  ArrowUpRight,
  Bot,
  CheckCircle2,
  ChevronRight,
  MessageCircle,
  MessageSquare,
  Plug,
  RefreshCw,
  Settings,
  Sparkles,
  TrendingUp,
  Users,
  Wallet,
  Workflow,
  Zap,
} from "lucide-react";
import FlareMark from "@/components/FlareMark";
import { getChatbotOverview, getDashboardStats, type ChatbotOverview, type DashboardStats } from "@/lib/api";

// ─── Période ──────────────────────────────────────────────────────────────────

const PERIOD_OPTIONS = [
  { key: "today", label: "Auj.", days: 0 },
  { key: "7d",    label: "7 j",  days: 7  },
  { key: "30d",   label: "30 j", days: 30 },
] as const;

type PeriodKey = typeof PERIOD_OPTIONS[number]["key"];

function getPeriodDates(key: PeriodKey): { from_date: string; to_date: string } {
  const now = new Date();
  const to = now.toISOString();
  if (key === "today") {
    const from = new Date(now);
    from.setHours(0, 0, 0, 0);
    return { from_date: from.toISOString(), to_date: to };
  }
  const opt = PERIOD_OPTIONS.find((o) => o.key === key)!;
  const from = new Date(now.getTime() - opt.days * 24 * 60 * 60 * 1000);
  return { from_date: from.toISOString(), to_date: to };
}

// ─── Carte stat ───────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon: Icon,
  loading,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  loading?: boolean;
}) {
  if (loading) {
    return <div className="animate-pulse rounded-xl bg-white/[0.02] h-[72px]" />;
  }
  return (
    <div className="rounded-xl bg-white/[0.02] p-4 flex flex-col gap-2">
      <div className="flex items-center gap-1.5">
        <Icon size={11} className="text-white/25" />
        <span className="text-[10px] text-white/30 uppercase tracking-[0.12em]">{label}</span>
      </div>
      <span className="text-[22px] font-semibold tracking-tight text-white tabular-nums leading-none">
        {value.toLocaleString("fr-FR")}
      </span>
    </div>
  );
}

interface DashboardPanelProps {
  onNavigate?: (view: string) => void;
  currentScopeLabel?: string;
  currentScopeOffer?: string;
  hasSharedOrganizations?: boolean;
  organizationConnectionRequired?: boolean;
  onOpenScopeChooser?: () => void;
  brandName?: string;
  workspaceName?: string;
  brandLogoUrl?: string;
  userDisplayName?: string;
  userAvatarUrl?: string;
  token?: string | null;
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Bonjour";
  if (h < 18) return "Bon après-midi";
  return "Bonsoir";
}

function statusColor(status: string) {
  if (status === "active") return "text-emerald-400";
  if (status === "sync_error" || status === "reconnect_required") return "text-orange-400";
  if (status === "disconnected") return "text-red-400";
  return "text-white/30";
}

function statusLabel(status: string) {
  if (status === "active") return "Actif";
  if (status === "sync_error") return "Erreur de sync";
  if (status === "reconnect_required") return "Reconnexion requise";
  if (status === "disconnected") return "Déconnecté";
  if (status === "pending") return "En attente";
  return status;
}

function ChatbotStatusCard({
  overview,
  loading,
  onNavigate,
  isOrgRequired,
  onOpenScopeChooser,
}: {
  overview: ChatbotOverview | null;
  loading: boolean;
  onNavigate?: (view: string) => void;
  isOrgRequired?: boolean;
  onOpenScopeChooser?: () => void;
}) {
  if (isOrgRequired) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-white/[0.05] bg-white/[0.02] p-5"
      >
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/[0.04] text-white/20">
            <Bot size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-[15px] font-medium text-white/60">Chatbot Facebook</h3>
            <p className="mt-1 text-[13px] text-white/30 leading-relaxed">
              Connectez votre organisation pour activer votre chatbot.
            </p>
            <button
              onClick={onOpenScopeChooser}
              className="mt-3 flex items-center gap-2 rounded-lg bg-white/[0.04] px-4 py-2 text-[11px] font-medium uppercase tracking-widest text-white/40 hover:bg-white/[0.07] hover:text-white transition-all"
            >
              <Plug size={11} />
              Choisir mon espace
            </button>
          </div>
        </div>
      </motion.div>
    );
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-white/[0.05] bg-white/[0.02] p-5 animate-pulse">
        <div className="flex items-start gap-4">
          <div className="h-11 w-11 rounded-xl bg-white/[0.04]" />
          <div className="flex-1 space-y-2 pt-1">
            <div className="h-4 w-36 rounded bg-white/[0.04]" />
            <div className="h-3 w-52 rounded bg-white/[0.03]" />
            <div className="h-3 w-40 rounded bg-white/[0.02]" />
          </div>
        </div>
      </div>
    );
  }

  if (!overview) return null;

  const { step, active_page, preferences, total_pages } = overview;
  const isComplete = step === "complete";
  const isConnected = step !== "connect_page" && step !== "need_org";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-white/[0.05] bg-white/[0.02] p-5 hover:bg-white/[0.03] transition-colors"
    >
      <div className="flex items-start gap-4">
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
          isComplete
            ? "bg-emerald-500/10 text-emerald-400"
            : isConnected
            ? "bg-orange-500/10 text-orange-400"
            : "bg-white/[0.04] text-white/25"
        }`}>
          <Bot size={18} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-[15px] font-medium text-white">Chatbot Facebook</h3>
            {isComplete ? (
              <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400 uppercase tracking-wide">
                <CheckCircle2 size={9} />
                En ligne
              </span>
            ) : isConnected ? (
              <span className="rounded-full bg-orange-500/10 px-2 py-0.5 text-[10px] font-medium text-orange-400 uppercase tracking-wide">
                Config requise
              </span>
            ) : (
              <span className="rounded-full bg-white/[0.04] px-2 py-0.5 text-[10px] font-medium text-white/25 uppercase tracking-wide">
                Non configuré
              </span>
            )}
          </div>

          {active_page && (
            <p className="mt-1 text-[12px] text-white/35">
              Page :{" "}
              <span className={`font-medium ${statusColor(active_page.status)}`}>
                {active_page.page_name}
              </span>
              {active_page.status !== "active" && (
                <span className="ml-1.5 text-orange-400/60">
                  ({statusLabel(active_page.status)})
                </span>
              )}
            </p>
          )}

          {preferences && (
            <p className="mt-0.5 text-[11px] text-white/20">
              {preferences.bot_name} · Ton {preferences.tone}
            </p>
          )}

          {active_page?.last_error && (
            <div className="mt-2 flex items-start gap-1.5 rounded-lg bg-orange-500/[0.06] px-3 py-2">
              <AlertCircle size={11} className="mt-0.5 shrink-0 text-orange-400/60" />
              <p className="text-[11px] text-orange-300/50 leading-relaxed">{active_page.last_error}</p>
            </div>
          )}

          <div className="mt-3 flex flex-wrap gap-2">
            {!isComplete && (
              <button
                onClick={() => onNavigate?.("chatbot")}
                className="flex items-center gap-1.5 rounded-lg bg-orange-500/10 px-3 py-2 text-[11px] font-medium text-orange-400 hover:bg-orange-500/20 transition-all"
              >
                <Zap size={11} />
                {step === "connect_page" ? "Connecter ma page" : "Terminer la config"}
              </button>
            )}
            {isComplete && (
              <>
                <button
                  onClick={() => onNavigate?.("conversations")}
                  className="flex items-center gap-1.5 rounded-lg bg-white/[0.04] px-3 py-2 text-[11px] font-medium text-white/40 hover:bg-white/[0.07] hover:text-white transition-all"
                >
                  <MessageCircle size={11} />
                  Conversations
                </button>
                <button
                  onClick={() => onNavigate?.("leads")}
                  className="flex items-center gap-1.5 rounded-lg bg-white/[0.04] px-3 py-2 text-[11px] font-medium text-white/40 hover:bg-white/[0.07] hover:text-white transition-all"
                >
                  <Users size={11} />
                  Leads
                </button>
                <button
                  onClick={() => onNavigate?.("chatbot")}
                  className="flex items-center gap-1.5 rounded-lg bg-white/[0.04] px-3 py-2 text-[11px] font-medium text-white/40 hover:bg-white/[0.07] hover:text-white transition-all"
                >
                  <Settings size={11} />
                  Gérer
                </button>
              </>
            )}
          </div>
        </div>

        {total_pages > 0 && (
          <p className="shrink-0 text-[11px] text-white/15 mt-0.5">
            {total_pages} page{total_pages > 1 ? "s" : ""}
          </p>
        )}
      </div>
    </motion.div>
  );
}

const QUICK_ACTIONS = [
  {
    id: "assistant",
    label: "Assistant IA",
    description: "Rédiger, analyser",
    view: "chat",
    icon: Sparkles,
    color: "text-[rgb(139,170,236)] bg-[rgba(39,77,178,0.12)]",
    requiresOrg: false,
  },
  {
    id: "conversations",
    label: "Conversations",
    description: "Messages Messenger",
    view: "conversations",
    icon: MessageCircle,
    color: "text-emerald-400 bg-emerald-500/10",
    requiresOrg: true,
  },
  {
    id: "leads",
    label: "Leads",
    description: "Clients à traiter",
    view: "leads",
    icon: Users,
    color: "text-blue-400 bg-blue-500/10",
    requiresOrg: true,
  },
  {
    id: "expenses",
    label: "Budget",
    description: "Coûts chatbot",
    view: "expenses",
    icon: Wallet,
    color: "text-purple-400 bg-purple-500/10",
    requiresOrg: true,
  },
  {
    id: "automations",
    label: "Automatisations",
    description: "Tous les modules",
    view: "automationHub",
    icon: Workflow,
    color: "text-orange-400 bg-orange-500/10",
    requiresOrg: true,
  },
];

export default function DashboardPanel({
  onNavigate,
  currentScopeLabel,
  currentScopeOffer,
  organizationConnectionRequired = false,
  onOpenScopeChooser,
  userDisplayName = "Utilisateur",
  brandLogoUrl,
  brandName,
  token,
}: DashboardPanelProps) {
  const [overview, setOverview] = useState<ChatbotOverview | null>(null);
  const [loadingOverview, setLoadingOverview] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const [period, setPeriod] = useState<PeriodKey>("7d");
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);

  useEffect(() => {
    if (!token) return;
    setLoadingOverview(true);
    getChatbotOverview(token)
      .then(setOverview)
      .catch(() => setOverview(null))
      .finally(() => setLoadingOverview(false));
  }, [token, refreshKey]);

  useEffect(() => {
    if (!token) return;
    setLoadingStats(true);
    const { from_date, to_date } = getPeriodDates(period);
    getDashboardStats(token, from_date, to_date)
      .then(setStats)
      .catch(() => setStats(null))
      .finally(() => setLoadingStats(false));
  }, [token, period, refreshKey]);

  const greeting = getGreeting();
  const firstName = userDisplayName.split(" ")[0];
  const scopeIsOrg = !organizationConnectionRequired && Boolean(currentScopeLabel);

  return (
    <div className="flex-1 overflow-y-auto bg-[var(--background)]">
      <div className="mx-auto flex w-full max-w-[860px] flex-col gap-7 px-4 py-8 md:px-6 md:py-12">

        {/* ── Welcome ── */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="px-1"
        >
          <div className="flex items-center gap-2.5 mb-5">
            {brandLogoUrl ? (
              <img src={brandLogoUrl} alt="" className="h-5 w-5 rounded object-contain opacity-60" />
            ) : (
              <FlareMark tone="auto" className="w-5" />
            )}
            <p className="text-[10px] uppercase tracking-[0.14em] text-white/25">
              {currentScopeLabel || brandName || "FLARE AI"}
            </p>
          </div>

          <h1 className="text-[27px] md:text-[34px] font-semibold tracking-[-0.03em] text-white">
            {greeting}, {firstName}.
          </h1>
          <p className="mt-1.5 text-[14px] text-white/30 font-light">
            {scopeIsOrg
              ? `Espace ${currentScopeLabel}${currentScopeOffer ? ` · ${currentScopeOffer}` : ""}`
              : "Connectez votre organisation pour accéder à tous vos outils."}
          </p>
        </motion.section>

        {/* ── Org connection prompt ── */}
        <AnimatePresence>
          {organizationConnectionRequired && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="rounded-2xl border border-orange-500/20 bg-orange-500/[0.04] p-5"
            >
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-orange-500/10 text-orange-400">
                  <Plug size={15} />
                </div>
                <div className="flex-1">
                  <p className="text-[14px] font-medium text-white">Connectez votre espace de travail</p>
                  <p className="mt-0.5 text-[12px] text-white/35 leading-relaxed">
                    Sélectionnez votre organisation pour activer le chatbot, les conversations et tous vos outils automatisés.
                  </p>
                  <button
                    onClick={onOpenScopeChooser}
                    className="mt-3 flex items-center gap-2 rounded-lg bg-orange-500/15 px-4 py-2.5 text-[11px] font-medium uppercase tracking-widest text-orange-300 hover:bg-orange-500/25 transition-all"
                  >
                    Choisir mon espace
                    <ArrowRight size={12} />
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Chatbot status card ── */}
        <section>
          <div className="flex items-center justify-between mb-3 px-0.5">
            <p className="text-[10px] uppercase tracking-[0.14em] text-white/25">Chatbot</p>
            {!organizationConnectionRequired && token && (
              <button
                onClick={() => setRefreshKey((k) => k + 1)}
                className="flex items-center gap-1 text-[10px] text-white/20 hover:text-white/50 transition-colors"
              >
                <RefreshCw size={10} className={loadingOverview ? "animate-spin" : ""} />
                Actualiser
              </button>
            )}
          </div>
          <ChatbotStatusCard
            overview={overview}
            loading={loadingOverview}
            onNavigate={onNavigate}
            isOrgRequired={organizationConnectionRequired}
            onOpenScopeChooser={onOpenScopeChooser}
          />
        </section>

        {/* ── Activité ── */}
        {!organizationConnectionRequired && token && (
          <section>
            <div className="flex items-center justify-between mb-3 px-0.5">
              <div className="flex items-center gap-1.5">
                <TrendingUp size={11} className="text-white/25" />
                <p className="text-[10px] uppercase tracking-[0.14em] text-white/25">Activité</p>
              </div>
              <div className="flex items-center rounded-lg bg-white/[0.03] border border-white/[0.04] p-0.5 gap-0.5">
                {PERIOD_OPTIONS.map((opt) => (
                  <button
                    key={opt.key}
                    onClick={() => setPeriod(opt.key)}
                    className={`px-2.5 py-1 rounded-md text-[10px] font-medium transition-all ${
                      period === opt.key
                        ? "bg-white/[0.08] text-white shadow-sm"
                        : "text-white/30 hover:text-white/50"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <StatCard
                label="Messages"
                value={stats?.period.messages ?? 0}
                icon={MessageCircle}
                loading={loadingStats}
              />
              <StatCard
                label="Conversations"
                value={stats?.period.conversations ?? 0}
                icon={MessageSquare}
                loading={loadingStats}
              />
              <StatCard
                label="Leads"
                value={stats?.period.leads ?? 0}
                icon={Users}
                loading={loadingStats}
              />
            </div>
          </section>
        )}

        {/* ── Quick actions ── */}
        <section>
          <p className="text-[10px] uppercase tracking-[0.14em] text-white/25 mb-3 px-0.5">
            Accès rapide
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5">
            {QUICK_ACTIONS.map((action, i) => {
              const Icon = action.icon;
              const isLocked = action.requiresOrg && organizationConnectionRequired;
              return (
                <motion.button
                  key={action.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  onClick={() =>
                    isLocked ? onOpenScopeChooser?.() : onNavigate?.(action.view)
                  }
                  className={`group flex flex-col items-start gap-3 rounded-xl p-4 text-left transition-all duration-200 ${
                    isLocked
                      ? "bg-white/[0.01] opacity-40 cursor-default"
                      : "bg-white/[0.02] hover:bg-white/[0.04] cursor-pointer"
                  }`}
                >
                  <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${action.color}`}>
                    <Icon size={14} />
                  </div>
                  <div>
                    <p className="text-[12px] font-medium text-white leading-tight">
                      {action.label}
                    </p>
                    <p className="mt-0.5 text-[10px] text-white/25 leading-tight">
                      {action.description}
                    </p>
                  </div>
                </motion.button>
              );
            })}
          </div>
        </section>

        {/* ── Modules overview ── */}
        {!organizationConnectionRequired && (
          <section>
            <div className="flex items-center justify-between mb-3 px-0.5">
              <p className="text-[10px] uppercase tracking-[0.14em] text-white/25">Modules</p>
              <button
                onClick={() => onNavigate?.("automationHub")}
                className="flex items-center gap-1 text-[10px] text-white/20 hover:text-white/50 transition-colors"
              >
                Voir tout
                <ChevronRight size={11} />
              </button>
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.12 }}
                className="group cursor-pointer rounded-xl bg-white/[0.02] p-4 hover:bg-white/[0.04] transition-all"
                onClick={() => onNavigate?.("chatbot")}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-orange-500/10 text-orange-400">
                      <Bot size={14} />
                    </div>
                    <div>
                      <p className="text-[13px] font-medium text-white">Chatbot Facebook</p>
                      <p className="mt-0.5 text-[11px] text-white/25">
                        {overview?.step === "complete"
                          ? "Opérationnel"
                          : overview?.step === "connect_page"
                          ? "Page non connectée"
                          : overview?.step === "configure"
                          ? "Configuration requise"
                          : "—"}
                      </p>
                    </div>
                  </div>
                  <ArrowUpRight
                    size={13}
                    className="mt-0.5 shrink-0 text-white/15 group-hover:text-white/40 transition-colors"
                  />
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.16 }}
                className="group cursor-pointer rounded-xl bg-white/[0.02] p-4 hover:bg-white/[0.04] transition-all"
                onClick={() => onNavigate?.("chat")}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[rgba(39,77,178,0.12)] text-[rgb(139,170,236)]">
                      <Sparkles size={14} />
                    </div>
                    <div>
                      <p className="text-[13px] font-medium text-white">Assistant IA</p>
                      <p className="mt-0.5 text-[11px] text-white/25">Actif</p>
                    </div>
                  </div>
                  <ArrowUpRight
                    size={13}
                    className="mt-0.5 shrink-0 text-white/15 group-hover:text-white/40 transition-colors"
                  />
                </div>
              </motion.div>
            </div>
          </section>
        )}

      </div>
    </div>
  );
}
