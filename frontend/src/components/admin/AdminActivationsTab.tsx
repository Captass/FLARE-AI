"use client";

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Rocket, ChevronDown, RefreshCcw, StickyNote } from "lucide-react";
import {
  getAdminActivations, adminAssignActivation,
  adminSetActivationStatus, adminAddActivationNote,
  type ActivationRequest,
} from "@/lib/api";
import AdminShell from "./AdminShell";

const STATUS_LABELS: Record<string, string> = {
  draft: "Brouillon",
  awaiting_payment: "En attente paiement",
  payment_submitted: "Preuve soumise",
  payment_verified: "Paiement vérifié",
  awaiting_flare_page_admin_access: "Attente admin page",
  queued_for_activation: "En file",
  activation_in_progress: "En cours",
  testing: "Test",
  active: "Actif",
  blocked: "Bloqué",
  rejected: "Refusé",
  canceled: "Annulé",
};

const STATUS_COLORS: Record<string, string> = {
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
  canceled: "bg-[var(--surface-subtle)] text-[var(--text-secondary)]",
};

const NEXT_STATUSES: Record<string, string[]> = {
  draft: ["awaiting_payment", "canceled"],
  awaiting_payment: ["payment_submitted", "canceled"],
  payment_submitted: ["rejected"],
  payment_verified: ["awaiting_flare_page_admin_access"],
  awaiting_flare_page_admin_access: ["queued_for_activation", "blocked"],
  queued_for_activation: ["activation_in_progress", "blocked"],
  activation_in_progress: ["testing", "blocked"],
  testing: ["active", "blocked"],
  active: ["blocked"],
  blocked: ["queued_for_activation", "canceled"],
  rejected: ["awaiting_payment", "canceled"],
};

const CHECKLIST = [
  { label: "Paiement vérifié", fn: (ar: ActivationRequest) => ["payment_verified", "awaiting_flare_page_admin_access", "queued_for_activation", "activation_in_progress", "testing", "active"].includes(ar.status) },
  { label: "Accès page confirmé", fn: (ar: ActivationRequest) => ar.flare_page_admin_confirmed === "true" },
  { label: "Activation en cours", fn: (ar: ActivationRequest) => ["activation_in_progress", "testing", "active"].includes(ar.status) },
  { label: "Test Messenger validé", fn: (ar: ActivationRequest) => ["testing", "active"].includes(ar.status) },
  { label: "Chatbot actif", fn: (ar: ActivationRequest) => ar.status === "active" },
];

const STATUS_FILTERS = ["all", "payment_submitted", "payment_verified", "queued_for_activation", "activation_in_progress", "testing", "active", "blocked", "rejected"];

export default function AdminActivationsTab({ token, onBack }: { token: string; onBack: () => void }) {
  const [activations, setActivations] = useState<ActivationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [assignDrafts, setAssignDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState("all");
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const res = await getAdminActivations(token);
      setActivations(res.activations ?? []);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Impossible de charger les activations.");
    }
    setLoading(false);
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const filtered = filterStatus === "all" ? activations : activations.filter(a => a.status === filterStatus);

  const act = async (fn: () => Promise<unknown>, success: string) => {
    try { await fn(); await load(); setToast({ ok: true, msg: success }); }
    catch (e) { setToast({ ok: false, msg: e instanceof Error ? e.message : "Erreur" }); }
  };

  return (
    <AdminShell
      title="Activations"
      description="Demandes d'activation chatbot"
      icon={Rocket}
      onBack={onBack}
      loading={loading}
      onRefresh={() => { setLoading(true); load(); }}
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

      {/* Filter bar */}
      <div className="flex flex-wrap gap-2 mb-6">
        {STATUS_FILTERS.map(s => (
          <button key={s} onClick={() => setFilterStatus(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filterStatus === s ? "border border-orange-500/30 bg-orange-500/10 text-orange-500" : "border border-transparent bg-[var(--surface-subtle)] text-[var(--text-secondary)] hover:border-[var(--border-default)]"}`}>
            {s === "all" ? "Toutes" : STATUS_LABELS[s] ?? s}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-20 rounded-2xl bg-[var(--surface-subtle)] animate-pulse" />)}</div>
      ) : loadError && activations.length === 0 ? (
        <div className="text-center py-16 text-[var(--text-secondary)]">
          <Rocket size={44} className="mx-auto mb-4 opacity-25" />
          <p>Le chargement des activations a echoue. Faites un refresh avant de conclure qu&apos;il n&apos;y a aucune demande.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-[var(--text-secondary)]">
          <Rocket size={44} className="mx-auto mb-4 opacity-25" />
          <p>Aucune activation{filterStatus !== "all" ? " avec ce statut" : ""}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(ar => {
            const expanded = expandedId === ar.id;
            const nextStatuses = NEXT_STATUSES[ar.status] ?? [];
            const selectedPage = Array.isArray(ar.selected_facebook_pages)
              ? ar.selected_facebook_pages.find(p => p.is_selected) ?? null : null;

            return (
              <motion.div key={ar.id} layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] overflow-hidden">
                <button onClick={() => setExpandedId(expanded ? null : ar.id)}
                  className="w-full p-4 flex items-center gap-4 text-left hover:bg-[var(--surface-subtle)] transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-[var(--text-primary)] truncate">
                        {ar.business_name || ar.contact_full_name || ar.contact_email || "Client"}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${STATUS_COLORS[ar.status] ?? "bg-[var(--surface-subtle)] text-[var(--text-primary)]"}`}>
                        {STATUS_LABELS[ar.status] ?? ar.status}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[var(--surface-subtle)] text-[var(--text-secondary)]">
                        {ar.selected_plan_id}
                      </span>
                      {ar.applied_plan_id && (
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                          ar.applied_plan_id === ar.selected_plan_id && ar.subscription_status === "active"
                            ? "bg-[var(--accent-navy)]/8 text-[var(--accent-navy)]"
                            : "bg-red-500/10 text-red-500"
                        }`}>
                          Applique: {ar.applied_plan_id}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[var(--text-secondary)] mt-1 truncate">
                      {ar.contact_full_name} · {ar.contact_email || ar.contact_phone || "—"} ·{" "}
                      {ar.requested_at ? new Date(ar.requested_at).toLocaleDateString("fr-FR") : "—"}
                    </p>
                  </div>
                  {ar.assigned_operator_email && (
                    <span className="rounded-full bg-[var(--accent-navy)]/8 px-2 py-0.5 text-[10px] text-[var(--accent-navy)] shrink-0">
                      {ar.assigned_operator_email}
                    </span>
                  )}
                  <ChevronDown size={15} className={`text-[var(--text-secondary)] transition-transform shrink-0 ${expanded ? "rotate-180" : ""}`} />
                </button>

                <AnimatePresence>
                  {expanded && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                      className="border-t border-[var(--border-default)] overflow-hidden">
                      <div className="p-4 space-y-4">
                        {/* Detail grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                          {[
                            ["Contact", ar.contact_full_name],
                            ["Email", ar.contact_email],
                            ["Téléphone", ar.contact_phone],
                            ["WhatsApp", ar.contact_whatsapp],
                            ["Entreprise", ar.business_name],
                            ["Secteur", ar.business_sector],
                            ["Ville", ar.business_city && ar.business_country ? `${ar.business_city}, ${ar.business_country}` : ar.business_city],
                            ["Plan demande", ar.selected_plan_id],
                            ["Plan applique", ar.applied_plan_id],
                            ["Statut abonnement", ar.subscription_status],
                            ["Page cible", ar.activation_target_page_name || ar.facebook_page_name],
                            ["ID page cible", ar.activation_target_page_id],
                            ["URL Page", ar.facebook_page_url],
                            ["Admin FLARE confirmé", ar.flare_page_admin_confirmed === "true" ? "Oui" : "Non"],
                            ["Bot", ar.bot_name],
                            ["Langue", ar.primary_language],
                            ["Ton", ar.tone],
                            ["Raison blocage", ar.blocked_reason],
                          ].filter(([, v]) => v && v !== "—").map(([label, val]) => (
                            <div key={label as string} className="flex justify-between gap-2">
                              <span className="text-[var(--text-secondary)]">{label}</span>
                              <span className="text-[var(--text-primary)] text-right truncate max-w-[60%]">{val}</span>
                            </div>
                          ))}
                        </div>

                        {/* Pages snippet */}
                        {Array.isArray(ar.selected_facebook_pages) && ar.selected_facebook_pages.length > 0 && (
                          <div className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-subtle)] px-3 py-3">
                            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-secondary)]">Pages importées depuis Meta</p>
                            <div className="flex flex-wrap gap-2">
                              {ar.selected_facebook_pages.map(page => {
                                const isTarget = page.page_id === ar.activation_target_page_id;
                                const isSel = Boolean(page.is_selected);
                                return (
                                  <span key={page.page_id} className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] ${isTarget ? "border-orange-500/30 bg-orange-500/10 text-orange-500" : isSel ? "border-[var(--accent-navy)]/30 bg-[var(--accent-navy)]/10 text-[var(--accent-navy)]" : "border-[var(--border-default)] bg-[var(--bg-card)] text-[var(--text-secondary)]"}`}>
                                    {page.page_name || page.page_id}
                                    {isSel && <span className="rounded-full bg-[var(--accent-navy)]/20 px-1 text-[9px] font-bold uppercase text-[var(--accent-navy)]">FLARE</span>}
                                    {isTarget && <span className="rounded-full bg-orange-500/20 px-1 text-[9px] font-bold uppercase text-orange-500">CIBLE</span>}
                                  </span>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Contact links */}
                        <div className="flex flex-wrap gap-2">
                          {ar.contact_email && <a href={`mailto:${ar.contact_email}`} className="rounded-lg border border-[var(--border-default)] px-3 py-2 text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--surface-subtle)]">Email client</a>}
                          {ar.contact_phone && <a href={`tel:${ar.contact_phone}`} className="rounded-lg border border-[var(--border-default)] px-3 py-2 text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--surface-subtle)]">Appeler</a>}
                          {(ar.contact_whatsapp || ar.contact_phone) && <a href={`https://wa.me/${String(ar.contact_whatsapp || ar.contact_phone).replace(/[^0-9]/g, "")}`} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-[var(--border-default)] px-3 py-2 text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--surface-subtle)]">WhatsApp</a>}
                          {ar.facebook_page_url && <a href={ar.facebook_page_url} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-[var(--border-default)] px-3 py-2 text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--surface-subtle)]">Page Facebook</a>}
                        </div>

                        {/* Checklist */}
                        <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-4">
                          <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--text-secondary)] mb-3">Checklist opérateur</p>
                          <div className="grid gap-2">
                            {CHECKLIST.map(item => (
                              <div key={item.label} className="flex items-center justify-between rounded-xl bg-[var(--surface-subtle)] px-3 py-2">
                                <span className="text-xs text-[var(--text-primary)]">{item.label}</span>
                                <span className={`text-[11px] font-medium ${item.fn(ar) ? "text-orange-500" : "text-[var(--text-secondary)]"}`}>
                                  {item.fn(ar) ? "✓ OK" : "À faire"}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Status transitions */}
                        {nextStatuses.length > 0 && (
                          <div className="flex flex-wrap gap-2 items-center">
                            <span className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wider">Transition →</span>
                            {nextStatuses.map(ns => (
                              <button key={ns} onClick={() => { setBusy(ar.id); act(() => adminSetActivationStatus(ar.id, ns, undefined, token), `Statut mis à jour : ${STATUS_LABELS[ns] ?? ns}`).finally(() => setBusy(null)); }}
                                disabled={busy === ar.id}
                                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors disabled:opacity-40 ${ns === "active" ? "border-[var(--accent-navy)]/28 bg-[var(--accent-navy)]/8 text-[var(--accent-navy)] hover:bg-[var(--accent-navy)]/14" : ns === "blocked" || ns === "rejected" || ns === "canceled" ? "border-red-500/30 bg-red-500/10 text-red-500" : "border-orange-500/30 bg-orange-500/10 text-orange-500"}`}>
                                {STATUS_LABELS[ns] ?? ns}
                              </button>
                            ))}
                          </div>
                        )}

                        {/* Assign operator */}
                        <div className="flex gap-2">
                          <input value={assignDrafts[ar.id] ?? ""} onChange={e => setAssignDrafts(p => ({ ...p, [ar.id]: e.target.value }))}
                            placeholder="Email opérateur…"
                            className="flex-1 bg-[var(--surface-subtle)] border border-[var(--border-default)] rounded-lg px-3 py-2 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:outline-none focus:border-[var(--border-subtle)]" />
                          <button
                            onClick={() => { setBusy(ar.id); act(() => adminAssignActivation(ar.id, (assignDrafts[ar.id] ?? "").trim(), token), "Opérateur assigné.").finally(() => setBusy(null)); }}
                            disabled={busy === ar.id || !(assignDrafts[ar.id] ?? "").trim()}
                            className="rounded-lg border border-[var(--accent-navy)]/28 bg-[var(--accent-navy)]/8 px-3 py-2 text-xs font-medium text-[var(--accent-navy)] hover:bg-[var(--accent-navy)]/14 disabled:opacity-40">
                            Assigner
                          </button>
                        </div>

                        {/* Add note */}
                        <div className="flex gap-2">
                          <input value={noteDrafts[ar.id] ?? ""} onChange={e => setNoteDrafts(p => ({ ...p, [ar.id]: e.target.value }))}
                            placeholder="Ajouter une note…"
                            className="flex-1 bg-[var(--surface-subtle)] border border-[var(--border-default)] rounded-lg px-3 py-2 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:outline-none focus:border-[var(--border-subtle)]" />
                          <button
                            onClick={() => { setBusy(ar.id); act(() => adminAddActivationNote(ar.id, (noteDrafts[ar.id] ?? "").trim(), token), "Note ajoutée.").finally(() => setBusy(null)); }}
                            disabled={busy === ar.id || !(noteDrafts[ar.id] ?? "").trim()}
                            className="rounded-lg border border-orange-500/30 bg-orange-500/10 px-3 py-2 text-xs font-medium text-orange-500 hover:bg-orange-500/20 disabled:opacity-40">
                            <StickyNote size={13} />
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
    </AdminShell>
  );
}
