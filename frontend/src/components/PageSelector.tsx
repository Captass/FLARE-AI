"use client";

import React from "react";
import { motion } from "framer-motion";
import { Facebook, Loader2, Plus, RefreshCw } from "lucide-react";
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
  canManagePages?: boolean;
  busyPageId?: string | null;
}

const staggerContainer = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
    },
  },
};

const itemAnim = {
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

  const metaDisabled = !canManagePages || connectMetaBusy || syncListBusy;
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

  const showActivate = Boolean(onActivatePage && canManagePages);

  return (
    <div className="w-full">
      <div className="flex flex-col gap-2 mb-4 px-1">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <h3 className="text-base font-semibold text-fg/90">Vos pages Facebook</h3>
          <div className="flex flex-row flex-wrap gap-2 shrink-0">
            {onSyncPagesList ? (
              <button
                type="button"
                onClick={() => onSyncPagesList()}
                disabled={syncDisabled}
                title="Met à jour la liste avec le compte Meta déjà lié, sans rouvrir la fenêtre de login."
                className="text-sm flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-fg/[0.1] bg-fg/[0.03] text-fg/75 hover:bg-fg/[0.06] transition-colors font-medium disabled:opacity-45 disabled:pointer-events-none"
              >
                {syncListBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                Actualiser la liste
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => onConnectMetaPages()}
              disabled={metaDisabled}
              title="Ouvre Facebook pour autoriser d’autres pages ou renouveler la session."
              className="text-sm flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-orange-500/12 border border-orange-500/25 text-orange-400 hover:bg-orange-500/20 transition-colors font-medium disabled:opacity-45 disabled:pointer-events-none"
            >
              {connectMetaBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Facebook className="w-4 h-4" />}
              Ajouter des pages (Meta)
            </button>
          </div>
        </div>
        <p className="text-sm text-fg/50 max-w-3xl leading-relaxed">
          <strong className="text-fg/65">Choisir dans FLARE :</strong> cliquez sur une ligne pour la piloter (personnalisation, stats).{" "}
          <strong className="text-fg/65">Messenger :</strong> une seule page à la fois reçoit les messages — bouton{" "}
          <span className="text-emerald-400/90 font-medium">Activer sur Messenger</span>. La fenêtre Meta sert uniquement à lier le compte ou de nouvelles pages à
          FLARE, pas à choisir la page active ici.
        </p>
      </div>

      <motion.div variants={staggerContainer} initial="hidden" animate="show" className="flex flex-col gap-3">
        {pages.map((page) => {
          const isSelected = page.page_id === selectedPageId;
          const isMessengerActive = page.is_active && page.webhook_subscribed;
          const isBusy = busyPageId === page.page_id;
          const InitialBadge = page.page_name.substring(0, 2).toUpperCase();
          const needsActivation = !page.is_active;

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
                      isMessengerActive ? "bg-emerald-500" : needsActivation ? "bg-amber-500" : "bg-fg/30"
                    }`}
                    title={
                      isMessengerActive
                        ? "Messenger actif"
                        : needsActivation
                          ? "Messenger : pas encore activé"
                          : "Statut partiel"
                    }
                  />
                </div>

                <div className="flex flex-col min-w-0">
                  <span className={`text-base font-semibold truncate ${isSelected ? "text-fg/95" : "text-fg/80"}`}>
                    {page.page_name}
                  </span>
                  <span className="text-sm text-fg/45 font-mono truncate">ID · {page.page_id}</span>
                  <span className="text-sm mt-0.5">
                    {isMessengerActive ? (
                      <span className="text-emerald-400/90 font-medium">Bot actif sur Messenger (webhook)</span>
                    ) : (
                      <span className="text-amber-400/90 font-medium">Pas encore activé sur Messenger</span>
                    )}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 sm:pl-2">
                {isSelected && (
                  <span className="text-xs sm:text-sm font-semibold uppercase tracking-wide text-orange-400/90 hidden sm:inline">
                    Sélection FLARE
                  </span>
                )}
                {showActivate && needsActivation && (
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={(e) => {
                      e.stopPropagation();
                      onActivatePage?.(page.page_id);
                    }}
                    className="px-4 py-2 rounded-lg bg-emerald-500/15 border border-emerald-500/35 text-emerald-400 text-sm font-semibold hover:bg-emerald-500/25 transition-colors disabled:opacity-50 inline-flex items-center gap-2"
                  >
                    {isBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    Activer sur Messenger
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
