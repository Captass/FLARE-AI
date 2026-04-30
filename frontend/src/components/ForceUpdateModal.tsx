"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Download, Globe, Monitor, RefreshCw, Smartphone } from "lucide-react";
import FlareMark from "@/components/FlareMark";
import type { UpdateInfo, UpdateStatus } from "@/hooks/useForceUpdate";

interface ForceUpdateModalProps {
  status: UpdateStatus;
  updateInfo: UpdateInfo | null;
  onApplyUpdate: () => void;
}

function PlatformIcon({ platform }: { platform: string }) {
  if (platform === "android") return <Smartphone size={22} className="text-emerald-500" />;
  if (platform === "windows") return <Monitor size={22} className="text-sky-500" />;
  return <Globe size={22} className="text-violet-500" />;
}

function platformLabel(platform: string) {
  if (platform === "android") return "Android";
  if (platform === "windows") return "Windows";
  return "Web / PWA";
}

export default function ForceUpdateModal({ status, updateInfo, onApplyUpdate }: ForceUpdateModalProps) {
  const visible = status === "update_available" || status === "update_required" || status === "downloading" || status === "installing";
  const platform = updateInfo?.platform ?? "web";
  const isPwa = platform === "web";
  const isBlocking = status === "update_required" || Boolean(updateInfo?.mandatory);
  const isBusy = status === "downloading" || status === "installing";
  const busyLabel = status === "downloading" ? "Ouverture..." : "Installation...";

  return (
    <AnimatePresence>
      {visible && isBlocking && (
        <>
          <motion.div
            key="force-update-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-md"
          />

          <motion.div
            key="force-update-modal"
            initial={{ opacity: 0, scale: 0.92, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 24 }}
            transition={{ type: "spring", stiffness: 280, damping: 24 }}
            className="fixed inset-0 z-[10000] flex items-center justify-center p-4"
          >
            <div className="relative w-full max-w-md overflow-hidden rounded-[28px] border border-white/10 bg-[#0d0d10] shadow-2xl shadow-black/60">
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-orange-500 via-amber-400 to-orange-600" />
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(251,146,60,0.08),transparent_60%)]" />

              <div className="relative z-10 flex flex-col items-center gap-6 p-8 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/5 shadow-lg">
                  <FlareMark tone="light" className="w-9" />
                </div>

                <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
                  <PlatformIcon platform={platform} />
                  <span className="text-xs font-bold uppercase tracking-widest text-white/60">
                    {platformLabel(platform)}
                  </span>
                </div>

                <div>
                  <h2 className="text-2xl font-black tracking-tight text-white">Mise a jour requise</h2>
                  <p className="mt-2 text-sm font-medium leading-relaxed text-white/50">
                    {isPwa
                      ? "Une nouvelle version de FLARE AI est prete. Rechargez pour continuer."
                      : `Votre version (v${updateInfo?.currentVersion}) n'est plus supportee. Installez la v${updateInfo?.latestVersion} pour continuer.`}
                  </p>
                </div>

                {updateInfo?.releaseNotes && (
                  <div className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-left">
                    <p className="mb-1 text-[10px] font-black uppercase tracking-widest text-white/30">
                      Nouveautes
                    </p>
                    <p className="text-sm font-medium leading-relaxed text-white/60">
                      {updateInfo.releaseNotes}
                    </p>
                  </div>
                )}

                <button
                  type="button"
                  onClick={onApplyUpdate}
                  disabled={isBusy}
                  className="group relative w-full overflow-hidden rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 px-6 py-4 text-sm font-black text-white shadow-lg shadow-orange-500/30 transition-all hover:-translate-y-0.5 hover:shadow-orange-500/50 disabled:cursor-wait disabled:opacity-70"
                >
                  <span className="relative z-10 flex items-center justify-center gap-2">
                    {isBusy ? (
                      <>
                        <RefreshCw size={16} className="animate-spin" />
                        {busyLabel}
                      </>
                    ) : isPwa ? (
                      <>
                        <RefreshCw size={16} />
                        Relancer maintenant
                        <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
                      </>
                    ) : (
                      <>
                        <Download size={16} />
                        Telecharger la mise a jour
                        <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
                      </>
                    )}
                  </span>
                </button>

                <p className="text-[11px] font-semibold text-white/25">
                  Cette mise a jour est obligatoire pour des raisons de securite et de compatibilite.
                </p>
              </div>
            </div>
          </motion.div>
        </>
      )}

      {visible && !isBlocking && (
        <motion.div
          key="update-toast"
          initial={{ opacity: 0, y: 18, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 18, scale: 0.98 }}
          className="fixed bottom-4 left-4 z-[80] w-[calc(100vw-2rem)] max-w-sm rounded-2xl border border-slate-200/80 bg-white/95 p-3 shadow-[0_18px_60px_rgba(15,23,42,0.18)] backdrop-blur-xl dark:border-white/10 dark:bg-[#111114]/95"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-orange-500/20 bg-orange-500/10">
              <PlatformIcon platform={platform} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-black text-slate-950 dark:text-white">Mise a jour disponible</p>
              <p className="truncate text-xs font-semibold text-slate-500 dark:text-white/45">
                v{updateInfo?.latestVersion || updateInfo?.currentVersion} - {platformLabel(platform)}
              </p>
            </div>
            <button
              type="button"
              onClick={onApplyUpdate}
              disabled={isBusy}
              className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl bg-slate-950 px-3 text-xs font-black text-white transition hover:bg-orange-600 disabled:cursor-wait disabled:opacity-60 dark:bg-white dark:text-slate-950"
            >
              {isBusy ? <RefreshCw size={14} className="animate-spin" /> : isPwa ? <RefreshCw size={14} /> : <Download size={14} />}
              {isBusy ? busyLabel : isPwa ? "Relancer" : "Telecharger"}
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
