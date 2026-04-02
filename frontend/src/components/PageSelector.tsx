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
  onAddPage: () => void;
  loading?: boolean;
  /** Définir cette page comme canal Messenger actif pour l’organisation */
  onActivatePage?: (pageId: string) => void;
  canManagePages?: boolean;
  busyPageId?: string | null;
  /** Liste des pages en cours d’actualisation depuis Meta (sans OAuth) */
  isRefreshingPages?: boolean;
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
  onAddPage,
  loading = false,
  onActivatePage,
  canManagePages = false,
  busyPageId = null,
  isRefreshingPages = false,
}: PageSelectorProps) {
  if (loading) {
    return (
      <div className="flex gap-4 p-4 min-h-[100px] items-center">
        <div className="w-8 h-8 rounded-full border-2 border-orange-500/20 border-t-orange-500 animate-spin" />
        <span className="text-sm text-fg/50 font-medium">Chargement des pages Facebook…</span>
      </div>
    );
  }

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
            <p className="text-sm text-fg/50 max-w-md mx-auto leading-relaxed">
              Connectez votre compte Meta : toutes les pages autorisées apparaîtront ici. Vous pourrez en choisir une pour
              Messenger et cliquer sur une carte pour la piloter dans FLARE.
            </p>
          </div>
          <button
            onClick={onAddPage}
            className="mt-4 px-6 py-2.5 rounded-xl bg-orange-500/15 border border-orange-500/30 text-orange-500 font-medium hover:bg-orange-500/25 transition-all flex items-center gap-2 shadow-[0_0_20px_rgba(249,115,22,0.1)] hover:shadow-[0_0_25px_rgba(249,115,22,0.2)]"
          >
            <Plus className="w-4 h-4" />
            Connecter Facebook
          </button>
        </div>
      </motion.div>
    );
  }

  const showActivate = Boolean(onActivatePage && canManagePages);

  return (
    <div className="w-full">
      <div className="flex flex-col gap-1 mb-4 px-1">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h3 className="text-base font-semibold text-fg/90">Vos pages Facebook</h3>
          <button
            type="button"
            onClick={onAddPage}
            disabled={isRefreshingPages}
            className="text-sm flex items-center gap-1.5 text-orange-500 hover:text-orange-400 transition-colors font-medium disabled:opacity-50"
          >
            {isRefreshingPages ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Plus className="w-4 h-4" />
            )}
            Actualiser la liste ou reconnecter
          </button>
        </div>
        <p className="text-sm text-fg/50 max-w-3xl">
          Cliquez sur une page pour la piloter dans FLARE (tableau de bord, catalogue). Une seule page à la fois peut
          recevoir les conversations Messenger : utilisez « Activer sur Messenger » pour celle que vous choisissez.
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
                      <span className="text-emerald-400/90 font-medium">Page active sur Messenger</span>
                    ) : (
                      <span className="text-amber-400/90 font-medium">En attente d&apos;activation Messenger</span>
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
