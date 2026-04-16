"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2,
  CreditCard,
  Building2,
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
} from "lucide-react";
import type { NavLevel } from "@/components/NavBreadcrumb";
import type { FacebookMessengerPage } from "@/lib/facebookMessenger";
import {
  getAssistedLaunchConfig,
  type LaunchConfig,
  getMyActivationRequest,
  type ActivationRequest,
  createActivationRequest,
  updateActivationRequest,
  getManualPaymentMethods,
  type PaymentMethod,
  submitManualPayment,
  type ManualPaymentData,
  getMyManualPayments,
  type ManualPaymentSubmission,
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
}

type WizardStep =
  | "choose_plan"
  | "payment"
  | "config"
  | "flare_admin"
  | "awaiting";

const STEP_ORDER: WizardStep[] = [
  "choose_plan",
  "payment",
  "config",
  "flare_admin",
  "awaiting",
];

const STEP_LABELS: Record<WizardStep, string> = {
  choose_plan: "Offre",
  payment: "Paiement",
  config: "Configuration",
  flare_admin: "Connexion",
  awaiting: "Activation",
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

const PLAN_PRICES: Record<string, string> = {
  starter: "30 000",
  pro: "60 000",
  business: "120 000",
  enterprise: "Sur devis",
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

const SECTORS = [
  "Commerce",
  "Restauration",
  "Services",
  "Mode",
  "Tech",
  "Sante",
  "Education",
  "Autre",
];

const LANGUAGES = [
  { value: "fr", label: "Francais" },
  { value: "mg", label: "Malagasy" },
  { value: "en", label: "Anglais" },
];

const TONES = [
  { value: "professionnel", label: "Professionnel" },
  { value: "amical", label: "Amical" },
  { value: "decontracte", label: "Decontracte" },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const glass =
  "rounded-2xl border border-[var(--border-default)] bg-[var(--surface-base)] shadow-[var(--shadow-card)]";

function stepIndexOf(s: WizardStep): number {
  return STEP_ORDER.indexOf(s);
}

function statusToStep(status: string): WizardStep {
  switch (status) {
    case "draft":
    case "awaiting_payment":
      return "payment";
    case "payment_submitted":
      return "awaiting";
    case "payment_verified":
    case "awaiting_flare_page_admin_access":
      return "flare_admin";
    case "queued_for_activation":
    case "activation_in_progress":
    case "testing":
      return "awaiting";
    case "rejected":
      return "payment";
    case "active":
      return "awaiting";
    default:
      return "choose_plan";
  }
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StepIndicator({
  current,
  completed,
}: {
  current: WizardStep;
  completed: WizardStep[];
}) {
  const currentIdx = stepIndexOf(current);

  return (
    <div className="flex items-center justify-center gap-3 mb-8">
      {STEP_ORDER.map((step, idx) => {
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
}: ChatbotActivationPageProps) {
  // ---- state ----
  const [step, setStep] = useState<WizardStep>("choose_plan");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [ar, setAr] = useState<ActivationRequest | null>(null);
  const [launchConfig, setLaunchConfig] = useState<LaunchConfig | null>(null);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [submissions, setSubmissions] = useState<ManualPaymentSubmission[]>([]);

  // plan selection
  const [selectedPlanId, setSelectedPlanId] = useState<ActivationPlanId>("pro");

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
        const [arRes, lcRes, pmRes] = await Promise.allSettled([
          getMyActivationRequest(t),
          getAssistedLaunchConfig(t),
          getManualPaymentMethods(t),
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

      setAr(fetchedAr);
      setLaunchConfig(fetchedLc);
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
          setStep(statusToStep(fetchedAr.status));
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
          const target: WizardStep = statusToStep(updated.status);
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
              setStep(statusToStep(existingAr.status));
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
      const planId = ar?.selected_plan_id || selectedPlanId;
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
      // refresh AR
      const refreshed = await getMyActivationRequest(t);
      setAr(refreshed.activation_request);
      setStep("awaiting");
    } catch (e) {
      const msg = parseApiError(e, "Erreur lors de la soumission du paiement");
      setError(msg);
    } finally {
      setBusy(false);
    }
  };

  const handleSaveConfig = async () => {
    
    if (importedPages.length > 0 && !targetPageId) {
      setError("Choisissez la page Facebook a activer.");
      return;
    }

    setBusy(true);
    setError(null);
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

  // ---- navigation ----
  const canGoPrev = stepIndexOf(step) > 0;

  const goPrev = () => {
    const idx = stepIndexOf(step);
    if (idx > 0) {
      setError(null);
      setStep(STEP_ORDER[idx - 1]);
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
            Activation du chatbot
          </h1>
          <p className="text-sm text-[var(--text-secondary)]">
            Suivez les etapes pour activer votre chatbot IA sur Facebook
            Messenger.
          </p>
        </motion.div>

        {/* Step indicator */}
        <StepIndicator current={step} completed={completedSteps} />

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
          {/* ============ STEP 1 : CHOOSE PLAN ============ */}
          {step === "choose_plan" && (
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
                          ? "border-orange-500/40 bg-orange-500/[0.03] shadow-2xl shadow-orange-500/10 scale-[1.02] z-10"
                          : isSelected
                          ? "border-orange-500 bg-orange-500/5 shadow-lg shadow-orange-500/10"
                          : "border-[var(--border-default)] bg-[var(--surface-subtle)] hover:border-[var(--border-subtle)]"
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
                      <ul className="relative z-10 flex flex-col gap-3 flex-1">
                        {plan.features.map((f) => (
                          <li key={f} className="flex items-start gap-2.5 text-sm font-medium text-[var(--text-secondary)]">
                            <div className="w-4 h-4 rounded-full bg-orange-500/10 flex items-center justify-center shrink-0 mt-0.5">
                              <CheckCircle2 size={10} className="text-orange-500" />
                            </div>
                            {f}
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
                    {selectedPlan.name}
                  </p>
                </div>
                <p className="text-xl font-bold text-orange-500">
                  {selectedPlan.price}
                </p>
              </div>

              {/* Payment methods */}
              <div>
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
                  Configurez votre chatbot
                </h2>
                <p className="text-sm text-[var(--text-secondary)]">
                  Ces informations seront utilisees pour personnaliser votre bot.
                </p>
              </div>

              {/* Contact */}
              <fieldset className={`${glass} p-5 flex flex-col gap-4`}>
                <legend className="text-sm font-semibold text-orange-500 flex items-center gap-2 mb-1">
                  <Building2 size={16} />
                  Contact
                </legend>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <InputField
                    label="Nom complet"
                    value={cfg.contact_full_name}
                    onChange={(v) => updateCfg("contact_full_name", v)}
                    placeholder="Votre nom complet"
                  />
                  <InputField
                    label="Email"
                    type="email"
                    value={cfg.contact_email}
                    onChange={(v) => updateCfg("contact_email", v)}
                    placeholder="email@exemple.com"
                  />
                  <InputField
                    label="Telephone"
                    type="tel"
                    value={cfg.contact_phone}
                    onChange={(v) => updateCfg("contact_phone", v)}
                    placeholder="034 00 000 00"
                  />
                  <InputField
                    label="WhatsApp"
                    type="tel"
                    value={cfg.contact_whatsapp}
                    onChange={(v) => updateCfg("contact_whatsapp", v)}
                    placeholder="034 00 000 00"
                  />
                </div>
              </fieldset>

              {/* Entreprise */}
              <fieldset className={`${glass} p-5 flex flex-col gap-4`}>
                <legend className="text-sm font-semibold text-orange-500 flex items-center gap-2 mb-1">
                  <Building2 size={16} />
                  Entreprise
                </legend>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <InputField
                    label="Nom de l'entreprise"
                    value={cfg.business_name}
                    onChange={(v) => updateCfg("business_name", v)}
                    placeholder="Ma Boutique"
                  />
                  <SelectField
                    label="Secteur d'activite"
                    value={cfg.business_sector}
                    onChange={(v) => updateCfg("business_sector", v)}
                    options={SECTORS.map((s) => ({ value: s, label: s }))}
                    placeholder="Choisir..."
                  />
                  <InputField
                    label="Ville"
                    value={cfg.business_city}
                    onChange={(v) => updateCfg("business_city", v)}
                    placeholder="Antananarivo"
                  />
                  <InputField
                    label="Pays"
                    value={cfg.business_country}
                    onChange={(v) => updateCfg("business_country", v)}
                    placeholder="Madagascar"
                  />
                </div>
                <TextareaField
                  label="Description de l'entreprise"
                  value={cfg.business_description}
                  onChange={(v) => updateCfg("business_description", v)}
                  placeholder="Decrivez brievement votre activite..."
                />
              </fieldset>

              {/* Facebook */}
              <fieldset className={`${glass} p-5 flex flex-col gap-4`}>
                <legend className="text-sm font-semibold text-orange-500 flex items-center gap-2 mb-1">
                  <Facebook size={16} />
                  Facebook
                </legend>
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
                              page.page_id === selectedPageId
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
                        <p className="text-xs font-medium text-[var(--text-secondary)] mb-1">Page selectionnee dans FLARE</p>
                        <p className="text-sm text-[var(--text-primary)] font-medium truncate">
                          {selectedPageInFlare?.page_name || "-"}
                        </p>
                      </div>
                      <SelectField
                        label="Page a activer (cible)"
                        value={targetPageId}
                        onChange={setPendingTargetPageId}
                        options={importedPages.map((page) => ({
                          value: page.page_id,
                          label: page.page_name,
                        }))}
                        placeholder="Choisir la page a activer"
                      />
                    </div>

                    {targetPage && (
                      <div className="rounded-lg border border-[var(--accent-navy)]/20 bg-[var(--accent-navy)]/7 px-3 py-2 text-xs text-[var(--text-secondary)]">
                        <span className="font-semibold text-[var(--text-primary)]">Activation demandee:</span>{" "}
                        {targetPage.page_name} ({targetPage.page_id})
                      </div>
                    )}
                  </>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <InputField
                      label="Nom de la page"
                      value={cfg.facebook_page_name}
                      onChange={(v) => updateCfg("facebook_page_name", v)}
                      placeholder="Ma Page Facebook"
                    />
                    <InputField
                      label="URL de la page"
                      value={cfg.facebook_page_url}
                      onChange={(v) => updateCfg("facebook_page_url", v)}
                      placeholder="https://facebook.com/mapage"
                    />
                  </div>
                )}
                <InputField
                  label="Email admin Facebook"
                  type="email"
                  value={cfg.facebook_admin_email}
                  onChange={(v) => updateCfg("facebook_admin_email", v)}
                  placeholder="admin@exemple.com"
                />
              </fieldset>

              {/* Chatbot */}
              <fieldset className={`${glass} p-5 flex flex-col gap-4`}>
                <legend className="text-sm font-semibold text-orange-500 flex items-center gap-2 mb-1">
                  <CheckCircle2 size={16} />
                  Chatbot
                </legend>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <InputField
                    label="Nom du bot"
                    value={cfg.bot_name}
                    onChange={(v) => updateCfg("bot_name", v)}
                    placeholder="FLARE Assistant"
                  />
                  <SelectField
                    label="Langue principale"
                    value={cfg.primary_language}
                    onChange={(v) => updateCfg("primary_language", v)}
                    options={LANGUAGES}
                  />
                  <SelectField
                    label="Ton"
                    value={cfg.tone}
                    onChange={(v) => updateCfg("tone", v)}
                    options={TONES}
                  />
                </div>
                <TextareaField
                  label="Message d'accueil"
                  value={cfg.greeting_message}
                  onChange={(v) => updateCfg("greeting_message", v)}
                  placeholder="Bonjour ! Comment puis-je vous aider ?"
                />
              </fieldset>

              {/* Vente */}
              <fieldset className={`${glass} p-5 flex flex-col gap-4`}>
                <legend className="text-sm font-semibold text-orange-500 flex items-center gap-2 mb-1">
                  <CreditCard size={16} />
                  Vente
                </legend>
                <TextareaField
                  label="Resume de l'offre"
                  value={cfg.offer_summary}
                  onChange={(v) => updateCfg("offer_summary", v)}
                  placeholder="Decrivez vos produits/services principaux..."
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <InputField
                    label="Horaires d'ouverture"
                    value={cfg.opening_hours}
                    onChange={(v) => updateCfg("opening_hours", v)}
                    placeholder="Lun-Sam 8h-18h"
                  />
                  <InputField
                    label="Zones de livraison"
                    value={cfg.delivery_zones}
                    onChange={(v) => updateCfg("delivery_zones", v)}
                    placeholder="Antananarivo, Antsirabe..."
                  />
                </div>
              </fieldset>

              {/* Notes */}
              <fieldset className={`${glass} p-5 flex flex-col gap-4`}>
                <legend className="text-sm font-semibold text-[var(--text-secondary)] mb-1">
                  Notes pour FLARE (optionnel)
                </legend>
                <TextareaField
                  label=""
                  value={cfg.notes_for_flare}
                  onChange={(v) => updateCfg("notes_for_flare", v)}
                  placeholder="Instructions speciales, questions, remarques..."
                />
              </fieldset>

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
                  disabled={busy}
                  onClick={handleSaveConfig}
              className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-6 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-orange-600 disabled:opacity-50"
                >
                  {busy ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <>
                      Suivant
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
                  Connexion de votre page Facebook
                </h2>
                <p className="text-sm text-[var(--text-secondary)]">
                  Un technicien FLARE va connecter votre chatbot a votre page Facebook.
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
                      Notre equipe technique se chargera de connecter votre chatbot
                      a votre page Facebook. Vous n&apos;avez rien a faire de votre cote.
                    </p>
                  </div>
                </div>

                <div className="border-t border-[var(--border-default)] pt-4">
                  <p className="text-sm font-semibold text-[var(--text-secondary)] mb-3">
                    Informations de votre page :
                  </p>
                  <div className="flex flex-col gap-2 text-sm text-[var(--text-secondary)]">
                    <div className="flex justify-between">
                      <span>Page selectionnee FLARE</span>
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
                      <span>Page demandee</span>
                      <span className="text-[var(--text-primary)] font-medium truncate max-w-[60%]">
                        {displayedPageContext.target_page_name || cfg.facebook_page_name || "-"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>ID page demandee</span>
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
                      <span>Email admin</span>
                      <span className="text-[var(--text-primary)] font-medium">{cfg.facebook_admin_email || "-"}</span>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg bg-[var(--accent-navy)]/6 border border-[var(--accent-navy)]/16 px-4 py-3 text-xs text-[var(--text-secondary)] leading-relaxed">
                  En cliquant sur &quot;Confirmer&quot;, un technicien FLARE sera notifie
                  et se chargera de connecter votre chatbot. Vous serez prevenu
                  des que votre chatbot sera actif.
                </div>

                {/* Checkbox */}
                <label className="flex items-start gap-3 mt-2 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={adminConfirmed}
                    onChange={(e) => setAdminConfirmed(e.target.checked)}
                    className="mt-0.5 h-5 w-5 rounded border-[var(--border-default)] bg-[var(--surface-subtle)] text-orange-500 focus:ring-orange-500/30 accent-orange-500"
                  />
                  <span className="text-sm text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors">
                    Je confirme les informations ci-dessus et je souhaite que
                    l&apos;equipe FLARE connecte mon chatbot.
                  </span>
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
                  disabled={busy || !adminConfirmed}
                  onClick={handleConfirmAdmin}
              className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-6 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-orange-600 disabled:opacity-50"
                >
                  {busy ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <>
                      Confirmer et notifier l&apos;equipe
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

function SelectField({
  label,
  value,
  onChange,
  options,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
}) {
  return (
    <label className="flex flex-col gap-1">
      {label && (
        <span className="text-xs font-medium text-[var(--text-secondary)]">{label}</span>
      )}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-[var(--border-default)] bg-[var(--surface-subtle)] px-3 py-2 text-sm text-[var(--text-primary)] focus:border-orange-500/50 focus:outline-none focus:ring-1 focus:ring-orange-500/30 transition-colors"
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
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
        "Votre chatbot est en attente d'activation par notre equipe. Vous serez notifie des que le processus debute.",
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


