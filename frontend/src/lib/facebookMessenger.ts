"use client";

import { getApiBaseUrl } from "@/lib/api";
import { auth } from "@/lib/firebase";

export type ChatbotTone = "professionnel" | "amical" | "decontracte" | "formel";
export type ChatbotSetupStep = "need_org" | "connect_page" | "configure" | "complete";

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
  organization_slug: string;
  organization_name: string;
  can_manage_pages: boolean;
  can_edit: boolean;
  oauth_configured: boolean;
  direct_service_configured: boolean;
  callback_url: string;
  verify_token_hint: boolean;
  pages: FacebookMessengerPage[];
  has_active_page: boolean;
}

export interface ChatbotPreferences {
  organization_slug?: string;
  bot_name: string;
  tone: ChatbotTone;
  language: string;
  greeting_message: string;
  company_description: string;
  products_summary: string;
  special_instructions: string;
  has_preferences?: boolean;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface ChatbotSetupStatus {
  step: ChatbotSetupStep;
  has_connected_page: boolean;
  has_preferences: boolean;
  has_identity: boolean;
  has_business_profile: boolean;
  configure_stage: "identity" | "company" | null;
  active_page_name: string | null;
  active_page_id: string | null;
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
    return token ?? null;
  }

  try {
    return await currentUser.getIdToken(forceRefresh);
  } catch {
    return token ?? null;
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
    if (typeof payload?.detail === "string" && payload.detail.trim()) {
      return payload.detail;
    }
  } catch {}

  try {
    const text = await response.text();
    if (text.trim()) return text;
  } catch {}

  return fallback;
}

export function getDefaultChatbotPreferences(): ChatbotPreferences {
  return {
    bot_name: "L'assistant",
    tone: "amical",
    language: "fr",
    greeting_message: "",
    company_description: "",
    products_summary: "",
    special_instructions: "",
    has_preferences: false,
  };
}

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

export async function loadChatbotPreferences(token?: string | null): Promise<ChatbotPreferences> {
  const response = await fetch(`${getApiBaseUrl()}/api/chatbot-preferences`, {
    cache: "no-store",
    headers: buildAuthHeaders(token),
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Impossible de charger les preferences du chatbot."));
  }

  const payload = await response.json();
  return {
    ...getDefaultChatbotPreferences(),
    ...payload,
  } as ChatbotPreferences;
}

export async function updateChatbotPreferences(
  preferences: ChatbotPreferences,
  token: string
): Promise<ChatbotPreferences> {
  const response = await fetch(`${getApiBaseUrl()}/api/chatbot-preferences`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...(buildAuthHeaders(token) || {}),
    },
    body: JSON.stringify({
      bot_name: preferences.bot_name,
      tone: preferences.tone,
      language: preferences.language,
      greeting_message: preferences.greeting_message,
      company_description: preferences.company_description,
      products_summary: preferences.products_summary,
      special_instructions: preferences.special_instructions,
    }),
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Impossible d'enregistrer les preferences du chatbot."));
  }

  const payload = await response.json();
  return {
    ...getDefaultChatbotPreferences(),
    ...payload,
  } as ChatbotPreferences;
}

export async function loadChatbotSetupStatus(token: string): Promise<ChatbotSetupStatus> {
  const response = await fetch(`${getApiBaseUrl()}/api/chatbot/setup-status`, {
    cache: "no-store",
    headers: buildAuthHeaders(token),
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Impossible de charger le statut de setup du chatbot."));
  }

  return response.json();
}
