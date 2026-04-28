"use client";

import { useEffect, useState } from "react";
import { detectRuntimePlatform } from "@/lib/platform/runtime";

// Version actuelle de cette build du frontend
export const APP_CURRENT_VERSION = "2.0.1";

export type UpdateStatus =
  | "idle"
  | "checking"
  | "up_to_date"
  | "update_required"
  | "downloading"
  | "installing"
  | "error";

export interface UpdateInfo {
  currentVersion: string;
  latestVersion: string;
  releaseNotes: string;
  downloadUrl: string;
  platform: string;
}

function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) < (pb[i] || 0)) return -1;
    if ((pa[i] || 0) > (pb[i] || 0)) return 1;
  }
  return 0;
}

function getApiBaseUrl(): string {
  if (typeof window === "undefined") return "";
  const h = window.location.hostname;
  // Si on est sur le web local, on peut utiliser localhost, sinon TOUJOURS la production (indispensable pour mobile)
  if (h === "localhost" || h === "127.0.0.1") return "http://localhost:8000";
  return "https://flare-backend-ab5h.onrender.com";
}

export function useForceUpdate() {
  const [status, setStatus] = useState<UpdateStatus>("idle");
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [swWaiting, setSwWaiting] = useState<ServiceWorker | null>(null);

  // ── Détection de nouvelle version du Service Worker (PWA/Web) ─────────────
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

    navigator.serviceWorker.ready.then((reg) => {
      // Si un worker attend déjà
      if (reg.waiting) {
        setSwWaiting(reg.waiting);
      }
      // Écoute les futures mises à jour
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

    // Écoute le message SKIP_WAITING envoyé par le bouton d'update
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === "SW_UPDATED") {
        window.location.reload();
      }
    };
    navigator.serviceWorker.addEventListener("message", onMessage);
    return () => navigator.serviceWorker.removeEventListener("message", onMessage);
  }, []);

  // ── Vérification de la version min requise depuis le backend ─────────────
  useEffect(() => {
    const platform = detectRuntimePlatform(); // "web" | "android" | "windows"
    console.log("[ForceUpdate] Platform detected:", platform);
    setStatus("checking");

    fetch(`${getApiBaseUrl()}/api/app/version`)
      .then((res) => res.json())
      .then((data) => {
        const minRequired: string = data.min_required?.[platform] ?? "0.0.0";
        const isOutdated = compareVersions(APP_CURRENT_VERSION, minRequired) < 0;

        if (isOutdated) {
          // Choisit l'URL de téléchargement adaptée à la plateforme
          const downloadUrl =
            platform === "android"
              ? `${getApiBaseUrl().replace(":8000", ":3000")}/downloads/android`
              : platform === "windows"
              ? `${getApiBaseUrl().replace(":8000", ":3000")}/downloads/windows`
              : window.location.origin;

          setUpdateInfo({
            currentVersion: APP_CURRENT_VERSION,
            latestVersion: data.current_version ?? minRequired,
            releaseNotes: data.release_notes ?? "",
            downloadUrl,
            platform,
          });
          setStatus("update_required");
        } else {
          // PWA : même si la version est OK, il peut y avoir un nouveau SW
          if (swWaiting) {
            setStatus("update_required");
          } else {
            setStatus("up_to_date");
          }
        }
      })
      .catch(() => {
        // En cas d'erreur réseau, on ne bloque pas l'utilisateur
        setStatus("up_to_date");
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Surveille l'arrivée d'un SW en attente après le check initial
  useEffect(() => {
    if (swWaiting && status === "up_to_date") {
      setStatus("update_required");
    }
  }, [swWaiting, status]);

  // ── Actions ────────────────────────────────────────────────────────────────
  const applyUpdate = async () => {
    const platform = detectRuntimePlatform();
    setStatus("downloading");

    try {
      if (platform === "android" || platform === "windows") {
        // Ouvre le lien de téléchargement natif dans le navigateur de l'OS
        const { Browser } = await import("@capacitor/browser");
        await Browser.open({ url: updateInfo?.downloadUrl ?? "" });
        // On ne peut pas "bloquer" davantage sur mobile (l'utilisateur doit installer)
        setStatus("installing");
      } else {
        // PWA / Web : le Service Worker se met à jour via SKIP_WAITING
        if (swWaiting) {
          swWaiting.postMessage({ type: "SKIP_WAITING" });
          // Le rechargement sera déclenché par l'événement SW_UPDATED
        } else {
          // Fallback : rechargement forcé avec vidage du cache
          window.location.reload();
        }
      }
    } catch (err) {
      console.error("[ForceUpdate] Erreur lors de la mise à jour:", err);
      // Fallback basique si Capacitor/Browser non disponible
      window.open(updateInfo?.downloadUrl ?? "", "_blank");
      setStatus("installing");
    }
  };

  return { status, updateInfo, applyUpdate };
}
