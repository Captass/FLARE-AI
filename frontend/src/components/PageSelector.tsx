"use client";

import React, { useState } from "react";
import { motion, type Variants } from "framer-motion";
import { Facebook, Loader2, Plus, RefreshCw, Trash2 } from "lucide-react";

import type { FacebookAuthDebugInfo, FacebookMessengerPage } from "@/lib/facebookMessenger";

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
  authDebug?: FacebookAuthDebugInfo | null;
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
  authDebug = null,
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

  if (pages.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative w-full overflow-hidden rounded-2xl border border-[var(--border-default)] bg-[var(--surface-base)] p-8 text-center"
      >
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-orange-500/10 blur-[80px]" />

        <div className="relative z-10 flex flex-col items-center gap-4">
          <div className="mb-2 flex h-16 w-16 items-center justify-center rounded-2xl border border-[#1877F2]/30 bg-gradient-to-br from-[#1877F2]/20 to-transparent">
            <Facebook className="h-8 w-8 text-[#1877F2]" />
          </div>
          <div>
            <h3 className="mb-1 text-lg font-semibold text-[var(--text-primary)]">Aucune page Facebook enregistree</h3>
            <p className="mx-auto max-w-lg text-left text-sm leading-relaxed text-[var(--text-secondary)] sm:text-center">
              <strong className="text-[var(--text-primary)]">Etape 1 - Autorisation Facebook :</strong> une fenetre Facebook se lance. Autorisez votre compte pour importer vos pages dans FLARE.
              <br />
              <strong className="text-[var(--text-primary)]">Etape 2 - Activation :</strong> vos pages apparaissent ici ; choisissez-en une puis cliquez sur <strong className="text-[var(--text-primary)]">Activer</strong>.
            </p>
            <div className="mx-auto mt-3 max-w-lg rounded-xl border border-orange-500/20 bg-orange-500/10 px-4 py-3 text-left text-xs leading-relaxed text-[var(--text-primary)] sm:text-center">
              Si Facebook affiche <strong>&quot;Fonctionnalite indisponible&quot;</strong>, le blocage vient de Meta. FLARE ne peut pas terminer l&apos;import tant que l&apos;app Meta n&apos;est pas ouverte aux nouveaux comptes publics.
            </div>
          </div>
          <button
            type="button"
            onClick={() => onConnectMetaPages()}
            disabled={metaDisabled}
            title={!canManagePages ? "Reserve au proprietaire ou a un admin du compte." : undefined}
            className="mt-2 flex items-center gap-2 rounded-xl border border-orange-500/30 bg-orange-500/15 px-6 py-2.5 font-medium text-orange-600 shadow-[0_0_20px_rgba(249,115,22,0.1)] transition-all hover:bg-orange-500/25 hover:shadow-[0_0_25px_rgba(249,115,22,0.2)] disabled:pointer-events-none disabled:opacity-45 dark:text-orange-300"
          >
            {connectMetaBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Ouvrir Meta et importer mes pages
          </button>
          {authDebug ? <OAuthDebugCard authDebug={authDebug} /> : null}
        </div>
      </motion.div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 border-b border-[var(--divide-default)] pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold text-[var(--text-primary)]">
            <Facebook className="h-5 w-5 text-[#1877F2]" />
            Vos pages Facebook
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {onSyncPagesList ? (
            <button
              type="button"
              onClick={() => onSyncPagesList()}
              disabled={syncDisabled}
              title="Synchroniser les pages si vous en avez ajoute a l'autorisation existante"
              className="inline-flex items-center gap-2 rounded-lg border border-[var(--border-default)] bg-[var(--surface-subtle)] px-3 py-1.5 text-xs font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-raised)] disabled:pointer-events-none disabled:opacity-40"
            >
              {syncListBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              Actualiser la liste
            </button>
          ) : null}

          <button
            type="button"
            onClick={() => onConnectMetaPages()}
            disabled={metaDisabled}
            title={!canManagePages ? "Reserve au proprietaire ou a un admin du compte." : undefined}
            className="inline-flex items-center gap-2 rounded-lg border border-[#1877F2]/20 bg-[#1877F2]/10 px-3 py-1.5 text-xs font-medium text-[#1877F2] transition-colors hover:bg-[#1877F2]/15 disabled:pointer-events-none disabled:opacity-40"
          >
            {connectMetaBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            Ouvrir Meta
          </button>
        </div>
      </div>

      {!canManagePages ? (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm leading-snug text-[var(--text-primary)]">
          Seuls le proprietaire ou un admin du compte peuvent gerer Facebook.
        </div>
      ) : null}

      <div className="rounded-lg border border-[var(--border-default)] bg-[var(--surface-subtle)] p-3 text-xs leading-relaxed text-[var(--text-secondary)]">
        <strong className="text-[var(--text-primary)]">Choisir dans FLARE :</strong> cliquez sur une carte pour configurer la personnalisation. <strong className="text-[var(--text-primary)]">Messenger :</strong> utilisez le toggle <strong className="text-emerald-600 dark:text-emerald-300">ON</strong> / <strong className="text-red-600 dark:text-red-300">OFF</strong> pour activer ou desactiver le bot sur cette page.
      </div>

      <div className="rounded-lg border border-orange-500/20 bg-orange-500/10 px-4 py-3 text-xs leading-relaxed text-[var(--text-primary)]">
        Si la popup Facebook affiche <strong>&quot;Fonctionnalite indisponible&quot;</strong>, le blocage vient de Meta avant le retour vers FLARE.
      </div>

      {authDebug ? <OAuthDebugCard authDebug={authDebug} /> : null}

      <motion.div variants={staggerContainer} initial="hidden" animate="show" className="grid gap-3">
        {pages.map((page) => {
          const isSelected = page.page_id === selectedPageId;
          const isBotOn = page.is_active && page.webhook_subscribed;
          const hasDirectSyncLag = isBotOn && !page.direct_service_synced;
          const isPartiallyActive = page.is_active || page.webhook_subscribed || page.direct_service_synced;
          const isBusy = busyPageId === page.page_id;
          const initialBadge = page.page_name.substring(0, 2).toUpperCase();

          return (
            <motion.div
              key={page.page_id}
              variants={itemAnim}
              className={`group relative flex flex-col gap-3 rounded-xl border p-4 text-left transition-all sm:flex-row sm:items-center ${
                isSelected
                  ? "border-orange-500/40 bg-orange-500/[0.06] shadow-[0_0_28px_rgba(249,115,22,0.1)]"
                  : "border-[var(--border-default)] bg-[var(--surface-base)] hover:border-[var(--border-strong)]"
              }`}
            >
              {isSelected ? (
                <div className="absolute inset-x-0 -bottom-px mx-auto h-px w-2/3 bg-gradient-to-r from-transparent via-orange-500/60 to-transparent" />
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
                      className={`h-11 w-11 rounded-full border object-cover ${isSelected ? "border-orange-500/50" : "border-[var(--border-default)]"}`}
                    />
                  ) : (
                    <div
                      className={`flex h-11 w-11 items-center justify-center rounded-full border text-sm font-bold ${
                        isSelected
                          ? "border-orange-500/30 bg-orange-500/10 text-orange-600 dark:text-orange-300"
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
                  <span className="truncate text-base font-semibold text-[var(--text-primary)]">{page.page_name}</span>
                  <span className="truncate font-mono text-sm text-[var(--text-secondary)]">ID - {page.page_id}</span>
                  <span className="mt-0.5 text-sm">
                    {isBotOn ? (
                      <span className="font-medium text-emerald-600 dark:text-emerald-300">Bot ON (reponses actives)</span>
                    ) : page.status === "reconnect_required" ? (
                      <span className="font-medium text-red-600 dark:text-red-300">Reconnexion requise</span>
                    ) : (
                      <span className="font-medium text-red-600 dark:text-red-300">Bot OFF (aucune reponse)</span>
                    )}
                  </span>
                  {hasDirectSyncLag ? (
                    <span
                      className="mt-0.5 truncate text-xs text-[var(--text-secondary)]"
                      title="Le bot repond deja, mais la synchronisation des stats Messenger est encore indisponible."
                    >
                      Reponses actives. Synchronisation dashboard en attente.
                    </span>
                  ) : null}
                  {page.last_error ? (
                    <span className="mt-0.5 truncate text-xs text-red-600 dark:text-red-300" title={page.last_error}>
                      {page.last_error}
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-3 sm:pl-2">
                {isSelected ? (
                  <span className="mr-1 hidden text-xs font-semibold uppercase tracking-wide text-orange-600 dark:text-orange-300 sm:inline">
                    Selection FLARE
                  </span>
                ) : null}

                {(showActivate || showDeactivate) && canManagePages ? (
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-semibold uppercase tracking-widest ${isBotOn ? "text-emerald-600 dark:text-emerald-300" : "text-red-600 dark:text-red-300"}`}>
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
                          ? "border-emerald-500/30 bg-emerald-500/20"
                          : "border-red-500/20 bg-red-500/10"
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
                            isBotOn ? "ml-[26px] bg-emerald-400" : "ml-1 bg-red-400"
                          }`}
                        />
                      )}
                    </button>
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
                      className="inline-flex items-center rounded-lg border border-red-500/20 bg-red-500/10 p-2 text-red-600 transition-colors hover:bg-red-500/20 disabled:opacity-50 dark:text-red-300"
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

function OAuthDebugCard({ authDebug }: { authDebug: FacebookAuthDebugInfo }) {
  return (
    <div className="w-full rounded-xl border border-[var(--border-default)] bg-[var(--surface-subtle)] p-4 text-left">
      <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--text-muted)]">Verification Facebook</p>
      <p className="mt-1 text-xs text-[var(--text-secondary)]">
        Ce bloc montre simplement quelle application Facebook FLARE utilise vraiment.
      </p>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <DebugItem label="App ID" value={authDebug.client_id} />
        <DebugItem label="Version" value={authDebug.graph_version} />
        <DebugItem label="Retour Facebook" value={authDebug.redirect_uri} fullWidth />
        <DebugItem label="Autorisations" value={authDebug.scopes.join(", ")} fullWidth />
      </div>
    </div>
  );
}

function DebugItem({
  label,
  value,
  fullWidth = false,
}: {
  label: string;
  value: string;
  fullWidth?: boolean;
}) {
  return (
    <div className={fullWidth ? "md:col-span-2" : ""}>
      <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--text-muted)]">{label}</p>
      <p className="mt-1 break-all rounded-lg border border-[var(--border-default)] bg-[var(--surface-base)] px-3 py-2 font-mono text-[12px] text-[var(--text-primary)]">
        {value || "Non configure"}
      </p>
    </div>
  );
}
