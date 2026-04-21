"use client";

import { motion } from "framer-motion";
import { Brush, SlidersHorizontal, BarChart3, Users, Loader2, MessageSquare, Bot, AlertCircle, CheckCircle2, ShoppingBag, Circle } from "lucide-react";
import PlatformCard, { NotifBadge } from "@/components/PlatformCard";
import type { NavLevel } from "@/components/NavBreadcrumb";
import PageSelector from "@/components/PageSelector";
import {
  consumeFacebookMessengerAuthResult,
  loadFacebookMessengerStatus,
  activateFacebookMessengerPage,
  resyncFacebookMessengerPages,
  loadFacebookAuthDebugInfo,
  META_PUBLIC_ACCESS_BLOCKED_MESSAGE,
  runFacebookMessengerOAuth,
  type FacebookAuthDebugInfo,
  type FacebookMessengerPage,
} from "@/lib/facebookMessenger";

import { useState, useEffect, useCallback } from "react";
import { loadMessengerDashboardData, type MessengerDashboardData } from "@/lib/messengerDirect";
import { getChatbotOverview, type ChatbotOverview, getMyActivationRequest, type ActivationRequest, getBillingFeatures } from "@/lib/api";
import { KPI_POLL_INTERVAL_MS } from "@/lib/kpiPolling";
import type { ChatbotSetupStatus } from "@/lib/api";
interface ChatbotHomePageProps {
  token?: string | null;
  getFreshToken?: (forceRefresh?: boolean) => Promise<string | null>;
  onPush: (level: NavLevel) => void;
  /** Nombre de conversations necessitant une intervention humaine */
  pendingHumanCount?: number;
  pages?: FacebookMessengerPage[];
  selectedPageId?: string | null;
  onSelectPage?: (pageId: string) => void;
  /** Remonte la liste des pages (aprÃƒÂ¨s OAuth ou activation) vers page.tsx */
  onPagesChanged?: (pages: FacebookMessengerPage[]) => void;
  /** Statut du parcours d'installation (connexion -> preferences) */
  setupStatus?: ChatbotSetupStatus | null;
  onRefreshSetupStatus?: () => Promise<ChatbotSetupStatus | null>;
}

const ENTRIES = [
  {
    id: "chatbot-personnalisation" as NavLevel,
    label: "Personnalisation",
    description: "Identite, ton, langue, entreprise et offres du bot",
    icon: Brush,
    iconColor: "text-orange-500",
    iconBg: "bg-orange-500/12",
  },
  {
    id: "chatbot-parametres" as NavLevel,
    label: "Parametres",
    description: "Catalogue, portfolio et connexion Facebook",
    icon: SlidersHorizontal,
    iconColor: "text-[var(--accent-navy)] dark:text-[rgb(183,203,255)]",
    iconBg: "bg-navy-500/12",
  },
  {
    id: "chatbot-dashboard" as NavLevel,
    label: "Tableau de bord",
    description: "Stats, statut d'activite et verification Facebook",
    icon: BarChart3,
    iconColor: "text-[var(--accent-navy)] dark:text-[rgb(183,203,255)]",
    iconBg: "bg-navy-500/12",
  },
  {
    id: "chatbot-clients" as NavLevel,
    label: "Clients & Conversations",
    description: "Suivi, notifications et controle par client",
    icon: Users,
    iconColor: "text-orange-400",
    iconBg: "bg-orange-500/12",
  },
  {
    id: "chatbot-orders" as NavLevel,
    label: "Commandes",
    description: "Commandes recues via Messenger et suivi",
    icon: ShoppingBag,
    iconColor: "text-[var(--accent-navy)] dark:text-[rgb(183,203,255)]",
    iconBg: "bg-navy-500/12",
  },
];

const META_BLOCKER_ALERT =
  "Facebook a bloque la connexion avant le retour vers FLARE. Si la popup affiche 'Fonctionnalite indisponible', le blocage vient de l'app Meta et non de votre compte FLARE.";

type InlineFeedback = {
  tone: "info" | "success" | "warning" | "error";
  message: string;
};

type ActivationBanner = {
  label: string;
  description: string;
  color: "orange" | "navy" | "red";
  cta?: { label: string; navTarget?: NavLevel; action?: () => void };
};

function getActivationBanner(
  planId: string | null,
  ar: ActivationRequest | null,
): ActivationBanner | null {
  if (!ar) {
    if (!planId || planId === "free") {
      return {
        label: "Choisissez votre offre",
        description: "Selectionnez un plan pour demarrer l'activation de votre chatbot IA.",
        color: "orange",
        cta: { label: "Voir les offres", navTarget: "chatbot-activation" as NavLevel },
      };
    }
    return null;
  }
  const s = ar.status;
  if (s === "draft" || s === "awaiting_payment") {
      return {
        label: "Envoyez votre paiement",
        description: "Effectuez le paiement et soumettez votre preuve pour continuer.",
        color: "orange",
        cta: { label: "Payer", navTarget: "chatbot-activation" as NavLevel },
      };
  }
  if (s === "payment_submitted") {
      return {
        label: "Preuve recue, verification en cours",
        description: "Notre equipe verifie votre paiement. Vous serez notifie des que c'est valide.",
        color: "navy",
      };
  }
  if (s === "payment_verified" || s === "awaiting_flare_page_admin_access") {
      const hasImportedPages = Boolean(ar.selected_facebook_pages_count);
      const hasTargetPage = Boolean(ar.activation_target_page_id);
      if (!hasImportedPages) {
        return {
          label: "Connectez Facebook et importez vos pages",
          description: "Avant l'activation, importez vos pages Facebook pour que FLARE puisse travailler sur la bonne page.",
          color: "orange",
          cta: { label: "Ouvrir l'activation", navTarget: "chatbot-activation" as NavLevel },
        };
      }
      if (!hasTargetPage) {
        return {
          label: "Choisissez la page a activer",
          description: "Vos pages sont importees. Il reste a confirmer la page cible pour l'activation.",
          color: "orange",
          cta: { label: "Choisir la page", navTarget: "chatbot-activation" as NavLevel },
        };
      }
      return {
        label: "Autorisez FLARE sur votre page cible",
        description: "Dans l'activation, importez vos pages Facebook puis autorisez FLARE a utiliser la page selectionnee.",
        color: "orange",
        cta: { label: "Finaliser l'autorisation", navTarget: "chatbot-activation" as NavLevel },
      };
  }
  if (s === "queued_for_activation" || s === "activation_in_progress" || s === "testing") {
      return {
        label: "Activation en cours",
        description: "Notre equipe configure votre chatbot. Vous serez notifie des qu'il est pret.",
        color: "navy",
      };
  }
  if (s === "blocked") {
    return {
      label: "Activation bloquee",
      description: ar.blocked_reason || "L'activation a ete suspendue. Contactez l'equipe FLARE pour plus d'informations.",
      color: "red",
    };
  }
  if (s === "rejected") {
    return {
      label: "Paiement refuse",
      description: ar.blocked_reason || "Votre paiement n'a pas pu etre valide. Vous pouvez renvoyer une preuve.",
      color: "red",
      cta: { label: "Renvoyer une preuve", navTarget: "chatbot-activation" as NavLevel },
    };
  }
  // active or other terminal -- no banner
  return null;
}

export default function ChatbotHomePage({
  token,
  getFreshToken,
  onPush,
  pendingHumanCount = 0,
  pages = [],
  selectedPageId = null,
  onSelectPage,
  onPagesChanged,
  setupStatus = null,
  onRefreshSetupStatus,
}: ChatbotHomePageProps) {
  const [activationRequest, setActivationRequest] = useState<ActivationRequest | null>(null);
  const [currentPlanId, setCurrentPlanId] = useState<string | null>(null);
  const [activationLoading, setActivationLoading] = useState(true);

  const canAccessChatbot = Boolean(token);

  const hasPageSelected = Boolean(selectedPageId && pages.some((page) => page.page_id === selectedPageId));
  const [dashData, setDashData] = useState<MessengerDashboardData | null>(null);
  const [overview, setOverview] = useState<ChatbotOverview | null>(null);
  const [loadingKPIs, setLoadingKPIs] = useState(false);
  const [lastKpiUpdate, setLastKpiUpdate] = useState<Date | null>(null);
  const [canManageFb, setCanManageFb] = useState(false);
  const [fbBusyPageId, setFbBusyPageId] = useState<string | null>(null);
  const [pagesRefreshBusy, setPagesRefreshBusy] = useState(false);
  const [fbOauthBusy, setFbOauthBusy] = useState(false);
  const [feedback, setFeedback] = useState<InlineFeedback | null>(null);
  const [facebookAuthDebug, setFacebookAuthDebug] = useState<FacebookAuthDebugInfo | null>(null);

  const pushFeedback = useCallback((tone: InlineFeedback["tone"], message: string) => {
    setFeedback({ tone, message });
    window.setTimeout(() => {
      setFeedback((current) => (current?.message === message ? null : current));
    }, 12000);
  }, []);

  const resolveToken = useCallback(async () => {
    if (getFreshToken) return await getFreshToken();
    return token ?? null;
  }, [getFreshToken, token]);

  // Load activation request + plan on mount
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const t = await resolveToken();
      if (!t || cancelled) {
        if (!cancelled) setActivationLoading(false);
        return;
      }
      try {
        const [ar, billing] = await Promise.allSettled([
          getMyActivationRequest(t),
          getBillingFeatures(t),
        ]);
        if (!cancelled) {
          setActivationRequest(ar.status === "fulfilled" ? ar.value.activation_request : null);
          setCurrentPlanId(billing.status === "fulfilled" ? (billing.value as any)?.plan_id ?? null : null);
        }
      } catch { /* silent */ }
      finally {
        if (!cancelled) setActivationLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [resolveToken]);

  const syncFacebookPages = useCallback(async () => {
    const t = await resolveToken();
    if (!t) return;
    try {
      const st = await loadFacebookMessengerStatus(t);
      setCanManageFb(st.can_manage_pages);
      onPagesChanged?.(st.pages || []);
    } catch {
      /* ignore: statut Meta optionnel au chargement hub */
    }
  }, [resolveToken, onPagesChanged]);

  useEffect(() => {
    void syncFacebookPages();
  }, [syncFacebookPages]);

  useEffect(() => {
    const authResult = consumeFacebookMessengerAuthResult();
    if (!authResult || authResult.provider !== "facebook") {
      return;
    }

    if (authResult.status === "success") {
      setFbOauthBusy(true);
      void (async () => {
        try {
          const t = await resolveToken();
          if (!t) {
            pushFeedback("error", "Session expiree. Reconnectez-vous a FLARE.");
            return;
          }

          const st = await loadFacebookMessengerStatus(t);
          setCanManageFb(st.can_manage_pages);
          onPagesChanged?.(st.pages || []);
          pushFeedback("success", "Connexion Meta terminee. Vos pages FLARE ont ete rechargees.");
        } catch (error) {
          const message = error instanceof Error ? error.message : "Connexion Meta interrompue.";
          pushFeedback("error", message);
        } finally {
          setFbOauthBusy(false);
        }
      })();
      return;
    }

    pushFeedback("error", authResult.detail || "Connexion Meta interrompue.");
  }, [onPagesChanged, pushFeedback, resolveToken]);

  useEffect(() => {
    const canInspectMeta = Boolean(canManageFb);

    if (!canInspectMeta || typeof window === "undefined") {
      setFacebookAuthDebug(null);
      return;
    }

    let cancelled = false;
    void (async () => {
      const t = await resolveToken();
      if (!t) {
        if (!cancelled) setFacebookAuthDebug(null);
        return;
      }
      try {
        const debugInfo = await loadFacebookAuthDebugInfo(t, window.location.origin);
        if (!cancelled) {
          setFacebookAuthDebug(debugInfo);
        }
      } catch {
        if (!cancelled) {
          setFacebookAuthDebug(null);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [canManageFb, resolveToken]);

  const handleActivatePage = useCallback(
    async (pageId: string) => {
      const t = await resolveToken();
      if (!t || !canManageFb) return;
      setFbBusyPageId(pageId);
      try {
        const responsePage = await activateFacebookMessengerPage(pageId, t);
        const st = await loadFacebookMessengerStatus(t);
        
        let shouldSelect = true;
        if (responsePage.page_id === selectedPageId) shouldSelect = false;

        onPagesChanged?.(st.pages);
        
        if (shouldSelect && onSelectPage) {
          onSelectPage(responsePage.page_id);
        }

        const activatedPage = st.pages.find((p) => p.page_id === pageId);
        const name = activatedPage?.page_name?.trim();
        const botReallyOn = Boolean(
          activatedPage?.is_active &&
          activatedPage?.webhook_subscribed
        );
        const directSyncPending = Boolean(botReallyOn && !activatedPage?.direct_service_synced);
        pushFeedback(
          botReallyOn ? "success" : "warning",
          botReallyOn
            ? name
              ? directSyncPending
                ? `"${name}" est activee. Bot ON : vous pouvez envoyer un message test a la page. La synchronisation des stats Messenger reste en attente.`
                : `"${name}" est activee. Bot ON : vous pouvez envoyer un message test a la page.`
              : directSyncPending
                ? "Page activee. Bot ON : vous pouvez envoyer un message test a la page. La synchronisation des stats Messenger reste en attente."
                : "Page activee. Bot ON : vous pouvez envoyer un message test a la page."
            : name
              ? `"${name}" reste OFF tant que la synchronisation technique n'est pas totalement terminee.`
              : "La page reste OFF tant que la synchronisation technique n'est pas totalement terminee."
        );
      } catch (e) {
        console.error(e);
        const msg =
          e instanceof Error
            ? e.message
            : "Activation impossible. Ouvrez Parametres et reconnectez Facebook si le probleme continue.";
        pushFeedback("error", msg);
      } finally {
        setFbBusyPageId(null);
      }
    },
    [resolveToken, canManageFb, onPagesChanged, onSelectPage, pushFeedback, selectedPageId]
  );

  const handleDeactivatePage = useCallback(
    async (pageId: string) => {
      const t = await resolveToken();
      if (!t || !canManageFb) return;
      setFbBusyPageId(pageId);
      try {
        const { deactivateFacebookMessengerPage } = await import("@/lib/facebookMessenger");
        await deactivateFacebookMessengerPage(pageId, t);
        const st = await loadFacebookMessengerStatus(t);
        onPagesChanged?.(st.pages || []);
      } catch (e) {
        console.error(e);
        const msg = e instanceof Error ? e.message : "Desactivation impossible.";
        pushFeedback("error", msg);
      } finally {
        setFbBusyPageId(null);
      }
    },
    [resolveToken, canManageFb, onPagesChanged, pushFeedback]
  );

  const handleRemovePage = useCallback(
    async (pageId: string) => {
      const t = await resolveToken();
      if (!t || !canManageFb) return;
      setFbBusyPageId(pageId);
      try {
        const { disconnectFacebookMessengerPage } = await import("@/lib/facebookMessenger");
        await disconnectFacebookMessengerPage(pageId, t);
        const st = await loadFacebookMessengerStatus(t);
        onPagesChanged?.(st.pages);
        if (selectedPageId === pageId && onSelectPage && st.pages.length > 0) {
          onSelectPage(st.pages[0].page_id);
        }
      } catch (e) {
        console.error(e);
        const msg = e instanceof Error ? e.message : "Suppression impossible.";
        pushFeedback("error", msg);
      } finally {
        setFbBusyPageId(null);
      }
    },
    [resolveToken, canManageFb, onPagesChanged, pushFeedback, selectedPageId, onSelectPage]
  );

  const handleConnectMetaPages = useCallback(async () => {
    const t = await resolveToken();
    if (!t) {
      pushFeedback("error", "Session expiree. Reconnectez-vous a FLARE.");
      return;
    }
    setFbOauthBusy(true);
    try {
      const flow = await runFacebookMessengerOAuth(t);
      if (flow === "popup") {
        const st = await loadFacebookMessengerStatus(t);
        setCanManageFb(st.can_manage_pages);
        onPagesChanged?.(st.pages || []);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Connexion Meta interrompue.";
      if (/403|forbidden|permission|owner|admin/i.test(msg)) {
        pushFeedback("error", "Permissions insuffisantes pour connecter Facebook.");
        return;
      }
      if (msg === META_PUBLIC_ACCESS_BLOCKED_MESSAGE) {
        pushFeedback("warning", META_BLOCKER_ALERT);
        return;
      }
      pushFeedback("error", msg);
    } finally {
      setFbOauthBusy(false);
    }
  }, [onPagesChanged, pushFeedback, resolveToken]);

  const handleSyncPagesList = useCallback(async () => {
    const t = await resolveToken();
    if (!t || !canManageFb) return;
    setPagesRefreshBusy(true);
    try {
      await resyncFacebookMessengerPages(t);
      const st = await loadFacebookMessengerStatus(t);
      onPagesChanged?.(st.pages || []);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (/expir|reconnect|session|actualiser la liste/i.test(msg)) {
        pushFeedback("warning", `${msg} Utilisez le bouton "Ouvrir Meta" pour renouveler l'autorisation.`);
      } else {
        pushFeedback("error", msg || "Impossible d'actualiser la liste des pages.");
      }
    } finally {
      setPagesRefreshBusy(false);
    }
  }, [resolveToken, canManageFb, onPagesChanged, pushFeedback]);

  const loadKPIs = useCallback(
    async (silent = false) => {
      let t = token;
      if (getFreshToken) t = await getFreshToken();
      if (!t || !selectedPageId) {
        setDashData(null);
        setOverview(null);
        return;
      }
      if (!silent) setLoadingKPIs(true);
      try {
        const [dash, ov] = await Promise.allSettled([
          loadMessengerDashboardData(t, selectedPageId),
          getChatbotOverview(t, selectedPageId),
        ]);
        if (dash.status === "fulfilled") setDashData(dash.value);
        if (ov.status === "fulfilled") setOverview(ov.value);
        setLastKpiUpdate(new Date());
      } catch (e) {
        console.error(e);
      } finally {
        if (!silent) setLoadingKPIs(false);
      }
    },
    [token, getFreshToken, selectedPageId]
  );

  useEffect(() => {
    void loadKPIs(false);
    const intervalId = window.setInterval(() => void loadKPIs(true), KPI_POLL_INTERVAL_MS);
    const onVisibility = () => {
      if (document.visibilityState === "visible") void loadKPIs(true);
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [loadKPIs]);

  const messagesTraites = dashData?.totals?.messages24h ?? dashData?.periodStats?.[0]?.messages ?? 0;
  const contactsCaptes = dashData?.totals?.contacts ?? 0;
  const alertCount = overview?.pending_human_count ?? pendingHumanCount;
  const botFullyLive =
    overview?.step === "complete" &&
    Boolean(
      overview?.active_page?.is_active &&
      overview?.active_page?.webhook_subscribed
    );

  const activationBanner = getActivationBanner(
    currentPlanId,
    activationRequest
  );
  const currentPlanLabel = ({
    free: "Free",
    starter: "Starter",
    pro: "Pro",
    business: "Business",
  } as Record<string, string>)[String(currentPlanId || activationRequest?.applied_plan_id || "free")] ?? String(currentPlanId || activationRequest?.applied_plan_id || "Free");

  // Etapes du guide d'onboarding
  const hasAnyPage = pages.length > 0;
  const hasActivePage = pages.some((p) => p.is_active && p.webhook_subscribed);
  const onboardingSteps = [
    {
      label: "Connectez votre compte Facebook",
      done: hasAnyPage,
      action: !hasAnyPage ? () => void handleConnectMetaPages() : undefined,
      actionLabel: "Ouvrir Meta",
    },
    {
      label: "Choisissez et activez votre page",
      done: hasActivePage,
      action: undefined,
      actionLabel: undefined,
    },
    {
      label: "Configurez les preferences du bot",
      done: hasActivePage && Boolean(setupStatus?.has_preferences),
      action: hasActivePage ? () => onPush("chatbot-personnalisation" as NavLevel) : undefined,
      actionLabel: "Personnaliser",
    },
    {
      label: "Testez votre chatbot sur Messenger",
      done: false,
      action: undefined,
      actionLabel: undefined,
    },
  ];
  const completedSteps = onboardingSteps.filter((s) => s.done).length;
  const showOnboarding = canAccessChatbot && !hasActivePage;

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-[860px] px-4 py-8 md:px-8 md:py-12 flex flex-col gap-8">

        {/* Ã¯Â¿Â½"Ã¯Â¿Â½Ã¯Â¿Â½"Ã¯Â¿Â½ Header & Page Selector Ã¯Â¿Â½"Ã¯Â¿Â½Ã¯Â¿Â½"Ã¯Â¿Â½ */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col gap-6 relative"
        >
          <div className="relative z-10 pb-6 border-b border-[var(--border-default)]">
            <h1 className="text-3xl font-bold tracking-tight text-[var(--text-primary)] mb-2">
              Chatbot IA Facebook
            </h1>
            <p className="text-lg text-[var(--text-muted)] mb-6">
              Connectez et configurez votre page Facebook Messenger.
            </p>

            {/* -- Activation status banner -- */}
            {!activationLoading && activationBanner && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className={`mb-4 rounded-xl border px-5 py-4 ${
                  activationBanner.color === "red"
                    ? "border-red-500/30 bg-red-500/10"
                    : activationBanner.color === "navy"
                    ? "border-navy-500/25 bg-navy-500/10"
                    : "border-orange-500/30 bg-orange-500/10"
                }`}
              >
                <p className={`text-sm font-semibold ${
                  activationBanner.color === "red" ? "text-red-300" :
                  activationBanner.color === "navy" ? "text-[var(--accent-navy)] dark:text-[rgb(183,203,255)]" :
                  "text-orange-600 dark:text-orange-300"
                }`}>
                  {activationBanner.label}
                </p>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">{activationBanner.description}</p>
                {activationBanner.cta && (
                  <button
                    type="button"
                    onClick={() => {
                      if (activationBanner.cta?.action) {
                        activationBanner.cta.action();
                        return;
                      }
                      if (activationBanner.cta?.navTarget) {
                        onPush(activationBanner.cta.navTarget);
                      }
                    }}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-default)] bg-[var(--surface-subtle)] px-4 py-2 text-sm font-medium text-[var(--text-primary)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-raised)] transition-colors"
                  >
                    {activationBanner.cta.label}
                  </button>
                )}
              </motion.div>
            )}
            {!activationLoading && (currentPlanId || activationRequest?.applied_plan_id) && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-4 rounded-xl border border-[var(--border-default)] bg-[var(--surface-subtle)] px-5 py-4"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--text-secondary)]">
                    Plan actif
                  </span>
                  <span className="rounded-full bg-orange-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-orange-500">
                    {currentPlanLabel}
                  </span>
                  {activationRequest?.selected_plan_id && (
                    <span className="rounded-full bg-[var(--bg-card)] px-2.5 py-0.5 text-[11px] font-medium text-[var(--text-secondary)]">
                      Demande: {activationRequest.selected_plan_id}
                    </span>
                  )}
                  {activationRequest?.subscription_status && (
                    <span className="rounded-full bg-[var(--bg-card)] px-2.5 py-0.5 text-[11px] font-medium text-[var(--text-secondary)]">
                      Abonnement: {activationRequest.subscription_status}
                    </span>
                  )}
                </div>
                <p className="mt-2 text-sm text-[var(--text-secondary)]">
                  Le plan applique par FLARE s&apos;affiche ici apres validation du paiement.
                </p>
              </motion.div>
            )}

            {feedback ? (
              <div
                role="status"
                className={`mb-4 rounded-xl border px-4 py-3 text-sm ${
                  feedback.tone === "success"
                    ? "border-navy-500/25 bg-navy-500/10 text-[var(--accent-navy)] dark:text-[rgb(183,203,255)]"
                    : feedback.tone === "warning"
                    ? "border-orange-500/25 bg-orange-500/10 text-orange-600 dark:text-orange-300"
                    : feedback.tone === "error"
                    ? "border-red-500/25 bg-red-500/10 text-red-300"
                    : "border-[var(--border-default)] bg-[var(--surface-subtle)] text-[var(--text-primary)]"
                }`}
              >
                {feedback.message}
              </div>
            ) : null}

            {/* Guide d'onboarding - visible tant qu'aucune page n'est activee */}
            {showOnboarding && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-4 rounded-2xl border border-[var(--border-default)] bg-[var(--surface-base)] p-5"
              >
                <div className="mb-4 flex items-center gap-2">
                  <Bot size={18} className="text-orange-400" />
                  <p className="text-sm font-semibold text-[var(--text-primary)]">Mise en route - {completedSteps}/{onboardingSteps.length} etapes</p>
                </div>
                <div className="flex flex-col gap-3">
                  {onboardingSteps.map((step, i) => (
                    <div key={i} className="flex items-center gap-3">
                      {step.done ? (
                        <CheckCircle2 size={18} className="shrink-0 text-[var(--accent-navy)] dark:text-[rgb(183,203,255)]" />
                      ) : (
                        <Circle size={18} className="shrink-0 text-[var(--text-muted)]" />
                      )}
                      <span className={`text-sm flex-1 ${step.done ? "text-[var(--text-secondary)] line-through" : "text-[var(--text-primary)]"}`}>
                        {i + 1}. {step.label}
                      </span>
                      {!step.done && step.action && (
                        <button
                          type="button"
                          onClick={step.action}
                          disabled={fbOauthBusy}
                          className="shrink-0 rounded-full bg-orange-500/15 px-3 py-1 text-xs font-semibold text-orange-500 ring-1 ring-orange-500/20 hover:bg-orange-500/25 transition-colors"
                        >
                          {step.actionLabel}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* PageSelector visible for any account member */}
            {canAccessChatbot && (
              <PageSelector
                pages={pages}
                selectedPageId={selectedPageId}
                onSelect={(pid) => onSelectPage?.(pid)}
                onConnectMetaPages={() => void handleConnectMetaPages()}
                onSyncPagesList={pages.length > 0 && canManageFb ? () => void handleSyncPagesList() : undefined}
                connectMetaBusy={fbOauthBusy}
                syncListBusy={pagesRefreshBusy}
                onActivatePage={handleActivatePage}
                onDeactivatePage={handleDeactivatePage}
                onRemovePage={handleRemovePage}
                canManagePages={canManageFb}
                busyPageId={fbBusyPageId}
                authDebug={facebookAuthDebug}
              />
            )}
          </div>
        </motion.div>

        {canAccessChatbot && !hasPageSelected && pages.length > 0 && (
           <div className="text-center p-4 text-orange-500 bg-orange-500/10 rounded-xl border border-orange-500/20">
             Veuillez selectionner une page ci-dessus pour configurer son chatbot.
           </div>
        )}

        {/* -- Apercu KPIs (Si page selectionnee) -- */}
        {canAccessChatbot && hasPageSelected && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="grid grid-cols-1 md:grid-cols-3 gap-4"
          >
            {/* Statut (aligne spec + donnees reelles overview) */}
            <motion.div
              whileHover={{ scale: 1.02 }}
                className="flex items-center justify-between rounded-2xl border border-[var(--border-default)] bg-[var(--surface-base)] p-4"
            >
              <div>
                <p className="text-sm font-medium text-[var(--text-muted)]">Statut chatbot</p>
                <div className="flex items-center gap-2 mt-1">
                  {loadingKPIs ? (
                    <div className="h-6 w-24 rounded-md animate-pulse bg-[var(--surface-raised)]" />
                  ) : (
                    <>
                      <span className="relative flex h-3 w-3">
                        {botFullyLive ? (
                          <>
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-navy-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-navy-500" />
                          </>
                        ) : (
                          <span className="relative inline-flex rounded-full h-3 w-3 bg-orange-400" />
                        )}
                      </span>
                      <p className="text-lg font-bold text-[var(--text-primary)]">{botFullyLive ? "Bot ON" : "Bot OFF"}</p>
                    </>
                  )}
                </div>
              </div>
              <div
                className={`p-2.5 rounded-xl ${
                  botFullyLive ? "bg-navy-500/10 text-[var(--accent-navy)] dark:text-[rgb(183,203,255)]" : "bg-orange-500/10 text-orange-500"
                }`}
              >
                <Bot size={20} />
              </div>
            </motion.div>

            {/* Messages */}
            <motion.div
              whileHover={{ scale: 1.02 }}
                className="flex items-center justify-between rounded-2xl border border-[var(--border-default)] bg-[var(--surface-base)] p-4"
            >
              <div>
                <p className="text-sm font-medium text-[var(--text-muted)]">Messages traites</p>
                <div className="mt-1 h-7 flex items-center">
                  {loadingKPIs ? (
                    <div className="h-6 w-16 rounded-md animate-pulse bg-[var(--surface-raised)]" />
                  ) : (
                    <p className="text-lg font-bold text-[var(--text-primary)]">{messagesTraites}</p>
                  )}
                </div>
              </div>
              <div className="bg-navy-500/10 text-[var(--accent-navy)] dark:text-[rgb(183,203,255)] p-2.5 rounded-xl">
                <MessageSquare size={20} />
              </div>
            </motion.div>

            {/* Contacts */}
            <motion.div
              whileHover={{ scale: 1.02 }}
                className="flex items-center justify-between rounded-2xl border border-[var(--border-default)] bg-[var(--surface-base)] p-4"
            >
              <div>
                <p className="text-sm font-medium text-[var(--text-muted)]">Contacts captes</p>
                <div className="mt-1 h-7 flex items-center">
                  {loadingKPIs ? (
                    <div className="h-6 w-16 rounded-md animate-pulse bg-[var(--surface-raised)] md:w-20" />
                  ) : (
                    <p className="text-lg font-bold text-[var(--text-primary)]">{contactsCaptes}</p>
                  )}
                </div>
              </div>
              <div className="bg-orange-500/10 text-orange-500 p-2.5 rounded-xl">
                <Users size={20} />
              </div>
            </motion.div>
          </motion.div>
        )}
        {canAccessChatbot && hasPageSelected && lastKpiUpdate && !loadingKPIs && (
          <p className="text-sm text-[var(--text-muted)] -mt-4">
            Donnees synchronisees avec le serveur - actualisation automatique toutes les{" "}
            {Math.round(KPI_POLL_INTERVAL_MS / 1000)} s
          </p>
        )}

        {/* -- Entry cards (only when activation is active) -- */}
        <div className={`grid grid-cols-1 gap-4 sm:grid-cols-2 transition-opacity duration-300 ${!canAccessChatbot ? 'opacity-40 pointer-events-none' : 'opacity-100'}`} role="list" aria-label="Sections du Chatbot IA">
          {ENTRIES.map((entry, idx) => {
            const Icon = entry.icon;
            const isClientsCard = entry.id === "chatbot-clients";

            return (
              <motion.div
                key={entry.id}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.06 + idx * 0.07, ease: [0.16, 1, 0.3, 1] }}
                role="listitem"
              >
                <PlatformCard
                  icon={
                    <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${entry.iconBg}`}>
                      <Icon size={20} strokeWidth={1.8} className={entry.iconColor} />
                    </div>
                  }
                  label={entry.label}
                  description={entry.description}
                  locked={false}
                  glowColor="#FF7C1A"
                  badge={
                    isClientsCard && alertCount > 0 ? <NotifBadge count={alertCount} /> : undefined
                  }
                  onClick={() => onPush(entry.id)}
                />
              </motion.div>
            );
          })}
        </div>

      </div>
    </div>
  );
}



