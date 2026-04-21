"use client";

import Link from "next/link";
import { Download, ExternalLink, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
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
    title: "Android APK release signee",
    subtitle: "Redirection vers l'asset APK de la release FLARE AI.",
    actionLabel: "Telecharger l'APK Android",
    unavailableLabel: "Le lien APK n'est pas configure pour cet environnement.",
  },
  windows: {
    title: "Windows installer",
    subtitle: "Redirection vers l'installateur Windows de la release FLARE AI.",
    actionLabel: "Telecharger l'installateur Windows",
    unavailableLabel: "Le lien installateur Windows n'est pas configure pour cet environnement.",
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
  const [loopConfiguration, setLoopConfiguration] = useState(false);

  useEffect(() => {
    setLoopConfiguration(false);
    if (!releaseUrl) return;

    const normalizePath = (value: string): string => value.replace(/\/+$/, "") || "/";
    try {
      const targetUrl = new URL(releaseUrl, window.location.origin);
      if (
        targetUrl.origin === window.location.origin &&
        normalizePath(targetUrl.pathname) === normalizePath(stableRoute)
      ) {
        setLoopConfiguration(true);
        return;
      }
    } catch {
      // Ignore parse failures and let browser handle link manually.
    }

    const timeoutId = window.setTimeout(() => {
      window.location.replace(releaseUrl);
    }, 120);
    return () => window.clearTimeout(timeoutId);
  }, [releaseUrl, stableRoute]);

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#F9F7F2] p-6 font-sans text-black selection:bg-orange-500 selection:text-white">
      <div className="pointer-events-none absolute left-1/2 top-0 h-[420px] w-full max-w-2xl -translate-x-1/2 rounded-full bg-orange-500/10 blur-[120px] opacity-50" />

      <section className="relative z-10 w-full max-w-xl rounded-[28px] border border-black/10 bg-white/90 p-8 shadow-2xl shadow-orange-500/10 backdrop-blur">
        <h1 className="text-3xl font-black tracking-tight">{copy.title}</h1>
        <p className="mt-3 text-sm font-medium text-black/65">{copy.subtitle}</p>

        {releaseVersion || releaseDate ? (
          <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-black/10 bg-black/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-black/70">
            {releaseVersion ? <span>Version {releaseVersion}</span> : null}
            {releaseVersion && releaseDate ? <span>|</span> : null}
            {releaseDate ? <span>{releaseDate}</span> : null}
          </div>
        ) : null}

        <div className="mt-7">
          {releaseUrl && !loopConfiguration ? (
            <>
              <p className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-black/70">
                <Loader2 className="h-4 w-4 animate-spin text-orange-600" />
                Redirection en cours...
              </p>
              <a
                href={releaseUrl}
                rel="noopener noreferrer"
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-orange-500 px-5 py-4 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-orange-500/20 transition hover:bg-orange-600"
              >
                <Download size={16} />
                {copy.actionLabel}
              </a>
              <a
                href={releaseUrl}
                rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-black/65 underline-offset-4 hover:underline"
              >
                Ouvrir le lien release manuellement
                <ExternalLink size={14} />
              </a>
            </>
          ) : loopConfiguration ? (
            <div className="rounded-xl border border-orange-500/25 bg-orange-500/10 p-4 text-sm font-medium text-orange-700">
              Configuration invalide: le lien release pointe vers la meme URL stable. Utilisez une URL d&apos;asset GitHub Release.
            </div>
          ) : (
            <div className="rounded-xl border border-orange-500/25 bg-orange-500/10 p-4 text-sm font-medium text-orange-700">
              {copy.unavailableLabel}
            </div>
          )}
        </div>

        <div className="mt-7 border-t border-black/10 pt-4 text-xs font-medium text-black/55">
          <p>URL stable: {stableRoute}</p>
          <Link href="/download" className="mt-2 inline-flex text-black/70 underline-offset-4 hover:underline">
            Retour a la page de telechargement
          </Link>
        </div>
      </section>
    </main>
  );
}
