"use client";

import { useState, useEffect, useCallback, useRef } from "react";
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
} from "lucide-react";
import type { NavLevel } from "@/components/NavBreadcrumb";
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

// ---------------------------------------------------------------------------
// Error parsing helper
// ---------------------------------------------------------------------------

/** Extrait le message lisible depuis une erreur API (qui peut etre du JSON brut). */
function parseApiError(e: unknown, fallback = "Une erreur est survenue."): string {
  if (!(e instanceof Error)) return fallback;
  const raw = e.message.trim();
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

function isMissingOrganizationScopeError(message: string): boolean {
  return /organisation|espace|scope|selectionnez d'abord/i.test(message);
}

// ---------------------------------------------------------------------------
// Types & constants
// ---------------------------------------------------------------------------

interface ChatbotActivationPageProps {
  token?: string | null;
  getFreshToken?: (forceRefresh?: boolean) => Promise<string | null>;
  onPush: (level: NavLevel) => void;
  currentScopeType?: "personal" | "organization";
  onRequestOrganizationSelection?: () => void;
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

const PLANS = [
  {
    id: "starter",
    name: "Starter",
    price: "30 000 Ar/mois",
    features: [
      "1 page Facebook",
      "500 messages/mois",
      "Bot actif 24/7",
      "Catalogue simple",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    price: "60 000 Ar/mois",
    popular: true,
    features: [
      "3 pages Facebook",
      "2 000 messages/mois",
      "Bot actif 24/7",
      "Catalogue avance",
      "Stats & dashboard",
      "Support prioritaire",
    ],
  },
  {
    id: "business",
    name: "Business",
    price: "120 000 Ar/mois",
    features: [
      "Pages illimitees",
      "Messages illimites",
      "Bot actif 24/7",
      "Catalogue complet",
      "Stats avancees",
      "Support dedie",
      "Operateur FLARE assigne",
    ],
  },
  {
    id: "enterprise",
    name: "Entreprise",
    price: "Sur devis",
    features: [
      "Tout Business inclus",
      "Solution sur mesure",
      "Integration personnalisee",
      "Accompagnement dedie",
      "SLA garanti",
    ],
    contact: true,
  },
];

const PLAN_PRICES: Record<string, string> = {
  starter: "30 000",
  pro: "60 000",
  business: "120 000",
  enterprise: "Sur devis",
};

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
  "rounded-2xl backdrop-blur-md bg-[var(--bg-glass)] border border-[var(--border-glass)] shadow-[var(--shadow-card)]";

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
                  : "bg-white/10"
              }`}
            />
            <span
              className={`text-[10px] font-medium hidden sm:block ${
                isCurrent
                  ? "text-orange-400"
                  : isDone
                  ? "text-fg/50"
                  : "text-fg/25"
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
      className="inline-flex items-center gap-1 rounded-md bg-white/5 px-2 py-1 text-xs text-fg/60 hover:bg-white/10 hover:text-fg/80 transition-colors"
    >
      {copied ? <Check size={12} /> : <Copy size={12} />}
      {copied ? "Copie" : "Copier"}
    </button>
  );
}

function OrganizationScopeRequiredPanel({
  onSelectWorkspace,
}: {
  onSelectWorkspace?: () => void;
}) {
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-2xl px-4 py-10 md:px-8 md:py-14">
        <div className={`${glass} p-6 md:p-8 text-center flex flex-col items-center gap-4`}>
          <div className="h-12 w-12 rounded-xl bg-orange-500/15 text-orange-400 flex items-center justify-center">
            <Building2 size={22} />
          </div>
          <h2 className="text-xl font-semibold text-fg/90">Choisissez d&apos;abord votre espace de travail</h2>
          <p className="max-w-lg text-sm text-fg/60 leading-relaxed">
            L&apos;activation du chatbot et le paiement sont rattaches a une organisation.
            Ouvrez le selecteur d&apos;espace puis choisissez une organisation active.
          </p>
          <button
            type="button"
            onClick={() => onSelectWorkspace?.()}
            className="inline-flex items-center gap-2 rounded-xl bg-orange-500 hover:bg-orange-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors"
          >
            Choisir mon espace
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function ChatbotActivationPage({
  token,
  getFreshToken,
  onPush,
  currentScopeType = "personal",
  onRequestOrganizationSelection,
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
  const [selectedPlanId, setSelectedPlanId] = useState<string>("pro");

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

  // flare admin
  const [adminConfirmed, setAdminConfirmed] = useState(false);

  // polling ref
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ---- token helper ----
  const resolveToken = useCallback(async (): Promise<string | null> => {
    if (getFreshToken) return await getFreshToken();
    return token ?? null;
  }, [getFreshToken, token]);

  // ---- initial load ----
  useEffect(() => {
    let cancelled = false;

    void (async () => {
      setLoading(true);
      if (currentScopeType !== "organization") {
        setLoading(false);
        return;
      }
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
        setPaymentMethods(allMethods);
        if (allMethods.length > 0 && !payMethodCode) {
          setPayMethodCode(allMethods[0].code);
        }

        if (fetchedAr) {
          setSelectedPlanId(fetchedAr.selected_plan_id || "pro");
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
  }, [currentScopeType, resolveToken]);

  // ---- polling (awaiting step) ----
  useEffect(() => {
    if (currentScopeType !== "organization" || step !== "awaiting") {
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
  }, [currentScopeType, step, resolveToken]);

  // ---- actions ----
  const handleChoosePlan = async () => {
    if (currentScopeType !== "organization") {
      setError("Selectionnez d'abord une organisation active.");
      onRequestOrganizationSelection?.();
      return;
    }
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
      setStep("payment");
    } catch (e) {
      const msg = parseApiError(e, "Erreur lors de la creation");
      if (isMissingOrganizationScopeError(msg)) {
        setError("Selectionnez d'abord une organisation active.");
        onRequestOrganizationSelection?.();
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
              setSelectedPlanId(existingAr.selected_plan_id || selectedPlanId);
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
    if (currentScopeType !== "organization") {
      setError("Selectionnez d'abord une organisation active.");
      onRequestOrganizationSelection?.();
      return;
    }
    if (!txRef.trim()) {
      setError("Veuillez indiquer la reference de transaction.");
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
      if (isMissingOrganizationScopeError(msg)) {
        setError("Selectionnez d'abord une organisation active.");
        onRequestOrganizationSelection?.();
        return;
      }
      setError(msg);
    } finally {
      setBusy(false);
    }
  };

  const handleSaveConfig = async () => {
    if (currentScopeType !== "organization") {
      setError("Selectionnez d'abord une organisation active.");
      onRequestOrganizationSelection?.();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const t = await resolveToken();
      if (!t) throw new Error("Session expiree");
      const updates: Record<string, string> = {};
      for (const [k, v] of Object.entries(cfg)) {
        if (v) updates[k] = v;
      }
      const res = await updateActivationRequest(updates, t);
      setAr(res.activation_request);
      setStep("flare_admin");
    } catch (e) {
      const msg = parseApiError(e, "Erreur lors de la sauvegarde");
      if (isMissingOrganizationScopeError(msg)) {
        setError("Selectionnez d'abord une organisation active.");
        onRequestOrganizationSelection?.();
        return;
      }
      setError(msg);
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmAdmin = async () => {
    if (currentScopeType !== "organization") {
      setError("Selectionnez d'abord une organisation active.");
      onRequestOrganizationSelection?.();
      return;
    }
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
      if (isMissingOrganizationScopeError(msg)) {
        setError("Selectionnez d'abord une organisation active.");
        onRequestOrganizationSelection?.();
        return;
      }
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

  const updateCfg = (key: string, value: string) => {
    setCfg((prev) => ({ ...prev, [key]: value }));
  };

  // ---- loading state ----
  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-orange-400/80" />
      </div>
    );
  }

  if (currentScopeType !== "organization") {
    return (
      <OrganizationScopeRequiredPanel
        onSelectWorkspace={onRequestOrganizationSelection}
      />
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
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-fg/90 mb-1">
            Activation du chatbot
          </h1>
          <p className="text-sm text-[var(--text-muted)]">
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
              className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200"
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
              <div className="text-center">
                <h2 className="text-lg font-semibold text-fg/85 mb-1">
                  Choisissez votre offre
                </h2>
                <p className="text-sm text-[var(--text-muted)]">
                  Selectionnez le plan qui correspond a votre activite.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {PLANS.map((plan) => {
                  const isSelected = selectedPlanId === plan.id;
                  const isEnterprise = (plan as any).contact === true;
                  return (
                    <motion.button
                      key={plan.id}
                      type="button"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => {
                        if (isEnterprise) {
                          window.location.href = "mailto:contact@ramsflare.com?subject=Offre%20Entreprise%20FLARE%20AI";
                          return;
                        }
                        setSelectedPlanId(plan.id);
                      }}
                      className={`relative flex flex-col items-start text-left p-5 rounded-2xl border transition-all duration-200 ${
                        isSelected
                          ? "border-orange-500 bg-orange-500/5 shadow-lg shadow-orange-500/10"
                          : "border-fg/[0.08] bg-fg/[0.02] hover:border-fg/[0.15] hover:bg-fg/[0.04]"
                      }`}
                    >
                      {plan.popular && (
                        <span className="absolute -top-2.5 right-3 rounded-full bg-orange-500 px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                          Populaire
                        </span>
                      )}
                      <p className="text-base font-semibold text-fg/90">
                        {plan.name}
                      </p>
                      <p className="text-lg font-bold text-orange-400 mt-1">
                        {plan.price}
                      </p>
                      <ul className="mt-4 flex flex-col gap-1.5 text-sm text-fg/60">
                        {plan.features.map((f) => (
                          <li key={f} className="flex items-start gap-2">
                            <CheckCircle2
                              size={14}
                              className="mt-0.5 shrink-0 text-orange-400/70"
                            />
                            <span>{f}</span>
                          </li>
                        ))}
                      </ul>
                      {isEnterprise ? (
                        <div className="mt-4 w-full">
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-fg/50">
                            <MessageSquare size={14} />
                            Contactez-nous
                          </span>
                        </div>
                      ) : isSelected ? (
                        <div className="mt-4 w-full">
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-orange-400">
                            <CheckCircle2 size={14} />
                            Selectionne
                          </span>
                        </div>
                      ) : null}
                    </motion.button>
                  );
                })}
              </div>

              {/* Next */}
              <div className="flex justify-end">
                <button
                  type="button"
                  disabled={busy}
                  onClick={handleChoosePlan}
                  className="inline-flex items-center gap-2 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-50 px-6 py-2.5 text-sm font-semibold text-white transition-colors"
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
                  <p className="text-xs uppercase tracking-widest text-fg/40 mb-1">
                    Plan selectionne
                  </p>
                  <p className="text-lg font-bold text-fg/90">
                    {selectedPlan.name}
                  </p>
                </div>
                <p className="text-xl font-bold text-orange-400">
                  {selectedPlan.price}
                </p>
              </div>

              {/* Payment methods */}
              <div>
                <h3 className="text-sm font-semibold text-fg/70 mb-3 flex items-center gap-2">
                  <CreditCard size={16} className="text-orange-400" />
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
                            : "border-fg/[0.08] bg-fg/[0.02] hover:border-fg/[0.15]"
                        }`}
                      >
                        <p className="font-semibold text-fg/85 text-sm">
                          {pm.label}
                        </p>
                        <p className="text-xs text-fg/50 mt-1">
                          {pm.recipient_name}
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          <code className="text-sm font-mono text-orange-400 bg-white/5 px-2 py-0.5 rounded">
                            {pm.recipient_number}
                          </code>
                          <CopyButton text={pm.recipient_number} />
                        </div>
                        {pm.instructions && (
                          <p className="text-xs text-fg/40 mt-2 leading-relaxed">
                            {pm.instructions}
                          </p>
                        )}
                      </button>
                    );
                  })}
                </div>
                {paymentMethods.length === 0 && (
                  <p className="text-sm text-fg/40 italic">
                    Aucune methode de paiement disponible pour le moment.
                  </p>
                )}
              </div>

              {/* Payment form */}
              <div className={`${glass} p-5 flex flex-col gap-4`}>
                <h3 className="text-sm font-semibold text-fg/70">
                  Informations de paiement
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <label className="flex flex-col gap-1">
                    <span className="text-xs font-medium text-fg/50">
                      Nom complet du payeur
                    </span>
                    <input
                      type="text"
                      value={payerName}
                      onChange={(e) => setPayerName(e.target.value)}
                      placeholder="Nom et prenom"
                      className="rounded-lg border border-fg/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-fg/90 placeholder:text-fg/25 focus:border-orange-500/50 focus:outline-none focus:ring-1 focus:ring-orange-500/30 transition-colors"
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-xs font-medium text-fg/50">
                      Telephone du payeur
                    </span>
                    <input
                      type="tel"
                      value={payerPhone}
                      onChange={(e) => setPayerPhone(e.target.value)}
                      placeholder="034 00 000 00"
                      className="rounded-lg border border-fg/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-fg/90 placeholder:text-fg/25 focus:border-orange-500/50 focus:outline-none focus:ring-1 focus:ring-orange-500/30 transition-colors"
                    />
                  </label>
                </div>
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-fg/50">
                    Reference de transaction *
                  </span>
                  <input
                    type="text"
                    value={txRef}
                    onChange={(e) => setTxRef(e.target.value)}
                    placeholder="Ex: MP240501XYZ"
                    required
                    className="rounded-lg border border-fg/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-fg/90 placeholder:text-fg/25 focus:border-orange-500/50 focus:outline-none focus:ring-1 focus:ring-orange-500/30 transition-colors"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-fg/50">
                    Notes (optionnel)
                  </span>
                  <textarea
                    value={payNotes}
                    onChange={(e) => setPayNotes(e.target.value)}
                    rows={2}
                    placeholder="Informations complementaires..."
                    className="rounded-lg border border-fg/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-fg/90 placeholder:text-fg/25 focus:border-orange-500/50 focus:outline-none focus:ring-1 focus:ring-orange-500/30 transition-colors resize-none"
                  />
                </label>
              </div>

              {/* Nav */}
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={goPrev}
                  className="inline-flex items-center gap-2 text-sm text-fg/50 hover:text-fg/80 transition-colors"
                >
                  <ArrowLeft size={16} />
                  Precedent
                </button>
                <button
                  type="button"
                  disabled={busy || !txRef.trim()}
                  onClick={handleSubmitPayment}
                  className="inline-flex items-center gap-2 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-50 px-6 py-2.5 text-sm font-semibold text-white transition-colors"
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
                <h2 className="text-lg font-semibold text-fg/85 mb-1">
                  Configurez votre chatbot
                </h2>
                <p className="text-sm text-[var(--text-muted)]">
                  Ces informations seront utilisees pour personnaliser votre bot.
                </p>
              </div>

              {/* Contact */}
              <fieldset className={`${glass} p-5 flex flex-col gap-4`}>
                <legend className="text-sm font-semibold text-orange-400 flex items-center gap-2 mb-1">
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
                <legend className="text-sm font-semibold text-orange-400 flex items-center gap-2 mb-1">
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
                <legend className="text-sm font-semibold text-orange-400 flex items-center gap-2 mb-1">
                  <Facebook size={16} />
                  Facebook
                </legend>
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
                <legend className="text-sm font-semibold text-orange-400 flex items-center gap-2 mb-1">
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
                <legend className="text-sm font-semibold text-orange-400 flex items-center gap-2 mb-1">
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
                <legend className="text-sm font-semibold text-fg/60 mb-1">
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
                  className="inline-flex items-center gap-2 text-sm text-fg/50 hover:text-fg/80 transition-colors"
                >
                  <ArrowLeft size={16} />
                  Precedent
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={handleSaveConfig}
                  className="inline-flex items-center gap-2 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-50 px-6 py-2.5 text-sm font-semibold text-white transition-colors"
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
                <h2 className="text-lg font-semibold text-fg/85 mb-1">
                  Connexion de votre page Facebook
                </h2>
                <p className="text-sm text-[var(--text-muted)]">
                  Un technicien FLARE va connecter votre chatbot a votre page Facebook.
                </p>
              </div>

              <div className={`${glass} p-6 flex flex-col gap-5`}>
                <div className="flex items-center gap-3 mb-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10">
                    <Facebook size={20} className="text-blue-400" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-fg/85">
                      Comment ca marche ?
                    </p>
                    <p className="text-xs text-fg/50 mt-1 leading-relaxed">
                      Notre equipe technique se chargera de connecter votre chatbot
                      a votre page Facebook. Vous n&apos;avez rien a faire de votre cote.
                    </p>
                  </div>
                </div>

                <div className="border-t border-fg/[0.06] pt-4">
                  <p className="text-sm font-semibold text-fg/70 mb-3">
                    Informations de votre page :
                  </p>
                  <div className="flex flex-col gap-2 text-sm text-fg/60">
                    <div className="flex justify-between">
                      <span>Page Facebook</span>
                      <span className="text-fg/80 font-medium">{cfg.facebook_page_name || "-"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>URL</span>
                      <span className="text-fg/80 font-medium truncate max-w-[60%]">{cfg.facebook_page_url || "-"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Email admin</span>
                      <span className="text-fg/80 font-medium">{cfg.facebook_admin_email || "-"}</span>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg bg-blue-500/5 border border-blue-500/10 px-4 py-3 text-xs text-fg/50 leading-relaxed">
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
                    className="mt-0.5 h-5 w-5 rounded border-fg/20 bg-white/5 text-orange-500 focus:ring-orange-500/30 accent-orange-500"
                  />
                  <span className="text-sm text-fg/70 group-hover:text-fg/90 transition-colors">
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
                  className="inline-flex items-center gap-2 text-sm text-fg/50 hover:text-fg/80 transition-colors"
                >
                  <ArrowLeft size={16} />
                  Precedent
                </button>
                <button
                  type="button"
                  disabled={busy || !adminConfirmed}
                  onClick={handleConfirmAdmin}
                  className="inline-flex items-center gap-2 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-50 px-6 py-2.5 text-sm font-semibold text-white transition-colors"
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
        <span className="text-xs font-medium text-fg/50">{label}</span>
      )}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="rounded-lg border border-fg/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-fg/90 placeholder:text-fg/25 focus:border-orange-500/50 focus:outline-none focus:ring-1 focus:ring-orange-500/30 transition-colors"
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
        <span className="text-xs font-medium text-fg/50">{label}</span>
      )}
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="rounded-lg border border-fg/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-fg/90 placeholder:text-fg/25 focus:border-orange-500/50 focus:outline-none focus:ring-1 focus:ring-orange-500/30 transition-colors resize-none"
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
        <span className="text-xs font-medium text-fg/50">{label}</span>
      )}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-fg/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-fg/90 focus:border-orange-500/50 focus:outline-none focus:ring-1 focus:ring-orange-500/30 transition-colors"
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
  onGoToPayment,
  onGoToChatbot,
}: {
  ar: ActivationRequest | null;
  onGoToPayment: () => void;
  onGoToChatbot: () => void;
}) {
  if (!ar) {
    return (
      <div className={`${glass} p-8 text-center max-w-md w-full`}>
        <Loader2 className="h-8 w-8 animate-spin text-orange-400 mx-auto mb-4" />
        <p className="text-sm text-fg/60">Chargement du statut...</p>
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
      icon: <Clock size={32} className="text-blue-400" />,
      label: "Preuve recue, verification en cours",
      description:
        "Notre equipe verifie votre paiement. Ce processus prend generalement quelques heures. Cette page se rafraichit automatiquement.",
      color: "blue",
    },
    payment_verified: {
      icon: <CheckCircle2 size={32} className="text-emerald-400" />,
      label: "Paiement valide !",
      description:
        "Votre paiement a ete confirme. L'activation de votre chatbot va bientot commencer.",
      color: "green",
    },
    queued_for_activation: {
      icon: <Clock size={32} className="text-blue-400" />,
      label: "En file d'attente",
      description:
        "Votre chatbot est en attente d'activation par notre equipe. Vous serez notifie des que le processus debute.",
      color: "blue",
    },
    activation_in_progress: {
      icon: <Loader2 size={32} className="animate-spin text-blue-400" />,
      label: "Activation en cours",
      description:
        "Notre equipe configure votre chatbot en ce moment. Restez sur cette page ou revenez plus tard.",
      color: "blue",
    },
    testing: {
      icon: <Loader2 size={32} className="animate-spin text-blue-400" />,
      label: "Test en cours",
      description:
        "Nous testons votre chatbot pour nous assurer que tout fonctionne parfaitement.",
      color: "blue",
    },
    active: {
      icon: <CheckCircle2 size={32} className="text-emerald-400" />,
      label: "Chatbot actif !",
      description:
        "Votre chatbot IA est maintenant operationnel sur votre page Facebook. Rendez-vous sur le tableau de bord pour gerer votre bot.",
      color: "green",
      action: (
        <button
          type="button"
          onClick={onGoToChatbot}
          className="inline-flex items-center gap-2 rounded-xl bg-orange-500 hover:bg-orange-600 px-6 py-2.5 text-sm font-semibold text-white transition-colors"
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
          className="inline-flex items-center gap-2 rounded-xl bg-orange-500 hover:bg-orange-600 px-6 py-2.5 text-sm font-semibold text-white transition-colors"
        >
          <ArrowLeft size={16} />
          Renvoyer une preuve
        </button>
      ),
    },
  };

  const display = configs[s] ?? {
    icon: <Clock size={32} className="text-fg/40" />,
    label: `Statut : ${s}`,
    description: "Votre demande est en cours de traitement.",
    color: "blue" as const,
  };

  const borderColor =
    display.color === "green"
      ? "border-emerald-500/30"
      : display.color === "red"
      ? "border-red-500/30"
      : display.color === "orange"
      ? "border-orange-500/30"
      : "border-blue-500/30";

  const bgColor =
    display.color === "green"
      ? "bg-emerald-500/5"
      : display.color === "red"
      ? "bg-red-500/5"
      : display.color === "orange"
      ? "bg-orange-500/5"
      : "bg-blue-500/5";

  return (
    <div
      className={`rounded-2xl backdrop-blur-md border shadow-[var(--shadow-card)] p-8 text-center max-w-md w-full flex flex-col items-center gap-4 ${borderColor} ${bgColor}`}
    >
      {display.icon}
      <h2 className="text-xl font-bold text-fg/90">{display.label}</h2>
      <p className="text-sm text-fg/60 leading-relaxed">
        {display.description}
      </p>
      {display.action}
      {!display.action && s !== "active" && (
        <p className="text-xs text-fg/30 mt-2">
          Rafraichissement automatique toutes les 15 secondes
        </p>
      )}
    </div>
  );
}
