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
  message:       { icon: MessageSquare,  label: "Messages",      color: "text-blue-400",    emoji: "💬" },
  research:      { icon: Globe,          label: "Recherche",     color: "text-cyan-400",    emoji: "🔍" },
  deep_research: { icon: Microscope,     label: "Deep Research", color: "text-[var(--text-primary)]",   emoji: "🧪" },
  image_gen:     { icon: ImageIcon,      label: "Image Gen",     color: "text-[var(--text-muted)]",    emoji: "🎨" },
  video_gen:     { icon: Video,          label: "Vidéo Gen",     color: "text-[var(--text-muted)]", emoji: "🎬" },
  doc_gen:       { icon: FileText,       label: "Documents",     color: "text-indigo-400",  emoji: "📝" },
  sheet_gen:     { icon: FileSpreadsheet, label: "Tableurs",     color: "text-emerald-400", emoji: "📊" },
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
      <div className="text-center font-[family-name:var(--font-outfit)] text-[10px] text-zinc-500">{actions || 0}</div>
      <div className="text-right font-[family-name:var(--font-outfit)] text-[10px] text-zinc-500">{formatTokens(tokens)}</div>
      <div className={`text-right font-[family-name:var(--font-outfit)] text-[10px] font-bold ${accent}`}>{formatCost(cost)}</div>
    </div>
  );
}

function ActionRow({ label, icon: Icon, emoji, g3, flash, total_cost }: any) {
  return (
    <div className="grid grid-cols-12 gap-0 py-2 border-b border-[var(--border-glass)] items-center last:border-0 hover:bg-[var(--bg-hover)] transition-colors -mx-4 px-4">
      <div className="col-span-3 flex items-center gap-2.5">
        <div className="w-5 h-5 rounded-md bg-zinc-800/50 flex items-center justify-center border border-[var(--border-glass)]">
          <span className="text-[12px]">{emoji}</span>
        </div>
        <span className="text-[11px] text-zinc-400 font-medium">{label}</span>
      </div>

      <div className="col-span-3 h-full px-2">
        <DataSubGrid actions={g3?.actions} tokens={g3?.tokens} cost={g3?.cost} accent="text-[var(--text-primary)]/80" />
      </div>

      <div className="col-span-3 h-full px-2 border-l border-[var(--border-glass)]">
        <DataSubGrid actions={flash?.actions} tokens={flash?.tokens} cost={flash?.cost} accent="text-emerald-400/80" />
      </div>

      <div className="col-span-3 text-right pr-4">
        <span className="text-[11px] font-bold text-zinc-300 font-[family-name:var(--font-outfit)] tracking-tighter">{formatCost(total_cost || 0)}</span>
      </div>
    </div>
  );
}

const LedgerTable = ({ ledger, loading }: { ledger: LedgerEntry[], loading: boolean }) => (
    <div className="mt-10 bg-[var(--bg-card)] border border-[var(--border-glass)] rounded-[32px] overflow-hidden backdrop-blur-3xl shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-glass)]">
            <h3 className="text-lg font-bold text-[var(--text-primary)]">Journal des Transactions</h3>
            {loading && <div className="w-5 h-5 border-2 border-[var(--border-glass)] border-t-[var(--text-primary)] rounded-full animate-spin" />}
        </div>
        <div className="overflow-x-auto">
            <table className="w-full text-left">
                <thead>
                    <tr className="bg-[var(--bg-hover)]">
                        {['Date', 'Utilisateur', 'Action', 'Modèle', 'Tokens', 'Coût'].map(h => (
                             <th key={h} className="px-4 py-2 text-[9px] font-bold text-zinc-500 uppercase tracking-widest first:pl-6 last:pr-6">{h}</th>
                        ))}
                    </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-glass)]">
                    {ledger.map(entry => (
                        <tr key={entry.id} className="hover:bg-[var(--bg-hover)] transition-colors">
                            <td className="px-4 py-3 text-xs text-zinc-400 whitespace-nowrap first:pl-6 last:pr-6">{timeAgo(entry.timestamp)}</td>
                            <td className="px-4 py-3 text-xs text-zinc-300 whitespace-nowrap truncate max-w-[200px]">{entry.user_email}</td>
                            <td className="px-4 py-3 text-xs text-zinc-400 whitespace-nowrap">{entry.action}</td>
                            <td className="px-4 py-3 text-xs text-zinc-500 whitespace-nowrap truncate max-w-[150px]">{entry.model}</td>
                            <td className="px-4 py-3 text-xs text-zinc-400 font-[family-name:var(--font-outfit)] text-right">{formatTokens(entry.tokens)}</td>
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
      color: "from-amber-500/20 to-orange-500/10",
      borderColor: "border-amber-500/20",
      iconColor: "text-amber-400",
      stat: formatCost(stats.totalCost),
      statLabel: "Coût total",
    },
    {
      id: "connected" as AdminTab,
      title: "Utilisateurs Connectés",
      subtitle: "Activité en temps réel & sessions actives",
      icon: Wifi,
      color: "from-emerald-500/20 to-green-500/10",
      borderColor: "border-emerald-500/20",
      iconColor: "text-emerald-400",
      stat: `${stats.onlineCount}`,
      statLabel: "En ligne",
    },
    {
      id: "accounts" as AdminTab,
      title: "Nouveaux Comptes",
      subtitle: "Inscriptions & croissance utilisateurs",
      icon: UserPlus,
      color: "from-blue-500/20 to-indigo-500/10",
      borderColor: "border-blue-500/20",
      iconColor: "text-blue-400",
      stat: `${stats.newToday}`,
      statLabel: "Aujourd'hui",
    },
    {
      id: "activations" as AdminTab,
      title: "Activations",
      subtitle: "Demandes d'activation chatbot & suivi operateur",
      icon: Rocket,
      color: "from-orange-500/20 to-red-500/10",
      borderColor: "border-orange-500/20",
      iconColor: "text-orange-400",
      stat: "-",
      statLabel: "En attente",
    },
    {
      id: "payments" as AdminTab,
      title: "Paiements",
      subtitle: "Verifier et valider les preuves de paiement",
      icon: CreditCard,
      color: "from-violet-500/20 to-purple-500/10",
      borderColor: "border-violet-500/20",
      iconColor: "text-violet-400",
      stat: "-",
      statLabel: "A verifier",
    },
    {
      id: "orders" as AdminTab,
      title: "Commandes",
      subtitle: "Commandes Messenger de tous les clients",
      icon: ShoppingBag,
      color: "from-cyan-500/20 to-teal-500/10",
      borderColor: "border-cyan-500/20",
      iconColor: "text-cyan-400",
      stat: "-",
      statLabel: "Total",
    },
    {
      id: "reports" as AdminTab,
      title: "Signalements",
      subtitle: "Problemes et retours envoyes par les utilisateurs",
      icon: AlertCircle,
      color: "from-orange-500/18 to-amber-500/10",
      borderColor: "border-orange-500/20",
      iconColor: "text-orange-400",
      stat: "-",
      statLabel: "A traiter",
    },
  ];

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-10 bg-[var(--background)]">
      <div className="flex items-center gap-4 mb-10">
        <div className="w-12 h-12 rounded-2xl bg-[var(--bg-hover)] flex items-center justify-center shadow-lg border border-[var(--border-glass)]">
          <ShieldCheck size={24} className="text-[var(--text-primary)]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight">Administration</h1>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <p className="text-[11px] text-zinc-500 font-[family-name:var(--font-outfit)] uppercase tracking-widest">FLARE AI — Admin Engine v3.6.0</p>
          </div>
        </div>
      </div>

      {/* KPI Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        {[
          { label: "Utilisateurs", val: stats.totalUsers, icon: Users, color: "text-[var(--text-primary)]" },
          { label: "En ligne", val: stats.onlineCount, icon: Wifi, color: "text-emerald-400" },
          { label: "Nouveaux (24h)", val: stats.newToday, icon: UserPlus, color: "text-blue-400" },
          { label: "Coût Total", val: formatCost(stats.totalCost), icon: DollarSign, color: "text-amber-400" },
        ].map((kpi, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="p-6 rounded-[28px] bg-[var(--bg-card)] border border-[var(--border-glass)] hover:bg-[var(--bg-hover)] transition-all"
          >
            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{kpi.label}</span>
              <kpi.icon size={16} className="text-[var(--text-muted)]" />
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
            <div className={`w-14 h-14 rounded-2xl bg-black/20 border border-[var(--border-glass)] flex items-center justify-center mb-6 ${card.iconColor}`}>
              <card.icon size={28} />
            </div>
            <h3 className="text-lg font-bold text-[var(--text-primary)] mb-1">{card.title}</h3>
            <p className="text-[12px] text-zinc-400 mb-6 leading-relaxed">{card.subtitle}</p>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-[var(--text-primary)] font-[family-name:var(--font-outfit)]">{card.stat}</p>
                <p className="text-[10px] text-zinc-500 uppercase tracking-widest">{card.statLabel}</p>
              </div>
              <ChevronRight size={20} className="text-zinc-600 group-hover:text-[var(--text-primary)] group-hover:translate-x-1 transition-all" />
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
    online: { label: "En ligne", color: "bg-emerald-500", textColor: "text-emerald-400", ring: "ring-emerald-500/20" },
    recent: { label: "Récent", color: "bg-amber-500", textColor: "text-amber-400", ring: "ring-amber-500/20" },
    away: { label: "Absent", color: "bg-zinc-600", textColor: "text-zinc-500", ring: "ring-zinc-500/20" },
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-10 bg-[var(--background)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-10">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 rounded-xl hover:bg-[var(--bg-hover)] text-zinc-400 hover:text-[var(--text-primary)] transition-all">
            <ChevronLeft size={20} />
          </button>
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
            <Wifi size={24} className="text-emerald-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight">Utilisateurs Connectés</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <p className="text-[11px] text-zinc-500 font-[family-name:var(--font-outfit)] uppercase tracking-widest">Temps réel — rafraîchi toutes les 15s</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition-all ${
              autoRefresh ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500" : "bg-[var(--bg-hover)] border-[var(--border-glass)] text-zinc-500"
            }`}
          >
            <div className={`w-1.5 h-1.5 rounded-full ${autoRefresh ? "bg-emerald-500 animate-pulse" : "bg-zinc-600"}`} />
            <span className="text-[10px] font-[family-name:var(--font-outfit)] uppercase tracking-widest">
              {autoRefresh ? `Live (${nextRefresh}s)` : "Pausé"}
            </span>
          </button>
          <button onClick={refresh} disabled={loading} className="px-4 py-2 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 text-xs font-bold hover:opacity-90 transition-all flex items-center gap-2 disabled:opacity-50">
            <RefreshCcw size={14} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: "En ligne", val: data?.online_count ?? 0, color: "text-emerald-400", dot: "bg-emerald-500" },
          { label: "Récemment actifs", val: data?.recent_count ?? 0, color: "text-amber-400", dot: "bg-amber-500" },
          { label: "Actifs (24h)", val: data?.total_active_24h ?? 0, color: "text-blue-400", dot: "bg-blue-500" },
        ].map((kpi, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className="p-6 rounded-[28px] bg-[var(--bg-card)] border border-[var(--border-glass)]">
            <div className="flex items-center gap-2 mb-3">
              <div className={`w-2 h-2 rounded-full ${kpi.dot} animate-pulse`} />
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{kpi.label}</span>
            </div>
            <p className={`text-3xl font-bold ${kpi.color} font-[family-name:var(--font-outfit)]`}>{kpi.val}</p>
          </motion.div>
        ))}
      </div>

      {/* Users Table */}
      <div className="bg-[var(--bg-card)] border border-[var(--border-glass)] rounded-[32px] overflow-hidden">
        <div className="px-6 py-4 border-b border-[var(--border-glass)]">
          <h3 className="text-[13px] font-bold text-[var(--text-primary)] uppercase tracking-widest">Sessions Actives</h3>
        </div>

        <div className="grid grid-cols-12 gap-0 bg-[var(--bg-hover)] px-6 py-2 border-b border-[var(--border-glass)]">
          <div className="col-span-4 text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Utilisateur</div>
          <div className="col-span-2 text-[9px] font-bold text-zinc-500 uppercase tracking-widest text-center">Statut</div>
          <div className="col-span-2 text-[9px] font-bold text-zinc-500 uppercase tracking-widest text-center">Dernière action</div>
          <div className="col-span-2 text-[9px] font-bold text-zinc-500 uppercase tracking-widest text-right">Tokens (24h)</div>
          <div className="col-span-2 text-[9px] font-bold text-zinc-500 uppercase tracking-widest text-right">Coût (24h)</div>
        </div>

        <div className="divide-y divide-[var(--border-glass)]">
          {(!data?.users || data.users.length === 0) ? (
            <div className="p-16 text-center">
              <WifiOff size={32} className="text-zinc-700 mx-auto mb-3" />
              <p className="text-zinc-600 text-xs">Aucun utilisateur actif dans les dernières 24h</p>
            </div>
          ) : data.users.map((user, idx) => {
            const sc = statusConfig[user.status];
            return (
              <motion.div key={user.user_id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: idx * 0.03 }}
                className="grid grid-cols-12 gap-0 px-6 py-4 items-center hover:bg-[var(--bg-hover)] transition-colors">
                <div className="col-span-4 flex items-center gap-3 min-w-0">
                  <div className="relative">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-[var(--text-primary)]/10 to-[var(--text-primary)]/20 border border-[var(--border-glass)] flex items-center justify-center text-[var(--text-primary)] font-bold text-sm">
                      {(user.email || "?").charAt(0).toUpperCase()}
                    </div>
                    <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 ${sc.color} border-2 border-zinc-950 rounded-full ${user.status === "online" ? "animate-pulse" : ""}`} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-[var(--text-primary)] truncate">{user.email}</p>
                    <p className="text-[10px] text-zinc-600 truncate font-[family-name:var(--font-outfit)] tracking-tighter">UID: {user.user_id} · {timeAgo(user.last_seen)}</p>
                  </div>
                </div>
                <div className="col-span-2 flex justify-center">
                  <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${sc.textColor} bg-black/30 border border-[var(--border-glass)]`}>
                    {sc.label}
                  </span>
                </div>
                <div className="col-span-2 text-center">
                  <span className="text-[11px] text-zinc-400">{user.last_action || "—"}</span>
                </div>
                <div className="col-span-2 text-right">
                  <span className="text-[12px] font-bold text-[var(--text-primary)] font-[family-name:var(--font-outfit)]">{formatTokens(user.tokens_today)}</span>
                </div>
                <div className="col-span-2 text-right">
                  <span className="text-[12px] font-bold text-amber-400 font-[family-name:var(--font-outfit)]">{formatCost(user.cost_today)}</span>
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
          <button onClick={onBack} className="p-2 rounded-xl hover:bg-[var(--bg-hover)] text-zinc-400 hover:text-[var(--text-primary)] transition-all">
            <ChevronLeft size={20} />
          </button>
          <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
            <UserPlus size={24} className="text-blue-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight">Nouveaux Comptes</h1>
            <p className="text-[11px] text-zinc-500 font-[family-name:var(--font-outfit)] uppercase tracking-widest">Inscriptions & croissance</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition-all ${
              autoRefresh ? "bg-blue-500/10 border-blue-500/20 text-blue-500" : "bg-[var(--bg-hover)] border-[var(--border-glass)] text-zinc-500"
            }`}
          >
            <div className={`w-1.5 h-1.5 rounded-full ${autoRefresh ? "bg-blue-500 animate-pulse" : "bg-zinc-600"}`} />
            <span className="text-[10px] font-[family-name:var(--font-outfit)] uppercase tracking-widest">
              {autoRefresh ? `Live (${nextRefresh}s)` : "Pausé"}
            </span>
          </button>
          <div className="flex bg-[var(--bg-hover)] border border-[var(--border-glass)] rounded-xl p-0.5">
            {[
              { label: "7J", val: 7 },
              { label: "30J", val: 30 },
              { label: "90J", val: 90 },
              { label: "ALL", val: 365 },
            ].map((opt) => (
              <button key={opt.val} onClick={() => setDays(opt.val)}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ${
                  days === opt.val ? "bg-[var(--text-primary)] text-[rgb(var(--background))] shadow-lg" : "text-zinc-500 hover:text-[var(--text-primary)]"
                }`}>
                {opt.label}
              </button>
            ))}
          </div>
          <button onClick={refresh} disabled={loading} className="px-4 py-2 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 text-xs font-bold hover:opacity-90 transition-all flex items-center gap-2 disabled:opacity-50">
            <RefreshCcw size={14} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: "Aujourd'hui", val: data?.new_today ?? 0, color: "text-emerald-400" },
          { label: "Cette semaine", val: data?.new_this_week ?? 0, color: "text-blue-400" },
          { label: `${days} derniers jours`, val: data?.total ?? 0, color: "text-[var(--text-primary)]" },
        ].map((kpi, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className="p-6 rounded-[28px] bg-[var(--bg-card)] border border-[var(--border-glass)]">
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{kpi.label}</span>
            <p className={`text-3xl font-bold ${kpi.color} font-[family-name:var(--font-outfit)] mt-2`}>{kpi.val}</p>
          </motion.div>
        ))}
      </div>

      {/* Accounts Table */}
      <div className="bg-[var(--bg-card)] border border-[var(--border-glass)] rounded-[32px] overflow-hidden">
        <div className="px-6 py-4 border-b border-[var(--border-glass)]">
          <h3 className="text-[13px] font-bold text-[var(--text-primary)] uppercase tracking-widest">Comptes Créés</h3>
        </div>

        <div className="grid grid-cols-12 gap-0 bg-[var(--bg-hover)] px-6 py-2 border-b border-[var(--border-glass)]">
          <div className="col-span-4 text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Email</div>
          <div className="col-span-2 text-[9px] font-bold text-zinc-500 uppercase tracking-widest text-center">Plan</div>
          <div className="col-span-2 text-[9px] font-bold text-zinc-500 uppercase tracking-widest text-center">Inscrit le</div>
          <div className="col-span-2 text-[9px] font-bold text-zinc-500 uppercase tracking-widest text-center">Activité</div>
          <div className="col-span-2 text-[9px] font-bold text-zinc-500 uppercase tracking-widest text-right">Coût total</div>
        </div>

        <div className="divide-y divide-[var(--border-glass)]">
          {(!data?.accounts || data.accounts.length === 0) ? (
            <div className="p-16 text-center">
              <UserPlus size={32} className="text-zinc-700 mx-auto mb-3" />
              <p className="text-zinc-600 text-xs">Aucun nouveau compte sur cette période</p>
            </div>
          ) : data.accounts.map((acc, idx) => {
            const planColor = acc.plan === "business" ? "text-amber-400 bg-amber-500/10 border-amber-500/20"
              : acc.plan === "pro" ? "text-blue-400 bg-blue-500/10 border-blue-500/20"
              : "text-zinc-400 bg-zinc-500/10 border-zinc-500/20";
            return (
              <motion.div key={acc.user_id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: idx * 0.03 }}
                className="grid grid-cols-12 gap-0 px-6 py-4 items-center hover:bg-[var(--bg-hover)] transition-colors">
                <div className="col-span-4 flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-blue-500/10 to-indigo-500/20 border border-[var(--border-glass)] flex items-center justify-center text-blue-400 font-bold text-sm">
                    {(acc.email || "?").charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-[var(--text-primary)] truncate">{acc.email}</p>
                    <p className="text-[10px] text-zinc-600 truncate font-[family-name:var(--font-outfit)] tracking-tighter">UID: {acc.user_id}</p>
                  </div>
                </div>
                <div className="col-span-2 flex justify-center">
                  <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${planColor}`}>
                    {acc.plan}
                  </span>
                </div>
                <div className="col-span-2 text-center">
                  <span className="text-[11px] text-zinc-400">{formatDate(acc.created_at)}</span>
                </div>
                <div className="col-span-2 text-center">
                  {acc.is_active ? (
                    <span className="text-[11px] text-emerald-400 font-medium">{acc.total_actions} actions</span>
                  ) : (
                    <span className="text-[11px] text-zinc-600 italic">Inactif</span>
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
      alert((res as any).message || res.status || "Synchronisation Firebase terminée.");
      refresh();
    } catch (e) {
      alert("Erreur lors de la synchronisation Firebase.");
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
          <div className="w-12 h-12 border-4 border-[var(--border-glass)] border-t-[var(--text-primary)] rounded-full animate-spin" />
          <div className="text-zinc-500 text-xs font-[family-name:var(--font-outfit)] tracking-widest uppercase">Chargement Cost Intelligence...</div>
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
          <p className="text-zinc-400 text-sm mb-6">{error}</p>
          <div className="flex flex-col gap-3">
            <button onClick={refresh} className="px-6 py-3 rounded-xl bg-[var(--text-primary)] text-[var(--background)] font-bold text-sm">Réessayer</button>
            <button onClick={onBack} className="px-6 py-3 rounded-xl bg-[var(--bg-hover)] border border-[var(--border-glass)] text-zinc-400 font-bold text-xs">Retour au menu</button>
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
            <button onClick={onBack} className="p-2 rounded-xl hover:bg-[var(--bg-hover)] text-zinc-400 hover:text-[var(--text-primary)] transition-all">
              <ChevronLeft size={20} />
            </button>
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20">
              <DollarSign size={24} className="text-amber-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight">Cost Intelligence</h1>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <p className="text-[11px] text-zinc-500 font-[family-name:var(--font-outfit)] uppercase tracking-widest">FLARE AI — Admin Engine v3.6.0</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button onClick={() => setAutoRefresh(!autoRefresh)}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition-all ${
                autoRefresh ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500" : "bg-[var(--bg-hover)] border-[var(--border-glass)] text-zinc-500"
              }`}>
              <div className={`w-1.5 h-1.5 rounded-full ${autoRefresh ? "bg-emerald-500 animate-pulse" : "bg-zinc-600"}`} />
              <span className="text-[10px] font-[family-name:var(--font-outfit)] uppercase tracking-widest">
                {autoRefresh ? `Live (${nextRefresh}s)` : "Static"}
              </span>
            </button>
            <div className="flex bg-[var(--bg-hover)] border border-[var(--border-glass)] rounded-xl p-0.5">
              {[{ label: "1J", val: 1 }, { label: "7J", val: 7 }, { label: "30J", val: 30 }, { label: "ALL", val: 0 }].map((opt) => (
                <button key={opt.val} onClick={() => setDays(opt.val)}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ${
                    days === opt.val ? "bg-[var(--text-primary)] text-[rgb(var(--background))] shadow-lg" : "text-zinc-500 hover:text-[var(--text-primary)]"
                  }`}>
                  {opt.label}
                </button>
              ))}
            </div>
            <button onClick={triggerSync} disabled={loading}
              className="px-3 py-2 rounded-xl bg-[var(--bg-hover)] border border-[var(--border-glass)] text-zinc-400 text-xs font-bold hover:text-[var(--text-primary)] hover:border-[var(--border-subtle)] transition-all flex items-center gap-2 disabled:opacity-50">
              <Users size={14} />
              Sync Firebase
            </button>
            <button onClick={showLedger} disabled={ledgerLoading}
              className="px-3 py-2 rounded-xl bg-[var(--bg-hover)] border border-[var(--border-glass)] text-zinc-400 text-xs font-bold hover:text-[var(--text-primary)] hover:border-[var(--border-subtle)] transition-all flex items-center gap-2 disabled:opacity-50">
              <BookOpen size={14} />
              {ledger ? "Masquer Journal" : "Journal"}
            </button>
            <button onClick={refresh} disabled={loading}
              className="px-4 py-2 rounded-xl bg-[var(--text-primary)] text-[var(--bg-card)] dark:text-[var(--background)] text-xs font-bold hover:opacity-90 transition-all flex items-center gap-2 shadow-lg disabled:opacity-50">
              <RefreshCcw size={14} className={loading ? "animate-spin" : ""} />
              {loading ? "Sync..." : "Refresh"}
            </button>
          </div>
        </div>

        {/* Global KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          {[
            { label: "Utilisateurs", val: data?.total_users ?? 0, sub: "Comptes actifs", icon: Users, color: "text-[var(--text-primary)]" },
            { label: "Gemini 3 Pro", val: formatCost(totalG3), sub: "Coût Raisonnement", icon: Brain, color: "text-[var(--text-primary)]" },
            { label: "GEMINI 3 FLASH", val: formatCost(totalFlash), sub: "Coût Vitesse", icon: Zap, color: "text-emerald-400" },
            { label: "Total Google Cloud", val: formatCost(data?.total_cost ?? 0), sub: `${formatTokens(totalTokens)} tokens`, icon: DollarSign, color: "text-[var(--text-primary)]" }
          ].map((kpi, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              className="p-6 rounded-[28px] bg-[var(--bg-card)] border border-[var(--border-glass)] hover:bg-[var(--bg-hover)] transition-all cursor-default">
              <div className="flex items-center justify-between mb-4">
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{kpi.label}</span>
                <kpi.icon size={16} className="text-[var(--text-muted)]" />
              </div>
              <p className={`text-2xl font-bold ${kpi.color} font-[family-name:var(--font-outfit)] tracking-tight`}>{kpi.val}</p>
              <p className="text-[11px] text-[var(--text-muted)] mt-1">{kpi.sub}</p>
            </motion.div>
          ))}
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          {[
            { label: "Messages", val: totalMessages, icon: MessageSquare, color: "text-blue-400" },
            { label: "Recherches", val: totalResearch, icon: Globe, color: "text-cyan-400" },
            { label: "Images", val: totalImages, icon: ImageIcon, color: "text-pink-400" },
            { label: "Vidéos", val: totalVideos, icon: Video, color: "text-emerald-400" },
            { label: "Documents", val: totalDocs, icon: FileText, color: "text-indigo-400" },
            { label: "Tableurs", val: totalSheets, icon: FileSpreadsheet, color: "text-green-400" },
          ].map((kpi, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: (i + 4) * 0.05 }}
              className="p-4 rounded-[28px] bg-[var(--bg-card)] border border-[var(--border-glass)] flex items-center gap-4">
              <div className={`w-12 h-12 rounded-2xl bg-[var(--bg-hover)] border border-[var(--border-glass)] flex items-center justify-center ${kpi.color}`}>
                <kpi.icon size={24} />
              </div>
              <div>
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{kpi.label}</span>
                <p className="text-2xl font-bold text-[var(--text-primary)] font-[family-name:var(--font-outfit)] tracking-tight">{kpi.val}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Master Table */}
        <div className="bg-[var(--bg-card)] border border-[var(--border-glass)] rounded-[32px] overflow-hidden backdrop-blur-3xl shadow-2xl">
          <div className="flex items-center justify-between px-6 py-4">
            <div className="relative">
              <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder={`Rechercher parmi ${sortedUsers.length} utilisateurs...`}
                className="bg-[var(--bg-hover)] border border-[var(--border-glass)] rounded-xl pl-10 pr-4 py-2.5 text-sm text-[var(--text-primary)] placeholder-zinc-500 focus:outline-none focus:border-[var(--border-subtle)] transition-all w-80" />
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setSort({ ...sort, asc: !sort.asc })} className="p-2.5 rounded-xl bg-[var(--bg-hover)] border border-[var(--border-glass)] text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)] transition-all">
                <ArrowUpDown size={14} className={`transition-transform ${sort.asc ? "" : "rotate-180"}`} />
              </button>
              <div className="flex bg-[var(--bg-hover)] border border-[var(--border-glass)] rounded-xl p-0.5">
                {[
                  { key: "cost", label: "Coût" },
                  { key: "tokens", label: "Tokens" },
                  { key: "last_active", label: "Activité" },
                  { key: "email", label: "Email" },
                ].map(opt => (
                  <button key={opt.key} onClick={() => setSort({ ...sort, key: opt.key })}
                    className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      sort.key === opt.key ? "bg-[var(--text-primary)] text-[rgb(var(--background))] shadow-md" : "text-zinc-400 hover:text-[var(--text-primary)]"
                    }`}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-12 gap-0 border-y border-[var(--border-glass)] bg-[var(--bg-hover)] px-6 py-2">
            <div className="col-span-4 text-[9px] font-bold text-zinc-500 uppercase tracking-widest">IDENTITÉ UTILISATEUR</div>
            <div className="col-span-3 text-center border-x border-[var(--border-glass)]">
              <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">GEMINI 3 PRO</span>
            </div>
            <div className="col-span-3 text-center">
              <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">GEMINI 3 FLASH</span>
            </div>
            <div className="col-span-2 text-right self-center">
              <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Grand Total</span>
            </div>
          </div>

          <div className="divide-y divide-[var(--border-glass)]">
            {paginatedUsers.length === 0 ? (
              <div className="p-20 text-center text-zinc-700 font-[family-name:var(--font-outfit)] text-xs uppercase tracking-widest italic">Aucun utilisateur correspondant.</div>
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
                        className={`grid grid-cols-12 gap-0 px-6 py-5 items-center cursor-pointer transition-all ${isExpanded ? 'bg-[var(--bg-active)]' : 'hover:bg-[var(--bg-hover)]'}`}>
                        <div className="col-span-4 flex items-center gap-4 min-w-0 pr-4">
                          <div className="relative">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[var(--text-primary)]/10 to-[var(--text-primary)]/20 border border-[var(--border-glass)] flex items-center justify-center text-[var(--text-primary)] font-bold text-sm shadow-inner overflow-hidden">
                              {email.charAt(0).toUpperCase()}
                            </div>
                            {user.last_active && (Date.now() - new Date(user.last_active).getTime() < 180000) && (
                              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-zinc-950 rounded-full animate-pulse" />
                            )}
                          </div>
                          <div className="flex flex-col min-w-0">
                            <div className="flex items-center gap-2">
                              {isExpanded ? <ChevronDown size={14} className="text-[var(--text-primary)]" /> : <ChevronRight size={14} className="text-zinc-600" />}
                              <span className="text-[13px] font-bold text-[var(--text-primary)] truncate">{email}</span>
                            </div>
                            <span className="text-[10px] text-zinc-500 font-[family-name:var(--font-outfit)] tracking-tighter truncate pl-5 opacity-60">ID: {user.user_id}</span>
                          </div>
                        </div>
                        <div className="col-span-3 h-full px-2 border-l border-[var(--border-glass)]">
                          <DataSubGrid actions={g3?.total?.actions} tokens={g3?.total?.tokens} cost={g3?.total?.cost} accent="text-[var(--text-primary)]" />
                        </div>
                        <div className="col-span-3 h-full px-2 border-l border-[var(--border-glass)]">
                          <DataSubGrid actions={flash?.total?.actions} tokens={flash?.total?.tokens} cost={flash?.total?.cost} accent="text-emerald-400" />
                        </div>
                        <div className="col-span-2 text-right pr-4">
                          <div className="flex flex-col items-end">
                            <span className="text-lg font-bold text-[var(--text-primary)] font-[family-name:var(--font-outfit)] tracking-tighter">{formatCost(grandTotal.cost)}</span>
                            <span className="text-[9px] text-zinc-500 font-bold uppercase">{formatTokens(grandTotal.tokens)} tokens</span>
                          </div>
                        </div>
                      </div>
                      {isExpanded && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                          className="bg-black/60 border-t border-[var(--border-glass)] px-6 py-6 overflow-hidden">
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
            <div className="p-4 text-center border-t border-[var(--border-glass)]">
              <button onClick={() => setVisibleUsers(v => v + 20)} className="text-[var(--text-primary)] text-xs font-bold uppercase tracking-widest hover:opacity-80">
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
        <p className="text-zinc-500">Authentification requise.</p>
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
  draft: "bg-zinc-500/20 text-zinc-300", awaiting_payment: "bg-amber-500/20 text-amber-300",
  payment_submitted: "bg-blue-500/20 text-blue-300", payment_verified: "bg-emerald-500/20 text-emerald-300",
  awaiting_flare_page_admin_access: "bg-amber-500/20 text-amber-300",
  queued_for_activation: "bg-blue-500/20 text-blue-300", activation_in_progress: "bg-orange-500/20 text-orange-300",
  testing: "bg-purple-500/20 text-purple-300", active: "bg-emerald-500/20 text-emerald-300",
  blocked: "bg-red-500/20 text-red-300", rejected: "bg-red-500/20 text-red-300", canceled: "bg-zinc-500/20 text-zinc-400",
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
  const [noteText, setNoteText] = useState("");
  const [assignEmail, setAssignEmail] = useState("");
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");

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
    } catch (e) { alert(e instanceof Error ? e.message : "Erreur"); }
    setActionBusy(null);
  };

  const handleAssign = async (id: string) => {
    if (!assignEmail.trim()) return;
    setActionBusy(id);
    try {
      await adminAssignActivation(id, assignEmail.trim(), token);
      setAssignEmail("");
      await load();
    } catch (e) { alert(e instanceof Error ? e.message : "Erreur"); }
    setActionBusy(null);
  };

  const handleAddNote = async (id: string) => {
    if (!noteText.trim()) return;
    setActionBusy(id);
    try {
      await adminAddActivationNote(id, noteText.trim(), token);
      setNoteText("");
      await load();
    } catch (e) { alert(e instanceof Error ? e.message : "Erreur"); }
    setActionBusy(null);
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-10 bg-[var(--background)]">
      <div className="flex items-center gap-3 mb-8">
        <button onClick={onBack} className="p-2 rounded-xl hover:bg-[var(--bg-hover)] transition-colors">
          <ChevronLeft size={20} className="text-[var(--text-muted)]" />
        </button>
        <Rocket size={24} className="text-orange-400" />
        <h2 className="text-xl font-bold text-[var(--text-primary)]">Activations</h2>
        <button onClick={() => { setLoading(true); load(); }} className="ml-auto p-2 rounded-xl hover:bg-[var(--bg-hover)]">
          <RefreshCcw size={16} className={`text-[var(--text-muted)] ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap gap-2 mb-6">
        {["all", "payment_submitted", "payment_verified", "queued_for_activation", "activation_in_progress", "testing", "active", "blocked", "rejected"].map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${statusFilter === s ? "bg-orange-500/20 text-orange-300 border border-orange-500/30" : "bg-[var(--bg-hover)] text-[var(--text-muted)] border border-transparent hover:border-[var(--border-glass)]"}`}>
            {s === "all" ? "Toutes" : ACTIVATION_STATUS_LABELS[s] || s}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-4">{[1,2,3].map(i => <div key={i} className="h-24 rounded-2xl bg-[var(--bg-hover)] animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-[var(--text-muted)]">
          <Rocket size={48} className="mx-auto mb-4 opacity-30" />
          <p>Aucune activation {statusFilter !== "all" ? "avec ce statut" : ""}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(ar => {
            const expanded = expandedId === ar.id;
            const nextStatuses = VALID_NEXT_STATUSES[ar.status] || [];
            return (
              <motion.div key={ar.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl border border-[var(--border-glass)] bg-[var(--bg-card)] overflow-hidden">
                <button onClick={() => setExpandedId(expanded ? null : ar.id)}
                  className="w-full p-4 flex items-center gap-4 text-left hover:bg-[var(--bg-hover)] transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-[var(--text-primary)] truncate">{ar.business_name || ar.organization_slug}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${ACTIVATION_STATUS_COLORS[ar.status] || "bg-zinc-500/20 text-zinc-300"}`}>
                        {ACTIVATION_STATUS_LABELS[ar.status] || ar.status}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[var(--bg-hover)] text-[var(--text-muted)]">
                        {ar.selected_plan_id}
                      </span>
                    </div>
                    <p className="text-xs text-[var(--text-muted)] mt-1 truncate">
                      {ar.contact_full_name} &middot; {ar.contact_email || ar.contact_phone || "-"} &middot; {ar.requested_at ? new Date(ar.requested_at).toLocaleDateString("fr-FR") : "-"}
                    </p>
                  </div>
                  {ar.assigned_operator_email && (
                    <span className="text-[10px] bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded-full">{ar.assigned_operator_email}</span>
                  )}
                  <ChevronDown size={16} className={`text-[var(--text-muted)] transition-transform ${expanded ? "rotate-180" : ""}`} />
                </button>

                <AnimatePresence>
                  {expanded && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                      className="border-t border-[var(--border-glass)]">
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
                            ["Page Facebook", ar.facebook_page_name],
                            ["URL Page", ar.facebook_page_url],
                            ["Admin FB", ar.facebook_admin_email],
                            ["Bot", ar.bot_name],
                            ["Langue", ar.primary_language],
                            ["Ton", ar.tone],
                            ["Admin FLARE confirme", ar.flare_page_admin_confirmed === "true" ? "Oui" : "Non"],
                            ["Raison blocage", ar.blocked_reason || "-"],
                          ].filter(([, v]) => v && v !== "-").map(([label, val]) => (
                            <div key={label as string} className="flex justify-between gap-2">
                              <span className="text-[var(--text-muted)]">{label}</span>
                              <span className="text-[var(--text-primary)] text-right truncate max-w-[60%]">{val}</span>
                            </div>
                          ))}
                        </div>

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
                          <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--text-muted)]">Checklist operateur</p>
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
                                <span className={`text-[11px] font-medium ${item.done ? "text-orange-500" : "text-[var(--text-muted)]"}`}>
                                  {item.done ? "OK" : "A faire"}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Status actions */}
                        {nextStatuses.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider self-center mr-2">Transition &rarr;</span>
                            {nextStatuses.map(ns => (
                              <button key={ns} onClick={() => handleSetStatus(ar.id, ns)}
                                disabled={actionBusy === ar.id}
                                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                                  ns === "active" ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/30" :
                                  ns === "blocked" || ns === "rejected" || ns === "canceled" ? "bg-red-500/20 text-red-300 border-red-500/30 hover:bg-red-500/30" :
                                  "bg-blue-500/20 text-blue-300 border-blue-500/30 hover:bg-blue-500/30"
                                }`}>
                                {ACTIVATION_STATUS_LABELS[ns] || ns}
                              </button>
                            ))}
                          </div>
                        )}

                        {/* Assign operator */}
                        <div className="flex gap-2">
                          <input value={assignEmail} onChange={e => setAssignEmail(e.target.value)} placeholder="Email operateur..."
                            className="flex-1 bg-[var(--bg-hover)] border border-[var(--border-glass)] rounded-lg px-3 py-2 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)]" />
                          <button onClick={() => handleAssign(ar.id)} disabled={actionBusy === ar.id || !assignEmail.trim()}
                            className="px-3 py-2 rounded-lg text-xs font-medium bg-purple-500/20 text-purple-300 border border-purple-500/30 hover:bg-purple-500/30 disabled:opacity-40">
                            Assigner
                          </button>
                        </div>

                        {/* Add note */}
                        <div className="flex gap-2">
                          <input value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="Ajouter une note..."
                            className="flex-1 bg-[var(--bg-hover)] border border-[var(--border-glass)] rounded-lg px-3 py-2 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)]" />
                          <button onClick={() => handleAddNote(ar.id)} disabled={actionBusy === ar.id || !noteText.trim()}
                            className="px-3 py-2 rounded-lg text-xs font-medium bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30 disabled:opacity-40">
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
  const [rejectReason, setRejectReason] = useState("");
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("all");

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
    } catch (e) { alert(e instanceof Error ? e.message : "Erreur"); }
    setActionBusy(null);
  };

  const handleReject = async (id: string) => {
    if (!rejectReason.trim()) { alert("Raison requise"); return; }
    setActionBusy(id);
    try {
      await adminRejectPayment(id, rejectReason.trim(), token);
      setRejectingId(null);
      setRejectReason("");
      await load();
    } catch (e) { alert(e instanceof Error ? e.message : "Erreur"); }
    setActionBusy(null);
  };

  const paymentStatusColor = (s: string) => {
    if (s === "submitted") return "bg-blue-500/20 text-blue-300";
    if (s === "verified") return "bg-emerald-500/20 text-emerald-300";
    if (s === "rejected") return "bg-red-500/20 text-red-300";
    return "bg-zinc-500/20 text-zinc-300";
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-10 bg-[var(--background)]">
      <div className="flex items-center gap-3 mb-8">
        <button onClick={onBack} className="p-2 rounded-xl hover:bg-[var(--bg-hover)] transition-colors">
          <ChevronLeft size={20} className="text-[var(--text-muted)]" />
        </button>
        <CreditCard size={24} className="text-violet-400" />
        <h2 className="text-xl font-bold text-[var(--text-primary)]">Paiements</h2>
        <button onClick={() => { setLoading(true); load(); }} className="ml-auto p-2 rounded-xl hover:bg-[var(--bg-hover)]">
          <RefreshCcw size={16} className={`text-[var(--text-muted)] ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        {["all", "submitted", "verified", "rejected"].map(s => (
          <button key={s} onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filter === s ? "bg-violet-500/20 text-violet-300 border border-violet-500/30" : "bg-[var(--bg-hover)] text-[var(--text-muted)] border border-transparent hover:border-[var(--border-glass)]"}`}>
            {s === "all" ? "Tous" : s === "submitted" ? "A verifier" : s === "verified" ? "Verifies" : "Refuses"}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-4">{[1,2,3].map(i => <div key={i} className="h-20 rounded-2xl bg-[var(--bg-hover)] animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-[var(--text-muted)]">
          <CreditCard size={48} className="mx-auto mb-4 opacity-30" />
          <p>Aucun paiement {filter !== "all" ? "avec ce statut" : ""}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((pay: any) => (
            <motion.div key={pay.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border border-[var(--border-glass)] bg-[var(--bg-card)] p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-semibold text-sm text-[var(--text-primary)]">{pay.payer_full_name || "Inconnu"}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${paymentStatusColor(pay.status)}`}>
                      {pay.status === "submitted" ? "A verifier" : pay.status === "verified" ? "Verifie" : pay.status === "rejected" ? "Refuse" : pay.status}
                    </span>
                    <span className="text-[10px] text-[var(--text-muted)] bg-[var(--bg-hover)] px-2 py-0.5 rounded-full">{pay.method_code}</span>
                  </div>
                  <p className="text-xs text-[var(--text-muted)]">
                    Ref: <span className="text-[var(--text-primary)] font-mono">{pay.transaction_reference || "-"}</span>
                    {pay.amount ? ` \u00b7 ${pay.amount} ${pay.currency || ""}` : ""}
                    {pay.payer_phone ? ` \u00b7 ${pay.payer_phone}` : ""}
                  </p>
                  <p className="text-[10px] text-[var(--text-muted)] mt-1">
                    Soumis : {pay.submitted_at ? new Date(pay.submitted_at).toLocaleString("fr-FR") : "-"}
                    {pay.organization_scope_id ? ` \u00b7 ${pay.organization_scope_id}` : ""}
                  </p>
                  {pay.activation_summary ? (
                    <div className="mt-3 rounded-xl border border-[var(--border-default)] bg-[var(--surface-base)] px-3 py-3">
                      <p className="text-xs font-semibold text-[var(--text-primary)]">
                        {pay.activation_summary.business_name || pay.activation_summary.contact_full_name || "Demande liee"}
                      </p>
                      <p className="mt-1 text-[11px] text-[var(--text-muted)]">
                        {pay.activation_summary.contact_email || "-"}
                        {pay.activation_summary.contact_phone ? ` · ${pay.activation_summary.contact_phone}` : ""}
                        {pay.activation_summary.contact_whatsapp ? ` · WhatsApp ${pay.activation_summary.contact_whatsapp}` : ""}
                      </p>
                      <p className="mt-1 text-[11px] text-[var(--text-muted)]">
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
                      className="inline-flex items-center gap-1 mt-2 text-xs text-blue-400 hover:text-blue-300">
                      <Eye size={12} /> Voir la preuve
                    </a>
                  )}
                  {pay.activation_summary && (
                    <div className="mt-3 rounded-xl border border-[var(--border-default)] bg-[var(--surface-subtle)] px-3 py-3">
                      <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--text-muted)]">Handoff activation</p>
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
                      className="px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30 disabled:opacity-40 flex items-center gap-1">
                      <CheckCircle2 size={12} /> Valider
                    </button>
                    {rejectingId === pay.id ? (
                      <div className="flex flex-col gap-1">
                        <input value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="Raison du refus..."
                          className="bg-[var(--bg-hover)] border border-[var(--border-glass)] rounded-lg px-2 py-1 text-xs text-[var(--text-primary)] w-40" />
                        <div className="flex gap-1">
                          <button onClick={() => handleReject(pay.id)} disabled={actionBusy === pay.id}
                            className="flex-1 px-2 py-1 rounded-lg text-[10px] font-medium bg-red-500/20 text-red-300 border border-red-500/30 hover:bg-red-500/30 disabled:opacity-40">
                            Confirmer
                          </button>
                          <button onClick={() => { setRejectingId(null); setRejectReason(""); }}
                            className="px-2 py-1 rounded-lg text-[10px] text-[var(--text-muted)] hover:bg-[var(--bg-hover)]">
                            Annuler
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button onClick={() => setRejectingId(pay.id)}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium bg-red-500/20 text-red-300 border border-red-500/30 hover:bg-red-500/30 flex items-center gap-1">
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
    } catch (e) { alert(e instanceof Error ? e.message : "Erreur"); }
    setActionBusy(null);
  };

  const orderStatusColor = (s: string) => {
    const m: Record<string, string> = { new: "bg-blue-500/20 text-blue-300", confirmed: "bg-emerald-500/20 text-emerald-300", delivered: "bg-emerald-500/20 text-emerald-300", cancelled: "bg-red-500/20 text-red-300", needs_followup: "bg-amber-500/20 text-amber-300" };
    return m[s] || "bg-zinc-500/20 text-zinc-300";
  };
  const orderStatusLabel = (s: string) => {
    const m: Record<string, string> = { new: "Nouvelle", confirmed: "Confirmee", delivered: "Livree", cancelled: "Annulee", needs_followup: "A suivre" };
    return m[s] || s;
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-10 bg-[var(--background)]">
      <div className="flex items-center gap-3 mb-8">
        <button onClick={onBack} className="p-2 rounded-xl hover:bg-[var(--bg-hover)] transition-colors">
          <ChevronLeft size={20} className="text-[var(--text-muted)]" />
        </button>
        <ShoppingBag size={24} className="text-cyan-400" />
        <h2 className="text-xl font-bold text-[var(--text-primary)]">Commandes (tous clients)</h2>
        <button onClick={() => { setLoading(true); load(); }} className="ml-auto p-2 rounded-xl hover:bg-[var(--bg-hover)]">
          <RefreshCcw size={16} className={`text-[var(--text-muted)] ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        {["all", "new", "confirmed", "needs_followup", "delivered", "cancelled"].map(s => (
          <button key={s} onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filter === s ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30" : "bg-[var(--bg-hover)] text-[var(--text-muted)] border border-transparent hover:border-[var(--border-glass)]"}`}>
            {s === "all" ? "Toutes" : orderStatusLabel(s)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-4">{[1,2,3].map(i => <div key={i} className="h-20 rounded-2xl bg-[var(--bg-hover)] animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-[var(--text-muted)]">
          <ShoppingBag size={48} className="mx-auto mb-4 opacity-30" />
          <p>Aucune commande {filter !== "all" ? "avec ce statut" : ""}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(order => (
            <motion.div key={order.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border border-[var(--border-glass)] bg-[var(--bg-card)] p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-semibold text-sm text-[var(--text-primary)]">{order.contact_name || "Contact inconnu"}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${orderStatusColor(order.status)}`}>
                      {orderStatusLabel(order.status)}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${order.source === "signal" ? "bg-purple-500/20 text-purple-300" : "bg-zinc-500/20 text-zinc-300"}`}>
                      {order.source === "signal" ? "Signal IA" : "Manuel"}
                    </span>
                    <span className="text-[10px] text-[var(--text-muted)] bg-[var(--bg-hover)] px-2 py-0.5 rounded-full">{order.page_name || order.organization_slug}</span>
                  </div>
                  <p className="text-xs text-[var(--text-primary)] mt-1">{order.product_summary || "-"}</p>
                  <p className="text-[10px] text-[var(--text-muted)] mt-1">
                    {order.quantity_text ? `Qte: ${order.quantity_text}` : ""}
                    {order.amount_text ? ` \u00b7 ${order.amount_text}` : ""}
                    {order.contact_phone ? ` \u00b7 ${order.contact_phone}` : ""}
                    {order.delivery_address ? ` \u00b7 ${order.delivery_address}` : ""}
                  </p>
                  {order.customer_request_text && (
                    <p className="text-[10px] text-[var(--text-muted)] mt-1 italic">"{order.customer_request_text}"</p>
                  )}
                  <p className="text-[10px] text-[var(--text-muted)] mt-1">
                    {order.created_at ? new Date(order.created_at).toLocaleString("fr-FR") : "-"}
                    {order.source === "signal" && order.confidence > 0 ? ` \u00b7 Confiance: ${Math.round(order.confidence * 100)}%` : ""}
                  </p>
                </div>

                <div className="flex flex-col gap-1 flex-shrink-0">
                  {["new", "needs_followup"].includes(order.status) && (
                    <button onClick={() => handleUpdateStatus(order.id, "confirmed")} disabled={actionBusy === order.id}
                      className="px-2 py-1 rounded-lg text-[10px] font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30 disabled:opacity-40">
                      Confirmer
                    </button>
                  )}
                  {order.status === "confirmed" && (
                    <button onClick={() => handleUpdateStatus(order.id, "delivered")} disabled={actionBusy === order.id}
                      className="px-2 py-1 rounded-lg text-[10px] font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30 disabled:opacity-40">
                      Livree
                    </button>
                  )}
                  {!["cancelled", "delivered"].includes(order.status) && (
                    <>
                      <button onClick={() => handleUpdateStatus(order.id, "needs_followup")} disabled={actionBusy === order.id}
                        className="px-2 py-1 rounded-lg text-[10px] font-medium bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30 disabled:opacity-40">
                        A suivre
                      </button>
                      <button onClick={() => handleUpdateStatus(order.id, "cancelled")} disabled={actionBusy === order.id}
                        className="px-2 py-1 rounded-lg text-[10px] font-medium bg-red-500/20 text-red-300 border border-red-500/30 hover:bg-red-500/30 disabled:opacity-40">
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
