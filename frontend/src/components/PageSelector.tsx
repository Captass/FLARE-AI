"use client";

import React from "react";
import { motion } from "framer-motion";
import { Facebook, Plus, CheckCircle2, XCircle } from "lucide-react";
import type { FacebookMessengerPage } from "@/lib/facebookMessenger";

interface PageSelectorProps {
  pages: FacebookMessengerPage[];
  selectedPageId: string | null;
  onSelect: (pageId: string) => void;
  onAddPage: () => void;
  loading?: boolean;
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
}: PageSelectorProps) {
  if (loading) {
    return (
      <div className="flex gap-4 p-4 min-h-[100px] items-center">
        <div className="w-8 h-8 rounded-full border-2 border-orange-500/20 border-t-orange-500 animate-spin" />
        <span className="text-sm text-fg/40 uppercase tracking-widest">Chargement des pages...</span>
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
            <h3 className="text-lg font-semibold text-fg/90 mb-1">Aucune page Facebook connectée</h3>
            <p className="text-sm text-fg/50 max-w-sm mx-auto">
              Liez une page professionnelle pour permettre à l'assistant d'interagir directement avec vos clients sur Messenger.
            </p>
          </div>
          <button
            onClick={onAddPage}
            className="mt-4 px-6 py-2.5 rounded-xl bg-orange-500/15 border border-orange-500/30 text-orange-500 font-medium hover:bg-orange-500/25 transition-all flex items-center gap-2 shadow-[0_0_20px_rgba(249,115,22,0.1)] hover:shadow-[0_0_25px_rgba(249,115,22,0.2)]"
          >
            <Plus className="w-4 h-4" />
            Connecter une page
          </button>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-4 px-1">
        <h3 className="text-xs font-semibold text-fg/50 uppercase tracking-widest">Pages Facebook liées</h3>
        <button
          onClick={onAddPage}
          className="text-xs flex items-center gap-1.5 text-orange-500 hover:text-orange-400 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Ajouter une page
        </button>
      </div>

      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="show"
        className="flex flex-wrap gap-3"
      >
        {pages.map((page) => {
          const isActive = page.page_id === selectedPageId;
          const isWebhookSubscribed = page.webhook_subscribed;
          const InitialBadge = page.page_name.substring(0, 2).toUpperCase();

          return (
            <motion.button
              key={page.page_id}
              variants={itemAnim}
              onClick={() => onSelect(page.page_id)}
              className={`group relative flex items-center gap-3 p-3 pr-4 rounded-xl border text-left transition-all ${
                isActive
                  ? "bg-orange-500/[0.04] border-orange-500/40 shadow-[0_0_30px_rgba(249,115,22,0.08)]"
                  : "bg-[var(--bg-card)] border-fg/[0.06] hover:border-fg/[0.15] hover:bg-white/[0.01]"
              }`}
            >
              {/* Conic Glow if Active */}
              {isActive && (
                <div className="absolute inset-x-0 -bottom-px mx-auto h-px w-2/3 bg-gradient-to-r from-transparent via-orange-500/60 to-transparent" />
              )}
              
              <div className="relative">
                {page.page_picture_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={page.page_picture_url}
                    alt={page.page_name}
                    className={`w-10 h-10 rounded-full object-cover border ${isActive ? 'border-orange-500/50' : 'border-fg/10'}`}
                  />
                ) : (
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs border ${isActive ? 'bg-orange-500/10 text-orange-500 border-orange-500/30' : 'bg-fg/5 text-fg/60 border-fg/10'}`}>
                    {InitialBadge}
                  </div>
                )}
                
                {/* Status Indicator Dot */}
                <div 
                  className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-[var(--bg-background)] flex items-center justify-center ${
                    isWebhookSubscribed ? "bg-emerald-500" : "bg-red-500"
                  }`}
                  title={isWebhookSubscribed ? "Connecté à Messenger" : "Déconnecté de Messenger"}
                >
                   {/* Optional: we could put tiny SVG here, but color is enough */}
                </div>
              </div>

              <div className="flex flex-col">
                <span className={`text-sm font-medium ${isActive ? 'text-fg/90' : 'text-fg/70'}`}>
                  {page.page_name}
                </span>
                <span className="text-[10px] text-fg/40 uppercase tracking-widest mt-0.5">
                  ID: {page.page_id}
                </span>
              </div>
            </motion.button>
          );
        })}
      </motion.div>
    </div>
  );
}
