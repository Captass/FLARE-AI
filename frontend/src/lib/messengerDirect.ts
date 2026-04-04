"use client";

import { getApiBaseUrl } from "@/lib/api";

export type MessengerWorkspaceTab =
  | "overview"
  | "leads"
  | "conversations"
  | "expenses";

export interface MessengerSummaryStat {
  label: string;
  value: string;
  sublabel: string;
  accent: "orange" | "navy" | "neutral";
}

export interface MessengerPeriodStat {
  label: string;
  messages: number;
  tokens: number;
  costUsd: number;
  costLabel: string;
  quotes: number;
  purchases: number;
  needsHuman: number;
}

export interface MessengerPriorityItem {
  time: string;
  priority: string;
  customer: string;
  message: string;
  status: string;
  mode: string;
  tokens: number;
  costUsd: number;
  costLabel: string;
}

export interface MessengerMessageRow {
  psid: string;
  time: string;
  customer: string;
  message: string;
  reply: string;
  status: string;
  mode: string;
  needsHuman: boolean;
  readyToBuy: boolean;
  tokens: number;
  costUsd: number;
  costLabel: string;
  latencyMs: number;
  provider: string;
  model: string;
  intent: string;
}

export interface MessengerConversationExchange {
  time: string;
  customerMessage: string;
  agentReply: string;
}

export interface MessengerConversationCard {
  psid: string;
  customer: string;
  status: string;
  mode: string;
  humanTakeover: boolean;
  lastMessage: string;
  availableModes: string[];
  exchanges: MessengerConversationExchange[];
}

export interface MessengerBreakdownItem {
  label: string;
  count: number;
}

export interface MessengerProviderBreakdown {
  provider: string;
  model: string;
  messages: number;
  tokens: number;
  costUsd: number;
}

export interface MessengerCustomerHighlight {
  customer: string;
  status: string;
  needsHuman: boolean;
  readyToBuy: boolean;
  messageCount: number;
  totalCostUsd: number;
  totalTokens: number;
  lastMessageAt: string;
  lastMessage: string;
  lastReply: string;
  mode: string;
  psid: string;
}

export interface MessengerDashboardAccess {
  scope: "public" | "authenticated" | "operator";
  canViewSensitive: boolean;
  canExport: boolean;
  canSwitchMode: boolean;
  message: string;
}

export interface MessengerDashboardData {
  summary: MessengerSummaryStat[];
  periodStats: MessengerPeriodStat[];
  priorityQueue: MessengerPriorityItem[];
  recentMessages: MessengerMessageRow[];
  conversations: MessengerConversationCard[];
  archiveStatus: string;
  lastUpdated: string;
  totals: {
    messages24h: number;
    contacts: number;
    humanModeContacts: number;
    needsAttentionContacts: number;
    readyToBuyContacts: number;
    quoteRequests: number;
    avgLatencyMs: number;
    totalTokens: number;
    totalCostUsd: number;
    avgCostUsd: number;
    tokensPerMessage: number;
  };
  statusBreakdown: MessengerBreakdownItem[];
  intentBreakdown: MessengerBreakdownItem[];
  providerBreakdown: MessengerProviderBreakdown[];
  customerHighlights: MessengerCustomerHighlight[];
  access: MessengerDashboardAccess;
  urls: {
    json24h: string;
    jsonAll: string;
    csv24h: string;
    csvAll: string;
  };
}

export interface MessengerSyncHealth {
  state: "fresh" | "warning" | "stale";
  label: string;
  message: string;
  ageMinutes: number;
}

const DEFAULT_TOTALS: MessengerDashboardData["totals"] = {
  messages24h: 0,
  contacts: 0,
  humanModeContacts: 0,
  needsAttentionContacts: 0,
  readyToBuyContacts: 0,
  quoteRequests: 0,
  avgLatencyMs: 0,
  totalTokens: 0,
  totalCostUsd: 0,
  avgCostUsd: 0,
  tokensPerMessage: 0,
};

const DEFAULT_ACCESS: MessengerDashboardAccess = {
  scope: "public",
  canViewSensitive: false,
  canExport: false,
  canSwitchMode: false,
  message:
    "Mode decouverte actif : les noms clients, messages bruts, exports et reprises humaines sont reserves a un compte operateur autorise.",
};

const MOJIBAKE_PATTERN = /(?:Ã[\u0080-\u00FF]|Â[\u0080-\u00FF]|â[\u0080-\u00FF]|ð[\u0080-\u00FF]|�)/;

function normalizePath(path: string): string {
  return path.startsWith("/") ? path : `/${path}`;
}

function repairMojibake(value: string): string {
  if (!MOJIBAKE_PATTERN.test(value)) return value;

  try {
    const bytes = Uint8Array.from(value, (char) => char.charCodeAt(0));
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return value;
  }
}

function normalizeMessengerPayload<T>(value: T): T {
  if (typeof value === "string") {
    return repairMojibake(value) as T;
  }

  if (Array.isArray(value)) {
    return value.map((item) => normalizeMessengerPayload(item)) as T;
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, normalizeMessengerPayload(item)])
    ) as T;
  }

  return value;
}

function safeString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? repairMojibake(value) : fallback;
}

function safeNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function getAgeMinutes(value?: string): number {
  if (!value) return Number.POSITIVE_INFINITY;
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return Number.POSITIVE_INFINITY;
  return Math.max(0, Math.round((Date.now() - timestamp) / 60000));
}

export function formatMessengerSyncAge(ageMinutes: number): string {
  if (!Number.isFinite(ageMinutes)) return "mise a jour inconnue";
  if (ageMinutes < 1) return "a l'instant";
  if (ageMinutes < 60) return `il y a ${ageMinutes} min`;

  const hours = Math.floor(ageMinutes / 60);
  const minutes = ageMinutes % 60;

  if (minutes === 0) {
    return `il y a ${hours} h`;
  }

  return `il y a ${hours} h ${minutes} min`;
}

export function getMessengerSyncHealth(
  lastUpdated?: string,
  archiveStatus?: string
): MessengerSyncHealth {
  const ageMinutes = getAgeMinutes(lastUpdated);
  const normalizedArchiveStatus = safeString(archiveStatus).toLowerCase();

  if (
    ageMinutes > 180 ||
    normalizedArchiveStatus.includes("error") ||
    normalizedArchiveStatus.includes("fail") ||
    normalizedArchiveStatus.includes("stopp")
  ) {
    return {
      state: "stale",
      label: "A verifier",
      message:
        "La synchro Messenger semble arretee ou trop ancienne. Verifiez les logs avant de vous fier a ce cockpit.",
      ageMinutes,
    };
  }

  if (ageMinutes > 45) {
    return {
      state: "warning",
      label: "Synchro en retard",
      message:
        "Les donnees Messenger ont du retard. Le cockpit reste lisible, mais il faut confirmer que la collecte tourne encore.",
      ageMinutes,
    };
  }

  return {
    state: "fresh",
    label: "Live",
    message: "Les donnees Messenger sont recentes.",
    ageMinutes,
  };
}

export function getMessengerExportUrl(fileType: "json" | "csv", range: "24h" | "all" = "24h"): string {
  return `${getApiBaseUrl()}/dashboard/messenger/export.${fileType}?range=${range}`;
}

function buildAuthHeaders(token?: string | null): HeadersInit | undefined {
  if (!token) return undefined;
  return {
    Authorization: `Bearer ${token}`,
  };
}

function getExportFileName(
  response: Response,
  fallbackType: "json" | "csv",
  fallbackRange: "24h" | "all"
): string {
  const contentDisposition = response.headers.get("content-disposition") || "";
  const match = contentDisposition.match(/filename="?([^"]+)"?/i);
  if (match?.[1]) return match[1];
  return `messenger-dashboard-${fallbackRange}.${fallbackType}`;
}

export async function loadMessengerDashboardData(token?: string | null, pageId?: string | null): Promise<MessengerDashboardData> {
  const url = pageId ? `${getApiBaseUrl()}/dashboard/messenger?page_id=${pageId}` : `${getApiBaseUrl()}/dashboard/messenger`;
  const response = await fetch(url, {
    cache: "no-store",
    headers: buildAuthHeaders(token),
  });

  if (!response.ok) {
    throw new Error("Impossible de charger les donnees du chatbot Messenger.");
  }

  const data = normalizeMessengerPayload(await response.json()) as Record<string, any>;
  const totals = typeof data?.totals === "object" && data?.totals !== null ? data.totals : {};
  const access = typeof data?.access === "object" && data?.access !== null ? data.access : {};

  return {
    ...data,
    summary: Array.isArray(data?.summary) ? data.summary : [],
    periodStats: Array.isArray(data?.periodStats) ? data.periodStats : [],
    priorityQueue: Array.isArray(data?.priorityQueue) ? data.priorityQueue : [],
    recentMessages: Array.isArray(data?.recentMessages) ? data.recentMessages : [],
    conversations: Array.isArray(data?.conversations) ? data.conversations : [],
    archiveStatus: safeString(data?.archiveStatus),
    lastUpdated: safeString(data?.lastUpdated),
    totals: {
      messages24h: safeNumber(totals.messages24h, DEFAULT_TOTALS.messages24h),
      contacts: safeNumber(totals.contacts, DEFAULT_TOTALS.contacts),
      humanModeContacts: safeNumber(totals.humanModeContacts, DEFAULT_TOTALS.humanModeContacts),
      needsAttentionContacts: safeNumber(totals.needsAttentionContacts, DEFAULT_TOTALS.needsAttentionContacts),
      readyToBuyContacts: safeNumber(totals.readyToBuyContacts, DEFAULT_TOTALS.readyToBuyContacts),
      quoteRequests: safeNumber(totals.quoteRequests, DEFAULT_TOTALS.quoteRequests),
      avgLatencyMs: safeNumber(totals.avgLatencyMs, DEFAULT_TOTALS.avgLatencyMs),
      totalTokens: safeNumber(totals.totalTokens, DEFAULT_TOTALS.totalTokens),
      totalCostUsd: safeNumber(totals.totalCostUsd, DEFAULT_TOTALS.totalCostUsd),
      avgCostUsd: safeNumber(totals.avgCostUsd, DEFAULT_TOTALS.avgCostUsd),
      tokensPerMessage: safeNumber(totals.tokensPerMessage, DEFAULT_TOTALS.tokensPerMessage),
    },
    statusBreakdown: Array.isArray(data?.statusBreakdown) ? data.statusBreakdown : [],
    intentBreakdown: Array.isArray(data?.intentBreakdown) ? data.intentBreakdown : [],
    providerBreakdown: Array.isArray(data?.providerBreakdown) ? data.providerBreakdown : [],
    customerHighlights: Array.isArray(data?.customerHighlights) ? data.customerHighlights : [],
    access: {
      scope:
        access.scope === "operator" || access.scope === "authenticated" ? access.scope : DEFAULT_ACCESS.scope,
      canViewSensitive:
        typeof access.canViewSensitive === "boolean" ? access.canViewSensitive : DEFAULT_ACCESS.canViewSensitive,
      canExport: typeof access.canExport === "boolean" ? access.canExport : DEFAULT_ACCESS.canExport,
      canSwitchMode:
        typeof access.canSwitchMode === "boolean" ? access.canSwitchMode : DEFAULT_ACCESS.canSwitchMode,
      message: safeString(access.message, DEFAULT_ACCESS.message),
    },
    urls: {
      json24h: `${getApiBaseUrl()}${normalizePath(data.urls?.json24h || "/dashboard/messenger/export.json?range=24h")}`,
      jsonAll: `${getApiBaseUrl()}${normalizePath(data.urls?.jsonAll || "/dashboard/messenger/export.json?range=all")}`,
      csv24h: `${getApiBaseUrl()}${normalizePath(data.urls?.csv24h || "/dashboard/messenger/export.csv?range=24h")}`,
      csvAll: `${getApiBaseUrl()}${normalizePath(data.urls?.csvAll || "/dashboard/messenger/export.csv?range=all")}`,
    },
  } as MessengerDashboardData;
}

export async function downloadMessengerExport(
  fileType: "json" | "csv",
  range: "24h" | "all",
  token?: string | null
): Promise<void> {
  if (!token) {
    throw new Error("Connectez-vous pour exporter les donnees Messenger.");
  }

  const response = await fetch(getMessengerExportUrl(fileType, range), {
    headers: buildAuthHeaders(token),
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error("Connectez-vous avec un compte operateur autorise pour exporter les donnees Messenger.");
    }
    if (response.status === 403) {
      throw new Error("Votre compte ne peut pas exporter les donnees Messenger.");
    }
    throw new Error("L'export Messenger a echoue.");
  }

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = getExportFileName(response, fileType, range);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

export async function updateMessengerContactMode(
  psid: string,
  mode: "human" | "agent",
  token?: string | null
): Promise<void> {
  if (!token) {
    throw new Error("Connectez-vous pour changer le mode d'une conversation.");
  }

  const body = new URLSearchParams({ psid, mode });
  const response = await fetch(`${getApiBaseUrl()}/dashboard/messenger/contact-mode`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      ...(buildAuthHeaders(token) || {}),
    },
    body,
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error("Connectez-vous avec un compte operateur autorise pour changer le mode Messenger.");
    }
    if (response.status === 403) {
      throw new Error("Votre compte ne peut pas changer le mode des conversations Messenger.");
    }
    throw new Error("La mise a jour du mode Messenger a echoue.");
  }
}
