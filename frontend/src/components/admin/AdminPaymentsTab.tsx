"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, CreditCard, Eye, XCircle } from "lucide-react";
import { adminRejectPayment, adminVerifyPayment, getAdminPayments, type AdminPaymentRecord } from "@/lib/api";
import AdminShell from "./AdminShell";

function statusColor(status: string): string {
  if (status === "submitted") return "bg-orange-500/10 text-orange-500";
  if (status === "verified") return "bg-[var(--accent-navy)]/8 text-[var(--accent-navy)]";
  if (status === "rejected") return "bg-red-500/10 text-red-500";
  return "bg-[var(--surface-subtle)] text-[var(--text-primary)]";
}

function statusLabel(status: string): string {
  if (status === "submitted") return "A verifier";
  if (status === "verified") return "Verifie";
  if (status === "rejected") return "Refuse";
  return status;
}

const FILTERS = ["all", "submitted", "verified", "rejected"];

export default function AdminPaymentsTab({ token, onBack }: { token: string; onBack: () => void }) {
  const [payments, setPayments] = useState<AdminPaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [rejectReasons, setRejectReasons] = useState<Record<string, string>>({});
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [filter, setFilter] = useState("all");
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const res = await getAdminPayments(token);
      setPayments(res.payments ?? []);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Impossible de charger les paiements.");
    }
    setLoading(false);
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = filter === "all" ? payments : payments.filter((payment) => payment.status === filter);

  const handleVerify = async (id: string) => {
    setBusy(id);
    try {
      const result = await adminVerifyPayment(id, token);
      await load();
      setToast({
        ok: true,
        msg: `Paiement verifie. Plan applique: ${result.subscription.plan_id} (${result.subscription.status}).`,
      });
    } catch (error) {
      setToast({ ok: false, msg: error instanceof Error ? error.message : "Erreur" });
    }
    setBusy(null);
  };

  const handleReject = async (id: string) => {
    const reason = (rejectReasons[id] ?? "").trim();
    if (!reason) {
      setToast({ ok: false, msg: "Renseignez une raison de refus." });
      return;
    }
    setBusy(id);
    try {
      await adminRejectPayment(id, reason, token);
      setRejectingId(null);
      setRejectReasons((prev) => ({ ...prev, [id]: "" }));
      await load();
      setToast({ ok: true, msg: "Paiement refuse." });
    } catch (error) {
      setToast({ ok: false, msg: error instanceof Error ? error.message : "Erreur" });
    }
    setBusy(null);
  };

  return (
    <AdminShell
      title="Paiements"
      description="Verifier les preuves, appliquer le bon plan et reprendre l'activation sans ambiguite."
      icon={CreditCard}
      iconColor="text-[var(--accent-navy)]"
      iconBg="border-[var(--accent-navy)]/20 bg-[var(--accent-navy)]/8"
      onBack={onBack}
      loading={loading}
      onRefresh={() => {
        setLoading(true);
        void load();
      }}
    >
      {toast && (
        <div className={`mb-4 rounded-xl border px-4 py-3 text-sm ${toast.ok ? "border-orange-500/25 bg-orange-500/10" : "border-red-500/25 bg-red-500/10"} text-[var(--text-primary)]`}>
          {toast.msg}
        </div>
      )}

      {loadError && (
        <div className="mb-4 rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-[var(--text-primary)]">
          {loadError}
        </div>
      )}

      <div className="mb-6 flex flex-wrap gap-2">
        {FILTERS.map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              filter === status
                ? "border border-[var(--accent-navy)]/28 bg-[var(--accent-navy)]/8 text-[var(--accent-navy)]"
                : "border border-transparent bg-[var(--surface-subtle)] text-[var(--text-secondary)] hover:border-[var(--border-default)]"
            }`}
          >
            {status === "all" ? "Tous" : statusLabel(status)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((index) => (
            <div key={index} className="h-20 animate-pulse rounded-2xl bg-[var(--surface-subtle)]" />
          ))}
        </div>
      ) : loadError && filtered.length === 0 ? (
        <div className="py-16 text-center text-[var(--text-secondary)]">
          <CreditCard size={44} className="mx-auto mb-4 opacity-25" />
          <p>Le chargement des paiements a echoue. Faites un refresh avant de conclure qu&apos;il n&apos;y a rien a verifier.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center text-[var(--text-secondary)]">
          <CreditCard size={44} className="mx-auto mb-4 opacity-25" />
          <p>Aucun paiement{filter !== "all" ? " avec ce statut" : ""}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((payment) => (
            <motion.div
              key={payment.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-4"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-[var(--text-primary)]">{payment.payer_full_name || "Inconnu"}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusColor(payment.status)}`}>{statusLabel(payment.status)}</span>
                    <span className="rounded-full bg-[var(--surface-subtle)] px-2 py-0.5 text-[10px] text-[var(--text-secondary)]">{payment.method_code}</span>
                  </div>
                  <p className="text-xs text-[var(--text-secondary)]">
                    Ref: <span className="font-mono text-[var(--text-primary)]">{payment.transaction_reference || "-"}</span>
                    {payment.amount ? ` · ${payment.amount} ${payment.currency || ""}` : ""}
                    {payment.payer_phone ? ` · ${payment.payer_phone}` : ""}
                  </p>
                  <p className="mt-1 text-[10px] text-[var(--text-secondary)]">
                    Soumis: {payment.submitted_at ? new Date(payment.submitted_at).toLocaleString("fr-FR") : "-"}
                    {payment.user_id ? ` · ${payment.user_id}` : ""}
                  </p>

                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className="rounded-full bg-[var(--surface-subtle)] px-2 py-0.5 text-[10px] font-medium text-[var(--text-secondary)]">
                      Plan demande: {payment.selected_plan_id}
                    </span>
                    {payment.applied_plan_id && (
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        payment.applied_plan_id === payment.selected_plan_id && payment.subscription_status === "active"
                          ? "bg-[var(--accent-navy)]/8 text-[var(--accent-navy)]"
                          : "bg-red-500/10 text-red-500"
                      }`}>
                        Plan applique: {payment.applied_plan_id}
                      </span>
                    )}
                    {payment.subscription_status && (
                      <span className="rounded-full bg-[var(--surface-subtle)] px-2 py-0.5 text-[10px] font-medium text-[var(--text-secondary)]">
                        Abonnement: {payment.subscription_status}
                      </span>
                    )}
                  </div>

                  {payment.activation_summary && (
                    <div className="mt-3 space-y-1 rounded-xl border border-[var(--border-default)] bg-[var(--surface-subtle)] px-3 py-3">
                      <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--text-secondary)]">Dossier activation</p>
                      {[
                        ["Contact", payment.activation_summary.contact_full_name],
                        ["Email", payment.activation_summary.contact_email],
                        ["Telephone", payment.activation_summary.contact_phone],
                        ["WhatsApp", payment.activation_summary.contact_whatsapp],
                        ["Entreprise", payment.activation_summary.business_name],
                        ["Page Facebook", payment.activation_summary.facebook_page_name],
                      ].filter(([, value]) => value).map(([label, value]) => (
                        <p key={String(label)} className="text-[11px] text-[var(--text-primary)]">
                          <span className="text-[var(--text-secondary)]">{label} : </span>
                          {String(value)}
                        </p>
                      ))}
                    </div>
                  )}

                  {payment.proof_file_url && (
                    <a
                      href={payment.proof_file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-flex items-center gap-1 text-xs text-[var(--accent-navy)] hover:text-[var(--text-primary)]"
                    >
                      <Eye size={12} />
                      Voir la preuve
                    </a>
                  )}
                  {payment.rejection_reason && <p className="mt-1 text-xs text-red-400">Raison : {payment.rejection_reason}</p>}
                </div>

                {payment.status === "submitted" && (
                  <div className="flex shrink-0 flex-col gap-2">
                    <button
                      onClick={() => void handleVerify(payment.id)}
                      disabled={busy === payment.id}
                      className="flex items-center gap-1.5 rounded-lg border border-orange-500/30 bg-orange-500/10 px-3 py-1.5 text-xs font-medium text-orange-500 hover:bg-orange-500/20 disabled:opacity-40"
                    >
                      <CheckCircle2 size={12} />
                      Valider
                    </button>
                    {rejectingId === payment.id ? (
                      <div className="flex flex-col gap-1">
                        <input
                          value={rejectReasons[payment.id] ?? ""}
                          onChange={(event) => setRejectReasons((prev) => ({ ...prev, [payment.id]: event.target.value }))}
                          placeholder="Raison du refus..."
                          className="w-40 rounded-lg border border-[var(--border-default)] bg-[var(--surface-subtle)] px-2 py-1 text-xs text-[var(--text-primary)] focus:outline-none"
                        />
                        <div className="flex gap-1">
                          <button
                            onClick={() => void handleReject(payment.id)}
                            disabled={busy === payment.id}
                            className="flex-1 rounded-lg border border-red-500/30 bg-red-500/10 px-2 py-1 text-[10px] font-medium text-red-500 hover:bg-red-500/18 disabled:opacity-40"
                          >
                            Confirmer
                          </button>
                          <button
                            onClick={() => {
                              setRejectingId(null);
                              setRejectReasons((prev) => ({ ...prev, [payment.id]: "" }));
                            }}
                            className="rounded-lg px-2 py-1 text-[10px] text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)]"
                          >
                            Annuler
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setRejectingId(payment.id)}
                        className="flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-red-500/18"
                      >
                        <XCircle size={12} />
                        Refuser
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
