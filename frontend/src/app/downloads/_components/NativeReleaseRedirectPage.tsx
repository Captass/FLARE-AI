"use client";

import Link from "next/link";
import { ArrowLeft, Download, ExternalLink } from "lucide-react";
import FlareMark from "@/components/FlareMark";
import {
  getAndroidDownloadRoute,
  getAndroidDownloadUrl,
  getReleaseDate,
  getReleaseVersion,
  getWindowsDownloadRoute,
  getWindowsDownloadUrl,
  type NativeReleasePlatform,
} from "@/lib/platform/runtime";

type NativeReleaseRedirectPageProps = {
  platform: NativeReleasePlatform;
};

const PLATFORM_COPY: Record<
  NativeReleasePlatform,
  { title: string; subtitle: string; actionLabel: string; unavailableLabel: string }
> = {
  android: {
    title: "Android",
    subtitle: "APK signe",
    actionLabel: "Telecharger l'APK",
    unavailableLabel: "APK non disponible pour le moment.",
  },
  windows: {
    title: "Windows",
    subtitle: "Installateur .exe",
    actionLabel: "Telecharger l'installateur",
    unavailableLabel: "Installateur non disponible pour le moment.",
  },
};

function getStableRoute(platform: NativeReleasePlatform): string {
  return platform === "android" ? getAndroidDownloadRoute() : getWindowsDownloadRoute();
}

function getReleaseUrl(platform: NativeReleasePlatform): string {
  return platform === "android" ? getAndroidDownloadUrl() : getWindowsDownloadUrl();
}

export default function NativeReleaseRedirectPage({ platform }: NativeReleaseRedirectPageProps) {
  const stableRoute = getStableRoute(platform);
  const releaseUrl = getReleaseUrl(platform);
  const releaseVersion = getReleaseVersion(platform);
  const releaseDate = getReleaseDate(platform);
  const copy = PLATFORM_COPY[platform];

  return (
    <main className="min-h-screen bg-[#f8f5ee] px-5 py-6 font-sans text-black selection:bg-orange-500 selection:text-white sm:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-3xl flex-col">
        <header className="flex items-center justify-between">
          <Link
            href="/download"
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

        <section className="flex flex-1 items-center py-14">
          <div className="w-full rounded-[28px] border border-black/10 bg-white p-7 shadow-xl shadow-black/[0.04] sm:p-10">
            <p className="text-xs font-black uppercase tracking-[0.24em] text-orange-600">FLARE AI</p>
            <h1 className="mt-4 text-4xl font-black tracking-tight font-[family-name:var(--font-outfit)]">
              {copy.title}
            </h1>
            <p className="mt-2 text-base font-semibold text-black/55">{copy.subtitle}</p>

            {releaseVersion || releaseDate ? (
              <div className="mt-6 flex flex-wrap gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-black/50">
                {releaseVersion ? <span className="rounded-full bg-black/[0.04] px-3 py-1">v{releaseVersion}</span> : null}
                {releaseDate ? <span className="rounded-full bg-black/[0.04] px-3 py-1">{releaseDate}</span> : null}
              </div>
            ) : null}

            <div className="mt-8">
              {releaseUrl ? (
                <>
                  <a
                    href={releaseUrl}
                    rel="noopener noreferrer"
                    className="flex w-full items-center justify-center gap-3 rounded-2xl bg-orange-500 px-5 py-4 text-sm font-black uppercase tracking-[0.16em] text-white shadow-lg shadow-orange-500/20 transition hover:bg-orange-600"
                  >
                    <Download size={17} />
                    {copy.actionLabel}
                  </a>
                  <a
                    href={releaseUrl}
                    rel="noopener noreferrer"
                    className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-black/55 underline-offset-4 hover:text-black hover:underline"
                  >
                    Ouvrir dans GitHub
                    <ExternalLink size={14} />
                  </a>
                </>
              ) : (
                <div className="rounded-2xl border border-orange-500/20 bg-orange-500/10 p-4 text-sm font-semibold text-orange-700">
                  {copy.unavailableLabel}
                </div>
              )}
            </div>

            <div className="mt-8 border-t border-black/10 pt-5 text-xs font-semibold text-black/45">
              URL stable: {stableRoute}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
