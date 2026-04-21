"use client";

import { useEffect } from "react";
import {
  bootstrapRuntimeEnvironment,
  canOfferSimpleWebInstall,
  clearAuthResultParamsFromUrl,
  dispatchAuthResult,
  persistAuthResult,
  readAuthResultFromUrl,
  registerNativeAuthBridge,
  registerServiceWorker,
} from "@/lib/platform/runtime";

export default function PlatformRuntimeBoot() {
  useEffect(() => {
    let releaseNativeAuthBridge = () => {};

    bootstrapRuntimeEnvironment();
    void registerServiceWorker();

    const authResult = readAuthResultFromUrl();
    if (authResult) {
      persistAuthResult(authResult);
      dispatchAuthResult(authResult);
      clearAuthResultParamsFromUrl();
    }

    void registerNativeAuthBridge().then((cleanup) => {
      releaseNativeAuthBridge = cleanup;
    });

    const handleBeforeInstallPrompt = (event: Event) => {
      const promptEvent = event as Event & { preventDefault: () => void };
      promptEvent.preventDefault();
      if (!canOfferSimpleWebInstall()) {
        (window as any).deferredPrompt = null;
        return;
      }
      (window as any).deferredPrompt = event;
      window.dispatchEvent(new CustomEvent("pwa-prompt-ready"));
    };

    const handleOnline = () => {
      document.documentElement.dataset.networkStatus = navigator.onLine ? "online" : "offline";
      window.dispatchEvent(new CustomEvent("flare-network-state", { detail: { online: navigator.onLine } }));
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOnline);

    return () => {
      releaseNativeAuthBridge();
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOnline);
    };
  }, []);

  return null;
}
