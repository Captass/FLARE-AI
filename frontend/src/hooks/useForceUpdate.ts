"use client";

import { useEffect, useState } from "react";
import { trackClientEvent } from "@/lib/api";
import {
  detectRuntimePlatform,
  getAndroidDownloadUrl,
  getPlatformApiBaseUrl,
  getWebAppUrl,
  getWindowsDownloadUrl,
  openExternalUrl,
  type RuntimePlatform,
} from "@/lib/platform/runtime";

export const APP_CURRENT_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || "2.0.2";

export type UpdateStatus =
  | "idle"
  | "checking"
  | "up_to_date"
  | "update_available"
  | "update_required"
  | "downloading"
  | "installing"
  | "error";

export interface UpdateInfo {
  currentVersion: string;
  latestVersion: string;
  releaseNotes: string;
  downloadUrl: string;
  platform: RuntimePlatform;
  mandatory: boolean;
  message: string;
}

function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map((part) => Number.parseInt(part, 10));
  const pb = b.split(".").map((part) => Number.parseInt(part, 10));

  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) < (pb[i] || 0)) return -1;
    if ((pa[i] || 0) > (pb[i] || 0)) return 1;
  }

  return 0;
}

function getApiBaseUrl(): string {
  if (typeof window === "undefined") return "";

  const platformApiUrl = getPlatformApiBaseUrl();
  if (platformApiUrl) return platformApiUrl;

  const configuredApiUrl = String(process.env.NEXT_PUBLIC_API_URL || "").trim().replace(/\/+$/, "");
  if (configuredApiUrl) return configuredApiUrl;

  const host = window.location.hostname;
  if (host === "localhost" || host === "127.0.0.1") return "http://localhost:8000";
  return "https://flare-backend-jyyz.onrender.com";
}

function getFallbackDownloadUrl(platform: RuntimePlatform): string {
  if (platform === "android") return getAndroidDownloadUrl();
  if (platform === "windows") return getWindowsDownloadUrl();
  return getWebAppUrl("/");
}

function readPlatformManifest(data: any, platform: RuntimePlatform) {
  return data?.platforms?.[platform] || null;
}

function makeServiceWorkerUpdateInfo(platform: RuntimePlatform): UpdateInfo {
  return {
    currentVersion: APP_CURRENT_VERSION,
    latestVersion: APP_CURRENT_VERSION,
    releaseNotes: "Nouvelle version web prete a etre chargee.",
    downloadUrl: typeof window === "undefined" ? "" : window.location.origin,
    platform,
    mandatory: false,
    message: "Une nouvelle version web est prete.",
  };
}

export function useForceUpdate() {
  const [status, setStatus] = useState<UpdateStatus>("idle");
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [swWaiting, setSwWaiting] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

    navigator.serviceWorker.ready.then((reg) => {
      if (reg.waiting) {
        setSwWaiting(reg.waiting);
      }

      reg.addEventListener("updatefound", () => {
        const newWorker = reg.installing;
        if (!newWorker) return;

        newWorker.addEventListener("statechange", () => {
          if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
            setSwWaiting(newWorker);
          }
        });
      });
    });

    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === "SW_UPDATED") {
        window.location.reload();
      }
    };

    navigator.serviceWorker.addEventListener("message", onMessage);
    return () => navigator.serviceWorker.removeEventListener("message", onMessage);
  }, []);

  useEffect(() => {
    const platform = detectRuntimePlatform();
    setStatus("checking");

    fetch(`${getApiBaseUrl()}/api/app/version`)
      .then((res) => res.json())
      .then((data) => {
        const manifest = readPlatformManifest(data, platform);
        const minRequired: string = manifest?.min_required_version || data.min_required?.[platform] || "0.0.0";
        const latestVersion: string = manifest?.latest_version || data.latest_version || data.current_version || minRequired;
        const isBlocked = compareVersions(APP_CURRENT_VERSION, minRequired) < 0;
        const hasOptionalUpdate = compareVersions(APP_CURRENT_VERSION, latestVersion) < 0;

        if (isBlocked || hasOptionalUpdate) {
          setUpdateInfo({
            currentVersion: APP_CURRENT_VERSION,
            latestVersion,
            releaseNotes: manifest?.release_notes || data.release_notes || "",
            downloadUrl: manifest?.download_url || getFallbackDownloadUrl(platform),
            platform,
            mandatory: isBlocked,
            message: isBlocked
              ? data.force_update_message || "Une mise a jour FLARE AI est requise pour continuer."
              : data.optional_update_message || "Une mise a jour FLARE AI est disponible.",
          });
          setStatus(isBlocked ? "update_required" : "update_available");
          return;
        }

        if (swWaiting) {
          setUpdateInfo(makeServiceWorkerUpdateInfo(platform));
          setStatus("update_available");
          return;
        }

        setStatus("up_to_date");
      })
      .catch((err) => {
        trackClientEvent("force_update_check_error", {
          platform,
          error: String(err),
          url: `${getApiBaseUrl()}/api/app/version`,
        });
        setStatus("up_to_date");
      });
    // The initial remote version check is intentionally run once per app load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (swWaiting && status === "up_to_date") {
      setUpdateInfo(makeServiceWorkerUpdateInfo(detectRuntimePlatform()));
      setStatus("update_available");
    }
  }, [swWaiting, status]);

  const applyUpdate = async () => {
    const platform = detectRuntimePlatform();
    setStatus("downloading");

    try {
      if (platform === "android" || platform === "windows") {
        await openExternalUrl(updateInfo?.downloadUrl || getFallbackDownloadUrl(platform));
        setStatus("installing");
        return;
      }

      if (swWaiting) {
        swWaiting.postMessage({ type: "SKIP_WAITING" });
        return;
      }

      window.location.reload();
    } catch (err) {
      window.open(updateInfo?.downloadUrl || getFallbackDownloadUrl(platform), "_blank");
      setStatus("installing");
    }
  };

  return { status, updateInfo, applyUpdate };
}
