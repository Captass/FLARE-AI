"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import {
  Users, DollarSign, RefreshCcw, ShieldCheck, Search,
  ChevronDown, ChevronRight, Cpu, Brain, Zap,
  MessageSquare, Globe, Microscope, ImageIcon, Video,
  Clock, TrendingUp, AlertCircle, BookOpen, ArrowUpDown,
  Wifi, WifiOff, UserPlus, Activity, ChevronLeft,
  FileText, FileSpreadsheet, ShoppingBag, CreditCard,
  Rocket, CheckCircle2, XCircle, Eye, Send, StickyNote,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  getAdminUsageSummary, syncAdminUsers, getAdminUsageLedger, backfillAdminUsage,
  getAdminConnectedUsers, getAdminNewAccounts,
  type ConnectedUser, type ConnectedUsersResponse,
  type NewAccount, type NewAccountsResponse,
  getAdminActivations, getAdminActivation, adminAssignActivation,
  adminSetActivationStatus, adminAddActivationNote,
  getAdminPayments, adminVerifyPayment, adminRejectPayment,
  getAdminOrders, adminUpdateOrder,
  type ActivationRequest, type ChatbotOrder,
} from "@/lib/api";
import AdminReportsTab from "@/components/AdminReportsTab";

interface AdminPanelProps {
  token?: string | null;
}

// ── Types ──────────────────────────────────────────────────────────────────

interface ActionBreakdown {
  actions: number;
  tokens: number;
  cost: number;
}

interface ModelBreakdown {
  total: ActionBreakdown;
  by_action: {
    message: ActionBreakdown;
    research: ActionBreakdown;
    deep_research: ActionBreakdown;
    image_gen: ActionBreakdown;
    video_gen: ActionBreakdown;
    doc_gen: ActionBreakdown;
    sheet_gen: ActionBreakdown;
  };
}

interface UserCostData {
  user_id: string;
  email: string;
  plan: string;
  models: Record<string, ModelBreakdown>;
  grand_total: { tokens: number; cost: number };
  last_active: string;
  last_model: string;
}

interface SummaryResponse {
  total_users: number;
  total_cost: number;
  users: UserCostData[];
}

interface LedgerEntry {
    id: number;
    user_email: string;
    model: string;
    action: string;
    tokens: number;
    cost: number;
    timestamp: string;
}

type AdminTab = "menu" | "costs" | "connected" | "accounts" | "activations" | "payments" | "orders" | "reports";

// ── Helpers ─────────────────────────────────────────────────────────────────

const ACTION_META: Record<string, { icon: typeof MessageSquare; label: string; color: string; emoji: string }> = {
  message:       { icon: MessageSquare,  label: "Messages",      color: "text-[var(--accent-navy)]",    emoji: "💬" },
  research:      { icon: Globe,          label: "Recherche",     color: "text-[var(--accent-navy)]",    emoji: "🔍" },
  deep_research: { icon: Microscope,     label: "Deep Research", color: "text-[var(--text-primary)]",   emoji: "🧪" },
  image_gen:     { icon: ImageIcon,      label: "Image Gen",     color: "text-orange-500",    emoji: "🎨" },
  video_gen:     { icon: Video,          label: "Vidéo Gen",     color: "text-orange-500", emoji: "🎬" },
  doc_gen:       { icon: FileText,       label: "Documents",     color: "text-[var(--accent-navy)]",  emoji: "📝" },
  sheet_gen:     { icon: FileSpreadsheet, label: "Tableurs",     color: "text-orange-500", emoji: "📊" },
};

function formatCost(val: any): string {
  if (val === undefined || val === null || isNaN(Number(val))) return "$0.00";
  const num = Number(val);
  if (num < 0.0001 && num > 0) return `< $0.0001`;
  if (num === 0) return "$0.00";
  return `$${num.toFixed(4)}`;
}

function formatTokens(v: any): string {
  if (v === undefined || v === null || isNaN(Number(v))) return "0";
  const num = Number(v);
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return Math.floor(num).toString();
}

function timeAgo(iso: string): string {
  if (!iso) return "—";
  try {
    const date = new Date(iso);
    if (isNaN(date.getTime())) return iso;
    const diff = Date.now() - date.getTime();
    
    const secs = Math.floor(diff / 1000);
    if (secs < 60) return "à l'instant";
    
    const mins = Math.floor(secs / 60);
    if (mins < 60) return `il y a ${mins}min`;
    
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `il y a ${hours}h`;
    
    const days = Math.floor(hours / 24);
    return `il y a ${days}j`;
  } catch (e) {
    return "—";
  }
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch {
    return "—";
  }
}

// ── Sub-Components ──────────────────────────────────────────────────────────

function DataSubGrid({ actions, tokens, cost, accent = "text-[var(--text-primary)]" }: any) {
  return (
    <div className="grid grid-cols-3 gap-1 h-full items-center">
      <div className="text-center font-[family-name:var(--font-outfit)] text-[10px] text-[var(--text-secondary)]">{actions || 0}</div>
      <div className="text-right font-[family-name:var(--font-outfit)] text-[10px] text-[var(--text-secondary)]">{formatTokens(tokens)}</div>
      <div className={`text-right font-[family-name:var(--font-outfit)] text-[10px] font-bold ${accent}`}>{formatCost(cost)}</div>
    </div>
  );
}

function ActionRow({ label, icon: Icon, emoji, g3, flash, total_cost }: any) {
  return (
    <div className="grid grid-cols-12 gap-0 py-2 border-b border-[var(--border-default)] items-center last:border-0 hover:bg-[var(--surface-subtle)] transition-colors -mx-4 px-4">
      <div className="col-span-3 flex items-center gap-2.5">
        <div className="flex h-5 w-5 items-center justify-center rounded-md border border-[var(--border-default)] bg-[var(--surface-subtle)]">
          <span className="text-[12px]">{emoji}</span>
        </div>
        <span className="text-[11px] font-medium text-[var(--text-secondary)]">{label}</span>
      </div>

      <div className="col-span-3 h-full px-2">
        <DataSubGrid actions={g3?.actions} tokens={g3?.tokens} cost={g3?.cost} accent="text-[var(--text-primary)]/80" />
      </div>

      <div className="col-span-3 h-full px-2 border-l border-[var(--border-default)]">
        <DataSubGrid actions={flash?.actions} tokens={flash?.tokens} cost={flash?.cost} accent="text-[var(--accent-navy)]" />
      </div>

      <div className="col-span-3 text-right pr-4">
        <span className="text-[11px] font-bold text-[var(--text-primary)] font-[family-name:var(--font-outfit)] tracking-tighter">{formatCost(total_cost || 0)}</span>
      </div>
    </div>
  );
}

const LedgerTable = ({ ledger, loading }: { ledger: LedgerEntry[], loading: boolean }) => (
    <div className="mt-10 bg-[var(--surface-base)] border border-[var(--border-default)] rounded-[32px] overflow-hidden shadow-[var(--shadow-card)]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-default)]">
            <h3 className="text-lg font-bold text-[var(--text-primary)]">Journal des Transactions</h3>
            {loading && <div className="w-5 h-5 border-2 border-[var(--border-default)] border-t-[var(--text-primary)] rounded-full animate-spin" />}
        </div>
        <div className="overflow-x-auto">
            <table className="w-full text-left">
                <thead>
                    <tr className="bg-[var(--surface-subtle)]">
                        {['Date', 'Utilisateur', 'Action', 'Modèle', 'Tokens', 'Coût'].map(h => (
                             <th key={h} className="px-4 py-2 text-[9px] font-semibold text-[var(--text-secondary)] tracking-[0.05em] first:pl-6 last:pr-6">{h}</th>
                        ))}
                    </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-default)]">
                    {ledger.map(entry => (
                        <tr key={entry.id} className="hover:bg-[var(--surface-subtle)] transition-colors">
                            <td className="px-4 py-3 text-xs text-[var(--text-secondary)] whitespace-nowrap first:pl-6 last:pr-6">{timeAgo(entry.timestamp)}</td>
                            <td className="px-4 py-3 text-xs text-[var(--text-primary)] whitespace-nowrap truncate max-w-[200px]">{entry.user_email}</td>
                            <td className="px-4 py-3 text-xs text-[var(--text-secondary)] whitespace-nowrap">{entry.action}</td>
                            <td className="px-4 py-3 text-xs text-[var(--text-secondary)] whitespace-nowrap truncate max-w-[150px]">{entry.model}</td>
                            <td className="px-4 py-3 text-xs text-[var(--text-secondary)] font-[family-name:var(--font-outfit)] text-right">{formatTokens(entry.tokens)}</td>
                             <td className="px-4 py-3 text-xs text-[var(--text-primary)] font-[family-name:var(--font-outfit)] font-bold text-right">{formatCost(entry.cost)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    </div>
);


// ══════════════════════════════════════════════════════════════════════════════
// ADMIN MENU (Hub)
// ══════════════════════════════════════════════════════════════════════════════

function AdminMenu({ onNavigate, stats }: { onNavigate: (tab: AdminTab) => void; stats: { totalUsers: number; onlineCount: number; newToday: number; totalCost: number } }) {
  const cards = [
    {
      id: "costs" as AdminTab,
      title: "Cost Intelligence",
      subtitle: "Consommation tokens & coûts par utilisateur",
      icon: DollarSign,
      color: "from-orange-500/14 to-orange-500/6",
      borderColor: "border-orange-500/20",
      iconColor: "text-orange-500",
      stat: formatCost(stats.totalCost),
      statLabel: "Coût total",
    },
    {
      id: "connected" as AdminTab,
      title: "Utilisateurs Connectés",
      subtitle: "Activité en temps réel & sessions actives",
      icon: Wifi,
      color: "from-[var(--accent-navy)]/12 to-[var(--accent-navy)]/4",
      borderColor: "border-[var(--accent-navy)]/20",
      iconColor: "text-[var(--accent-navy)]",
      stat: `${stats.onlineCount}`,
      statLabel: "En ligne",
    },
    {
      id: "accounts" as AdminTab,
      title: "Nouveaux Comptes",
      subtitle: "Inscriptions & croissance utilisateurs",
      icon: UserPlus,
      color: "from-[var(--accent-navy)]/12 to-[var(--accent-navy)]/4",
      borderColor: "border-[var(--accent-navy)]/20",
      iconColor: "text-[var(--accent-navy)]",
      stat: `${stats.newToday}`,
      statLabel: "Aujourd'hui",
    },
    {
      id: "activations" as AdminTab,
      title: "Activations",
      subtitle: "Demandes d'activation chatbot & suivi operateur",
      icon: Rocket,
      color: "from-orange-500/16 to-orange-500/6",
      borderColor: "border-orange-500/20",
      iconColor: "text-orange-500",
      stat: "-",
      statLabel: "En attente",
    },
    {
      id: "payments" as AdminTab,
      title: "Paiements",
      subtitle: "Verifier et valider les preuves de paiement",
      icon: CreditCard,
      color: "from-[var(--accent-navy)]/12 to-[var(--accent-navy)]/4",
      borderColor: "border-[var(--accent-navy)]/20",
      iconColor: "text-[var(--accent-navy)]",
      stat: "-",
      statLabel: "A verifier",
    },
    {
      id: "orders" as AdminTab,
      title: "Commandes",
      subtitle: "Commandes Messenger de tous les clients",
      icon: ShoppingBag,
      color: "from-[var(--accent-navy)]/12 to-[var(--accent-navy)]/4",
      borderColor: "border-[var(--accent-navy)]/20",
      iconColor: "text-[var(--accent-navy)]",
      stat: "-",
      statLabel: "Total",
    },
    {
      id: "reports" as AdminTab,
      title: "Signalements",
      subtitle: "Problemes et retours envoyes par les utilisateurs",
      icon: AlertCircle,
      color: "from-orange-500/14 to-orange-500/6",
      borderColor: "border-orange-500/20",
      iconColor: "text-orange-500",
      stat: "-",
      statLabel: "A traiter",
    },
  ];

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-10 bg-[var(--background)]">
      <div className="flex items-center gap-4 mb-10">
        <div className="w-12 h-12 rounded-2xl bg-[var(--surface-subtle)] flex items-center justify-center shadow-lg border border-[var(--border-default)]">
          <ShieldCheck size={24} className="text-[var(--text-primary)]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight">Administration</h1>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="h-1.5 w-1.5 rounded-full bg-orange-500 animate-pulse" />
            <p className="text-[11px] font-[family-name:var(--font-outfit)] font-medium tracking-[0.05em] text-[var(--text-secondary)]">FLARE AI — Admin Engine</p>
          </div>
        </div>
      </div>

      {/* KPI Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        {[
          { label: "Utilisateurs", val: stats.totalUsers, icon: Users, color: "text-[var(--text-primary)]" },
          { label: "En ligne", val: stats.onlineCount, icon: Wifi, color: "text-[var(--accent-navy)]" },
          { label: "Nouveaux (24h)", val: stats.newToday, icon: UserPlus, color: "text-[var(--accent-navy)]" },
          { label: "Coût Total", val: formatCost(stats.totalCost), icon: DollarSign, color: "text-orange-500" },
        ].map((kpi, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="p-6 rounded-[28px] bg-[var(--surface-base)] border border-[var(--border-default)] hover:bg-[var(--surface-subtle)] transition-all"
          >
            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] font-semibold text-[var(--text-secondary)]">{kpi.label}</span>
              <kpi.icon size={16} className="text-[var(--text-secondary)]" />
            </div>
            <p className={`text-2xl font-bold ${kpi.color} font-[family-name:var(--font-outfit)] tracking-tight`}>{kpi.val}</p>
          </motion.div>
        ))}
      </div>

      {/* Section Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {cards.map((card, i) => (
          <motion.button
            key={card.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + i * 0.08 }}
            onClick={() => onNavigate(card.id)}
            className={`p-8 rounded-[32px] bg-gradient-to-br ${card.color} border ${card.borderColor} text-left hover:scale-[1.02] transition-all group cursor-pointer`}
          >
            <div className={`w-14 h-14 rounded-2xl bg-[var(--surface-subtle)] border border-[var(--border-default)] flex items-center justify-center mb-6 ${card.iconColor}`}>
              <card.icon size={28} />
            </div>
            <h3 className="text-lg font-bold text-[var(--text-primary)] mb-1">{card.title}</h3>
            <p className="mb-6 text-[12px] leading-relaxed text-[var(--text-secondary)]">{card.subtitle}</p>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-[var(--text-primary)] font-[family-name:var(--font-outfit)]">{card.stat}</p>
                <p className="text-[10px] font-medium tracking-[0.05em] text-[var(--text-secondary)]">{card.statLabel}</p>
              </div>
              <ChevronRight size={20} className="text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] group-hover:translate-x-1 transition-all" />
            </div>
          </motion.button>
        ))}
      </div>
    </div>
  );
}


// ══════════════════════════════════════════════════════════════════════════════
// CONNECTED USERS TAB
// ══════════════════════════════════════════════════════════════════════════════

function ConnectedUsersTab({ token, onBack }: { token: string; onBack: () => void }) {
  const [data, setData] = useState<ConnectedUsersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [nextRefresh, setNextRefresh] = useState(15);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getAdminConnectedUsers(token);
      setData(res);
    } catch (e) {
      console.error("[Admin] connected-users error:", e);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    if (!autoRefresh) return;
    const timer = setInterval(() => {
      setNextRefresh(prev => {
        if (prev <= 1) { refresh(); return 15; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [autoRefresh, refresh]);

  const statusConfig = {
    online: { label: "En ligne", color: "bg-orange-500", textColor: "text-orange-500", ring: "ring-orange-500/20" },
    recent: { label: "Récent", color: "bg-[var(--accent-navy)]", textColor: "text-[var(--accent-navy)]", ring: "ring-[var(--accent-navy)]/20" },
    away: { label: "Absent", color: "bg-[var(--border-default)]", textColor: "text-[var(--text-secondary)]", ring: "ring-[var(--border-default)]" },
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-10 bg-[var(--background)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-10">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 rounded-xl text-[var(--text-secondary)] transition-all hover:bg-[var(--surface-subtle)] hover:text-[var(--text-primary)]">
            <ChevronLeft size={20} />
          </button>
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-orange-500/20 bg-orange-500/10">
            <Wifi size={24} className="text-orange-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight">Utilisateurs Connectés</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="h-1.5 w-1.5 rounded-full bg-orange-500 animate-pulse" />
              <p className="text-[11px] font-[family-name:var(--font-outfit)] font-medium tracking-[0.05em] text-[var(--text-secondary)]">Temps reel — rafraichi toutes les 15s</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition-all ${
              autoRefresh ? "border-orange-500/20 bg-orange-500/10 text-orange-500" : "bg-[var(--surface-subtle)] border-[var(--border-default)] text-[var(--text-secondary)]"
            }`}
          >
            <div className={`h-1.5 w-1.5 rounded-full ${autoRefresh ? "bg-orange-500 animate-pulse" : "bg-[var(--border-default)]"}`} />
            <span className="text-[10px] font-[family-name:var(--font-outfit)] tracking-[0.05em]">
              {autoRefresh ? `Live (${nextRefresh}s)` : "Pausé"}
            </span>
          </button>
          <button onClick={refresh} disabled={loading} className="flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2 text-xs font-bold text-black transition-all hover:bg-orange-600 disabled:opacity-50">
            <RefreshCcw size={14} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: "En ligne", val: data?.online_count ?? 0, color: "text-orange-500", dot: "bg-orange-500" },
          { label: "Récemment actifs", val: data?.recent_count ?? 0, color: "text-[var(--accent-navy)]", dot: "bg-[var(--accent-navy)]" },
          { label: "Actifs (24h)", val: data?.total_active_24h ?? 0, color: "text-[var(--accent-navy)]", dot: "bg-[var(--accent-navy)]" },
        ].map((kpi, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className="p-6 rounded-[28px] bg-[var(--surface-base)] border border-[var(--border-default)]">
            <div className="flex items-center gap-2 mb-3">
              <div className={`w-2 h-2 rounded-full ${kpi.dot} animate-pulse`} />
              <span className="text-[10px] font-bold tracking-[0.05em] text-[var(--text-secondary)]">{kpi.label}</span>
            </div>
            <p className={`text-3xl font-bold ${kpi.color} font-[family-name:var(--font-outfit)]`}>{kpi.val}</p>
          </motion.div>
        ))}
      </div>

      {/* Users Table */}
      <div className="bg-[var(--surface-base)] border border-[var(--border-default)] rounded-[32px] overflow-hidden">
        <div className="px-6 py-4 border-b border-[var(--border-default)]">
          <h3 className="text-[13px] font-bold text-[var(--text-primary)] tracking-[0.05em]">Sessions Actives</h3>
        </div>

        <div className="grid grid-cols-12 gap-0 bg-[var(--surface-subtle)] px-6 py-2 border-b border-[var(--border-default)]">
          <div className="col-span-4 text-[9px] font-semibold tracking-[0.05em] text-[var(--text-secondary)]">Utilisateur</div>
          <div className="col-span-2 text-center text-[9px] font-semibold tracking-[0.05em] text-[var(--text-secondary)]">Statut</div>
          <div className="col-span-2 text-center text-[9px] font-semibold tracking-[0.05em] text-[var(--text-secondary)]">Derniere action</div>
          <div className="col-span-2 text-right text-[9px] font-semibold tracking-[0.05em] text-[var(--text-secondary)]">Tokens (24h)</div>
          <div className="col-span-2 text-right text-[9px] font-semibold tracking-[0.05em] text-[var(--text-secondary)]">Cout (24h)</div>
        </div>

        <div className="divide-y divide-[var(--border-glass)]">
          {(!data?.users || data.users.length === 0) ? (
            <div className="p-16 text-center">
              <WifiOff size={32} className="mx-auto mb-3 text-[var(--text-secondary)]" />
              <p className="text-xs text-[var(--text-secondary)]">Aucun utilisateur actif dans les dernieres 24h</p>
            </div>
          ) : data.users.map((user, idx) => {
            const sc = statusConfig[user.status];
            return (
              <motion.div key={user.user_id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: idx * 0.03 }}
                className="grid grid-cols-12 gap-0 px-6 py-4 items-center hover:bg-[var(--surface-subtle)] transition-colors">
                <div className="col-span-4 flex items-center gap-3 min-w-0">
                  <div className="relative">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-[var(--text-primary)]/10 to-[var(--text-primary)]/20 border border-[var(--border-default)] flex items-center justify-center text-[var(--text-primary)] font-bold text-sm">
                      {(user.email || "?").charAt(0).toUpperCase()}
                    </div>
                    <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 ${sc.color} border-2 border-[var(--surface-base)] rounded-full ${user.status === "online" ? "animate-pulse" : ""}`} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-[var(--text-primary)] truncate">{user.email}</p>
                    <p className="text-[10px] font-[family-name:var(--font-outfit)] tracking-tighter text-[var(--text-secondary)]">UID: {user.user_id} · {timeAgo(user.last_seen)}</p>
                  </div>
                </div>
                <div className="col-span-2 flex justify-center">
                  <span className={`rounded-full border border-[var(--border-default)] bg-[var(--surface-subtle)] px-3 py-1 text-[10px] font-semibold tracking-wider ${sc.textColor}`}>
                    {sc.label}
                  </span>
                </div>
                <div className="col-span-2 text-center">
                  <span className="text-[11px] text-[var(--text-secondary)]">{user.last_action || "—"}</span>
                </div>
                <div className="col-span-2 text-right">
                  <span className="text-[12px] font-bold text-[var(--text-primary)] font-[family-name:var(--font-outfit)]">{formatTokens(user.tokens_today)}</span>
                </div>
                <div className="col-span-2 text-right">
                  <span className="text-[12px] font-bold font-[family-name:var(--font-outfit)] text-orange-500">{formatCost(user.cost_today)}</span>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}


// ══════════════════════════════════════════════════════════════════════════════
// NEW ACCOUNTS TAB
// ══════════════════════════════════════════════════════════════════════════════

function NewAccountsTab({ token, onBack }: { token: string; onBack: () => void }) {
  const [data, setData] = useState<NewAccountsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [nextRefresh, setNextRefresh] = useState(60);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getAdminNewAccounts(token, days);
      setData(res);
    } catch (e) {
      console.error("[Admin] new-accounts error:", e);
    } finally {
      setLoading(false);
    }
  }, [token, days]);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    if (!autoRefresh) return;
    const timer = setInterval(() => {
      setNextRefresh(prev => {
        if (prev <= 1) { refresh(); return 60; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [autoRefresh, refresh]);

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-10 bg-[var(--background)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-10">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 rounded-xl text-[var(--text-secondary)] transition-all hover:bg-[var(--surface-subtle)] hover:text-[var(--text-primary)]">
            <ChevronLeft size={20} />
          </button>
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[var(--accent-navy)]/20 bg-[var(--accent-navy)]/8">
            <UserPlus size={24} className="text-[var(--accent-navy)]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight">Nouveaux Comptes</h1>
            <p className="text-[11px] font-[family-name:var(--font-outfit)] font-medium tracking-[0.05em] text-[var(--text-secondary)]">Inscriptions & croissance</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition-all ${
              autoRefresh ? "border-[var(--accent-navy)]/20 bg-[var(--accent-navy)]/8 text-[var(--accent-navy)]" : "bg-[var(--surface-subtle)] border-[var(--border-default)] text-[var(--text-secondary)]"
            }`}
          >
            <div className={`h-1.5 w-1.5 rounded-full ${autoRefresh ? "bg-[var(--accent-navy)] animate-pulse" : "bg-[var(--border-default)]"}`} />
            <span className="text-[10px] font-[family-name:var(--font-outfit)] tracking-[0.05em]">
              {autoRefresh ? `Live (${nextRefresh}s)` : "Pausé"}
            </span>
          </button>
          <div className="flex bg-[var(--surface-subtle)] border border-[var(--border-default)] rounded-xl p-0.5">
            {[
              { label: "7J", val: 7 },
              { label: "30J", val: 30 },
              { label: "90J", val: 90 },
              { label: "ALL", val: 365 },
            ].map((opt) => (
              <button key={opt.val} onClick={() => setDays(opt.val)}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ${
                  days === opt.val ? "bg-[var(--text-primary)] text-[rgb(var(--background))] shadow-lg" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                }`}>
                {opt.label}
              </button>
            ))}
          </div>
          <button onClick={refresh} disabled={loading} className="flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2 text-xs font-bold text-black transition-all hover:bg-orange-600 disabled:opacity-50">
            <RefreshCcw size={14} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: "Aujourd'hui", val: data?.new_today ?? 0, color: "text-orange-500" },
          { label: "Cette semaine", val: data?.new_this_week ?? 0, color: "text-[var(--accent-navy)]" },
          { label: `${days} derniers jours`, val: data?.total ?? 0, color: "text-[var(--text-primary)]" },
        ].map((kpi, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className="p-6 rounded-[28px] bg-[var(--surface-base)] border border-[var(--border-default)]">
            <span className="text-[10px] font-bold tracking-[0.05em] text-[var(--text-secondary)]">{kpi.label}</span>
            <p className={`text-3xl font-bold ${kpi.color} font-[family-name:var(--font-outfit)] mt-2`}>{kpi.val}</p>
          </motion.div>
        ))}
      </div>

      {/* Accounts Table */}
      <div className="bg-[var(--surface-base)] border border-[var(--border-default)] rounded-[32px] overflow-hidden">
        <div className="px-6 py-4 border-b border-[var(--border-default)]">
          <h3 className="text-[13px] font-bold text-[var(--text-primary)] tracking-[0.05em]">Comptes Créés</h3>
        </div>

        <div className="grid grid-cols-12 gap-0 bg-[var(--surface-subtle)] px-6 py-2 border-b border-[var(--border-default)]">
          <div className="col-span-4 text-[9px] font-semibold tracking-[0.05em] text-[var(--text-secondary)]">Email</div>
          <div className="col-span-2 text-center text-[9px] font-semibold tracking-[0.05em] text-[var(--text-secondary)]">Plan</div>
          <div className="col-span-2 text-center text-[9px] font-semibold tracking-[0.05em] text-[var(--text-secondary)]">Inscrit le</div>
          <div className="col-span-2 text-center text-[9px] font-semibold tracking-[0.05em] text-[var(--text-secondary)]">Activite</div>
          <div className="col-span-2 text-right text-[9px] font-semibold tracking-[0.05em] text-[var(--text-secondary)]">Cout total</div>
        </div>

        <div className="divide-y divide-[var(--border-glass)]">
          {(!data?.accounts || data.accounts.length === 0) ? (
            <div className="p-16 text-center">
              <UserPlus size={32} className="mx-auto mb-3 text-[var(--text-secondary)]" />
              <p className="text-xs text-[var(--text-secondary)]">Aucun nouveau compte sur cette periode</p>
            </div>
          ) : data.accounts.map((acc, idx) => {
            const planColor = acc.plan === "business" ? "text-orange-500 bg-orange-500/10 border-orange-500/20"
              : acc.plan === "pro" ? "text-[var(--accent-navy)] bg-[var(--accent-navy)]/8 border-[var(--accent-navy)]/20"
              : "text-[var(--text-primary)] bg-[var(--surface-subtle)] border-[var(--border-default)]";
            return (
              <motion.div key={acc.user_id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: idx * 0.03 }}
                className="grid grid-cols-12 gap-0 px-6 py-4 items-center hover:bg-[var(--surface-subtle)] transition-colors">
                <div className="col-span-4 flex items-center gap-3 min-w-0">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border-default)] bg-[var(--accent-navy)]/8 text-[var(--accent-navy)] text-sm font-bold">
                    {(acc.email || "?").charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-[var(--text-primary)] truncate">{acc.email}</p>
                    <p className="text-[10px] font-[family-name:var(--font-outfit)] tracking-tighter text-[var(--text-secondary)]">UID: {acc.user_id}</p>
                  </div>
                </div>
                <div className="col-span-2 flex justify-center">
                  <span className={`px-3 py-1 rounded-full text-[10px] font-semibold tracking-wider border ${planColor}`}>
                    {acc.plan}
                  </span>
                </div>
                <div className="col-span-2 text-center">
                  <span className="text-[11px] text-[var(--text-secondary)]">{formatDate(acc.created_at)}</span>
                </div>
                <div className="col-span-2 text-center">
                  {acc.is_active ? (
                    <span className="text-[11px] font-medium text-orange-500">{acc.total_actions} actions</span>
                  ) : (
                    <span className="text-[11px] italic text-[var(--text-secondary)]">Inactif</span>
                  )}
                </div>
                <div className="col-span-2 text-right">
                  <span className="text-[12px] font-bold text-[var(--text-primary)] font-[family-name:var(--font-outfit)]">{formatCost(acc.total_cost)}</span>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}


// ══════════════════════════════════════════════════════════════════════════════
// COST INTELLIGENCE TAB (existing content, extracted)
// ══════════════════════════════════════════════════════════════════════════════

function CostIntelligenceTab({ token, onBack }: { token: string; onBack: () => void }) {
  const [data, setData] = useState<SummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set());
  const [days, setDays] = useState(0);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [nextRefresh, setNextRefresh] = useState(30);
  const [ledger, setLedger] = useState<LedgerEntry[] | null>(null);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [sort, setSort] = useState({ key: "cost", asc: false });
  const [visibleUsers, setVisibleUsers] = useState(20);
  const [feedback, setFeedback] = useState<{ tone: "error" | "success"; message: string } | null>(null);

  const [backfillDone, setBackfillDone] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Backfill uniquement au premier chargement (pas à chaque auto-refresh)
      if (!backfillDone) {
        try { await backfillAdminUsage(token); setBackfillDone(true); } catch { /* silencieux */ }
      }
      const res = await getAdminUsageSummary(token, days);
      if (res && res.users) {
        setData(res);
      } else {
        setData({ total_users: 0, total_cost: 0, users: [] });
      }
    } catch (e: any) {
      console.error("[Admin] fetch error:", e);
      const detail = e?.message || "";
      setError(`Impossible de charger les données.${detail ? ` (${detail})` : ""} Vérifiez la connexion au backend.`);
    } finally {
      setLoading(false);
    }
  }, [token, days, backfillDone]);

  const showLedger = async () => {
      if (ledger) { setLedger(null); return; }
      setLedgerLoading(true);
      try {
        const res = await getAdminUsageLedger(token);
        setLedger((res as any) || []);
      } catch (e) {
        setError("Impossible de charger le journal des transactions.");
        setLedger(null);
      } finally {
        setLedgerLoading(false);
      }
  };

  useEffect(() => {
    let timer: any;
    if (autoRefresh) {
      timer = setInterval(() => {
        setNextRefresh(prev => {
          if (prev <= 1) { refresh(); return 30; }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [autoRefresh, refresh]);

  const triggerSync = async () => {
    setLoading(true);
    try {
      const res = await syncAdminUsers(token);
      setFeedback({ tone: "success", message: (res as any).message || res.status || "Synchronisation Firebase terminee." });
      refresh();
    } catch (e) {
      setFeedback({ tone: "error", message: "Erreur lors de la synchronisation Firebase." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); }, [refresh]);

  const toggleUser = (uid: string) => {
    setExpandedUsers(prev => {
      const next = new Set(prev);
      next.has(uid) ? next.delete(uid) : next.add(uid);
      return next;
    });
  };

  const sortedUsers = useMemo(() => {
    const users = data?.users || [];
    const filtered = users.filter(u => {
        const q = search.toLowerCase();
        if (!q) return true;
        return (u.email || "").toLowerCase().includes(q) || (u.user_id || "").toLowerCase().includes(q);
    });
    return [...filtered].sort((a, b) => {
        let valA, valB;
        switch (sort.key) {
            case 'cost': valA = a.grand_total.cost; valB = b.grand_total.cost; break;
            case 'tokens': valA = a.grand_total.tokens; valB = b.grand_total.tokens; break;
            case 'last_active': valA = a.last_active ? new Date(a.last_active).getTime() : 0; valB = b.last_active ? new Date(b.last_active).getTime() : 0; break;
            case 'email': valA = a.email || ''; valB = b.email || ''; break;
            default: return 0;
        }
        if (valA < valB) return sort.asc ? -1 : 1;
        if (valA > valB) return sort.asc ? 1 : -1;
        return 0;
    });
  }, [data, search, sort]);

  const paginatedUsers = useMemo(() => sortedUsers.slice(0, visibleUsers), [sortedUsers, visibleUsers]);

  if (loading && !data) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[var(--background)]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-[var(--border-default)] border-t-[var(--text-primary)] rounded-full animate-spin" />
          <div className="text-xs font-[family-name:var(--font-outfit)] tracking-[0.05em] text-[var(--text-secondary)]">Chargement Cost Intelligence...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[var(--background)] p-10 text-center">
        <div className="max-w-md">
          <AlertCircle size={48} className="text-red-500 mx-auto mb-6" />
          <h2 className="text-xl font-bold text-[var(--text-primary)] mb-2">Erreur de Sync</h2>
          <p className="mb-6 text-sm text-[var(--text-secondary)]">{error}</p>
          <div className="flex flex-col gap-3">
            <button onClick={refresh} className="rounded-xl bg-orange-500 px-6 py-3 text-sm font-bold text-black">Reessayer</button>
            <button onClick={onBack} className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-subtle)] px-6 py-3 text-xs font-bold text-[var(--text-primary)]">Retour au menu</button>
          </div>
        </div>
      </div>
    );
  }

  try {
    const users = Array.isArray(data?.users) ? data.users : [];
    const totalG3 = users.reduce((s, u) => s + (u.models?.["gemini-3-pro"]?.total?.cost || 0), 0);
    const totalFlash = users.reduce((s, u) => s + (u.models?.["gemini-3-flash"]?.total?.cost || 0), 0);
    const totalTokens = users.reduce((s, u) => s + (u.grand_total?.tokens || 0), 0);
    const totalMessages = users.reduce((s, u) => s + (u.models?.["gemini-3-pro"]?.by_action.message?.actions || 0) + (u.models?.["gemini-3-flash"]?.by_action.message?.actions || 0), 0);
    const totalImages = users.reduce((s, u) => s + (u.models?.["gemini-3-pro"]?.by_action.image_gen?.actions || 0) + (u.models?.["gemini-3-flash"]?.by_action.image_gen?.actions || 0), 0);
    const totalVideos = users.reduce((s, u) => s + (u.models?.["gemini-3-pro"]?.by_action.video_gen?.actions || 0) + (u.models?.["gemini-3-flash"]?.by_action.video_gen?.actions || 0), 0);
    const totalResearch = users.reduce((s, u) => s + (u.models?.["gemini-3-pro"]?.by_action.research?.actions || 0) + (u.models?.["gemini-3-flash"]?.by_action.research?.actions || 0) + (u.models?.["gemini-3-pro"]?.by_action.deep_research?.actions || 0) + (u.models?.["gemini-3-flash"]?.by_action.deep_research?.actions || 0), 0);
    const totalDocs = users.reduce((s, u) => s + (u.models?.["gemini-3-pro"]?.by_action.doc_gen?.actions || 0) + (u.models?.["gemini-3-flash"]?.by_action.doc_gen?.actions || 0), 0);
    const totalSheets = users.reduce((s, u) => s + (u.models?.["gemini-3-pro"]?.by_action.sheet_gen?.actions || 0) + (u.models?.["gemini-3-flash"]?.by_action.sheet_gen?.actions || 0), 0);

    return (
      <div className="flex-1 overflow-y-auto p-4 md:p-10 bg-[var(--background)]">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
          <div className="flex items-center gap-4">
            <button onClick={onBack} className="p-2 rounded-xl text-[var(--text-secondary)] transition-all hover:bg-[var(--surface-subtle)] hover:text-[var(--text-primary)]">
              <ChevronLeft size={20} />
            </button>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-orange-500/20 bg-orange-500/10">
              <DollarSign size={24} className="text-orange-500" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight">Cost Intelligence</h1>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="h-1.5 w-1.5 rounded-full bg-orange-500 animate-pulse" />
                <p className="text-[11px] font-[family-name:var(--font-outfit)] font-medium tracking-[0.05em] text-[var(--text-secondary)]">FLARE AI — Admin Engine</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button onClick={() => setAutoRefresh(!autoRefresh)}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition-all ${
                autoRefresh ? "border-orange-500/20 bg-orange-500/10 text-orange-500" : "bg-[var(--surface-subtle)] border-[var(--border-default)] text-[var(--text-secondary)]"
              }`}>
              <div className={`h-1.5 w-1.5 rounded-full ${autoRefresh ? "bg-orange-500 animate-pulse" : "bg-[var(--border-default)]"}`} />
              <span className="text-[10px] font-[family-name:var(--font-outfit)] tracking-[0.05em]">
                {autoRefresh ? `Live (${nextRefresh}s)` : "Static"}
              </span>
            </button>
            <div className="flex bg-[var(--surface-subtle)] border border-[var(--border-default)] rounded-xl p-0.5">
              {[{ label: "1J", val: 1 }, { label: "7J", val: 7 }, { label: "30J", val: 30 }, { label: "ALL", val: 0 }].map((opt) => (
                <button key={opt.val} onClick={() => setDays(opt.val)}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ${
                    days === opt.val ? "bg-[var(--text-primary)] text-[rgb(var(--background))] shadow-lg" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  }`}>
                  {opt.label}
                </button>
              ))}
            </div>
            <button onClick={triggerSync} disabled={loading}
              className="flex items-center gap-2 rounded-xl border border-[var(--accent-navy)]/20 bg-[var(--accent-navy)]/8 px-3 py-2 text-xs font-bold text-[var(--accent-navy)] transition-all hover:bg-[var(--accent-navy)]/14 disabled:opacity-50">
              <Users size={14} />
              Sync Firebase
            </button>
            <button onClick={showLedger} disabled={ledgerLoading}
              className="flex items-center gap-2 rounded-xl border border-[var(--border-default)] bg-[var(--surface-subtle)] px-3 py-2 text-xs font-bold text-[var(--text-primary)] transition-all hover:bg-[var(--surface-raised)] disabled:opacity-50">
              <BookOpen size={14} />
              {ledger ? "Masquer Journal" : "Journal"}
            </button>
            <button onClick={refresh} disabled={loading}
              className="flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2 text-xs font-bold text-black transition-all hover:bg-orange-600 disabled:opacity-50">
              <RefreshCcw size={14} className={loading ? "animate-spin" : ""} />
              {loading ? "Sync..." : "Refresh"}
            </button>
          </div>
        </div>

        {/* Global KPIs */}
        {feedback ? (
          <div className={`mb-4 rounded-xl border px-4 py-3 text-sm ${feedback.tone === "success" ? "border-orange-500/25 bg-orange-500/10 text-[var(--text-primary)]" : "border-red-500/25 bg-red-500/10 text-[var(--text-primary)]"}`}>
            {feedback.message}
          </div>
        ) : null}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          {[
            { label: "Utilisateurs", val: data?.total_users ?? 0, sub: "Comptes actifs", icon: Users, color: "text-[var(--text-primary)]" },
            { label: "Gemini 3 Pro", val: formatCost(totalG3), sub: "Coût Raisonnement", icon: Brain, color: "text-[var(--text-primary)]" },
            { label: "GEMINI 3 FLASH", val: formatCost(totalFlash), sub: "Coût Vitesse", icon: Zap, color: "text-[var(--accent-navy)]" },
            { label: "Total Google Cloud", val: formatCost(data?.total_cost ?? 0), sub: `${formatTokens(totalTokens)} tokens`, icon: DollarSign, color: "text-[var(--text-primary)]" }
          ].map((kpi, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              className="p-6 rounded-[28px] bg-[var(--surface-base)] border border-[var(--border-default)] hover:bg-[var(--surface-subtle)] transition-all cursor-default">
              <div className="flex items-center justify-between mb-4">
                <span className="text-[10px] font-bold tracking-[0.05em] text-[var(--text-secondary)]">{kpi.label}</span>
                <kpi.icon size={16} className="text-[var(--text-secondary)]" />
              </div>
              <p className={`text-2xl font-bold ${kpi.color} font-[family-name:var(--font-outfit)] tracking-tight`}>{kpi.val}</p>
              <p className="text-[11px] text-[var(--text-secondary)] mt-1">{kpi.sub}</p>
            </motion.div>
          ))}
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          {[
            { label: "Messages", val: totalMessages, icon: MessageSquare, color: "text-orange-500" },
            { label: "Recherches", val: totalResearch, icon: Globe, color: "text-[var(--accent-navy)]" },
            { label: "Images", val: totalImages, icon: ImageIcon, color: "text-orange-500" },
            { label: "Vidéos", val: totalVideos, icon: Video, color: "text-[var(--accent-navy)]" },
            { label: "Documents", val: totalDocs, icon: FileText, color: "text-[var(--accent-navy)]" },
            { label: "Tableurs", val: totalSheets, icon: FileSpreadsheet, color: "text-orange-500" },
          ].map((kpi, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: (i + 4) * 0.05 }}
              className="p-4 rounded-[28px] bg-[var(--surface-base)] border border-[var(--border-default)] flex items-center gap-4">
              <div className={`w-12 h-12 rounded-2xl bg-[var(--surface-subtle)] border border-[var(--border-default)] flex items-center justify-center ${kpi.color}`}>
                <kpi.icon size={24} />
              </div>
              <div>
                <span className="text-[10px] font-bold tracking-[0.05em] text-[var(--text-secondary)]">{kpi.label}</span>
                <p className="text-2xl font-bold text-[var(--text-primary)] font-[family-name:var(--font-outfit)] tracking-tight">{kpi.val}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Master Table */}
        <div className="bg-[var(--surface-base)] border border-[var(--border-default)] rounded-[32px] overflow-hidden shadow-[var(--shadow-card)]">
          <div className="flex items-center justify-between px-6 py-4">
            <div className="relative">
              <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" />
              <input value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder={`Rechercher parmi ${sortedUsers.length} utilisateurs...`}
                className="w-80 rounded-xl border border-[var(--border-default)] bg-[var(--surface-subtle)] py-2.5 pl-10 pr-4 text-sm text-[var(--text-primary)] transition-all placeholder:text-[var(--text-secondary)] focus:border-[var(--border-subtle)] focus:outline-none" />
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setSort({ ...sort, asc: !sort.asc })} className="p-2.5 rounded-xl bg-[var(--surface-subtle)] border border-[var(--border-default)] text-[var(--text-primary)] hover:bg-[var(--surface-raised)] transition-all">
                <ArrowUpDown size={14} className={`transition-transform ${sort.asc ? "" : "rotate-180"}`} />
              </button>
              <div className="flex bg-[var(--surface-subtle)] border border-[var(--border-default)] rounded-xl p-0.5">
                {[
                  { key: "cost", label: "Coût" },
                  { key: "tokens", label: "Tokens" },
                  { key: "last_active", label: "Activité" },
                  { key: "email", label: "Email" },
                ].map(opt => (
                  <button key={opt.key} onClick={() => setSort({ ...sort, key: opt.key })}
                    className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      sort.key === opt.key ? "bg-[var(--text-primary)] text-[rgb(var(--background))] shadow-md" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                    }`}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-12 gap-0 border-y border-[var(--border-default)] bg-[var(--surface-subtle)] px-6 py-2">
            <div className="col-span-4 text-[9px] font-semibold text-[var(--text-secondary)] tracking-[0.05em]">IDENTITÉ UTILISATEUR</div>
            <div className="col-span-3 text-center border-x border-[var(--border-default)]">
              <span className="text-[9px] font-semibold text-[var(--text-secondary)] tracking-[0.05em]">GEMINI 3 PRO</span>
            </div>
            <div className="col-span-3 text-center">
              <span className="text-[9px] font-semibold text-[var(--text-secondary)] tracking-[0.05em]">GEMINI 3 FLASH</span>
            </div>
            <div className="col-span-2 text-right self-center">
              <span className="text-[9px] font-semibold text-[var(--text-secondary)] tracking-[0.05em]">Grand Total</span>
            </div>
          </div>

          <div className="divide-y divide-[var(--border-glass)]">
            {paginatedUsers.length === 0 ? (
              <div className="p-20 text-center text-[var(--text-secondary)] font-[family-name:var(--font-outfit)] text-xs tracking-[0.05em] italic">Aucun utilisateur correspondant.</div>
            ) : (
              paginatedUsers.map((user, idx) => {
                try {
                  const isExpanded = expandedUsers.has(user.user_id);
                  const isAnon = user.user_id?.startsWith("anonymous");
                  const email = user.email || (isAnon ? "Utilisateur Anonyme" : "Email non trouvé");
                  const models = user.models || {};
                  const g3 = models["gemini-3-pro"];
                  const flash = models["gemini-3-flash"];
                  const grandTotal = user.grand_total || { cost: 0, tokens: 0 };

                  return (
                    <div key={user.user_id || idx} className="group">
                      <div onClick={() => toggleUser(user.user_id)}
                        className={`grid grid-cols-12 gap-0 px-6 py-5 items-center cursor-pointer transition-all ${isExpanded ? 'bg-[var(--bg-active)]' : 'hover:bg-[var(--surface-subtle)]'}`}>
                        <div className="col-span-4 flex items-center gap-4 min-w-0 pr-4">
                          <div className="relative">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[var(--text-primary)]/10 to-[var(--text-primary)]/20 border border-[var(--border-default)] flex items-center justify-center text-[var(--text-primary)] font-bold text-sm shadow-inner overflow-hidden">
                              {email.charAt(0).toUpperCase()}
                            </div>
                            {user.last_active && (Date.now() - new Date(user.last_active).getTime() < 180000) && (
                              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-orange-500 border-2 border-[var(--surface-base)] rounded-full animate-pulse" />
                            )}
                          </div>
                          <div className="flex flex-col min-w-0">
                            <div className="flex items-center gap-2">
                              {isExpanded ? <ChevronDown size={14} className="text-[var(--text-primary)]" /> : <ChevronRight size={14} className="text-[var(--text-secondary)]" />}
                              <span className="text-[13px] font-bold text-[var(--text-primary)] truncate">{email}</span>
                            </div>
                            <span className="text-[10px] text-[var(--text-secondary)] font-[family-name:var(--font-outfit)] tracking-tighter truncate pl-5 opacity-60">ID: {user.user_id}</span>
                          </div>
                        </div>
                        <div className="col-span-3 h-full px-2 border-l border-[var(--border-default)]">
                          <DataSubGrid actions={g3?.total?.actions} tokens={g3?.total?.tokens} cost={g3?.total?.cost} accent="text-[var(--text-primary)]" />
                        </div>
                        <div className="col-span-3 h-full px-2 border-l border-[var(--border-default)]">
                          <DataSubGrid actions={flash?.total?.actions} tokens={flash?.total?.tokens} cost={flash?.total?.cost} accent="text-orange-500" />
                        </div>
                        <div className="col-span-2 text-right pr-4">
                          <div className="flex flex-col items-end">
                            <span className="text-lg font-bold text-[var(--text-primary)] font-[family-name:var(--font-outfit)] tracking-tighter">{formatCost(grandTotal.cost)}</span>
                            <span className="text-[9px] text-[var(--text-secondary)] font-bold uppercase">{formatTokens(grandTotal.tokens)} tokens</span>
                          </div>
                        </div>
                      </div>
                      {isExpanded && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                          className="bg-[var(--surface-subtle)] border-t border-[var(--border-default)] px-6 py-6 overflow-hidden">
                          <div className="flex items-center gap-2 mb-4">
                            <div className="h-4 w-1 bg-[var(--text-primary)] rounded-full" />
                            <h3 className="text-[10px] font-bold text-[var(--text-primary)] uppercase tracking-[0.2em]">Breakdown Analytique</h3>
                          </div>
                          <div className="space-y-1">
                            {Object.entries(ACTION_META).map(([key, meta]) => (
                              <ActionRow key={key} label={meta.label} emoji={meta.emoji}
                                g3={((g3?.by_action || {}) as any)[key]}
                                flash={((flash?.by_action || {}) as any)[key]}
                                total_cost={(((g3?.by_action || {}) as any)[key]?.cost || 0) + (((flash?.by_action || {}) as any)[key]?.cost || 0)} />
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </div>
                  );
                } catch (e) {
                  return <div key={idx} className="p-4 bg-red-500/5 text-red-500 text-[10px] italic">Skip: Donnée corrompue pour {user?.user_id}</div>;
                }
              })
            )}
          </div>

          {sortedUsers.length > visibleUsers && (
            <div className="p-4 text-center border-t border-[var(--border-default)]">
              <button onClick={() => setVisibleUsers(v => v + 20)} className="text-[var(--text-primary)] text-xs font-bold tracking-[0.05em] hover:opacity-80">
                Afficher plus ({sortedUsers.length - visibleUsers} restants)
              </button>
            </div>
          )}
        </div>

        {ledger && <LedgerTable ledger={ledger} loading={ledgerLoading} />}
      </div>
    );
  } catch (error: any) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-10 bg-[var(--background)]">
        <AlertCircle size={48} className="text-red-500 mb-6 animate-pulse" />
        <h1 className="text-xl font-bold text-[var(--text-primary)] mb-2">Erreur de rendu</h1>
        <button onClick={onBack} className="mt-4 px-6 py-3 bg-[var(--text-primary)] text-[rgb(var(--background))] rounded-lg font-bold text-xs">Retour</button>
      </div>
    );
  }
}


// ══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════════════════════

export default function AdminPanel({ token }: AdminPanelProps) {
  const [activeTab, setActiveTab] = useState<AdminTab>("menu");
  const [menuStats, setMenuStats] = useState({ totalUsers: 0, onlineCount: 0, newToday: 0, totalCost: 0 });

  // Fetch quick stats for the menu hub
  useEffect(() => {
    if (!token) return;
    const fetchStats = async () => {
      try {
        const [summary, connected, accounts] = await Promise.all([
          getAdminUsageSummary(token, 0).catch(() => null),
          getAdminConnectedUsers(token).catch(() => null),
          getAdminNewAccounts(token, 1).catch(() => null),
        ]);
        setMenuStats({
          totalUsers: summary?.total_users ?? 0,
          onlineCount: connected?.online_count ?? 0,
          newToday: accounts?.new_today ?? 0,
          totalCost: summary?.total_cost ?? 0,
        });
      } catch { /* silencieux */ }
    };
    fetchStats();
  }, [token]);

  if (!token) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[var(--background)]">
        <p className="text-[var(--text-secondary)]">Authentification requise.</p>
      </div>
    );
  }

  switch (activeTab) {
    case "costs":
      return <CostIntelligenceTab token={token} onBack={() => setActiveTab("menu")} />;
    case "connected":
      return <ConnectedUsersTab token={token} onBack={() => setActiveTab("menu")} />;
    case "accounts":
      return <NewAccountsTab token={token} onBack={() => setActiveTab("menu")} />;
    case "activations":
      return <AdminActivationsTab token={token} onBack={() => setActiveTab("menu")} />;
    case "payments":
      return <AdminPaymentsTab token={token} onBack={() => setActiveTab("menu")} />;
    case "orders":
      return <AdminOrdersTab token={token} onBack={() => setActiveTab("menu")} />;
    case "reports":
      return <AdminReportsTab token={token} onBack={() => setActiveTab("menu")} />;
    default:
      return <AdminMenu onNavigate={setActiveTab} stats={menuStats} />;
  }
}


// ══════════════════════════════════════════════════════════════════════════════
// ADMIN ACTIVATIONS TAB
// ══════════════════════════════════════════════════════════════════════════════

const ACTIVATION_STATUS_LABELS: Record<string, string> = {
  draft: "Brouillon", awaiting_payment: "En attente paiement", payment_submitted: "Preuve soumise",
  payment_verified: "Paiement verifie", awaiting_flare_page_admin_access: "Attente admin page",
  queued_for_activation: "En file", activation_in_progress: "En cours", testing: "Test",
  active: "Actif", blocked: "Bloque", rejected: "Refuse", canceled: "Annule",
};

const ACTIVATION_STATUS_COLORS: Record<string, string> = {
  draft: "bg-[var(--surface-subtle)] text-[var(--text-primary)]",
  awaiting_payment: "bg-orange-500/10 text-orange-500",
  payment_submitted: "bg-orange-500/10 text-orange-500",
  payment_verified: "bg-[var(--accent-navy)]/8 text-[var(--accent-navy)]",
  awaiting_flare_page_admin_access: "bg-orange-500/10 text-orange-500",
  queued_for_activation: "bg-[var(--accent-navy)]/8 text-[var(--accent-navy)]",
  activation_in_progress: "bg-orange-500/10 text-orange-500",
  testing: "bg-[var(--accent-navy)]/8 text-[var(--accent-navy)]",
  active: "bg-[var(--accent-navy)]/8 text-[var(--accent-navy)]",
  blocked: "bg-red-500/10 text-red-500",
  rejected: "bg-red-500/10 text-red-500",
  canceled: "bg-[var(--surface-subtle)] text-[var(--text-primary)]",
};

const VALID_NEXT_STATUSES: Record<string, string[]> = {
  draft: ["awaiting_payment", "canceled"],
  awaiting_payment: ["payment_submitted", "canceled"],
  payment_submitted: ["payment_verified", "rejected"],
  payment_verified: ["awaiting_flare_page_admin_access"],
  awaiting_flare_page_admin_access: ["queued_for_activation", "blocked"],
  queued_for_activation: ["activation_in_progress", "blocked"],
  activation_in_progress: ["testing", "blocked"],
  testing: ["active", "blocked"],
  active: ["blocked"],
  blocked: ["queued_for_activation", "canceled"],
  rejected: ["awaiting_payment", "canceled"],
};

function AdminActivationsTab({ token, onBack }: { token: string; onBack: () => void }) {
  const [activations, setActivations] = useState<ActivationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [assignEmailDrafts, setAssignEmailDrafts] = useState<Record<string, string>>({});
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [feedback, setFeedback] = useState<{ tone: "error" | "success" | "warning"; message: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await getAdminActivations(token);
      setActivations(res.activations || []);
    } catch { /* silent */ }
    setLoading(false);
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const filtered = statusFilter === "all" ? activations : activations.filter(a => a.status === statusFilter);

  const handleSetStatus = async (id: string, status: string) => {
    setActionBusy(id);
    try {
      await adminSetActivationStatus(id, status, undefined, token);
      await load();
      setFeedback({ tone: "success", message: "Le statut d'activation a ete mis a jour." });
    } catch (e) {
      setFeedback({ tone: "error", message: e instanceof Error ? e.message : "Erreur" });
    }
    setActionBusy(null);
  };

  const handleAssign = async (id: string) => {
    const assignEmail = (assignEmailDrafts[id] || "").trim();
    if (!assignEmail) {
      setFeedback({ tone: "warning", message: "Renseignez un email operateur." });
      return;
    }
    setActionBusy(id);
    try {
      await adminAssignActivation(id, assignEmail, token);
      setAssignEmailDrafts((current) => ({ ...current, [id]: "" }));
      await load();
      setFeedback({ tone: "success", message: "Operateur assigne." });
    } catch (e) {
      setFeedback({ tone: "error", message: e instanceof Error ? e.message : "Erreur" });
    }
    setActionBusy(null);
  };

  const handleAddNote = async (id: string) => {
    const noteText = (noteDrafts[id] || "").trim();
    if (!noteText) {
      setFeedback({ tone: "warning", message: "Ajoutez une note avant de sauvegarder." });
      return;
    }
    setActionBusy(id);
    try {
      await adminAddActivationNote(id, noteText, token);
      setNoteDrafts((current) => ({ ...current, [id]: "" }));
      await load();
      setFeedback({ tone: "success", message: "Note ajoutee a l'activation." });
    } catch (e) {
      setFeedback({ tone: "error", message: e instanceof Error ? e.message : "Erreur" });
    }
    setActionBusy(null);
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-10 bg-[var(--background)]">
      <div className="flex items-center gap-3 mb-8">
        <button onClick={onBack} className="p-2 rounded-xl hover:bg-[var(--surface-subtle)] transition-colors">
          <ChevronLeft size={20} className="text-[var(--text-secondary)]" />
        </button>
        <Rocket size={24} className="text-orange-400" />
        <h2 className="text-xl font-bold text-[var(--text-primary)]">Activations</h2>
        <button onClick={() => { setLoading(true); load(); }} className="ml-auto p-2 rounded-xl hover:bg-[var(--surface-subtle)]">
          <RefreshCcw size={16} className={`text-[var(--text-secondary)] ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {feedback ? (
        <div className={`mb-4 rounded-xl border px-4 py-3 text-sm ${
          feedback.tone === "success"
            ? "border-orange-500/25 bg-orange-500/10 text-[var(--text-primary)]"
            : feedback.tone === "warning"
              ? "border-[var(--border-default)] bg-[var(--surface-subtle)] text-[var(--text-primary)]"
              : "border-red-500/25 bg-red-500/10 text-[var(--text-primary)]"
        }`}>
          {feedback.message}
        </div>
      ) : null}

      {/* Filter bar */}
      <div className="flex flex-wrap gap-2 mb-6">
        {["all", "payment_submitted", "payment_verified", "queued_for_activation", "activation_in_progress", "testing", "active", "blocked", "rejected"].map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${statusFilter === s ? "border border-orange-500/30 bg-orange-500/10 text-orange-500" : "border border-transparent bg-[var(--surface-subtle)] text-[var(--text-secondary)] hover:border-[var(--border-default)]"}`}>
            {s === "all" ? "Toutes" : ACTIVATION_STATUS_LABELS[s] || s}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-4">{[1,2,3].map(i => <div key={i} className="h-24 rounded-2xl bg-[var(--surface-subtle)] animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-[var(--text-secondary)]">
          <Rocket size={48} className="mx-auto mb-4 opacity-30" />
          <p>Aucune activation {statusFilter !== "all" ? "avec ce statut" : ""}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(ar => {
            const expanded = expandedId === ar.id;
            const nextStatuses = VALID_NEXT_STATUSES[ar.status] || [];
            const selectedSnapshotPage = Array.isArray(ar.selected_facebook_pages)
              ? ar.selected_facebook_pages.find((page) => page.is_selected) || null
              : null;
            return (
              <motion.div key={ar.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl border border-[var(--border-default)] bg-[var(--surface-base)] overflow-hidden">
                <button onClick={() => setExpandedId(expanded ? null : ar.id)}
                  className="w-full p-4 flex items-center gap-4 text-left hover:bg-[var(--surface-subtle)] transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-[var(--text-primary)] truncate">{ar.business_name || ar.contact_full_name || ar.contact_email || "Client"}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${ACTIVATION_STATUS_COLORS[ar.status] || "bg-[var(--surface-subtle)] text-[var(--text-primary)]"}`}>
                        {ACTIVATION_STATUS_LABELS[ar.status] || ar.status}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[var(--surface-subtle)] text-[var(--text-secondary)]">
                        {ar.selected_plan_id}
                      </span>
                    </div>
                    <p className="text-xs text-[var(--text-secondary)] mt-1 truncate">
                      {ar.contact_full_name} &middot; {ar.contact_email || ar.contact_phone || "-"} &middot; {ar.requested_at ? new Date(ar.requested_at).toLocaleDateString("fr-FR") : "-"}
                    </p>
                  </div>
                  {ar.assigned_operator_email && (
                    <span className="rounded-full bg-[var(--accent-navy)]/8 px-2 py-0.5 text-[10px] text-[var(--accent-navy)]">{ar.assigned_operator_email}</span>
                  )}
                  <ChevronDown size={16} className={`text-[var(--text-secondary)] transition-transform ${expanded ? "rotate-180" : ""}`} />
                </button>

                <AnimatePresence>
                  {expanded && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                      className="border-t border-[var(--border-default)]">
                      <div className="p-4 space-y-4">
                        {/* Detail grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                          {[
                            ["Contact", ar.contact_full_name],
                            ["Email", ar.contact_email],
                            ["Telephone", ar.contact_phone],
                            ["WhatsApp", ar.contact_whatsapp],
                            ["Entreprise", ar.business_name],
                            ["Secteur", ar.business_sector],
                            ["Ville", `${ar.business_city}, ${ar.business_country}`],
                            ["Selection FLARE (soumission)", selectedSnapshotPage?.page_name],
                            ["ID selection FLARE", selectedSnapshotPage?.page_id],
                            ["Page cible", ar.activation_target_page_name || ar.facebook_page_name],
                            ["ID page cible", ar.activation_target_page_id],
                            ["Pages importees", ar.selected_facebook_pages_count ? String(ar.selected_facebook_pages_count) : ""],
                            ["URL Page", ar.facebook_page_url],
                            ["Admin FB", ar.facebook_admin_email],
                            ["Bot", ar.bot_name],
                            ["Langue", ar.primary_language],
                            ["Ton", ar.tone],
                            ["Admin FLARE confirme", ar.flare_page_admin_confirmed === "true" ? "Oui" : "Non"],
                            ["Raison blocage", ar.blocked_reason || "-"],
                          ].filter(([, v]) => v && v !== "-").map(([label, val]) => (
                            <div key={label as string} className="flex justify-between gap-2">
                              <span className="text-[var(--text-secondary)]">{label}</span>
                              <span className="text-[var(--text-primary)] text-right truncate max-w-[60%]">{val}</span>
                            </div>
                          ))}
                        </div>

                        {Array.isArray(ar.selected_facebook_pages) && ar.selected_facebook_pages.length > 0 ? (
                          <div className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-subtle)] px-3 py-3">
                            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
                              Pages importees depuis Meta
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {ar.selected_facebook_pages.map((page) => {
                                const isTarget = page.page_id === ar.activation_target_page_id;
                                const isSelected = Boolean(page.is_selected);
                                const chipClass = isTarget
                                  ? "border-orange-500/30 bg-orange-500/10 text-orange-500"
                                  : isSelected
                                    ? "border-[var(--accent-navy)]/30 bg-[var(--accent-navy)]/10 text-[var(--accent-navy)]"
                                    : "border-[var(--border-default)] bg-[var(--surface-base)] text-[var(--text-secondary)]";
                                return (
                                  <span
                                    key={page.page_id}
                                    className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] ${chipClass}`}
                                  >
                                    <span>{page.page_name || page.page_id}</span>
                                    {isSelected ? (
                                      <span className="rounded-full bg-[var(--accent-navy)]/20 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-[var(--accent-navy)]">
                                        FLARE
                                      </span>
                                    ) : null}
                                    {isTarget ? (
                                      <span className="rounded-full bg-orange-500/20 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-orange-500">
                                        CIBLE
                                      </span>
                                    ) : null}
                                    <span className="text-[9px] text-[var(--text-muted)]">{page.page_id}</span>
                                  </span>
                                );
                              })}
                            </div>
                          </div>
                        ) : null}

                        <div className="flex flex-wrap gap-2">
                          {ar.contact_email ? (
                            <a
                              href={`mailto:${ar.contact_email}`}
                              className="rounded-lg border border-[var(--border-default)] px-3 py-2 text-xs font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-subtle)]"
                            >
                              Email client
                            </a>
                          ) : null}
                          {ar.contact_phone ? (
                            <a
                              href={`tel:${ar.contact_phone}`}
                              className="rounded-lg border border-[var(--border-default)] px-3 py-2 text-xs font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-subtle)]"
                            >
                              Appeler
                            </a>
                          ) : null}
                          {(ar.contact_whatsapp || ar.contact_phone) ? (
                            <a
                              href={`https://wa.me/${String(ar.contact_whatsapp || ar.contact_phone).replace(/[^0-9]/g, "")}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="rounded-lg border border-[var(--border-default)] px-3 py-2 text-xs font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-subtle)]"
                            >
                              WhatsApp
                            </a>
                          ) : null}
                          {ar.facebook_page_url ? (
                            <a
                              href={ar.facebook_page_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="rounded-lg border border-[var(--border-default)] px-3 py-2 text-xs font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-subtle)]"
                            >
                              Ouvrir la page Facebook
                            </a>
                          ) : null}
                        </div>

                        <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--surface-base)] p-4">
                          <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--text-secondary)]">Checklist operateur</p>
                          <div className="mt-3 grid gap-2 text-xs">
                            {[
                              { label: "Paiement verifie", done: ["payment_verified", "awaiting_flare_page_admin_access", "queued_for_activation", "activation_in_progress", "testing", "active"].includes(ar.status) },
                              { label: "Acces page confirme", done: ar.flare_page_admin_confirmed === "true" },
                              { label: "Activation en cours", done: ["activation_in_progress", "testing", "active"].includes(ar.status) },
                              { label: "Test Messenger valide", done: ["testing", "active"].includes(ar.status) },
                              { label: "Chatbot actif", done: ar.status === "active" },
                            ].map((item) => (
                              <div key={item.label} className="flex items-center justify-between rounded-xl bg-[var(--surface-subtle)] px-3 py-2">
                                <span className="text-[var(--text-primary)]">{item.label}</span>
                                <span className={`text-[11px] font-medium ${item.done ? "text-orange-500" : "text-[var(--text-secondary)]"}`}>
                                  {item.done ? "OK" : "A faire"}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Status actions */}
                        {nextStatuses.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            <span className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wider self-center mr-2">Transition &rarr;</span>
                            {nextStatuses.map(ns => (
                              <button key={ns} onClick={() => handleSetStatus(ar.id, ns)}
                                disabled={actionBusy === ar.id}
                                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                                  ns === "active" ? "border-[var(--accent-navy)]/28 bg-[var(--accent-navy)]/8 text-[var(--accent-navy)] hover:bg-[var(--accent-navy)]/14" :
                                  ns === "blocked" || ns === "rejected" || ns === "canceled" ? "border-red-500/30 bg-red-500/10 text-red-500 hover:bg-red-500/10" :
                                  "border-orange-500/30 bg-orange-500/10 text-orange-500 hover:bg-orange-500/20"
                                }`}>
                                {ACTIVATION_STATUS_LABELS[ns] || ns}
                              </button>
                            ))}
                          </div>
                        )}

                        {/* Assign operator */}
                        <div className="flex gap-2">
                          <input value={assignEmailDrafts[ar.id] || ""} onChange={e => setAssignEmailDrafts((current) => ({ ...current, [ar.id]: e.target.value }))} placeholder="Email operateur..."
                            className="flex-1 bg-[var(--surface-subtle)] border border-[var(--border-default)] rounded-lg px-3 py-2 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]" />
                          <button onClick={() => handleAssign(ar.id)} disabled={actionBusy === ar.id || !(assignEmailDrafts[ar.id] || "").trim()}
                            className="rounded-lg border border-[var(--accent-navy)]/28 bg-[var(--accent-navy)]/8 px-3 py-2 text-xs font-medium text-[var(--accent-navy)] hover:bg-[var(--accent-navy)]/14 disabled:opacity-40">
                            Assigner
                          </button>
                        </div>

                        {/* Add note */}
                        <div className="flex gap-2">
                          <input value={noteDrafts[ar.id] || ""} onChange={e => setNoteDrafts((current) => ({ ...current, [ar.id]: e.target.value }))} placeholder="Ajouter une note..."
                            className="flex-1 bg-[var(--surface-subtle)] border border-[var(--border-default)] rounded-lg px-3 py-2 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]" />
                          <button onClick={() => handleAddNote(ar.id)} disabled={actionBusy === ar.id || !(noteDrafts[ar.id] || "").trim()}
                            className="rounded-lg border border-orange-500/30 bg-orange-500/10 px-3 py-2 text-xs font-medium text-orange-500 hover:bg-orange-500/20 disabled:opacity-40">
                            <StickyNote size={14} />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}


// ══════════════════════════════════════════════════════════════════════════════
// ADMIN PAYMENTS TAB
// ══════════════════════════════════════════════════════════════════════════════

function AdminPaymentsTab({ token, onBack }: { token: string; onBack: () => void }) {
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [rejectReasons, setRejectReasons] = useState<Record<string, string>>({});
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const [feedback, setFeedback] = useState<{ tone: "error" | "success" | "warning"; message: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await getAdminPayments(token);
      setPayments(res.payments || []);
    } catch { /* silent */ }
    setLoading(false);
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const filtered = filter === "all" ? payments : payments.filter((p: any) => p.status === filter);

  const handleVerify = async (id: string) => {
    setActionBusy(id);
    try {
      await adminVerifyPayment(id, token);
      await load();
      setFeedback({ tone: "success", message: "Paiement verifie." });
    } catch (e) {
      setFeedback({ tone: "error", message: e instanceof Error ? e.message : "Erreur" });
    }
    setActionBusy(null);
  };

  const handleReject = async (id: string) => {
    const rejectReason = (rejectReasons[id] || "").trim();
    if (!rejectReason) {
      setFeedback({ tone: "warning", message: "Renseignez une raison de refus." });
      return;
    }
    setActionBusy(id);
    try {
      await adminRejectPayment(id, rejectReason, token);
      setRejectingId(null);
      setRejectReasons((current) => ({ ...current, [id]: "" }));
      await load();
      setFeedback({ tone: "success", message: "Paiement refuse." });
    } catch (e) {
      setFeedback({ tone: "error", message: e instanceof Error ? e.message : "Erreur" });
    }
    setActionBusy(null);
  };

  const paymentStatusColor = (s: string) => {
    if (s === "submitted") return "bg-orange-500/10 text-orange-500";
    if (s === "verified") return "bg-[var(--accent-navy)]/8 text-[var(--accent-navy)]";
    if (s === "rejected") return "bg-red-500/10 text-red-500";
    return "bg-[var(--surface-subtle)] text-[var(--text-primary)]";
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-10 bg-[var(--background)]">
      <div className="flex items-center gap-3 mb-8">
        <button onClick={onBack} className="p-2 rounded-xl hover:bg-[var(--surface-subtle)] transition-colors">
          <ChevronLeft size={20} className="text-[var(--text-secondary)]" />
        </button>
        <CreditCard size={24} className="text-[var(--accent-navy)]" />
        <h2 className="text-xl font-bold text-[var(--text-primary)]">Paiements</h2>
        <button onClick={() => { setLoading(true); load(); }} className="ml-auto p-2 rounded-xl hover:bg-[var(--surface-subtle)]">
          <RefreshCcw size={16} className={`text-[var(--text-secondary)] ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {feedback ? (
        <div className={`mb-4 rounded-xl border px-4 py-3 text-sm ${
          feedback.tone === "success"
            ? "border-orange-500/25 bg-orange-500/10 text-[var(--text-primary)]"
            : feedback.tone === "warning"
              ? "border-[var(--border-default)] bg-[var(--surface-subtle)] text-[var(--text-primary)]"
              : "border-red-500/25 bg-red-500/10 text-[var(--text-primary)]"
        }`}>
          {feedback.message}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2 mb-6">
        {["all", "submitted", "verified", "rejected"].map(s => (
          <button key={s} onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filter === s ? "border border-[var(--accent-navy)]/28 bg-[var(--accent-navy)]/8 text-[var(--accent-navy)]" : "bg-[var(--surface-subtle)] text-[var(--text-secondary)] border border-transparent hover:border-[var(--border-default)]"}`}>
            {s === "all" ? "Tous" : s === "submitted" ? "A verifier" : s === "verified" ? "Verifies" : "Refuses"}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-4">{[1,2,3].map(i => <div key={i} className="h-20 rounded-2xl bg-[var(--surface-subtle)] animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-[var(--text-secondary)]">
          <CreditCard size={48} className="mx-auto mb-4 opacity-30" />
          <p>Aucun paiement {filter !== "all" ? "avec ce statut" : ""}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((pay: any) => (
            <motion.div key={pay.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border border-[var(--border-default)] bg-[var(--surface-base)] p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-semibold text-sm text-[var(--text-primary)]">{pay.payer_full_name || "Inconnu"}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${paymentStatusColor(pay.status)}`}>
                      {pay.status === "submitted" ? "A verifier" : pay.status === "verified" ? "Verifie" : pay.status === "rejected" ? "Refuse" : pay.status}
                    </span>
                    <span className="text-[10px] text-[var(--text-secondary)] bg-[var(--surface-subtle)] px-2 py-0.5 rounded-full">{pay.method_code}</span>
                  </div>
                  <p className="text-xs text-[var(--text-secondary)]">
                    Ref: <span className="text-[var(--text-primary)] font-mono">{pay.transaction_reference || "-"}</span>
                    {pay.amount ? ` \u00b7 ${pay.amount} ${pay.currency || ""}` : ""}
                    {pay.payer_phone ? ` \u00b7 ${pay.payer_phone}` : ""}
                  </p>
                  <p className="text-[10px] text-[var(--text-secondary)] mt-1">
                    Soumis : {pay.submitted_at ? new Date(pay.submitted_at).toLocaleString("fr-FR") : "-"}
                    {pay.user_id ? ` � ${pay.user_id}` : ""}
                  </p>
                  {pay.activation_summary ? (
                    <div className="mt-3 rounded-xl border border-[var(--border-default)] bg-[var(--surface-base)] px-3 py-3">
                      <p className="text-xs font-semibold text-[var(--text-primary)]">
                        {pay.activation_summary.business_name || pay.activation_summary.contact_full_name || "Demande liee"}
                      </p>
                      <p className="mt-1 text-[11px] text-[var(--text-secondary)]">
                        {pay.activation_summary.contact_email || "-"}
                        {pay.activation_summary.contact_phone ? ` · ${pay.activation_summary.contact_phone}` : ""}
                        {pay.activation_summary.contact_whatsapp ? ` · WhatsApp ${pay.activation_summary.contact_whatsapp}` : ""}
                      </p>
                      <p className="mt-1 text-[11px] text-[var(--text-secondary)]">
                        {pay.activation_summary.facebook_page_name || "Page Facebook non renseignee"}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {pay.activation_summary.contact_email ? (
                          <a
                            href={`mailto:${pay.activation_summary.contact_email}`}
                            className="rounded-lg border border-[var(--border-default)] px-2.5 py-1.5 text-[11px] font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-subtle)]"
                          >
                            Email
                          </a>
                        ) : null}
                        {pay.activation_summary.contact_phone ? (
                          <a
                            href={`tel:${pay.activation_summary.contact_phone}`}
                            className="rounded-lg border border-[var(--border-default)] px-2.5 py-1.5 text-[11px] font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-subtle)]"
                          >
                            Appeler
                          </a>
                        ) : null}
                        {(pay.activation_summary.contact_whatsapp || pay.activation_summary.contact_phone) ? (
                          <a
                            href={`https://wa.me/${String(pay.activation_summary.contact_whatsapp || pay.activation_summary.contact_phone).replace(/[^0-9]/g, "")}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-lg border border-[var(--border-default)] px-2.5 py-1.5 text-[11px] font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-subtle)]"
                          >
                            WhatsApp
                          </a>
                        ) : null}
                        {pay.activation_summary.facebook_page_url ? (
                          <a
                            href={pay.activation_summary.facebook_page_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-lg border border-[var(--border-default)] px-2.5 py-1.5 text-[11px] font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-subtle)]"
                          >
                            Ouvrir la page
                          </a>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                  {pay.proof_file_url && (
                    <a href={pay.proof_file_url} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 mt-2 text-xs text-[var(--accent-navy)] hover:text-[var(--text-primary)]">
                      <Eye size={12} /> Voir la preuve
                    </a>
                  )}
                  {pay.activation_summary && (
                    <div className="mt-3 rounded-xl border border-[var(--border-default)] bg-[var(--surface-subtle)] px-3 py-3">
                      <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--text-secondary)]">Handoff activation</p>
                      <div className="mt-2 grid gap-1 text-xs text-[var(--text-primary)]">
                        <p>Contact: {pay.activation_summary.contact_full_name || "-"}</p>
                        <p>Email: {pay.activation_summary.contact_email || "-"}</p>
                        <p>Telephone: {pay.activation_summary.contact_phone || "-"}</p>
                        <p>WhatsApp: {pay.activation_summary.contact_whatsapp || "-"}</p>
                        <p>Page Facebook: {pay.activation_summary.facebook_page_name || "-"}</p>
                        <p>URL page: {pay.activation_summary.facebook_page_url || "-"}</p>
                        <p>Entreprise: {pay.activation_summary.business_name || "-"}</p>
                      </div>
                    </div>
                  )}
                  {pay.rejection_reason && (
                    <p className="text-xs text-red-400 mt-1">Raison : {pay.rejection_reason}</p>
                  )}
                </div>

                {pay.status === "submitted" && (
                  <div className="flex flex-col gap-2 flex-shrink-0">
                    <button onClick={() => handleVerify(pay.id)} disabled={actionBusy === pay.id}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium bg-orange-500/12 text-[var(--text-primary)] border border-orange-500/30 hover:bg-orange-500/18 disabled:opacity-40 flex items-center gap-1">
                      <CheckCircle2 size={12} /> Valider
                    </button>
                    {rejectingId === pay.id ? (
                      <div className="flex flex-col gap-1">
                        <input value={rejectReasons[pay.id] || ""} onChange={e => setRejectReasons((current) => ({ ...current, [pay.id]: e.target.value }))} placeholder="Raison du refus..."
                          className="bg-[var(--surface-subtle)] border border-[var(--border-default)] rounded-lg px-2 py-1 text-xs text-[var(--text-primary)] w-40" />
                        <div className="flex gap-1">
                          <button onClick={() => handleReject(pay.id)} disabled={actionBusy === pay.id}
                            className="flex-1 px-2 py-1 rounded-lg text-[10px] font-medium bg-red-500/10 text-[var(--text-primary)] border border-red-500/30 hover:bg-red-500/18 disabled:opacity-40">
                            Confirmer
                          </button>
                          <button onClick={() => { setRejectingId(null); setRejectReasons((current) => ({ ...current, [pay.id]: "" })); }}
                            className="px-2 py-1 rounded-lg text-[10px] text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)]">
                            Annuler
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button onClick={() => setRejectingId(pay.id)}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium bg-red-500/10 text-[var(--text-primary)] border border-red-500/30 hover:bg-red-500/18 flex items-center gap-1">
                        <XCircle size={12} /> Refuser
                      </button>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}


// ══════════════════════════════════════════════════════════════════════════════
// ADMIN ORDERS TAB
// ══════════════════════════════════════════════════════════════════════════════

function AdminOrdersTab({ token, onBack }: { token: string; onBack: () => void }) {
  const [orders, setOrders] = useState<ChatbotOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const [feedback, setFeedback] = useState<{ tone: "error" | "success"; message: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await getAdminOrders(token);
      setOrders(res.orders || []);
    } catch { /* silent */ }
    setLoading(false);
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const filtered = filter === "all" ? orders : orders.filter(o => o.status === filter);

  const handleUpdateStatus = async (id: string, status: string) => {
    setActionBusy(id);
    try {
      await adminUpdateOrder(id, { status }, token);
      await load();
      setFeedback({ tone: "success", message: "Le statut de commande a ete mis a jour." });
    } catch (e) {
      setFeedback({ tone: "error", message: e instanceof Error ? e.message : "Erreur" });
    }
    setActionBusy(null);
  };

  const orderStatusColor = (s: string) => {
    const m: Record<string, string> = { new: "bg-[var(--accent-navy)]/8 text-[var(--accent-navy)]", confirmed: "bg-orange-500/10 text-orange-500", delivered: "bg-orange-500/10 text-orange-500", cancelled: "bg-red-500/10 text-red-500", needs_followup: "bg-[var(--accent-navy)]/8 text-[var(--accent-navy)]" };
    return m[s] || "bg-[var(--surface-subtle)] text-[var(--text-primary)]";
  };
  const orderStatusLabel = (s: string) => {
    const m: Record<string, string> = { new: "Nouvelle", confirmed: "Confirmee", delivered: "Livree", cancelled: "Annulee", needs_followup: "A suivre" };
    return m[s] || s;
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-10 bg-[var(--background)]">
      <div className="flex items-center gap-3 mb-8">
        <button onClick={onBack} className="p-2 rounded-xl hover:bg-[var(--surface-subtle)] transition-colors">
          <ChevronLeft size={20} className="text-[var(--text-secondary)]" />
        </button>
        <ShoppingBag size={24} className="text-[var(--accent-navy)]" />
        <h2 className="text-xl font-bold text-[var(--text-primary)]">Commandes (tous clients)</h2>
        <button onClick={() => { setLoading(true); load(); }} className="ml-auto p-2 rounded-xl hover:bg-[var(--surface-subtle)]">
          <RefreshCcw size={16} className={`text-[var(--text-secondary)] ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {feedback ? (
        <div className={`mb-4 rounded-xl border px-4 py-3 text-sm ${feedback.tone === "success" ? "border-orange-500/25 bg-orange-500/10 text-[var(--text-primary)]" : "border-red-500/25 bg-red-500/10 text-[var(--text-primary)]"}`}>
          {feedback.message}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2 mb-6">
        {["all", "new", "confirmed", "needs_followup", "delivered", "cancelled"].map(s => (
          <button key={s} onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filter === s ? "border border-[var(--accent-navy)]/28 bg-[var(--accent-navy)]/8 text-[var(--accent-navy)]" : "bg-[var(--surface-subtle)] text-[var(--text-secondary)] border border-transparent hover:border-[var(--border-default)]"}`}>
            {s === "all" ? "Toutes" : orderStatusLabel(s)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-4">{[1,2,3].map(i => <div key={i} className="h-20 rounded-2xl bg-[var(--surface-subtle)] animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-[var(--text-secondary)]">
          <ShoppingBag size={48} className="mx-auto mb-4 opacity-30" />
          <p>Aucune commande {filter !== "all" ? "avec ce statut" : ""}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(order => (
            <motion.div key={order.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border border-[var(--border-default)] bg-[var(--surface-base)] p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-semibold text-sm text-[var(--text-primary)]">{order.contact_name || "Contact inconnu"}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${orderStatusColor(order.status)}`}>
                      {orderStatusLabel(order.status)}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${order.source === "signal" ? "bg-orange-500/10 text-orange-500" : "bg-[var(--surface-subtle)] text-[var(--text-primary)]"}`}>
                      {order.source === "signal" ? "Signal IA" : "Manuel"}
                    </span>
                    <span className="text-[10px] text-[var(--text-secondary)] bg-[var(--surface-subtle)] px-2 py-0.5 rounded-full">{order.page_name || order.facebook_page_id || "Commande"}</span>
                  </div>
                  <p className="text-xs text-[var(--text-primary)] mt-1">{order.product_summary || "-"}</p>
                  <p className="text-[10px] text-[var(--text-secondary)] mt-1">
                    {order.quantity_text ? `Qte: ${order.quantity_text}` : ""}
                    {order.amount_text ? ` \u00b7 ${order.amount_text}` : ""}
                    {order.contact_phone ? ` \u00b7 ${order.contact_phone}` : ""}
                    {order.delivery_address ? ` \u00b7 ${order.delivery_address}` : ""}
                  </p>
                  {order.customer_request_text && (
                    <p className="text-[10px] text-[var(--text-secondary)] mt-1 italic">
                      &quot;{order.customer_request_text}&quot;
                    </p>
                  )}
                  <p className="text-[10px] text-[var(--text-secondary)] mt-1">
                    {order.created_at ? new Date(order.created_at).toLocaleString("fr-FR") : "-"}
                    {order.source === "signal" && order.confidence > 0 ? ` \u00b7 Confiance: ${Math.round(order.confidence * 100)}%` : ""}
                  </p>
                </div>

                <div className="flex flex-col gap-1 flex-shrink-0">
                  {["new", "needs_followup"].includes(order.status) && (
                    <button onClick={() => handleUpdateStatus(order.id, "confirmed")} disabled={actionBusy === order.id}
                      className="rounded-lg border border-orange-500/30 bg-orange-500/10 px-2 py-1 text-[10px] font-medium text-orange-500 hover:bg-orange-500/20 disabled:opacity-40">
                      Confirmer
                    </button>
                  )}
                  {order.status === "confirmed" && (
                    <button onClick={() => handleUpdateStatus(order.id, "delivered")} disabled={actionBusy === order.id}
                      className="rounded-lg border border-orange-500/30 bg-orange-500/10 px-2 py-1 text-[10px] font-medium text-orange-500 hover:bg-orange-500/20 disabled:opacity-40">
                      Livree
                    </button>
                  )}
                  {!["cancelled", "delivered"].includes(order.status) && (
                    <>
                      <button onClick={() => handleUpdateStatus(order.id, "needs_followup")} disabled={actionBusy === order.id}
                        className="rounded-lg border border-[var(--accent-navy)]/28 bg-[var(--accent-navy)]/8 px-2 py-1 text-[10px] font-medium text-[var(--accent-navy)] hover:bg-[var(--accent-navy)]/14 disabled:opacity-40">
                        A suivre
                      </button>
                      <button onClick={() => handleUpdateStatus(order.id, "cancelled")} disabled={actionBusy === order.id}
                        className="px-2 py-1 rounded-lg text-[10px] font-medium bg-red-500/10 text-[var(--text-primary)] border border-red-500/30 hover:bg-red-500/18 disabled:opacity-40">
                        Annuler
                      </button>
                    </>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}


