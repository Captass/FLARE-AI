"use client";

import { motion } from "framer-motion";
import { Brush, SlidersHorizontal, BarChart3, Users, Loader2, MessageSquare, Bot } from "lucide-react";
import PlatformCard, { NotifBadge } from "@/components/PlatformCard";
import type { NavLevel } from "@/components/NavBreadcrumb";
import PageSelector from "@/components/PageSelector";
import {
  loadFacebookMessengerStatus,
  activateFacebookMessengerPage,
  resyncFacebookMessengerPages,
  loadFacebookAuthDebugInfo,
  META_PUBLIC_ACCESS_BLOCKED_MESSAGE,
  runFacebookMessengerOAuthPopup,
  type FacebookAuthDebugInfo,
  type FacebookMessengerPage,
} from "@/lib/facebookMessenger";

import { useState, useEffect, useCallback } from "react";
import { loadMessengerDashboardData, type MessengerDashboardData } from "@/lib/messengerDirect";
import { getChatbotOverview, type ChatbotOverview, getMyActivationRequest, type ActivationRequest, getBillingFeatures } from "@/lib/api";
import { KPI_POLL_INTERVAL_MS } from "@/lib/kpiPolling";
import type { ChatbotSetupStatus } from "@/lib/chatbotSetup";
import { ShoppingBag, CheckCircle2, Circle } from "lucide-react";

interface ChatbotHomePageProps {
  token?: string | null;
  getFreshToken?: (forceRefresh?: boolean) => Promise<string | null>;
  currentScopeType?: "personal" | "organization";
  currentUserRole?: string | null;
  onPush: (level: NavLevel) => void;
  /** Nombre de conversations necessitant une intervention humaine */
  pendingHumanCount?: number;
  pages?: FacebookMessengerPage[];
  selectedPageId?: string | null;
  onSelectPage?: (pageId: string) => void;
  /** Remonte la liste des pages (aprÃ¨s OAuth ou activation) vers page.tsx */
  onPagesChanged?: (pages: FacebookMessengerPage[]) => void;
  /** Statut du parcours d'installation (connexion -> preferences) */
  setupStatus?: ChatbotSetupStatus | null;
  onRefreshSetupStatus?: () => Promise<ChatbotSetupStatus | null>;
  onRequestOrganizationSelection?: () => void;
}

const ENTRIES = [
  {
    id: "chatbot-personnalisation" as NavLevel,
    label: "Personnalisation",
    description: "Identite, ton, langue, entreprise et offres du bot",
    icon: Brush,
    iconColor: "text-purple-400",
    iconBg: "bg-purple-500/12",
  },
  {
    id: "chatbot-parametres" as NavLevel,
    label: "Parametres",
    description: "Catalogue, portfolio et connexion Facebook",
    icon: SlidersHorizontal,
    iconColor: "text-cyan-400",
    iconBg: "bg-cyan-500/12",
  },
  {
    id: "chatbot-dashboard" as NavLevel,
    label: "Tableau de bord",
    description: "Stats, statut d'activite et verification Facebook",
    icon: BarChart3,
    iconColor: "text-emerald-400",
    iconBg: "bg-emerald-500/12",
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
    iconColor: "text-amber-400",
    iconBg: "bg-amber-500/12",
  },
];

const META_BLOCKER_ALERT =
  "Facebook a bloque la connexion avant le retour vers FLARE. Si la popup affiche 'Fonctionnalite indisponible', le blocage vient de l'app Meta et non de votre espace FLARE.";

type ActivationBanner = {
  label: string;
  description: string;
  color: "orange" | "blue" | "emerald" | "red" | "amber";
  cta?: { label: string; navTarget: NavLevel };
};

function getActivationBanner(
  scopeType: "personal" | "organization",
  planId: string | null,
  ar: ActivationRequest | null,
): ActivationBanner | null {
  if (scopeType !== "organization") {
    return {
      label: "Creez votre espace",
      description: "Creez ou choisissez un espace de travail pour activer votre chatbot.",
      color: "orange",
    };
  }
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
      color: "amber",
      cta: { label: "Payer", navTarget: "chatbot-activation" as NavLevel },
    };
  }
  if (s === "payment_submitted") {
    return {
      label: "Preuve recue, verification en cours",
      description: "Notre equipe verifie votre paiement. Vous serez notifie des que c'est valide.",
      color: "blue",
    };
  }
  if (s === "payment_verified" || s === "awaiting_flare_page_admin_access") {
    return {
      label: "Ajoutez FLARE comme admin page",
      description: "Ajoutez le compte FLARE comme administrateur de votre page Facebook pour finaliser l'activation.",
      color: "amber",
      cta: { label: "Confirmer l'acces", navTarget: "chatbot-activation" as NavLevel },
    };
  }
  if (s === "queued_for_activation" || s === "activation_in_progress" || s === "testing") {
    return {
      label: "Activation en cours",
      description: "Notre equipe configure votre chatbot. Vous serez notifie des qu'il est pret.",
      color: "blue",
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
  currentScopeType = "personal",
  currentUserRole = null,
  onPush,
  pendingHumanCount = 0,
  pages = [],
  selectedPageId = null,
  onSelectPage,
  onPagesChanged,
  setupStatus = null,
  onRefreshSetupStatus,
  onRequestOrganizationSelection,
}: ChatbotHomePageProps) {
  const [activationRequest, setActivationRequest] = useState<ActivationRequest | null>(null);
  const [currentPlanId, setCurrentPlanId] = useState<string | null>(null);
  const [activationLoading, setActivationLoading] = useState(true);

  // L'acces aux fonctionnalites chatbot est ouvert des qu'on est dans une organisation
  // L'activation tunnel reste informative mais ne bloque plus l'UI
  const canAccessChatbot = currentScopeType === "organization";

  const hasPageSelected = Boolean(selectedPageId && pages.some((page) => page.page_id === selectedPageId));
  const [dashData, setDashData] = useState<MessengerDashboardData | null>(null);
  const [overview, setOverview] = useState<ChatbotOverview | null>(null);
  const [loadingKPIs, setLoadingKPIs] = useState(false);
  const [lastKpiUpdate, setLastKpiUpdate] = useState<Date | null>(null);
  const [canManageFb, setCanManageFb] = useState(false);
  const [fbBusyPageId, setFbBusyPageId] = useState<string | null>(null);
  const [pagesRefreshBusy, setPagesRefreshBusy] = useState(false);
  const [fbOauthBusy, setFbOauthBusy] = useState(false);
  const [activationNotice, setActivationNotice] = useState<string | null>(null);
  const [facebookAuthDebug, setFacebookAuthDebug] = useState<FacebookAuthDebugInfo | null>(null);

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
    const normalizedRole = String(currentUserRole || "").toLowerCase();
    const canInspectMeta = currentScopeType === "organization" && (canManageFb || ["owner", "admin"].includes(normalizedRole));

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
  }, [canManageFb, currentScopeType, currentUserRole, resolveToken]);

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
        setActivationNotice(
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
        window.setTimeout(() => setActivationNotice(null), 12000);
      } catch (e) {
        console.error(e);
        const msg =
          e instanceof Error
            ? e.message
            : "Activation impossible. Ouvrez Parametres et reconnectez Facebook si le probleme continue.";
        alert(msg);
      } finally {
        setFbBusyPageId(null);
      }
    },
    [resolveToken, canManageFb, onPagesChanged, onSelectPage, selectedPageId]
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
        alert(msg);
      } finally {
        setFbBusyPageId(null);
      }
    },
    [resolveToken, canManageFb, onPagesChanged]
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
        alert(msg);
      } finally {
        setFbBusyPageId(null);
      }
    },
    [resolveToken, canManageFb, onPagesChanged, selectedPageId, onSelectPage]
  );

  const handleConnectMetaPages = useCallback(async () => {
    if (currentScopeType !== "organization") {
      alert("Creez ou choisissez d'abord votre espace de travail pour connecter Facebook.");
      onRequestOrganizationSelection?.();
      return;
    }

    const normalizedRole = String(currentUserRole || "").toLowerCase();
    if (!canManageFb && normalizedRole && !["owner", "admin"].includes(normalizedRole)) {
      alert("Seuls le proprietaire ou un admin de cet espace peuvent connecter Facebook.");
      return;
    }

    const t = await resolveToken();
    if (!t) {
      alert("Session expiree. Reconnectez-vous a FLARE.");
      return;
    }
    setFbOauthBusy(true);
    try {
      await runFacebookMessengerOAuthPopup(t);
      const st = await loadFacebookMessengerStatus(t);
      setCanManageFb(st.can_manage_pages);
      onPagesChanged?.(st.pages || []);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Connexion Meta interrompue.";
      if (/organisation|espace|scope|selectionnez d'abord/i.test(msg)) {
        onRequestOrganizationSelection?.();
      }
      if (/403|forbidden|permission|owner|admin/i.test(msg)) {
        alert("Seuls le proprietaire ou un admin de cet espace peuvent connecter Facebook.");
        return;
      }
      if (msg === META_PUBLIC_ACCESS_BLOCKED_MESSAGE) {
        alert(META_BLOCKER_ALERT);
        return;
      }
      alert(msg);
    } finally {
      setFbOauthBusy(false);
    }
  }, [canManageFb, currentScopeType, currentUserRole, onPagesChanged, onRequestOrganizationSelection, resolveToken]);

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
        alert(
          `${msg}\n\nUtilisez le bouton "Ouvrir Meta" pour rouvrir Facebook et renouveler l'autorisation.`
        );
      } else {
        alert(msg || "Impossible d'actualiser la liste des pages.");
      }
    } finally {
      setPagesRefreshBusy(false);
    }
  }, [resolveToken, canManageFb, onPagesChanged]);

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

  const activationBanner = getActivationBanner(currentScopeType, currentPlanId, activationRequest);

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

        {/* â"€â"€ Header & Page Selector â"€â"€ */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col gap-6 relative"
        >
          <div className="relative z-10 pb-6 border-b border-white/[0.04]">
            <h1 className="text-3xl font-bold tracking-tight text-fg/90 mb-2">
              Chatbot IA Facebook
            </h1>
            <p className="text-lg text-[var(--text-muted)] mb-6">
              {canAccessChatbot
                ? "Connectez et configurez votre page Facebook Messenger."
                : "Creez un espace de travail pour commencer."}
            </p>

            {/* ── Activation status banner ── */}
            {!activationLoading && activationBanner && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className={`mb-4 rounded-xl border px-5 py-4 ${
                  activationBanner.color === "red"
                    ? "border-red-500/30 bg-red-500/10"
                    : activationBanner.color === "blue"
                    ? "border-blue-500/30 bg-blue-500/10"
                    : activationBanner.color === "emerald"
                    ? "border-emerald-500/30 bg-emerald-500/10"
                    : activationBanner.color === "amber"
                    ? "border-amber-500/30 bg-amber-500/10"
                    : "border-orange-500/30 bg-orange-500/10"
                }`}
              >
                <p className={`text-sm font-semibold ${
                  activationBanner.color === "red" ? "text-red-300" :
                  activationBanner.color === "blue" ? "text-blue-300" :
                  activationBanner.color === "emerald" ? "text-emerald-300" :
                  activationBanner.color === "amber" ? "text-amber-300" :
                  "text-orange-300"
                }`}>
                  {activationBanner.label}
                </p>
                <p className="mt-1 text-sm text-fg/60">{activationBanner.description}</p>
                {activationBanner.cta && (
                  <button
                    type="button"
                    onClick={() => onPush(activationBanner.cta!.navTarget)}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-fg/90 hover:bg-white/15 transition-colors"
                  >
                    {activationBanner.cta.label}
                  </button>
                )}
              </motion.div>
            )}

            {activationNotice ? (
              <div
                role="status"
                className="mb-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100/90"
              >
                {activationNotice}
              </div>
            ) : null}

            {/* Guide d'onboarding - visible tant qu'aucune page n'est activee */}
            {showOnboarding && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-4 rounded-2xl border border-fg/[0.08] bg-fg/[0.02] p-5"
              >
                <div className="flex items-center gap-2 mb-4">
                  <Bot size={18} className="text-orange-400" />
                  <p className="text-sm font-semibold text-fg/80">Mise en route — {completedSteps}/{onboardingSteps.length} etapes</p>
                </div>
                <div className="flex flex-col gap-3">
                  {onboardingSteps.map((step, i) => (
                    <div key={i} className="flex items-center gap-3">
                      {step.done ? (
                        <CheckCircle2 size={18} className="shrink-0 text-emerald-400" />
                      ) : (
                        <Circle size={18} className="shrink-0 text-fg/20" />
                      )}
                      <span className={`text-sm flex-1 ${step.done ? "text-fg/50 line-through" : "text-fg/80"}`}>
                        {i + 1}. {step.label}
                      </span>
                      {!step.done && step.action && (
                        <button
                          type="button"
                          onClick={step.action}
                          disabled={fbOauthBusy}
                          className="shrink-0 rounded-full bg-orange-500/15 px-3 py-1 text-xs font-semibold text-orange-300 ring-1 ring-orange-500/20 hover:bg-orange-500/25 transition-colors"
                        >
                          {step.actionLabel}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* PageSelector visible for any organization member */}
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
           <div className="text-center p-4 text-orange-400/80 bg-orange-500/10 rounded-xl border border-orange-500/20">
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
              className="p-4 rounded-2xl border border-fg/[0.08] bg-[var(--bg-glass)] backdrop-blur-md shadow-[var(--shadow-card)] flex items-center justify-between"
            >
              <div>
                <p className="text-sm font-medium text-[var(--text-muted)]">Statut chatbot</p>
                <div className="flex items-center gap-2 mt-1">
                  {loadingKPIs ? (
                    <div className="h-6 w-24 bg-white/[0.06] rounded-md animate-pulse" />
                  ) : (
                    <>
                      <span className="relative flex h-3 w-3">
                        {botFullyLive ? (
                          <>
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
                          </>
                        ) : (
                          <span className="relative inline-flex rounded-full h-3 w-3 bg-orange-400" />
                        )}
                      </span>
                      <p className="text-lg font-bold text-fg/90">{botFullyLive ? "Bot ON" : "Bot OFF"}</p>
                    </>
                  )}
                </div>
              </div>
              <div
                className={`p-2.5 rounded-xl ${
                  botFullyLive ? "bg-emerald-500/10 text-emerald-400" : "bg-orange-500/10 text-orange-400"
                }`}
              >
                <Bot size={20} />
              </div>
            </motion.div>

            {/* Messages */}
            <motion.div
              whileHover={{ scale: 1.02 }}
              className="p-4 rounded-2xl border border-fg/[0.08] bg-[var(--bg-glass)] backdrop-blur-md shadow-[var(--shadow-card)] flex items-center justify-between"
            >
              <div>
                <p className="text-sm font-medium text-[var(--text-muted)]">Messages traites</p>
                <div className="mt-1 h-7 flex items-center">
                  {loadingKPIs ? (
                    <div className="h-6 w-16 bg-white/[0.06] rounded-md animate-pulse" />
                  ) : (
                    <p className="text-lg font-bold text-fg/90">{messagesTraites}</p>
                  )}
                </div>
              </div>
              <div className="bg-blue-500/10 text-blue-400 p-2.5 rounded-xl">
                <MessageSquare size={20} />
              </div>
            </motion.div>

            {/* Contacts */}
            <motion.div
              whileHover={{ scale: 1.02 }}
              className="p-4 rounded-2xl border border-fg/[0.08] bg-[var(--bg-glass)] backdrop-blur-md shadow-[var(--shadow-card)] flex items-center justify-between"
            >
              <div>
                <p className="text-sm font-medium text-[var(--text-muted)]">Contacts captes</p>
                <div className="mt-1 h-7 flex items-center">
                  {loadingKPIs ? (
                    <div className="h-6 w-16 bg-white/[0.06] rounded-md animate-pulse md:w-20" />
                  ) : (
                    <p className="text-lg font-bold text-fg/90">{contactsCaptes}</p>
                  )}
                </div>
              </div>
              <div className="bg-orange-500/10 text-orange-400 p-2.5 rounded-xl">
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

        {/* ── Entry cards (only when activation is active) ── */}
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


