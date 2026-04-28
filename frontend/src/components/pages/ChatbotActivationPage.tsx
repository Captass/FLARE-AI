"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2,
  CreditCard,
  Facebook,
  Clock,
  ArrowLeft,
  ArrowRight,
  Loader2,
  Upload,
  Copy,
  Check,
  MessageSquare,
  Zap,
  Crown,
  Mail,
  Bot,
  Building2,
  BriefcaseBusiness,
  ExternalLink,
  Lock,
} from "lucide-react";
import type { NavLevel } from "@/components/NavBreadcrumb";
import {
  consumeFacebookMessengerAuthResult,
  loadFacebookMessengerStatus,
  META_PUBLIC_ACCESS_BLOCKED_MESSAGE,
  resyncFacebookMessengerPages,
  runFacebookMessengerOAuth,
  type FacebookMessengerPage,
} from "@/lib/facebookMessenger";
import {
  getAssistedLaunchConfig,
  getMyActivationRequest,
  type ActivationRequest,
  createActivationRequest,
  updateActivationRequest,
  getManualPaymentMethods,
  type PaymentMethod,
  submitManualPayment,
  type ManualPaymentData,
} from "@/lib/api";
import {
  clearRememberedActivationPlan,
  readRememberedActivationPlan,
  type ActivationPlanId,
} from "@/lib/activationFlow";

// ---------------------------------------------------------------------------
// Error parsing helper
// ---------------------------------------------------------------------------

/** Extrait le message lisible depuis une erreur API (qui peut etre du JSON brut). */
function parseApiError(e: unknown, fallback = "Une erreur est survenue."): string {
  if (!(e instanceof Error)) return fallback;
  const raw = e.message.trim();
  // Handle AbortController / Timeout errors gracefully
  if (
    (e as { name?: string }).name === "AbortError" ||
    raw.toLowerCase().includes("signal is aborted") ||
    raw.toLowerCase().includes("timeout")
  ) {
    return "Le serveur met trop de temps a repondre. Verifiez votre connexion et reessayez.";
  }
  // try JSON parse to extract FastAPI { "detail": "..." }
  if (raw.startsWith("{") || raw.startsWith("[")) {
    try {
      const parsed = JSON.parse(raw);
      if (typeof parsed?.detail === "string") return parsed.detail;
      if (Array.isArray(parsed?.detail)) {
        // pydantic validation errors array
        return parsed.detail.map((d: { msg?: string }) => d.msg ?? "").filter(Boolean).join(", ") || fallback;
      }
    } catch { /* not json */ }
  }
  return raw || fallback;
}
export interface ActivationContextPage {
  page_id: string;
  page_name: string;
  is_active: boolean;
}

export interface ActivationPageContext {
  imported_pages: ActivationContextPage[];
  selected_page_id: string | null;
  target_page_id: string | null;
  target_page_name: string | null;
  target_page_url: string | null;
}

function normalizePageList(pages: unknown[]): ActivationContextPage[] {
  if (!Array.isArray(pages)) return [];
  return pages.map((p: any) => ({
    page_id: String(p.page_id || ""),
    page_name: String(p.page_name || ""),
    is_active: Boolean(p.is_active),
  })).filter(p => p.page_id);
}

function getSnapshotSelectedPageId(
  pages: ActivationContextPage[],
  candidates: (string | null | undefined)[]
): string | null {
  for (const c of candidates) {
    if (c && pages.some((p) => p.page_id === c)) return c;
  }
  return getDefaultSelectedPageId(pages);
}

function getDefaultSelectedPageId(pages: ActivationContextPage[]): string | null {
  const active = pages.find((page) => page.is_active);
  if (active) return active.page_id;
  return pages[0]?.page_id ?? null;
}

function getDefaultTargetPageId(
  pages: ActivationContextPage[],
  selectedPageId?: string | null,
  context?: ActivationPageContext | null
): string {
  if (context?.target_page_id && pages.some((p) => p.page_id === context.target_page_id)) {
    return context.target_page_id;
  }
  if (selectedPageId && pages.some((p) => p.page_id === selectedPageId)) {
    return selectedPageId;
  }
  const active = pages.find((p) => p.is_active);
  if (active) {
    return active.page_id;
  }
  return pages[0]?.page_id ?? "";
}

// ---------------------------------------------------------------------------
// Types & constants
// ---------------------------------------------------------------------------

interface ChatbotActivationPageProps {
  token?: string | null;
  getFreshToken?: (forceRefresh?: boolean) => Promise<string | null>;
  onPush: (level: NavLevel) => void;
  availablePages?: FacebookMessengerPage[];
  selectedPageId?: string | null;
  onPagesChanged?: (pages: FacebookMessengerPage[]) => void;
}

type ActivationModule = "chatbot" | "executive-desk" | "business-desk" | "enterprise-desk";

type WizardStep =
  | "choose_module"
  | "choose_plan"
  | "payment"
  | "config"
  | "flare_admin"
  | "awaiting"
  | "desk_activation"
  | "desk_ready";

const CHATBOT_STEP_ORDER: WizardStep[] = [
  "choose_module",
  "choose_plan",
  "payment",
  "config",
  "flare_admin",
  "awaiting",
];

const DESK_STEP_ORDER: WizardStep[] = [
  "choose_module",
  "choose_plan",
  "payment",
  "desk_activation",
  "desk_ready",
];

const STEP_LABELS: Record<WizardStep, string> = {
  choose_module: "Module",
  choose_plan: "Offre",
  payment: "Paiement",
  config: "Facebook",
  flare_admin: "Autorisation",
  awaiting: "Activation",
  desk_activation: "Connexion Gmail",
  desk_ready: "Prêt",
};

const PLANS: Array<{
  id: ActivationPlanId | "enterprise";
  name: string;
  price: string;
  subtitle: string;
  highlight: boolean;
  contact?: boolean;
  cta: string;
  features: string[];
}> = [
  {
    id: "starter",
    name: "Starter",
    price: "30 000",
    subtitle: "Boutique · Artisan · Indépendant",
    highlight: false,
    cta: "Commencer",
    features: [
      "500 messages / mois",
      "1 page Facebook",
      "Chatbot IA 24h/24",
      "Catalogue limité à 10 articles",
      "Support par email",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    price: "60 000",
    subtitle: "Commerce actif · Plusieurs produits",
    highlight: true,
    cta: "Choisir Pro",
    features: [
      "2 000 messages / mois",
      "1 page Facebook",
      "IA Vendeuse (Raisonnement)",
      "Catalogue jusqu'à 50 articles",
      "Script de vente IA inclus",
      "Gestion des commandes",
      "Support prioritaire",
    ],
  },
  {
    id: "business",
    name: "Business",
    price: "120 000",
    subtitle: "PME · Équipe commerciale",
    highlight: false,
    cta: "Choisir Business",
    features: [
      "5 000 messages / mois",
      "Multi-pages Facebook",
      "IA Premium & avancée",
      "Catalogue étendu (500 articles)",
      "Rôles & permissions équipe",
      "Analytics avancés",
      "Support dédié",
    ],
  },
];

const DESK_PLANS: Array<{
  id: string;
  name: string;
  price: string;
  subtitle: string;
  highlight: boolean;
  cta: string;
  features: string[];
}> = [
  {
    id: "desk-essentiel",
    name: "Essentiel",
    price: "25 000",
    subtitle: "Indépendant · Freelance",
    highlight: false,
    cta: "Commencer",
    features: [
      "Assistant Mail IA",
      "Tri automatique des emails",
      "1 compte Gmail connecté",
      "Support par email",
    ],
  },
  {
    id: "desk-pro",
    name: "Pro",
    price: "50 000",
    subtitle: "PME · Équipe active",
    highlight: true,
    cta: "Choisir Pro",
    features: [
      "Assistant Mail IA avancé",
      "Planning Intelligent",
      "Contacts Stratégiques",
      "3 comptes Gmail",
      "Support prioritaire",
    ],
  },
  {
    id: "desk-integral",
    name: "Intégral",
    price: "90 000",
    subtitle: "Direction · Multi-équipes",
    highlight: false,
    cta: "Choisir Intégral",
    features: [
      "Tous les modules Desk",
      "Organisation Fichiers IA",
      "Comptes Gmail illimités",
      "Analytics et reporting",
      "Support dédié",
    ],
  },
];

const ACTIVATION_MODULES: Array<{
  id: ActivationModule;
  label: string;
  description: string;
  icon: typeof Crown;
  locked: boolean;
  badge?: string;
}> = [
  {
    id: "chatbot",
    label: "Chatbot Facebook",
    description: "Chatbot IA automatisé sur Messenger avec vente, leads et support.",
    icon: Bot,
    locked: false,
    badge: "Actif",
  },
  {
    id: "executive-desk",
    label: "Executive Desk",
    description: "Assistant Mail, Planning, Contacts et Fichiers via Google.",
    icon: Crown,
    locked: false,
    badge: "Nouveau",
  },
  {
    id: "business-desk",
    label: "Business Desk",
    description: "CRM, leads, ventes et relation client automatisés.",
    icon: BriefcaseBusiness,
    locked: true,
    badge: "Bientôt",
  },
  {
    id: "enterprise-desk",
    label: "Enterprise Desk",
    description: "Demandes internes, base documentaire et reporting.",
    icon: Building2,
    locked: true,
    badge: "Bientôt",
  },
];

const PLAN_PRICES: Record<string, string> = {
  starter: "30 000",
  pro: "60 000",
  business: "120 000",
  enterprise: "Sur devis",
  "desk-essentiel": "25 000",
  "desk-pro": "50 000",
  "desk-integral": "90 000",
};

const DEFAULT_PAYMENT_METHODS: PaymentMethod[] = [
  {
    code: "mvola",
    label: "MVola",
    recipient_name: "FLARE AI",
    recipient_number: "034 02 107 31",
    instructions:
      "Envoyez le montant exact via MVola au numero ci-dessus, puis saisissez la reference de transaction generee.",
    currency: "MGA",
  },
  {
    code: "orange_money",
    label: "Orange Money",
    recipient_name: "FLARE AI",
    recipient_number: "034 02 107 31",
    instructions:
      "Envoyez le montant exact via Orange Money au numero ci-dessus, puis saisissez la reference de transaction generee.",
    currency: "MGA",
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const glass =
  "rounded-2xl border border-[var(--border-default)] bg-[var(--surface-base)] shadow-[var(--shadow-card)]";

function stepIndexOf(s: WizardStep, order: WizardStep[]): number {
  return order.indexOf(s);
}

function statusToStep(ar: any): WizardStep {
  if (!ar) return "choose_module";

  const status = ar.status;

  if (["draft", "awaiting_payment", "rejected"].includes(status)) {
    return "payment";
  }

  if (["payment_submitted", "payment_verified", "awaiting_flare_page_admin_access"].includes(status)) {
    if (ar.flare_page_admin_confirmed === "true") {
      return "awaiting";
    }
    if (ar.activation_target_page_id) {
      return "flare_admin";
    }
    return "config";
  }

  return "awaiting";
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StepIndicator({
  current,
  completed,
  steps,
}: {
  current: WizardStep;
  completed: WizardStep[];
  steps: WizardStep[];
}) {
  const currentIdx = steps.indexOf(current);

  return (
    <div className="flex items-center justify-center gap-3 mb-8">
      {steps.map((step, idx) => {
        const isDone = completed.includes(step) && idx < currentIdx;
        const isCurrent = step === current;
        return (
          <div key={step} className="flex flex-col items-center gap-1.5">
            <div
              className={`h-3 w-3 rounded-full transition-all duration-300 ${
                isCurrent
                  ? "bg-orange-500 ring-4 ring-orange-500/20"
                  : isDone
                  ? "bg-orange-400"
                  : "bg-[var(--surface-raised)]"
              }`}
            />
            <span
              className={`text-[10px] font-medium hidden sm:block ${
                isCurrent
                  ? "text-orange-500"
                  : isDone
                  ? "text-[var(--text-secondary)]"
                  : "text-[var(--text-muted)]"
              }`}
            >
              {STEP_LABELS[step]}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex items-center gap-1 rounded-md border border-[var(--border-default)] bg-[var(--surface-subtle)] px-2 py-1 text-xs text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-raised)]"
    >
      {copied ? <Check size={12} /> : <Copy size={12} />}
      {copied ? "Copie" : "Copier"}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function ChatbotActivationPage({
  token,
  getFreshToken,
  onPush,
  availablePages = [],
  selectedPageId = null,
  onPagesChanged,
}: ChatbotActivationPageProps) {
  // ---- state ----
  const [step, setStep] = useState<WizardStep>("choose_module");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [ar, setAr] = useState<ActivationRequest | null>(null);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);

  // module selection
  const [selectedModule, setSelectedModule] = useState<ActivationModule>("chatbot");

  // plan selection
  const [selectedPlanId, setSelectedPlanId] = useState<ActivationPlanId>("pro");
  const [selectedDeskPlanId, setSelectedDeskPlanId] = useState<string>("desk-pro");

  // dynamic step order
  const isDesk = selectedModule !== "chatbot";
  const stepOrder = isDesk ? DESK_STEP_ORDER : CHATBOT_STEP_ORDER;

  // payment form
  const [payMethodCode, setPayMethodCode] = useState("");
  const [payerName, setPayerName] = useState("");
  const [payerPhone, setPayerPhone] = useState("");
  const [txRef, setTxRef] = useState("");
  const [payNotes, setPayNotes] = useState("");

  // config form
  const [cfg, setCfg] = useState({
    contact_full_name: "",
    contact_email: "",
    contact_phone: "",
    contact_whatsapp: "",
    business_name: "",
    business_sector: "",
    business_city: "",
    business_country: "Madagascar",
    business_description: "",
    facebook_page_name: "",
    facebook_page_url: "",
    facebook_admin_email: "",
    bot_name: "",
    primary_language: "fr",
    tone: "professionnel",
    greeting_message: "",
    offer_summary: "",
    opening_hours: "",
    delivery_zones: "",
    notes_for_flare: "",
  });
  const [pendingTargetPageId, setPendingTargetPageId] = useState<string>("");
  const [persistedPageContext, setPersistedPageContext] = useState<ActivationPageContext | null>(null);
  const [configNotice, setConfigNotice] = useState<{
    tone: "info" | "success" | "warning";
    message: string;
  } | null>(null);
  const [canManageMetaPages, setCanManageMetaPages] = useState(true);
  const [fbOauthBusy, setFbOauthBusy] = useState(false);
  const [pagesRefreshBusy, setPagesRefreshBusy] = useState(false);

  // flare admin
  const [adminConfirmed, setAdminConfirmed] = useState(false);

  // polling ref
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ---- token helper ----
  const resolveToken = useCallback(async (): Promise<string | null> => {
    if (getFreshToken) return await getFreshToken();
    return token ?? null;
  }, [getFreshToken, token]);

  const importedPages = useMemo(
    () => normalizePageList(availablePages),
    [availablePages]
  );

  const targetPageId = pendingTargetPageId;
  const targetPage = useMemo(
    () => importedPages.find((p) => p.page_id === targetPageId) ?? null,
    [importedPages, targetPageId]
  );
  const targetPageUrl = targetPage ? `https://facebook.com/${targetPage.page_id}` : "";
  const pushConfigNotice = useCallback(
    (tone: "info" | "success" | "warning", message: string) => {
      setConfigNotice({ tone, message });
    },
    []
  );
  const clearActivationPageSelection = useCallback(() => {
    onPagesChanged?.([]);
    setPendingTargetPageId("");
    setPersistedPageContext(null);
  }, [onPagesChanged]);
  const reportPagesSyncFailure = useCallback(
    (reason: string) => {
      clearActivationPageSelection();
      pushConfigNotice(
        "warning",
        `${reason} La liste des pages importees a ete videe pour eviter des donnees obsoletes.`
      );
    },
    [clearActivationPageSelection, pushConfigNotice]
  );

  // ---- initial load ----
  useEffect(() => {
    const rememberedPlan = readRememberedActivationPlan();
    if (rememberedPlan) {
      setSelectedPlanId(rememberedPlan);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      setLoading(true);
            const t = await resolveToken();
      if (!t || cancelled) {
        setLoading(false);
        return;
      }

      try {
        const [arRes, lcRes, pmRes, fbRes] = await Promise.allSettled([
          getMyActivationRequest(t),
          getAssistedLaunchConfig(t),
          getManualPaymentMethods(t),
          loadFacebookMessengerStatus(t),
        ]);

        if (cancelled) return;

        const fetchedAr =
          arRes.status === "fulfilled"
            ? arRes.value.activation_request
            : null;
        const fetchedLc =
          lcRes.status === "fulfilled" ? lcRes.value : null;
        const fetchedPm =
          pmRes.status === "fulfilled" ? pmRes.value.methods : [];
        const fetchedFacebookStatus =
          fbRes.status === "fulfilled" ? fbRes.value : null;

      setAr(fetchedAr);
        setCanManageMetaPages(Boolean(fetchedFacebookStatus?.can_manage_pages));
        if (fetchedFacebookStatus?.pages) {
          onPagesChanged?.(fetchedFacebookStatus.pages);
        }
        if (fetchedAr?.selected_plan_id && ["starter", "pro", "business"].includes(fetchedAr.selected_plan_id)) {
          setSelectedPlanId(fetchedAr.selected_plan_id as ActivationPlanId);
          clearRememberedActivationPlan();
        }

        // merge payment methods from launch config + billing endpoint
        const allMethods = [
          ...(fetchedLc?.payment_methods ?? []),
          ...fetchedPm.filter(
            (pm) =>
              !(fetchedLc?.payment_methods ?? []).some(
                (lm) => lm.code === pm.code
              )
          ),
        ];
        const resolvedMethods = allMethods.length > 0 ? allMethods : DEFAULT_PAYMENT_METHODS;
        setPaymentMethods(resolvedMethods);
        if (resolvedMethods.length > 0 && !payMethodCode) {
          setPayMethodCode(resolvedMethods[0].code);
        }

        if (fetchedAr) {
          const fetchedImportedPages = normalizePageList(fetchedAr.selected_facebook_pages || []);
          const fetchedContext: ActivationPageContext = {
            imported_pages: fetchedImportedPages,
            selected_page_id: getSnapshotSelectedPageId(fetchedImportedPages, [
              fetchedAr.flare_selected_page_id_at_submission,
              fetchedAr.activation_target_page_id,
            ]),
            target_page_id: fetchedAr.activation_target_page_id || null,
            target_page_name: fetchedAr.activation_target_page_name || fetchedAr.facebook_page_name || null,
            target_page_url: fetchedAr.facebook_page_url || null,
          };
          setPersistedPageContext(
            fetchedContext.imported_pages.length > 0 || fetchedContext.target_page_id || fetchedContext.target_page_name
              ? fetchedContext
              : null
          );
          setSelectedPlanId((fetchedAr.selected_plan_id as ActivationPlanId) || "pro");
          // pre-fill config form from AR
          setCfg((prev) => ({
            ...prev,
            contact_full_name: fetchedAr.contact_full_name || prev.contact_full_name,
            contact_email: fetchedAr.contact_email || prev.contact_email,
            contact_phone: fetchedAr.contact_phone || prev.contact_phone,
            contact_whatsapp: fetchedAr.contact_whatsapp || prev.contact_whatsapp,
            business_name: fetchedAr.business_name || prev.business_name,
            business_sector: fetchedAr.business_sector || prev.business_sector,
            business_city: fetchedAr.business_city || prev.business_city,
            business_country: fetchedAr.business_country || prev.business_country || "Madagascar",
            business_description: fetchedAr.business_description || prev.business_description,
            facebook_page_name: fetchedAr.facebook_page_name || prev.facebook_page_name,
            facebook_page_url: fetchedAr.facebook_page_url || prev.facebook_page_url,
            facebook_admin_email: fetchedAr.facebook_admin_email || prev.facebook_admin_email,
            bot_name: fetchedAr.bot_name || prev.bot_name,
            primary_language: fetchedAr.primary_language || prev.primary_language || "fr",
            tone: fetchedAr.tone || prev.tone || "professionnel",
            greeting_message: fetchedAr.greeting_message || prev.greeting_message,
            offer_summary: fetchedAr.offer_summary || prev.offer_summary,
            opening_hours: fetchedAr.opening_hours || prev.opening_hours,
            delivery_zones: fetchedAr.delivery_zones || prev.delivery_zones,
            notes_for_flare: fetchedAr.notes_for_flare || prev.notes_for_flare,
          }));
          setPendingTargetPageId(fetchedAr.activation_target_page_id || "");
          setAdminConfirmed(fetchedAr.flare_page_admin_confirmed === "true");

          // jump to correct step
          setStep(statusToStep(fetchedAr));
        }
      } catch (e) {
        console.error("ChatbotActivationPage: init error", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolveToken]);

  useEffect(() => {
    const authResult = consumeFacebookMessengerAuthResult();
    if (!authResult || authResult.provider !== "facebook") {
      return;
    }

    if (authResult.status !== "success") {
      const detail = authResult.detail || "Connexion Meta interrompue.";
      setError(detail);
      reportPagesSyncFailure(detail);
      return;
    }

    setFbOauthBusy(true);
    pushConfigNotice("info", "Connexion Meta terminee. Chargement des pages importees...");

    void (async () => {
      try {
        const t = await resolveToken();
        if (!t) {
          throw new Error("Session expiree. Reconnectez-vous puis reessayez.");
        }
        const st = await loadFacebookMessengerStatus(t);
        setCanManageMetaPages(Boolean(st.can_manage_pages));
        onPagesChanged?.(st.pages || []);
        const normalized = normalizePageList(st.pages || []);
        if (normalized.length > 0) {
          const nextTargetId = getDefaultTargetPageId(normalized, selectedPageId, persistedPageContext);
          if (nextTargetId) {
            setPendingTargetPageId(nextTargetId);
          }
        } else {
          clearActivationPageSelection();
        }
        pushConfigNotice(
          "success",
          normalized.length > 0
            ? "Pages Facebook importees. Selectionnez la page cible pour l'activation."
            : "Aucune page importee pour le moment. Ouvrez Meta et relancez l'import."
        );
      } catch (e) {
        const msg = parseApiError(e, "Impossible de recuperer vos pages Facebook.");
        if (msg === META_PUBLIC_ACCESS_BLOCKED_MESSAGE) {
          setError(null);
          reportPagesSyncFailure(msg);
          return;
        }
        setError(msg);
        reportPagesSyncFailure(msg);
      } finally {
        setFbOauthBusy(false);
      }
    })();
  }, [
    clearActivationPageSelection,
    onPagesChanged,
    persistedPageContext,
    pushConfigNotice,
    reportPagesSyncFailure,
    resolveToken,
    selectedPageId,
  ]);

  // ---- polling (awaiting step) ----
  useEffect(() => {
    if (step !== "awaiting") {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      return;
    }

    const poll = async () => {
      const t = await resolveToken();
      if (!t) return;
      try {
        const res = await getMyActivationRequest(t);
        const updated = res.activation_request;
        if (updated) {
          setAr(updated);
          // if status changed and user should be on a different step, redirect
          const target: WizardStep = statusToStep(updated);
          if (target !== "awaiting") {
            setStep(target);
          }
        }
      } catch {
        /* silent */
      }
    };

    pollRef.current = setInterval(poll, 15_000);
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [step, resolveToken]);

  useEffect(() => {
    if (!ar) return;
    const snapshotPages = normalizePageList(ar.selected_facebook_pages || []);
    const nextContext: ActivationPageContext = {
      imported_pages: snapshotPages,
      selected_page_id: getSnapshotSelectedPageId(snapshotPages, [
        ar.flare_selected_page_id_at_submission,
        ar.activation_target_page_id,
      ]),
      target_page_id: ar.activation_target_page_id || null,
      target_page_name: ar.activation_target_page_name || ar.facebook_page_name || null,
      target_page_url: ar.facebook_page_url || null,
    };
    if (nextContext.imported_pages.length > 0 || nextContext.target_page_id || nextContext.target_page_name) {
      setPersistedPageContext(nextContext);
    }
  }, [ar, selectedPageId]);

  useEffect(() => {
    if (importedPages.length === 0) {
      setPendingTargetPageId("");
      return;
    }

    setPendingTargetPageId((current) => {
      if (current && importedPages.some((p) => p.page_id === current)) {
        return current;
      }

      const defaultId = getDefaultTargetPageId(
        importedPages,
        selectedPageId,
        persistedPageContext
      );
      if (defaultId) {
        return defaultId;
      }

      if (cfg.facebook_page_url) {
        const match = cfg.facebook_page_url.match(/facebook\.com\/([^/?#]+)/i);
        if (match) {
          const fromUrl = match[1];
          const byUrl = importedPages.find((p) => p.page_id === fromUrl);
          if (byUrl) {
            return byUrl.page_id;
          }
        }
      }

      if (cfg.facebook_page_name) {
        const byName = importedPages.find(
          (p) => p.page_name.toLowerCase() === cfg.facebook_page_name.toLowerCase()
        );
        if (byName) {
          return byName.page_id;
        }
      }

      return importedPages[0].page_id;
    });
  }, [
    importedPages,
    selectedPageId,
    persistedPageContext,
    cfg.facebook_page_name,
    cfg.facebook_page_url,
  ]);

  // ---- actions ----
  const handleConnectMetaPages = async () => {
    const t = await resolveToken();
    if (!t) {
      setError("Session expiree. Reconnectez-vous a FLARE.");
      return;
    }
    setError(null);
    setFbOauthBusy(true);
    setConfigNotice(null);
    try {
      const flow = await runFacebookMessengerOAuth(t);
      if (flow === "redirect") {
        pushConfigNotice(
          "info",
          "Autorisation Meta ouverte. Revenez ici apres validation pour voir les pages importees."
        );
        return;
      }

      const st = await loadFacebookMessengerStatus(t);
      setCanManageMetaPages(Boolean(st.can_manage_pages));
      onPagesChanged?.(st.pages || []);
      const normalized = normalizePageList(st.pages || []);
      if (normalized.length > 0) {
        const nextTargetId = getDefaultTargetPageId(normalized, selectedPageId, persistedPageContext);
        if (nextTargetId) {
          setPendingTargetPageId(nextTargetId);
        }
      } else {
        clearActivationPageSelection();
      }
      pushConfigNotice(
        "success",
        normalized.length > 0
          ? "Connexion Meta terminee. Vos pages sont pretes pour selection."
          : "Connexion Meta terminee, mais aucune page n'a ete importee."
      );
    } catch (e) {
      const msg = parseApiError(e, "Connexion Meta interrompue.");
      if (msg === META_PUBLIC_ACCESS_BLOCKED_MESSAGE) {
        setError(null);
        reportPagesSyncFailure(msg);
        return;
      }
      setError(msg);
      reportPagesSyncFailure(msg);
    } finally {
      setFbOauthBusy(false);
    }
  };

  const handleRefreshImportedPages = async () => {
    const t = await resolveToken();
    if (!t) {
      setError("Session expiree. Reconnectez-vous a FLARE.");
      return;
    }
    setError(null);
    setPagesRefreshBusy(true);
    try {
      const pages = await resyncFacebookMessengerPages(t);
      setCanManageMetaPages(true);
      onPagesChanged?.(pages || []);
      const normalized = normalizePageList(pages || []);
      if (normalized.length > 0) {
        const nextTargetId = getDefaultTargetPageId(normalized, selectedPageId, persistedPageContext);
        if (nextTargetId) {
          setPendingTargetPageId(nextTargetId);
        }
      } else {
        clearActivationPageSelection();
      }
      pushConfigNotice(
        "success",
        normalized.length > 0
          ? `${normalized.length} page(s) importee(s) depuis Meta.`
          : "Aucune page importee pour le moment."
      );
    } catch (e) {
      const msg = parseApiError(e, "Impossible d'actualiser la liste des pages Facebook.");
      setError(msg);
      reportPagesSyncFailure(msg);
    } finally {
      setPagesRefreshBusy(false);
    }
  };

  const handleChoosePlan = async () => {
        setBusy(true);
    setError(null);
    try {
      const t = await resolveToken();
      if (!t) throw new Error("Session expiree");
      const res = await createActivationRequest(
        { selected_plan_id: selectedPlanId } as Partial<ActivationRequest>,
        t
      );
      setAr(res.activation_request);
      clearRememberedActivationPlan();
      setStep("payment");
    } catch (e) {
      const msg = parseApiError(e, "Erreur lors de la creation");
      if (getFreshToken && /token|session|expire/i.test(msg)) {
        try {
          const refreshedToken = await getFreshToken(true);
          if (refreshedToken) {
            const retry = await createActivationRequest(
              { selected_plan_id: selectedPlanId } as Partial<ActivationRequest>,
              refreshedToken
            );
            setAr(retry.activation_request);
            setStep("payment");
            return;
          }
        } catch {
          // Fall through to user-facing error below.
        }
        setError("Session indisponible. Rechargez la page puis reessayez.");
        return;
      }
      // If an AR already exists, load it and resume from the correct step
      if (/deja en cours|already in progress|already exists/i.test(msg)) {
        try {
          const t = await resolveToken();
          if (t) {
            const existing = await getMyActivationRequest(t);
            const existingAr = existing.activation_request;
            if (existingAr) {
              setAr(existingAr);
              setSelectedPlanId((existingAr.selected_plan_id as ActivationPlanId) || selectedPlanId);
              setStep(statusToStep(existingAr));
              return;
            }
          }
        } catch { /* silent fallback */ }
      }
      setError(msg);
    } finally {
      setBusy(false);
    }
  };

  const handleSubmitPayment = async () => {
        if (!txRef.trim()) {
      setError("Veuillez indiquer la reference de transaction.");
      return;
    }
    if (!payMethodCode.trim()) {
      setError("Veuillez choisir une methode de paiement.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const t = await resolveToken();
      if (!t) throw new Error("Session expiree");
      const planId = isDesk ? selectedDeskPlanId : (ar?.selected_plan_id || selectedPlanId);
      const data: ManualPaymentData = {
        activation_request_id: ar?.id,
        selected_plan_id: planId,
        method_code: payMethodCode,
        amount: PLAN_PRICES[planId] || "",
        currency: "MGA",
        payer_full_name: payerName,
        payer_phone: payerPhone,
        transaction_reference: txRef.trim(),
        notes: payNotes || undefined,
      };
      await submitManualPayment(data, t);
      if (isDesk) {
        // For desk flow, go directly to Gmail activation (self-service)
        setStep("desk_activation");
      } else {
        // For chatbot flow, refresh AR and follow status
        const refreshed = await getMyActivationRequest(t);
        const refreshedAr = refreshed.activation_request;
        setAr(refreshedAr);
        setStep(refreshedAr ? statusToStep(refreshedAr) : "payment");
      }
    } catch (e) {
      const msg = parseApiError(e, "Erreur lors de la soumission du paiement");
      setError(msg);
    } finally {
      setBusy(false);
    }
  };

  const handleSaveConfig = async () => {
    
    if (importedPages.length === 0) {
      setError("Connectez Facebook et importez la page a activer avant de continuer.");
      return;
    }

    if (!targetPageId) {
      setError("Choisissez la page Facebook a activer.");
      return;
    }

    setBusy(true);
    setError(null);
    setConfigNotice(null);
    try {
      const t = await resolveToken();
      if (!t) throw new Error("Session expiree");

      const effectiveTargetPageName = (targetPage?.page_name || cfg.facebook_page_name || "").trim();
      const effectiveTargetPageUrl = (targetPageUrl || cfg.facebook_page_url || "").trim();
      const selectedPageAtSubmissionId = getSnapshotSelectedPageId(importedPages, [
        selectedPageId,
        targetPage?.page_id,
      ]);
      const pageContext: ActivationPageContext = {
        imported_pages: importedPages,
        selected_page_id: selectedPageAtSubmissionId,
        target_page_id: targetPage?.page_id || null,
        target_page_name: effectiveTargetPageName || null,
        target_page_url: effectiveTargetPageUrl || null,
      };

      const updates: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(cfg)) {
        if (v) updates[k] = v;
      }
      if (effectiveTargetPageName) {
        updates.facebook_page_name = effectiveTargetPageName;
      }
      if (effectiveTargetPageUrl) {
        updates.facebook_page_url = effectiveTargetPageUrl;
      }
      updates.selected_facebook_pages = pageContext.imported_pages.map((page) => ({
        page_id: page.page_id,
        page_name: page.page_name,
        is_selected: page.page_id === pageContext.selected_page_id,
        is_active: Boolean(page.is_active),
      }));
      updates.activation_target_page_id = pageContext.target_page_id || "";
      updates.activation_target_page_name = pageContext.target_page_name || "";

      const res = await updateActivationRequest(updates, t);
      setAr(res.activation_request);
      setPersistedPageContext(pageContext);
      setStep("flare_admin");
    } catch (e) {
      const msg = parseApiError(e, "Erreur lors de la sauvegarde");
      setError(msg);
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmAdmin = async () => {
        setBusy(true);
    setError(null);
    try {
      const t = await resolveToken();
      if (!t) throw new Error("Session expiree");
      const res = await updateActivationRequest(
        { flare_page_admin_confirmed: "true" },
        t
      );
      setAr(res.activation_request);
      setStep("awaiting");
    } catch (e) {
      const msg = parseApiError(e, "Erreur lors de la confirmation");
      setError(msg);
    } finally {
      setBusy(false);
    }
  };

  // ---- completed steps ----
  const completedSteps: WizardStep[] = [];
  // choose_module is completed once we move past it
  if (step !== "choose_module") {
    completedSteps.push("choose_module");
  }
  if (ar) {
    completedSteps.push("choose_plan");
    const s = ar.status;
    if (
      [
        "payment_submitted",
        "payment_verified",
        "awaiting_flare_page_admin_access",
        "queued_for_activation",
        "activation_in_progress",
        "testing",
        "active",
      ].includes(s)
    ) {
      completedSteps.push("payment");
    }
    if (
      [
        "awaiting_flare_page_admin_access",
        "queued_for_activation",
        "activation_in_progress",
        "testing",
        "active",
      ].includes(s)
    ) {
      completedSteps.push("config");
    }
    if (
      ar.flare_page_admin_confirmed === "true" ||
      [
        "queued_for_activation",
        "activation_in_progress",
        "testing",
        "active",
      ].includes(s)
    ) {
      completedSteps.push("flare_admin");
    }
    if (s === "active") {
      completedSteps.push("awaiting");
    }
  }
  // For desk flow without AR, mark steps manually based on current step
  if (isDesk && !ar) {
    if (step !== "choose_plan" && step !== "choose_module") {
      completedSteps.push("choose_plan");
    }
    if (step === "desk_activation" || step === "desk_ready") {
      completedSteps.push("payment");
    }
    if (step === "desk_ready") {
      completedSteps.push("desk_activation");
    }
  }

  // ---- navigation ----
  const goPrev = () => {
    const idx = stepIndexOf(step, stepOrder);
    if (idx > 0) {
      setError(null);
      setStep(stepOrder[idx - 1]);
    }
  };

  // ---- render helpers ----
  const selectedPlan = PLANS.find((p) => p.id === selectedPlanId) ?? PLANS[1];
  const selectedMethod = paymentMethods.find((m) => m.code === payMethodCode);
  const persistedImportedPages = persistedPageContext?.imported_pages || [];
  const shouldUsePersistedPageContext = step === "flare_admin" || step === "awaiting";
  const effectiveImportedPages =
    shouldUsePersistedPageContext && persistedImportedPages.length > 0
      ? persistedImportedPages
      : importedPages.length > 0
      ? importedPages
      : persistedImportedPages;
  const effectiveSelectedPageId = shouldUsePersistedPageContext
    ? getSnapshotSelectedPageId(effectiveImportedPages, [
        persistedPageContext?.selected_page_id,
        ar?.activation_target_page_id,
      ])
    : getSnapshotSelectedPageId(effectiveImportedPages, [
        selectedPageId,
        persistedPageContext?.selected_page_id,
        ar?.activation_target_page_id,
      ]);
  const resolvedTargetPageId = shouldUsePersistedPageContext
    ? ar?.activation_target_page_id || persistedPageContext?.target_page_id || null
    : targetPage?.page_id || ar?.activation_target_page_id || persistedPageContext?.target_page_id || null;
  const resolvedTargetPageName =
    (resolvedTargetPageId
      ? effectiveImportedPages.find((page) => page.page_id === resolvedTargetPageId)?.page_name || null
      : null) ||
    (shouldUsePersistedPageContext
      ? ar?.activation_target_page_name || persistedPageContext?.target_page_name || ar?.facebook_page_name || null
      : targetPage?.page_name ||
        ar?.activation_target_page_name ||
        persistedPageContext?.target_page_name ||
        ar?.facebook_page_name ||
        null);
  const resolvedTargetPageUrl =
    (resolvedTargetPageId ? `https://facebook.com/${resolvedTargetPageId}` : null) ||
    (shouldUsePersistedPageContext
      ? persistedPageContext?.target_page_url || ar?.facebook_page_url || null
      : targetPageUrl || persistedPageContext?.target_page_url || ar?.facebook_page_url || null);
  const selectedPageInFlare =
    effectiveImportedPages.find((p) => p.page_id === effectiveSelectedPageId) ??
    null;
  const displayedPageContext: ActivationPageContext = {
    imported_pages: effectiveImportedPages,
    selected_page_id: effectiveSelectedPageId,
    target_page_id: resolvedTargetPageId,
    target_page_name: resolvedTargetPageName,
    target_page_url: resolvedTargetPageUrl,
  };

  const updateCfg = (key: string, value: string) => {
    setCfg((prev) => ({ ...prev, [key]: value }));
  };

  // ---- loading state ----
  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    );
  }

  
  // ---- render ----
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-3xl px-4 py-8 md:px-8 md:py-12 flex flex-col gap-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        >
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-[var(--text-primary)] mb-1">
            {step === "choose_module" ? "Offre / Activation" : isDesk ? "Activation Executive Desk" : "Activation du chatbot"}
          </h1>
          <p className="text-sm text-[var(--text-secondary)]">
            {step === "choose_module"
              ? "Choisissez le module FLARE AI que vous souhaitez activer."
              : isDesk
              ? "Suivez les étapes pour activer votre bureau exécutif avec Gmail."
              : "Suivez les etapes pour autoriser FLARE a activer votre chatbot IA sur Facebook Messenger."}
          </p>
        </motion.div>

        {/* Step indicator */}
        {step !== "choose_module" && (
          <StepIndicator current={step} completed={completedSteps} steps={stepOrder} />
        )}

        {/* Error banner */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-[var(--text-primary)]"
            >
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Step content */}
        <AnimatePresence mode="wait">
          {/* ============ STEP 0 : CHOOSE MODULE ============ */}
          {step === "choose_module" && (
            <motion.div
              key="choose_module"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.25 }}
              className="flex flex-col gap-6"
            >
              <div className="text-center mb-2">
                <h2 className="text-3xl md:text-4xl font-black tracking-tight text-[var(--text-primary)] font-[family-name:var(--font-outfit)] mb-2">
                  Quel module souhaitez-vous activer ?
                </h2>
                <p className="text-sm text-[var(--text-muted)] max-w-lg mx-auto">
                  Sélectionnez un module pour voir les offres disponibles.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                {ACTIVATION_MODULES.map((mod, mi) => {
                  const Icon = mod.icon;
                  const isSelected = selectedModule === mod.id;
                  return (
                    <motion.button
                      key={mod.id}
                      type="button"
                      disabled={mod.locked}
                      onClick={() => {
                        if (!mod.locked) {
                          setSelectedModule(mod.id);
                          setError(null);
                          if (mod.id === "chatbot") {
                            setStep("choose_plan");
                          } else {
                            setStep("choose_plan");
                          }
                        }
                      }}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2, delay: mi * 0.06 }}
                      className={`group relative rounded-[24px] border p-6 text-left transition-all duration-200 ${
                        mod.locked
                          ? "border-[var(--border-default)] bg-[var(--surface-subtle)] opacity-60 cursor-not-allowed"
                          : isSelected
                          ? "border-orange-500 bg-orange-500/5 shadow-lg shadow-orange-500/10"
                          : "border-[var(--border-default)] bg-[var(--bg-card)] hover:border-orange-500/25 hover:shadow-md cursor-pointer"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${
                          mod.locked ? "bg-[var(--surface-raised)] text-[var(--text-muted)]" : "bg-orange-500/10 text-orange-500"
                        }`}>
                          <Icon size={24} />
                        </div>
                        {mod.badge && (
                          <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest ${
                            mod.locked
                              ? "border border-[var(--border-default)] bg-[var(--surface-raised)] text-[var(--text-muted)]"
                              : mod.badge === "Nouveau"
                              ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                              : "bg-orange-500/10 text-orange-500 border border-orange-500/20"
                          }`}>
                            {mod.badge}
                          </span>
                        )}
                      </div>
                      <h3 className="mt-4 text-lg font-bold text-[var(--text-primary)] flex items-center gap-2">
                        {mod.label}
                        {mod.locked && <Lock size={14} className="text-[var(--text-muted)]" />}
                      </h3>
                      <p className="mt-1.5 text-sm text-[var(--text-secondary)] leading-relaxed">
                        {mod.description}
                      </p>
                      {!mod.locked && (
                        <div className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-orange-500">
                          Voir les offres
                          <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" />
                        </div>
                      )}
                      {mod.locked && (
                        <p className="mt-3 text-[11px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">
                          Bientôt disponible
                        </p>
                      )}
                    </motion.button>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* ============ STEP 1 : CHOOSE PLAN ============ */}
          {step === "choose_plan" && !isDesk && (
            <motion.div
              key="choose_plan"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.25 }}
              className="flex flex-col gap-6"
            >
              <div className="text-center mb-2">
                <h2 className="text-3xl md:text-4xl font-black tracking-tight text-[var(--text-primary)] font-[family-name:var(--font-outfit)] mb-2">
                  Choisissez votre offre
                </h2>
                <p className="text-sm text-[var(--text-muted)] max-w-lg mx-auto">
                  Sélectionnez le plan qui correspond à votre activité.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 items-stretch pt-4">
                {PLANS.map((plan, pi) => {
                  const isSelected = selectedPlanId === plan.id;
                  return (
                    <div
                      key={plan.id}
                      onClick={() => setSelectedPlanId(plan.id as ActivationPlanId)}
                      className={`relative rounded-[28px] border p-7 md:p-9 flex flex-col gap-5 cursor-pointer transition-all duration-300 group ${
                        plan.highlight
                          ? "border-orange-500/40 bg-orange-500/[0.03] shadow-2xl shadow-orange-500/10 scale-[1.02] z-20"
                          : isSelected
                          ? "border-orange-500 bg-orange-500/5 shadow-lg shadow-orange-500/10 z-10 scale-[1.01]"
                          : "border-[var(--border-default)] bg-[var(--surface-subtle)] hover:border-[var(--border-subtle)] z-0"
                      }`}
                    >
                      {/* Shimmer blur background */}
                      <div className="absolute inset-0 z-0 overflow-hidden rounded-[28px] pointer-events-none">
                        <div className={`absolute inset-0 transition-opacity duration-700 blur-[30px] ${plan.highlight ? "opacity-20 group-hover:opacity-40" : "opacity-0 group-hover:opacity-10"}`}>
                          <motion.div animate={{ x: ["-100%", "200%"], scale: [1, 1.2, 1] }} transition={{ duration: 4, repeat: Infinity, ease: "linear" }} className={`absolute -inset-y-10 w-1/2 -skew-x-12 ${plan.highlight ? "bg-orange-500/50" : "bg-white/20"}`} />
                        </div>
                      </div>

                      {/* Popular badge */}
                      {plan.highlight && (
                        <div className="absolute -top-4 left-1/2 -translate-x-1/2 rounded-full bg-orange-500 px-5 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-white shadow-xl z-20">
                          Le plus populaire
                        </div>
                      )}

                      {/* Selected indicator when not highlight */}
                      {isSelected && !plan.highlight && (
                        <div className="absolute -top-3 right-3 rounded-full bg-[var(--text-primary)] px-3 py-1 text-[9px] font-bold uppercase tracking-widest text-[var(--surface-base)] z-20">
                          Sélectionné ✓
                        </div>
                      )}
                      {isSelected && plan.highlight && (
                        <div className="absolute top-3 right-3 rounded-full bg-[var(--surface-overlay)] backdrop-blur px-2 py-1 text-[9px] font-bold uppercase tracking-widest text-orange-500 z-20">
                          Sélectionné ✓
                        </div>
                      )}

                      {/* Name & Price */}
                      <div className="relative z-10">
                        <span className="text-[10px] uppercase font-bold tracking-[0.15em] text-orange-500">{plan.name}</span>
                        <div className="mt-3 flex items-baseline gap-1">
                          <span className="whitespace-nowrap text-4xl md:text-5xl font-black tracking-tight text-[var(--text-primary)] font-[family-name:var(--font-outfit)]">{plan.price}</span>
                          <span className="text-sm font-bold text-[var(--text-muted)]">Ar / mois</span>
                        </div>
                        <p className="mt-1.5 text-[11px] font-bold uppercase tracking-wide text-[var(--text-muted)]">{plan.subtitle}</p>
                      </div>

                      {/* Features */}
                      <ul className="relative z-10 flex flex-col gap-3 flex-1 h-full min-h-0">
                        {plan.features.map((f) => (
                          <li key={f} className="flex items-start gap-2.5 text-sm font-medium text-[var(--text-secondary)] break-words">
                            <div className="w-4 h-4 rounded-full bg-orange-500/10 flex items-center justify-center shrink-0 mt-0.5">
                              <CheckCircle2 size={10} className="text-orange-500" />
                            </div>
                            <span className="leading-relaxed">{f}</span>
                          </li>
                        ))}
                      </ul>

                      {/* CTA area */}
                      <div className="relative z-10 mt-1">
                        <div className={`w-full rounded-2xl py-4 text-[11px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 transition-all duration-200 ${
                          isSelected
                            ? plan.highlight
                              ? "bg-orange-500 text-white shadow-lg shadow-orange-500/20"
                              : "bg-orange-500/10 text-orange-500 border border-orange-500/30"
                            : plan.highlight
                            ? "bg-orange-500/80 text-white"
                            : "border border-[var(--border-default)] text-[var(--text-muted)]"
                        }`}>
                          {isSelected ? <CheckCircle2 size={12} /> : plan.highlight ? <Zap size={12} /> : <ArrowRight size={12} />}
                          {isSelected ? "Sélectionné" : plan.cta}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Entreprise banner */}
              <div className="rounded-[24px] border border-[var(--border-default)] bg-[var(--surface-subtle)] px-6 py-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <div className="flex-1 min-w-0">
                  <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-orange-500">Entreprise</span>
                  <h3 className="mt-1 text-xl font-black tracking-tight text-[var(--text-primary)] font-[family-name:var(--font-outfit)]">Solution 100% sur mesure</h3>
                  <p className="mt-0.5 text-sm text-[var(--text-muted)]">Infrastructure dédiée · SLA garanti · Accompagnement complet</p>
                </div>
                <a href="mailto:contact@ramsflare.com?subject=Offre%20Entreprise%20FLARE%20AI" className="shrink-0 flex items-center gap-2 rounded-2xl border border-[var(--border-default)] bg-[var(--surface-raised)] px-5 py-3 text-[11px] font-bold uppercase tracking-widest text-[var(--text-primary)] hover:border-[var(--border-subtle)] transition-all">
                  <MessageSquare size={12} />
                  Nous contacter
                </a>
              </div>

              {/* Next */}
              <div className="flex justify-end">
                <button
                  type="button"
                  disabled={busy}
                  onClick={handleChoosePlan}
              className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-6 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-orange-600 disabled:opacity-50"
                >
                  {busy ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <>
                      Choisir ce plan
                      <ArrowRight size={16} />
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          )}

          {/* ============ STEP 1b : CHOOSE DESK PLAN ============ */}
          {step === "choose_plan" && isDesk && (
            <motion.div
              key="choose_desk_plan"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.25 }}
              className="flex flex-col gap-6"
            >
              <div className="text-center mb-2">
                <h2 className="text-3xl md:text-4xl font-black tracking-tight text-[var(--text-primary)] font-[family-name:var(--font-outfit)] mb-2">
                  Choisissez votre offre Executive
                </h2>
                <p className="text-sm text-[var(--text-muted)] max-w-lg mx-auto">
                  Activez votre bureau exécutif et connectez Gmail pour commencer.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 items-stretch pt-4">
                {DESK_PLANS.map((plan) => {
                  const isSelected = selectedDeskPlanId === plan.id;
                  return (
                    <div
                      key={plan.id}
                      onClick={() => setSelectedDeskPlanId(plan.id)}
                      className={`relative rounded-[28px] border p-7 md:p-9 flex flex-col gap-5 cursor-pointer transition-all duration-300 group ${
                        plan.highlight
                          ? "border-orange-500/40 bg-orange-500/[0.03] shadow-2xl shadow-orange-500/10 scale-[1.02] z-20"
                          : isSelected
                          ? "border-orange-500 bg-orange-500/5 shadow-lg shadow-orange-500/10 z-10 scale-[1.01]"
                          : "border-[var(--border-default)] bg-[var(--surface-subtle)] hover:border-[var(--border-subtle)] z-0"
                      }`}
                    >
                      {/* Shimmer blur */}
                      <div className="absolute inset-0 z-0 overflow-hidden rounded-[28px] pointer-events-none">
                        <div className={`absolute inset-0 transition-opacity duration-700 blur-[30px] ${plan.highlight ? "opacity-20 group-hover:opacity-40" : "opacity-0 group-hover:opacity-10"}`}>
                          <motion.div animate={{ x: ["-100%", "200%"], scale: [1, 1.2, 1] }} transition={{ duration: 4, repeat: Infinity, ease: "linear" }} className={`absolute -inset-y-10 w-1/2 -skew-x-12 ${plan.highlight ? "bg-orange-500/50" : "bg-white/20"}`} />
                        </div>
                      </div>

                      {plan.highlight && (
                        <div className="absolute -top-4 left-1/2 -translate-x-1/2 rounded-full bg-orange-500 px-5 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-white shadow-xl z-20">
                          Recommandé
                        </div>
                      )}

                      {isSelected && !plan.highlight && (
                        <div className="absolute -top-3 right-3 rounded-full bg-[var(--text-primary)] px-3 py-1 text-[9px] font-bold uppercase tracking-widest text-[var(--surface-base)] z-20">
                          Sélectionné ✓
                        </div>
                      )}
                      {isSelected && plan.highlight && (
                        <div className="absolute top-3 right-3 rounded-full bg-[var(--surface-overlay)] backdrop-blur px-2 py-1 text-[9px] font-bold uppercase tracking-widest text-orange-500 z-20">
                          Sélectionné ✓
                        </div>
                      )}

                      <div className="relative z-10">
                        <span className="text-[10px] uppercase font-bold tracking-[0.15em] text-orange-500">{plan.name}</span>
                        <div className="mt-3 flex items-baseline gap-1">
                          <span className="whitespace-nowrap text-4xl md:text-5xl font-black tracking-tight text-[var(--text-primary)] font-[family-name:var(--font-outfit)]">{plan.price}</span>
                          <span className="text-sm font-bold text-[var(--text-muted)]">Ar / mois</span>
                        </div>
                        <p className="mt-1.5 text-[11px] font-bold uppercase tracking-wide text-[var(--text-muted)]">{plan.subtitle}</p>
                      </div>

                      <ul className="relative z-10 flex flex-col gap-3 flex-1 h-full min-h-0">
                        {plan.features.map((f) => (
                          <li key={f} className="flex items-start gap-2.5 text-sm font-medium text-[var(--text-secondary)] break-words">
                            <div className="w-4 h-4 rounded-full bg-orange-500/10 flex items-center justify-center shrink-0 mt-0.5">
                              <CheckCircle2 size={10} className="text-orange-500" />
                            </div>
                            <span className="leading-relaxed">{f}</span>
                          </li>
                        ))}
                      </ul>

                      <div className="relative z-10 mt-1">
                        <div className={`w-full rounded-2xl py-4 text-[11px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 transition-all duration-200 ${
                          isSelected
                            ? plan.highlight
                              ? "bg-orange-500 text-white shadow-lg shadow-orange-500/20"
                              : "bg-orange-500/10 text-orange-500 border border-orange-500/30"
                            : plan.highlight
                            ? "bg-orange-500/80 text-white"
                            : "border border-[var(--border-default)] text-[var(--text-muted)]"
                        }`}>
                          {isSelected ? <CheckCircle2 size={12} /> : plan.highlight ? <Zap size={12} /> : <ArrowRight size={12} />}
                          {isSelected ? "Sélectionné" : plan.cta}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Navigation */}
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={goPrev}
                  className="inline-flex items-center gap-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                >
                  <ArrowLeft size={16} />
                  Retour
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setStep("payment");
                  }}
                  className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-6 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-orange-600 disabled:opacity-50"
                >
                  Choisir ce plan
                  <ArrowRight size={16} />
                </button>
              </div>
            </motion.div>
          )}

          {/* ============ STEP 2 : PAYMENT ============ */}
          {step === "payment" && (
            <motion.div
              key="payment"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.25 }}
              className="flex flex-col gap-6"
            >
              {/* Recap */}
              <div className={`${glass} p-5 flex items-center justify-between`}>
                <div>
                  <p className="text-xs font-semibold text-[var(--text-secondary)] mb-1">
                    Plan selectionne
                  </p>
                  <p className="text-lg font-bold text-[var(--text-primary)]">
                    {isDesk ? (DESK_PLANS.find(p => p.id === selectedDeskPlanId)?.name ?? "Pro") : selectedPlan.name}
                  </p>
                </div>
                <p className="text-xl font-bold text-orange-500">
                  {isDesk ? (PLAN_PRICES[selectedDeskPlanId] ?? "50 000") : selectedPlan.price}
                  <span className="text-sm font-medium text-[var(--text-muted)] ml-1">Ar / mois</span>
                </p>
              </div>

              {/* Payment methods */}
              <div>
                {!isDesk && (
                <div className="mb-4 rounded-2xl border border-[var(--border-default)] bg-[var(--surface-subtle)] px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-orange-500">
                    Facebook avant paiement
                  </p>
                  <p className="mt-2 text-sm text-[var(--text-secondary)]">
                    Pour que l&apos;equipe FLARE sache quelle page connecter, vous pouvez deja importer vos pages Facebook maintenant.
                    Le parametrage detaille du bot sera complete apres activation.
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={handleConnectMetaPages}
                      disabled={fbOauthBusy || pagesRefreshBusy || !canManageMetaPages}
                      title={!canManageMetaPages ? "Seuls le proprietaire ou un admin peuvent connecter Facebook." : undefined}
                      className="inline-flex items-center gap-2 rounded-xl border border-[#1877F2]/20 bg-[#1877F2]/10 px-4 py-2 text-sm font-semibold text-[#1877F2] transition-colors hover:bg-[#1877F2]/15 disabled:opacity-50"
                    >
                      {fbOauthBusy ? <Loader2 size={15} className="animate-spin" /> : <Facebook size={15} />}
                      Ouvrir Meta
                    </button>
                    {importedPages.length > 0 ? (
                      <span className="text-xs text-[var(--text-secondary)]">
                        {importedPages.length} page{importedPages.length > 1 ? "s" : ""} importee{importedPages.length > 1 ? "s" : ""}
                        {resolvedTargetPageName ? ` - cible actuelle : ${resolvedTargetPageName}` : ""}
                      </span>
                    ) : (
                      <span className="text-xs text-[var(--text-muted)]">
                        Vous pourrez aussi renseigner la page manuellement a l&apos;etape suivante.
                      </span>
                    )}
                  </div>
                </div>
                )}
                <h3 className="text-sm font-semibold text-[var(--text-secondary)] mb-3 flex items-center gap-2">
                  <CreditCard size={16} className="text-orange-500" />
                  Methodes de paiement
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {paymentMethods.map((pm) => {
                    const isActive = payMethodCode === pm.code;
                    return (
                      <button
                        key={pm.code}
                        type="button"
                        onClick={() => setPayMethodCode(pm.code)}
                        className={`text-left p-4 rounded-xl border transition-all duration-200 ${
                          isActive
                            ? "border-orange-500 bg-orange-500/5"
                            : "border-[var(--border-default)] bg-[var(--surface-subtle)] hover:border-[var(--border-strong)]"
                        }`}
                      >
                        <p className="font-semibold text-[var(--text-primary)] text-sm">
                          {pm.label}
                        </p>
                        <p className="text-xs text-[var(--text-secondary)] mt-1">
                          {pm.recipient_name}
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          <code className="text-sm font-mono text-orange-500 bg-[var(--surface-subtle)] px-2 py-0.5 rounded">
                            {pm.recipient_number}
                          </code>
                          <CopyButton text={pm.recipient_number} />
                        </div>
                        {pm.instructions && (
                          <p className="text-xs text-[var(--text-muted)] mt-2 leading-relaxed">
                            {pm.instructions}
                          </p>
                        )}
                      </button>
                    );
                  })}
                </div>
                {paymentMethods.length === 0 && (
                  <p className="text-sm text-[var(--text-secondary)] italic">
                    Aucune methode de paiement disponible pour le moment.
                  </p>
                )}
              </div>

              {/* Payment form */}
              <div className={`${glass} p-5 flex flex-col gap-4`}>
                <h3 className="text-sm font-semibold text-[var(--text-secondary)]">
                  Informations de paiement
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <label className="flex flex-col gap-1">
                    <span className="text-xs font-medium text-[var(--text-secondary)]">
                      Nom complet du payeur
                    </span>
                    <input
                      type="text"
                      value={payerName}
                      onChange={(e) => setPayerName(e.target.value)}
                      placeholder="Nom et prenom"
                      className="rounded-lg border border-[var(--border-default)] bg-[var(--surface-subtle)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-orange-500/50 focus:outline-none focus:ring-1 focus:ring-orange-500/30 transition-colors"
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-xs font-medium text-[var(--text-secondary)]">
                      Telephone du payeur
                    </span>
                    <input
                      type="tel"
                      value={payerPhone}
                      onChange={(e) => setPayerPhone(e.target.value)}
                      placeholder="034 00 000 00"
                      className="rounded-lg border border-[var(--border-default)] bg-[var(--surface-subtle)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-orange-500/50 focus:outline-none focus:ring-1 focus:ring-orange-500/30 transition-colors"
                    />
                  </label>
                </div>
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-[var(--text-secondary)]">
                    Reference de transaction *
                  </span>
                  <input
                    type="text"
                    value={txRef}
                    onChange={(e) => setTxRef(e.target.value)}
                    placeholder="Ex: MP240501XYZ"
                    required
                    className="rounded-lg border border-[var(--border-default)] bg-[var(--surface-subtle)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-orange-500/50 focus:outline-none focus:ring-1 focus:ring-orange-500/30 transition-colors"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-[var(--text-secondary)]">
                    Notes (optionnel)
                  </span>
                  <textarea
                    value={payNotes}
                    onChange={(e) => setPayNotes(e.target.value)}
                    rows={2}
                    placeholder="Informations complementaires..."
                    className="rounded-lg border border-[var(--border-default)] bg-[var(--surface-subtle)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-orange-500/50 focus:outline-none focus:ring-1 focus:ring-orange-500/30 transition-colors resize-none"
                  />
                </label>
              </div>

              {/* Nav */}
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={goPrev}
                  className="inline-flex items-center gap-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                >
                  <ArrowLeft size={16} />
                  Precedent
                </button>
                <button
                  type="button"
                  disabled={busy || !txRef.trim()}
                  onClick={handleSubmitPayment}
              className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-6 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-orange-600 disabled:opacity-50"
                >
                  {busy ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <>
                      Envoyer la preuve
                      <ArrowRight size={16} />
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          )}

          {/* ============ STEP 3 : CONFIG ============ */}
          {step === "config" && (
            <motion.div
              key="config"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.25 }}
              className="flex flex-col gap-6"
            >
              <div className="text-center">
                <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-1">
                  Autorisez FLARE sur votre page Facebook
                </h2>
                <p className="text-sm text-[var(--text-secondary)]">
                  Connectez/importez vos pages Facebook ici, puis selectionnez la page cible de l&apos;activation.
                </p>
              </div>

              <fieldset className={`${glass} p-5 flex flex-col gap-4`}>
                <legend className="text-sm font-semibold text-orange-500 flex items-center gap-2 mb-1">
                  <Facebook size={16} />
                  Facebook
                </legend>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={handleConnectMetaPages}
                    disabled={fbOauthBusy || busy || !canManageMetaPages}
                    title={!canManageMetaPages ? "Seuls le proprietaire ou un admin peuvent connecter Facebook." : undefined}
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-orange-500/35 bg-orange-500/10 px-4 py-2.5 text-sm font-semibold text-orange-500 transition-colors hover:bg-orange-500/15 disabled:opacity-50"
                  >
                    {fbOauthBusy ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                    Ouvrir Meta et importer
                  </button>
                  <button
                    type="button"
                    onClick={handleRefreshImportedPages}
                    disabled={pagesRefreshBusy || fbOauthBusy || busy || !canManageMetaPages}
                    title={!canManageMetaPages ? "Seuls le proprietaire ou un admin peuvent synchroniser Facebook." : undefined}
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--border-default)] bg-[var(--surface-subtle)] px-4 py-2.5 text-sm font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-raised)] disabled:opacity-50"
                  >
                    {pagesRefreshBusy ? <Loader2 size={16} className="animate-spin" /> : <Facebook size={16} />}
                    Actualiser les pages importees
                  </button>
                </div>
                <p className="text-xs text-[var(--text-muted)]">
                  Cette etape ne demande que votre page Facebook. Les details business/chatbot seront completes ensuite dans le cockpit.
                </p>

                {!canManageMetaPages ? (
                  <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-[var(--text-primary)]">
                    Seuls le proprietaire ou un admin du compte peuvent connecter Facebook depuis cette etape.
                  </div>
                ) : null}

                {configNotice && (
                  <div
                    className={`rounded-lg border px-3 py-2 text-xs ${
                      configNotice.tone === "success"
                        ? "border-[var(--accent-navy)]/30 bg-[var(--accent-navy)]/10 text-[var(--accent-navy)]"
                        : configNotice.tone === "warning"
                        ? "border-orange-500/30 bg-orange-500/10 text-orange-500"
                        : "border-[var(--border-default)] bg-[var(--surface-subtle)] text-[var(--text-secondary)]"
                    }`}
                  >
                    {configNotice.message}
                  </div>
                )}

                {importedPages.length > 0 ? (
                  <>
                    <div className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-subtle)] px-4 py-3">
                      <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-2">
                        Pages importees de Facebook ({importedPages.length})
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {importedPages.slice(0, 6).map((page) => (
                          <span
                            key={page.page_id}
                            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs ${
                              page.page_id === targetPageId
                                ? "bg-orange-500/15 text-orange-500 border border-orange-500/30"
                                : "bg-[var(--surface-raised)] text-[var(--text-secondary)] border border-[var(--border-default)]"
                            }`}
                          >
                            {page.page_name}
                          </span>
                        ))}
                        {importedPages.length > 6 && (
                          <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs bg-[var(--surface-raised)] text-[var(--text-muted)] border border-[var(--border-default)]">
                            +{importedPages.length - 6} autres
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="rounded-lg border border-[var(--border-default)] bg-[var(--surface-subtle)] px-3 py-2">
                        <p className="text-xs font-medium text-[var(--text-secondary)] mb-1">
                          Page actuellement selectionnee dans FLARE
                        </p>
                        <p className="text-sm text-[var(--text-primary)] font-medium truncate">
                          {selectedPageInFlare?.page_name || "-"}
                        </p>
                      </div>
                      <label className="flex flex-col gap-1">
                        <span className="text-xs font-medium text-[var(--text-secondary)]">
                          Page cible de l&apos;activation
                        </span>
                        <select
                          value={targetPageId}
                          onChange={(e) => {
                            setPendingTargetPageId(e.target.value);
                          }}
                          className="rounded-lg border border-[var(--border-default)] bg-[var(--surface-subtle)] px-3 py-2 text-sm text-[var(--text-primary)] focus:border-orange-500/50 focus:outline-none focus:ring-1 focus:ring-orange-500/30 transition-colors"
                        >
                          <option value="" disabled>
                            Choisir la page a activer
                          </option>
                          {importedPages.map((page) => (
                            <option key={page.page_id} value={page.page_id}>
                              {page.page_name}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>

                    {targetPage && (
                      <div className="rounded-lg border border-[var(--accent-navy)]/20 bg-[var(--accent-navy)]/7 px-3 py-2 text-xs text-[var(--text-secondary)]">
                        <span className="font-semibold text-[var(--text-primary)]">Page choisie pour activation:</span>{" "}
                        {targetPage.page_name} ({targetPage.page_id})
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex flex-col gap-4">
                    <div className="rounded-lg border border-orange-500/25 bg-orange-500/10 px-3 py-2 text-xs text-orange-500">
                      Aucune page importee. Ouvrez Meta puis actualisez la liste avant de continuer. Si Meta bloque l&apos;import, contactez FLARE pour assistance.
                    </div>
                  </div>
                )}
              </fieldset>

              <fieldset className={`${glass} p-5 flex flex-col gap-4`}>
                <legend className="text-sm font-semibold text-[var(--text-secondary)] mb-1">
                  Contact activation (optionnel)
                </legend>
                <InputField
                  label="Email de contact Meta"
                  type="email"
                  value={cfg.facebook_admin_email}
                  onChange={(v) => updateCfg("facebook_admin_email", v)}
                  placeholder="admin@exemple.com"
                />
                <TextareaField
                  label="Notes pour l'equipe FLARE"
                  value={cfg.notes_for_flare}
                  onChange={(v) => updateCfg("notes_for_flare", v)}
                  placeholder="Instructions utiles pour l'activation..."
                  rows={3}
                />
              </fieldset>

              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={goPrev}
                  className="inline-flex items-center gap-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                >
                  <ArrowLeft size={16} />
                  Precedent
                </button>
                <button
                  type="button"
                  disabled={busy || fbOauthBusy || pagesRefreshBusy}
                  onClick={handleSaveConfig}
                  className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-6 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-orange-600 disabled:opacity-50"
                >
                  {busy ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <>
                      Continuer
                      <ArrowRight size={16} />
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          )}

          {/* ============ STEP 4 : FLARE ADMIN ============ */}
          {step === "flare_admin" && (
            <motion.div
              key="flare_admin"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.25 }}
              className="flex flex-col gap-6"
            >
              <div className="text-center">
                <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-1">
                  Autorisation d&apos;activation Facebook
                </h2>
                <p className="text-sm text-[var(--text-secondary)]">
                  Confirmez que FLARE peut utiliser la page selectionnee pour activer votre chatbot.
                </p>
              </div>

              <div className={`${glass} p-6 flex flex-col gap-5`}>
                <div className="flex items-center gap-3 mb-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--accent-navy)]/10">
                    <Facebook size={20} className="text-[var(--accent-navy)]" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[var(--text-primary)]">
                      Comment ca marche ?
                    </p>
                    <p className="text-xs text-[var(--text-secondary)] mt-1 leading-relaxed">
                      FLARE utilisera uniquement la connexion Meta et la page cible indiquees ci-dessous pour preparer puis activer votre chatbot.
                    </p>
                  </div>
                </div>

                <div className="border-t border-[var(--border-default)] pt-4">
                  <p className="text-sm font-semibold text-[var(--text-secondary)] mb-3">
                    Contexte de page selectionne :
                  </p>
                  <div className="flex flex-col gap-2 text-sm text-[var(--text-secondary)]">
                    <div className="flex justify-between">
                      <span>Page selectionnee dans FLARE</span>
                      <span className="text-[var(--text-primary)] font-medium">
                        {selectedPageInFlare?.page_name || "-"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>ID selection FLARE</span>
                      <span className="text-[var(--text-primary)] font-medium">
                        {displayedPageContext.selected_page_id || "-"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Page cible d&apos;activation</span>
                      <span className="text-[var(--text-primary)] font-medium truncate max-w-[60%]">
                        {displayedPageContext.target_page_name || cfg.facebook_page_name || "-"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>ID page cible</span>
                      <span className="text-[var(--text-primary)] font-medium truncate max-w-[60%]">
                        {displayedPageContext.target_page_id || "-"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>URL cible</span>
                      <span className="text-[var(--text-primary)] font-medium truncate max-w-[60%]">
                        {displayedPageContext.target_page_url || cfg.facebook_page_url || "-"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Email contact Meta</span>
                      <span className="text-[var(--text-primary)] font-medium">{cfg.facebook_admin_email || "-"}</span>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg bg-[var(--accent-navy)]/6 border border-[var(--accent-navy)]/16 px-4 py-3 text-xs text-[var(--text-secondary)] leading-relaxed">
                  En cliquant sur &quot;Autoriser&quot;, vous validez l&apos;utilisation de cette connexion/page Facebook pour l&apos;activation de votre chatbot.
                </div>

                <label className="flex items-start gap-3 mt-2 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={adminConfirmed}
                    onChange={(e) => setAdminConfirmed(e.target.checked)}
                    className="mt-0.5 h-5 w-5 rounded border-[var(--border-default)] bg-[var(--surface-subtle)] text-orange-500 focus:ring-orange-500/30 accent-orange-500"
                  />
                  <span className="text-sm text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors">
                    J&apos;autorise FLARE a utiliser cette connexion/page Facebook pour finaliser l&apos;activation.
                  </span>
                </label>
              </div>

              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={goPrev}
                  className="inline-flex items-center gap-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                >
                  <ArrowLeft size={16} />
                  Precedent
                </button>
                <button
                  type="button"
                  disabled={busy || !adminConfirmed}
                  onClick={handleConfirmAdmin}
                  className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-6 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-orange-600 disabled:opacity-50"
                >
                  {busy ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <>
                      Autoriser et notifier l&apos;equipe
                      <ArrowRight size={16} />
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          )}

          {/* ============ STEP 5 : AWAITING ============ */}
          {step === "awaiting" && (
            <motion.div
              key="awaiting"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.25 }}
              className="flex flex-col gap-6 items-center"
            >
              <AwaitingStatus
                ar={ar}
                pageContext={displayedPageContext}
                onGoToPayment={() => setStep("payment")}
                onGoToChatbot={() => onPush("chatbot")}
              />
            </motion.div>
          )}

          {/* ============ DESK STEP : ACTIVATION (Gmail) ============ */}
          {step === "desk_activation" && (
            <motion.div
              key="desk_activation"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.25 }}
              className="flex flex-col gap-6"
            >
              <div className="text-center">
                <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-1">
                  Connectez votre compte Gmail
                </h2>
                <p className="text-sm text-[var(--text-secondary)]">
                  Autorisez FLARE AI à accéder à votre boîte mail pour activer l&apos;Assistant Mail.
                </p>
              </div>

              <div className={`${glass} p-6 flex flex-col gap-5`}>
                <div className="flex items-center gap-3 mb-2">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-500/10">
                    <Mail size={24} className="text-orange-500" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[var(--text-primary)]">
                      Activation en libre-service
                    </p>
                    <p className="text-xs text-[var(--text-secondary)] mt-0.5 leading-relaxed">
                      Contrairement au Chatbot Facebook, c&apos;est vous qui connectez directement votre compte Google. Aucune intervention de l&apos;équipe FLARE n&apos;est nécessaire.
                    </p>
                  </div>
                </div>

                <div className="border-t border-[var(--border-default)] pt-4">
                  <p className="text-sm font-semibold text-[var(--text-secondary)] mb-3">Comment ça marche :</p>
                  <div className="flex flex-col gap-3">
                    {[
                      { step: "1", text: "Cliquez sur le bouton ci-dessous pour ouvrir l'autorisation Google." },
                      { step: "2", text: "Autorisez FLARE AI à lire et envoyer des emails en votre nom." },
                      { step: "3", text: "Votre Assistant Mail sera immédiatement opérationnel." },
                    ].map((item) => (
                      <div key={item.step} className="flex items-start gap-3">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-orange-500/10 text-xs font-bold text-orange-500">
                          {item.step}
                        </div>
                        <p className="text-sm text-[var(--text-secondary)] leading-relaxed pt-0.5">{item.text}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-lg bg-emerald-500/6 border border-emerald-500/16 px-4 py-3 text-xs text-[var(--text-secondary)] leading-relaxed">
                  FLARE AI utilise uniquement les permissions nécessaires au tri et à la réponse des emails. Vos données restent privées et ne sont jamais partagées.
                </div>

                <button
                  type="button"
                  onClick={() => {
                    // Navigate to the executive desk which has the Gmail connect flow
                    onPush("executive-mail" as NavLevel);
                  }}
                  className="inline-flex items-center justify-center gap-3 rounded-2xl bg-orange-500 px-8 py-4 text-sm font-bold text-white transition-all hover:bg-orange-600 hover:-translate-y-0.5 shadow-lg shadow-orange-500/20"
                >
                  <ExternalLink size={18} />
                  Ouvrir l&apos;Assistant Mail et connecter Gmail
                </button>
              </div>

              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={goPrev}
                  className="inline-flex items-center gap-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                >
                  <ArrowLeft size={16} />
                  Précédent
                </button>
                <button
                  type="button"
                  onClick={() => setStep("desk_ready")}
                  className="inline-flex items-center gap-2 text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                >
                  J&apos;ai déjà connecté Gmail
                  <ArrowRight size={16} />
                </button>
              </div>
            </motion.div>
          )}

          {/* ============ DESK STEP : READY ============ */}
          {step === "desk_ready" && (
            <motion.div
              key="desk_ready"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.25 }}
              className="flex flex-col gap-6 items-center"
            >
              <div className={`rounded-2xl backdrop-blur-md border border-emerald-500/30 bg-emerald-500/6 shadow-[var(--shadow-card)] p-8 text-center max-w-md w-full flex flex-col items-center gap-4`}>
                <CheckCircle2 size={40} className="text-emerald-500" />
                <h2 className="text-xl font-bold text-[var(--text-primary)]">
                  Executive Desk activé !
                </h2>
                <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                  Votre bureau exécutif est prêt. L&apos;Assistant Mail trie vos emails en temps réel.
                  Les autres modules (Planning, Contacts, Fichiers) seront débloqués automatiquement selon votre plan.
                </p>

                <div className="w-full rounded-xl border border-[var(--border-default)] bg-[var(--surface-subtle)] px-4 py-3 text-left">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-2">
                    Votre abonnement
                  </p>
                  <div className="space-y-1.5 text-xs text-[var(--text-secondary)]">
                    <p>
                      Plan :{" "}
                      <span className="text-[var(--text-primary)] font-medium">
                        {DESK_PLANS.find(p => p.id === selectedDeskPlanId)?.name ?? "Pro"}
                      </span>
                    </p>
                    <p>
                      Tarif :{" "}
                      <span className="text-[var(--text-primary)] font-medium">
                        {PLAN_PRICES[selectedDeskPlanId] ?? "50 000"} Ar / mois
                      </span>
                    </p>
                    <p>
                      Statut :{" "}
                      <span className="text-emerald-600 font-medium">Actif</span>
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onPush("executive-desk" as NavLevel)}
                  className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-6 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-orange-600"
                >
                  Accéder au Bureau Exécutif
                  <ArrowRight size={16} />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Reusable form fields
// ---------------------------------------------------------------------------

function InputField({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="flex flex-col gap-1">
      {label && (
        <span className="text-xs font-medium text-[var(--text-secondary)]">{label}</span>
      )}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="rounded-lg border border-[var(--border-default)] bg-[var(--surface-subtle)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-orange-500/50 focus:outline-none focus:ring-1 focus:ring-orange-500/30 transition-colors"
      />
    </label>
  );
}

function TextareaField({
  label,
  value,
  onChange,
  placeholder,
  rows = 3,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <label className="flex flex-col gap-1">
      {label && (
        <span className="text-xs font-medium text-[var(--text-secondary)]">{label}</span>
      )}
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="rounded-lg border border-[var(--border-default)] bg-[var(--surface-subtle)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-orange-500/50 focus:outline-none focus:ring-1 focus:ring-orange-500/30 transition-colors resize-none"
      />
    </label>
  );
}

// ---------------------------------------------------------------------------
// Awaiting status display
// ---------------------------------------------------------------------------

function AwaitingStatus({
  ar,
  pageContext,
  onGoToPayment,
  onGoToChatbot,
}: {
  ar: ActivationRequest | null;
  pageContext: ActivationPageContext | null;
  onGoToPayment: () => void;
  onGoToChatbot: () => void;
}) {
  if (!ar) {
    return (
      <div className={`${glass} p-8 text-center max-w-md w-full`}>
        <Loader2 className="h-8 w-8 animate-spin text-orange-500 mx-auto mb-4" />
        <p className="text-sm text-[var(--text-secondary)]">Chargement du statut...</p>
      </div>
    );
  }

  const s = ar.status;

  type StatusDisplay = {
    icon: React.ReactNode;
    label: string;
    description: string;
    color: "blue" | "green" | "red" | "orange";
    action?: React.ReactNode;
  };

  const configs: Record<string, StatusDisplay> = {
    payment_submitted: {
      icon: <Clock size={32} className="text-[var(--accent-navy)]" />,
      label: "Preuve recue, verification en cours",
      description:
        "Notre equipe verifie votre paiement. Ce processus prend generalement quelques heures. Cette page se rafraichit automatiquement.",
      color: "blue",
    },
    payment_verified: {
      icon: <CheckCircle2 size={32} className="text-orange-500" />,
      label: "Paiement valide !",
      description:
        "Votre paiement a ete confirme. L'activation de votre chatbot va bientot commencer.",
      color: "green",
    },
    queued_for_activation: {
      icon: <Clock size={32} className="text-[var(--accent-navy)]" />,
      label: "En file d'attente",
      description:
        "Votre chatbot est en attente d&apos;activation par notre equipe. Vous serez notifie des que le processus debute.",
      color: "blue",
    },
    activation_in_progress: {
      icon: <Loader2 size={32} className="animate-spin text-[var(--accent-navy)]" />,
      label: "Activation en cours",
      description:
        "Notre equipe configure votre chatbot en ce moment. Restez sur cette page ou revenez plus tard.",
      color: "blue",
    },
    testing: {
      icon: <Loader2 size={32} className="animate-spin text-[var(--accent-navy)]" />,
      label: "Test en cours",
      description:
        "Nous testons votre chatbot pour nous assurer que tout fonctionne parfaitement.",
      color: "blue",
    },
    active: {
      icon: <CheckCircle2 size={32} className="text-orange-500" />,
      label: "Chatbot actif !",
      description:
        "Votre chatbot IA est maintenant operationnel sur votre page Facebook. Rendez-vous sur le tableau de bord pour gerer votre bot.",
      color: "green",
      action: (
        <button
          type="button"
          onClick={onGoToChatbot}
      className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-6 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-orange-600"
        >
          Acceder au chatbot
          <ArrowRight size={16} />
        </button>
      ),
    },
    blocked: {
      icon: <Clock size={32} className="text-red-400" />,
      label: "Activation bloquee",
      description:
        ar.blocked_reason ||
        "L'activation a ete suspendue. Contactez l'equipe FLARE pour plus d'informations.",
      color: "red",
    },
    rejected: {
      icon: <Clock size={32} className="text-red-400" />,
      label: "Paiement refuse",
      description:
        ar.blocked_reason ||
        "Votre paiement n'a pas pu etre valide. Vous pouvez renvoyer une nouvelle preuve.",
      color: "red",
      action: (
        <button
          type="button"
          onClick={onGoToPayment}
      className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-6 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-orange-600"
        >
          <ArrowLeft size={16} />
          Renvoyer une preuve
        </button>
      ),
    },
  };

  const display = configs[s] ?? {
    icon: <Clock size={32} className="text-[var(--text-muted)]" />,
    label: `Statut : ${s}`,
    description: "Votre demande est en cours de traitement.",
    color: "blue" as const,
  };

  const borderColor =
    display.color === "green"
      ? "border-orange-500/30"
      : display.color === "red"
      ? "border-red-500/30"
      : display.color === "orange"
      ? "border-orange-500/30"
      : "border-[var(--accent-navy)]/24";

  const bgColor =
    display.color === "green"
      ? "bg-orange-500/6"
      : display.color === "red"
      ? "bg-red-500/5"
      : display.color === "orange"
      ? "bg-orange-500/5"
      : "bg-[var(--accent-navy)]/6";

  const importedPages = pageContext?.imported_pages ?? [];
  const selectedPageId = pageContext?.selected_page_id || null;
  const selectedPageName = importedPages.find((p) => p.page_id === selectedPageId)?.page_name || null;
  const targetPageId = pageContext?.target_page_id || ar.activation_target_page_id || null;
  const targetPageName = pageContext?.target_page_name || ar.facebook_page_name || null;
  const targetPageUrl = pageContext?.target_page_url || ar.facebook_page_url || null;

  return (
    <div
      className={`rounded-2xl backdrop-blur-md border shadow-[var(--shadow-card)] p-8 text-center max-w-md w-full flex flex-col items-center gap-4 ${borderColor} ${bgColor}`}
    >
      {display.icon}
      <h2 className="text-xl font-bold text-[var(--text-primary)]">{display.label}</h2>
      <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
        {display.description}
      </p>
      {(ar.selected_plan_id || ar.applied_plan_id) && (
        <div className="w-full rounded-xl border border-[var(--border-default)] bg-[var(--surface-subtle)] px-4 py-3 text-left">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-2">
            Plan et abonnement
          </p>
          <div className="space-y-1.5 text-xs text-[var(--text-secondary)]">
            <p>
              Plan demande:{" "}
              <span className="text-[var(--text-primary)] font-medium">{ar.selected_plan_id || "-"}</span>
            </p>
            <p>
              Plan applique:{" "}
              <span className="text-[var(--text-primary)] font-medium">{ar.applied_plan_id || "-"}</span>
            </p>
            <p>
              Statut abonnement:{" "}
              <span className="text-[var(--text-primary)] font-medium">{ar.subscription_status || "-"}</span>
            </p>
          </div>
        </div>
      )}
      {(targetPageName || importedPages.length > 0) && (
        <div className="w-full rounded-xl border border-[var(--border-default)] bg-[var(--surface-subtle)] px-4 py-3 text-left">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-2">
            Contexte page Facebook
          </p>
          <div className="space-y-1.5 text-xs text-[var(--text-secondary)]">
            <p>
              Pages importees:{" "}
              <span className="text-[var(--text-primary)] font-medium">{importedPages.length || "-"}</span>
            </p>
            <p>
              Selection FLARE:{" "}
              <span className="text-[var(--text-primary)] font-medium">{selectedPageName || "-"}</span>
            </p>
            <p>
              ID selection FLARE:{" "}
              <span className="text-[var(--text-primary)] font-medium">{selectedPageId || "-"}</span>
            </p>
            <p>
              Page demandee:{" "}
              <span className="text-[var(--text-primary)] font-medium">{targetPageName || "-"}</span>
            </p>
            <p>
              ID page demandee:{" "}
              <span className="text-[var(--text-primary)] font-medium">{targetPageId || "-"}</span>
            </p>
            <p className="truncate">
              URL cible:{" "}
              <span className="text-[var(--text-primary)] font-medium">{targetPageUrl || "-"}</span>
            </p>
          </div>
        </div>
      )}
      {display.action}
      {!display.action && s !== "active" && (
        <p className="text-xs text-[var(--text-muted)] mt-2">
          Rafraichissement automatique toutes les 15 secondes
        </p>
      )}
    </div>
  );
}


