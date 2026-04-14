"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Wifi, WifiOff } from "lucide-react";
import { getAdminConnectedUsers, type ConnectedUser, type ConnectedUsersResponse } from "@/lib/api";
import AdminShell from "./AdminShell";

function timeAgo(iso: string): string {
  if (!iso) return "—";
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return "à l'instant";
    if (m < 60) return `il y a ${m}min`;
    const h = Math.floor(m / 60);
    return h < 24 ? `il y a ${h}h` : `il y a ${Math.floor(h / 24)}j`;
  } catch { return "—"; }
}
function fmtTok(v: any): string {
  if (!v) return "0";
  const n = Number(v);
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return Math.floor(n).toString();
}
function fmt$(v: any): string {
  if (!v || isNaN(Number(v))) return "$0.00";
  return `$${Number(v).toFixed(4)}`;
}

const STATUS_CONFIG: Record<string, { label: string; dot: string; text: string }> = {
  online: { label: "En ligne", dot: "bg-orange-500", text: "text-orange-500" },
  recent: { label: "Récent", dot: "bg-[var(--accent-navy)]", text: "text-[var(--accent-navy)]" },
  away: { label: "Absent", dot: "bg-[var(--border-default)]", text: "text-[var(--text-secondary)]" },
};

export default function AdminConnectedTab({ token, onBack }: { token: string; onBack: () => void }) {
  const [data, setData] = useState<ConnectedUsersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [countdown, setCountdown] = useState(15);

  const refresh = useCallback(async () => {
    setLoading(true);
    try { setData(await getAdminConnectedUsers(token)); }
    catch (e) { console.error("[Admin] connected:", e); }
    setLoading(false);
  }, [token]);

  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => {
    if (!autoRefresh) return;
    const t = setInterval(() => setCountdown(p => { if (p <= 1) { refresh(); return 15; } return p - 1; }), 1000);
    return () => clearInterval(t);
  }, [autoRefresh, refresh]);

  const kpis = [
    { label: "En ligne", val: data?.online_count ?? 0, dot: "bg-orange-500", color: "text-orange-500" },
    { label: "Récemment actifs", val: data?.recent_count ?? 0, dot: "bg-[var(--accent-navy)]", color: "text-[var(--accent-navy)]" },
    { label: "Actifs (24h)", val: data?.total_active_24h ?? 0, dot: "bg-[var(--text-secondary)]", color: "text-[var(--text-primary)]" },
  ];

  return (
    <AdminShell
      title="Utilisateurs Connectés"
      description="FLARE AI — Admin Engine"
      icon={Wifi}
      onBack={onBack}
      live={autoRefresh}
      liveLabel={`Live — rafraîchi toutes les 15s (${countdown}s)`}
      loading={loading}
      onRefresh={refresh}
      actions={
        <button
          onClick={() => setAutoRefresh(p => !p)}
          className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs transition-all ${autoRefresh ? "border-orange-500/25 bg-orange-500/10 text-orange-500" : "bg-[var(--surface-subtle)] border-[var(--border-default)] text-[var(--text-secondary)]"}`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${autoRefresh ? "bg-orange-500 animate-pulse" : "bg-[var(--border-default)]"}`} />
          {autoRefresh ? `Live (${countdown}s)` : "Pausé"}
        </button>
      }
    >
      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {kpis.map((k, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className="p-6 rounded-[24px] bg-[var(--bg-card)] border border-[var(--border-default)]">
            <div className="flex items-center gap-2 mb-3">
              <span className={`w-2 h-2 rounded-full ${k.dot} animate-pulse`} />
              <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--text-secondary)]">{k.label}</span>
            </div>
            <p className={`text-3xl font-bold font-mono ${k.color}`}>{k.val}</p>
          </motion.div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-[var(--bg-card)] border border-[var(--border-default)] rounded-[24px] overflow-hidden">
        <div className="px-6 py-4 border-b border-[var(--border-default)]">
          <h3 className="text-[13px] font-bold text-[var(--text-primary)]">Sessions Actives</h3>
        </div>

        <div className="grid grid-cols-12 gap-0 bg-[var(--surface-subtle)] px-6 py-2 border-b border-[var(--border-default)]">
          {[["col-span-4", "Utilisateur"], ["col-span-2 text-center", "Statut"], ["col-span-2 text-center", "Dernière action"], ["col-span-2 text-right", "Tokens (24h)"], ["col-span-2 text-right", "Coût (24h)"]].map(([cls, label]) => (
            <div key={label} className={`${cls} text-[9px] font-bold uppercase tracking-[0.08em] text-[var(--text-secondary)]`}>{label}</div>
          ))}
        </div>

        <div className="divide-y divide-[var(--border-faint)]">
          {!data?.users?.length ? (
            <div className="p-16 text-center">
              <WifiOff size={28} className="mx-auto mb-3 text-[var(--text-secondary)]" />
              <p className="text-xs text-[var(--text-secondary)]">Aucun utilisateur actif dans les dernières 24h</p>
            </div>
          ) : data.users.map((user: ConnectedUser, idx: number) => {
            const sc = STATUS_CONFIG[user.status] ?? STATUS_CONFIG.away;
            return (
              <motion.div key={user.user_id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: idx * 0.025 }}
                className="grid grid-cols-12 gap-0 px-6 py-4 items-center hover:bg-[var(--surface-subtle)] transition-colors">
                <div className="col-span-4 flex items-center gap-3 min-w-0">
                  <div className="relative shrink-0">
                    <div className="w-9 h-9 rounded-full bg-[var(--surface-raised)] border border-[var(--border-default)] flex items-center justify-center text-[var(--text-primary)] font-bold text-sm">
                      {(user.email || "?").charAt(0).toUpperCase()}
                    </div>
                    <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 ${sc.dot} border-2 border-[var(--bg-card)] rounded-full ${user.status === "online" ? "animate-pulse" : ""}`} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-[var(--text-primary)] truncate">{user.email}</p>
                    <p className="text-[10px] text-[var(--text-secondary)] truncate font-mono">{user.user_id} · {timeAgo(user.last_seen)}</p>
                  </div>
                </div>
                <div className="col-span-2 flex justify-center">
                  <span className={`rounded-full border border-[var(--border-default)] bg-[var(--surface-subtle)] px-3 py-1 text-[10px] font-semibold ${sc.text}`}>{sc.label}</span>
                </div>
                <div className="col-span-2 text-center text-[11px] text-[var(--text-secondary)]">{user.last_action || "—"}</div>
                <div className="col-span-2 text-right">
                  <span className="text-[12px] font-bold text-[var(--text-primary)] font-mono">{fmtTok(user.tokens_today)}</span>
                </div>
                <div className="col-span-2 text-right">
                  <span className="text-[12px] font-bold text-orange-500 font-mono">{fmt$(user.cost_today)}</span>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </AdminShell>
  );
}
