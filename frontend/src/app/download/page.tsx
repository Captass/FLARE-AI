"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ArrowLeft, Download, Globe, Monitor, Smartphone } from "lucide-react";
import Link from "next/link";
import FlareMark from "@/components/FlareMark";
import {
  getAndroidDownloadRoute,
  getPreferredInstallChannel,
  getSimpleWebAppUrl,
  getWindowsDownloadRoute,
  hasAndroidDownload,
  hasWindowsDownload,
  type InstallChannel,
} from "@/lib/platform/runtime";

type OptionChannel = "windows-native" | "android-native" | "simple-web";

type DownloadOption = {
  channel: OptionChannel;
  title: string;
  subtitle: string;
  actionLabel: string;
  href: string;
  available: boolean;
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
        subtitle: "Installateur .exe",
        actionLabel: "Telecharger",
        href: getWindowsDownloadRoute(),
        available: hasWindowsDownload(),
        icon: <Monitor className="h-5 w-5" />,
      },
      {
        channel: "android-native",
        title: "Android",
        subtitle: "APK signe",
        actionLabel: "Telecharger",
        href: getAndroidDownloadRoute(),
        available: hasAndroidDownload(),
        icon: <Smartphone className="h-5 w-5" />,
      },
      {
        channel: "simple-web",
        title: "Web app",
        subtitle: "macOS, iPhone, navigateur",
        actionLabel: "Ouvrir",
        href: getSimpleWebAppUrl(),
        available: true,
        icon: <Globe className="h-5 w-5" />,
      },
    ],
    []
  );

  return (
    <main className="min-h-screen bg-[#f8f5ee] px-5 py-6 font-sans text-black selection:bg-orange-500 selection:text-white sm:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-5xl flex-col">
        <header className="flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex h-10 items-center gap-3 rounded-full text-xs font-bold uppercase tracking-[0.18em] text-black/55 transition hover:text-black"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-full border border-black/10 bg-white">
              <ArrowLeft size={16} />
            </span>
            Retour
          </Link>
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-black/10 bg-white shadow-sm">
            <FlareMark tone="auto" className="w-6" />
          </div>
        </header>

        <section className="flex flex-1 flex-col justify-center py-14">
          <div className="max-w-2xl">
            <p className="text-xs font-black uppercase tracking-[0.24em] text-orange-600">FLARE AI</p>
            <h1 className="mt-4 max-w-3xl text-4xl font-black leading-[0.95] tracking-tighter sm:text-6xl font-[family-name:var(--font-outfit)]">
              Télécharger l&apos;application
            </h1>
            <p className="mt-5 max-w-xl text-base font-medium leading-relaxed text-black/60">
              Choisissez votre plateforme. Les fichiers viennent de la release officielle.
            </p>
          </div>

          <div className="mt-12 grid gap-3 md:grid-cols-3">
            {options.map((option) => {
              const isRecommended =
                preferredChannel === option.channel ||
                (preferredChannel === "web" && option.channel === "simple-web");

              return (
                <a
                  key={option.channel}
                  href={option.href}
                  className={`group flex min-h-[190px] flex-col justify-between rounded-[22px] border bg-white p-5 transition hover:-translate-y-0.5 hover:border-black/20 hover:shadow-xl hover:shadow-black/5 ${
                    isRecommended ? "border-orange-500/45 shadow-lg shadow-orange-500/10" : "border-black/10"
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <span
                      className={`flex h-11 w-11 items-center justify-center rounded-2xl ${
                        isRecommended ? "bg-orange-500 text-white" : "bg-black/[0.04] text-black"
                      }`}
                    >
                      {option.icon}
                    </span>
                    {isRecommended ? (
                      <span className="rounded-full bg-orange-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-orange-600">
                        recommande
                      </span>
                    ) : null}
                  </div>

                  <div>
                    <h2 className="text-2xl font-black tracking-tight">{option.title}</h2>
                    <p className="mt-1 text-sm font-semibold text-black/50">{option.subtitle}</p>
                  </div>

                  <div className="flex items-center justify-between border-t border-black/10 pt-4">
                    <span className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-black">
                      <Download size={14} />
                      {option.available ? option.actionLabel : "Indisponible"}
                    </span>
                    <span className="text-black/30 transition group-hover:translate-x-0.5 group-hover:text-black">→</span>
                  </div>
                </a>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
}
