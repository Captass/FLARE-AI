"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { motion, type Variants } from "framer-motion";
import { ArrowLeft, Download, Globe, Monitor, ShieldCheck, Smartphone } from "lucide-react";
import Link from "next/link";
import FlareMark from "@/components/FlareMark";
import {
  getAndroidDownloadUrl,
  getPreferredInstallChannel,
  getSimpleWebAppUrl,
  getWindowsDownloadUrl,
  type InstallChannel,
} from "@/lib/platform/runtime";

type OptionChannel = "windows-native" | "android-native" | "simple-web";

type DownloadOption = {
  channel: OptionChannel;
  title: string;
  chip: string;
  modeLabel: string;
  actionLabel: string;
  helperText: string;
  href: string;
  icon: ReactNode;
};

export default function DownloadPage() {
  const [preferredChannel, setPreferredChannel] = useState<InstallChannel>("web");

  useEffect(() => {
    setPreferredChannel(getPreferredInstallChannel());
  }, []);

  const options = useMemo<DownloadOption[]>(
    () => [
      {
        channel: "windows-native",
        title: "Windows",
        chip: "Windows 10 et 11",
        modeLabel: "Logiciel natif (Tauri)",
        actionLabel: "Telecharger FLARE AI pour Windows",
        helperText: "Installeur desktop natif pour la beta FLARE AI.",
        href: getWindowsDownloadUrl(),
        icon: <Monitor className="h-8 w-8" />,
      },
      {
        channel: "android-native",
        title: "Android",
        chip: "Telephone et tablette",
        modeLabel: "APK natif direct",
        actionLabel: "Telecharger l'APK Android",
        helperText: "Fichier APK direct, sans passage par web app.",
        href: getAndroidDownloadUrl(),
        icon: <Smartphone className="h-8 w-8" />,
      },
      {
        channel: "simple-web",
        title: "macOS et iPhone",
        chip: "Safari / Chrome",
        modeLabel: "Web app simple (PWA)",
        actionLabel: "Ouvrir la web app",
        helperText: "Sur iPhone: Partager > Ajouter a l'ecran d'accueil.",
        href: getSimpleWebAppUrl(),
        icon: <Globe className="h-8 w-8" />,
      },
    ],
    []
  );

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
  };

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: "easeOut" } },
  };

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#F9F7F2] p-6 font-sans text-black selection:bg-orange-500 selection:text-white">
      <div className="pointer-events-none absolute left-1/2 top-0 h-[480px] w-full max-w-3xl -translate-x-1/2 rounded-full bg-orange-500/10 blur-[120px] opacity-50" />

      <div className="absolute left-0 top-0 z-50 w-full p-6 lg:p-10">
        <Link
          href="/"
          className="group inline-flex cursor-pointer items-center gap-3 text-black/55 transition-colors hover:text-black"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-full border border-black/10 bg-black/5 transition-colors group-hover:bg-black/10">
            <ArrowLeft size={16} />
          </div>
          <span className="text-xs font-bold uppercase tracking-widest">Retour au site</span>
        </Link>
      </div>

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="z-10 mx-auto flex w-full max-w-5xl flex-col items-center"
      >
        <motion.div
          variants={itemVariants}
          className="mb-10 flex h-20 w-20 items-center justify-center rounded-3xl border border-black/5 bg-white shadow-xl shadow-orange-500/10"
        >
          <FlareMark tone="auto" className="w-10" />
        </motion.div>

        <motion.div variants={itemVariants} className="mb-14 max-w-3xl text-center">
          <h1 className="mb-6 text-4xl font-black tracking-tighter md:text-6xl font-[family-name:var(--font-outfit)]">
            Choisissez votre acces <span className="bg-gradient-to-r from-orange-400 to-orange-600 bg-clip-text text-transparent">FLARE AI</span>
          </h1>
          <p className="text-lg font-medium leading-relaxed text-black/62 md:text-xl">
            Pivot produit actif: Windows = app native Tauri, Android = APK natif direct, macOS et iPhone = web app simple.
          </p>
        </motion.div>

        <motion.div variants={containerVariants} className="mb-14 grid w-full grid-cols-1 gap-6 md:grid-cols-3">
          {options.map((option) => {
            const isRecommended =
              preferredChannel === option.channel ||
              (preferredChannel === "web" && option.channel === "simple-web");

            return (
              <motion.div
                key={option.channel}
                variants={itemVariants}
                whileHover={{ y: -4, scale: 1.01 }}
                className={`group relative flex flex-col gap-6 overflow-hidden rounded-[32px] border p-8 transition-all duration-300 ${
                  isRecommended
                    ? "border-orange-500/30 bg-orange-500/[0.03] shadow-2xl shadow-orange-500/10"
                    : "border-black/5 bg-white hover:border-black/10 hover:shadow-xl"
                }`}
              >
                {isRecommended ? (
                  <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-orange-400 to-orange-600" />
                ) : null}

                <div className="flex items-start justify-between">
                  <div
                    className={`rounded-2xl p-4 ${
                      isRecommended ? "bg-orange-500/10 text-orange-600" : "bg-black/5 text-black"
                    }`}
                  >
                    {option.icon}
                  </div>
                  {isRecommended ? (
                    <span className="rounded-full border border-orange-500/20 bg-orange-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-orange-600">
                      Recommande
                    </span>
                  ) : null}
                </div>

                <div>
                  <h3 className="text-2xl font-black text-black">{option.title}</h3>
                  <p className="mt-1 text-[11px] font-bold uppercase tracking-widest text-black/42">{option.chip}</p>
                </div>

                <div className="mt-auto border-t border-black/5 pt-5">
                  <p className="mb-3 text-[11px] font-black uppercase tracking-widest text-black/52">{option.modeLabel}</p>
                  <a
                    href={option.href}
                    className={`flex w-full items-center justify-center gap-3 rounded-xl py-4 text-xs font-black uppercase tracking-widest transition-all ${
                      isRecommended
                        ? "bg-orange-500 text-white shadow-xl shadow-orange-500/20 hover:bg-orange-600"
                        : "bg-black/5 text-black hover:bg-black/10"
                    }`}
                  >
                    <Download size={16} />
                    {option.actionLabel}
                  </a>
                  <p className="mt-3 text-center text-[10px] font-medium uppercase tracking-wider text-black/35">{option.helperText}</p>
                </div>
              </motion.div>
            );
          })}
        </motion.div>

        <motion.div
          variants={itemVariants}
          className="rounded-2xl border border-black/10 bg-white/70 px-5 py-4 text-center text-sm font-medium text-black/62"
        >
          <div className="flex items-center justify-center gap-2 text-black/72">
            <ShieldCheck size={14} />
            <span>Beta actuelle: pas d&apos;app native macOS/iPhone. Acces simple via web app/PWA uniquement.</span>
          </div>
        </motion.div>
      </motion.div>
    </main>
  );
}
