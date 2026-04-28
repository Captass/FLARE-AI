"use client";

import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Download, RefreshCw, Smartphone, Monitor, Globe } from "lucide-react";
import type { UpdateInfo, UpdateStatus } from "@/hooks/useForceUpdate";
import FlareMark from "@/components/FlareMark";

interface ForceUpdateModalProps {
  status: UpdateStatus;
  updateInfo: UpdateInfo | null;
  onApplyUpdate: () => void;
}

function PlatformIcon({ platform }: { platform: string }) {
  if (platform === "android") return <Smartphone size={28} className="text-emerald-400" />;
  if (platform === "windows") return <Monitor size={28} className="text-sky-400" />;
  return <Globe size={28} className="text-violet-400" />;
}

function PlatformLabel({ platform }: { platform: string }) {
  if (platform === "android") return "Android";
  if (platform === "windows") return "Windows";
  return "Web / PWA";
}

export default function ForceUpdateModal({ status, updateInfo, onApplyUpdate }: ForceUpdateModalProps) {
  const visible = status === "update_required" || status === "downloading" || status === "installing";
  const platform = updateInfo?.platform ?? "web";
  const isPwa = platform === "web";

  return (
    <AnimatePresence>
      {visible && (
        <>
          {/* Backdrop sombre et flou — empêche toute interaction */}
          <motion.div
            key="force-update-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-md"
          />

          {/* Modal */}
          <motion.div
            key="force-update-modal"
            initial={{ opacity: 0, scale: 0.9, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 24 }}
            transition={{ type: "spring", stiffness: 280, damping: 24 }}
            className="fixed inset-0 z-[10000] flex items-center justify-center p-4"
          >
            <div className="relative w-full max-w-md overflow-hidden rounded-[28px] border border-white/10 bg-[#0d0d10] shadow-2xl shadow-black/60">
              {/* Gradient top accent */}
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-orange-500 via-amber-400 to-orange-600" />

              {/* Background glow */}
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(251,146,60,0.08),transparent_60%)]" />

              <div className="relative z-10 flex flex-col items-center gap-6 p-8 text-center">
                {/* Logo */}
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/5 shadow-lg">
                  <FlareMark tone="light" className="w-9" />
                </div>

                {/* Badge plateforme */}
                <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
                  <PlatformIcon platform={platform} />
                  <span className="text-xs font-bold uppercase tracking-widest text-white/60">
                    <PlatformLabel platform={platform} />
                  </span>
                </div>

                {/* Titre */}
                <div>
                  <h2 className="text-2xl font-black tracking-tight text-white">
                    Mise à jour requise
                  </h2>
                  <p className="mt-2 text-sm font-medium leading-relaxed text-white/50">
                    {isPwa
                      ? "Une nouvelle version de FLARE AI est prête. Rechargez pour continuer."
                      : `Votre version (v${updateInfo?.currentVersion}) n'est plus supportée. Téléchargez la v${updateInfo?.latestVersion} pour continuer.`}
                  </p>
                </div>

                {/* Notes de version */}
                {updateInfo?.releaseNotes && (
                  <div className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-left">
                    <p className="mb-1 text-[10px] font-black uppercase tracking-widest text-white/30">
                      Nouveautés
                    </p>
                    <p className="text-sm font-medium leading-relaxed text-white/60">
                      {updateInfo.releaseNotes}
                    </p>
                  </div>
                )}

                {/* CTA */}
                <button
                  type="button"
                  onClick={onApplyUpdate}
                  disabled={status === "downloading" || status === "installing"}
                  className="group relative w-full overflow-hidden rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 px-6 py-4 text-sm font-black text-white shadow-lg shadow-orange-500/30 transition-all hover:-translate-y-0.5 hover:shadow-orange-500/50 disabled:cursor-wait disabled:opacity-70"
                >
                  <span className="relative z-10 flex items-center justify-center gap-2">
                    {status === "downloading" || status === "installing" ? (
                      <>
                        <RefreshCw size={16} className="animate-spin" />
                        {status === "downloading" ? "Téléchargement…" : "Installation en cours…"}
                      </>
                    ) : isPwa ? (
                      <>
                        <RefreshCw size={16} />
                        Recharger maintenant
                        <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
                      </>
                    ) : (
                      <>
                        <Download size={16} />
                        Télécharger la mise à jour
                        <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
                      </>
                    )}
                  </span>
                </button>

                {/* Message d'info obligatoire */}
                <p className="text-[11px] font-semibold text-white/25">
                  Cette mise à jour est obligatoire pour des raisons de sécurité et de compatibilité.
                </p>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
