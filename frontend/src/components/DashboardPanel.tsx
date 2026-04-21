"use client";
import { useEffect, useState } from "react";
/* eslint-disable @next/next/no-img-element */
import { motion } from "framer-motion";
import {
  AlertCircle,
  ArrowUpRight,
  Bot,
  CheckCircle2,
  ChevronRight,
  MessageCircle,
  MessageSquare,
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
const PERIOD_OPTIONS = [
  { key: "today", label: "Auj.", days: 0 },
  { key: "7d", label: "7 j", days: 7 },
  { key: "30d", label: "30 j", days: 30 },
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
    return <div className="h-[72px] animate-pulse rounded-xl border border-[var(--border-default)] bg-[var(--surface-subtle)]" />;
  }
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-[var(--border-default)] bg-[var(--surface-base)] p-4">
      <div className="flex items-center gap-2">
        <Icon size={16} className="text-[var(--text-secondary)]" />
        <span className="text-xs font-bold uppercase tracking-[0.08em] text-[var(--text-secondary)]">{label}</span>
      </div>
      <span className="text-3xl font-bold leading-none tracking-tight text-[var(--text-primary)] tabular-nums">
        {value.toLocaleString("fr-FR")}
      </span>
    </div>
  );
}
interface DashboardPanelProps {
  onNavigate?: (view: string) => void;
  workspaceName?: string;
  brandLogoUrl?: string;
  userDisplayName?: string;
  userAvatarUrl?: string;
  token?: string | null;
}
function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Bonjour";
  if (h < 18) return "Bon apres-midi";
  return "Bonsoir";
}
function statusColor(status: string) {
  if (status === "active") return "text-orange-500 dark:text-orange-300";
  if (status === "sync_error" || status === "reconnect_required") return "text-orange-400";
  if (status === "disconnected") return "text-red-400";
  return "text-[var(--text-muted)]";
}
function statusLabel(status: string) {
  if (status === "active") return "Actif";
  if (status === "sync_error") return "Erreur de sync";
  if (status === "reconnect_required") return "Reconnexion requise";
  if (status === "disconnected") return "Deconnecte";
  if (status === "pending") return "En attente";
  return status;
}
function ChatbotStatusCard({
  overview,
  loading,
  onNavigate,
}: {
  overview: ChatbotOverview | null;
  loading: boolean;
  onNavigate?: (view: string) => void;
}) {
  if (loading) {
    return (
      <div className="animate-pulse rounded-2xl border border-[var(--border-default)] bg-[var(--surface-base)] p-5">
        <div className="flex items-start gap-4">
          <div className="h-11 w-11 rounded-xl bg-[var(--surface-subtle)]" />
          <div className="flex-1 space-y-2 pt-1">
            <div className="h-4 w-36 rounded bg-[var(--surface-subtle)]" />
            <div className="h-3 w-52 rounded bg-[var(--surface-subtle)]" />
            <div className="h-3 w-40 rounded bg-[var(--surface-subtle)]" />
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
      className="rounded-2xl border border-[var(--border-default)] bg-[var(--surface-base)] p-5 transition-colors hover:bg-[var(--surface-subtle)]"
    >
      <div className="flex items-start gap-4">
        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
            isComplete
              ? "bg-orange-500/12 text-orange-500 dark:text-orange-300"
              : isConnected
                ? "bg-orange-500/10 text-orange-400"
                : "bg-[var(--surface-subtle)] text-[var(--text-muted)]"
          }`}
        >
          <Bot size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-bold text-[var(--text-primary)]">Chatbot Facebook</h3>
            {isComplete ? (
              <span className="flex items-center gap-1 rounded-full bg-orange-500/12 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-orange-600 dark:text-orange-300">
                <CheckCircle2 size={12} />
                En ligne
              </span>
            ) : isConnected ? (
              <span className="rounded-full bg-orange-500/10 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide text-orange-500">
                Config requise
              </span>
            ) : (
              <span className="rounded-full bg-[var(--surface-subtle)] px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide text-[var(--text-secondary)]">
                Non configure
              </span>
            )}
          </div>
          {active_page && (
            <p className="mt-2 text-sm text-[var(--text-secondary)]">
              Page:{" "}
              <span className={`font-bold ${statusColor(active_page.status)}`}>{active_page.page_name}</span>
              {active_page.status !== "active" && (
                <span className="ml-1.5 text-orange-500 font-medium">({statusLabel(active_page.status)})</span>
              )}
            </p>
          )}
          {preferences && (
            <p className="mt-1 text-sm font-medium text-[var(--text-secondary)]">
              {preferences.bot_name} • Ton {preferences.tone}
            </p>
          )}
          {active_page?.last_error && (
            <div className="mt-3 flex items-start gap-2 rounded-lg bg-orange-500/10 px-4 py-3">
              <AlertCircle size={16} className="mt-0.5 shrink-0 text-orange-600" />
              <p className="text-sm font-medium leading-relaxed text-orange-600 dark:text-orange-300">{active_page.last_error}</p>
            </div>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            {!isComplete && (
              <button
                onClick={() => onNavigate?.("chatbot")}
                className="flex items-center gap-2 rounded-lg bg-orange-500/10 px-4 py-2.5 text-xs font-bold text-orange-600 transition-all hover:bg-orange-500/20 dark:text-orange-300"
              >
                <Zap size={11} />
                {step === "connect_page" ? "Connecter ma page" : "Terminer la config"}
              </button>
            )}
            {isComplete && (
              <>
                <button
                  onClick={() => onNavigate?.("conversations")}
                  className="flex items-center gap-1.5 rounded-lg border border-[var(--border-default)] bg-[var(--surface-subtle)] px-3 py-2 text-xs font-bold text-[var(--text-secondary)] transition-all hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]"
                >
                  <MessageCircle size={11} />
                  Conversations
                </button>
                <button
                  onClick={() => onNavigate?.("leads")}
                  className="flex items-center gap-1.5 rounded-lg border border-[var(--border-default)] bg-[var(--surface-subtle)] px-3 py-2 text-xs font-bold text-[var(--text-secondary)] transition-all hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]"
                >
                  <Users size={11} />
                  Leads
                </button>
                <button
                  onClick={() => onNavigate?.("chatbot")}
                  className="flex items-center gap-1.5 rounded-lg border border-[var(--border-default)] bg-[var(--surface-subtle)] px-3 py-2 text-xs font-bold text-[var(--text-secondary)] transition-all hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]"
                >
                  <Settings size={11} />
                  Gerer
                </button>
              </>
            )}
          </div>
        </div>
        {total_pages > 0 && (
          <p className="mt-0.5 shrink-0 text-xs text-[var(--text-secondary)]">
            {total_pages} page{total_pages > 1 ? "s" : ""}
          </p>
        )}
      </div>
    </motion.div>
  );
}
const QUICK_ACTIONS = [
  {
    id: "chatbot",
    label: "Chatbot Facebook",
    description: "Activation et pilotage",
    view: "chatbot",
    icon: Bot,
    color: "bg-orange-500/12 text-orange-500 dark:text-orange-300",
  },
  {
    id: "assistant",
    label: "Assistant IA",
    description: "Rediger et analyser",
    view: "chat",
    icon: Sparkles,
    color: "bg-[rgba(12,32,74,0.12)] text-[var(--accent-navy)] dark:bg-[rgba(122,158,255,0.16)] dark:text-[rgb(183,203,255)]",
  },
  {
    id: "conversations",
    label: "Conversations",
    description: "Messages Messenger",
    view: "conversations",
    icon: MessageCircle,
    color: "bg-orange-500/12 text-orange-500 dark:text-orange-300",
  },
  {
    id: "leads",
    label: "Leads",
    description: "Clients a traiter",
    view: "leads",
    icon: Users,
    color: "bg-[rgba(12,32,74,0.12)] text-[var(--accent-navy)] dark:bg-[rgba(122,158,255,0.16)] dark:text-[rgb(183,203,255)]",
  },
  {
    id: "automations",
    label: "Automatisations",
    description: "Tous les modules",
    view: "automationHub",
    icon: Workflow,
    color: "bg-orange-500/12 text-orange-500 dark:text-orange-300",
  },
  {
    id: "expenses",
    label: "Budget",
    description: "Couts chatbot",
    view: "expenses",
    icon: Wallet,
    color: "bg-[rgba(12,32,74,0.12)] text-[var(--accent-navy)] dark:bg-[rgba(122,158,255,0.16)] dark:text-[rgb(183,203,255)]",
  },
] as const;
export default function DashboardPanel({
  onNavigate,
  userDisplayName = "Utilisateur",
  brandLogoUrl,
  workspaceName,
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
  const scopeLabel = workspaceName || "FLARE AI";
  return (
    <div className="flex-1 overflow-y-auto bg-[var(--background)]">
      <div className="mx-auto flex w-full max-w-[860px] flex-col gap-7 px-4 py-8 md:px-6 md:py-12">
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="px-1"
        >
          <div className="mb-5 flex items-center gap-2.5">
            {brandLogoUrl ? (
              <img src={brandLogoUrl} alt="" className="h-6 w-6 rounded object-contain opacity-90" />
            ) : (
              <FlareMark tone="auto" className="w-6" />
            )}
            <p className="text-xs uppercase tracking-[0.08em] text-[var(--text-secondary)] font-bold">
              {scopeLabel}
            </p>
          </div>
          <h1 className="text-3xl font-bold tracking-[-0.03em] text-[var(--text-primary)] md:text-[40px] md:leading-tight">
            {greeting}, {firstName}.
          </h1>
          <p className="mt-2 text-base font-medium text-[var(--text-secondary)]">
            Voici l&apos;etat de ton compte et de tes automatisations.
          </p>
        </motion.section>
        <section>
          <div className="mb-3 flex items-center justify-between px-0.5">
            <p className="text-xs uppercase font-bold tracking-[0.08em] text-[var(--text-secondary)]">Chatbot</p>
            {token && (
              <button
                onClick={() => setRefreshKey((k) => k + 1)}
                className="flex items-center gap-1.5 text-xs font-bold text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
              >
                <RefreshCw size={12} className={loadingOverview ? "animate-spin" : ""} />
                Actualiser
              </button>
            )}
          </div>
          <ChatbotStatusCard
            overview={overview}
            loading={loadingOverview}
            onNavigate={onNavigate}
          />
        </section>
        {token && (
          <section>
            <div className="mb-3 flex items-center justify-between px-0.5">
              <div className="flex items-center gap-2">
                <TrendingUp size={16} className="text-[var(--text-secondary)]" />
                <p className="text-xs font-bold uppercase tracking-[0.08em] text-[var(--text-secondary)]">Activite</p>
              </div>
              <div className="flex items-center gap-0.5 rounded-lg border border-[var(--border-default)] bg-[var(--surface-subtle)] p-0.5">
                {PERIOD_OPTIONS.map((opt) => (
                  <button
                    key={opt.key}
                    onClick={() => setPeriod(opt.key)}
                    className={`rounded-md px-3 py-1.5 text-xs font-bold transition-all ${
                      period === opt.key
                        ? "bg-[var(--surface-base)] text-[var(--text-primary)] shadow-sm"
                        : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <StatCard label="Messages" value={stats?.period.messages ?? 0} icon={MessageCircle} loading={loadingStats} />
              <StatCard label="Conversations" value={stats?.period.conversations ?? 0} icon={MessageSquare} loading={loadingStats} />
              <StatCard label="Leads" value={stats?.period.leads ?? 0} icon={Users} loading={loadingStats} />
            </div>
          </section>
        )}
        <section>
          <p className="mb-3 px-0.5 text-xs font-bold uppercase tracking-[0.08em] text-[var(--text-secondary)]">Acces rapide</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-3">
            {QUICK_ACTIONS.map((action, i) => {
              const Icon = action.icon;
              return (
                <motion.button
                  key={action.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  onClick={() => onNavigate?.(action.view)}
                  className="group flex flex-col items-start gap-3 rounded-xl border border-[var(--border-default)] bg-[var(--surface-base)] p-4 text-left transition-all duration-200 hover:bg-[var(--surface-subtle)]"
                >
                  <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${action.color}`}>
                    <Icon size={18} />
                  </div>
                  <div>
                    <p className="text-sm font-bold leading-tight text-[var(--text-primary)]">{action.label}</p>
                    <p className="mt-1 text-xs font-medium leading-tight text-[var(--text-secondary)]">{action.description}</p>
                  </div>
                </motion.button>
              );
            })}
          </div>
        </section>
          <section>
            <div className="mb-3 flex items-center justify-between px-0.5">
              <p className="text-xs font-bold uppercase tracking-[0.08em] text-[var(--text-secondary)]">Modules</p>
              <button
                onClick={() => onNavigate?.("automationHub")}
                className="flex items-center gap-1.5 text-xs font-bold text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
              >
                Voir tout
                <ChevronRight size={14} />
              </button>
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.12 }}
                className="group cursor-pointer rounded-xl border border-[var(--border-default)] bg-[var(--surface-base)] p-4 transition-all hover:bg-[var(--surface-subtle)]"
                onClick={() => onNavigate?.("chatbot")}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-orange-500/10 text-orange-400">
                      <Bot size={18} />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-[var(--text-primary)]">Chatbot Facebook</p>
                      <p className="mt-1 text-xs font-medium text-[var(--text-secondary)]">
                        {overview?.step === "complete"
                          ? "Operationnel"
                          : overview?.step === "connect_page"
                            ? "Page non connectee"
                            : overview?.step === "configure"
                              ? "Configuration requise"
                              : "-"}
                      </p>
                    </div>
                  </div>
                  <ArrowUpRight size={16} className="mt-0.5 shrink-0 text-[var(--text-secondary)] transition-colors group-hover:text-[var(--text-primary)]" />
                </div>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.16 }}
                className="group cursor-pointer rounded-xl border border-[var(--border-default)] bg-[var(--surface-base)] p-4 transition-all hover:bg-[var(--surface-subtle)]"
                onClick={() => onNavigate?.("chat")}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[rgba(12,32,74,0.12)] text-[var(--accent-navy)] dark:bg-[rgba(122,158,255,0.16)] dark:text-[rgb(183,203,255)]">
                      <Sparkles size={18} />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-[var(--text-primary)]">Assistant IA</p>
                      <p className="mt-1 text-xs font-medium text-[var(--text-secondary)]">Actif</p>
                    </div>
                  </div>
                  <ArrowUpRight size={16} className="mt-0.5 shrink-0 text-[var(--text-secondary)] transition-colors group-hover:text-[var(--text-primary)]" />
                </div>
              </motion.div>
            </div>
          </section>
      </div>
    </div>
  );
}
