"use client";

export type RuntimePlatform = "web" | "android" | "windows";
export type AuthProvider = "facebook" | "google";
export type BrowserPlatform = "windows" | "android" | "macos" | "ios" | "other";
export type InstallChannel = "windows-native" | "android-native" | "simple-web" | "web";
export type NativeReleasePlatform = "android" | "windows";

export interface RuntimeAuthResult {
  provider: AuthProvider;
  status: "success" | "error";
  detail?: string;
  pageCount?: number;
  timestamp: string;
}

const AUTH_RESULT_PREFIX = "flare_auth_result:";
const DEFAULT_WEB_APP_PATH = "/app?auth=signup";
const DEFAULT_ANDROID_CALLBACK_URL = "flareai://oauth/android";
const DEFAULT_WINDOWS_CALLBACK_URL = "flareai://oauth/windows";
const STABLE_ANDROID_DOWNLOAD_ROUTE = "/downloads/android";
const STABLE_WINDOWS_DOWNLOAD_ROUTE = "/downloads/windows";
const FLARE_NATIVE_AUTH_EVENT = "flare-native-auth-url";

function getWindowLike(): (Window & typeof globalThis) | null {
  return typeof window === "undefined" ? null : window;
}

function getNavigatorPlatform(): string {
  const win = getWindowLike() as (Window & typeof globalThis & { navigator: Navigator & { userAgentData?: { platform?: string } } }) | null;
  if (!win) return "";
  return String(win.navigator.userAgentData?.platform || win.navigator.platform || "").toLowerCase();
}

function getCapacitorPlatform(): string {
  const win = getWindowLike() as any;
  return String(win?.Capacitor?.getPlatform?.() || "").toLowerCase();
}

export function getBrowserPlatform(): BrowserPlatform {
  const win = getWindowLike();
  if (!win) return "other";

  const userAgent = String(win.navigator.userAgent || "").toLowerCase();
  const platform = getNavigatorPlatform();

  if (userAgent.includes("android")) return "android";
  if (userAgent.includes("iphone") || userAgent.includes("ipad") || userAgent.includes("ipod")) return "ios";
  if (platform.includes("win")) return "windows";
  if (platform.includes("mac")) return "macos";
  return "other";
}

export function detectRuntimePlatform(): RuntimePlatform {
  const win = getWindowLike() as any;
  if (!win) return "web";

  const capacitorPlatform = getCapacitorPlatform();
  if (capacitorPlatform === "android") return "android";

  if (win.__TAURI__) {
    const navigatorPlatform = getNavigatorPlatform();
    if (navigatorPlatform.includes("win")) return "windows";
  }

  return "web";
}

export function isNativeRuntime(): boolean {
  return detectRuntimePlatform() !== "web";
}

export function isStandaloneWebApp(): boolean {
  const win = getWindowLike() as (Window & typeof globalThis & { navigator: Navigator & { standalone?: boolean } }) | null;
  if (!win) return false;

  return Boolean(
    win.matchMedia?.("(display-mode: standalone)")?.matches ||
    win.matchMedia?.("(display-mode: fullscreen)")?.matches ||
    win.navigator.standalone
  );
}

export function isInstalledAppRuntime(): boolean {
  return isNativeRuntime() || isStandaloneWebApp();
}

export function shouldUseRedirectAuthFlow(): boolean {
  return isNativeRuntime();
}

function trimUrl(value?: string | null): string {
  return String(value || "").trim().replace(/\/+$/, "");
}

function readFirstEnvValue(...values: Array<string | undefined>): string {
  for (const value of values) {
    const normalized = String(value || "").trim();
    if (normalized) {
      return normalized;
    }
  }

  return "";
}

export function getCurrentOrigin(): string {
  const win = getWindowLike();
  return win ? win.location.origin : "";
}

export function getAppReturnUrl(path = "/app"): string {
  const platform = detectRuntimePlatform();
  const platformUrl =
    platform === "android"
      ? process.env.NEXT_PUBLIC_ANDROID_CALLBACK_URL
      : platform === "windows"
        ? process.env.NEXT_PUBLIC_WINDOWS_CALLBACK_URL
        : "";

  if (platform !== "web") {
    const configured = trimUrl(platformUrl);
    if (configured) {
      return configured;
    }

    if (platform === "android") return DEFAULT_ANDROID_CALLBACK_URL;
    if (platform === "windows") return DEFAULT_WINDOWS_CALLBACK_URL;
  }

  const origin = trimUrl(getCurrentOrigin());
  if (!origin) {
    return "";
  }
  return new URL(path, `${origin}/`).toString();
}

export function getPlatformApiBaseUrl(): string | null {
  const platform = detectRuntimePlatform();
  const configured =
    platform === "android"
      ? process.env.NEXT_PUBLIC_API_URL_ANDROID
      : platform === "windows"
        ? process.env.NEXT_PUBLIC_API_URL_DESKTOP
        : "";

  const normalized = trimUrl(configured);
  return normalized || null;
}

function resolveAbsoluteUrl(configuredUrl: string | undefined, fallbackPath: string): string {
  const normalizedConfiguredUrl = String(configuredUrl || "").trim();
  if (normalizedConfiguredUrl) {
    return normalizedConfiguredUrl;
  }

  const origin = trimUrl(getCurrentOrigin());
  if (!origin) {
    return fallbackPath;
  }

  return new URL(fallbackPath, `${origin}/`).toString();
}

function getConfiguredAbsoluteUrl(configuredUrl: string | undefined): string {
  const normalizedConfiguredUrl = String(configuredUrl || "").trim();
  if (!normalizedConfiguredUrl) {
    return "";
  }

  if (/^https?:\/\//i.test(normalizedConfiguredUrl)) {
    return normalizedConfiguredUrl;
  }

  const origin = trimUrl(getCurrentOrigin());
  if (!origin) {
    return normalizedConfiguredUrl;
  }

  return new URL(normalizedConfiguredUrl, `${origin}/`).toString();
}

export function getWindowsDownloadUrl(): string {
  return getConfiguredAbsoluteUrl(
    readFirstEnvValue(
      process.env.NEXT_PUBLIC_WINDOWS_RELEASE_ASSET_URL,
      process.env.NEXT_PUBLIC_WINDOWS_DOWNLOAD_URL
    ) || "https://github.com/Captass/FLARE-AI/releases/download/v2.0.2/flare-ai-windows-setup.exe"
  );
}

export function hasWindowsDownload(): boolean {
  return Boolean(getWindowsDownloadUrl());
}

export function getAndroidDownloadUrl(): string {
  return getConfiguredAbsoluteUrl(
    readFirstEnvValue(
      process.env.NEXT_PUBLIC_ANDROID_RELEASE_ASSET_URL,
      process.env.NEXT_PUBLIC_ANDROID_DOWNLOAD_URL
    ) || "https://github.com/Captass/FLARE-AI/releases/download/v2.0.2/flare-ai-android.apk"
  );
}

export function hasAndroidDownload(): boolean {
  return Boolean(getAndroidDownloadUrl());
}

export function getSimpleWebAppUrl(): string {
  return resolveAbsoluteUrl(process.env.NEXT_PUBLIC_WEB_APP_URL, DEFAULT_WEB_APP_PATH);
}

export function getWindowsDownloadRoute(): string {
  return STABLE_WINDOWS_DOWNLOAD_ROUTE;
}

export function getAndroidDownloadRoute(): string {
  return STABLE_ANDROID_DOWNLOAD_ROUTE;
}

export function getReleaseVersion(platform: NativeReleasePlatform): string {
  if (platform === "android") {
    return readFirstEnvValue(process.env.NEXT_PUBLIC_ANDROID_RELEASE_VERSION) || "2.0.2";
  }

  return readFirstEnvValue(process.env.NEXT_PUBLIC_WINDOWS_RELEASE_VERSION) || "2.0.2";
}

export function getReleaseDate(platform: NativeReleasePlatform): string {
  if (platform === "android") {
    return readFirstEnvValue(process.env.NEXT_PUBLIC_ANDROID_RELEASE_DATE) || "2026-04-29";
  }

  return readFirstEnvValue(process.env.NEXT_PUBLIC_WINDOWS_RELEASE_DATE) || "2026-04-29";
}

export function getWebAppUrl(path = "/app"): string {
  const configured = trimUrl(process.env.NEXT_PUBLIC_WEB_APP_URL);
  if (configured && /^https?:\/\//i.test(configured)) {
    return configured;
  }

  const origin = trimUrl(getCurrentOrigin());
  if (!origin) {
    return configured || "";
  }

  return new URL(path, `${origin}/`).toString();
}

export function canOfferSimpleWebInstall(): boolean {
  const platform = getBrowserPlatform();
  return platform === "macos" || platform === "ios";
}

export function getPreferredInstallChannel(): InstallChannel {
  const platform = getBrowserPlatform();
  if (platform === "windows") return "windows-native";
  if (platform === "android") return "android-native";
  if (platform === "macos" || platform === "ios") return "simple-web";
  return "web";
}

export function setStoredValue(key: string, value: string): void {
  const win = getWindowLike();
  if (!win) return;
  win.localStorage.setItem(key, value);
}

export function getStoredValue(key: string): string | null {
  const win = getWindowLike();
  if (!win) return null;
  return win.localStorage.getItem(key);
}

export function removeStoredValue(key: string): void {
  const win = getWindowLike();
  if (!win) return;
  win.localStorage.removeItem(key);
}

export function persistAuthResult(result: RuntimeAuthResult): void {
  setStoredValue(`${AUTH_RESULT_PREFIX}${result.provider}`, JSON.stringify(result));
}

export function consumeAuthResult(provider: AuthProvider): RuntimeAuthResult | null {
  const raw = getStoredValue(`${AUTH_RESULT_PREFIX}${provider}`);
  if (!raw) return null;
  removeStoredValue(`${AUTH_RESULT_PREFIX}${provider}`);
  try {
    return JSON.parse(raw) as RuntimeAuthResult;
  } catch {
    return null;
  }
}

export function dispatchAuthResult(result: RuntimeAuthResult): void {
  const win = getWindowLike();
  if (!win) return;
  win.dispatchEvent(new CustomEvent("flare-auth-result", { detail: result }));
}

export function readAuthResultFromUrl(): RuntimeAuthResult | null {
  const win = getWindowLike();
  if (!win) return null;
  return readAuthResultFromRawUrl(win.location.href);
}

export function readAuthResultFromRawUrl(rawUrl: string): RuntimeAuthResult | null {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }

  const provider = url.searchParams.get("oauth_type");
  const status = url.searchParams.get("status");

  if ((provider !== "facebook" && provider !== "google") || (status !== "success" && status !== "error")) {
    return null;
  }

  const pageCountRaw = url.searchParams.get("page_count");
  return {
    provider,
    status,
    detail: url.searchParams.get("detail") || undefined,
    pageCount: pageCountRaw ? Number(pageCountRaw) : undefined,
    timestamp: new Date().toISOString(),
  };
}

export function clearAuthResultParamsFromUrl(): void {
  const win = getWindowLike();
  if (!win) return;
  const url = new URL(win.location.href);
  const next = new URL(url.toString());
  ["oauth_type", "status", "detail", "page_count"].forEach((key) => next.searchParams.delete(key));
  win.history.replaceState({}, "", `${next.pathname}${next.search}${next.hash}`);
}

export async function openExternalUrl(url: string): Promise<void> {
  const win = getWindowLike() as any;
  if (!win) return;

  if (win.__TAURI__) {
    try {
      const { open } = await import("@tauri-apps/api/shell");
      await open(url);
      return;
    } catch (error) {
      console.warn("Failed to open external URL via Tauri shell", error);
    }
  }

  const capacitorBrowser = win.Capacitor?.Plugins?.Browser;
  if (capacitorBrowser?.open) {
    await capacitorBrowser.open({ url });
    return;
  }

  win.open(url, "_blank", "noopener,noreferrer");
}

export async function registerServiceWorker(): Promise<void> {
  const win = getWindowLike();
  if (!win || !("serviceWorker" in win.navigator)) {
    return;
  }

  if (win.location.hostname === "localhost" || win.location.hostname === "127.0.0.1") {
    try {
      const registrations = await win.navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.unregister()));
    } catch (error) {
      console.warn("Failed to clear local service workers", error);
    }
    return;
  }

  if (process.env.NODE_ENV !== "production") {
    return;
  }

  try {
    await win.navigator.serviceWorker.register("/sw.js");
  } catch (error) {
    console.warn("Failed to register service worker", error);
  }
}

export function consumeNativeAuthCallbackUrl(rawUrl: string | null | undefined): RuntimeAuthResult | null {
  const normalized = String(rawUrl || "").trim();
  if (!normalized) {
    return null;
  }

  const authResult = readAuthResultFromRawUrl(normalized);
  if (!authResult) {
    return null;
  }

  persistAuthResult(authResult);
  dispatchAuthResult(authResult);
  return authResult;
}

export async function registerNativeAuthBridge(): Promise<() => void> {
  const win = getWindowLike() as (Window & typeof globalThis & { __FLARE_NATIVE_AUTH_URL__?: string }) | null;
  if (!win || !isNativeRuntime()) {
    return () => {};
  }

  const cleanups: Array<() => void> = [];

  consumeNativeAuthCallbackUrl(win.__FLARE_NATIVE_AUTH_URL__);
  delete win.__FLARE_NATIVE_AUTH_URL__;

  if (detectRuntimePlatform() === "android") {
    try {
      const { App } = await import("@capacitor/app");

      const launchUrl = await App.getLaunchUrl();
      consumeNativeAuthCallbackUrl(launchUrl?.url);

      const listener = await App.addListener("appUrlOpen", ({ url }) => {
        consumeNativeAuthCallbackUrl(url);
      });

      cleanups.push(() => {
        void listener.remove();
      });
    } catch (error) {
      console.warn("Failed to register Capacitor appUrlOpen listener", error);
    }
  }

  if ((win as any).__TAURI__) {
    try {
      const { listen } = await import("@tauri-apps/api/event");
      const unlisten = await listen<string>(FLARE_NATIVE_AUTH_EVENT, (event) => {
        consumeNativeAuthCallbackUrl(event.payload);
      });

      cleanups.push(() => {
        unlisten();
      });
    } catch (error) {
      console.warn("Failed to register Tauri native auth listener", error);
    }

    const handleWindowNativeAuth = (event: Event) => {
      const customEvent = event as CustomEvent<string>;
      consumeNativeAuthCallbackUrl(customEvent.detail);
    };

    win.addEventListener(FLARE_NATIVE_AUTH_EVENT, handleWindowNativeAuth as EventListener);
    cleanups.push(() => {
      win.removeEventListener(FLARE_NATIVE_AUTH_EVENT, handleWindowNativeAuth as EventListener);
    });
  }

  return () => {
    cleanups.forEach((cleanup) => cleanup());
  };
}

export function bootstrapRuntimeEnvironment(): void {
  const win = getWindowLike();
  if (!win) return;

  const root = win.document.documentElement;
  root.dataset.runtimePlatform = detectRuntimePlatform();
  root.dataset.installedApp = isInstalledAppRuntime() ? "true" : "false";
  root.dataset.networkStatus = win.navigator.onLine ? "online" : "offline";
}
