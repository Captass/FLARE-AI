"use client";

import React, { useState } from "react";
import { motion, type Variants } from "framer-motion";
import { Facebook, Loader2, Plus, RefreshCw, Trash2 } from "lucide-react";

import type { FacebookMessengerPage } from "@/lib/facebookMessenger";

export interface FacebookConnectionSummary {
  oauthConfigured?: boolean;
  directServiceConfigured?: boolean;
  permissionWarningCount?: number;
  accessMessage?: string | null;
}

interface PageSelectorProps {
  pages: FacebookMessengerPage[];
  selectedPageId: string | null;
  onSelect: (pageId: string) => void;
  onConnectMetaPages: () => void;
  onSyncPagesList?: () => void;
  loading?: boolean;
  connectMetaBusy?: boolean;
  syncListBusy?: boolean;
  onActivatePage?: (pageId: string) => void;
  onDeactivatePage?: (pageId: string) => void;
  onRemovePage?: (pageId: string) => void;
  canManagePages?: boolean;
  busyPageId?: string | null;
  connectionSummary?: FacebookConnectionSummary | null;
}

const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
    },
  },
};

const itemAnim: Variants = {
  hidden: { opacity: 0, y: 15 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } },
};

export default function PageSelector({
  pages,
  selectedPageId,
  onSelect,
  onConnectMetaPages,
  onSyncPagesList,
  loading = false,
  connectMetaBusy = false,
  syncListBusy = false,
  onActivatePage,
  onDeactivatePage,
  onRemovePage,
  canManagePages = false,
  busyPageId = null,
  connectionSummary = null,
}: PageSelectorProps) {
  const [pendingRemovePageId, setPendingRemovePageId] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="flex min-h-[100px] items-center gap-4 p-4">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-orange-500/20 border-t-orange-500" />
        <span className="text-sm font-medium text-[var(--text-secondary)]">Chargement des pages Facebook...</span>
      </div>
    );
  }

  const metaDisabled = !canManagePages || connectMetaBusy || syncListBusy;
  const syncDisabled = !canManagePages || !onSyncPagesList || syncListBusy || connectMetaBusy;
  const showActivate = typeof onActivatePage === "function";
  const showDeactivate = typeof onDeactivatePage === "function";
  const showRemove = typeof onRemovePage === "function";
  const hasConnectionWarning =
    (connectionSummary?.permissionWarningCount || 0) > 0 ||
    connectionSummary?.oauthConfigured === false ||
    connectionSummary?.directServiceConfigured === false;

  if (pages.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative w-full overflow-hidden rounded-[28px] border border-[var(--border-default)] bg-[var(--surface-base)] p-8 text-center shadow-[0_20px_60px_rgba(15,23,42,0.04)]"
      >
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#f59e0b]/10 blur-[80px]" />

        <div className="relative z-10 flex flex-col items-center gap-4">
          <div className="mb-2 flex h-16 w-16 items-center justify-center rounded-2xl border border-[#1877F2]/25 bg-[#eff6ff]">
            <Facebook className="h-8 w-8 text-[#1877F2]" />
          </div>
          <div>
            <h3 className="mb-1 text-lg font-semibold text-[var(--text-primary)]">Aucune page Facebook connectee</h3>
            <p className="mx-auto max-w-lg text-sm leading-relaxed text-[var(--text-secondary)]">
              Ouvrez Meta pour importer vos pages, puis activez celle que vous voulez piloter avec FLARE.
            </p>
            {hasConnectionWarning ? (
              <div className="mx-auto mt-4 max-w-lg rounded-2xl border border-[#f59e0b]/20 bg-[#fff7ed] px-4 py-3 text-xs leading-relaxed text-[#7c2d12]">
                Si Meta affiche <strong>&quot;Fonctionnalite indisponible&quot;</strong>, le blocage vient de Facebook avant le retour vers FLARE.
              </div>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => onConnectMetaPages()}
            disabled={metaDisabled}
            title={!canManagePages ? "Reserve au proprietaire ou a un admin du compte." : undefined}
            className="mt-2 flex items-center gap-2 rounded-xl border border-[#1877F2]/20 bg-[#1877F2] px-6 py-2.5 font-medium text-white shadow-[0_18px_40px_rgba(24,119,242,0.18)] transition-all hover:translate-y-[-1px] hover:bg-[#1666d5] disabled:pointer-events-none disabled:opacity-45"
          >
            {connectMetaBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Ouvrir Meta et importer mes pages
          </button>
          <ConnectionSummaryCard
            pages={pages}
            canManagePages={canManagePages}
            connectionSummary={connectionSummary}
          />
        </div>
      </motion.div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-[28px] border border-[var(--border-default)] bg-[linear-gradient(180deg,#ffffff_0%,#faf7f2_100%)] p-5 shadow-[0_20px_50px_rgba(15,23,42,0.05)]">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold text-[var(--text-primary)]">
            <Facebook className="h-5 w-5 text-[#1877F2]" />
            Vos pages Facebook
          </h2>
            <p className="mt-1 max-w-xl text-sm leading-relaxed text-[var(--text-secondary)]">
              Une seule surface pour connecter Meta, choisir la page active et piloter l&apos;etat du bot sans bruit technique.
            </p>
        </div>
          <div className="flex flex-wrap items-center gap-2">
            {onSyncPagesList ? (
              <button
                type="button"
                onClick={() => onSyncPagesList()}
                disabled={syncDisabled}
                title="Synchroniser les pages si vous en avez ajoute a l'autorisation existante"
                className="inline-flex items-center gap-2 rounded-xl border border-[var(--border-default)] bg-[var(--surface-base)] px-3.5 py-2 text-xs font-medium text-[var(--text-primary)] transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--surface-raised)] disabled:pointer-events-none disabled:opacity-40"
              >
                {syncListBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                Actualiser
              </button>
            ) : null}

            <button
              type="button"
              onClick={() => onConnectMetaPages()}
              disabled={metaDisabled}
              title={!canManagePages ? "Reserve au proprietaire ou a un admin du compte." : undefined}
              className="inline-flex items-center gap-2 rounded-xl border border-[#1877F2]/15 bg-[#1877F2] px-3.5 py-2 text-xs font-medium text-white transition-colors hover:bg-[#1666d5] disabled:pointer-events-none disabled:opacity-40"
            >
              {connectMetaBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              Ouvrir Meta
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <QuickStatChip label="Pages importees" value={String(pages.length)} tone="neutral" />
          <QuickStatChip
            label="Pages actives"
            value={String(pages.filter((page) => page.is_active && page.webhook_subscribed).length)}
            tone="success"
          />
          <QuickStatChip
            label="Gestion"
            value={canManagePages ? "Admin" : "Lecture seule"}
            tone={canManagePages ? "neutral" : "warning"}
          />
          {hasConnectionWarning ? (
            <QuickStatChip label="Etat" value="Verification requise" tone="warning" />
          ) : null}
        </div>
      </div>

      {!canManagePages ? (
        <div className="rounded-2xl border border-red-500/18 bg-[#fef2f2] px-4 py-3 text-sm leading-snug text-[#7f1d1d]">
          Seuls le proprietaire ou un admin du compte peuvent gerer Facebook.
        </div>
      ) : null}

      <ConnectionSummaryCard pages={pages} canManagePages={canManagePages} connectionSummary={connectionSummary} />

      {hasConnectionWarning ? (
        <div className="rounded-2xl border border-[#f59e0b]/20 bg-[#fff7ed] px-4 py-3 text-xs leading-relaxed text-[#7c2d12]">
          Si la popup Facebook affiche <strong>&quot;Fonctionnalite indisponible&quot;</strong>, le blocage vient de Meta avant le retour vers FLARE.
        </div>
      ) : null}

      <motion.div variants={staggerContainer} initial="hidden" animate="show" className="grid gap-3">
        {pages.map((page) => {
          const isSelected = page.page_id === selectedPageId;
          const isBotOn = page.is_active && page.webhook_subscribed;
          const hasDirectSyncLag = isBotOn && !page.direct_service_synced;
          const isPartiallyActive = page.is_active || page.webhook_subscribed || page.direct_service_synced;
          const isBusy = busyPageId === page.page_id;
          const initialBadge = page.page_name.substring(0, 2).toUpperCase();
          const statusTone = page.status === "reconnect_required" ? "danger" : isBotOn ? "success" : "muted";
          const statusLabel = page.status === "reconnect_required" ? "Reconnexion requise" : isBotOn ? "Bot actif" : "Bot inactif";

          return (
            <motion.div
              key={page.page_id}
              variants={itemAnim}
              className={`group relative flex flex-col gap-4 rounded-[26px] border p-5 text-left transition-all sm:flex-row sm:items-center ${
                isSelected
                  ? "border-[#f59e0b]/45 bg-[linear-gradient(180deg,#fffaf2_0%,#fff7ed_100%)] shadow-[0_22px_50px_rgba(245,158,11,0.12)]"
                  : "border-[var(--border-default)] bg-[var(--surface-base)] hover:border-[#cbd5e1] hover:shadow-[0_12px_30px_rgba(15,23,42,0.05)]"
              }`}
            >
              {isSelected ? (
                <div className="absolute inset-x-0 -bottom-px mx-auto h-px w-2/3 bg-gradient-to-r from-transparent via-[#f59e0b]/60 to-transparent" />
              ) : null}

              <div
                role="button"
                tabIndex={0}
                onClick={() => onSelect(page.page_id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onSelect(page.page_id);
                  }
                }}
                className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-orange-500/50"
              >
                <div className="relative shrink-0">
                  {page.page_picture_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={page.page_picture_url}
                      alt={page.page_name}
                      className={`h-11 w-11 rounded-full border object-cover ${isSelected ? "border-[#f59e0b]/45" : "border-[var(--border-default)]"}`}
                    />
                  ) : (
                    <div
                      className={`flex h-11 w-11 items-center justify-center rounded-full border text-sm font-bold ${
                        isSelected
                          ? "border-[#f59e0b]/35 bg-[#fff3e0] text-[#b45309]"
                          : "border-[var(--border-default)] bg-[var(--surface-subtle)] text-[var(--text-secondary)]"
                      }`}
                    >
                      {initialBadge}
                    </div>
                  )}
                  <div
                    className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-[var(--surface-base)] ${
                      isBotOn ? "bg-emerald-500" : "bg-red-500"
                    }`}
                    title={isBotOn ? "Bot ON" : "Bot OFF"}
                  />
                </div>

                <div className="flex min-w-0 flex-col">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-base font-semibold text-[var(--text-primary)]">{page.page_name}</span>
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                        statusTone === "success"
                          ? "bg-[#ecfdf3] text-[#166534]"
                          : statusTone === "danger"
                            ? "bg-[#fef2f2] text-[#991b1b]"
                            : "bg-[var(--surface-subtle)] text-[var(--text-secondary)]"
                      }`}
                    >
                      {statusLabel}
                    </span>
                    {isSelected ? (
                      <span className="inline-flex rounded-full bg-[#fff3e0] px-2.5 py-1 text-[11px] font-semibold text-[#b45309]">
                        Page active dans FLARE
                      </span>
                    ) : null}
                  </div>
                  <span className="mt-1 text-sm text-[var(--text-secondary)]">
                    {isBotOn
                      ? "Le chatbot repond sur Messenger."
                      : page.status === "reconnect_required"
                        ? "L'autorisation Facebook doit etre renouvelee."
                        : "Le chatbot est present mais coupe sur cette page."}
                  </span>
                  {hasDirectSyncLag ? (
                    <span
                      className="mt-1 truncate text-xs text-[var(--text-secondary)]"
                      title="Le bot repond deja, mais la synchronisation des stats Messenger est encore indisponible."
                    >
                      Stats Messenger en attente de synchronisation.
                    </span>
                  ) : null}
                  {page.last_error ? (
                    <span className="mt-1 truncate text-xs text-[#991b1b]" title={page.last_error}>
                      {page.last_error}
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-3 sm:pl-2">
                {(showActivate || showDeactivate) && canManagePages ? (
                  <div className="rounded-2xl border border-black/5 bg-white/70 px-3 py-2 shadow-[0_10px_20px_rgba(15,23,42,0.04)]">
                    <div className="flex items-center gap-2">
                    <span className={`text-xs font-semibold uppercase tracking-widest ${isBotOn ? "text-[#166534]" : "text-[#991b1b]"}`}>
                      {isBotOn ? "ON" : "OFF"}
                    </span>
                    <button
                      type="button"
                      disabled={isBusy || !canManagePages}
                      onClick={(event) => {
                        event.stopPropagation();
                        if (isBotOn) {
                          onDeactivatePage?.(page.page_id);
                        } else {
                          onActivatePage?.(page.page_id);
                        }
                      }}
                      className={`relative flex h-8 w-14 items-center rounded-full border transition-all ${
                        isBotOn
                          ? "border-[#10b981]/35 bg-[#d1fae5]"
                          : "border-[#f97316]/30 bg-[#ffedd5]"
                      } ${isBusy ? "opacity-60" : "cursor-pointer hover:opacity-90"}`}
                      title={isBotOn ? "Desactiver le bot sur cette page" : "Activer le bot sur cette page"}
                    >
                      {isBusy ? (
                        <Loader2 className="absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 animate-spin text-[var(--text-secondary)]" />
                      ) : (
                        <motion.div
                          layout
                          transition={{ type: "spring", stiffness: 500, damping: 30 }}
                          className={`h-6 w-6 rounded-full shadow-md ${
                            isBotOn ? "ml-[26px] bg-[#10b981]" : "ml-1 bg-[#f97316]"
                          }`}
                        />
                      )}
                    </button>
                    </div>
                  </div>
                ) : null}

                {showRemove && canManagePages && !isPartiallyActive ? (
                  pendingRemovePageId === page.page_id ? (
                    <div className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-2 py-1.5">
                      <span className="text-[11px] font-medium text-[var(--text-primary)]">Supprimer ?</span>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={(event) => {
                          event.stopPropagation();
                          onRemovePage?.(page.page_id);
                          setPendingRemovePageId(null);
                        }}
                        className="rounded-md bg-red-600 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-white disabled:opacity-50"
                      >
                        Oui
                      </button>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={(event) => {
                          event.stopPropagation();
                          setPendingRemovePageId(null);
                        }}
                      className="rounded-md border border-[var(--border-default)] bg-[var(--surface-base)] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-primary)] disabled:opacity-50"
                      >
                        Non
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={(event) => {
                        event.stopPropagation();
                        setPendingRemovePageId(page.page_id);
                      }}
                      className="inline-flex items-center rounded-lg border border-red-500/20 bg-[#fef2f2] p-2 text-[#b91c1c] transition-colors hover:bg-red-500/10 disabled:opacity-50"
                      title="Supprimer cette page"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )
                ) : null}
              </div>
            </motion.div>
          );
        })}
      </motion.div>
    </div>
  );
}

function ConnectionSummaryCard({
  pages,
  canManagePages,
  connectionSummary,
}: {
  pages: FacebookMessengerPage[];
  canManagePages: boolean;
  connectionSummary: FacebookConnectionSummary | null;
}) {
  const activeCount = pages.filter((page) => page.is_active && page.webhook_subscribed).length;
  const warningCount = connectionSummary?.permissionWarningCount || 0;
  const oauthConfigured = connectionSummary?.oauthConfigured;
  const directServiceConfigured = connectionSummary?.directServiceConfigured;

  const lineItems: string[] = [];
  lineItems.push(`${pages.length} page(s) importee(s)`);
  lineItems.push(activeCount > 0 ? `${activeCount} active(s)` : "Aucune page active");
  if (oauthConfigured === false) lineItems.push("Connexion Meta a verifier");
  if (directServiceConfigured === false) lineItems.push("Synchronisation Messenger a finaliser");
  if (!canManagePages) lineItems.push("Gestion reservee owner/admin");
  if (warningCount > 0) lineItems.push(`${warningCount} page(s) a verifier`);

  return (
    <div className="w-full rounded-[24px] border border-[var(--border-default)] bg-[var(--surface-base)] p-4 text-left shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--text-muted)]">Connexion Facebook</p>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Vue simplifiee cote client. Les details techniques Meta restent masques.
          </p>
        </div>
        {connectionSummary?.accessMessage ? (
          <p className="text-xs text-[var(--text-secondary)] sm:max-w-[280px] sm:text-right">{connectionSummary.accessMessage}</p>
        ) : null}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {lineItems.map((item) => (
          <span
            key={item}
            className="rounded-full border border-[var(--border-default)] bg-[var(--surface-subtle)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-secondary)]"
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

function QuickStatChip({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "neutral" | "success" | "warning";
}) {
  const toneClasses =
    tone === "success"
      ? "border-[#bbf7d0] bg-[#ecfdf3] text-[#166534]"
      : tone === "warning"
        ? "border-[#fed7aa] bg-[#fff7ed] text-[#b45309]"
        : "border-[var(--border-default)] bg-[var(--surface-base)] text-[var(--text-secondary)]";

  return (
    <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 ${toneClasses}`}>
      <span className="text-[10px] font-semibold uppercase tracking-[0.12em]">{label}</span>
      <span className="text-xs font-semibold">{value}</span>
    </div>
  );
}
