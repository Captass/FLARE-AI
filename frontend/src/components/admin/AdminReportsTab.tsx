"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, RefreshCcw, ChevronLeft } from "lucide-react";
import { getAdminReports, adminUpdateReport, type UserReport } from "@/lib/api";

function statusLabel(status: string) {
  if (status === "new") return "Nouveau";
  if (status === "in_review") return "En cours";
  if (status === "resolved") return "Traité";
  if (status === "dismissed") return "Ignoré";
  return status;
}

function statusTone(status: string) {
  if (status === "new") return "border-orange-500/25 bg-orange-500/10";
  if (status === "in_review") return "border-[var(--accent-navy)]/25 bg-[var(--accent-navy)]/8";
  if (status === "resolved") return "border-emerald-500/25 bg-emerald-500/10";
  if (status === "dismissed") return "border-[var(--border-default)] bg-[var(--surface-subtle)]";
  return "border-[var(--border-default)] bg-[var(--surface-subtle)]";
}

export default function AdminReportsTab({ token, onBack }: { token: string; onBack: () => void }) {
  const [reports, setReports] = useState<UserReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try { const response = await getAdminReports(token); setReports(response.reports || []); }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => { void load(); }, [load]);

  const filtered = statusFilter === "all" ? reports : reports.filter(r => r.status === statusFilter);

  const handleUpdate = async (reportId: string, updates: { status?: string; admin_note?: string }) => {
    setBusyId(reportId);
    try { await adminUpdateReport(reportId, updates, token); await load(); }
    finally { setBusyId(null); }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[rgb(var(--background))] p-4 md:p-10">
      {/* Header */}
      <div className="mb-8 flex items-center gap-3">
        <button onClick={onBack} className="rounded-xl p-2 transition-colors hover:bg-[var(--surface-subtle)]">
          <ChevronLeft size={20} className="text-[var(--text-secondary)]" />
        </button>
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-orange-500/20 bg-orange-500/10">
          <AlertCircle size={20} className="text-orange-500" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-[var(--text-primary)]">Signalements</h2>
          <p className="text-xs text-[var(--text-secondary)]">Messages envoyes par les utilisateurs vers l&apos;admin.</p>
        </div>
        <button onClick={() => void load()} className="ml-auto rounded-xl p-2 transition-colors hover:bg-[var(--surface-subtle)]">
          <RefreshCcw size={15} className={`text-[var(--text-secondary)] ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-wrap gap-2">
        {["all", "new", "in_review", "resolved", "dismissed"].map(status => (
          <button key={status} onClick={() => setStatusFilter(status)}
            className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${statusFilter === status ? "border-orange-500/25 bg-orange-500/10 text-orange-500" : "border-transparent bg-[var(--surface-subtle)] text-[var(--text-secondary)] hover:border-[var(--border-default)]"}`}>
            {status === "all" ? "Tous" : statusLabel(status)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-4">{[1, 2, 3].map(i => <div key={i} className="h-28 animate-pulse rounded-2xl bg-[var(--surface-subtle)]" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] px-6 py-12 text-center">
          <p className="text-sm text-[var(--text-secondary)]">Aucun signalement pour ce filtre.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map(report => (
            <div key={report.id} className={`rounded-2xl border p-5 ${statusTone(report.status)}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-[var(--text-primary)]">{report.subject}</p>
                    <span className="rounded-full border border-[var(--border-default)] bg-[var(--bg-card)] px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-[var(--text-primary)]">{statusLabel(report.status)}</span>
                    <span className="rounded-full border border-[var(--border-default)] bg-[var(--bg-card)] px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-[var(--text-secondary)]">{report.category}</span>
                    <span className="rounded-full border border-[var(--border-default)] bg-[var(--bg-card)] px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-[var(--text-secondary)]">{report.severity}</span>
                  </div>
                  <p className="mt-1 text-xs text-[var(--text-secondary)]">
                    {report.user_email || report.user_id}{report.page_context ? ` · ${report.page_context}` : ""}
                  </p>
                </div>
                <p className="text-[11px] text-[var(--text-secondary)]">
                  {report.created_at ? new Date(report.created_at).toLocaleString("fr-FR") : ""}
                </p>
              </div>

              <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-[var(--text-primary)]">{report.message}</p>

              {(report.contact_email || report.contact_phone || report.expected_behavior) && (
                <div className="mt-4 grid gap-2 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-4 text-sm">
                  {report.contact_email && <p className="text-[var(--text-primary)]">Email : <span className="font-medium">{report.contact_email}</span></p>}
                  {report.contact_phone && <p className="text-[var(--text-primary)]">Tél / WhatsApp : <span className="font-medium">{report.contact_phone}</span></p>}
                  {report.expected_behavior && <p className="text-[var(--text-secondary)]">Attendu : {report.expected_behavior}</p>}
                </div>
              )}

              <div className="mt-4 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-4">
                <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--text-secondary)]">Note admin</p>
                <textarea
                  value={noteDrafts[report.id] ?? report.admin_note ?? ""}
                  onChange={e => setNoteDrafts(p => ({ ...p, [report.id]: e.target.value }))}
                  rows={3}
                  className="mt-2 w-full rounded-xl border border-[var(--border-default)] bg-[var(--surface-subtle)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--border-subtle)]"
                />
                <div className="mt-3 flex flex-wrap gap-2">
                  <button onClick={() => void handleUpdate(report.id, { status: "in_review", admin_note: noteDrafts[report.id] ?? report.admin_note ?? "" })}
                    disabled={busyId === report.id}
                    className="rounded-xl border border-[var(--border-default)] px-3 py-2 text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--surface-subtle)] disabled:opacity-45">
                    Prendre en charge
                  </button>
                  <button onClick={() => void handleUpdate(report.id, { admin_note: noteDrafts[report.id] ?? report.admin_note ?? "" })}
                    disabled={busyId === report.id}
                    className="rounded-xl border border-[var(--border-default)] px-3 py-2 text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--surface-subtle)] disabled:opacity-45">
                    Sauvegarder la note
                  </button>
                  <button onClick={() => void handleUpdate(report.id, { status: "resolved", admin_note: noteDrafts[report.id] ?? report.admin_note ?? "" })}
                    disabled={busyId === report.id}
                    className="rounded-xl bg-orange-500 px-3 py-2 text-xs font-semibold text-white hover:bg-orange-600 disabled:opacity-45">
                    Marquer traité
                  </button>
                  <button onClick={() => void handleUpdate(report.id, { status: "dismissed", admin_note: noteDrafts[report.id] ?? report.admin_note ?? "" })}
                    disabled={busyId === report.id}
                    className="rounded-xl border border-[var(--border-default)] px-3 py-2 text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--surface-subtle)] disabled:opacity-45">
                    Ignorer
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
