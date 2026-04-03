"use client";

import React from "react";
import { motion, Variants } from "framer-motion";
import { Facebook, Loader2, Plus, RefreshCw, Power, PowerOff, Trash2 } from "lucide-react";
import type { FacebookMessengerPage } from "@/lib/facebookMessenger";

interface PageSelectorProps {
  pages: FacebookMessengerPage[];
  selectedPageId: string | null;
  /** Page choisie pour piloter le catalogue, les KPIs, etc. */
  onSelect: (pageId: string) => void;
  /** Ouvre la fenêtre Meta (OAuth) pour autoriser de nouvelles pages ou rafraîchir le lien compte. */
  onConnectMetaPages: () => void;
  /** Sans OAuth : relit /me/accounts avec le token déjà stocké. */
  onSyncPagesList?: () => void;
  loading?: boolean;
  connectMetaBusy?: boolean;
  syncListBusy?: boolean;
  /** Définir cette page comme canal Messenger actif pour l’organisation */
  onActivatePage?: (pageId: string) => void;
  /** Désactiver le webhook */
  onDeactivatePage?: (pageId: string) => void;
  /** Supprimer la page */
  onRemovePage?: (pageId: string) => void;
  canManagePages?: boolean;
  busyPageId?: string | null;
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
}: PageSelectorProps) {
  if (loading) {
    return (
      <div className="flex gap-4 p-4 min-h-[100px] items-center">
        <div className="w-8 h-8 rounded-full border-2 border-orange-500/20 border-t-orange-500 animate-spin" />
        <span className="text-sm text-fg/50 font-medium">Chargement des pages Facebook…</span>
      </div>
    );
  }

  const metaDisabled = connectMetaBusy || syncListBusy;
  const syncDisabled = !canManagePages || !onSyncPagesList || syncListBusy || connectMetaBusy;

  if (pages.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative overflow-hidden w-full rounded-2xl border border-fg/[0.07] bg-[var(--bg-card)] p-8 text-center"
      >
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-orange-500/10 blur-[80px] rounded-full pointer-events-none" />

        <div className="relative z-10 flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#1877F2]/20 to-transparent flex items-center justify-center border border-[#1877F2]/30 mb-2">
            <Facebook className="w-8 h-8 text-[#1877F2]" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-fg/90 mb-1">Aucune page Facebook enregistrée</h3>
            <p className="text-sm text-fg/50 max-w-lg mx-auto leading-relaxed text-left sm:text-center">
              <strong className="text-fg/70">Étape 1 — Fenêtre Meta :</strong> un écran Facebook s’ouvre (parfois intitulé « continuer » ou « reconnecter »). C’est
              l’autorisation du compte, pas encore le choix dans FLARE.
              <br />
              <strong className="text-fg/70">Étape 2 — Liste FLARE :</strong> après succès, vos pages autorisées apparaissent ici ; cliquez sur une carte pour la
              sélectionner, puis utilisez <strong className="text-fg/70">Activer sur Messenger</strong> pour brancher le webhook.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onConnectMetaPages()}
            disabled={metaDisabled}
            title={!canManagePages ? "Réservé aux membres autorisés à gérer les intégrations." : undefined}
            className="mt-2 px-6 py-2.5 rounded-xl bg-orange-500/15 border border-orange-500/30 text-orange-500 font-medium hover:bg-orange-500/25 transition-all flex items-center gap-2 shadow-[0_0_20px_rgba(249,115,22,0.1)] hover:shadow-[0_0_25px_rgba(249,115,22,0.2)] disabled:opacity-45 disabled:pointer-events-none"
          >
            {connectMetaBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Ouvrir Meta et importer mes pages
          </button>
        </div>
      </motion.div>
    );
  }

  const showActivate = typeof onActivatePage === "function";
  const showDeactivate = typeof onDeactivatePage === "function";
  const showRemove = typeof onRemovePage === "function";

  return (
    <div className="space-y-4">
      {/* ── HEADER ET BOUTONS ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-fg/[0.04] pb-4">
        <div>
          <h2 className="text-lg font-semibold text-fg/90 flex items-center gap-2">
            <Facebook className="w-5 h-5 text-[#1877F2]" />
            Vos pages Facebook
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {onSyncPagesList && (
            <button
              type="button"
              onClick={() => onSyncPagesList()}
              disabled={syncDisabled}
              title="Synchroniser les pages si vous en avez ajouté à l'autorisation existante"
              className="inline-flex items-center gap-2 rounded-lg bg-fg/[0.03] border border-fg/[0.08] px-3 py-1.5 text-xs font-medium text-fg/60 hover:bg-fg/[0.06] hover:text-fg/90 transition-colors disabled:opacity-40 disabled:pointer-events-none"
            >
              {syncListBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              Actualiser la liste
            </button>
          )}

          <button
            type="button"
            onClick={() => onConnectMetaPages()}
            disabled={metaDisabled}
            className="inline-flex items-center gap-2 rounded-lg bg-[#1877F2]/10 border border-[#1877F2]/20 px-3 py-1.5 text-xs font-medium text-[#1877F2] hover:bg-[#1877F2]/15 transition-colors disabled:opacity-40 disabled:pointer-events-none"
          >
            {connectMetaBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
            Ajouter (Meta)
          </button>
        </div>
      </div>

      {!canManagePages && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200/90 leading-snug">
          Vous devez être Owner ou Admin de cet espace FLARE AI pour gérer l’intégration Facebook.
        </div>
      )}

      <div className="rounded-lg bg-fg/[0.015] border border-fg/[0.06] p-3 text-xs leading-relaxed text-fg/50">
        <strong className="text-fg/65">Choisir dans FLARE :</strong> cliquez sur une carte pour configurer la personnalisation.{" "}
        <strong className="text-fg/65">Messenger :</strong> utilisez le bouton <strong className="text-emerald-400">Activer</strong> ou <strong className="text-amber-500">Désactiver</strong> pour brancher / débrancher le bot sur une page spécifique.
      </div>

      <motion.div variants={staggerContainer} initial="hidden" animate="show" className="grid gap-3">
        {pages.map((page) => {
          const isSelected = page.page_id === selectedPageId;
          const isBotOn = page.is_active && page.webhook_subscribed;
          const hasDirectSyncLag = isBotOn && !page.direct_service_synced;
          const isPartiallyActive = page.is_active || page.webhook_subscribed || page.direct_service_synced;
          const isBusy = busyPageId === page.page_id;
          const InitialBadge = page.page_name.substring(0, 2).toUpperCase();

          return (
            <motion.div
              key={page.page_id}
              variants={itemAnim}
              className={`group relative flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-xl border text-left transition-all ${
                isSelected
                  ? "bg-orange-500/[0.06] border-orange-500/40 shadow-[0_0_28px_rgba(249,115,22,0.1)]"
                  : "bg-[var(--bg-card)] border-fg/[0.06] hover:border-fg/[0.12]"
              }`}
            >
              {isSelected && (
                <div className="absolute inset-x-0 -bottom-px mx-auto h-px w-2/3 bg-gradient-to-r from-transparent via-orange-500/60 to-transparent" />
              )}

              <div
                role="button"
                tabIndex={0}
                onClick={() => onSelect(page.page_id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelect(page.page_id);
                  }
                }}
                className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-orange-500/50"
              >
                <div className="relative shrink-0">
                  {page.page_picture_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={page.page_picture_url}
                      alt={page.page_name}
                      className={`w-11 h-11 rounded-full object-cover border ${isSelected ? "border-orange-500/50" : "border-fg/10"}`}
                    />
                  ) : (
                    <div
                      className={`w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold border ${
                        isSelected ? "bg-orange-500/10 text-orange-500 border-orange-500/30" : "bg-fg/5 text-fg/60 border-fg/10"
                      }`}
                    >
                      {InitialBadge}
                    </div>
                  )}
                  <div
                    className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-[var(--bg-background)] ${
                      isBotOn ? "bg-emerald-500" : "bg-amber-500"
                    }`}
                    title={isBotOn ? "Bot ON" : "Bot OFF"}
                  />
                </div>

                <div className="flex flex-col min-w-0">
                  <span className={`text-base font-semibold truncate ${isSelected ? "text-fg/95" : "text-fg/80"}`}>
                    {page.page_name}
                  </span>
                  <span className="text-sm text-fg/45 font-mono truncate">ID · {page.page_id}</span>
                  <span className="text-sm mt-0.5">
                    {isBotOn ? (
                      <span className="text-emerald-400/90 font-medium">Bot ON (reponses actives)</span>
                    ) : page.status === "reconnect_required" ? (
                      <span className="text-red-400/90 font-medium">Reconnexion requise</span>
                    ) : (
                      <span className="text-amber-500/90 font-medium">Bot OFF (aucune reponse)</span>
                    )}
                  </span>
                  {hasDirectSyncLag ? (
                    <span className="text-xs text-amber-400/70 mt-0.5 truncate" title="Le bot repond deja, mais la synchronisation des stats Messenger est encore indisponible.">
                      Reponses actives. Synchronisation dashboard en attente.
                    </span>
                  ) : null}
                  {page.last_error && (
                    <span className="text-xs text-red-400/70 mt-0.5 truncate" title={page.last_error}>
                      {page.last_error}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 sm:pl-2">
                {isSelected && (
                  <span className="text-xs sm:text-sm font-semibold uppercase tracking-wide text-orange-400/90 hidden sm:inline mr-2">
                    Sélection FLARE
                  </span>
                )}
                
                {showActivate && !isBotOn && (
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={(e) => {
                      e.stopPropagation();
                      onActivatePage?.(page.page_id);
                    }}
                    className="px-4 py-2 rounded-lg bg-emerald-500/15 border border-emerald-500/35 text-emerald-400 text-sm font-semibold hover:bg-emerald-500/25 transition-colors disabled:opacity-50 inline-flex items-center gap-2"
                  >
                    {isBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Power className="w-4 h-4" />}
                    Activer
                  </button>
                )}

                {showDeactivate && isPartiallyActive && (
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeactivatePage?.(page.page_id);
                    }}
                    className="px-4 py-2 rounded-lg bg-amber-500/10 border border-amber-500/25 text-amber-500 text-sm font-semibold hover:bg-amber-500/20 transition-colors disabled:opacity-50 inline-flex items-center gap-2"
                  >
                    {isBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <PowerOff className="w-4 h-4" />}
                    Désactiver
                  </button>
                )}
                
                {showRemove && canManagePages && !isPartiallyActive && (
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (window.confirm(`Voulez-vous vraiment supprimer la page ${page.page_name} de FLARE AI ?`)) {
                        onRemovePage?.(page.page_id);
                      }
                    }}
                    className="p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-50 inline-flex items-center"
                    title="Supprimer cette page"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </motion.div>
          );
        })}
      </motion.div>
    </div>
  );
}
