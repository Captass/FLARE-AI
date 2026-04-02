"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, Link2, Loader2, Sparkles } from "lucide-react";

import {
  type CatalogueItemInput,
  type ChatbotPreferences,
  type ChatbotPrimaryRole,
  type ChatbotTone,
  DEFAULT_CHATBOT_PREFERENCES,
  createCatalogueItem,
  getApiBaseUrl,
  getChatbotPreferences,
  updateChatbotPreferences,
} from "@/lib/api";
import {
  activateFacebookMessengerPage,
  type FacebookMessengerStatus,
  getFacebookMessengerAuthorizationUrl,
  loadFacebookMessengerStatus,
} from "@/lib/facebookMessenger";
import { formatRelativeTime } from "@/components/chatbot/chatbotWorkspaceUtils";
import { LANGUAGE_OPTIONS, PRIMARY_ROLE_OPTIONS, TONE_OPTIONS } from "@/components/chatbot/chatbotWorkspaceUtils";
import FacebookVerificationBanner from "@/components/chatbot/FacebookVerificationBanner";
import type { ChatbotSetupStatus } from "@/lib/chatbotSetup";

interface ChatbotSetupWizardProps {
  setupStatus: ChatbotSetupStatus;
  token?: string | null;
  getFreshToken?: (forceRefresh?: boolean) => Promise<string | null>;
  onComplete?: () => Promise<void> | void;
  onSkip?: () => void;
  onRequestOrganizationSelection?: () => void;
  onRefreshSetupStatus?: () => Promise<ChatbotSetupStatus | null>;
}

type ConfigureStep = "identity" | "company";

const DEFAULT_PRODUCT_DRAFT: CatalogueItemInput = {
  name: "",
  description: "",
  price: "",
  category: "",
  image_url: "",
  sort_order: 0,
  is_active: true,
};

const STEP_LABELS = ["Connexion page Facebook", "Identite rapide", "Mon entreprise"];
const SESSION_RECOVERY_MESSAGE = "Votre session FLARE doit etre rechargee avant de continuer. Reouvrez votre session puis relancez Facebook.";

function normalizeSessionError(message: string, fallback: string): string {
  const value = String(message || "").trim();
  if (!value) return fallback;
  if (value === "Connexion requise.") return SESSION_RECOVERY_MESSAGE;
  return value;
}

export default function ChatbotSetupWizard({
  setupStatus,
  token,
  getFreshToken,
  onComplete,
  onSkip,
  onRequestOrganizationSelection,
  onRefreshSetupStatus,
}: ChatbotSetupWizardProps) {
  const [localStatus, setLocalStatus] = useState<ChatbotSetupStatus>(setupStatus);
  const [configureStep, setConfigureStep] = useState<ConfigureStep>("identity");
  const [showConfirmation, setShowConfirmation] = useState(false);

  const [facebookStatus, setFacebookStatus] = useState<FacebookMessengerStatus | null>(null);
  const [facebookLoading, setFacebookLoading] = useState(Boolean(token));
  const [facebookAuthLoading, setFacebookAuthLoading] = useState(false);
  const [facebookBusyPageId, setFacebookBusyPageId] = useState<string | null>(null);
  const [facebookError, setFacebookError] = useState<string | null>(null);

  const [preferences, setPreferences] = useState<ChatbotPreferences>(DEFAULT_CHATBOT_PREFERENCES);
  const [preferencesLoading, setPreferencesLoading] = useState(false);
  const [preferencesSaving, setPreferencesSaving] = useState(false);
  const [preferencesError, setPreferencesError] = useState<string | null>(null);
  const [optionalProduct, setOptionalProduct] = useState<CatalogueItemInput>(DEFAULT_PRODUCT_DRAFT);

  useEffect(() => {
    setLocalStatus(setupStatus);
    setConfigureStep(setupStatus.step === "configure" && setupStatus.configure_stage === "company" ? "company" : "identity");
    if (setupStatus.step !== "complete") {
      setShowConfirmation(false);
    }
  }, [setupStatus]);

  const currentStep = showConfirmation
    ? 3
    : localStatus.step === "configure"
      ? configureStep === "identity"
        ? 2
        : 3
      : 1;

  const activePage = useMemo(() => {
    const pages = facebookStatus?.pages || [];
    return pages.find((page) => page.is_active) || pages.find((page) => page.page_id === localStatus.active_page_id) || null;
  }, [facebookStatus, localStatus.active_page_id]);

  const availablePages = useMemo(
    () => (facebookStatus?.pages || []).filter((page) => !page.is_active),
    [facebookStatus]
  );

  // Fail-closed si statut Facebook indisponible (aligné avec ChatbotParametresPage)
  const canEditChatbot = facebookStatus?.can_edit ?? false;
  const canManagePages = facebookStatus?.can_manage_pages ?? false;
  const oauthConfigured = facebookStatus?.oauth_configured;
  const directServiceConfigured = facebookStatus?.direct_service_configured;
  const facebookOauthBlocked = oauthConfigured === false;
  const directServiceWarning = directServiceConfigured === false;
  const showFacebookVerificationBanner = Boolean(activePage);

  const refreshSetup = useCallback(async () => {
    const next = await onRefreshSetupStatus?.();
    if (next) {
      setLocalStatus(next);
    }
    return next;
  }, [onRefreshSetupStatus]);

  const resolveAccessToken = useCallback(async (forceRefresh = false) => {
    if (getFreshToken) {
      const nextToken = await getFreshToken(forceRefresh);
      if (nextToken) {
        return nextToken;
      }
    }
    return token ?? null;
  }, [getFreshToken, token]);

  const refreshFacebookState = useCallback(async () => {
    const accessToken = await resolveAccessToken();
    if (!accessToken) {
      setFacebookStatus(null);
      setFacebookError(SESSION_RECOVERY_MESSAGE);
      setFacebookLoading(false);
      return null;
    }

    setFacebookLoading(true);
    try {
      const next = await loadFacebookMessengerStatus(accessToken);
      setFacebookStatus(next);
      setFacebookError(null);
      return next;
    } catch (error) {
      setFacebookStatus(null);
      setFacebookError(
        normalizeSessionError(
          error instanceof Error ? error.message : "Etat Facebook indisponible.",
          "Etat Facebook indisponible."
        )
      );
      return null;
    } finally {
      setFacebookLoading(false);
    }
  }, [resolveAccessToken]);

  const refreshPreferences = useCallback(async () => {
    if (localStatus.step !== "configure") return;
    const accessToken = await resolveAccessToken();
    if (!accessToken) {
      setPreferencesError(SESSION_RECOVERY_MESSAGE);
      return;
    }
    setPreferencesLoading(true);
    try {
      const next = await getChatbotPreferences(accessToken);
      setPreferences(next);
      setPreferencesError(null);
    } catch (error) {
      setPreferencesError(
        normalizeSessionError(
          error instanceof Error ? error.message : "Preferences indisponibles.",
          "Preferences indisponibles."
        )
      );
    } finally {
      setPreferencesLoading(false);
    }
  }, [localStatus.step, resolveAccessToken]);

  useEffect(() => {
    void refreshFacebookState();
  }, [refreshFacebookState, token]);

  useEffect(() => {
    if (localStatus.step === "configure") {
      void refreshPreferences();
    }
  }, [localStatus.step, refreshPreferences]);

  const handleManualFacebookRefresh = useCallback(async () => {
    await refreshFacebookState();
    await refreshSetup();
  }, [refreshFacebookState, refreshSetup]);

  const handleConnectFacebook = async () => {
    if (facebookLoading) {
      setFacebookError("Chargement de l'etat Facebook. Reessayez dans quelques secondes.");
      return;
    }
    if (facebookOauthBlocked) {
      setFacebookError("Connexion Facebook temporairement indisponible. La configuration Meta du serveur doit etre finalisee.");
      return;
    }
    if (!canManagePages) {
      setFacebookError("Vous n'avez pas les droits requis pour connecter une page Facebook sur cette organisation.");
      return;
    }

    setFacebookAuthLoading(true);
    setFacebookError(null);

    try {
      const accessToken = await resolveAccessToken(true);
      if (!accessToken) {
        throw new Error(SESSION_RECOVERY_MESSAGE);
      }

      const authUrl = await getFacebookMessengerAuthorizationUrl(accessToken, window.location.origin);
      if (!authUrl) {
        throw new Error("URL d'autorisation Facebook manquante.");
      }

      const popup = window.open(authUrl, "flare-facebook-oauth", "width=680,height=760");
      if (!popup) {
        throw new Error("La popup Facebook a ete bloquee par le navigateur.");
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
            return;
          }
          reject(new Error(payload.detail || "Connexion Facebook echouee."));
        };

        const closeWatcher = window.setInterval(() => {
          if (!popup.closed) return;
          cleanup();
          if (receivedResult) {
            resolve();
            return;
          }
          reject(new Error("Connexion Facebook interrompue avant validation."));
        }, 400);

        window.addEventListener("message", handleMessage);
      });

      await refreshFacebookState();
      const next = await refreshSetup();
      if (next) {
        setLocalStatus(next);
      }
    } catch (error) {
      setFacebookError(
        normalizeSessionError(
          error instanceof Error ? error.message : "Connexion Facebook impossible.",
          "Connexion Facebook impossible."
        )
      );
    } finally {
      setFacebookAuthLoading(false);
    }
  };

  const handleActivatePage = async (pageId: string) => {
    if (!canManagePages) {
      if (!canManagePages) {
        setFacebookError("Vous n'avez pas les droits requis pour activer une page Facebook sur cette organisation.");
      }
      return;
    }
    setFacebookBusyPageId(pageId);
    setFacebookError(null);
    try {
      const accessToken = await resolveAccessToken(true);
      if (!accessToken) {
        throw new Error(SESSION_RECOVERY_MESSAGE);
      }

      await activateFacebookMessengerPage(pageId, accessToken);
      await refreshFacebookState();
      const next = await refreshSetup();
      if (next?.step === "configure") {
        setLocalStatus(next);
      }
    } catch (error) {
      setFacebookError(
        normalizeSessionError(
          error instanceof Error ? error.message : "Activation Facebook impossible.",
          "Activation Facebook impossible."
        )
      );
    } finally {
      setFacebookBusyPageId(null);
    }
  };

  const saveIdentityStep = async () => {
    if (!preferences.bot_name.trim()) {
      setPreferencesError("Le nom du bot est requis.");
      return;
    }

    const accessToken = await resolveAccessToken(true);
    if (!accessToken) {
      setPreferencesError(SESSION_RECOVERY_MESSAGE);
      return;
    }

    setPreferencesSaving(true);
    setPreferencesError(null);
    try {
      const saved = await updateChatbotPreferences(
        {
          ...preferences,
          bot_name: preferences.bot_name.trim(),
          greeting_message: preferences.greeting_message.trim(),
        },
        accessToken
      );
      setPreferences(saved);
      setConfigureStep("company");
    } catch (error) {
      setPreferencesError(
        normalizeSessionError(
          error instanceof Error ? error.message : "Impossible d'enregistrer l'identite.",
          "Impossible d'enregistrer l'identite."
        )
      );
    } finally {
      setPreferencesSaving(false);
    }
  };

  const saveCompanyStep = async () => {
    if (!preferences.business_name.trim()) {
      setPreferencesError("Le nom de l'entreprise est requis.");
      return;
    }
    if (!preferences.company_description.trim()) {
      setPreferencesError("La description de l'entreprise est requise.");
      return;
    }

    const accessToken = await resolveAccessToken(true);
    if (!accessToken) {
      setPreferencesError(SESSION_RECOVERY_MESSAGE);
      return;
    }

    setPreferencesSaving(true);
    setPreferencesError(null);
    try {
      const saved = await updateChatbotPreferences(
        {
          ...preferences,
          business_name: preferences.business_name.trim(),
          company_description: preferences.company_description.trim(),
        },
        accessToken
      );
      setPreferences(saved);

      if (optionalProduct.name?.trim()) {
        await createCatalogueItem(
          {
            ...DEFAULT_PRODUCT_DRAFT,
            ...optionalProduct,
            name: optionalProduct.name.trim(),
            description: String(optionalProduct.description || "").trim(),
            category: String(optionalProduct.category || "").trim(),
            price: String(optionalProduct.price || "").trim() || null,
          },
          accessToken
        );
      }

      setShowConfirmation(true);
    } catch (error) {
      setPreferencesError(
        normalizeSessionError(
          error instanceof Error ? error.message : "Impossible de terminer le setup.",
          "Impossible de terminer le setup."
        )
      );
    } finally {
      setPreferencesSaving(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[radial-gradient(circle_at_top_left,rgba(255,146,51,0.14),transparent_34%),radial-gradient(circle_at_top_right,rgba(255,255,255,0.06),transparent_28%),var(--background)]">
      <div className="mx-auto w-full max-w-[1080px] px-4 py-6 md:px-6 md:py-8">
        <section className="rounded-[28px] border border-white/[0.06] bg-white/[0.03] px-5 py-5 md:px-7">
          <h1 className="text-[30px] font-semibold tracking-[-0.03em] text-white md:text-[38px]">
            Setup chatbot Facebook
          </h1>
          <p className="mt-2 text-[14px] leading-7 text-white/42">
            Connectez votre page, reglez l&apos;identite rapide, puis renseignez votre entreprise.
          </p>

          <div className="mt-7 grid gap-4 md:grid-cols-3">
            {STEP_LABELS.map((label, index) => {
              const stepNumber = index + 1;
              const done = currentStep > stepNumber;
              const active = currentStep === stepNumber;
              return (
                <div key={label} className="flex items-center gap-3">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-full border text-sm font-semibold ${
                      done
                        ? "border-emerald-400/35 bg-emerald-500/12 text-emerald-200"
                        : active
                          ? "border-orange-400/35 bg-orange-500/12 text-orange-200"
                          : "border-white/[0.08] bg-white/[0.03] text-white/35"
                    }`}
                  >
                    {done ? <CheckCircle2 size={16} /> : stepNumber}
                  </div>
                  <div>
                    <p className={`text-[11px] uppercase tracking-[0.14em] ${active ? "text-orange-300/70" : "text-white/20"}`}>
                      Etape {stepNumber}
                    </p>
                    <p className={`text-[14px] ${active || done ? "text-white" : "text-white/35"}`}>{label}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {showConfirmation ? (
          <Panel>
            <h2 className="text-[26px] font-semibold text-white">Mon chatbot est pret</h2>
            <p className="mt-2 text-[14px] leading-7 text-white/42">
              Le bot peut deja repondre avec cette configuration minimale. Vous pourrez completer le reste dans Mon chatbot.
            </p>
            <button
              onClick={async () => {
                await onComplete?.();
              }}
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-orange-500 px-5 py-3 text-[13px] font-semibold uppercase tracking-[0.12em] text-[#140b02] hover:bg-orange-400"
            >
              Mon chatbot est pret
              <ArrowRight size={16} />
            </button>
          </Panel>
        ) : localStatus.step === "need_org" ? (
          <Panel>
            <h2 className="text-[26px] font-semibold text-white">Selectionnez une organisation</h2>
            <p className="mt-2 text-[14px] leading-7 text-white/42">
              Le setup chatbot est rattache a une organisation active.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                onClick={() => onRequestOrganizationSelection?.()}
                className="inline-flex items-center gap-2 rounded-full bg-orange-500 px-5 py-3 text-[13px] font-semibold uppercase tracking-[0.12em] text-[#140b02] hover:bg-orange-400"
              >
                Choisir une organisation
                <ArrowRight size={16} />
              </button>
            </div>
          </Panel>
        ) : localStatus.step === "connect_page" ? (
          <Panel>
            <h2 className="text-[26px] font-semibold text-white">Etape 1 - Connexion page Facebook</h2>
            <p className="mt-2 text-[14px] leading-7 text-white/42">
              Lancez OAuth, choisissez la page puis activez-la pour ouvrir la configuration.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <button
                onClick={handleConnectFacebook}
                disabled={facebookAuthLoading || facebookLoading || facebookOauthBlocked || !canManagePages}
                className="inline-flex items-center gap-2 rounded-full bg-orange-500 px-5 py-3 text-[13px] font-semibold uppercase tracking-[0.12em] text-[#140b02] hover:bg-orange-400 disabled:opacity-50"
              >
                {facebookAuthLoading ? <Loader2 size={16} className="animate-spin" /> : <Link2 size={16} />}
                Connecter avec Facebook
              </button>
              <button
                onClick={() => onSkip?.()}
                className="rounded-full border border-white/[0.1] px-5 py-3 text-[13px] text-white/62 hover:bg-white/[0.04]"
              >
                Continuer plus tard
              </button>
            </div>

            {facebookOauthBlocked ? (
              <div className="mt-4 rounded-xl border border-orange-400/25 bg-orange-500/10 px-4 py-3 text-[13px] text-orange-50">
                La connexion Facebook est temporairement indisponible.
                <br />
                Finalisez d&apos;abord la configuration Meta du serveur pour ouvrir l&apos;OAuth.
              </div>
            ) : null}

            {!facebookOauthBlocked && directServiceWarning ? (
              <div className="mt-4 rounded-xl border border-orange-400/20 bg-orange-500/8 px-4 py-3 text-[13px] text-orange-50/90">
                La connexion peut charger les pages, mais l&apos;activation finale restera incomplete tant que le service Messenger direct n&apos;est pas configure.
              </div>
            ) : null}

            {facebookError ? (
              <p className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-[13px] text-red-100">
                {facebookError}
              </p>
            ) : null}

            {showFacebookVerificationBanner && activePage ? (
              <FacebookVerificationBanner
                page={activePage}
                loading={facebookLoading}
                className="mt-5"
                onRefresh={() => {
                  void handleManualFacebookRefresh();
                }}
              />
            ) : availablePages.length > 0 ? (
              <div className="mt-5 space-y-3">
                {availablePages.map((page) => (
                  <PageRow
                    key={page.page_id}
                    page={page}
                    busy={facebookBusyPageId === page.page_id}
                    disabled={!canManagePages}
                    onActivate={handleActivatePage}
                  />
                ))}
              </div>
            ) : !facebookLoading && !facebookError ? (
              <div className="mt-5 rounded-2xl border border-white/[0.06] bg-white/[0.02] px-4 py-4 text-[13px] leading-6 text-white/52">
                Seules les pages avec les droits Messenger requis sont importees dans FLARE AI.
                Si une page selectionnee n&apos;apparait pas ici, Meta ne lui a probablement pas donne les acces
                `MANAGE` et `MESSAGING`.
              </div>
            ) : null}

            {facebookLoading ? (
              <div className="mt-5 flex items-center gap-2 text-[13px] text-white/34">
                <Loader2 size={14} className="animate-spin" />
                Chargement de l&apos;etat Facebook...
              </div>
            ) : null}
          </Panel>
        ) : (
          <Panel>
            {showFacebookVerificationBanner && activePage ? (
              <FacebookVerificationBanner
                page={activePage}
                loading={facebookLoading}
                className="mt-5"
                onRefresh={() => {
                  void handleManualFacebookRefresh();
                }}
              />
            ) : null}

            {configureStep === "identity" ? (
              <>
                <h2 className="text-[26px] font-semibold text-white">Etape 2 - Identite rapide</h2>
                <p className="mt-2 text-[14px] leading-7 text-white/42">
                  Nom du bot, role, ton, langue et message d&apos;accueil.
                </p>

                <div className="mt-5 grid gap-3 md:grid-cols-2">
                  <Field label="Nom du bot *">
                    <input
                      value={preferences.bot_name}
                      onChange={(event) => setPreferences((prev) => ({ ...prev, bot_name: event.target.value }))}
                      className="ui-input"
                      placeholder="Ex: Alex"
                    />
                  </Field>
                  <Field label="Role principal">
                    <select
                      value={preferences.primary_role}
                      onChange={(event) =>
                        setPreferences((prev) => ({ ...prev, primary_role: event.target.value as ChatbotPrimaryRole }))
                      }
                      className="ui-input"
                    >
                      {PRIMARY_ROLE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Ton">
                    <select
                      value={preferences.tone}
                      onChange={(event) =>
                        setPreferences((prev) => ({ ...prev, tone: event.target.value as ChatbotTone }))
                      }
                      className="ui-input"
                    >
                      {TONE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Langue principale">
                    <select
                      value={preferences.language}
                      onChange={(event) => setPreferences((prev) => ({ ...prev, language: event.target.value }))}
                      className="ui-input"
                    >
                      {LANGUAGE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Message d'accueil" fullWidth>
                    <textarea
                      value={preferences.greeting_message}
                      onChange={(event) => setPreferences((prev) => ({ ...prev, greeting_message: event.target.value }))}
                      className="ui-input min-h-[96px]"
                      placeholder="Bonjour ! Je suis Alex, comment puis-je vous aider ?"
                    />
                  </Field>
                </div>

                <div className="mt-6 flex flex-wrap gap-3">
                  <button
                    onClick={() => void saveIdentityStep()}
                    disabled={!canEditChatbot || preferencesSaving || preferencesLoading}
                    className="inline-flex items-center gap-2 rounded-full bg-orange-500 px-5 py-3 text-[13px] font-semibold uppercase tracking-[0.12em] text-[#140b02] hover:bg-orange-400 disabled:opacity-50"
                  >
                    {preferencesSaving ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                    Continuer
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2 className="text-[26px] font-semibold text-white">Etape 3 - Mon entreprise rapide</h2>
                <p className="mt-2 text-[14px] leading-7 text-white/42">
                  Nom entreprise, description, puis un produit ou service optionnel pour demarrer.
                </p>

                <div className="mt-5 grid gap-3 md:grid-cols-2">
                  <Field label="Nom de l'entreprise *">
                    <input
                      value={preferences.business_name}
                      onChange={(event) => setPreferences((prev) => ({ ...prev, business_name: event.target.value }))}
                      className="ui-input"
                      placeholder="Ex: RAM'S FLARE"
                    />
                  </Field>
                  <Field label="Description *" fullWidth>
                    <textarea
                      value={preferences.company_description}
                      onChange={(event) => setPreferences((prev) => ({ ...prev, company_description: event.target.value }))}
                      className="ui-input min-h-[110px]"
                      placeholder="Expliquez votre activite en 2-3 lignes..."
                    />
                  </Field>
                  <Field label="Produit ou service initial (optionnel)" fullWidth>
                    <div className="grid gap-2 md:grid-cols-2">
                      <input
                        value={optionalProduct.name || ""}
                        onChange={(event) => setOptionalProduct((prev) => ({ ...prev, name: event.target.value }))}
                        className="ui-input"
                        placeholder="Nom du produit/service"
                      />
                      <input
                        value={optionalProduct.category || ""}
                        onChange={(event) => setOptionalProduct((prev) => ({ ...prev, category: event.target.value }))}
                        className="ui-input"
                        placeholder="Categorie"
                      />
                      <input
                        value={optionalProduct.price || ""}
                        onChange={(event) => setOptionalProduct((prev) => ({ ...prev, price: event.target.value }))}
                        className="ui-input"
                        placeholder="Prix"
                      />
                      <textarea
                        value={optionalProduct.description || ""}
                        onChange={(event) => setOptionalProduct((prev) => ({ ...prev, description: event.target.value }))}
                        className="ui-input min-h-[80px] md:col-span-2"
                        placeholder="Description"
                      />
                    </div>
                  </Field>
                </div>

                <div className="mt-6 flex flex-wrap gap-3">
                  <button
                    onClick={() => void saveCompanyStep()}
                    disabled={!canEditChatbot || preferencesSaving}
                    className="inline-flex items-center gap-2 rounded-full bg-orange-500 px-5 py-3 text-[13px] font-semibold uppercase tracking-[0.12em] text-[#140b02] hover:bg-orange-400 disabled:opacity-50"
                  >
                    {preferencesSaving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                    Mon chatbot est pret
                  </button>
                  <button
                    onClick={() => setConfigureStep("identity")}
                    className="rounded-full border border-white/[0.1] px-5 py-3 text-[13px] text-white/62 hover:bg-white/[0.04]"
                  >
                    Retour
                  </button>
                </div>
              </>
            )}

            {preferencesError ? (
              <p className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-[13px] text-red-100">
                {preferencesError}
              </p>
            ) : null}
          </Panel>
        )}
      </div>

      <style jsx>{`
        .ui-input {
          width: 100%;
          border-radius: 0.8rem;
          border: 1px solid rgba(255, 255, 255, 0.12);
          background: rgba(255, 255, 255, 0.03);
          color: rgba(255, 255, 255, 0.92);
          padding: 0.6rem 0.75rem;
          font-size: 0.83rem;
          outline: none;
        }
      `}</style>
    </div>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return <section className="mt-5 rounded-[28px] border border-white/[0.06] bg-white/[0.03] p-5 md:p-7">{children}</section>;
}

function Field({
  label,
  children,
  fullWidth = false,
}: {
  label: string;
  children: React.ReactNode;
  fullWidth?: boolean;
}) {
  return (
    <div className={fullWidth ? "md:col-span-2" : ""}>
      <label className="mb-1.5 block text-[10px] uppercase tracking-[0.12em] text-white/30">{label}</label>
      {children}
    </div>
  );
}

function PageRow({
  page,
  busy,
  disabled,
  onActivate,
}: {
  page: FacebookMessengerPage;
  busy: boolean;
  disabled: boolean;
  onActivate: (pageId: string) => Promise<void>;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] px-4 py-4 md:flex-row md:items-center md:justify-between">
      <div>
        <p className="text-[15px] font-medium text-white">{page.page_name}</p>
        <p className="text-[12px] text-white/36">{page.page_category || "Page Facebook"}</p>
      </div>
      <button
        onClick={() => void onActivate(page.page_id)}
        disabled={busy || disabled}
        className="inline-flex items-center justify-center gap-2 rounded-full border border-orange-400/20 bg-orange-500/10 px-4 py-2 text-[12px] font-semibold uppercase tracking-[0.12em] text-orange-200 hover:bg-orange-500/20 disabled:opacity-50"
      >
        {busy ? <Loader2 size={14} className="animate-spin" /> : <Link2 size={14} />}
        Activer
      </button>
    </div>
  );
}
