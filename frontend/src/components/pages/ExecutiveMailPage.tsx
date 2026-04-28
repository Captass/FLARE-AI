"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  Bot,
  Building2,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  Clipboard,
  ClipboardList,
  Clock,
  Copy,
  Download,
  Eye,
  FileText,
  Inbox,
  Info,
  Loader2,
  Mail,
  MailOpen,
  Paperclip,
  RefreshCw,
  Send,
  Star,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { GmailIcon } from "@/components/icons/GmailIcon";
import { ColorfulSparklesIcon } from "@/components/icons/GeneralIcons";
import {
  disconnectGmail,
  getGmailAttachmentData,
  generateGmailReply,
  getGmailAuthUrl,
  getGmailMessageDetail,
  getGmailMessages,
  getGmailStatus,
  sendGmailReply,
  type GmailAttachmentMetadata,
  type GmailAssistantMessage,
  type GmailBucketKey,
  type GmailMessagesResponse,
} from "@/lib/api";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { Bell, BellRing } from "lucide-react";

interface ExecutiveMailPageProps {
  token?: string | null;
}

interface MailActivityEntry {
  id: string;
  threadId?: string;
  subject: string;
  from: string;
  openedAt?: string;
  aiGeneratedAt?: string;
  copiedAt?: string;
  repliedAt?: string;
  sendErrorAt?: string;
  sendErrorMessage?: string;
  lastReplyBody?: string;
  replyPreview?: string;
}

const EMPTY_TRIAGE: GmailMessagesResponse = {
  priority: [],
  review: [],
  low: [],
  sent: [],
  app_sent: [],
  counts: { priority: 0, review: 0, low: 0, sent: 0, app_sent: 0, total: 0 },
  messages: [],
};

function makeTriage(
  priority: GmailAssistantMessage[] = [],
  review: GmailAssistantMessage[] = [],
  low: GmailAssistantMessage[] = [],
  sent: GmailAssistantMessage[] = [],
): GmailMessagesResponse {
  const messages = [...priority, ...review, ...low, ...sent];
  return {
    priority,
    review,
    low,
    sent,
    app_sent: [],
    counts: {
      priority: priority.length,
      review: review.length,
      low: low.length,
      sent: sent.length,
      app_sent: 0,
      total: messages.length,
    },
    messages,
  };
}

function normalizeTriage(
  response?: Partial<GmailMessagesResponse> | null,
  userEmail?: string | null,
  activity?: Record<string, MailActivityEntry>
): GmailMessagesResponse {
  const allMessages = response?.messages || [];
  const normalizedUserEmail = userEmail?.toLowerCase().trim();
  
  // Identify messages sent by the user or from the app
  const sent = allMessages.filter(m => {
    const isSentLabel = m.labelIds?.includes("SENT");
    const fromLower = m.from.toLowerCase();
    const emailLower = m.email?.toLowerCase();
    const isFromUser = normalizedUserEmail && (
      fromLower.includes(normalizedUserEmail) || 
      emailLower === normalizedUserEmail
    );
    return isSentLabel || isFromUser;
  });

  const regular_sent = sent;

  // Helper to filter out sent messages from any list
  const filterIncoming = (list: GmailAssistantMessage[]) => 
    list.filter(m => !sent.some(s => s.id === m.id));

  const priority = filterIncoming(response?.priority || allMessages.filter((m) => m.bucket === "priority" || m.priority === "Haute"));
  const review = filterIncoming(response?.review || allMessages.filter((m) => m.bucket === "review" || m.priority === "Normale"));
  const low = filterIncoming(response?.low || allMessages.filter((m) => m.bucket === "low" || m.priority === "Basse"));

  return makeTriage(priority, review, low, regular_sent);
}



function pillClass(value: string) {
  if (value === "Haute") return "border-red-500/25 bg-red-500/10 text-red-700";
  if (value === "Normale") return "border-sky-500/20 bg-sky-500/10 text-sky-700";
  if (value === "Basse") return "border-slate-300 bg-slate-50 text-slate-600";
  if (value === "Réponse proposée" || value === "Reponse proposee") return "border-orange-500/25 bg-orange-500/10 text-orange-600";
  if (value === "Traité" || value === "Traite") return "border-emerald-500/20 bg-emerald-500/10 text-emerald-700";
  return "border-[var(--border-default)] bg-[var(--surface-subtle)] text-[var(--text-secondary)]";
}

function bucketTitle(bucket: GmailBucketKey) {
  if (bucket === "priority") return "Prioritaires";
  if (bucket === "review") return "À vérifier";
  if (bucket === "sent") return "Mail envoyés";
  return "Non prioritaires";
}

function humanizeApiError(error: unknown): string | null {
  if (!(error instanceof Error) || !error.message) return null;
  const raw = error.message.trim();
  try {
    const parsed = JSON.parse(raw) as { detail?: string };
    if (parsed?.detail) return parsed.detail;
  } catch {
    // message is plain text
  }
  return raw;
}

function formatBytes(value?: number) {
  const size = Number(value || 0);
  if (!size) return "Taille inconnue";
  if (size < 1024) return `${size} o`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function base64UrlToBlob(base64Url: string, mimeType: string) {
  const normalized = base64Url.replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  const binary = atob(`${normalized}${padding}`);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new Blob([bytes], { type: mimeType || "application/octet-stream" });
}

function formatActivityDate(value?: string) {
  if (!value) return "";
  try {
    return new Date(value).toLocaleString("fr-FR");
  } catch {
    return value;
  }
}

function displayText(value?: string | null) {
  return (value || "")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, "\"")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

/* ── Premium UI Helpers ─────────────────────────────────────── */

function categoryIcon(category: string) {
  const c = category.toLowerCase();
  if (c.includes("pro") || c.includes("travail") || c.includes("work")) return <Building2 size={14} />;
  if (c.includes("finance") || c.includes("facture") || c.includes("paiement")) return <Wallet size={14} />;
  if (c.includes("client") || c.includes("partenaire")) return <Users size={14} />;
  if (c.includes("famille") || c.includes("personnel")) return <Star size={14} />;
  if (c.includes("newsletter") || c.includes("notification")) return <Inbox size={14} />;
  return <Mail size={14} />;
}

function priorityBorderClass(priority: string) {
  if (priority === "Haute") return "border-l-4 border-l-red-500";
  if (priority === "Normale") return "border-l-4 border-l-sky-500";
  return "border-l-4 border-l-slate-300";
}

function priorityDotClass(priority: string) {
  if (priority === "Haute") return "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]";
  if (priority === "Normale") return "bg-sky-500 shadow-[0_0_8px_rgba(14,165,233,0.4)]";
  return "bg-slate-400";
}

function bucketIcon(bucket: GmailBucketKey) {
  if (bucket === "priority") return <Star size={16} className="text-red-500" />;
  if (bucket === "review") return <Eye size={16} className="text-sky-600" />;
  if (bucket === "sent") return <Send size={16} className="text-emerald-500" />;
  if (bucket === "app_sent") return <CheckCheck size={16} className="text-blue-500" />;
  return <Inbox size={16} className="text-slate-500" />;
}

function bucketColorClass(bucket: GmailBucketKey) {
  if (bucket === "priority") return "text-red-600";
  if (bucket === "review") return "text-sky-700";
  return "text-slate-600";
}

function ShimmerBlock({ className = "" }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-2xl bg-gradient-to-r from-[var(--surface-subtle)] via-[var(--bg-card)] to-[var(--surface-subtle)] bg-[length:200%_100%] ${className}`} />
  );
}

function StatCard({ 
  icon, 
  value, 
  label, 
  color, 
  onClick, 
  active 
}: { 
  icon: React.ReactNode; 
  value: number; 
  label: string; 
  color: string;
  onClick?: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-3 rounded-2xl border transition-all ${
        active 
          ? "border-blue-500 bg-blue-50 shadow-md scale-[1.02]" 
          : "border-[var(--border-default)] bg-[var(--bg-card)] hover:border-blue-400 hover:bg-[var(--bg-hover)]"
      } px-4 py-3 text-left`}
    >
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${color}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className={`text-xl font-black ${active ? "text-blue-700" : "text-[var(--text-primary)]"}`}>{value}</p>
        <p className={`text-[11px] font-semibold uppercase tracking-wider ${active ? "text-blue-600" : "text-[var(--text-secondary)]"}`}>{label}</p>
      </div>
    </button>
  );
}

export default function ExecutiveMailPage({ token }: ExecutiveMailPageProps) {
  const [connected, setConnected] = useState(false);
  const [gmailEmail, setGmailEmail] = useState<string | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [triage, setTriage] = useState<GmailMessagesResponse>(EMPTY_TRIAGE);
  const [activeBucket, setActiveBucket] = useState<GmailBucketKey>("priority");
  const [expandedReasonId, setExpandedReasonId] = useState<string | null>(null);
  const [selectedMail, setSelectedMail] = useState<GmailAssistantMessage | null>(null);
  const [mailActivity, setMailActivity] = useState<Record<string, MailActivityEntry>>({});
  const [selectedTab, setSelectedTab] = useState<"message" | "reply">("message");
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [downloadingAttachmentId, setDownloadingAttachmentId] = useState<string | null>(null);
  const [replyDraft, setReplyDraft] = useState("");
  const [replyInstruction, setReplyInstruction] = useState("");
  const [generatingReply, setGeneratingReply] = useState(false);
  const [sendingReply, setSendingReply] = useState(false);
  const [confirmSend, setConfirmSend] = useState(false);
  const [aiMeta, setAiMeta] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const { registerPush, pushStatus } = usePushNotifications();

  const showNotice = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice((current) => (current === message ? null : current)), 2600);
  };

  const activityStorageKey = useMemo(
    () => `flare_gmail_activity:${gmailEmail || "default"}`,
    [gmailEmail],
  );

  const saveActivity = useCallback((updater: (current: Record<string, MailActivityEntry>) => Record<string, MailActivityEntry>) => {
    setMailActivity((current) => {
      const next = updater(current);
      try {
        window.localStorage.setItem(activityStorageKey, JSON.stringify(next));
      } catch {
        // ignore local persistence errors
      }
      return next;
    });
  }, [activityStorageKey]);

  const loadStatus = useCallback(async () => {
    if (!token) {
      setConnected(false);

      setLoadingStatus(false);
      return;
    }
    setLoadingStatus(true);
    try {
      const status = await getGmailStatus(token);
      setConnected(status.connected);
      setGmailEmail(status.email || null);

      setError(null);
    } catch {
      setConnected(false);

      setError("Impossible de vérifier Gmail pour le moment.");
    } finally {
      setLoadingStatus(false);
    }
  }, [token]);

  const loadMessages = useCallback(async () => {
    if (!token || !connected) return;
    setLoadingMessages(true);
    try {
      const response = normalizeTriage(await getGmailMessages(token), gmailEmail, mailActivity);
      setTriage(response);
      setError(null);
    } catch {
      setError("Impossible de charger les messages.");
    } finally {
      setLoadingMessages(false);
    }
  }, [connected, token]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  useEffect(() => {
    if (connected) {
      void loadMessages();
      const interval = setInterval(() => {
        void loadMessages();
      }, 60000); // Temps réel : Refresh toutes les 60 secondes
      return () => clearInterval(interval);
    }
  }, [connected, loadMessages]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(activityStorageKey);
      setMailActivity(raw ? JSON.parse(raw) : {});
    } catch {
      setMailActivity({});
    }
  }, [activityStorageKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const url = new URL(window.location.href);
    const gmailState = url.searchParams.get("gmail");
    const gmailReason = url.searchParams.get("gmail_reason");
    if (!gmailState) return;

    if (gmailState === "connected") {
      showNotice("Gmail connecté. Vos mails sont en cours de tri.");
      setError(null);
      void loadStatus();
    } else if (gmailState === "error") {
      setError(`Connexion Gmail interrompue${gmailReason ? ` (${gmailReason})` : ""}.`);
    } else if (gmailState === "missing-refresh-token") {
      setError("Google n'a pas fourni de session Gmail réutilisable. Réessayez avec un nouveau consentement.");
    } else if (gmailState === "profile-error") {
      setError("Connexion Gmail incomplète. Impossible de lire le profil Gmail pour le moment.");
    }
  }, [loadStatus]);

  const activeTriage = useMemo(() => triage, [triage]);
  const hasAnyMail = activeTriage.counts.total > 0;
  const recentReplies = useMemo(
    () =>
      Object.values(mailActivity)
        .filter((entry) => entry.repliedAt)
        .sort((a, b) => String(b.repliedAt || "").localeCompare(String(a.repliedAt || "")))
        .slice(0, 8),
    [mailActivity],
  );

  const getMailActivity = useCallback((mail: Pick<GmailAssistantMessage, "id">) => mailActivity[mail.id], [mailActivity]);

  const connectGmail = async () => {
    if (!token) {
      setError("Connectez-vous à FLARE AI avant de connecter Gmail.");
      return;
    }
    try {
      const returnUrl = `${window.location.origin}/app?view=executive-mail`;
      const { url } = await getGmailAuthUrl(token, returnUrl);
      window.location.href = url;
    } catch (err) {
      const apiError = humanizeApiError(err);
      if (apiError === "Google OAuth is not configured.") {
        setError("Google OAuth n'est pas configuré sur le backend. Ajoutez GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET et GOOGLE_REDIRECT_URI.");
      } else {
        setError(apiError || "Connexion Gmail indisponible pour le moment. Vérifiez la configuration Google OAuth.");
      }
    }
  };

  const handleDisconnect = async () => {
    if (!token) return;
    try {
      await disconnectGmail(token);
      setConnected(false);
      setGmailEmail(null);
      setTriage(EMPTY_TRIAGE);
      showNotice("Gmail déconnecté.");
    } catch {
      showNotice("La déconnexion Gmail sera disponible bientôt.");
    }
  };

  const copyReply = async (reply: string) => {
    try {
      await navigator.clipboard.writeText(reply);
      if (selectedMail) {
        saveActivity((current) => ({
          ...current,
          [selectedMail.id]: {
            ...(current[selectedMail.id] || { id: selectedMail.id, subject: selectedMail.subject, from: selectedMail.from }),
            id: selectedMail.id,
            copiedAt: new Date().toISOString(),
          },
        }));
      }
      showNotice("Réponse copiée.");
    } catch {
      showNotice("Impossible de copier automatiquement.");
    }
  };

  const loadMailDetail = useCallback(async (mail: GmailAssistantMessage) => {
    if (!token) return;
    setLoadingDetail(true);
    setDetailError(null);
    try {
      const detail = await getGmailMessageDetail(mail.id, token);
      setSelectedMail((current) => (current?.id === mail.id ? { ...current, ...detail } : current));
      setReplyDraft((current) => current || detail.suggestedReply || mail.suggestedReply || "");
    } catch (err) {
      setDetailError(humanizeApiError(err) || "Impossible de charger le contenu complet du mail.");
    } finally {
      setLoadingDetail(false);
    }
  }, [token]);

  const openReplyComposer = (mail: GmailAssistantMessage) => {
    setSelectedMail(mail);
    setSelectedTab("message");
    setReplyDraft(mail.suggestedReply || "");
    setReplyInstruction("");
    setConfirmSend(false);
    setAiMeta(null);
    setDetailError(null);
    saveActivity((current) => ({
      ...current,
      [mail.id]: {
        ...(current[mail.id] || {}),
        id: mail.id,
        threadId: mail.threadId,
        subject: mail.subject,
        from: mail.from,
        openedAt: new Date().toISOString(),
        replyPreview: current[mail.id]?.replyPreview || mail.suggestedReply || "",
      },
    }));
    void loadMailDetail(mail);
  };

  const closeReplyComposer = () => {
    setSelectedMail(null);
    setSelectedTab("message");
    setLoadingDetail(false);
    setDetailError(null);
    setDownloadingAttachmentId(null);
    setReplyDraft("");
    setReplyInstruction("");
    setConfirmSend(false);
    setAiMeta(null);
  };

  const updateMailStatus = (mailId: string, status: string) => {
    const updateList = (mails: GmailAssistantMessage[]) =>
      mails.map((mail) => (mail.id === mailId ? { ...mail, status } : mail));
    setTriage((current) => makeTriage(updateList(current.priority), updateList(current.review), updateList(current.low)));
  };

  const updateMailDraft = (mailId: string, suggestedReply: string) => {
    const updateList = (mails: GmailAssistantMessage[]) =>
      mails.map((mail) => (mail.id === mailId ? { ...mail, suggestedReply, status: "Réponse proposée" } : mail));
    setTriage((current) => makeTriage(updateList(current.priority), updateList(current.review), updateList(current.low)));
    saveActivity((current) => ({
      ...current,
      [mailId]: {
        ...(current[mailId] || { id: mailId, subject: selectedMail?.subject || "", from: selectedMail?.from || "" }),
        id: mailId,
        threadId: selectedMail?.threadId || current[mailId]?.threadId,
        subject: selectedMail?.subject || current[mailId]?.subject || "",
        from: selectedMail?.from || current[mailId]?.from || "",
        replyPreview: suggestedReply,
      },
    }));
  };

  const handleGenerateReply = async () => {
    if (!selectedMail) return;
    setGeneratingReply(true);
    setConfirmSend(false);
    try {
      const response = await generateGmailReply({
        message_id: selectedMail.id,
        instruction: replyInstruction,
        currentDraft: replyDraft,
      }, token);
      setReplyDraft(response.suggestedReply);
      updateMailDraft(selectedMail.id, response.suggestedReply);
      setAiMeta(response.aiUsed ? `IA légère · ${response.model || "Gemini Flash Lite"}` : "Réponse fallback rule-based");
      saveActivity((current) => ({
        ...current,
        [selectedMail.id]: {
          ...(current[selectedMail.id] || { id: selectedMail.id, subject: selectedMail.subject, from: selectedMail.from }),
          id: selectedMail.id,
          aiGeneratedAt: new Date().toISOString(),
        },
      }));
      showNotice(response.aiUsed ? "Réponse générée par IA." : "Réponse générée avec le fallback local.");
    } catch (err) {
      setError(humanizeApiError(err) || "Impossible de générer la réponse pour le moment.");
    } finally {
      setGeneratingReply(false);
    }
  };

  const handleSendReply = async () => {
    if (!selectedMail || !token) return;
    if (!replyDraft.trim()) {
      setError("La réponse est vide.");
      return;
    }
    if (!confirmSend) {
      setConfirmSend(true);
      return;
    }
    setSendingReply(true);
    try {
      await sendGmailReply({
        message_id: selectedMail.id,
        body: replyDraft,
        idempotency_key: `${selectedMail.id}:${replyDraft.length}:${replyDraft.slice(0, 24)}`,
      }, token);
      updateMailStatus(selectedMail.id, "Traité");
      saveActivity((current) => ({
        ...current,
        [selectedMail.id]: {
          ...(current[selectedMail.id] || {}),
          id: selectedMail.id,
          threadId: selectedMail.threadId,
          subject: selectedMail.subject,
          from: selectedMail.from,
          openedAt: current[selectedMail.id]?.openedAt || new Date().toISOString(),
          repliedAt: new Date().toISOString(),
          lastReplyBody: replyDraft,
          replyPreview: replyDraft.slice(0, 220),
        },
      }));
      showNotice("Réponse envoyée via Gmail.");
      closeReplyComposer();
    } catch (err) {
      const apiError = humanizeApiError(err);
      setError(apiError || "Impossible d'envoyer la réponse. Reconnectez Gmail si le scope d'envoi vient d'être ajouté.");
      if (selectedMail) {
        saveActivity((current) => ({
          ...current,
          [selectedMail.id]: {
            ...(current[selectedMail.id] || { id: selectedMail.id, subject: selectedMail.subject, from: selectedMail.from }),
            id: selectedMail.id,
            sendErrorAt: new Date().toISOString(),
            sendErrorMessage: apiError || "Erreur d'envoi Gmail",
          },
        }));
      }
    } finally {
      setSendingReply(false);
    }
  };

  const handleConnect = async () => {
    try {
      setIsSyncing(true);
      const { url } = await getGmailAuthUrl(window.location.href);
      if (url) {
        window.location.href = url;
      }
    } catch (err) {
      console.error("Failed to get Gmail auth URL", err);
      setError("Impossible de lancer la connexion Gmail. Vérifiez votre connexion internet.");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      setIsSyncing(true);
      await disconnectGmail(token);
      setConnected(false);
      setGmailEmail(null);
      setTriage(EMPTY_TRIAGE);
      showNotice("Gmail déconnecté.");
    } catch (err) {
      setError("Erreur lors de la déconnexion.");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDownloadAttachment = async (attachment: GmailAttachmentMetadata) => {
    if (!selectedMail || !token) return;
    setDownloadingAttachmentId(attachment.attachmentId);
    try {
      const payload = await getGmailAttachmentData(selectedMail.id, attachment.attachmentId, token);
      const blob = base64UrlToBlob(payload.dataBase64, payload.mimeType);
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = payload.filename || attachment.filename || "piece-jointe";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
      showNotice(`Pièce jointe téléchargée : ${payload.filename}`);
    } catch (err) {
      setError(humanizeApiError(err) || "Impossible de télécharger cette pièce jointe.");
    } finally {
      setDownloadingAttachmentId(null);
    }
  };

  const openHistoryEntry = (entry: MailActivityEntry) => {
    openReplyComposer({
      id: entry.id,
      threadId: entry.threadId,
      from: entry.from,
      subject: entry.subject,
      snippet: entry.replyPreview || "",
      date: entry.repliedAt || entry.openedAt || "",
      category: "Historique",
      priority: "Normale",
      status: entry.repliedAt ? "Traité" : "Réponse proposée",
      summary: entry.replyPreview || "Réponse envoyée via FLARE AI.",
      recommendedAction: entry.repliedAt ? "Déjà répondu" : "Revoir le mail",
      suggestedReply: entry.lastReplyBody || entry.replyPreview || "",
      replyTo: entry.from,
      email: entry.from,
    });
    setSelectedTab("reply");
  };

  const renderMailCard = (mail: GmailAssistantMessage, index: number) => (
    <motion.article
      key={mail.id}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: index * 0.03 }}
      onClick={() => openReplyComposer(mail)}
      className={`group relative cursor-pointer overflow-hidden rounded-[22px] bg-[var(--bg-card)] p-5 shadow-sm transition-all hover:scale-[1.005] hover:shadow-md ${priorityBorderClass(mail.priority)}`}
    >
      <div className="absolute inset-0 z-0 bg-gradient-to-br from-[var(--surface-subtle)] to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
      {(() => {
        const activity = getMailActivity(mail);
        return (
          <div className="relative z-10 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-default)] bg-[var(--surface-subtle)] px-2.5 py-1 text-xs font-bold text-[var(--text-secondary)]">
                  {categoryIcon(mail.category)}
                  {mail.category}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-default)] bg-[var(--surface-subtle)] px-2.5 py-1 text-xs font-bold text-[var(--text-secondary)]">
                  <span className={`h-2 w-2 rounded-full ${priorityDotClass(mail.priority)}`} />
                  {mail.priority}
                </span>
                {typeof mail.score === "number" && (
                  <span className="rounded-full border border-orange-500/20 bg-orange-500/10 px-2.5 py-1 text-xs font-bold text-orange-600">
                    Score {mail.score}
                  </span>
                )}
                {mail.isUnread && (
                  <span className="rounded-full border border-violet-500/20 bg-violet-500/10 px-2.5 py-1 text-xs font-bold text-violet-700">
                    Non lu
                  </span>
                )}
                {activity?.repliedAt && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-xs font-bold text-emerald-700">
                    <CheckCheck size={12} />
                    Répondu
                  </span>
                )}
                {!!mail.attachmentCount && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-[var(--border-default)] bg-[var(--surface-subtle)] px-2.5 py-1 text-xs font-bold text-[var(--text-secondary)]">
                    <Paperclip size={12} />
                    {mail.attachmentCount}
                  </span>
                )}
              </div>
              <h3 className="mt-3 line-clamp-2 break-words text-xl font-bold tracking-tight text-[var(--text-primary)] group-hover:text-orange-500 transition-colors">
                {displayText(mail.subject)}
              </h3>
              <div className="mt-1 flex items-center gap-2 text-sm font-medium text-[var(--text-secondary)]">
                <MailOpen size={14} className="opacity-70" />
                <span className="truncate">{displayText(mail.from)}</span>
              </div>
              <div className="mt-3 rounded-xl bg-[var(--surface-subtle)] px-4 py-3">
                <p className="line-clamp-2 break-words text-sm leading-relaxed text-[var(--text-secondary)]">
                  {displayText(mail.summary)}
                </p>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-1.5 text-sm font-bold text-orange-600">
                  <ArrowRight size={14} />
                  {mail.recommendedAction}
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setExpandedReasonId((current) => (current === mail.id ? null : mail.id));
                  }}
                  className="inline-flex items-center gap-1 rounded-full bg-[var(--surface-subtle)] px-2 py-1 text-[11px] font-bold text-[var(--text-secondary)] transition hover:text-orange-600"
                >
                  <Info size={12} />
                  Pourquoi ?
                </button>
              </div>
              {expandedReasonId === mail.id && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="mt-3 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] px-4 py-3 shadow-sm"
                  onClick={(e) => e.stopPropagation()}
                >
                  <ul className="grid gap-1.5 text-xs font-semibold text-[var(--text-secondary)]">
                    {(mail.reasons?.length ? mail.reasons : ["Classement automatique rule-based."]).map((reason) => (
                      <li key={reason} className="flex items-start gap-2">
                        <span className="mt-0.5 text-orange-500">•</span>
                        <span>{reason}</span>
                      </li>
                    ))}
                  </ul>
                </motion.div>
              )}
            </div>
            <div className="flex shrink-0 flex-col gap-2 sm:flex-row lg:flex-col lg:items-end">
              <button
                type="button"
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-blue-500/20 transition hover:bg-blue-700 hover:scale-105"
              >
                Ouvrir le mail
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  showNotice(`Tâche créée : ${mail.recommendedAction}`);
                }}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-transparent px-4 py-2.5 text-sm font-bold text-[var(--text-secondary)] transition hover:bg-[var(--surface-subtle)] hover:text-[var(--text-primary)]"
              >
                Créer une tâche
              </button>
            </div>
          </div>
        );
      })()}
    </motion.article>
  );

  const renderSection = (
    bucket: GmailBucketKey,
    mails: GmailAssistantMessage[],
  ) => {
    if (!mails.length) return (
        <div className="flex flex-col items-center justify-center gap-4 rounded-[24px] border border-[var(--border-default)] bg-[var(--surface-subtle)] p-12 text-center">
            <p className="text-sm font-bold text-[var(--text-secondary)]">Aucun mail dans cette catégorie.</p>
        </div>
    );

    return (
      <section className="grid gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-black text-[var(--text-primary)]">
            {bucketTitle(bucket)} <span className="text-[var(--text-secondary)]">({mails.length})</span>
          </h2>
        </div>
        {mails.map(renderMailCard)}
      </section>
    );
  };

  if (!token) {
    return (
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-[1040px] flex-col gap-6 px-4 py-8 md:px-8 md:py-10">
          <motion.header
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative overflow-hidden rounded-[32px] border border-[var(--border-default)] bg-[var(--bg-card)] p-8 md:p-10 shadow-xl shadow-slate-200/50"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-orange-500/5" />
            <div className="relative z-10 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
              <div>
                <h1 className="flex items-center gap-3 text-3xl font-black tracking-tight text-[var(--text-primary)] md:text-[40px]">
                  <GmailIcon className="text-3xl md:text-[40px]" /> Assistant Mail
                </h1>
                <p className="mt-4 max-w-xl text-base font-medium leading-relaxed text-[var(--text-secondary)]">
                  Connectez votre compte Gmail pour commencer à trier vos messages avec l&apos;IA.
                </p>
              </div>
              <button
                type="button"
                onClick={connectGmail}
                disabled={loadingStatus}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-6 py-4 text-sm font-black text-white shadow-lg shadow-blue-500/30 transition-all hover:bg-blue-700 hover:-translate-y-0.5 disabled:opacity-60"
              >
                {loadingStatus ? <Loader2 size={18} className="animate-spin" /> : <Mail size={18} />}
                Connecter Gmail
              </button>
            </div>
          </motion.header>
        </div>
      </div>
    );
  }

  if (loadingStatus && !connected) {
    return (
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-[1040px] flex-col gap-5 px-4 py-8 md:px-8 md:py-10">
          <div className="rounded-[24px] border border-emerald-500/20 bg-emerald-500/10 p-8 text-center">
            <p className="text-sm font-semibold text-emerald-700">Chargement de la session Gmail…</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto flex w-full max-w-[1040px] flex-col gap-5 px-4 py-8 md:px-8 md:py-10">
        <header className="relative overflow-hidden rounded-[26px] border border-[var(--border-default)] bg-[var(--bg-card)] p-6 md:p-8">
          <div className="absolute inset-0 z-0 bg-gradient-to-br from-orange-500/5 via-transparent to-amber-500/5" />
          <div className="relative z-10 flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="mb-4 flex flex-wrap gap-2">
                <button 
                  type="button"
                  onClick={handleConnect}
                  disabled={isSyncing}
                  className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold transition-all hover:scale-105 ${connected ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 shadow-[0_0_12px_rgba(16,185,129,0.15)]" : "border-orange-500/30 bg-orange-500/10 text-orange-600 hover:bg-orange-500/20"}`}
                >
                  <div className="relative">
                    <Mail size={14} />
                    {connected && activeTriage.counts.total > 0 && activeTriage.messages?.some(m => m.isUnread) && (
                      <span className="absolute -right-1 -top-1 flex h-2 w-2">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-orange-400 opacity-75"></span>
                        <span className="relative inline-flex h-2 w-2 rounded-full bg-orange-500"></span>
                      </span>
                    )}
                  </div>
                  {connected ? `Connecté · ${gmailEmail || "Gmail"}` : isSyncing ? "Connexion..." : "Non connecté (Cliquer pour connecter)"}
                </button>
              </div>
              <h1 className="flex items-center gap-3 text-3xl font-black tracking-tight text-[var(--text-primary)] md:text-[40px]">
                <GmailIcon size={40} /> Assistant Mail
              </h1>
              <p className="mt-3 max-w-2xl text-sm font-medium leading-relaxed text-[var(--text-secondary)] md:text-base">
                L&apos;IA analyse, trie et prépare les réponses pour vos mails importants.
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row md:flex-col">
              {connected && (
                <>
                  <button
                    type="button"
                    onClick={loadMessages}
                    disabled={loadingMessages}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-blue-700 disabled:opacity-60 shadow-[0_0_15px_rgba(37,99,235,0.2)]"
                  >
                    <RefreshCw size={15} className={loadingMessages ? "animate-spin" : ""} />
                    Actualiser
                  </button>
                  <button
                    type="button"
                    onClick={handleDisconnect}
                    className="inline-flex items-center justify-center rounded-2xl border border-[var(--border-default)] bg-[var(--surface-subtle)] px-4 py-3 text-sm font-bold text-[var(--text-primary)] hover:bg-white"
                  >
                    Déconnecter
                  </button>
                  {pushStatus !== "granted" && (
                    <button
                      type="button"
                      onClick={() => registerPush()}
                      disabled={pushStatus === "requesting"}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl border border-orange-500/30 bg-orange-500/10 px-4 py-3 text-sm font-bold text-orange-600 hover:bg-orange-500/20 disabled:opacity-50"
                    >
                      <Bell size={15} />
                      {pushStatus === "requesting" ? "Activation..." : "Activer les alertes"}
                    </button>
                  )}
                  {pushStatus === "granted" && (
                    <span className="inline-flex items-center justify-center gap-2 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm font-bold text-emerald-700">
                      <BellRing size={15} />
                      Alertes actives
                    </span>
                  )}
                </>
              )}
              {!connected && (
                <button
                  type="button"
                  onClick={handleConnect}
                  disabled={isSyncing}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-orange-500 px-6 py-3.5 text-base font-black text-white shadow-lg shadow-orange-500/25 transition-all hover:bg-orange-600 hover:scale-105 active:scale-95 disabled:opacity-50"
                >
                  <Mail size={20} />
                  {isSyncing ? "Ouverture..." : "Connecter mon Gmail"}
                </button>
              )}
            </div>
          </div>
        </header>

        {(notice || error) && (
          <div className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${error ? "border-orange-500/20 bg-orange-500/10 text-orange-700" : "border-emerald-500/20 bg-emerald-500/10 text-emerald-700"}`}>
            {error || notice}
          </div>
        )}

        {connected && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <StatCard
              icon={<Star size={18} />}
              value={activeTriage.counts.priority}
              label="Prioritaires"
              color="bg-red-500/10 text-red-500"
              active={activeBucket === "priority"}
              onClick={() => setActiveBucket("priority")}
            />
            <StatCard
              icon={<Eye size={18} />}
              value={activeTriage.counts.review}
              label="À vérifier"
              color="bg-sky-500/10 text-sky-500"
              active={activeBucket === "review"}
              onClick={() => setActiveBucket("review")}
            />
            <StatCard
              icon={<Inbox size={18} />}
              value={activeTriage.counts.low}
              label="Non prior."
              color="bg-slate-500/10 text-slate-500"
              active={activeBucket === "low"}
              onClick={() => setActiveBucket("low")}
            />
            <StatCard
              icon={<Send size={18} />}
              value={activeTriage.counts.sent}
              label="Envoyés"
              color="bg-emerald-500/10 text-emerald-500"
              active={activeBucket === "sent"}
              onClick={() => setActiveBucket("sent")}
            />
          </div>
        )}

        {!!recentReplies.length && (
          <section className="rounded-[24px] border border-[var(--border-default)] bg-[var(--bg-card)] p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-black text-[var(--text-primary)]">Réponses récentes</h2>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">Retrouvez les mails déjà répondus via FLARE AI.</p>
              </div>
              <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-700">
                {recentReplies.length} envoyé{recentReplies.length > 1 ? "s" : ""}
              </span>
            </div>
            <div className="mt-5 grid gap-3">
              {recentReplies.map((entry, index) => (
                <motion.div
                  key={entry.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="group flex flex-col gap-4 rounded-2xl border border-[var(--border-default)] bg-[var(--surface-subtle)] p-4 sm:flex-row sm:items-center sm:justify-between transition-colors hover:border-sky-500/30 hover:bg-[var(--bg-card)]"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-base font-bold tracking-tight text-[var(--text-primary)]">{displayText(entry.subject)}</p>
                    <p className="mt-1 flex items-center gap-1.5 truncate text-sm text-[var(--text-secondary)]">
                      <MailOpen size={13} className="opacity-70" />
                      {displayText(entry.from)}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--text-secondary)]">
                        <Clock size={12} />
                        {formatActivityDate(entry.repliedAt)}
                      </span>
                      {entry.aiGeneratedAt && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-violet-500/20 bg-violet-500/10 px-2 py-0.5 text-[10px] font-bold text-violet-700">
                          <Bot size={10} />
                          IA
                        </span>
                      )}
                      {entry.copiedAt && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-sky-500/20 bg-sky-500/10 px-2 py-0.5 text-[10px] font-bold text-sky-700">
                          <Copy size={10} />
                          Copié
                        </span>
                      )}
                      {entry.sendErrorAt && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-red-500/20 bg-red-500/10 px-2 py-0.5 text-[10px] font-bold text-red-700" title={entry.sendErrorMessage || ""}>
                          <Info size={10} />
                          Erreur
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => openHistoryEntry(entry)}
                    className="shrink-0 inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--bg-card)] border border-[var(--border-default)] px-4 py-2.5 text-sm font-bold text-[var(--text-primary)] shadow-sm transition group-hover:border-[var(--text-primary)]"
                  >
                    <Eye size={15} />
                    Revoir
                  </button>
                </motion.div>
              ))}
            </div>
          </section>
        )}

        <div className="grid gap-6">
          {loadingMessages && (
            <div className="flex flex-col items-center justify-center gap-4 rounded-[24px] border border-[var(--border-default)] bg-[var(--bg-card)] p-12">
              <Loader2 size={32} className="animate-spin text-orange-500" />
              <p className="text-sm font-bold text-[var(--text-primary)]">
                Tri des derniers mails en cours...
              </p>
            </div>
          )}

          {!connected && (
            <div className="flex flex-col items-center justify-center gap-4 rounded-[24px] border border-[var(--border-default)] bg-[var(--surface-subtle)] p-12 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-sm">
                <MailOpen size={24} className="text-slate-400" />
              </div>
              <div>
                <p className="text-lg font-bold text-[var(--text-primary)]">En attente de connexion</p>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">Connectez Gmail en haut de la page pour commencer.</p>
              </div>
            </div>
          )}

          {connected && !loadingMessages && !hasAnyMail && (
            <div className="flex flex-col items-center justify-center gap-6 rounded-[24px] border border-[var(--border-default)] bg-[var(--bg-card)] p-16 text-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-emerald-50 text-emerald-500 shadow-sm">
                <CheckCheck size={32} />
              </div>
              <div className="max-w-sm">
                <p className="text-xl font-black text-[var(--text-primary)]">Tout est à jour !</p>
                <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">
                  Nous n&apos;avons trouvé aucun mail récent nécessitant une attention immédiate. Profitez de ce temps gagné !
                </p>
              </div>
            </div>
          )}

          {connected && !loadingMessages && (
            <div className="grid gap-6">
              {activeBucket === "priority" && renderSection("priority", activeTriage.priority)}
              {activeBucket === "review" && renderSection("review", activeTriage.review)}
              {activeBucket === "low" && renderSection("low", activeTriage.low)}
              {activeBucket === "sent" && renderSection("sent", activeTriage.sent)}

            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {selectedMail && (
          <motion.div
            className="fixed inset-0 z-[160] flex items-end bg-black/40 p-3 backdrop-blur-sm md:items-center md:justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeReplyComposer}
          >
            <motion.aside
              initial={{ opacity: 0, y: 24, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 18, scale: 0.98 }}
              className="max-h-[88vh] w-full max-w-[960px] overflow-hidden rounded-[28px] border border-[var(--border-default)] bg-[var(--bg-card)] shadow-[0_24px_80px_rgba(15,23,42,0.25)] flex flex-col"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="relative shrink-0 border-b border-[var(--border-default)] bg-gradient-to-r from-orange-500/5 to-transparent p-6 md:px-8">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="inline-flex items-center gap-1.5 rounded-full border border-orange-500/20 bg-orange-500/10 px-2.5 py-1 text-xs font-bold text-orange-600">
                      <span className={`h-1.5 w-1.5 rounded-full ${priorityDotClass(selectedMail.priority)}`} />
                      {selectedMail.priority} Priority
                    </div>
                    <h2 className="mt-3 break-words text-2xl font-black tracking-tight text-[var(--text-primary)]">{displayText(selectedMail.subject)}</h2>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-[var(--text-secondary)]">
                      <span className="font-semibold">{displayText(selectedMail.from)}</span>
                      <span className="h-1 w-1 rounded-full bg-slate-300" />
                      <span>{selectedMail.date ? new Date(selectedMail.date).toLocaleString("fr-FR") : "Date indisponible"}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={closeReplyComposer}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--border-default)] bg-[var(--surface-subtle)] text-[var(--text-secondary)] transition hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
                    aria-label="Fermer"
                  >
                    <X size={18} />
                  </button>
                </div>
                <div className="mt-6 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedTab("message")}
                    className={`rounded-full px-6 py-2.5 text-sm font-bold transition-all ${
                      selectedTab === "message"
                        ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                        : "bg-[var(--surface-subtle)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
                    }`}
                  >
                    Message original
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedTab("reply")}
                    className={`rounded-full px-6 py-2.5 text-sm font-bold transition-all ${
                      selectedTab === "reply"
                        ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                        : "bg-[var(--surface-subtle)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
                    }`}
                  >
                    Répondre avec l&apos;IA
                  </button>
                </div>
              </div>
              
              <div className="flex-1 overflow-y-auto p-6 md:p-8">
                <div className="mb-6 rounded-2xl border border-[var(--border-default)] bg-[var(--surface-subtle)] p-5">
                  <div className="flex items-center gap-2 text-sm font-black text-[var(--text-primary)]">
                    <Bot size={16} className="text-orange-500" />
                    Résumé de l&apos;IA
                  </div>
                  <p className="mt-2 break-words text-sm leading-relaxed text-[var(--text-secondary)]">{displayText(selectedMail.summary)}</p>
                </div>
                {selectedTab === "message" ? (
                  <div className="grid gap-6">
                    {detailError && (
                      <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm font-semibold text-red-700">
                        {detailError}
                      </div>
                    )}
                    
                    <div className="rounded-[24px] border border-[var(--border-default)] bg-[var(--surface-subtle)]/30 p-6 shadow-sm">
                      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                        <h3 className="text-sm font-black text-[var(--text-primary)] flex items-center gap-2">
                          <FileText size={16} className="text-sky-600" />
                          Contenu du mail
                        </h3>
                        {selectedMail.bodyTruncated && (
                          <span className="rounded-full bg-orange-50 px-2.5 py-1 text-xs font-bold text-orange-600">
                            Contenu tronqué
                          </span>
                        )}
                      </div>
                      
                      {loadingDetail ? (
                        <div className="grid gap-3 pt-2">
                          <ShimmerBlock className="h-4 w-full" />
                          <ShimmerBlock className="h-4 w-[90%]" />
                          <ShimmerBlock className="h-4 w-[95%]" />
                          <ShimmerBlock className="h-4 w-[80%]" />
                          <ShimmerBlock className="mt-4 h-4 w-[60%]" />
                          <ShimmerBlock className="h-4 w-[40%]" />
                        </div>
                      ) : (
                        <div className="max-h-[500px] overflow-y-auto px-1">
                          {selectedMail.bodyHtml ? (
                            <iframe
                              srcDoc={selectedMail.bodyHtml}
                              sandbox="allow-popups allow-popups-to-escape-sandbox allow-same-origin"
                              className="w-full min-h-[400px] border-0 bg-[var(--bg-card)] rounded-xl"
                              title="Contenu complet du mail"
                            />
                          ) : (
                            <p className="whitespace-pre-wrap break-words text-sm leading-[1.8] text-[var(--text-secondary)] [overflow-wrap:anywhere]">
                              {displayText(selectedMail.bodyText) || "Ce mail ne contient pas de texte exploitable."}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                    {(!!selectedMail.attachments?.length || loadingDetail) && (
                      <div className="rounded-[24px] border border-[var(--border-default)] bg-[var(--bg-card)] p-6">
                        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                          <h3 className="text-sm font-black text-[var(--text-primary)] flex items-center gap-2">
                            <Paperclip size={16} className="text-slate-500" />
                            Pièces jointes
                          </h3>
                          <span className="text-xs font-bold text-[var(--text-secondary)]">{selectedMail.attachmentCount || 0} fichier(s)</span>
                        </div>
                        {loadingDetail ? (
                          <div className="grid gap-2">
                            <ShimmerBlock className="h-[68px] w-full" />
                            <ShimmerBlock className="h-[68px] w-full" />
                          </div>
                        ) : (
                          <div className="grid gap-3 sm:grid-cols-2">
                            {selectedMail.attachments!.map((attachment) => (
                              <div key={attachment.attachmentId} className="flex items-center gap-3 rounded-2xl border border-[var(--border-default)] bg-[var(--surface-subtle)] p-3 transition hover:bg-[var(--bg-hover)]">
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--bg-card)] text-slate-500">
                                  <FileText size={18} />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-sm font-bold text-[var(--text-primary)]" title={displayText(attachment.filename)}>
                                    {displayText(attachment.filename)}
                                  </p>
                                  <p className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wide">
                                    {formatBytes(attachment.size)}
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleDownloadAttachment(attachment)}
                                  disabled={downloadingAttachmentId === attachment.attachmentId}
                                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--bg-card)] border border-[var(--border-default)] text-[var(--text-primary)] shadow-sm transition hover:bg-[var(--surface-subtle)] disabled:opacity-50"
                                >
                                  {downloadingAttachmentId === attachment.attachmentId ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="grid gap-6">
                    {selectedMail.bucket === "sent" ? (
                      <div className="rounded-[24px] border border-emerald-500/20 bg-emerald-500/10 p-8 text-center">
                        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[var(--bg-card)] shadow-sm mb-3">
                          <CheckCheck size={24} className="text-emerald-500" />
                        </div>
                        <h3 className="text-lg font-black text-emerald-900">Message déjà envoyé</h3>
                        <p className="mt-2 text-sm text-emerald-700">
                          Ce mail a été envoyé depuis votre compte Gmail.
                        </p>
                      </div>
                    ) : (
                      <>
                        <div className="rounded-[24px] border border-[var(--border-default)] bg-[var(--surface-subtle)] p-6">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <h3 className="text-sm font-black text-[var(--text-primary)] flex items-center gap-2">
                              <Bot size={16} className="text-violet-600" />
                              Demander à l&apos;IA de rédiger la réponse
                            </h3>
                            {aiMeta && <span className="rounded-full bg-violet-50 px-2.5 py-1 text-[10px] font-bold text-violet-700 uppercase tracking-wide">{aiMeta}</span>}
                          </div>
                          <div className="mt-4 relative">
                            <textarea
                              value={replyInstruction}
                              onChange={(event) => setReplyInstruction(event.target.value)}
                              placeholder="Donnez vos consignes ici (ex: refuse poliment, propose un rdv demain à 14h), ou laissez vide pour une réponse standard..."
                              className="min-h-[100px] w-full resize-y rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-4 text-sm leading-relaxed text-[var(--text-primary)] outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-500/10"
                            />
                            <button
                              type="button"
                              onClick={handleGenerateReply}
                              disabled={generatingReply}
                              className="absolute bottom-3 right-3 inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-black text-white shadow-lg shadow-blue-500/30 transition hover:bg-blue-700 hover:shadow-xl hover:shadow-blue-500/40 disabled:opacity-60"
                            >
                              {generatingReply ? <Loader2 size={16} className="animate-spin" /> : <ColorfulSparklesIcon size={18} />}
                              {generatingReply ? "Génération..." : replyInstruction ? "Rédiger avec ces consignes" : "Générer une réponse auto"}
                            </button>
                          </div>
                        </div>

                        <div className="rounded-[24px] border border-orange-500/20 bg-orange-500/5 p-6 shadow-sm">
                          <div className="flex items-center justify-between">
                            <h3 className="text-sm font-black text-[var(--text-primary)] flex items-center gap-2">
                              <Send size={16} className="text-orange-500" />
                              Brouillon final (Éditable)
                            </h3>
                            <div className="rounded-lg bg-[var(--surface-subtle)] px-3 py-1.5 text-xs font-semibold text-[var(--text-secondary)] shadow-sm">
                              À : <span className="font-bold text-[var(--text-primary)]">{selectedMail.replyTo || selectedMail.email || selectedMail.from}</span>
                            </div>
                          </div>
                          
                          <textarea
                            value={replyDraft}
                            onChange={(event) => {
                              setReplyDraft(event.target.value);
                              setConfirmSend(false);
                            }}
                            className="mt-4 min-h-[240px] w-full resize-y rounded-2xl border-2 border-transparent bg-[var(--bg-card)] p-5 text-[15px] leading-[1.8] text-[var(--text-primary)] shadow-sm outline-none transition focus:border-blue-400/30 focus:ring-4 focus:ring-blue-500/5"
                          />
                          
                          <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
                            <button
                              type="button"
                              onClick={() => copyReply(replyDraft)}
                              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--bg-card)] border border-[var(--border-default)] px-4 py-2.5 text-sm font-bold text-[var(--text-primary)] shadow-sm transition hover:bg-[var(--bg-hover)]"
                            >
                              <Copy size={16} />
                              Copier le texte
                            </button>
                            
                            <div className="flex flex-col items-end gap-2">
                              <button
                                type="button"
                                onClick={handleSendReply}
                                disabled={sendingReply}
                                className={`inline-flex min-w-[200px] items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-bold text-white shadow-md transition disabled:opacity-60 ${confirmSend ? "bg-red-500 hover:bg-red-600 animate-pulse" : "bg-blue-600 hover:bg-blue-700 hover:-translate-y-0.5 shadow-[0_4px_15px_rgba(37,99,235,0.3)]"}`}
                              >
                                {sendingReply ? (
                                  <><Loader2 size={16} className="animate-spin" /> Envoi...</>
                                ) : confirmSend ? (
                                  "Confirmer l'envoi immédiat"
                                ) : (
                                  <><Send size={16} /> Envoyer via Gmail</>
                                )}
                              </button>
                              {confirmSend && (
                                <p className="text-[10px] font-bold text-red-500 uppercase tracking-widest animate-pulse">
                                  Action irréversible
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
