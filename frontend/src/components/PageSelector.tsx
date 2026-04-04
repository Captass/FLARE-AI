"use client";

import React from "react";
import { motion, type Variants } from "framer-motion";
import { Facebook, Loader2, Plus, RefreshCw, Power, PowerOff, Trash2 } from "lucide-react";
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
  if (loading) {
    return (
      <div className="flex min-h-[100px] items-center gap-4 p-4">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-orange-500/20 border-t-orange-500" />
        <span className="text-sm font-medium text-fg/50">Chargement des pages Facebook...</span>
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
        className="relative w-full overflow-hidden rounded-2xl border border-fg/[0.07] bg-[var(--bg-card)] p-8 text-center"
      >
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-orange-500/10 blur-[80px]" />

        <div className="relative z-10 flex flex-col items-center gap-4">
          <div className="mb-2 flex h-16 w-16 items-center justify-center rounded-2xl border border-[#1877F2]/30 bg-gradient-to-br from-[#1877F2]/20 to-transparent">
            <Facebook className="h-8 w-8 text-[#1877F2]" />
          </div>
          <div>
            <h3 className="mb-1 text-lg font-semibold text-fg/90">Aucune page Facebook enregistrée</h3>
            <p className="mx-auto max-w-lg text-left text-sm leading-relaxed text-fg/50 sm:text-center">
              <strong className="text-fg/70">Étape 1 - Autorisation Facebook :</strong> une fenêtre Facebook se lance. Autorisez votre compte pour importer vos pages dans FLARE.
              <br />
              <strong className="text-fg/70">Étape 2 - Activation :</strong> vos pages apparaissent ici ; choisissez-en une puis cliquez sur <strong className="text-fg/70">Activer</strong>.
            </p>
            <div className="mx-auto mt-3 max-w-lg rounded-xl border border-orange-500/20 bg-orange-500/10 px-4 py-3 text-left text-xs leading-relaxed text-orange-100/90 sm:text-center">
              Si Facebook affiche <strong>&quot;Fonctionnalité indisponible&quot;</strong>, le blocage vient de Meta. FLARE ne peut pas terminer l&apos;import tant que l&apos;app Meta n&apos;est pas ouverte aux nouveaux comptes publics.
            </div>
          </div>
          <button
            type="button"
            onClick={() => onConnectMetaPages()}
            disabled={metaDisabled}
            title={!canManagePages ? "Réservé au propriétaire ou à un admin de l'espace." : undefined}
            className="mt-2 flex items-center gap-2 rounded-xl border border-orange-500/30 bg-orange-500/15 px-6 py-2.5 font-medium text-orange-500 shadow-[0_0_20px_rgba(249,115,22,0.1)] transition-all hover:bg-orange-500/25 hover:shadow-[0_0_25px_rgba(249,115,22,0.2)] disabled:pointer-events-none disabled:opacity-45"
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
      <div className="flex flex-col gap-4 border-b border-fg/[0.04] pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold text-fg/90">
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
              title="Synchroniser les pages si vous en avez ajouté à l'autorisation existante"
              className="inline-flex items-center gap-2 rounded-lg border border-fg/[0.08] bg-fg/[0.03] px-3 py-1.5 text-xs font-medium text-fg/60 transition-colors hover:bg-fg/[0.06] hover:text-fg/90 disabled:pointer-events-none disabled:opacity-40"
            >
              {syncListBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              Actualiser la liste
            </button>
          ) : null}

          <button
            type="button"
            onClick={() => onConnectMetaPages()}
            disabled={metaDisabled}
            title={!canManagePages ? "Réservé au propriétaire ou à un admin de l'espace." : undefined}
            className="inline-flex items-center gap-2 rounded-lg border border-[#1877F2]/20 bg-[#1877F2]/10 px-3 py-1.5 text-xs font-medium text-[#1877F2] transition-colors hover:bg-[#1877F2]/15 disabled:pointer-events-none disabled:opacity-40"
          >
            {connectMetaBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            Ouvrir Meta
          </button>
        </div>
      </div>

      {!canManagePages ? (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm leading-snug text-red-200/90">
          Seuls le propriétaire ou un admin de cet espace peuvent gérer Facebook.
        </div>
      ) : null}

      <div className="rounded-lg border border-fg/[0.06] bg-fg/[0.015] p-3 text-xs leading-relaxed text-fg/50">
        <strong className="text-fg/65">Choisir dans FLARE :</strong> cliquez sur une carte pour configurer la personnalisation. <strong className="text-fg/65">Messenger :</strong> utilisez le bouton <strong className="text-emerald-400">Activer</strong> ou <strong className="text-amber-500">Désactiver</strong> pour brancher / débrancher le bot sur une page spécifique.
      </div>

      <div className="rounded-lg border border-orange-500/20 bg-orange-500/10 px-4 py-3 text-xs leading-relaxed text-orange-100/90">
        Si la popup Facebook affiche <strong>&quot;Fonctionnalité indisponible&quot;</strong>, le blocage vient de Meta avant le retour vers FLARE.
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
                  : "border-fg/[0.06] bg-[var(--bg-card)] hover:border-fg/[0.12]"
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
                      className={`h-11 w-11 rounded-full border object-cover ${isSelected ? "border-orange-500/50" : "border-fg/10"}`}
                    />
                  ) : (
                    <div
                      className={`flex h-11 w-11 items-center justify-center rounded-full border text-sm font-bold ${
                        isSelected
                          ? "border-orange-500/30 bg-orange-500/10 text-orange-500"
                          : "border-fg/10 bg-fg/5 text-fg/60"
                      }`}
                    >
                      {initialBadge}
                    </div>
                  )}
                  <div
                    className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-[var(--bg-background)] ${
                      isBotOn ? "bg-emerald-500" : "bg-amber-500"
                    }`}
                    title={isBotOn ? "Bot ON" : "Bot OFF"}
                  />
                </div>

                <div className="flex min-w-0 flex-col">
                  <span className={`truncate text-base font-semibold ${isSelected ? "text-fg/95" : "text-fg/80"}`}>
                    {page.page_name}
                  </span>
                  <span className="truncate font-mono text-sm text-fg/45">ID - {page.page_id}</span>
                  <span className="mt-0.5 text-sm">
                    {isBotOn ? (
                      <span className="font-medium text-emerald-400/90">Bot ON (réponses actives)</span>
                    ) : page.status === "reconnect_required" ? (
                      <span className="font-medium text-red-400/90">Reconnexion requise</span>
                    ) : (
                      <span className="font-medium text-amber-500/90">Bot OFF (aucune réponse)</span>
                    )}
                  </span>
                  {hasDirectSyncLag ? (
                    <span
                      className="mt-0.5 truncate text-xs text-amber-400/70"
                      title="Le bot répond déjà, mais la synchronisation des stats Messenger est encore indisponible."
                    >
                      Réponses actives. Synchronisation dashboard en attente.
                    </span>
                  ) : null}
                  {page.last_error ? (
                    <span className="mt-0.5 truncate text-xs text-red-400/70" title={page.last_error}>
                      {page.last_error}
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2 sm:pl-2">
                {isSelected ? (
                  <span className="mr-2 hidden text-xs font-semibold uppercase tracking-wide text-orange-400/90 sm:inline sm:text-sm">
                    Sélection FLARE
                  </span>
                ) : null}

                {showActivate && !isBotOn ? (
                  <button
                    type="button"
                    disabled={isBusy || !canManagePages}
                    onClick={(event) => {
                      event.stopPropagation();
                      onActivatePage?.(page.page_id);
                    }}
                    className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/35 bg-emerald-500/15 px-4 py-2 text-sm font-semibold text-emerald-400 transition-colors hover:bg-emerald-500/25 disabled:opacity-50"
                  >
                    {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Power className="h-4 w-4" />}
                    Activer
                  </button>
                ) : null}

                {showDeactivate && isPartiallyActive ? (
                  <button
                    type="button"
                    disabled={isBusy || !canManagePages}
                    onClick={(event) => {
                      event.stopPropagation();
                      onDeactivatePage?.(page.page_id);
                    }}
                    className="inline-flex items-center gap-2 rounded-lg border border-amber-500/25 bg-amber-500/10 px-4 py-2 text-sm font-semibold text-amber-500 transition-colors hover:bg-amber-500/20 disabled:opacity-50"
                  >
                    {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <PowerOff className="h-4 w-4" />}
                    Désactiver
                  </button>
                ) : null}

                {showRemove && canManagePages && !isPartiallyActive ? (
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={(event) => {
                      event.stopPropagation();
                      if (window.confirm(`Voulez-vous vraiment supprimer la page ${page.page_name} de FLARE AI ?`)) {
                        onRemovePage?.(page.page_id);
                      }
                    }}
                    className="inline-flex items-center rounded-lg border border-red-500/20 bg-red-500/10 p-2 text-red-400 transition-colors hover:bg-red-500/20 disabled:opacity-50"
                    title="Supprimer cette page"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
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
    <div className="w-full rounded-xl border border-white/[0.06] bg-white/[0.03] p-4 text-left">
      <p className="text-[11px] uppercase tracking-[0.14em] text-white/30">Verification Facebook</p>
      <p className="mt-1 text-xs text-white/55">
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
      <p className="text-[10px] uppercase tracking-[0.12em] text-white/28">{label}</p>
      <p className="mt-1 break-all rounded-lg border border-white/[0.06] bg-black/20 px-3 py-2 font-mono text-[12px] text-white/78">
        {value || "Non configure"}
      </p>
    </div>
  );
}
