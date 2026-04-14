"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { CreditCard, Eye, CheckCircle2, XCircle } from "lucide-react";
import { getAdminPayments, adminVerifyPayment, adminRejectPayment } from "@/lib/api";
import AdminShell from "./AdminShell";

function statusColor(s: string): string {
  if (s === "submitted") return "bg-orange-500/10 text-orange-500";
  if (s === "verified") return "bg-[var(--accent-navy)]/8 text-[var(--accent-navy)]";
  if (s === "rejected") return "bg-red-500/10 text-red-500";
  return "bg-[var(--surface-subtle)] text-[var(--text-primary)]";
}
function statusLabel(s: string): string {
  if (s === "submitted") return "À vérifier";
  if (s === "verified") return "Vérifié";
  if (s === "rejected") return "Refusé";
  return s;
}

const FILTERS = ["all", "submitted", "verified", "rejected"];

export default function AdminPaymentsTab({ token, onBack }: { token: string; onBack: () => void }) {
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [rejectReasons, setRejectReasons] = useState<Record<string, string>>({});
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [filter, setFilter] = useState("all");
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null);

  const load = useCallback(async () => {
    try { const res = await getAdminPayments(token); setPayments(res.payments ?? []); }
    catch { /* silent */ }
    setLoading(false);
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const filtered = filter === "all" ? payments : payments.filter((p: any) => p.status === filter);

  const handleVerify = async (id: string) => {
    setBusy(id);
    try { await adminVerifyPayment(id, token); await load(); setToast({ ok: true, msg: "Paiement vérifié avec succès." }); }
    catch (e) { setToast({ ok: false, msg: e instanceof Error ? e.message : "Erreur" }); }
    setBusy(null);
  };

  const handleReject = async (id: string) => {
    const reason = (rejectReasons[id] ?? "").trim();
    if (!reason) { setToast({ ok: false, msg: "Renseignez une raison de refus." }); return; }
    setBusy(id);
    try {
      await adminRejectPayment(id, reason, token);
      setRejectingId(null);
      setRejectReasons(p => ({ ...p, [id]: "" }));
      await load();
      setToast({ ok: true, msg: "Paiement refusé." });
    } catch (e) { setToast({ ok: false, msg: e instanceof Error ? e.message : "Erreur" }); }
    setBusy(null);
  };

  return (
    <AdminShell
      title="Paiements"
      description="Vérifier et valider les preuves de paiement"
      icon={CreditCard}
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
            {s === "all" ? "Tous" : statusLabel(s)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-20 rounded-2xl bg-[var(--surface-subtle)] animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-[var(--text-secondary)]">
          <CreditCard size={44} className="mx-auto mb-4 opacity-25" />
          <p>Aucun paiement{filter !== "all" ? " avec ce statut" : ""}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((pay: any) => (
            <motion.div key={pay.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-semibold text-sm text-[var(--text-primary)]">{pay.payer_full_name ?? "Inconnu"}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${statusColor(pay.status)}`}>{statusLabel(pay.status)}</span>
                    <span className="text-[10px] text-[var(--text-secondary)] bg-[var(--surface-subtle)] px-2 py-0.5 rounded-full">{pay.method_code}</span>
                  </div>
                  <p className="text-xs text-[var(--text-secondary)]">
                    Ref: <span className="text-[var(--text-primary)] font-mono">{pay.transaction_reference ?? "—"}</span>
                    {pay.amount ? ` · ${pay.amount} ${pay.currency ?? ""}` : ""}
                    {pay.payer_phone ? ` · ${pay.payer_phone}` : ""}
                  </p>
                  <p className="text-[10px] text-[var(--text-secondary)] mt-1">
                    Soumis : {pay.submitted_at ? new Date(pay.submitted_at).toLocaleString("fr-FR") : "—"}
                    {pay.user_id ? ` · ${pay.user_id}` : ""}
                  </p>

                  {/* Activation context */}
                  {pay.activation_summary && (
                    <div className="mt-3 rounded-xl border border-[var(--border-default)] bg-[var(--surface-subtle)] px-3 py-3 space-y-1">
                      <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--text-secondary)]">Handoff activation</p>
                      {[
                        ["Contact", pay.activation_summary.contact_full_name],
                        ["Email", pay.activation_summary.contact_email],
                        ["Téléphone", pay.activation_summary.contact_phone],
                        ["WhatsApp", pay.activation_summary.contact_whatsapp],
                        ["Page Facebook", pay.activation_summary.facebook_page_name],
                        ["URL page", pay.activation_summary.facebook_page_url],
                        ["Entreprise", pay.activation_summary.business_name],
                      ].filter(([, v]) => v).map(([label, val]) => (
                        <p key={label as string} className="text-[11px] text-[var(--text-primary)]">
                          <span className="text-[var(--text-secondary)]">{label} : </span>{val}
                        </p>
                      ))}
                      <div className="pt-2 flex flex-wrap gap-2">
                        {pay.activation_summary.contact_email && <a href={`mailto:${pay.activation_summary.contact_email}`} className="rounded-lg border border-[var(--border-default)] px-2.5 py-1.5 text-[11px] font-medium text-[var(--text-primary)] hover:bg-[var(--surface-raised)]">Email</a>}
                        {pay.activation_summary.contact_phone && <a href={`tel:${pay.activation_summary.contact_phone}`} className="rounded-lg border border-[var(--border-default)] px-2.5 py-1.5 text-[11px] font-medium text-[var(--text-primary)] hover:bg-[var(--surface-raised)]">Appeler</a>}
                        {(pay.activation_summary.contact_whatsapp || pay.activation_summary.contact_phone) && <a href={`https://wa.me/${String(pay.activation_summary.contact_whatsapp ?? pay.activation_summary.contact_phone).replace(/[^0-9]/g, "")}`} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-[var(--border-default)] px-2.5 py-1.5 text-[11px] font-medium text-[var(--text-primary)] hover:bg-[var(--surface-raised)]">WhatsApp</a>}
                        {pay.activation_summary.facebook_page_url && <a href={pay.activation_summary.facebook_page_url} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-[var(--border-default)] px-2.5 py-1.5 text-[11px] font-medium text-[var(--text-primary)] hover:bg-[var(--surface-raised)]">Ouvrir la page</a>}
                      </div>
                    </div>
                  )}

                  {pay.proof_file_url && (
                    <a href={pay.proof_file_url} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 mt-2 text-xs text-[var(--accent-navy)] hover:text-[var(--text-primary)]">
                      <Eye size={12} /> Voir la preuve
                    </a>
                  )}
                  {pay.rejection_reason && <p className="text-xs text-red-400 mt-1">Raison : {pay.rejection_reason}</p>}
                </div>

                {pay.status === "submitted" && (
                  <div className="flex flex-col gap-2 shrink-0">
                    <button onClick={() => handleVerify(pay.id)} disabled={busy === pay.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-orange-500/10 text-orange-500 border border-orange-500/30 hover:bg-orange-500/20 disabled:opacity-40">
                      <CheckCircle2 size={12} /> Valider
                    </button>
                    {rejectingId === pay.id ? (
                      <div className="flex flex-col gap-1">
                        <input value={rejectReasons[pay.id] ?? ""} onChange={e => setRejectReasons(p => ({ ...p, [pay.id]: e.target.value }))}
                          placeholder="Raison du refus…"
                          className="bg-[var(--surface-subtle)] border border-[var(--border-default)] rounded-lg px-2 py-1 text-xs text-[var(--text-primary)] w-40 focus:outline-none" />
                        <div className="flex gap-1">
                          <button onClick={() => handleReject(pay.id)} disabled={busy === pay.id}
                            className="flex-1 px-2 py-1 rounded-lg text-[10px] font-medium bg-red-500/10 text-red-500 border border-red-500/30 hover:bg-red-500/18 disabled:opacity-40">
                            Confirmer
                          </button>
                          <button onClick={() => { setRejectingId(null); setRejectReasons(p => ({ ...p, [pay.id]: "" })); }}
                            className="px-2 py-1 rounded-lg text-[10px] text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)]">
                            Annuler
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button onClick={() => setRejectingId(pay.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-red-500/10 text-red-500 border border-red-500/30 hover:bg-red-500/18">
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
    </AdminShell>
  );
}
