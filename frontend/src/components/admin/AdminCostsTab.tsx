"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Users, DollarSign, RefreshCcw, Search, ChevronDown, ChevronRight,
  Brain, Zap, MessageSquare, Globe, Microscope, ImageIcon, Video,
  ArrowUpDown, BookOpen, AlertCircle, FileText, FileSpreadsheet,
} from "lucide-react";
import {
  getAdminUsageSummary, syncAdminUsers, getAdminUsageLedger, backfillAdminUsage,
} from "@/lib/api";
import AdminShell from "./AdminShell";

// ── Types ──────────────────────────────────────────────────
interface ActionBreakdown { actions: number; tokens: number; cost: number }
interface ModelBreakdown {
  total: ActionBreakdown;
  by_action: Record<string, ActionBreakdown>;
}
interface UserCostData {
  user_id: string; email: string; plan: string;
  models: Record<string, ModelBreakdown>;
  grand_total: { tokens: number; cost: number };
  last_active: string; last_model: string;
}
interface SummaryResponse { total_users: number; total_cost: number; users: UserCostData[] }
interface LedgerEntry { id: number; user_email: string; model: string; action: string; tokens: number; cost: number; timestamp: string }

// ── Helpers ─────────────────────────────────────────────────
function fmt$(val: any): string {
  if (!val || isNaN(Number(val))) return "$0.00";
  const n = Number(val);
  if (n < 0.0001 && n > 0) return "< $0.0001";
  return `$${n.toFixed(4)}`;
}
function fmtTok(v: any): string {
  if (!v || isNaN(Number(v))) return "0";
  const n = Number(v);
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return Math.floor(n).toString();
}
function timeAgo(iso: string): string {
  if (!iso) return "—";
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return "à l'instant";
    if (m < 60) return `il y a ${m}min`;
    const h = Math.floor(m / 60);
    if (h < 24) return `il y a ${h}h`;
    return `il y a ${Math.floor(h / 24)}j`;
  } catch { return "—"; }
}

const ACTION_META = [
  { key: "message",       emoji: "MSG", label: "Messages" },
  { key: "research",      emoji: "WEB", label: "Recherche" },
  { key: "deep_research", emoji: "LAB", label: "Deep Research" },
  { key: "image_gen",     emoji: "IMG", label: "Image Gen" },
  { key: "video_gen",     emoji: "VID", label: "Video Gen" },
  { key: "doc_gen",       emoji: "DOC", label: "Documents" },
  { key: "sheet_gen",     emoji: "XLS", label: "Tableurs" },
];

// ── Sub-components ───────────────────────────────────────────
function DataCell({ actions, tokens, cost }: { actions?: number; tokens?: number; cost?: number }) {
  return (
    <div className="grid grid-cols-3 gap-1 items-center">
      <span className="text-center text-[10px] text-[var(--text-secondary)]">{actions ?? 0}</span>
      <span className="text-right text-[10px] text-[var(--text-secondary)]">{fmtTok(tokens)}</span>
      <span className="text-right text-[10px] font-bold text-[var(--text-primary)]">{fmt$(cost)}</span>
    </div>
  );
}

// ── Main tab ─────────────────────────────────────────────────
export default function AdminCostsTab({ token, onBack }: { token: string; onBack: () => void }) {
  const [data, setData] = useState<SummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [days, setDays] = useState(0);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [countdown, setCountdown] = useState(30);
  const [ledger, setLedger] = useState<LedgerEntry[] | null>(null);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [sort, setSort] = useState({ key: "cost", asc: false });
  const [visible, setVisible] = useState(20);
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null);
  const [backfilled, setBackfilled] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      if (!backfilled) { try { await backfillAdminUsage(token); setBackfilled(true); } catch {} }
      const res = await getAdminUsageSummary(token, days);
      setData(res?.users ? res : { total_users: 0, total_cost: 0, users: [] });
    } catch (e: any) {
      setError(`Impossible de charger les données. (${e?.message ?? "erreur réseau"})`);
    } finally { setLoading(false); }
  }, [token, days, backfilled]);

  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => {
    if (!autoRefresh) return;
    const t = setInterval(() => setCountdown(p => { if (p <= 1) { refresh(); return 30; } return p - 1; }), 1000);
    return () => clearInterval(t);
  }, [autoRefresh, refresh]);

  const toggleUser = (id: string) =>
    setExpanded(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const sorted = useMemo(() => {
    const f = (data?.users ?? []).filter(u => {
      const q = search.toLowerCase();
      return !q || u.email?.toLowerCase().includes(q) || u.user_id?.toLowerCase().includes(q);
    });
    return [...f].sort((a, b) => {
      if (sort.key === "cost") return sort.asc ? a.grand_total.cost - b.grand_total.cost : b.grand_total.cost - a.grand_total.cost;
      if (sort.key === "tokens") return sort.asc ? a.grand_total.tokens - b.grand_total.tokens : b.grand_total.tokens - a.grand_total.tokens;
      if (sort.key === "email") return sort.asc ? (a.email ?? "").localeCompare(b.email ?? "") : (b.email ?? "").localeCompare(a.email ?? "");
      return 0;
    });
  }, [data, search, sort]);

  const syncFB = async () => {
    setLoading(true);
    try {
      const res = await syncAdminUsers(token);
      setToast({ ok: true, msg: (res as any).message ?? "Synchronisation Firebase terminée." });
      refresh();
    } catch { setToast({ ok: false, msg: "Erreur lors de la synchronisation Firebase." }); }
    setLoading(false);
  };

  const toggleLedger = async () => {
    if (ledger) { setLedger(null); return; }
    setLedgerLoading(true);
    try { setLedger(await getAdminUsageLedger(token) as any ?? []); }
    catch { setError("Impossible de charger le journal."); }
    setLedgerLoading(false);
  };

  const users = data?.users ?? [];
  const totalG3 = users.reduce((s, u) => s + (u.models?.["gemini-3-pro"]?.total?.cost ?? 0), 0);
  const totalFlash = users.reduce((s, u) => s + (u.models?.["gemini-3-flash"]?.total?.cost ?? 0), 0);
  const totalTok = users.reduce((s, u) => s + (u.grand_total?.tokens ?? 0), 0);

  const periodActions = (key: string) =>
    users.reduce((s, u) => {
      const pro = u.models?.["gemini-3-pro"]?.by_action?.[key]?.actions ?? 0;
      const flash = u.models?.["gemini-3-flash"]?.by_action?.[key]?.actions ?? 0;
      return s + pro + flash;
    }, 0);

  if (loading && !data) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[rgb(var(--background))]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-[var(--border-default)] border-t-orange-500 rounded-full animate-spin" />
          <p className="text-xs text-[var(--text-secondary)]">Chargement Cost Intelligence…</p>
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="flex-1 flex items-center justify-center p-10 text-center bg-[rgb(var(--background))]">
        <div className="max-w-md">
          <AlertCircle size={48} className="text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-[var(--text-primary)] mb-2">Erreur de chargement</h2>
          <p className="text-sm text-[var(--text-secondary)] mb-6">{error}</p>
          <button onClick={refresh} className="rounded-xl bg-orange-500 px-6 py-3 text-sm font-bold text-white">Réessayer</button>
        </div>
      </div>
    );
  }

  return (
    <AdminShell
      title="Cost Intelligence"
      description="FLARE AI — Admin Engine"
      icon={DollarSign}
      onBack={onBack}
      live={autoRefresh}
      liveLabel={`Live (${countdown}s)`}
      loading={loading}
      onRefresh={refresh}
      actions={
        <>
          <button
            onClick={() => setAutoRefresh(p => !p)}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs transition-all ${autoRefresh ? "border-orange-500/25 bg-orange-500/10 text-orange-500" : "bg-[var(--surface-subtle)] border-[var(--border-default)] text-[var(--text-secondary)]"}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${autoRefresh ? "bg-orange-500 animate-pulse" : "bg-[var(--border-default)]"}`} />
            {autoRefresh ? `Live (${countdown}s)` : "Pausé"}
          </button>
          <div className="flex bg-[var(--surface-subtle)] border border-[var(--border-default)] rounded-xl p-0.5">
            {[{ l: "1J", v: 1 }, { l: "7J", v: 7 }, { l: "30J", v: 30 }, { l: "ALL", v: 0 }].map(o => (
              <button key={o.v} onClick={() => setDays(o.v)}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ${days === o.v ? "bg-[var(--text-primary)] text-[rgb(var(--background))]" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"}`}>
                {o.l}
              </button>
            ))}
          </div>
          <button onClick={syncFB} disabled={loading}
            className="flex items-center gap-2 rounded-xl border border-[var(--accent-navy)]/25 bg-[var(--accent-navy)]/8 px-3 py-2 text-xs font-bold text-[var(--accent-navy)] hover:bg-[var(--accent-navy)]/14 disabled:opacity-50">
            <Users size={13} /> Sync Firebase
          </button>
          <button onClick={toggleLedger} disabled={ledgerLoading}
            className="flex items-center gap-2 rounded-xl border border-[var(--border-default)] bg-[var(--surface-raised)] px-3 py-2 text-xs font-bold text-[var(--text-primary)] hover:bg-[var(--surface-overlay)] disabled:opacity-50">
            <BookOpen size={13} /> {ledger ? "Masquer" : "Journal"}
          </button>
        </>
      }
    >
      {toast && (
        <div className={`mb-4 rounded-xl border px-4 py-3 text-sm ${toast.ok ? "border-orange-500/25 bg-orange-500/10" : "border-red-500/25 bg-red-500/10"} text-[var(--text-primary)]`}>
          {toast.msg}
        </div>
      )}

      {/* KPI row 1 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        {[
          { label: "Utilisateurs", val: data?.total_users ?? 0, sub: "Comptes actifs", icon: Users },
          { label: "Gemini 3 Pro", val: fmt$(totalG3), sub: "Coût Raisonnement", icon: Brain },
          { label: "Gemini 3 Flash", val: fmt$(totalFlash), sub: "Coût Vitesse", icon: Zap },
          { label: "Total Google Cloud", val: fmt$(data?.total_cost ?? 0), sub: `${fmtTok(totalTok)} tokens`, icon: DollarSign },
        ].map((k, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
            className="p-5 rounded-[24px] bg-[var(--bg-card)] border border-[var(--border-default)]">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--text-secondary)]">{k.label}</span>
              <k.icon size={14} className="text-[var(--text-secondary)]" />
            </div>
            <p className="text-xl font-bold text-[var(--text-primary)] font-mono">{k.val}</p>
            <p className="text-[11px] text-[var(--text-secondary)] mt-1">{k.sub}</p>
          </motion.div>
        ))}
      </div>

      {/* KPI row 2 — actions */}
      <div className="grid grid-cols-3 lg:grid-cols-6 gap-3 mb-10">
        {[
          { label: "Messages", key: "message", icon: MessageSquare },
          { label: "Recherches", key: "research", icon: Globe },
          { label: "Deep R.", key: "deep_research", icon: Microscope },
          { label: "Images", key: "image_gen", icon: ImageIcon },
          { label: "Docs", key: "doc_gen", icon: FileText },
          { label: "Tableurs", key: "sheet_gen", icon: FileSpreadsheet },
        ].map((k, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 + i * 0.04 }}
            className="p-4 rounded-[20px] bg-[var(--bg-card)] border border-[var(--border-default)] flex items-center gap-3">
            <k.icon size={18} className="text-[var(--text-secondary)] shrink-0" />
            <div>
              <p className="text-[10px] text-[var(--text-secondary)]">{k.label}</p>
              <p className="text-base font-bold text-[var(--text-primary)] font-mono">{periodActions(k.key)}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Users table */}
      <div className="bg-[var(--bg-card)] border border-[var(--border-default)] rounded-[28px] overflow-hidden shadow-[var(--shadow-card)]">
        {/* Table toolbar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-default)]">
          <div className="relative">
            <Search size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" />
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder={`Rechercher parmi ${sorted.length} utilisateurs…`}
              className="w-72 rounded-xl border border-[var(--border-default)] bg-[var(--surface-subtle)] py-2 pl-9 pr-4 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:outline-none focus:border-[var(--border-subtle)]"
            />
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setSort(s => ({ ...s, asc: !s.asc }))}
              className="p-2 rounded-xl bg-[var(--surface-subtle)] border border-[var(--border-default)] text-[var(--text-primary)]">
              <ArrowUpDown size={13} className={sort.asc ? "" : "rotate-180"} />
            </button>
            <div className="flex bg-[var(--surface-subtle)] border border-[var(--border-default)] rounded-xl p-0.5">
              {[{ k: "cost", l: "Coût" }, { k: "tokens", l: "Tokens" }, { k: "email", l: "Email" }].map(o => (
                <button key={o.k} onClick={() => setSort(s => ({ ...s, key: o.k }))}
                  className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all ${sort.key === o.k ? "bg-[var(--text-primary)] text-[rgb(var(--background))]" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"}`}>
                  {o.l}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Header row */}
        <div className="grid grid-cols-12 gap-0 border-b border-[var(--border-default)] bg-[var(--surface-subtle)] px-6 py-2">
          <div className="col-span-4 text-[9px] font-bold uppercase tracking-[0.08em] text-[var(--text-secondary)]">Utilisateur</div>
          <div className="col-span-3 text-center border-x border-[var(--border-default)] text-[9px] font-bold uppercase tracking-[0.08em] text-[var(--text-secondary)]">Gemini 3 Pro</div>
          <div className="col-span-3 text-center text-[9px] font-bold uppercase tracking-[0.08em] text-[var(--text-secondary)]">Gemini 3 Flash</div>
          <div className="col-span-2 text-right text-[9px] font-bold uppercase tracking-[0.08em] text-[var(--text-secondary)]">Grand Total</div>
        </div>

        {/* Rows */}
        <div className="divide-y divide-[var(--border-faint)]">
          {sorted.slice(0, visible).map((user, idx) => {
            const isExpanded = expanded.has(user.user_id);
            const email = user.email || (user.user_id?.startsWith("anonymous") ? "Anonyme" : "Email inconnu");
            const g3 = user.models?.["gemini-3-pro"];
            const flash = user.models?.["gemini-3-flash"];
            const online = user.last_active && (Date.now() - new Date(user.last_active).getTime() < 180000);
            return (
              <div key={user.user_id ?? idx} className="group">
                <div
                  onClick={() => toggleUser(user.user_id)}
                  className={`grid grid-cols-12 gap-0 px-6 py-4 items-center cursor-pointer transition-all ${isExpanded ? "bg-[var(--bg-active)]" : "hover:bg-[var(--surface-subtle)]"}`}
                >
                  <div className="col-span-4 flex items-center gap-3 min-w-0 pr-4">
                    <div className="relative shrink-0">
                      <div className="w-9 h-9 rounded-full bg-[var(--surface-raised)] border border-[var(--border-default)] flex items-center justify-center text-[var(--text-primary)] font-bold text-sm">
                        {email.charAt(0).toUpperCase()}
                      </div>
                      {online && <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-orange-500 border-2 border-[var(--bg-card)] rounded-full animate-pulse" />}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        {isExpanded ? <ChevronDown size={12} className="text-[var(--text-primary)] shrink-0" /> : <ChevronRight size={12} className="text-[var(--text-secondary)] shrink-0" />}
                        <span className="text-[13px] font-semibold text-[var(--text-primary)] truncate">{email}</span>
                      </div>
                      <span className="text-[10px] text-[var(--text-secondary)] truncate block pl-4 opacity-60">{user.user_id}</span>
                    </div>
                  </div>
                  <div className="col-span-3 px-3 border-l border-[var(--border-default)]">
                    <DataCell actions={g3?.total?.actions} tokens={g3?.total?.tokens} cost={g3?.total?.cost} />
                  </div>
                  <div className="col-span-3 px-3 border-l border-[var(--border-default)]">
                    <DataCell actions={flash?.total?.actions} tokens={flash?.total?.tokens} cost={flash?.total?.cost} />
                  </div>
                  <div className="col-span-2 text-right pr-2">
                    <p className="text-base font-bold text-[var(--text-primary)] font-mono">{fmt$(user.grand_total?.cost)}</p>
                    <p className="text-[9px] text-[var(--text-secondary)] font-bold uppercase">{fmtTok(user.grand_total?.tokens)} tok</p>
                  </div>
                </div>

                {isExpanded && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} className="bg-[var(--surface-subtle)] border-t border-[var(--border-default)] px-6 py-5 overflow-hidden">
                    <p className="text-[10px] uppercase font-bold tracking-[0.18em] text-[var(--text-secondary)] mb-3">Breakdown analytique</p>
                    <div className="space-y-1">
                      {ACTION_META.map(am => {
                        const g3a = g3?.by_action?.[am.key];
                        const fa = flash?.by_action?.[am.key];
                        return (
                          <div key={am.key} className="grid grid-cols-12 gap-0 py-1.5 border-b border-[var(--border-faint)] last:border-0 -mx-2 px-2 rounded hover:bg-[var(--surface-raised)] transition-colors">
                            <div className="col-span-3 flex items-center gap-2">
                              <span className="flex h-5 w-5 items-center justify-center rounded-md border border-[var(--border-default)] bg-[var(--bg-card)] text-[11px]">{am.emoji}</span>
                              <span className="text-[11px] font-medium text-[var(--text-secondary)]">{am.label}</span>
                            </div>
                            <div className="col-span-3 border-l border-[var(--border-default)] px-2">
                              <DataCell actions={g3a?.actions} tokens={g3a?.tokens} cost={g3a?.cost} />
                            </div>
                            <div className="col-span-3 border-l border-[var(--border-default)] px-2">
                              <DataCell actions={fa?.actions} tokens={fa?.tokens} cost={fa?.cost} />
                            </div>
                            <div className="col-span-3 text-right">
                              <span className="text-[11px] font-bold text-[var(--text-primary)] font-mono">{fmt$((g3a?.cost ?? 0) + (fa?.cost ?? 0))}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </div>
            );
          })}
        </div>

        {sorted.length > visible && (
          <div className="p-4 text-center border-t border-[var(--border-default)]">
            <button onClick={() => setVisible(v => v + 20)} className="text-[var(--text-primary)] text-xs font-bold hover:opacity-70">
              Afficher plus ({sorted.length - visible} restants)
            </button>
          </div>
        )}
      </div>

      {/* Ledger */}
      {ledger && (
        <div className="mt-8 bg-[var(--bg-card)] border border-[var(--border-default)] rounded-[24px] overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-default)]">
            <h3 className="text-base font-bold text-[var(--text-primary)]">Journal des transactions</h3>
            {ledgerLoading && <div className="w-4 h-4 border-2 border-[var(--border-default)] border-t-orange-500 rounded-full animate-spin" />}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-[var(--surface-subtle)]">
                  {["Date", "Utilisateur", "Action", "Modèle", "Tokens", "Coût"].map(h => (
                    <th key={h} className="px-4 py-2 text-[9px] font-bold uppercase tracking-[0.08em] text-[var(--text-secondary)] text-left first:pl-6 last:pr-6 last:text-right">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-faint)]">
                {ledger.map(e => (
                  <tr key={e.id} className="hover:bg-[var(--surface-subtle)] transition-colors">
                    <td className="px-4 py-3 text-[11px] text-[var(--text-secondary)] whitespace-nowrap first:pl-6">{timeAgo(e.timestamp)}</td>
                    <td className="px-4 py-3 text-[11px] text-[var(--text-primary)] truncate max-w-[200px]">{e.user_email}</td>
                    <td className="px-4 py-3 text-[11px] text-[var(--text-secondary)]">{e.action}</td>
                    <td className="px-4 py-3 text-[11px] text-[var(--text-secondary)] truncate max-w-[120px]">{e.model}</td>
                    <td className="px-4 py-3 text-[11px] text-[var(--text-secondary)] text-right font-mono">{fmtTok(e.tokens)}</td>
                    <td className="px-4 py-3 text-[11px] font-bold text-[var(--text-primary)] text-right font-mono last:pr-6">{fmt$(e.cost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
