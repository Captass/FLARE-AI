"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { UserPlus } from "lucide-react";
import { getAdminNewAccounts, type NewAccountsResponse } from "@/lib/api";
import AdminShell from "./AdminShell";

function fmt$(v: any): string {
  if (!v || isNaN(Number(v))) return "$0.00";
  return `$${Number(v).toFixed(4)}`;
}
function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" }); }
  catch { return "—"; }
}

export default function AdminAccountsTab({ token, onBack }: { token: string; onBack: () => void }) {
  const [data, setData] = useState<NewAccountsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [countdown, setCountdown] = useState(60);

  const refresh = useCallback(async () => {
    setLoading(true);
    try { setData(await getAdminNewAccounts(token, days)); }
    catch (e) { console.error("[Admin] accounts:", e); }
    setLoading(false);
  }, [token, days]);

  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => {
    if (!autoRefresh) return;
    const t = setInterval(() => setCountdown(p => { if (p <= 1) { refresh(); return 60; } return p - 1; }), 1000);
    return () => clearInterval(t);
  }, [autoRefresh, refresh]);

  const kpis = [
    { label: "Aujourd'hui", val: data?.new_today ?? 0, color: "text-orange-500" },
    { label: "Cette semaine", val: data?.new_this_week ?? 0, color: "text-[var(--accent-navy)]" },
    { label: `${days} derniers jours`, val: data?.total ?? 0, color: "text-[var(--text-primary)]" },
  ];

  return (
    <AdminShell
      title="Nouveaux Comptes"
      description="Inscriptions & croissance"
      icon={UserPlus}
      iconColor="text-[var(--accent-navy)]"
      iconBg="border-[var(--accent-navy)]/20 bg-[var(--accent-navy)]/8"
      onBack={onBack}
      loading={loading}
      onRefresh={refresh}
      actions={
        <>
          <button onClick={() => setAutoRefresh(p => !p)}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs transition-all ${autoRefresh ? "border-[var(--accent-navy)]/25 bg-[var(--accent-navy)]/8 text-[var(--accent-navy)]" : "bg-[var(--surface-subtle)] border-[var(--border-default)] text-[var(--text-secondary)]"}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${autoRefresh ? "bg-[var(--accent-navy)] animate-pulse" : "bg-[var(--border-default)]"}`} />
            {autoRefresh ? `Live (${countdown}s)` : "Pausé"}
          </button>
          <div className="flex bg-[var(--surface-subtle)] border border-[var(--border-default)] rounded-xl p-0.5">
            {[{ l: "7J", v: 7 }, { l: "30J", v: 30 }, { l: "90J", v: 90 }, { l: "ALL", v: 365 }].map(o => (
              <button key={o.v} onClick={() => setDays(o.v)}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ${days === o.v ? "bg-[var(--text-primary)] text-[rgb(var(--background))]" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"}`}>
                {o.l}
              </button>
            ))}
          </div>
        </>
      }
    >
      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {kpis.map((k, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className="p-6 rounded-[24px] bg-[var(--bg-card)] border border-[var(--border-default)]">
            <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--text-secondary)]">{k.label}</span>
            <p className={`text-3xl font-bold font-mono mt-2 ${k.color}`}>{k.val}</p>
          </motion.div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-[var(--bg-card)] border border-[var(--border-default)] rounded-[24px] overflow-hidden">
        <div className="px-6 py-4 border-b border-[var(--border-default)]">
          <h3 className="text-[13px] font-bold text-[var(--text-primary)]">Comptes Créés</h3>
        </div>

        <div className="grid grid-cols-12 gap-0 bg-[var(--surface-subtle)] px-6 py-2 border-b border-[var(--border-default)]">
          {[["col-span-4", "Email"], ["col-span-2 text-center", "Plan"], ["col-span-2 text-center", "Inscrit le"], ["col-span-2 text-center", "Activité"], ["col-span-2 text-right", "Coût total"]].map(([cls, l]) => (
            <div key={l} className={`${cls} text-[9px] font-bold uppercase tracking-[0.08em] text-[var(--text-secondary)]`}>{l}</div>
          ))}
        </div>

        <div className="divide-y divide-[var(--border-faint)]">
          {!data?.accounts?.length ? (
            <div className="p-16 text-center">
              <UserPlus size={28} className="mx-auto mb-3 text-[var(--text-secondary)]" />
              <p className="text-xs text-[var(--text-secondary)]">Aucun nouveau compte sur cette période</p>
            </div>
          ) : data.accounts.map((acc, idx) => {
            const planStyle = acc.plan === "business"
              ? "text-orange-500 bg-orange-500/10 border-orange-500/20"
              : acc.plan === "pro"
                ? "text-[var(--accent-navy)] bg-[var(--accent-navy)]/8 border-[var(--accent-navy)]/20"
                : "text-[var(--text-primary)] bg-[var(--surface-subtle)] border-[var(--border-default)]";
            return (
              <motion.div key={acc.user_id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: idx * 0.025 }}
                className="grid grid-cols-12 gap-0 px-6 py-4 items-center hover:bg-[var(--surface-subtle)] transition-colors">
                <div className="col-span-4 flex items-center gap-3 min-w-0">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border-default)] bg-[var(--accent-navy)]/8 text-[var(--accent-navy)] text-sm font-bold shrink-0">
                    {(acc.email || "?").charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-[var(--text-primary)] truncate">{acc.email}</p>
                    <p className="text-[10px] text-[var(--text-secondary)] truncate font-mono">{acc.user_id}</p>
                  </div>
                </div>
                <div className="col-span-2 flex justify-center">
                  <span className={`px-3 py-1 rounded-full text-[10px] font-semibold border ${planStyle}`}>{acc.plan}</span>
                </div>
                <div className="col-span-2 text-center text-[11px] text-[var(--text-secondary)]">{formatDate(acc.created_at)}</div>
                <div className="col-span-2 text-center">
                  {acc.is_active
                    ? <span className="text-[11px] font-medium text-orange-500">{acc.total_actions} actions</span>
                    : <span className="text-[11px] italic text-[var(--text-secondary)]">Inactif</span>}
                </div>
                <div className="col-span-2 text-right">
                  <span className="text-[12px] font-bold text-[var(--text-primary)] font-mono">{fmt$(acc.total_cost)}</span>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </AdminShell>
  );
}
