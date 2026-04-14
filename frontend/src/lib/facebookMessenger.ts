"use client";

import { getApiBaseUrl } from "@/lib/api";
import { auth } from "@/lib/firebase";

export interface FacebookMessengerPage {
  id: string;
  page_id: string;
  page_name: string;
  page_picture_url?: string;
  page_category: string;
  page_tasks: string[];
  status: string;
  is_active: boolean;
  webhook_subscribed: boolean;
  direct_service_synced: boolean;
  connected_by_email: string;
  connected_at?: string | null;
  last_synced_at?: string | null;
  last_error?: string;
  metadata?: Record<string, unknown>;
}

export interface FacebookMessengerStatus {
  can_connect_facebook?: boolean;
  facebook_access_code?: string;
  facebook_access_message?: string;
  can_manage_pages: boolean;
  can_edit: boolean;
  oauth_configured: boolean;
  direct_service_configured: boolean;
  pages: FacebookMessengerPage[];
  permission_warning_count?: number;
  has_active_page: boolean;
}

export const META_PUBLIC_ACCESS_BLOCKED_MESSAGE =
  "La connexion Meta n'a pas abouti. Si Facebook affiche 'Fonctionnalite indisponible', le blocage vient de l'app Meta et non de FLARE.";

export interface FacebookAuthDebugInfo {
  client_id: string;
  redirect_uri: string;
  frontend_origin: string;
  graph_version: string;
  scopes: string[];
  oauth_configured: boolean;
  backend_url: string;
}

function buildAuthHeaders(token?: string | null): HeadersInit | undefined {
  if (!token) return undefined;
  return {
    Authorization: `Bearer ${token}`,
  };
}

async function resolveAuthToken(token?: string | null, forceRefresh = false): Promise<string | null> {
  if (token && !forceRefresh) {
    return token;
  }

  const currentUser = auth.currentUser;
  if (!currentUser) {
    return null;
  }

  try {
    return await currentUser.getIdToken(forceRefresh);
  } catch {
    return null;
  }
}

async function facebookRequestWithTokenRetry(
  url: string,
  init: RequestInit = {},
  token?: string | null
): Promise<Response> {
  const baseHeaders = (init.headers as Record<string, string> | undefined) || {};
  const execute = async (resolvedToken: string | null) =>
    fetch(url, {
      ...init,
      headers: {
        ...baseHeaders,
        ...(buildAuthHeaders(resolvedToken) || {}),
      },
    });

  const firstToken = await resolveAuthToken(token);
  const firstResponse = await execute(firstToken);
  if (firstResponse.status !== 401) {
    return firstResponse;
  }

  const refreshedToken = await resolveAuthToken(token, true);
  if (!refreshedToken || refreshedToken === firstToken) {
    return firstResponse;
  }

  return execute(refreshedToken);
}

async function readErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const payload = await response.json();
    const d = payload?.detail;
    if (typeof d === "string" && d.trim()) {
      return d.trim();
    }
    if (Array.isArray(d)) {
      const parts = d
        .map((item: unknown) => {
          if (item && typeof item === "object" && "msg" in item) {
            return String((item as { msg: string }).msg).trim();
          }
          return "";
        })
        .filter(Boolean);
      if (parts.length) return parts.join(" ");
    }
  } catch {
    /* ignore */
  }

  try {
    const text = await response.text();
    if (text.trim()) return text.trim();
  } catch {
    /* ignore */
  }

  return fallback;
}

// Les fonctions chatbot preferences/setup sont desormais dans api.ts
// (getChatbotPreferences, updateChatbotPreferences, DEFAULT_CHATBOT_PREFERENCES)

export async function loadFacebookMessengerStatus(token?: string | null): Promise<FacebookMessengerStatus> {
  const response = await facebookRequestWithTokenRetry(`${getApiBaseUrl()}/api/facebook/status`, {
    cache: "no-store",
  }, token);

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Impossible de charger l'etat Facebook Messenger."));
  }

  return response.json();
}

export async function getFacebookMessengerAuthorizationUrl(
  token: string | null | undefined,
  frontendOrigin: string
): Promise<string> {
  const url = new URL(`${getApiBaseUrl()}/api/facebook/auth`);
  url.searchParams.set("frontend_origin", frontendOrigin);

  const response = await facebookRequestWithTokenRetry(url.toString(), {}, token);

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Impossible de lancer l'autorisation Facebook."));
  }

  const payload = await response.json();
  return String(payload?.authorization_url || "");
}

export async function loadFacebookAuthDebugInfo(
  token: string | null | undefined,
  frontendOrigin: string
): Promise<FacebookAuthDebugInfo> {
  const url = new URL(`${getApiBaseUrl()}/api/facebook/auth-debug`);
  url.searchParams.set("frontend_origin", frontendOrigin);

  const response = await facebookRequestWithTokenRetry(url.toString(), {}, token);

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Impossible de charger le diagnostic OAuth Facebook."));
  }

  return response.json();
}

/**
 * Ouvre la fenêtre OAuth Meta et attend le message posté par la page de callback.
 * Côté Meta, l’écran peut ressembler à une « reconnexion » ou « continuer comme… » : c’est l’étape d’autorisation, pas le choix des pages FLARE.
 * Les pages importées apparaissent dans la liste de l’app après fermeture de la fenêtre.
 */
export async function runFacebookMessengerOAuthPopup(token: string): Promise<void> {
  if (typeof window === "undefined") return;
  const authUrl = await getFacebookMessengerAuthorizationUrl(token, window.location.origin);
  if (!authUrl.trim()) {
    throw new Error("URL d'autorisation Meta manquante.");
  }
  const popup = window.open(authUrl, "flare-facebook-oauth", "width=680,height=760");
  if (!popup) {
    throw new Error("Popup bloquée. Autorisez les popups pour ce site puis réessayez.");
  }

  await new Promise<void>((resolve, reject) => {
    let done = false;
    let receivedResult = false;
    const cleanup = () => {
      if (done) return;
      done = true;
      window.removeEventListener("message", handleMessage);
      window.clearInterval(closeWatcher);
    };
    const handleMessage = (event: MessageEvent) => {
      const allowedOrigins = new Set([window.location.origin, new URL(getApiBaseUrl()).origin]);
      if (!allowedOrigins.has(event.origin)) return;
      const payload = event.data as { type?: string; status?: string; detail?: string } | null;
      if (!payload || payload.type !== "flare-facebook-oauth") return;
      receivedResult = true;
      cleanup();
      if (payload.status === "success") {
        resolve();
      } else {
        reject(new Error((payload.detail || "").trim() || "Connexion Meta annulée ou refusée."));
      }
    };
    const closeWatcher = window.setInterval(() => {
      if (!popup.closed) return;
      cleanup();
      if (receivedResult) {
        resolve();
      } else {
        reject(new Error(META_PUBLIC_ACCESS_BLOCKED_MESSAGE));
      }
    }, 400);
    window.addEventListener("message", handleMessage);
  });
}

/** Met à jour la liste des pages depuis Meta (sans OAuth) si un token utilisateur est déjà stocké. */
export async function resyncFacebookMessengerPages(
  token: string | null | undefined
): Promise<FacebookMessengerPage[]> {
  const response = await facebookRequestWithTokenRetry(
    `${getApiBaseUrl()}/api/facebook/resync-pages`,
    { method: "POST", headers: { "Content-Type": "application/json" } },
    token
  );

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Impossible d'actualiser la liste des pages Facebook."));
  }

  const payload = await response.json();
  return Array.isArray(payload?.pages) ? (payload.pages as FacebookMessengerPage[]) : [];
}

export async function activateFacebookMessengerPage(
  pageId: string,
  token: string | null | undefined
): Promise<FacebookMessengerPage> {
  const response = await facebookRequestWithTokenRetry(
    `${getApiBaseUrl()}/api/facebook/pages/${encodeURIComponent(pageId)}/activate`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ page_id: pageId }),
    },
    token
  );

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Activation Facebook impossible."));
  }

  const payload = await response.json();
  return payload.page as FacebookMessengerPage;
}

export async function deactivateFacebookMessengerPage(
  pageId: string,
  token: string | null | undefined
): Promise<FacebookMessengerPage> {
  const response = await facebookRequestWithTokenRetry(
    `${getApiBaseUrl()}/api/facebook/pages/${encodeURIComponent(pageId)}/deactivate`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    },
    token
  );

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Desactivation Facebook impossible."));
  }

  const payload = await response.json();
  return payload.page as FacebookMessengerPage;
}

export async function disconnectFacebookMessengerPage(
  pageId: string,
  token: string | null | undefined
): Promise<FacebookMessengerPage> {
  const response = await facebookRequestWithTokenRetry(
    `${getApiBaseUrl()}/api/facebook/pages/${encodeURIComponent(pageId)}`,
    {
      method: "DELETE",
    },
    token
  );

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Deconnexion Facebook impossible."));
  }

  const payload = await response.json();
  return payload.page as FacebookMessengerPage;
}
