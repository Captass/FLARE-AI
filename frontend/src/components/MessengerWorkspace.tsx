"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  AlertCircle,
  ArrowUpRight,
  Bot,
  ChevronRight,
  ChevronsRight,
  Clock3,
  Download,
  Loader2,
  MessageCircleMore,
  RefreshCcw,
  Search,
  User,
  Users,
  Wallet,
  Zap,
} from "lucide-react";
import {
  downloadMessengerExport,
  MessengerConversationCard,
  MessengerCustomerHighlight,
  MessengerDashboardData,
  MessengerWorkspaceTab,
  formatMessengerSyncAge,
  getMessengerSyncHealth,
  loadMessengerDashboardData,
  updateMessengerContactMode,
} from "@/lib/messengerDirect";
import {
  activateFacebookMessengerPage,
  disconnectFacebookMessengerPage,
  FacebookMessengerStatus,
  getFacebookMessengerAuthorizationUrl,
  loadFacebookMessengerStatus,
} from "@/lib/facebookMessenger";
import { getApiBaseUrl } from "@/lib/api";

/* ─── Props ─── */

interface MessengerWorkspaceProps {
  initialTab?: MessengerWorkspaceTab;
  initialConversationId?: string | null;
  onOpenAssistant?: () => void;
  onNavigate?: (view: string) => void;
  onOpenConversation?: (psid: string) => void;
  onRequestAccess?: () => void;
  authToken?: string | null;
  selectedPageId?: string | null;
}

/* ─── Utils ─── */

function formatCurrency(v: number): string {
  if (!Number.isFinite(v)) return "$0.00";
  return `$${v >= 0.01 ? v.toFixed(2) : v.toFixed(4)}`;
}

function formatNumber(v: number): string {
  return new Intl.NumberFormat("fr-FR").format(v || 0);
}

function formatDate(v?: string): string {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function normSearch(v: string): string {
  return (v || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function statusColor(s: string): string {
  const n = s.toLowerCase();
  if (n.includes("hot")) return "text-orange-400";
  if (n.includes("support") || n.includes("human")) return "text-red-400";
  if (n.includes("qualified")) return "text-blue-400";
  if (n.includes("new")) return "text-emerald-400";
  return "text-white/40";
}

const FACEBOOK_OAUTH_TIMEOUT_MS = 3 * 60 * 1000;

type FacebookOauthOutcomeState = "connected" | "unchanged" | "activation_required" | "activated";

type FacebookOauthOutcome = {
  state: FacebookOauthOutcomeState;
  title: string;
  detail: string;
};

function summarizeFacebookOauthOutcome(
  previousPages: FacebookMessengerStatus["pages"],
  nextStatus: FacebookMessengerStatus | null
): FacebookOauthOutcome {
  const nextPages = nextStatus?.pages ?? [];
  const previousPageIds = new Set(previousPages.map((page) => page.page_id));
  const previousActivePageIds = new Set(
    previousPages.filter((page) => page.is_active).map((page) => page.page_id)
  );
  const nextActivePages = nextPages.filter((page) => page.is_active);

  const newlyLoadedPages = nextPages.filter((page) => !previousPageIds.has(page.page_id));
  const newlyActivatedPages = nextPages.filter(
    (page) => page.is_active && !previousActivePageIds.has(page.page_id)
  );
  const hasVisibleChange =
    newlyLoadedPages.length > 0 ||
    newlyActivatedPages.length > 0 ||
    nextPages.length !== previousPages.length;
  const needsActivation = nextPages.length > 0 && nextActivePages.length === 0;

  if (hasVisibleChange && needsActivation) {
    const loadedNames = newlyLoadedPages
      .map((page) => page.page_name)
      .filter(Boolean)
      .slice(0, 2)
      .join(", ");
    return {
      state: "activation_required",
      title: loadedNames
        ? `Pages chargees: ${loadedNames}`
        : "Pages chargees apres OAuth",
      detail: "La connexion est faite, mais vous devez encore activer une page pour ouvrir le bot.",
    };
  }

  if (hasVisibleChange) {
    const connectedNames = newlyActivatedPages
      .map((page) => page.page_name)
      .filter(Boolean)
      .slice(0, 2)
      .join(", ");
    return {
      state: "connected",
      title: connectedNames
        ? `Connexion confirmee: ${connectedNames}`
        : "Connexion Facebook confirmee",
      detail:
        "Une page est maintenant disponible et active dans FLARE. Le chatbot peut commencer a repondre.",
    };
  }

  if (needsActivation) {
    return {
      state: "activation_required",
      title: "Aucune page active pour l'instant",
      detail: "Les pages sont chargees, mais une activation manuelle est encore necessaire.",
    };
  }

  return {
    state: "unchanged",
    title: "Aucun changement detecte",
    detail:
      "Aucune nouvelle page n'a ete ajoutee apres la fermeture de la popup Facebook.",
  };
}

function summarizeFacebookActivationOutcome(
  previousPages: FacebookMessengerStatus["pages"],
  nextStatus: FacebookMessengerStatus | null,
  activatedPageId: string
): FacebookOauthOutcome {
  const nextPages = nextStatus?.pages ?? [];
  const activatedPage = nextPages.find((page) => page.page_id === activatedPageId) || null;
  const wasActive = previousPages.some((page) => page.page_id === activatedPageId && page.is_active);

  if (activatedPage?.is_active && !wasActive) {
    return {
      state: "activated",
      title: activatedPage.page_name
        ? `Page activee: ${activatedPage.page_name}`
        : "Page Facebook activee",
      detail:
        "Cette page est maintenant branchee sur FLARE. Le chatbot peut repondre sur Messenger.",
    };
  }

  if (activatedPage?.is_active) {
    return {
      state: "connected",
      title: activatedPage.page_name
        ? `Page deja active: ${activatedPage.page_name}`
        : "Page Facebook deja active",
      detail: "Cette page etait deja activee dans FLARE.",
    };
  }

  return {
    state: "unchanged",
    title: "Activation a verifier",
    detail:
      "Le statut Facebook a ete recharge, mais la page active n'a pas encore pu etre confirmee visuellement.",
  };
}

function statusBg(s: string): string {
  const n = s.toLowerCase();
  if (n.includes("hot")) return "bg-orange-500/10";
  if (n.includes("support") || n.includes("human")) return "bg-red-500/10";
  if (n.includes("qualified")) return "bg-blue-500/10";
  if (n.includes("new")) return "bg-emerald-500/10";
  return "bg-white/[0.04]";
}

function statusLabel(s: string): string {
  const n = s.toLowerCase();
  if (n.includes("hot")) return "Chaud";
  if (n.includes("support") || n.includes("human")) return "A rappeler";
  if (n.includes("qualified")) return "Interesse";
  if (n.includes("new")) return "Nouveau";
  return s || "—";
}

function modeLabel(m: string): string {
  const n = m.toLowerCase();
  if (n === "human" || n.includes("humain")) return "Humain";
  return "Agent";
}

function formatLatency(v: number): string {
  if (!Number.isFinite(v) || v <= 0) return "n/a";
  if (v < 1000) return `${Math.round(v)} ms`;
  return `${(v / 1000).toFixed(1)} s`;
}

function percentOf(part: number, total: number): number {
  if (!total) return 0;
  return Math.round((part / total) * 100);
}

function clipText(value: string, max = 140): string {
  const normalized = (value || "").replace(/\s+/g, " ").trim();
  if (!normalized) return "";
  return normalized.length <= max ? normalized : `${normalized.slice(0, max - 1).trimEnd()}…`;
}

function scoreImportantSnippet(value: string): number {
  const text = (value || "").toLowerCase();
  if (!text.trim()) return -1;

  let score = Math.min(text.length, 160) / 40;
  if (text.includes("?")) score += 2;
  if (/(prix|tarif|devis|budget|commande|acheter|paiement|reservation|rendez-vous|disponible|urgent|livraison|telephone|email|whatsapp)/.test(text)) {
    score += 4;
  }
  if (/(aujourd'hui|demain|semaine|mois|date|heure)/.test(text)) {
    score += 1.5;
  }

  return score;
}

type ConversationFocus = "all" | "urgent" | "hot" | "human" | "stale";
type ConversationQueueBucket = Exclude<ConversationFocus, "all"> | "normal";

type ConversationQueueItem = {
  conv: MessengerConversationCard;
  highlight: MessengerCustomerHighlight | null;
  score: number;
  bucket: ConversationQueueBucket;
  reason: string;
  lastActivityAt: string;
  ageMinutes: number;
};

const CONVERSATION_STALE_MINUTES = 90;

function toTimestamp(value?: string): number {
  if (!value) return 0;
  const ts = new Date(value).getTime();
  return Number.isFinite(ts) ? ts : 0;
}

function getConversationLastActivity(
  conv: MessengerConversationCard,
  highlight?: MessengerCustomerHighlight | null
): string {
  return (
    highlight?.lastMessageAt ||
    conv.exchanges[conv.exchanges.length - 1]?.time ||
    ""
  );
}

function getElapsedMinutes(value?: string): number {
  const ts = toTimestamp(value);
  if (!ts) return Number.POSITIVE_INFINITY;
  return Math.max(0, Math.round((Date.now() - ts) / 60000));
}

function formatElapsedLabel(minutes: number): string {
  if (!Number.isFinite(minutes)) return "age inconnu";
  if (minutes < 1) return "actif maintenant";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest > 0 ? `${hours} h ${rest} min` : `${hours} h`;
}

function buildConversationQueueItem(
  conv: MessengerConversationCard,
  highlight?: MessengerCustomerHighlight | null
): ConversationQueueItem {
  const needsHuman = conv.humanTakeover || Boolean(highlight?.needsHuman);
  const readyToBuy = !needsHuman && Boolean(highlight?.readyToBuy);
  const humanMode = conv.mode.toLowerCase() === "human";
  const lastActivityAt = getConversationLastActivity(conv, highlight);
  const ageMinutes = getElapsedMinutes(lastActivityAt);
  const messageCount = highlight?.messageCount || conv.exchanges.length || 0;
  const staleFollowup = !needsHuman && ageMinutes >= CONVERSATION_STALE_MINUTES;

  let bucket: ConversationQueueBucket = "normal";
  let reason = "Flux standard";
  if (needsHuman) {
    bucket = "urgent";
    reason = "Reponse humaine requise";
  } else if (readyToBuy) {
    bucket = "hot";
    reason = "Prospect pret a conclure";
  } else if (humanMode) {
    bucket = "human";
    reason = "Conversation deja en mode humain";
  } else if (staleFollowup) {
    bucket = "stale";
    reason = "Silence a relancer";
  }

  let score = 0;
  if (needsHuman) score += 900;
  if (readyToBuy) score += 650;
  if (humanMode) score += 360;
  if (staleFollowup) score += Math.min(ageMinutes, 720);
  score += Math.min(messageCount, 40);
  score += Math.min(ageMinutes / 6, 120);

  return {
    conv,
    highlight: highlight || null,
    score,
    bucket,
    reason,
    lastActivityAt,
    ageMinutes,
  };
}

function buildImportantMoments(conv: MessengerConversationCard) {
  const moments = conv.exchanges.flatMap((ex) => {
    const items: Array<{ kind: "client" | "agent"; text: string; time: string; score: number }> = [];
    const customerText = clipText(ex.customerMessage, 160);
    const agentText = clipText(ex.agentReply, 160);

    if (customerText) {
      items.push({
        kind: "client",
        text: customerText,
        time: ex.time,
        score: scoreImportantSnippet(customerText) + 0.6,
      });
    }

    if (agentText) {
      items.push({
        kind: "agent",
        text: agentText,
        time: ex.time,
        score: scoreImportantSnippet(agentText),
      });
    }

    return items;
  });

  const seen = new Set<string>();

  return moments
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return new Date(b.time).getTime() - new Date(a.time).getTime();
    })
    .filter((item) => {
      const key = item.text.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 4);
}

function buildConversationSummary(
  conv: MessengerConversationCard,
  highlight?: MessengerCustomerHighlight | null
): string {
  const lastCustomerMessage = [...conv.exchanges]
    .reverse()
    .map((ex) => clipText(ex.customerMessage, 120))
    .find(Boolean);
  const lastAgentReply = [...conv.exchanges]
    .reverse()
    .map((ex) => clipText(ex.agentReply, 120))
    .find(Boolean);

  if (conv.humanTakeover || highlight?.needsHuman) {
    return lastCustomerMessage
      ? `Relance humaine recommandee. Le client attend surtout une reponse sur: ${lastCustomerMessage}`
      : "Relance humaine recommandee. Le client est en attente d'une prise en charge claire.";
  }

  if (highlight?.readyToBuy) {
    return lastCustomerMessage
      ? `Conversation chaude. La demande la plus recente concerne: ${lastCustomerMessage}`
      : "Conversation chaude. Le client semble proche d'une decision d'achat.";
  }

  if (lastCustomerMessage && lastAgentReply) {
    return `Le client a surtout parle de: ${lastCustomerMessage} Reponse envoyee: ${lastAgentReply}`;
  }

  if (lastCustomerMessage) {
    return `Derniere intention visible: ${lastCustomerMessage}`;
  }

  if (lastAgentReply) {
    return `Derniere reponse envoyee: ${lastAgentReply}`;
  }

  return "Peu d'elements exploitables dans cette discussion pour l'instant.";
}

function getPriorityReason(
  conv: MessengerConversationCard,
  highlight?: MessengerCustomerHighlight | null
): string {
  if (conv.humanTakeover || highlight?.needsHuman) {
    return "Humain requis";
  }

  if (highlight?.readyToBuy) {
    return "Pret a convertir";
  }

  if (conv.mode === "human") {
    return "Mode humain actif";
  }

  return "Surveillance normale";
}

/* ─── KPI Card ─── */

type OperatorActionPlan = {
  toneClassName: string;
  badge: string;
  title: string;
  detail: string;
  suggestedMode?: string | null;
  ctaLabel?: string | null;
};

function buildOperatorActionPlan(
  conv: MessengerConversationCard,
  highlight?: MessengerCustomerHighlight | null
): OperatorActionPlan {
  const lastCustomerMessage = [...conv.exchanges]
    .reverse()
    .map((ex) => clipText(ex.customerMessage, 120))
    .find(Boolean);
  const canSwitchToHuman = conv.availableModes.some((mode) => mode.toLowerCase() === "human");
  const canSwitchToAgent = conv.availableModes.some((mode) => mode.toLowerCase() === "agent");
  const currentMode = conv.mode.toLowerCase();

  if (conv.humanTakeover || highlight?.needsHuman) {
    return {
      toneClassName: "border-red-400/20 bg-red-500/8 text-red-100",
      badge: "Action immediate",
      title: "Reprendre la conversation en humain",
      detail: lastCustomerMessage
        ? `Le dernier besoin visible porte sur: ${lastCustomerMessage}`
        : "Le client attend une prise en charge humaine claire avant de continuer.",
      suggestedMode: canSwitchToHuman ? "human" : null,
      ctaLabel: canSwitchToHuman ? "Passer en humain" : null,
    };
  }

  if (highlight?.readyToBuy) {
    return {
      toneClassName: "border-orange-400/20 bg-orange-500/8 text-orange-100",
      badge: "Conversion",
      title: "Faire avancer la vente maintenant",
      detail: lastCustomerMessage
        ? `Le prospect est chaud. Dernier signal a traiter: ${lastCustomerMessage}`
        : "Le prospect est classe comme chaud et merite une relance de conversion rapide.",
      suggestedMode: currentMode === "human" ? null : canSwitchToHuman ? "human" : null,
      ctaLabel: currentMode === "human" ? null : canSwitchToHuman ? "Prendre la main" : null,
    };
  }

  if (currentMode === "human") {
    return {
      toneClassName: "border-blue-400/20 bg-blue-500/8 text-blue-100",
      badge: "Suivi",
      title: "Verifier si le bot peut reprendre",
      detail: lastCustomerMessage
        ? `Si le sujet est traite, vous pouvez rendre la main au bot apres ce point: ${lastCustomerMessage}`
        : "La conversation est deja en humain. Rebasculer vers le bot seulement si le contexte est clarifie.",
      suggestedMode: canSwitchToAgent ? "agent" : null,
      ctaLabel: canSwitchToAgent ? "Rendre au bot" : null,
    };
  }

  return {
    toneClassName: "border-white/[0.08] bg-white/[0.03] text-white/72",
    badge: "Surveillance",
    title: "Laisser le bot continuer",
    detail: lastCustomerMessage
      ? `Aucun signal critique detecte. Le dernier message client reste: ${lastCustomerMessage}`
      : "La conversation ne montre pas de signal urgent. Le bot peut continuer a gerer ce fil.",
    suggestedMode: null,
    ctaLabel: null,
  };
}

function KpiCard({ label, value, sub, icon }: { label: string; value: string; sub?: string; icon: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-xl bg-white/[0.02] px-4 py-4 hover:bg-white/[0.04] transition-all">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/[0.04]">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-[0.12em] text-white/25">{label}</p>
        <p className="mt-1 text-[18px] font-semibold text-white">{value}</p>
        {sub && <p className="mt-0.5 text-[11px] text-white/25">{sub}</p>}
      </div>
    </div>
  );
}

/* ─── Client Row ─── */

function ClientRow({
  conv,
  highlight,
  active,
  onClick,
  queueHint,
  priorityIndex,
}: {
  conv: MessengerConversationCard;
  highlight?: MessengerCustomerHighlight;
  active: boolean;
  onClick: () => void;
  queueHint?: string;
  priorityIndex?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 rounded-xl px-3 py-3 text-left transition-all ${
        active ? "bg-white/[0.06]" : "hover:bg-white/[0.03]"
      }`}
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.04]">
        <User size={14} className="text-white/30" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          {priorityIndex ? (
            <span className="shrink-0 rounded-md bg-white/[0.04] px-1.5 py-0.5 text-[9px] font-medium text-white/35">
              #{priorityIndex}
            </span>
          ) : null}
          <p className="text-[13px] font-medium text-white truncate">{conv.customer || "Anonyme"}</p>
          <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-[9px] font-medium ${statusBg(conv.status)} ${statusColor(conv.status)}`}>
            {statusLabel(conv.status)}
          </span>
        </div>
        <p className="mt-0.5 text-[11px] text-white/25 truncate">{conv.lastMessage || "Aucun message"}</p>
        {queueHint ? (
          <p className="mt-1 text-[10px] text-white/24 truncate">{queueHint}</p>
        ) : null}
      </div>
      {conv.humanTakeover && (
        <span className="shrink-0 h-2 w-2 rounded-full bg-red-400 animate-pulse" title="En attente humain" />
      )}
    </button>
  );
}

/* ─── Conversation Detail (per client) ─── */

function ConversationDetail({
  conv,
  highlight,
  canOperate,
  modeLoading,
  onSwitchMode,
  priorityPosition,
  priorityCount,
  nextPriority,
  nextPriorityHighlight,
  onOpenPriorityConversation,
}: {
  conv: MessengerConversationCard;
  highlight?: MessengerCustomerHighlight | null;
  canOperate: boolean;
  modeLoading: boolean;
  onSwitchMode: (psid: string, mode: string) => void;
  priorityPosition?: number | null;
  priorityCount: number;
  nextPriority?: MessengerConversationCard | null;
  nextPriorityHighlight?: MessengerCustomerHighlight | null;
  onOpenPriorityConversation?: (psid: string) => void;
}) {
  const importantMoments = buildImportantMoments(conv);
  const summary = buildConversationSummary(conv, highlight);
  const priorityReason = getPriorityReason(conv, highlight);

  return (
    <div className="flex flex-col h-full">
      {/* Client header */}
      <div className="shrink-0 px-5 py-4 border-b border-white/[0.04]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.04]">
              <User size={16} className="text-white/40" />
            </div>
            <div className="min-w-0">
              <p className="text-[15px] font-semibold text-white truncate">{conv.customer || "Anonyme"}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-medium ${statusBg(conv.status)} ${statusColor(conv.status)}`}>
                  {statusLabel(conv.status)}
                </span>
                <span className="text-[10px] text-white/20">
                  Mode: {modeLabel(conv.mode)}
                </span>
                {priorityPosition ? (
                  <span className="rounded-md border border-orange-400/15 bg-orange-400/10 px-1.5 py-0.5 text-[10px] font-medium text-orange-100">
                    Pile #{priorityPosition}/{priorityCount}
                  </span>
                ) : null}
              </div>
            </div>
          </div>
          {canOperate && conv.availableModes.length > 1 && (
            <div className="flex gap-1">
              {conv.availableModes.map((m) => (
                <button
                  key={m}
                  onClick={() => onSwitchMode(conv.psid, m)}
                  disabled={modeLoading || conv.mode === m}
                  className={`rounded-lg px-3 py-1.5 text-[10px] font-medium transition-all ${
                    conv.mode === m
                      ? "bg-white/[0.08] text-white"
                      : "text-white/30 hover:bg-white/[0.04] hover:text-white/50"
                  } disabled:opacity-30`}
                >
                  {modeLabel(m)}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Client stats */}
        {highlight && (
          <div className="flex gap-4 mt-3 text-[11px] text-white/25">
            <span>{highlight.messageCount} messages</span>
            <span>{formatCurrency(highlight.totalCostUsd)}</span>
            <span>Dernier: {formatDate(highlight.lastMessageAt)}</span>
          </div>
        )}
      </div>

      {/* Conversation digest */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
        <div className="rounded-2xl bg-white/[0.03] px-4 py-4">
          <p className="text-[10px] uppercase tracking-[0.14em] text-white/25">Resume direct</p>
          <p className="mt-2 text-[13px] leading-relaxed text-white/72">{summary}</p>
        </div>

        {(priorityPosition || nextPriority) && (
          <div className="rounded-2xl border border-white/[0.05] bg-white/[0.02] px-4 py-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-[0.14em] text-white/25">File de reprise</p>
                <p className="mt-2 text-[13px] font-medium text-white">
                  {priorityPosition
                    ? `${conv.customer || "Ce client"} est actuellement en position ${priorityPosition} sur ${priorityCount}.`
                    : "Cette conversation n'est pas dans la file urgente actuelle."}
                </p>
                <p className="mt-1 text-[11px] leading-6 text-white/30">
                  {priorityPosition
                    ? `Priorite actuelle: ${priorityReason}.`
                    : "Les conversations urgentes ou proches de la conversion remonteront ici automatiquement."}
                </p>
              </div>

              {nextPriority && onOpenPriorityConversation ? (
                <button
                  onClick={() => onOpenPriorityConversation(nextPriority.psid)}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/[0.05] px-4 py-2 text-[11px] font-medium text-white/78 transition-all hover:bg-white/[0.08]"
                >
                  <ChevronsRight size={14} />
                  Ouvrir la suivante
                </button>
              ) : null}
            </div>

            {nextPriority ? (
              <div className="mt-3 rounded-xl bg-white/[0.03] px-3 py-3">
                <p className="text-[10px] uppercase tracking-[0.12em] text-white/20">Ensuite</p>
                <div className="mt-2 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[12px] font-medium text-white truncate">
                      {nextPriority.customer || "Anonyme"}
                    </p>
                    <p className="mt-1 text-[11px] leading-5 text-white/28">
                      {getPriorityReason(nextPriority, nextPriorityHighlight)}
                    </p>
                  </div>
                  <span className="shrink-0 text-[10px] text-white/18">
                    {formatDate(
                      nextPriorityHighlight?.lastMessageAt || nextPriority.exchanges.at(-1)?.time
                    )}
                  </span>
                </div>
              </div>
            ) : null}
          </div>
        )}

        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl bg-white/[0.02] px-4 py-3">
            <p className="text-[10px] uppercase tracking-[0.12em] text-white/20">Volume</p>
            <p className="mt-2 text-[18px] font-semibold text-white">
              {highlight?.messageCount || conv.exchanges.length || 0}
            </p>
            <p className="text-[11px] text-white/25">messages visibles dans ce dossier</p>
          </div>
          <div className="rounded-2xl bg-white/[0.02] px-4 py-3">
            <p className="text-[10px] uppercase tracking-[0.12em] text-white/20">Derniere action</p>
            <p className="mt-2 text-[13px] font-medium text-white">{formatDate(highlight?.lastMessageAt || conv.exchanges.at(-1)?.time)}</p>
            <p className="text-[11px] text-white/25">dernier signal detecte</p>
          </div>
          <div className="rounded-2xl bg-white/[0.02] px-4 py-3">
            <p className="text-[10px] uppercase tracking-[0.12em] text-white/20">Prochaine suite</p>
            <p className="mt-2 text-[13px] font-medium text-white">
              {conv.humanTakeover || highlight?.needsHuman
                ? "Reponse humaine a faire"
                : highlight?.readyToBuy
                  ? "Faire avancer la conversion"
                  : conv.mode === "human"
                    ? "Verifier la reprise humaine"
                    : "Laisser le bot continuer"}
            </p>
            <p className="text-[11px] text-white/25">action prioritaire suggeree</p>
          </div>
        </div>

        {importantMoments.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <MessageCircleMore size={24} className="text-white/10 mb-2" />
            <p className="text-[13px] text-white/20">Aucun fait important detecte</p>
          </div>
        ) : (
          importantMoments.map((moment, i) => (
            <div key={`${moment.time}-${i}`} className="rounded-2xl bg-white/[0.02] px-4 py-3">
              <div className="flex items-center gap-2">
                {moment.kind === "client" ? (
                  <User size={12} className="text-white/25" />
                ) : (
                  <Bot size={12} className="text-white/25" />
                )}
                <p className="text-[10px] uppercase tracking-[0.12em] text-white/25">
                  {moment.kind === "client" ? "Fait cote client" : "Reponse cote agent"}
                </p>
                <span className="ml-auto text-[10px] text-white/15">{formatDate(moment.time)}</span>
              </div>
              <p className="mt-2 text-[12px] leading-relaxed text-white/68">{moment.text}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/* ─── Lead Card ─── */

function LeadCard({
  item,
  onClick,
}: {
  item: MessengerCustomerHighlight;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full rounded-xl bg-white/[0.02] hover:bg-white/[0.04] px-4 py-3.5 text-left transition-all"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-[13px] font-medium text-white truncate">{item.customer || "Anonyme"}</p>
            <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-[9px] font-medium ${statusBg(item.status)} ${statusColor(item.status)}`}>
              {statusLabel(item.status)}
            </span>
            {item.needsHuman && (
              <span className="shrink-0 rounded-md bg-red-500/10 px-1.5 py-0.5 text-[9px] font-medium text-red-400">
                Humain requis
              </span>
            )}
            {item.readyToBuy && !item.needsHuman && (
              <span className="shrink-0 rounded-md bg-orange-500/10 px-1.5 py-0.5 text-[9px] font-medium text-orange-400">
                Pret a acheter
              </span>
            )}
          </div>
          <p className="mt-1 text-[11px] text-white/30 line-clamp-2">{item.lastMessage || "—"}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[12px] font-medium text-white/50">{item.messageCount} msg</p>
          <p className="text-[10px] text-white/20">{formatCurrency(item.totalCostUsd)}</p>
        </div>
      </div>
      <div className="flex items-center gap-3 mt-2 text-[10px] text-white/20">
        <span>Mode: {modeLabel(item.mode)}</span>
        <span>Dernier: {formatDate(item.lastMessageAt)}</span>
      </div>
    </button>
  );
}

/* ─── Cost Row ─── */

function CostRow({ item }: { item: MessengerCustomerHighlight }) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-white/[0.02] px-4 py-3 hover:bg-white/[0.04] transition-all">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.04]">
        <User size={13} className="text-white/30" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-medium text-white truncate">{item.customer || "Anonyme"}</p>
        <p className="text-[10px] text-white/20">{item.messageCount} messages · {formatNumber(item.totalTokens)} tokens</p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-[14px] font-semibold text-white">{formatCurrency(item.totalCostUsd)}</p>
      </div>
    </div>
  );
}

function FacebookConnectionPanel({
  authReady,
  loading,
  status,
  error,
  oauthOutcome,
  lastCheckedAt,
  authLoading,
  busyPageId,
  onConnect,
  onRefreshStatus,
  onActivate,
  onDisconnect,
  onRequestAccess,
}: {
  authReady: boolean;
  loading: boolean;
  status: FacebookMessengerStatus | null;
  error: string | null;
  oauthOutcome: FacebookOauthOutcome | null;
  lastCheckedAt: string | null;
  authLoading: boolean;
  busyPageId: string | null;
  onConnect: () => void;
  onRefreshStatus: () => void;
  onActivate: (pageId: string) => void;
  onDisconnect: (pageId: string) => void;
  onRequestAccess?: () => void;
}) {
  if (!authReady) {
    return (
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-[28px] border border-white/[0.05] bg-white/[0.02] p-5 md:p-6"
      >
        <p className="text-[10px] uppercase tracking-[0.14em] text-white/25">Connexion Facebook</p>
        <h2 className="mt-2 text-[20px] font-semibold text-white">Connectez votre page dans FLARE AI</h2>
        <p className="mt-2 max-w-[42rem] text-[13px] leading-6 text-white/38">
          Connectez-vous d&apos;abord a FLARE AI puis activez votre organisation. La connexion
          Facebook se fera ensuite depuis ce cockpit, sans manipuler les secrets ni le webhook.
        </p>
        <button
          onClick={onRequestAccess}
          className="mt-4 rounded-xl bg-white/[0.05] px-4 py-2 text-[12px] font-medium text-white/70 transition-all hover:bg-white/[0.08]"
        >
          Ouvrir la connexion
        </button>
      </motion.section>
    );
  }

  const pages = status?.pages || [];
  const activePages = pages.filter((page) => page.is_active);
  const firstInactivePage = pages.find((page) => !page.is_active) || null;
  const canManagePages = Boolean(status?.can_manage_pages ?? status?.can_edit);

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-[28px] border border-white/[0.05] bg-white/[0.02] p-5 md:p-6"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-[44rem]">
          <p className="text-[10px] uppercase tracking-[0.14em] text-white/25">Connexion Facebook</p>
          <h2 className="mt-2 text-[20px] font-semibold text-white">Pages Messenger de l&apos;organisation</h2>
          <p className="mt-2 text-[13px] leading-6 text-white/38">
            FLARE gere l&apos;OAuth Meta, l&apos;abonnement webhook et la synchro vers le service
            direct. Il ne reste qu&apos;a charger puis activer les pages.
          </p>
          {status ? (
            <div className="mt-4 flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.12em] text-white/26">
              <span className="rounded-full border border-white/[0.08] px-2.5 py-1">
                {status.organization_name}
              </span>
              <span className={`rounded-full border px-2.5 py-1 ${status.has_active_page ? "border-emerald-400/20 text-emerald-100" : "border-orange-400/20 text-orange-100"}`}>
                {status.has_active_page ? `${activePages.length} page(s) active(s)` : "Aucune page active"}
              </span>
              {!canManagePages ? (
                <span className="rounded-full border border-white/[0.08] px-2.5 py-1">
                  Lecture seule
                </span>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={onConnect}
            disabled={loading || authLoading || !canManagePages}
            className="rounded-xl bg-white/[0.06] px-4 py-2 text-[12px] font-medium text-white transition-all hover:bg-white/[0.1] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {authLoading ? "Autorisation en cours..." : "Connecter Facebook"}
          </button>
        </div>
      </div>

      {error ? (
        <div className="mt-4 rounded-2xl border border-red-500/15 bg-red-500/10 px-4 py-3">
          <p className="text-[12px] leading-6 text-red-100">{error}</p>
        </div>
      ) : null}

      {!error && oauthOutcome ? (
        <div
          className={`mt-4 rounded-2xl border px-4 py-3 ${
            oauthOutcome.state === "connected" || oauthOutcome.state === "activated"
              ? "border-emerald-400/15 bg-emerald-500/10"
              : oauthOutcome.state === "activation_required"
                ? "border-orange-400/15 bg-orange-500/10"
                : "border-white/[0.08] bg-white/[0.03]"
          }`}
        >
          <p
            className={`text-[12px] font-medium ${
              oauthOutcome.state === "connected" || oauthOutcome.state === "activated"
                ? "text-emerald-100"
                : oauthOutcome.state === "activation_required"
                  ? "text-orange-100"
                  : "text-white/78"
            }`}
          >
            {oauthOutcome.title}
          </p>
          <p
            className={`mt-1 text-[12px] leading-6 ${
              oauthOutcome.state === "connected" || oauthOutcome.state === "activated"
                ? "text-emerald-100/88"
                : oauthOutcome.state === "activation_required"
                  ? "text-orange-100/90"
                  : "text-white/44"
            }`}
          >
            {oauthOutcome.detail}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              onClick={onRefreshStatus}
              disabled={loading || authLoading}
              className="rounded-xl border border-white/[0.12] bg-white/[0.04] px-3 py-2 text-[12px] font-medium text-white transition-all hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {loading ? "Verification..." : "Rafraichir l'etat Facebook"}
            </button>
            <p
              className={`text-[11px] leading-5 ${
                oauthOutcome.state === "connected" || oauthOutcome.state === "activated"
                  ? "text-emerald-100/70"
                  : oauthOutcome.state === "activation_required"
                    ? "text-orange-100/70"
                    : "text-white/44"
              }`}
            >
              {lastCheckedAt
                ? `Derniere verification: ${formatDate(lastCheckedAt)}`
                : "Aucune verification recente encore enregistree."}
            </p>
          </div>
          {oauthOutcome.state === "activation_required" && canManagePages && firstInactivePage ? (
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button
                onClick={() => onActivate(firstInactivePage.page_id)}
                disabled={busyPageId === firstInactivePage.page_id || authLoading}
                className="rounded-xl bg-orange-100 px-3 py-2 text-[12px] font-medium text-orange-950 transition-all hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busyPageId === firstInactivePage.page_id
                  ? "Activation..."
                  : `Activer ${firstInactivePage.page_name || "la premiere page"}`}
              </button>
              <p className="text-[11px] leading-5 text-orange-100/70">
                FLARE branchera ensuite le bot sur cette page sans autre etape manuelle.
              </p>
            </div>
          ) : null}
        </div>
      ) : null}

      {loading ? (
        <div className="mt-6 flex items-center gap-3 rounded-2xl bg-white/[0.03] px-4 py-4">
          <Loader2 size={16} className="animate-spin text-white/35" />
          <p className="text-[12px] text-white/40">Chargement de l&apos;etat Facebook...</p>
        </div>
      ) : null}

      {status && !status.oauth_configured ? (
        <div className="mt-4 rounded-2xl border border-orange-400/15 bg-orange-400/10 px-4 py-3">
          <p className="text-[12px] leading-6 text-orange-100">
            `META_APP_ID` et `META_APP_SECRET` doivent etre configures sur le backend FLARE avant
            de lancer la connexion Meta.
          </p>
        </div>
      ) : null}

      {status && !status.direct_service_configured ? (
        <div className="mt-4 rounded-2xl border border-orange-400/15 bg-orange-400/10 px-4 py-3">
          <p className="text-[12px] leading-6 text-orange-100">
            La cle interne du service Messenger direct manque encore. Les pages peuvent etre
            chargees, mais l&apos;activation restera incomplete tant que cette cle n&apos;est pas en place.
          </p>
        </div>
      ) : null}

      {status ? (
        <div className="mt-5 grid gap-3 xl:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
          <div className="space-y-3">
            {pages.length === 0 ? (
              <div className="rounded-2xl border border-white/[0.05] bg-white/[0.02] px-4 py-5">
                <p className="text-[12px] text-white/34">
                  Aucune page chargee pour le moment. Lancez la connexion Facebook, choisissez vos
                  pages dans la popup Meta, puis revenez ici pour les activer.
                </p>
              </div>
            ) : (
              pages.map((page) => {
                const isBusy = busyPageId === page.page_id;
                const badgeTone = page.is_active
                  ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-100"
                  : page.status.includes("error")
                    ? "border-red-400/20 bg-red-400/10 text-red-100"
                    : "border-orange-400/20 bg-orange-400/10 text-orange-100";

                return (
                  <div key={page.page_id} className="rounded-2xl border border-white/[0.05] bg-white/[0.02] px-4 py-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-[14px] font-medium text-white">{page.page_name}</p>
                          <span className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] ${badgeTone}`}>
                            {page.is_active ? "Active" : page.status || "Pending"}
                          </span>
                        </div>
                        <p className="mt-1 text-[12px] text-white/28">
                          {page.page_category || "Page Facebook"} · ID {page.page_id}
                        </p>
                        {page.last_error ? (
                          <p className="mt-2 text-[12px] leading-6 text-red-200/90">{page.last_error}</p>
                        ) : null}
                        <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-white/24">
                          <span>Webhook: {page.webhook_subscribed ? "ok" : "a brancher"}</span>
                          <span>Service direct: {page.direct_service_synced ? "ok" : "a synchroniser"}</span>
                          <span>Chargee le {formatDate(page.connected_at || undefined)}</span>
                        </div>
                      </div>

                      {canManagePages ? (
                        <div className="flex shrink-0 gap-2">
                          <button
                            onClick={() => onActivate(page.page_id)}
                            disabled={isBusy || authLoading || page.is_active}
                            className="rounded-xl bg-white/[0.06] px-3 py-2 text-[12px] font-medium text-white transition-all hover:bg-white/[0.1] disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            {isBusy && !page.is_active ? "Activation..." : page.is_active ? "Active" : "Activer"}
                          </button>
                          <button
                            onClick={() => onDisconnect(page.page_id)}
                            disabled={isBusy || authLoading}
                            className="rounded-xl border border-white/[0.08] px-3 py-2 text-[12px] font-medium text-white/70 transition-all hover:bg-white/[0.04] hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            {isBusy && page.is_active ? "Deconnexion..." : "Deconnecter"}
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="rounded-2xl border border-white/[0.05] bg-white/[0.02] px-4 py-4">
            <p className="text-[10px] uppercase tracking-[0.12em] text-white/22">Mode d&apos;emploi</p>
            <div className="mt-3 space-y-3 text-[12px] leading-6 text-white/34">
              <p>1. Cliquez sur `Connecter Facebook`.</p>
              <p>2. Autorisez FLARE a lire et brancher vos pages Messenger.</p>
              <p>3. Revenez ici et activez la ou les pages a ouvrir au bot.</p>
              <p>4. FLARE s&apos;occupe du webhook et de la synchro vers le service Messenger direct.</p>
            </div>
            <div className="mt-4 rounded-xl bg-black/20 px-3 py-3 text-[11px] leading-5 text-white/28">
              Callback webhook actuel :<br />
              {status.callback_url || "Indisponible"}
            </div>
          </div>
        </div>
      ) : null}
    </motion.section>
  );
}

/* ─── Main Component ─── */

export default function MessengerWorkspace({
  initialTab = "overview",
  initialConversationId = null,
  onOpenAssistant,
  onNavigate,
  onOpenConversation,
  onRequestAccess,
  authToken,
  selectedPageId,
}: MessengerWorkspaceProps) {
  const [data, setData] = useState<MessengerDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPsid, setSelectedPsid] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [conversationFocus, setConversationFocus] = useState<ConversationFocus>("all");
  const [modeLoading, setModeLoading] = useState<string | null>(null);
  const [exportLoading, setExportLoading] = useState<string | null>(null);
  const [facebookStatus, setFacebookStatus] = useState<FacebookMessengerStatus | null>(null);
  const [facebookLoading, setFacebookLoading] = useState(Boolean(authToken));
  const [facebookError, setFacebookError] = useState<string | null>(null);
  const [facebookOauthOutcome, setFacebookOauthOutcome] = useState<FacebookOauthOutcome | null>(null);
  const [facebookAuthLoading, setFacebookAuthLoading] = useState(false);
  const [facebookBusyPageId, setFacebookBusyPageId] = useState<string | null>(null);
  const [facebookLastCheckedAt, setFacebookLastCheckedAt] = useState<string | null>(null);

  const canOperate = Boolean(data?.access?.canSwitchMode);
  const canExport = Boolean(data?.access?.canExport);
  const syncHealth = data ? getMessengerSyncHealth(data.lastUpdated, data.archiveStatus) : null;
  const totals = data?.totals;

  /* ─── Data fetch ─── */
  useEffect(() => {
    let cancelled = false;
    let intervalId: number | null = null;

    const hydrate = async (bg = false) => {
      try {
        bg ? setRefreshing(true) : setLoading(true);
        if (authToken) {
          setFacebookLoading(true);
        } else {
          setFacebookLoading(false);
          setFacebookStatus(null);
          setFacebookError(null);
          setFacebookOauthOutcome(null);
          setFacebookLastCheckedAt(null);
        }

        const [next, facebookResult] = await Promise.all([
          loadMessengerDashboardData(authToken, selectedPageId),
          authToken
            ? loadFacebookMessengerStatus(authToken)
                .then((status) => ({ status, error: null as string | null }))
                .catch((fbError) => ({
                  status: null,
                  error: fbError instanceof Error ? fbError.message : "Etat Facebook indisponible",
                }))
            : Promise.resolve({ status: null, error: null as string | null }),
        ]);
        if (cancelled) return;
        setData(next);
        setError(null);
        setFacebookStatus(facebookResult.status);
        setFacebookError(facebookResult.error);
        if (authToken) {
          setFacebookLastCheckedAt(new Date().toISOString());
        }
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Erreur de chargement");
      } finally {
        if (cancelled) return;
        setLoading(false);
        setRefreshing(false);
        setFacebookLoading(false);
      }
    };

    const refreshIfVisible = () => {
      if (document.visibilityState === "visible") void hydrate(true);
    };

    void hydrate();
    intervalId = window.setInterval(refreshIfVisible, 30000);
    window.addEventListener("focus", refreshIfVisible);
    document.addEventListener("visibilitychange", refreshIfVisible);

    return () => {
      cancelled = true;
      if (intervalId) window.clearInterval(intervalId);
      window.removeEventListener("focus", refreshIfVisible);
      document.removeEventListener("visibilitychange", refreshIfVisible);
    };
  }, [authToken, selectedPageId]);

  /* Auto-select first conversation */
  useEffect(() => {
    if (!data?.conversations.length) return;
    if (initialConversationId) {
      const exists = data.conversations.some((c) => c.psid === initialConversationId);
      if (exists) { setSelectedPsid(initialConversationId); return; }
    }
    if (!selectedPsid || !data.conversations.some((c) => c.psid === selectedPsid)) {
      setSelectedPsid(data.conversations[0].psid);
    }
  }, [data, initialConversationId, selectedPsid]);

  /* Reset search/filters on tab change */
  useEffect(() => {
    setSearch("");
    setConversationFocus("all");
  }, [initialTab]);

  /* ─── Derived data ─── */
  const highlightMap = useMemo(() => {
    return new Map((data?.customerHighlights || []).map((h) => [h.psid, h]));
  }, [data]);

  const selectedConv = useMemo(() => {
    return data?.conversations.find((c) => c.psid === selectedPsid) || null;
  }, [data, selectedPsid]);

  const conversationQueue = useMemo(() => {
    if (!data) return [];
    return data.conversations
      .map((conv) => buildConversationQueueItem(conv, highlightMap.get(conv.psid) || null))
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return toTimestamp(b.lastActivityAt) - toTimestamp(a.lastActivityAt);
      });
  }, [data, highlightMap]);

  const filteredConversationQueue = useMemo(() => {
    const q = normSearch(search);
    return conversationQueue.filter((item) => {
      if (conversationFocus === "urgent" && item.bucket !== "urgent") return false;
      if (conversationFocus === "hot" && item.bucket !== "hot") return false;
      if (conversationFocus === "human" && item.bucket !== "human") return false;
      if (conversationFocus === "stale" && item.bucket !== "stale") return false;
      if (!q) return true;
      return (
        normSearch(item.conv.customer).includes(q) ||
        normSearch(item.conv.status).includes(q) ||
        normSearch(item.conv.lastMessage).includes(q) ||
        normSearch(item.reason).includes(q)
      );
    });
  }, [conversationQueue, conversationFocus, search]);

  useEffect(() => {
    if (initialTab !== "conversations") return;
    if (filteredConversationQueue.length === 0) return;
    const selectedStillVisible = filteredConversationQueue.some((item) => item.conv.psid === selectedPsid);
    if (!selectedStillVisible) {
      setSelectedPsid(filteredConversationQueue[0].conv.psid);
    }
  }, [filteredConversationQueue, initialTab, selectedPsid]);

  const conversationFocusCounts = useMemo(() => {
    let urgent = 0;
    let hot = 0;
    let human = 0;
    let stale = 0;

    for (const item of conversationQueue) {
      if (item.bucket === "urgent") urgent += 1;
      if (item.bucket === "hot") hot += 1;
      if (item.bucket === "human") human += 1;
      if (item.bucket === "stale") stale += 1;
    }

    return {
      all: conversationQueue.length,
      urgent,
      hot,
      human,
      stale,
    };
  }, [conversationQueue]);

  const nextConversationInQueue = filteredConversationQueue[0] || null;

  const leadBuckets = useMemo(() => {
    const hl = data?.customerHighlights || [];
    const q = normSearch(search);
    const filtered = q ? hl.filter((h) => normSearch(h.customer).includes(q) || normSearch(h.status).includes(q) || normSearch(h.lastMessage).includes(q)) : hl;
    return {
      urgent: filtered.filter((h) => h.needsHuman).sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()),
      hot: filtered.filter((h) => !h.needsHuman && h.readyToBuy).sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()),
      followup: filtered.filter((h) => !h.needsHuman && !h.readyToBuy).sort((a, b) => b.messageCount - a.messageCount),
    };
  }, [data, search]);

  const costList = useMemo(() => {
    return [...(data?.customerHighlights || [])].sort((a, b) => b.totalCostUsd - a.totalCostUsd);
  }, [data]);

  const priorityCustomers = useMemo(() => {
    return [...(data?.customerHighlights || [])]
      .filter((item) => item.needsHuman || item.readyToBuy)
      .sort((a, b) => {
        if (a.needsHuman !== b.needsHuman) return a.needsHuman ? -1 : 1;
        if (a.readyToBuy !== b.readyToBuy) return a.readyToBuy ? -1 : 1;
        return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();
      })
      .slice(0, 5);
  }, [data]);

  const prioritizedConversations = useMemo(() => {
    if (!data) return [];

    return [...data.conversations]
      .filter((item) => {
        const highlight = highlightMap.get(item.psid);
        return item.humanTakeover || highlight?.needsHuman || highlight?.readyToBuy;
      })
      .sort((a, b) => {
        const highlightA = highlightMap.get(a.psid);
        const highlightB = highlightMap.get(b.psid);
        const urgentA = Boolean(a.humanTakeover || highlightA?.needsHuman);
        const urgentB = Boolean(b.humanTakeover || highlightB?.needsHuman);
        if (urgentA !== urgentB) return urgentA ? -1 : 1;
        const hotA = Boolean(highlightA?.readyToBuy);
        const hotB = Boolean(highlightB?.readyToBuy);
        if (hotA !== hotB) return hotA ? -1 : 1;
        const timeA = highlightA?.lastMessageAt || a.exchanges[a.exchanges.length - 1]?.time || "";
        const timeB = highlightB?.lastMessageAt || b.exchanges[b.exchanges.length - 1]?.time || "";
        return new Date(timeB).getTime() - new Date(timeA).getTime();
      });
  }, [data, highlightMap]);

  const recentConversations = useMemo(() => {
    return [...(data?.conversations || [])]
      .sort((a, b) => {
        const aTime =
          highlightMap.get(a.psid)?.lastMessageAt ||
          a.exchanges[a.exchanges.length - 1]?.time ||
          "";
        const bTime =
          highlightMap.get(b.psid)?.lastMessageAt ||
          b.exchanges[b.exchanges.length - 1]?.time ||
          "";
        return new Date(bTime).getTime() - new Date(aTime).getTime();
      })
      .slice(0, 6);
  }, [data, highlightMap]);

  const sortedStatusBreakdown = useMemo(() => {
    return [...(data?.statusBreakdown || [])].sort((a, b) => b.count - a.count);
  }, [data]);

  const sortedIntentBreakdown = useMemo(() => {
    return [...(data?.intentBreakdown || [])].sort((a, b) => b.count - a.count).slice(0, 5);
  }, [data]);

  const topProvider = useMemo(() => {
    return [...(data?.providerBreakdown || [])].sort((a, b) => b.costUsd - a.costUsd)[0] || null;
  }, [data]);

  const pipelineMetrics = useMemo(() => {
    const contacts = totals?.contacts || 0;
    return {
      attentionShare: percentOf(totals?.needsAttentionContacts || 0, contacts),
      humanShare: percentOf(totals?.humanModeContacts || 0, contacts),
      quoteShare: percentOf(totals?.quoteRequests || 0, contacts),
    };
  }, [totals]);

  /* ─── Actions ─── */
  const refreshFacebookState = async (): Promise<FacebookMessengerStatus | null> => {
    if (!authToken) {
      setFacebookStatus(null);
      setFacebookError(null);
      setFacebookLastCheckedAt(null);
      setFacebookLoading(false);
      return null;
    }

    setFacebookLoading(true);
    try {
      const next = await loadFacebookMessengerStatus(authToken);
      setFacebookStatus(next);
      setFacebookError(null);
      return next;
    } catch (e) {
      setFacebookError(e instanceof Error ? e.message : "Etat Facebook indisponible");
      return null;
    } finally {
      setFacebookLastCheckedAt(new Date().toISOString());
      setFacebookLoading(false);
    }
  };

  const handleRefresh = () => {
    if (refreshing) return;
    setRefreshing(true);
    setFacebookLoading(Boolean(authToken));
    Promise.all([
      loadMessengerDashboardData(authToken, selectedPageId),
      authToken
        ? loadFacebookMessengerStatus(authToken)
            .then((status) => ({ status, error: null as string | null }))
            .catch((fbError) => ({
              status: null,
              error: fbError instanceof Error ? fbError.message : "Etat Facebook indisponible",
            }))
        : Promise.resolve({ status: null, error: null as string | null }),
    ])
      .then(([dashboard, facebook]) => {
        setData(dashboard);
        setError(null);
        setFacebookStatus(facebook.status);
        setFacebookError(facebook.error);
        if (authToken) {
          setFacebookLastCheckedAt(new Date().toISOString());
        }
      })
      .catch(() => {
        if (authToken) {
          setFacebookLastCheckedAt(new Date().toISOString());
        }
      })
      .finally(() => {
        setRefreshing(false);
        setFacebookLoading(false);
      });
  };

  const handleSwitchMode = async (psid: string, mode: string) => {
    if (!authToken || modeLoading) return;
    setModeLoading(psid);
    try {
      await updateMessengerContactMode(psid, mode as "human" | "agent", authToken);
      const next = await loadMessengerDashboardData(authToken, selectedPageId);
      setData(next);
    } catch {}
    setModeLoading(null);
  };

  const handleExport = async (format: "json" | "csv", range: "24h" | "all") => {
    const key = `${format}:${range}`;
    if (exportLoading) return;
    setExportLoading(key);
    try {
      await downloadMessengerExport(format, range, authToken);
    } catch {}
    setExportLoading(null);
  };

  const navigateToConv = (psid: string) => {
    setSelectedPsid(psid);
    onNavigate?.("conversations");
  };

  const selectedPriorityPosition = useMemo(() => {
    if (!selectedConv) return null;
    const index = prioritizedConversations.findIndex((item) => item.psid === selectedConv.psid);
    return index >= 0 ? index + 1 : null;
  }, [prioritizedConversations, selectedConv]);

  const nextPriorityConversation = useMemo(() => {
    if (!selectedConv) return prioritizedConversations[0] || null;
    const index = prioritizedConversations.findIndex((item) => item.psid === selectedConv.psid);
    if (index < 0) return prioritizedConversations[0] || null;
    return prioritizedConversations[index + 1] || null;
  }, [prioritizedConversations, selectedConv]);

  const handleConnectFacebook = async () => {
    if (!authToken) {
      setFacebookError("Connectez-vous et activez votre organisation avant de lancer Facebook.");
      onRequestAccess?.();
      return;
    }
    if (facebookStatus && !(facebookStatus.can_manage_pages ?? facebookStatus.can_edit)) {
      setFacebookError("Vous n'avez pas les droits requis pour connecter une page Facebook sur cette organisation.");
      return;
    }

    setFacebookAuthLoading(true);
    setFacebookError(null);
    setFacebookOauthOutcome(null);
    try {
      const previousPages = facebookStatus?.pages ?? [];
      const authUrl = await getFacebookMessengerAuthorizationUrl(authToken, window.location.origin);
      if (!authUrl) {
        throw new Error("URL d'autorisation Facebook manquante.");
      }

      const popup = window.open(authUrl, "flare-facebook-oauth", "width=680,height=760");
      if (!popup) {
        throw new Error("La popup Facebook a ete bloquee par le navigateur.");
      }

      let oauthConfirmed = false;
      await new Promise<void>((resolve, reject) => {
        let done = false;
        let timeoutId = 0;
        const cleanup = () => {
          if (done) return;
          done = true;
          window.removeEventListener("message", handleMessage);
          window.clearInterval(closeWatcher);
          window.clearTimeout(timeoutId);
        };

        const handleMessage = (event: MessageEvent) => {
          const allowedOrigins = new Set([window.location.origin, new URL(getApiBaseUrl()).origin]);
          if (!allowedOrigins.has(event.origin)) return;
          const payload = event.data as { type?: string; status?: string; detail?: string } | null;
          if (!payload || payload.type !== "flare-facebook-oauth") return;
          cleanup();
          if (payload.status === "success") {
            oauthConfirmed = true;
            resolve();
            return;
          }
          reject(new Error(payload.detail || "Connexion Facebook echouee."));
        };

        const closeWatcher = window.setInterval(() => {
          if (!popup.closed) return;
          cleanup();
          resolve();
        }, 400);

        timeoutId = window.setTimeout(() => {
          try {
            popup.close();
          } catch {}
          cleanup();
          reject(new Error("La connexion Facebook a expire. Reessayez."));
        }, FACEBOOK_OAUTH_TIMEOUT_MS);

        window.addEventListener("message", handleMessage);
      });

      const nextStatus = await refreshFacebookState();
      if (nextStatus) {
        setFacebookOauthOutcome(summarizeFacebookOauthOutcome(previousPages, nextStatus));
      } else if (oauthConfirmed) {
        setFacebookOauthOutcome({
          state: "unchanged",
          title: "Connexion confirmee, etat a rafraichir",
          detail:
            "La popup Facebook a bien valide l'autorisation, mais le statut n'a pas pu etre recharge automatiquement. Reessayez ou rechargez l'etat Facebook.",
        });
      } else if (!oauthConfirmed) {
        setFacebookError("Connexion Facebook annulee ou non finalisee.");
      }
    } catch (e) {
      setFacebookOauthOutcome(null);
      setFacebookError(e instanceof Error ? e.message : "Connexion Facebook impossible.");
    } finally {
      setFacebookAuthLoading(false);
    }
  };

  const handleActivateFacebookPage = async (pageId: string) => {
    if (!authToken) return;
    if (facebookStatus && !(facebookStatus.can_manage_pages ?? facebookStatus.can_edit)) {
      setFacebookError("Vous n'avez pas les droits requis pour activer une page Facebook sur cette organisation.");
      return;
    }
    setFacebookBusyPageId(pageId);
    setFacebookError(null);
    setFacebookOauthOutcome(null);
    try {
      const previousPages = facebookStatus?.pages ?? [];
      await activateFacebookMessengerPage(pageId, authToken);
      const nextStatus = await refreshFacebookState();
      setFacebookOauthOutcome(
        summarizeFacebookActivationOutcome(previousPages, nextStatus, pageId)
      );
      const next = await loadMessengerDashboardData(authToken, selectedPageId);
      setData(next);
    } catch (e) {
      setFacebookError(e instanceof Error ? e.message : "Activation Facebook impossible.");
    } finally {
      setFacebookBusyPageId(null);
    }
  };

  const handleDisconnectFacebookPage = async (pageId: string) => {
    if (!authToken) return;
    if (facebookStatus && !(facebookStatus.can_manage_pages ?? facebookStatus.can_edit)) {
      setFacebookError("Vous n'avez pas les droits requis pour deconnecter une page Facebook sur cette organisation.");
      return;
    }
    setFacebookBusyPageId(pageId);
    setFacebookError(null);
    setFacebookOauthOutcome(null);
    try {
      await disconnectFacebookMessengerPage(pageId, authToken);
      await refreshFacebookState();
      const next = await loadMessengerDashboardData(authToken, selectedPageId);
      setData(next);
    } catch (e) {
      setFacebookError(e instanceof Error ? e.message : "Deconnexion Facebook impossible.");
    } finally {
      setFacebookBusyPageId(null);
    }
  };

  /* ─── Loading / Error ─── */
  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-white/20" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center">
          <AlertCircle size={32} className="text-red-400/40 mx-auto mb-3" />
          <p className="text-[14px] text-white/40">{error}</p>
          <button onClick={handleRefresh} className="mt-4 rounded-xl bg-white/[0.04] px-4 py-2 text-[12px] text-white/50 hover:bg-white/[0.06] transition-all">
            Reessayer
          </button>
        </div>
      </div>
    );
  }

  /* ═══ OVERVIEW TAB ═══ */
  if (initialTab === "overview") {
    const maxStatusCount = sortedStatusBreakdown[0]?.count || 1;
    const maxIntentCount = sortedIntentBreakdown[0]?.count || 1;
    const syncTone =
      syncHealth?.state === "stale"
        ? "border-red-500/20 bg-red-500/8 text-red-100"
        : syncHealth?.state === "warning"
          ? "border-orange-400/20 bg-orange-400/8 text-orange-100"
          : "border-emerald-400/20 bg-emerald-400/8 text-emerald-100";

    return (
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-6 px-4 py-6 md:px-6 md:py-8">
          <FacebookConnectionPanel
            authReady={Boolean(authToken)}
            loading={facebookLoading}
            status={facebookStatus}
            error={facebookError}
            oauthOutcome={facebookOauthOutcome}
            lastCheckedAt={facebookLastCheckedAt}
            authLoading={facebookAuthLoading}
            busyPageId={facebookBusyPageId}
            onConnect={handleConnectFacebook}
            onRefreshStatus={() => {
              void refreshFacebookState();
            }}
            onActivate={handleActivateFacebookPage}
            onDisconnect={handleDisconnectFacebookPage}
            onRequestAccess={onRequestAccess}
          />

          <motion.section
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="overflow-hidden rounded-[28px] border border-white/[0.05] bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.08),transparent_32%),linear-gradient(145deg,rgba(255,255,255,0.04),rgba(255,255,255,0.01))] p-5 md:p-6"
          >
            <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
              <div className="max-w-[40rem]">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-white/[0.08] px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] text-white/28">
                    Messenger RAM&apos;S FLARE
                  </span>
                  {syncHealth ? (
                    <span className={`rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] ${syncTone}`}>
                      {syncHealth.label} · {formatMessengerSyncAge(syncHealth.ageMinutes)}
                    </span>
                  ) : null}
                </div>

                <h1 className="mt-4 text-[28px] font-semibold tracking-[-0.03em] text-white md:text-[34px]">
                  Cockpit du chatbot
                </h1>
                <p className="mt-2 text-[14px] leading-6 text-white/42">
                  Un panneau de pilotage plus direct pour surveiller les urgences, les clients
                  chauds, la sante de la synchro et le cout du moteur sans remonter dans plusieurs
                  sous-pages.
                </p>
              </div>

              <div className="grid w-full gap-3 sm:grid-cols-2 xl:max-w-[32rem]">
                <div className="rounded-2xl bg-black/20 px-4 py-4 backdrop-blur-sm">
                  <p className="text-[10px] uppercase tracking-[0.12em] text-white/22">Messages 24h</p>
                  <p className="mt-2 text-[26px] font-semibold text-white">
                    {formatNumber(totals?.messages24h || 0)}
                  </p>
                  <p className="text-[11px] text-white/24">flux traite sur les dernieres 24 heures</p>
                </div>
                <div className="rounded-2xl bg-black/20 px-4 py-4 backdrop-blur-sm">
                  <p className="text-[10px] uppercase tracking-[0.12em] text-white/22">Contacts suivis</p>
                  <p className="mt-2 text-[26px] font-semibold text-white">
                    {formatNumber(totals?.contacts || 0)}
                  </p>
                  <p className="text-[11px] text-white/24">
                    {formatNumber(totals?.humanModeContacts || 0)} deja passes en humain
                  </p>
                </div>
                <div className="rounded-2xl bg-black/20 px-4 py-4 backdrop-blur-sm">
                  <p className="text-[10px] uppercase tracking-[0.12em] text-white/22">A traiter</p>
                  <p className="mt-2 text-[26px] font-semibold text-white">
                    {formatNumber(totals?.needsAttentionContacts || 0)}
                  </p>
                  <p className="text-[11px] text-white/24">
                    {formatNumber(totals?.readyToBuyContacts || 0)} pret(s) a acheter
                  </p>
                </div>
                <div className="rounded-2xl bg-black/20 px-4 py-4 backdrop-blur-sm">
                  <p className="text-[10px] uppercase tracking-[0.12em] text-white/22">Cout total</p>
                  <p className="mt-2 text-[26px] font-semibold text-white">
                    {formatCurrency(totals?.totalCostUsd || 0)}
                  </p>
                  <p className="text-[11px] text-white/24">
                    {formatCurrency(totals?.avgCostUsd || 0)} par message en moyenne
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-white/[0.05] bg-white/[0.02] px-4 py-4">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] uppercase tracking-[0.12em] text-white/22">Tension du pipeline</p>
                  <Zap size={14} className="text-orange-300/70" />
                </div>
                <p className="mt-2 text-[20px] font-semibold text-white">{pipelineMetrics.attentionShare}%</p>
                <p className="text-[11px] text-white/25">
                  des contacts demandent une action ou une reprise
                </p>
                <div className="mt-3 h-1.5 rounded-full bg-white/[0.05]">
                  <div
                    className="h-full rounded-full bg-orange-300/70"
                    style={{ width: `${Math.max(pipelineMetrics.attentionShare, 6)}%` }}
                  />
                </div>
              </div>

              <div className="rounded-2xl border border-white/[0.05] bg-white/[0.02] px-4 py-4">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] uppercase tracking-[0.12em] text-white/22">Couverture humaine</p>
                  <Users size={14} className="text-white/35" />
                </div>
                <p className="mt-2 text-[20px] font-semibold text-white">{pipelineMetrics.humanShare}%</p>
                <p className="text-[11px] text-white/25">
                  des conversations ont deja bascule en humain
                </p>
                <div className="mt-3 h-1.5 rounded-full bg-white/[0.05]">
                  <div
                    className="h-full rounded-full bg-white/70"
                    style={{ width: `${Math.max(pipelineMetrics.humanShare, 6)}%` }}
                  />
                </div>
              </div>

              <div className="rounded-2xl border border-white/[0.05] bg-white/[0.02] px-4 py-4">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] uppercase tracking-[0.12em] text-white/22">Demandes de devis</p>
                  <ArrowUpRight size={14} className="text-white/35" />
                </div>
                <p className="mt-2 text-[20px] font-semibold text-white">
                  {formatNumber(totals?.quoteRequests || 0)}
                </p>
                <p className="text-[11px] text-white/25">
                  soit {pipelineMetrics.quoteShare}% du volume suivi
                </p>
                <div className="mt-3 h-1.5 rounded-full bg-white/[0.05]">
                  <div
                    className="h-full rounded-full bg-blue-300/70"
                    style={{ width: `${Math.max(pipelineMetrics.quoteShare, 6)}%` }}
                  />
                </div>
              </div>
            </div>
          </motion.section>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
            <motion.section
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.04 }}
              className="rounded-[28px] bg-white/[0.02] p-5 md:p-6"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.14em] text-white/25">Priorites</p>
                  <h2 className="mt-2 text-[20px] font-semibold text-white">A traiter maintenant</h2>
                  <p className="mt-1 text-[12px] leading-6 text-white/32">
                    Les conversations a reprendre en premier avant de se disperser dans le flux.
                  </p>
                </div>
                <button
                  onClick={() => onNavigate?.("leads")}
                  className="rounded-full bg-white/[0.04] px-3 py-1.5 text-[10px] uppercase tracking-[0.14em] text-white/35 transition-all hover:bg-white/[0.06] hover:text-white/55"
                >
                  Ouvrir prospects
                </button>
              </div>

              {priorityCustomers.length === 0 ? (
                <div className="mt-6 rounded-2xl border border-white/[0.05] px-5 py-8 text-center">
                  <Clock3 size={20} className="mx-auto mb-3 text-white/12" />
                  <p className="text-[13px] text-white/26">Aucune conversation critique detectee.</p>
                </div>
              ) : (
                <div className="mt-6 space-y-2">
                  {priorityCustomers.map((item) => (
                    <button
                      key={item.psid}
                      onClick={() => navigateToConv(item.psid)}
                      className="flex w-full items-start gap-3 rounded-2xl px-4 py-4 text-left transition-all hover:bg-white/[0.03]"
                    >
                      <div
                        className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${
                          item.needsHuman ? "bg-red-400" : "bg-orange-400"
                        }`}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-[13px] font-medium text-white">
                            {item.customer || "Anonyme"}
                          </p>
                          <span
                            className={`rounded-md px-1.5 py-0.5 text-[9px] font-medium ${statusBg(item.status)} ${statusColor(item.status)}`}
                          >
                            {statusLabel(item.status)}
                          </span>
                          {item.needsHuman ? (
                            <span className="rounded-md bg-red-500/10 px-1.5 py-0.5 text-[9px] text-red-300">
                              Humain requis
                            </span>
                          ) : null}
                          {item.readyToBuy && !item.needsHuman ? (
                            <span className="rounded-md bg-orange-500/10 px-1.5 py-0.5 text-[9px] text-orange-300">
                              Chaud
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-1 text-[12px] leading-6 text-white/34">
                          {clipText(item.lastMessage || item.lastReply || "Aucun contexte recent.", 150)}
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-3 text-[10px] text-white/18">
                          <span>{item.messageCount} messages</span>
                          <span>{formatCurrency(item.totalCostUsd)}</span>
                          <span>Mode: {modeLabel(item.mode)}</span>
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-[10px] text-white/20">{formatDate(item.lastMessageAt)}</p>
                        <ChevronRight size={13} className="ml-auto mt-3 text-white/18" />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </motion.section>

            <motion.section
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 }}
              className="rounded-[28px] bg-white/[0.02] p-5 md:p-6"
            >
              <p className="text-[10px] uppercase tracking-[0.14em] text-white/25">Etat du flux</p>
              <h2 className="mt-2 text-[20px] font-semibold text-white">Lecture rapide</h2>

              {syncHealth ? (
                <div className={`mt-5 rounded-2xl border px-4 py-4 ${syncTone}`}>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[12px] font-medium">{syncHealth?.label}</p>
                    <p className="text-[10px] uppercase tracking-[0.14em]">
                      {formatMessengerSyncAge(syncHealth?.ageMinutes ?? 0)}
                    </p>
                  </div>
                  <p className="mt-2 text-[12px] leading-6 text-current/75">{syncHealth?.message}</p>
                </div>
              ) : null}

              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                <div className="rounded-2xl bg-white/[0.03] px-4 py-4">
                  <p className="text-[10px] uppercase tracking-[0.12em] text-white/20">Latence moyenne</p>
                  <p className="mt-2 text-[18px] font-semibold text-white">
                    {formatLatency(totals?.avgLatencyMs || 0)}
                  </p>
                  <p className="text-[11px] text-white/24">temps moyen de reponse moteur</p>
                </div>

                <div className="rounded-2xl bg-white/[0.03] px-4 py-4">
                  <p className="text-[10px] uppercase tracking-[0.12em] text-white/20">Modele dominant</p>
                  <p className="mt-2 text-[15px] font-semibold text-white">
                    {topProvider ? topProvider.model : "Aucune donnee"}
                  </p>
                  <p className="text-[11px] text-white/24">
                    {topProvider
                      ? `${topProvider.provider} · ${formatCurrency(topProvider.costUsd)}`
                      : "la repartition apparaitra ici quand des couts seront traces"}
                  </p>
                </div>

                <div className="rounded-2xl bg-white/[0.03] px-4 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[10px] uppercase tracking-[0.12em] text-white/20">Budget chatbot</p>
                    <button
                      onClick={() => onNavigate?.("expenses")}
                      className="text-[10px] uppercase tracking-[0.14em] text-white/28 transition-colors hover:text-white/50"
                    >
                      Voir les couts
                    </button>
                  </div>
                  <p className="mt-2 text-[18px] font-semibold text-white">
                    {formatNumber(totals?.totalTokens || 0)} tokens
                  </p>
                  <p className="text-[11px] text-white/24">
                    {formatCurrency(totals?.avgCostUsd || 0)} par message en moyenne
                  </p>
                </div>
              </div>

              {data?.access?.message ? (
                <div className="mt-4 rounded-2xl border border-white/[0.05] px-4 py-3">
                  <p className="text-[10px] uppercase tracking-[0.12em] text-white/20">Acces</p>
                  <p className="mt-2 text-[12px] leading-6 text-white/32">{data.access.message}</p>
                </div>
              ) : null}
            </motion.section>
          </div>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
            <motion.section
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12 }}
              className="rounded-[28px] bg-white/[0.02] p-5 md:p-6"
            >
              <p className="text-[10px] uppercase tracking-[0.14em] text-white/25">Repartition</p>
              <h2 className="mt-2 text-[20px] font-semibold text-white">Statuts et intentions</h2>

              <div className="mt-6 grid gap-6 lg:grid-cols-2">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.12em] text-white/20">Statuts</p>
                  <div className="mt-3 space-y-3">
                    {sortedStatusBreakdown.length === 0 ? (
                      <p className="text-[12px] text-white/22">Aucune repartition disponible.</p>
                    ) : (
                      sortedStatusBreakdown.map((item) => (
                        <div key={item.label}>
                          <div className="flex items-center justify-between gap-3 text-[11px]">
                            <span className="text-white/42">{item.label}</span>
                            <span className="text-white/24">{item.count}</span>
                          </div>
                          <div className="mt-2 h-1.5 rounded-full bg-white/[0.05]">
                            <div
                              className="h-full rounded-full bg-white/70"
                              style={{
                                width: `${Math.max((item.count / maxStatusCount) * 100, item.count > 0 ? 8 : 0)}%`,
                              }}
                            />
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div>
                  <p className="text-[10px] uppercase tracking-[0.12em] text-white/20">Intentions detectees</p>
                  <div className="mt-3 space-y-3">
                    {sortedIntentBreakdown.length === 0 ? (
                      <p className="text-[12px] text-white/22">Aucune intention detaillee pour l&apos;instant.</p>
                    ) : (
                      sortedIntentBreakdown.map((item) => (
                        <div key={item.label}>
                          <div className="flex items-center justify-between gap-3 text-[11px]">
                            <span className="text-white/42">{item.label}</span>
                            <span className="text-white/24">{item.count}</span>
                          </div>
                          <div className="mt-2 h-1.5 rounded-full bg-white/[0.05]">
                            <div
                              className="h-full rounded-full bg-orange-300/75"
                              style={{
                                width: `${Math.max((item.count / maxIntentCount) * 100, item.count > 0 ? 8 : 0)}%`,
                              }}
                            />
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </motion.section>

            <motion.section
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.16 }}
              className="rounded-[28px] bg-white/[0.02] p-5 md:p-6"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.14em] text-white/25">Recents</p>
                  <h2 className="mt-2 text-[20px] font-semibold text-white">Dernieres conversations utiles</h2>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleRefresh}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-white/25 transition-all hover:bg-white/[0.04] hover:text-white/40"
                  >
                    {refreshing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCcw size={14} />}
                  </button>
                  <button
                    onClick={() => onNavigate?.("conversations")}
                    className="rounded-full bg-white/[0.04] px-3 py-1.5 text-[10px] uppercase tracking-[0.14em] text-white/35 transition-all hover:bg-white/[0.06] hover:text-white/55"
                  >
                    Voir tout
                  </button>
                </div>
              </div>

              <div className="mt-6 space-y-2">
                {recentConversations.length === 0 ? (
                  <div className="rounded-2xl border border-white/[0.05] px-5 py-8 text-center">
                    <MessageCircleMore size={20} className="mx-auto mb-3 text-white/12" />
                    <p className="text-[13px] text-white/26">Aucune conversation recente disponible.</p>
                  </div>
                ) : (
                  recentConversations.map((conv) => {
                    const highlight = highlightMap.get(conv.psid);
                    return (
                      <button
                        key={conv.psid}
                        onClick={() => navigateToConv(conv.psid)}
                        className="w-full rounded-2xl px-4 py-4 text-left transition-all hover:bg-white/[0.03]"
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/[0.04]">
                            <User size={14} className="text-white/28" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-[13px] font-medium text-white">
                                {conv.customer || "Anonyme"}
                              </p>
                              <span
                                className={`rounded-md px-1.5 py-0.5 text-[9px] ${statusBg(conv.status)} ${statusColor(conv.status)}`}
                              >
                                {statusLabel(conv.status)}
                              </span>
                              <span className="text-[10px] text-white/18">{modeLabel(conv.mode)}</span>
                            </div>
                            <p className="mt-1 text-[12px] leading-6 text-white/34">
                              {clipText(buildConversationSummary(conv, highlight), 150)}
                            </p>
                            <div className="mt-2 flex flex-wrap items-center gap-3 text-[10px] text-white/18">
                              <span>{highlight?.messageCount || conv.exchanges.length} messages</span>
                              <span>{formatDate(highlight?.lastMessageAt || conv.exchanges.at(-1)?.time)}</span>
                            </div>
                          </div>
                          <ChevronRight size={13} className="mt-1 shrink-0 text-white/18" />
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </motion.section>
          </div>
        </div>
      </div>
    );
  }

  if (false && initialTab === "overview") {
    return (
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[900px] px-4 py-6 md:px-6 space-y-6">
          {/* Header compact */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-[0.12em] text-white/25">Chatbot Facebook</p>
              <h1 className="mt-1 text-[22px] font-semibold tracking-tight text-white">Vue d&apos;ensemble</h1>
            </div>
            <div className="flex items-center gap-2">
              {syncHealth && (
                <span className="text-[10px] text-white/20">
                  {formatMessengerSyncAge(syncHealth?.ageMinutes ?? 0)}
                </span>
              )}
              <button onClick={handleRefresh} className="flex h-8 w-8 items-center justify-center rounded-lg text-white/25 hover:bg-white/[0.04] hover:text-white/40 transition-all">
                {refreshing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCcw size={14} />}
              </button>
            </div>
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard
              label="Messages 24h"
              value={formatNumber(totals?.messages24h || 0)}
              icon={<MessageCircleMore size={16} className="text-white/30" />}
            />
            <KpiCard
              label="Contacts"
              value={formatNumber(totals?.contacts || 0)}
              sub={`${totals?.humanModeContacts || 0} en humain`}
              icon={<Users size={16} className="text-white/30" />}
            />
            <KpiCard
              label="A traiter"
              value={formatNumber(totals?.needsAttentionContacts || 0)}
              sub={`${totals?.readyToBuyContacts || 0} pret(s) a acheter`}
              icon={<Zap size={16} className="text-orange-400/60" />}
            />
            <KpiCard
              label="Cout total"
              value={formatCurrency(totals?.totalCostUsd || 0)}
              sub={`~${formatCurrency(totals?.avgCostUsd || 0)}/msg`}
              icon={<Wallet size={16} className="text-white/30" />}
            />
          </div>

          {/* Priority clients */}
          {(data?.customerHighlights || []).some((h) => h.needsHuman || h.readyToBuy) && (
            <div>
              <p className="text-[10px] uppercase tracking-[0.12em] text-white/25 mb-3">Clients prioritaires</p>
              <div className="space-y-1.5">
                {(data?.customerHighlights || [])
                  .filter((h) => h.needsHuman || h.readyToBuy)
                  .sort((a, b) => (a.needsHuman === b.needsHuman ? 0 : a.needsHuman ? -1 : 1))
                  .slice(0, 6)
                  .map((h) => (
                    <button
                      key={h.psid}
                      onClick={() => navigateToConv(h.psid)}
                      className="w-full flex items-center gap-3 rounded-xl bg-white/[0.02] hover:bg-white/[0.04] px-4 py-3 text-left transition-all"
                    >
                      <div className={`h-2 w-2 rounded-full shrink-0 ${h.needsHuman ? "bg-red-400" : "bg-orange-400"}`} />
                      <p className="flex-1 text-[12px] font-medium text-white truncate">{h.customer || "Anonyme"}</p>
                      <span className={`rounded-md px-1.5 py-0.5 text-[9px] font-medium ${statusBg(h.status)} ${statusColor(h.status)}`}>
                        {statusLabel(h.status)}
                      </span>
                      <span className="text-[10px] text-white/20">{h.messageCount} msg</span>
                      <ChevronRight size={12} className="text-white/15" />
                    </button>
                  ))}
              </div>
            </div>
          )}

          {/* Recent conversations */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] uppercase tracking-[0.12em] text-white/25">Derniers clients</p>
              <button
                onClick={() => onNavigate?.("conversations")}
                className="text-[11px] text-white/25 hover:text-white/40 transition-colors"
              >
                Voir tout →
              </button>
            </div>
            <div className="space-y-1">
              {(data?.conversations || []).slice(0, 8).map((c) => (
                <button
                  key={c.psid}
                  onClick={() => navigateToConv(c.psid)}
                  className="w-full flex items-center gap-3 rounded-xl hover:bg-white/[0.03] px-3 py-2.5 text-left transition-all"
                >
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/[0.04]">
                    <User size={12} className="text-white/25" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-medium text-white truncate">{c.customer || "Anonyme"}</p>
                    <p className="text-[10px] text-white/20 truncate">{c.lastMessage}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`rounded-md px-1.5 py-0.5 text-[9px] ${statusBg(c.status)} ${statusColor(c.status)}`}>
                      {statusLabel(c.status)}
                    </span>
                    <span className="text-[10px] text-white/15">{modeLabel(c.mode)}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Quick stats */}
          {(data?.statusBreakdown?.length || 0) > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-[0.12em] text-white/25 mb-3">Repartition</p>
              <div className="flex flex-wrap gap-2">
                {(data?.statusBreakdown || []).map((s) => (
                  <div key={s.label} className="rounded-xl bg-white/[0.02] px-4 py-2.5">
                    <p className="text-[16px] font-semibold text-white">{s.count}</p>
                    <p className="text-[10px] text-white/25">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  /* ═══ CONVERSATIONS TAB ═══ */
  if (initialTab === "conversations") {
    return (
      <div className="flex-1 flex overflow-hidden">
        {/* Client list */}
        <div className="w-[280px] shrink-0 border-r border-white/[0.04] flex flex-col">
          {/* Search */}
          <div className="px-3 py-3 shrink-0">
            <div className="flex items-center gap-2 rounded-lg bg-white/[0.04] px-3 py-2">
              <Search size={13} className="text-white/20 shrink-0" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Chercher un client..."
                className="flex-1 bg-transparent text-[12px] text-white outline-none placeholder:text-white/15"
              />
            </div>
          </div>

          <div className="px-3 pb-2 shrink-0 space-y-2">
            <div className="flex flex-wrap gap-1.5">
              {([
                { key: "all", label: "Toutes", count: conversationFocusCounts.all },
                { key: "urgent", label: "Urgent", count: conversationFocusCounts.urgent },
                { key: "hot", label: "Pret", count: conversationFocusCounts.hot },
                { key: "human", label: "Humain", count: conversationFocusCounts.human },
                { key: "stale", label: "Silence", count: conversationFocusCounts.stale },
              ] as Array<{ key: ConversationFocus; label: string; count: number }>).map((item) => (
                <button
                  key={item.key}
                  onClick={() => setConversationFocus(item.key)}
                  className={`rounded-lg border px-2.5 py-1 text-[10px] transition-all ${
                    conversationFocus === item.key
                      ? "border-white/25 bg-white/[0.08] text-white"
                      : "border-white/[0.08] bg-white/[0.02] text-white/45 hover:text-white/70"
                  }`}
                >
                  {item.label} ({item.count})
                </button>
              ))}
            </div>

            {nextConversationInQueue ? (
              <button
                onClick={() => setSelectedPsid(nextConversationInQueue.conv.psid)}
                className="w-full rounded-xl border border-orange-300/20 bg-orange-300/10 px-3 py-2 text-left transition-all hover:bg-orange-300/14"
              >
                <p className="text-[10px] uppercase tracking-[0.1em] text-orange-100/85">Prochaine priorite</p>
                <p className="mt-1 text-[12px] font-medium text-orange-50 truncate">
                  {nextConversationInQueue.conv.customer || "Anonyme"}
                </p>
                <p className="mt-1 text-[10px] text-orange-100/70 truncate">
                  {nextConversationInQueue.reason} - {formatElapsedLabel(nextConversationInQueue.ageMinutes)}
                </p>
              </button>
            ) : null}
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto px-2 pb-4">
            {filteredConversationQueue.length === 0 ? (
              <p className="px-3 py-8 text-center text-[11px] text-white/15">Aucun client</p>
            ) : (
              filteredConversationQueue.map((item, index) => (
                <ClientRow
                  key={item.conv.psid}
                  conv={item.conv}
                  highlight={item.highlight || undefined}
                  active={item.conv.psid === selectedPsid}
                  queueHint={`${item.reason} - ${formatElapsedLabel(item.ageMinutes)}`}
                  priorityIndex={index + 1}
                  onClick={() => setSelectedPsid(item.conv.psid)}
                />
              ))
            )}
          </div>
        </div>

        {/* Conversation detail */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {selectedConv ? (
            <ConversationDetail
              conv={selectedConv}
              highlight={highlightMap.get(selectedConv.psid)}
              canOperate={canOperate}
              modeLoading={modeLoading === selectedConv.psid}
              onSwitchMode={handleSwitchMode}
              priorityPosition={selectedPriorityPosition}
              priorityCount={prioritizedConversations.length}
              nextPriority={nextPriorityConversation}
              nextPriorityHighlight={
                nextPriorityConversation ? highlightMap.get(nextPriorityConversation.psid) : null
              }
              onOpenPriorityConversation={navigateToConv}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center text-center">
              <div>
                <MessageCircleMore size={32} className="text-white/10 mx-auto mb-3" />
                <p className="text-[13px] text-white/20">Selectionnez un client</p>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  /* ═══ LEADS TAB ═══ */
  if (initialTab === "leads") {
    return (
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[900px] px-4 py-6 md:px-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-[0.12em] text-white/25">Prospects</p>
              <h1 className="mt-1 text-[22px] font-semibold tracking-tight text-white">Vos prospects</h1>
            </div>
            <div className="flex items-center gap-2 rounded-lg bg-white/[0.04] px-3 py-2">
              <Search size={13} className="text-white/20" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Chercher..."
                className="w-40 bg-transparent text-[12px] text-white outline-none placeholder:text-white/15"
              />
            </div>
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-3 gap-3">
            <KpiCard
              label="Humain requis"
              value={String(leadBuckets.urgent.length)}
              icon={<AlertCircle size={16} className="text-red-400/60" />}
            />
            <KpiCard
              label="Prets a acheter"
              value={String(leadBuckets.hot.length)}
              icon={<Zap size={16} className="text-orange-400/60" />}
            />
            <KpiCard
              label="A suivre"
              value={String(leadBuckets.followup.length)}
              icon={<Clock3 size={16} className="text-white/30" />}
            />
          </div>

          {/* Urgent */}
          {leadBuckets.urgent.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-[0.12em] text-red-400/60 mb-3">
                Humain requis ({leadBuckets.urgent.length})
              </p>
              <div className="space-y-1.5">
                {leadBuckets.urgent.map((h) => (
                  <LeadCard key={h.psid} item={h} onClick={() => navigateToConv(h.psid)} />
                ))}
              </div>
            </div>
          )}

          {/* Hot */}
          {leadBuckets.hot.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-[0.12em] text-orange-400/60 mb-3">
                Prets a acheter ({leadBuckets.hot.length})
              </p>
              <div className="space-y-1.5">
                {leadBuckets.hot.map((h) => (
                  <LeadCard key={h.psid} item={h} onClick={() => navigateToConv(h.psid)} />
                ))}
              </div>
            </div>
          )}

          {/* Follow-up */}
          {leadBuckets.followup.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-[0.12em] text-white/25 mb-3">
                A suivre ({leadBuckets.followup.length})
              </p>
              <div className="space-y-1.5">
                {leadBuckets.followup.map((h) => (
                  <LeadCard key={h.psid} item={h} onClick={() => navigateToConv(h.psid)} />
                ))}
              </div>
            </div>
          )}

          {leadBuckets.urgent.length === 0 && leadBuckets.hot.length === 0 && leadBuckets.followup.length === 0 && (
            <div className="text-center py-12">
              <Users size={32} className="text-white/10 mx-auto mb-3" />
              <p className="text-[13px] text-white/20">Aucun prospect trouve</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  /* ═══ EXPENSES TAB ═══ */
  if (initialTab === "expenses") {
    return (
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[900px] px-4 py-6 md:px-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-[0.12em] text-white/25">Depenses</p>
              <h1 className="mt-1 text-[22px] font-semibold tracking-tight text-white">Suivi des couts</h1>
            </div>
            <div className="flex items-center gap-2">
              {canExport && (
                <>
                  <button
                    onClick={() => void handleExport("csv", "all")}
                    disabled={exportLoading !== null}
                    className="flex items-center gap-1.5 rounded-lg bg-white/[0.04] px-3 py-2 text-[11px] text-white/40 hover:bg-white/[0.06] hover:text-white/60 transition-all disabled:opacity-30"
                  >
                    {exportLoading === "csv:all" ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
                    Exporter CSV
                  </button>
                </>
              )}
            </div>
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard
              label="Cout total"
              value={formatCurrency(totals?.totalCostUsd || 0)}
              icon={<Wallet size={16} className="text-white/30" />}
            />
            <KpiCard
              label="Cout moyen/msg"
              value={formatCurrency(totals?.avgCostUsd || 0)}
              icon={<MessageCircleMore size={16} className="text-white/30" />}
            />
            <KpiCard
              label="Tokens total"
              value={formatNumber(totals?.totalTokens || 0)}
              icon={<Zap size={16} className="text-white/30" />}
            />
            <KpiCard
              label="Tokens/msg"
              value={formatNumber(totals?.tokensPerMessage || 0)}
              icon={<ArrowUpRight size={16} className="text-white/30" />}
            />
          </div>

          {/* Provider breakdown */}
          {data?.providerBreakdown && data.providerBreakdown.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-[0.12em] text-white/25 mb-3">Par modele</p>
              <div className="space-y-1.5">
                {data.providerBreakdown.map((p, i) => (
                  <div key={i} className="flex items-center gap-3 rounded-xl bg-white/[0.02] px-4 py-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.04]">
                      <Bot size={13} className="text-white/30" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-medium text-white truncate">{p.model}</p>
                      <p className="text-[10px] text-white/20">{p.provider} · {formatNumber(p.messages)} msg · {formatNumber(p.tokens)} tokens</p>
                    </div>
                    <p className="text-[14px] font-semibold text-white shrink-0">{formatCurrency(p.costUsd)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Per-client costs */}
          <div>
            <p className="text-[10px] uppercase tracking-[0.12em] text-white/25 mb-3">Par client</p>
            <div className="space-y-1.5">
              {costList.slice(0, 15).map((h) => (
                <CostRow key={h.psid} item={h} />
              ))}
            </div>
          </div>

          {/* Period stats */}
          {data?.periodStats && data.periodStats.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-[0.12em] text-white/25 mb-3">Par periode</p>
              <div className="space-y-1.5">
                {data.periodStats.map((p, i) => (
                  <div key={i} className="flex items-center justify-between rounded-xl bg-white/[0.02] px-4 py-3">
                    <div>
                      <p className="text-[12px] font-medium text-white">{p.label}</p>
                      <p className="text-[10px] text-white/20">{formatNumber(p.messages)} msg · {formatNumber(p.tokens)} tokens</p>
                    </div>
                    <p className="text-[14px] font-semibold text-white">{formatCurrency(p.costUsd)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  /* ═══ Fallback ═══ */
  return (
    <div className="flex-1 flex items-center justify-center">
      <p className="text-[13px] text-white/20">Onglet inconnu</p>
    </div>
  );
}
