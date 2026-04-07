"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, Loader2, MessageSquareWarning, X } from "lucide-react";

import { createUserReport } from "@/lib/api";

type SignalementModalProps = {
  open: boolean;
  onClose: () => void;
  token?: string | null;
  getFreshToken?: (forceRefresh?: boolean) => Promise<string | null>;
  currentView: string;
  currentViewLabel: string;
};

const CATEGORY_OPTIONS = [
  { value: "ui_bug", label: "Bug interface" },
  { value: "chatbot_issue", label: "Probleme chatbot" },
  { value: "activation_payment", label: "Paiement / activation" },
  { value: "account_workspace", label: "Compte / espace" },
  { value: "data_problem", label: "Donnees incorrectes" },
  { value: "other", label: "Autre" },
];

const SEVERITY_OPTIONS = [
  { value: "low", label: "Faible" },
  { value: "normal", label: "Normale" },
  { value: "high", label: "Haute" },
  { value: "critical", label: "Bloquante" },
];

export default function SignalementModal({
  open,
  onClose,
  token,
  getFreshToken,
  currentView,
  currentViewLabel,
}: SignalementModalProps) {
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    category: "ui_bug",
    severity: "normal",
    title: "",
    description: "",
    expected_behavior: "",
    contact_email: "",
    contact_phone: "",
  });

  useEffect(() => {
    if (!open) {
      setBusy(false);
      setSuccess(null);
      setError(null);
      setForm({
        category: "ui_bug",
        severity: "normal",
        title: "",
        description: "",
        expected_behavior: "",
        contact_email: "",
        contact_phone: "",
      });
    }
  }, [open]);

  const canSubmit = useMemo(() => {
    return form.title.trim().length >= 4 && form.description.trim().length >= 10;
  }, [form.description, form.title]);

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    setSuccess(null);

    try {
      const accessToken = getFreshToken ? await getFreshToken(true) : token ?? null;
      if (!accessToken) {
        throw new Error("Session indisponible.");
      }

      await createUserReport(
        {
          category: form.category,
          severity: form.severity,
          title: form.title.trim(),
          description: form.description.trim(),
          expected_behavior: form.expected_behavior.trim(),
          contact_email: form.contact_email.trim(),
          contact_phone: form.contact_phone.trim(),
          current_view: currentView,
        },
        accessToken,
      );

      setSuccess("Signalement envoye a l'administration.");
      setForm((prev) => ({
        ...prev,
        title: "",
        description: "",
        expected_behavior: "",
      }));
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Impossible d'envoyer le signalement.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[180] bg-black/45 backdrop-blur-[2px]"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-x-4 top-[8vh] z-[190] mx-auto w-full max-w-2xl rounded-[28px] border border-[var(--border-default)] bg-[var(--surface-base)] shadow-[var(--shadow-card)]"
          >
            <div className="flex items-start justify-between gap-4 border-b border-[var(--border-default)] px-5 py-4 md:px-6">
              <div>
                <div className="flex items-center gap-2 text-[var(--text-primary)]">
                  <MessageSquareWarning size={18} />
                  <h2 className="text-lg font-semibold">Signaler un probleme</h2>
                </div>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">
                  Ecran actuel: <span className="text-[var(--text-primary)]">{currentViewLabel}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl p-2 text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-subtle)] hover:text-[var(--text-primary)]"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-4 px-5 py-5 md:px-6">
              {success ? (
                <div className="flex items-start gap-3 rounded-2xl border border-[var(--border-strong)] bg-[var(--surface-subtle)] px-4 py-3 text-sm text-[var(--text-primary)]">
                  <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
                  <span>{success}</span>
                </div>
              ) : null}
              {error ? (
                <div className="flex items-start gap-3 rounded-2xl border border-[var(--border-strong)] bg-[var(--surface-subtle)] px-4 py-3 text-sm text-[var(--text-primary)]">
                  <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              ) : null}

              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">Categorie</span>
                  <select
                    value={form.category}
                    onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value }))}
                    className="w-full rounded-2xl border border-[var(--border-default)] bg-[var(--surface-subtle)] px-4 py-3 text-sm text-[var(--text-primary)] outline-none"
                  >
                    {CATEGORY_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">Priorite</span>
                  <select
                    value={form.severity}
                    onChange={(event) => setForm((prev) => ({ ...prev, severity: event.target.value }))}
                    className="w-full rounded-2xl border border-[var(--border-default)] bg-[var(--surface-subtle)] px-4 py-3 text-sm text-[var(--text-primary)] outline-none"
                  >
                    {SEVERITY_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">Titre</span>
                <input
                  value={form.title}
                  onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                  placeholder="Ex: le bouton payer ne repond pas"
                  className="w-full rounded-2xl border border-[var(--border-default)] bg-[var(--surface-subtle)] px-4 py-3 text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
                />
              </label>

              <label className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">Ce qui se passe</span>
                <textarea
                  value={form.description}
                  onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                  placeholder="Decris le probleme concretement."
                  rows={4}
                  className="w-full rounded-2xl border border-[var(--border-default)] bg-[var(--surface-subtle)] px-4 py-3 text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
                />
              </label>

              <label className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">Ce que tu attendais</span>
                <textarea
                  value={form.expected_behavior}
                  onChange={(event) => setForm((prev) => ({ ...prev, expected_behavior: event.target.value }))}
                  placeholder="Optionnel."
                  rows={3}
                  className="w-full rounded-2xl border border-[var(--border-default)] bg-[var(--surface-subtle)] px-4 py-3 text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
                />
              </label>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">Email de contact</span>
                  <input
                    value={form.contact_email}
                    onChange={(event) => setForm((prev) => ({ ...prev, contact_email: event.target.value }))}
                    placeholder="Optionnel"
                    className="w-full rounded-2xl border border-[var(--border-default)] bg-[var(--surface-subtle)] px-4 py-3 text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">Telephone / WhatsApp</span>
                  <input
                    value={form.contact_phone}
                    onChange={(event) => setForm((prev) => ({ ...prev, contact_phone: event.target.value }))}
                    placeholder="Optionnel"
                    className="w-full rounded-2xl border border-[var(--border-default)] bg-[var(--surface-subtle)] px-4 py-3 text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
                  />
                </label>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-[var(--border-default)] px-5 py-4 md:px-6">
              <p className="text-xs text-[var(--text-muted)]">Le signalement arrive dans l&apos;espace admin FLARE.</p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl border border-[var(--border-default)] px-4 py-2 text-sm text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-subtle)]"
                >
                  Fermer
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={busy || !canSubmit}
                  className="inline-flex items-center gap-2 rounded-xl bg-[var(--accent-orange)] px-4 py-2 text-sm font-semibold text-black transition-opacity disabled:opacity-45"
                >
                  {busy ? <Loader2 size={15} className="animate-spin" /> : null}
                  Envoyer
                </button>
              </div>
            </div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  );
}
