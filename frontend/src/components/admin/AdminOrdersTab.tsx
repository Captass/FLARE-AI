"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ShoppingBag } from "lucide-react";
import { getAdminOrders, adminUpdateOrder, type ChatbotOrder } from "@/lib/api";
import AdminShell from "./AdminShell";

const ORDER_STATUS_LABELS: Record<string, string> = {
  new: "Nouvelle", confirmed: "Confirmée", delivered: "Livrée",
  cancelled: "Annulée", needs_followup: "À suivre",
};
function statusColor(s: string): string {
  const m: Record<string, string> = {
    new: "bg-[var(--accent-navy)]/8 text-[var(--accent-navy)]",
    confirmed: "bg-orange-500/10 text-orange-500",
    delivered: "bg-orange-500/10 text-orange-500",
    cancelled: "bg-red-500/10 text-red-500",
    needs_followup: "bg-[var(--accent-navy)]/8 text-[var(--accent-navy)]",
  };
  return m[s] ?? "bg-[var(--surface-subtle)] text-[var(--text-primary)]";
}

const FILTERS = ["all", "new", "confirmed", "needs_followup", "delivered", "cancelled"];

export default function AdminOrdersTab({ token, onBack }: { token: string; onBack: () => void }) {
  const [orders, setOrders] = useState<ChatbotOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [filter, setFilter] = useState("all");
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null);

  const load = useCallback(async () => {
    try { const res = await getAdminOrders(token); setOrders(res.orders ?? []); }
    catch { /* silent */ }
    setLoading(false);
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const filtered = filter === "all" ? orders : orders.filter(o => o.status === filter);

  const updateStatus = async (id: string, status: string) => {
    setBusy(id);
    try { await adminUpdateOrder(id, { status }, token); await load(); setToast({ ok: true, msg: `Statut mis à jour : ${ORDER_STATUS_LABELS[status] ?? status}` }); }
    catch (e) { setToast({ ok: false, msg: e instanceof Error ? e.message : "Erreur" }); }
    setBusy(null);
  };

  return (
    <AdminShell
      title="Commandes"
      description="Commandes Messenger de tous les clients"
      icon={ShoppingBag}
      iconColor="text-[var(--accent-navy)]"
      iconBg="border-[var(--accent-navy)]/20 bg-[var(--accent-navy)]/8"
      onBack={onBack}
      loading={loading}
      onRefresh={() => { setLoading(true); load(); }}
    >
      {toast && (
        <div className={`mb-4 rounded-xl border px-4 py-3 text-sm ${toast.ok ? "border-orange-500/25 bg-orange-500/10" : "border-red-500/25 bg-red-500/10"} text-[var(--text-primary)]`}>
          {toast.msg}
        </div>
      )}

      <div className="flex flex-wrap gap-2 mb-6">
        {FILTERS.map(s => (
          <button key={s} onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filter === s ? "border border-[var(--accent-navy)]/28 bg-[var(--accent-navy)]/8 text-[var(--accent-navy)]" : "bg-[var(--surface-subtle)] text-[var(--text-secondary)] border border-transparent hover:border-[var(--border-default)]"}`}>
            {s === "all" ? "Toutes" : ORDER_STATUS_LABELS[s] ?? s}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-20 rounded-2xl bg-[var(--surface-subtle)] animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-[var(--text-secondary)]">
          <ShoppingBag size={44} className="mx-auto mb-4 opacity-25" />
          <p>Aucune commande{filter !== "all" ? " avec ce statut" : ""}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(order => (
            <motion.div key={order.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-semibold text-sm text-[var(--text-primary)]">{order.contact_name ?? "Contact inconnu"}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${statusColor(order.status)}`}>{ORDER_STATUS_LABELS[order.status] ?? order.status}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${order.source === "signal" ? "bg-orange-500/10 text-orange-500" : "bg-[var(--surface-subtle)] text-[var(--text-primary)]"}`}>
                      {order.source === "signal" ? "Signal IA" : "Manuel"}
                    </span>
                    <span className="text-[10px] text-[var(--text-secondary)] bg-[var(--surface-subtle)] px-2 py-0.5 rounded-full">
                      {order.page_name ?? order.facebook_page_id ?? "Commande"}
                    </span>
                  </div>
                  <p className="text-xs text-[var(--text-primary)] mt-1">{order.product_summary ?? "—"}</p>
                  <p className="text-[10px] text-[var(--text-secondary)] mt-1">
                    {[order.quantity_text && `Qté: ${order.quantity_text}`, order.amount_text, order.contact_phone, order.delivery_address].filter(Boolean).join(" · ")}
                  </p>
                  {order.customer_request_text && (
                    <p className="text-[10px] text-[var(--text-secondary)] mt-1 italic">&ldquo;{order.customer_request_text}&rdquo;</p>
                  )}
                  <p className="text-[10px] text-[var(--text-secondary)] mt-1">
                    {order.created_at ? new Date(order.created_at).toLocaleString("fr-FR") : "—"}
                    {order.source === "signal" && order.confidence > 0 ? ` · Confiance: ${Math.round(order.confidence * 100)}%` : ""}
                  </p>
                </div>

                <div className="flex flex-col gap-1.5 shrink-0">
                  {["new", "needs_followup"].includes(order.status) && (
                    <button onClick={() => updateStatus(order.id, "confirmed")} disabled={busy === order.id}
                      className="rounded-lg border border-orange-500/30 bg-orange-500/10 px-2.5 py-1 text-[11px] font-medium text-orange-500 hover:bg-orange-500/20 disabled:opacity-40">
                      Confirmer
                    </button>
                  )}
                  {order.status === "confirmed" && (
                    <button onClick={() => updateStatus(order.id, "delivered")} disabled={busy === order.id}
                      className="rounded-lg border border-orange-500/30 bg-orange-500/10 px-2.5 py-1 text-[11px] font-medium text-orange-500 hover:bg-orange-500/20 disabled:opacity-40">
                      Livrée ✓
                    </button>
                  )}
                  {!["cancelled", "delivered"].includes(order.status) && (
                    <>
                      <button onClick={() => updateStatus(order.id, "needs_followup")} disabled={busy === order.id}
                        className="rounded-lg border border-[var(--accent-navy)]/28 bg-[var(--accent-navy)]/8 px-2.5 py-1 text-[11px] font-medium text-[var(--accent-navy)] hover:bg-[var(--accent-navy)]/14 disabled:opacity-40">
                        À suivre
                      </button>
                      <button onClick={() => updateStatus(order.id, "cancelled")} disabled={busy === order.id}
                        className="rounded-lg border border-red-500/30 bg-red-500/10 px-2.5 py-1 text-[11px] font-medium text-red-500 hover:bg-red-500/18 disabled:opacity-40">
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
    </AdminShell>
  );
}
