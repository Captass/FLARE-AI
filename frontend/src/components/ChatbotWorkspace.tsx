"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowUpRight, Bot, Link2, Loader2, Lock } from "lucide-react";

import ChatbotFilesPanel from "@/components/ChatbotFilesPanel";
import ChatbotBusinessTab from "@/components/chatbot/ChatbotBusinessTab";
import ChatbotCatalogueTab from "@/components/chatbot/ChatbotCatalogueTab";
import ChatbotIdentityTab from "@/components/chatbot/ChatbotIdentityTab";
import ChatbotPortfolioTab from "@/components/chatbot/ChatbotPortfolioTab";
import ChatbotSalesTab from "@/components/chatbot/ChatbotSalesTab";
import ChatbotStatusTab from "@/components/chatbot/ChatbotStatusTab";
import { FeatureLockedPanel, SectionCard } from "@/components/chatbot/ChatbotUi";
import {
  CATALOGUE_STARTER_TEMPLATES,
  EMPTY_CATALOGUE_INPUT,
  EMPTY_PORTFOLIO_INPUT,
  EMPTY_SALES_CONFIG,
  TAB_DEFINITIONS,
  buildBotPreview,
  getWorkspaceReadiness,
  type ChatbotWorkspaceTab,
  createEmptyHours,
  formatRelativeTime,
  parseBusinessHours,
  serializeBusinessHours,
} from "@/components/chatbot/chatbotWorkspaceUtils";
import {
  DEFAULT_CHATBOT_PREFERENCES,
  type BillingFeatures,
  type CatalogueItem,
  createCatalogueItem,
  createPortfolioItem,
  deleteCatalogueItem,
  deletePortfolioItem,
  getApiBaseUrl,
  getBillingFeatures,
  getCatalogue,
  getChatbotOverview,
  getChatbotPreferences,
  getPortfolio,
  getSalesConfig,
  type ChatbotOverview,
  type ChatbotPreferences,
  type PortfolioItem,
  type SalesConfig,
  updateCatalogueItem,
  updateChatbotPreferences,
  updatePortfolioItem,
  updateSalesConfig,
} from "@/lib/api";
import {
  activateFacebookMessengerPage,
  disconnectFacebookMessengerPage,
  type FacebookMessengerStatus,
  getFacebookMessengerAuthorizationUrl,
  loadFacebookMessengerStatus,
} from "@/lib/facebookMessenger";

interface ChatbotWorkspaceProps {
  token?: string | null;
  getFreshToken?: (forceRefresh?: boolean) => Promise<string | null>;
  initialTab?: ChatbotWorkspaceTab;
  onRequestAccess?: () => void;
  onRequestOrganizationSelection?: () => void;
  onRequestUpgrade?: () => void;
}

type Flash = { tone: "success" | "error" | "warning"; message: string } | null;
const SESSION_RECOVERY_MESSAGE = "Votre session FLARE doit etre rechargee avant de continuer. Reouvrez votre session puis relancez l'action.";

function normalizeSessionError(message: string, fallback: string): string {
  const value = String(message || "").trim();
  if (!value) return fallback;
  if (value === "Connexion requise.") return SESSION_RECOVERY_MESSAGE;
  return value;
}

export default function ChatbotWorkspace({
  token,
  getFreshToken,
  initialTab = "status",
  onRequestAccess,
  onRequestOrganizationSelection,
  onRequestUpgrade,
}: ChatbotWorkspaceProps) {
  const [activeTab, setActiveTab] = useState<ChatbotWorkspaceTab>(initialTab);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<Flash>(null);
  const [overview, setOverview] = useState<ChatbotOverview | null>(null);
  const [billing, setBilling] = useState<BillingFeatures | null>(null);
  const [facebookStatus, setFacebookStatus] = useState<FacebookMessengerStatus | null>(null);
  const [facebookLoading, setFacebookLoading] = useState(false);
  const [facebookAuthLoading, setFacebookAuthLoading] = useState(false);
  const [facebookBusyPageId, setFacebookBusyPageId] = useState<string | null>(null);
  const [facebookError, setFacebookError] = useState<string | null>(null);
  const [preferences, setPreferences] = useState<ChatbotPreferences>(DEFAULT_CHATBOT_PREFERENCES);
  const [businessHoursDraft, setBusinessHoursDraft] = useState(createEmptyHours());
  const [catalogue, setCatalogue] = useState<CatalogueItem[]>([]);
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>([]);
  const [salesConfig, setSalesConfig] = useState<SalesConfig>(EMPTY_SALES_CONFIG);
  const [savingSection, setSavingSection] = useState<string | null>(null);
  const [catalogueDraft, setCatalogueDraft] = useState(EMPTY_CATALOGUE_INPUT);
  const [editingCatalogueId, setEditingCatalogueId] = useState<string | null>(null);
  const [portfolioDraft, setPortfolioDraft] = useState(EMPTY_PORTFOLIO_INPUT);
  const [editingPortfolioId, setEditingPortfolioId] = useState<string | null>(null);
  const [newQualificationStep, setNewQualificationStep] = useState("");
  const [newObjection, setNewObjection] = useState("");
  const [newObjectionResponse, setNewObjectionResponse] = useState("");

  useEffect(() => setActiveTab(initialTab), [initialTab]);
  useEffect(() => setBusinessHoursDraft(parseBusinessHours(preferences.business_hours)), [preferences.business_hours]);
  useEffect(() => {
    if (!flash) return undefined;
    const timeout = window.setTimeout(() => setFlash(null), 3200);
    return () => window.clearTimeout(timeout);
  }, [flash]);

  const planFeatures = billing?.features || null;
  const activePage = overview?.active_page || null;
  const hasOrgScope = overview?.step !== "need_org";
  const canEdit = facebookStatus?.can_edit ?? true;
  const canManagePages = facebookStatus?.can_manage_pages ?? canEdit;
  const readiness = useMemo(
    () => getWorkspaceReadiness({ overview, preferences, catalogue }),
    [catalogue, overview, preferences]
  );
  const preview = useMemo(
    () => buildBotPreview({ preferences, catalogue, salesConfig }),
    [catalogue, preferences, salesConfig]
  );
  const lockedTabs = useMemo(
    () => new Set(TAB_DEFINITIONS.filter((tab) => tab.feature && !planFeatures?.[tab.feature]).map((tab) => tab.id)),
    [planFeatures]
  );

  const showFlash = (message: string, tone: "success" | "error" | "warning" = "success") => setFlash({ tone, message });
  const resolveAccessToken = useCallback(async (forceRefresh = false) => {
    if (getFreshToken) {
      const nextToken = await getFreshToken(forceRefresh);
      if (nextToken) {
        return nextToken;
      }
    }
    return token ?? null;
  }, [getFreshToken, token]);

  const refreshWorkspace = useCallback(async (mode: "initial" | "refresh" = "initial") => {
    const accessToken = await resolveAccessToken();
    if (!accessToken) {
      setLoading(false);
      setOverview(null);
      setBilling(null);
      setFacebookStatus(null);
      setError(SESSION_RECOVERY_MESSAGE);
      return;
    }
    if (mode !== "refresh") setLoading(true);
    setError(null);
    try {
      const [nextOverview, nextBilling, nextPrefs, nextCatalogue, nextFacebook] = await Promise.all([
        getChatbotOverview(accessToken),
        getBillingFeatures(accessToken),
        getChatbotPreferences(accessToken),
        getCatalogue(accessToken),
        loadFacebookMessengerStatus(accessToken),
      ]);
      setOverview(nextOverview);
      setBilling(nextBilling);
      setPreferences(nextPrefs);
      setCatalogue(nextCatalogue);
      setFacebookStatus(nextFacebook);
      setFacebookError(null);
      setPortfolio(nextBilling.features.has_portfolio ? await getPortfolio(accessToken) : []);
      setSalesConfig(
        nextBilling.features.has_sales_script
          ? await getSalesConfig(accessToken)
          : {
              ...EMPTY_SALES_CONFIG,
              organization_slug: nextPrefs.organization_slug || "",
              handoff_mode: nextPrefs.handoff_mode,
              handoff_keywords: nextPrefs.handoff_keywords,
            }
      );
    } catch (nextError) {
      setFacebookStatus(null);
      setError(
        normalizeSessionError(
          nextError instanceof Error ? nextError.message : "Impossible de charger Mon chatbot.",
          "Impossible de charger Mon chatbot."
        )
      );
    } finally {
      setLoading(false);
    }
  }, [resolveAccessToken]);

  useEffect(() => {
    void refreshWorkspace("initial");
  }, [refreshWorkspace]);

  const handleConnectFacebook = async () => {
    const accessToken = await resolveAccessToken(true);
    if (!accessToken) {
      setFacebookError(SESSION_RECOVERY_MESSAGE);
      onRequestAccess?.();
      return;
    }
    if (!canManagePages) {
      setFacebookError("Vous n'avez pas les droits requis pour connecter une page Facebook sur cette organisation.");
      return;
    }
    setFacebookAuthLoading(true);
    setFacebookError(null);
    try {
      const authUrl = await getFacebookMessengerAuthorizationUrl(accessToken, window.location.origin);
      if (!authUrl) throw new Error("URL d'autorisation Facebook manquante.");
      const popup = window.open(authUrl, "flare-facebook-oauth", "width=680,height=760");
      if (!popup) throw new Error("La popup Facebook a ete bloquee par le navigateur.");
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
          if (payload.status === "success") resolve();
          else reject(new Error(payload.detail || "Connexion Facebook echouee."));
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
      await refreshWorkspace("refresh");
      showFlash("Connexion Facebook mise a jour.");
    } catch (nextError) {
      setFacebookError(
        normalizeSessionError(
          nextError instanceof Error ? nextError.message : "Connexion Facebook impossible.",
          "Connexion Facebook impossible."
        )
      );
    } finally {
      setFacebookAuthLoading(false);
    }
  };

  const persistPreferences = async (sectionKey: string, message: string) => {
    const accessToken = await resolveAccessToken(true);
    if (!accessToken) {
      showFlash(SESSION_RECOVERY_MESSAGE, "error");
      return;
    }
    setSavingSection(sectionKey);
    try {
      const savedPreferences = await updateChatbotPreferences({ ...preferences, business_hours: serializeBusinessHours(businessHoursDraft) }, accessToken);
      setPreferences(savedPreferences);
      await refreshWorkspace("refresh");
      showFlash(savedPreferences.sync_warning || message, savedPreferences.sync_warning ? "warning" : "success");
    } catch (nextError) {
      showFlash(
        normalizeSessionError(
          nextError instanceof Error ? nextError.message : "Enregistrement impossible.",
          "Enregistrement impossible."
        ),
        "error"
      );
    } finally {
      setSavingSection(null);
    }
  };

  if (!token) {
    return (
      <div className="flex h-full items-center justify-center px-6 py-10">
        <div className="max-w-[34rem] rounded-[30px] border border-white/[0.05] bg-white/[0.03] p-8 text-center">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-[18px] border border-white/[0.08] bg-white/[0.03] text-white/72">
            <Bot size={24} />
          </div>
          <h1 className="text-[28px] font-semibold tracking-[-0.04em] text-white">Mon chatbot</h1>
          <p className="mt-3 text-[15px] leading-7 text-white/45">Connectez-vous pour configurer votre bot Messenger.</p>
          <button
            onClick={onRequestAccess}
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-orange-500 px-5 py-3 text-[13px] font-semibold uppercase tracking-[0.12em] text-[#140b02] transition-all hover:bg-orange-400"
          >
            Ouvrir ma session
            <ArrowUpRight size={15} />
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex items-center gap-3 text-white/42">
          <Loader2 size={18} className="animate-spin" />
          Chargement du cockpit chatbot...
        </div>
      </div>
    );
  }

  const renderTab = () => {
    if (!hasOrgScope) {
      return (
        <SectionCard
          title="Organisation requise"
          description="Les pages Facebook et la configuration du chatbot sont rattachees a une organisation active."
          action={
            <button
              onClick={onRequestOrganizationSelection}
              className="inline-flex items-center gap-2 rounded-full bg-orange-500 px-4 py-2.5 text-[12px] font-semibold uppercase tracking-[0.12em] text-[#140b02]"
            >
              Choisir une organisation
              <ArrowUpRight size={14} />
            </button>
          }
        >
          <p className="text-[14px] leading-7 text-white/45">Activez d&apos;abord votre espace d&apos;organisation pour partager la configuration du chatbot.</p>
        </SectionCard>
      );
    }

    if (activeTab === "status") {
      return (
        <ChatbotStatusTab
          overview={overview}
          status={facebookStatus}
          loading={facebookLoading}
          authLoading={facebookAuthLoading}
          busyPageId={facebookBusyPageId}
          error={facebookError}
          canEdit={canEdit}
          canManagePages={canManagePages}
          catalogueCount={catalogue.length}
          onRefresh={() => void refreshWorkspace("refresh")}
          onJumpToTab={setActiveTab}
          onConnect={() => void handleConnectFacebook()}
          onActivate={async (pageId) => {
            if (!canManagePages) return;
            const accessToken = await resolveAccessToken(true);
            if (!accessToken) {
              setFacebookError(SESSION_RECOVERY_MESSAGE);
              return;
            }
            setFacebookBusyPageId(pageId);
            try {
              await activateFacebookMessengerPage(pageId, accessToken);
              await refreshWorkspace("refresh");
              showFlash("Page Facebook activee.");
            } catch (nextError) {
              setFacebookError(
                normalizeSessionError(
                  nextError instanceof Error ? nextError.message : "Activation impossible.",
                  "Activation impossible."
                )
              );
            } finally {
              setFacebookBusyPageId(null);
            }
          }}
          onDisconnect={async (pageId) => {
            if (!canManagePages) return;
            const accessToken = await resolveAccessToken(true);
            if (!accessToken) {
              setFacebookError(SESSION_RECOVERY_MESSAGE);
              return;
            }
            setFacebookBusyPageId(pageId);
            try {
              await disconnectFacebookMessengerPage(pageId, accessToken);
              await refreshWorkspace("refresh");
              showFlash("Page Facebook deconnectee.");
            } catch (nextError) {
              setFacebookError(
                normalizeSessionError(
                  nextError instanceof Error ? nextError.message : "Deconnexion impossible.",
                  "Deconnexion impossible."
                )
              );
            } finally {
              setFacebookBusyPageId(null);
            }
          }}
        />
      );
    }

    if (activeTab === "identity") {
      return <ChatbotIdentityTab preferences={preferences} onChange={setPreferences} canEdit={canEdit} saving={savingSection === "identity"} onSave={() => void persistPreferences("identity", "Identite du bot enregistree.")} />;
    }
    if (activeTab === "business") {
      return <ChatbotBusinessTab preferences={preferences} businessHoursDraft={businessHoursDraft} onChange={setPreferences} onBusinessHoursChange={setBusinessHoursDraft} canEdit={canEdit} saving={savingSection === "business"} onSave={() => void persistPreferences("business", "Informations entreprise enregistrees.")} />;
    }
    if (activeTab === "catalogue") {
      return (
        <ChatbotCatalogueTab
          items={catalogue}
          draft={catalogueDraft}
          editingId={editingCatalogueId}
          canEdit={canEdit}
          saving={savingSection === "catalogue"}
          planFeatures={planFeatures}
          templates={CATALOGUE_STARTER_TEMPLATES}
          onChangeDraft={setCatalogueDraft}
          onApplyTemplate={(template) => {
            setEditingCatalogueId(null);
            setCatalogueDraft({
              ...template,
              sort_order: Math.max(0, catalogue.length),
            });
          }}
          onEdit={(item) => {
            setEditingCatalogueId(item.id);
            setCatalogueDraft({ name: item.name, description: item.description, price: item.price, category: item.category, image_url: item.image_url, sort_order: item.sort_order, is_active: item.is_active });
          }}
          onReset={() => {
            setEditingCatalogueId(null);
            setCatalogueDraft({ ...EMPTY_CATALOGUE_INPUT, sort_order: Math.max(0, catalogue.length) });
          }}
          onSave={async () => {
            if (!catalogueDraft.name?.trim()) return;
            const accessToken = await resolveAccessToken(true);
            if (!accessToken) {
              showFlash(SESSION_RECOVERY_MESSAGE, "error");
              return;
            }
            setSavingSection("catalogue");
            try {
              const savedItem = editingCatalogueId
                ? await updateCatalogueItem(editingCatalogueId, catalogueDraft, accessToken)
                : await createCatalogueItem(catalogueDraft, accessToken);
              setCatalogue(await getCatalogue(accessToken));
              setEditingCatalogueId(null);
              setCatalogueDraft(EMPTY_CATALOGUE_INPUT);
              showFlash(
                savedItem.sync_warning || (editingCatalogueId ? "Catalogue mis a jour." : "Produit ou service ajoute."),
                savedItem.sync_warning ? "warning" : "success"
              );
            } catch (nextError) {
              showFlash(
                normalizeSessionError(
                  nextError instanceof Error ? nextError.message : "Impossible d'enregistrer le catalogue.",
                  "Impossible d'enregistrer le catalogue."
                ),
                "error"
              );
            } finally {
              setSavingSection(null);
            }
          }}
          onDelete={async (id) => {
            const accessToken = await resolveAccessToken(true);
            if (!accessToken) {
              showFlash(SESSION_RECOVERY_MESSAGE, "error");
              return;
            }
            setSavingSection("catalogue");
            try {
              await deleteCatalogueItem(id, accessToken);
              setCatalogue(await getCatalogue(accessToken));
              showFlash("Article catalogue supprime.");
            } catch (nextError) {
              showFlash(
                normalizeSessionError(
                  nextError instanceof Error ? nextError.message : "Suppression impossible.",
                  "Suppression impossible."
                ),
                "error"
              );
            } finally {
              setSavingSection(null);
            }
          }}
        />
      );
    }
    if (activeTab === "portfolio") {
      if (!planFeatures?.has_portfolio) return <FeatureLockedPanel title="Disponible des le plan Pro" body="Votre chatbot peut partager automatiquement vos realisations et vos preuves sociales en conversation." ctaLabel="Passer a Pro" onRequestUpgrade={onRequestUpgrade} />;
      return (
        <ChatbotPortfolioTab
          items={portfolio}
          draft={portfolioDraft}
          editingId={editingPortfolioId}
          canEdit={canEdit}
          saving={savingSection === "portfolio"}
          onChangeDraft={setPortfolioDraft}
          onEdit={(item) => {
            setEditingPortfolioId(item.id);
            setPortfolioDraft({ title: item.title, description: item.description, video_url: item.video_url, external_url: item.external_url, client_name: item.client_name, auto_share: item.auto_share, sort_order: item.sort_order });
          }}
          onReset={() => {
            setEditingPortfolioId(null);
            setPortfolioDraft({ ...EMPTY_PORTFOLIO_INPUT, sort_order: Math.max(0, portfolio.length) });
          }}
          onSave={async () => {
            if (!portfolioDraft.title?.trim()) return;
            const accessToken = await resolveAccessToken(true);
            if (!accessToken) {
              showFlash(SESSION_RECOVERY_MESSAGE, "error");
              return;
            }
            setSavingSection("portfolio");
            try {
              const savedItem = editingPortfolioId
                ? await updatePortfolioItem(editingPortfolioId, portfolioDraft, accessToken)
                : await createPortfolioItem(portfolioDraft, accessToken);
              setPortfolio(await getPortfolio(accessToken));
              setEditingPortfolioId(null);
              setPortfolioDraft(EMPTY_PORTFOLIO_INPUT);
              showFlash(
                savedItem.sync_warning || (editingPortfolioId ? "Portfolio mis a jour." : "Realisation ajoutee."),
                savedItem.sync_warning ? "warning" : "success"
              );
            } catch (nextError) {
              showFlash(
                normalizeSessionError(
                  nextError instanceof Error ? nextError.message : "Impossible d'enregistrer le portfolio.",
                  "Impossible d'enregistrer le portfolio."
                ),
                "error"
              );
            } finally {
              setSavingSection(null);
            }
          }}
          onDelete={async (id) => {
            const accessToken = await resolveAccessToken(true);
            if (!accessToken) {
              showFlash(SESSION_RECOVERY_MESSAGE, "error");
              return;
            }
            setSavingSection("portfolio");
            try {
              await deletePortfolioItem(id, accessToken);
              setPortfolio(await getPortfolio(accessToken));
              showFlash("Realisation supprimee.");
            } catch (nextError) {
              showFlash(
                normalizeSessionError(
                  nextError instanceof Error ? nextError.message : "Suppression impossible.",
                  "Suppression impossible."
                ),
                "error"
              );
            } finally {
              setSavingSection(null);
            }
          }}
        />
      );
    }
    if (activeTab === "sales") {
      if (!planFeatures?.has_sales_script) return <FeatureLockedPanel title="Disponible des le plan Pro" body="Votre chatbot peut qualifier les leads, gerer les objections et pousser un CTA commercial coherent des qu'il passe au plan Pro." ctaLabel="Passer a Pro" onRequestUpgrade={onRequestUpgrade} />;
      return <ChatbotSalesTab salesConfig={salesConfig} canEdit={canEdit} saving={savingSection === "sales"} newQualificationStep={newQualificationStep} newObjection={newObjection} newObjectionResponse={newObjectionResponse} onChange={setSalesConfig} onSave={async () => { const accessToken = await resolveAccessToken(true); if (!accessToken) { showFlash(SESSION_RECOVERY_MESSAGE, "error"); return; } setSavingSection("sales"); try { const savedConfig = await updateSalesConfig({ qualification_steps: salesConfig.qualification_steps, objections: salesConfig.objections, cta_type: salesConfig.cta_type, cta_text: salesConfig.cta_text, cta_url: salesConfig.cta_url, hot_lead_signals: salesConfig.hot_lead_signals, handoff_mode: preferences.handoff_mode, handoff_keywords: preferences.handoff_keywords }, accessToken); setSalesConfig(savedConfig); showFlash(savedConfig.sync_warning || "Script de vente mis a jour.", savedConfig.sync_warning ? "warning" : "success"); } catch (nextError) { showFlash(normalizeSessionError(nextError instanceof Error ? nextError.message : "Impossible de sauvegarder le script.", "Impossible de sauvegarder le script."), "error"); } finally { setSavingSection(null); } }} onQualificationDraftChange={setNewQualificationStep} onObjectionDraftChange={setNewObjection} onObjectionResponseDraftChange={setNewObjectionResponse} onAddQualificationStep={() => { const nextValue = newQualificationStep.trim(); if (!nextValue) return; setSalesConfig({ ...salesConfig, qualification_steps: [...salesConfig.qualification_steps, nextValue] }); setNewQualificationStep(""); }} onAddObjectionPair={() => { const objection = newObjection.trim(); const response = newObjectionResponse.trim(); if (!objection && !response) return; setSalesConfig({ ...salesConfig, objections: [...salesConfig.objections, { objection, response }] }); setNewObjection(""); setNewObjectionResponse(""); }} />;
    }
    if (!planFeatures?.has_chatbot_content) return <FeatureLockedPanel title="Disponible des le plan Starter" body="Ajoutez des PDF, brochures, FAQ et documents d'entreprise pour que le bot puisse s'en inspirer dans ses reponses." ctaLabel="Passer a Starter" onRequestUpgrade={onRequestUpgrade} />;
    return <div className="overflow-hidden rounded-[30px] border border-white/[0.05] bg-white/[0.03]"><ChatbotFilesPanel token={token} /></div>;
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[radial-gradient(circle_at_top_left,rgba(255,146,51,0.14),transparent_34%),radial-gradient(circle_at_top_right,rgba(255,255,255,0.06),transparent_28%),var(--background)]">
      <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-6 px-4 py-6 md:px-6 md:py-8">
        <div className="rounded-[32px] border border-white/[0.05] bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] px-5 py-5 md:px-7">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-[42rem]">
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-white/45">{(billing?.plan_id || "free").toUpperCase()}</span>
                <span className={`rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.2em] ${activePage ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-100" : "border-orange-400/20 bg-orange-400/10 text-orange-100"}`}>{activePage ? "Page connectee" : "Page a connecter"}</span>
              </div>
              <h1 className="text-[30px] font-semibold tracking-[-0.04em] text-white md:text-[42px]">Mon chatbot</h1>
              <p className="mt-3 text-[15px] leading-7 text-white/42">Configurez votre bot Messenger, votre entreprise, vos offres et les contenus que le bot doit connaitre.</p>
            </div>
            <div className="grid gap-3 text-[12px] text-white/42 sm:grid-cols-3">
              <QuickStat label="Page active" value={activePage?.page_name || "Aucune"} />
              <QuickStat label="Derniere synchro" value={formatRelativeTime(activePage?.last_synced_at)} />
              <QuickStat label="Catalogue" value={`${catalogue.length} article(s)`} />
            </div>
          </div>
          <div className="mt-6 flex flex-wrap gap-2">
            {TAB_DEFINITIONS.map((tab) => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`inline-flex items-center gap-2 rounded-full border px-4 py-2.5 text-[12px] font-semibold uppercase tracking-[0.12em] transition-all ${activeTab === tab.id ? "border-orange-400/35 bg-orange-500/12 text-orange-200" : "border-white/[0.08] bg-white/[0.02] text-white/55 hover:border-white/[0.14] hover:text-white"}`}>
                {tab.label}
                {tab.badge ? <span className="rounded-full border border-white/10 bg-black/20 px-2 py-0.5 text-[9px] text-white/55">{tab.badge}</span> : null}
                {lockedTabs.has(tab.id) ? <Lock size={12} className="text-white/38" /> : null}
              </button>
            ))}
          </div>
          <div className="mt-6 grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
            <div className="rounded-[28px] border border-white/[0.06] bg-black/20 p-5">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="max-w-[34rem]">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-white/28">Niveau de preparation</p>
                  <h2 className="mt-3 text-[24px] font-semibold tracking-[-0.03em] text-white">
                    {readiness.completed}/{readiness.total} bases completes
                  </h2>
                  <p className="mt-2 text-[14px] leading-7 text-white/48">
                    {readiness.nextStep
                      ? `Prochaine meilleure action: ${readiness.nextStep.label}.`
                      : "Le bot dispose deja de sa base de configuration pour repondre plus clairement."}
                  </p>
                </div>
                <div className="inline-flex self-start rounded-[20px] border border-white/[0.08] bg-white/[0.04] px-4 py-3 text-center">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.14em] text-white/28">Progression</p>
                    <p className="mt-1 text-[22px] font-semibold text-white">{readiness.percent}%</p>
                  </div>
                </div>
              </div>
              <div className="mt-5 h-2 rounded-full bg-white/[0.06]">
                <div
                  className="h-full rounded-full bg-[linear-gradient(90deg,rgba(251,146,60,0.95),rgba(250,204,21,0.9),rgba(52,211,153,0.9))]"
                  style={{ width: `${Math.max(8, readiness.percent)}%` }}
                />
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {readiness.steps.map((step) => (
                  <button
                    key={step.id}
                    onClick={() => setActiveTab(step.tab)}
                    className={`rounded-[22px] border px-4 py-4 text-left transition-all ${
                      step.done
                        ? "border-emerald-400/18 bg-emerald-400/[0.08]"
                        : "border-white/[0.08] bg-white/[0.03] hover:border-white/[0.14]"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[13px] font-semibold text-white">{step.label}</p>
                      <span className={`rounded-full px-2.5 py-1 text-[10px] uppercase tracking-[0.12em] ${step.done ? "bg-emerald-400/14 text-emerald-100" : "bg-orange-400/12 text-orange-100"}`}>
                        {step.done ? "OK" : "A faire"}
                      </span>
                    </div>
                    <p className="mt-2 text-[12px] leading-6 text-white/42">{step.detail}</p>
                  </button>
                ))}
              </div>
              {readiness.nextStep ? (
                <button
                  onClick={() => setActiveTab(readiness.nextStep!.tab)}
                  className="mt-5 inline-flex items-center gap-2 rounded-full bg-orange-500 px-4 py-2.5 text-[12px] font-semibold uppercase tracking-[0.12em] text-[#140b02] transition-all hover:bg-orange-400"
                >
                  Continuer sur {readiness.nextStep.label}
                  <ArrowUpRight size={14} />
                </button>
              ) : null}
            </div>

            <div className="rounded-[28px] border border-white/[0.06] bg-white/[0.03] p-5">
              <p className="text-[10px] uppercase tracking-[0.18em] text-white/28">Apercu client</p>
              <h2 className="mt-3 text-[24px] font-semibold tracking-[-0.03em] text-white">
                {preferences.bot_name || "Votre bot"} en action
              </h2>
              <p className="mt-2 text-[14px] leading-7 text-white/46">
                Un exemple concret du ton, de l&apos;offre et de la direction commerciale actuellement visibles pour le client.
              </p>
              <div className="mt-5 rounded-[24px] border border-white/[0.06] bg-black/20 p-4">
                <p className="text-[11px] uppercase tracking-[0.14em] text-white/26">Mini conversation visible par le client</p>
                <div className="mt-3 space-y-3">
                  <div className="ml-auto max-w-[88%] rounded-[20px] rounded-br-md bg-white/[0.06] px-4 py-3 text-[13px] leading-6 text-white/72">
                    {preview.customerPrompt}
                  </div>
                  <div className="max-w-[94%] rounded-[20px] rounded-bl-md bg-orange-500/12 px-4 py-4 text-[14px] leading-7 text-white/82">
                    {preview.message}
                  </div>
                  <div className="max-w-[92%] rounded-[20px] border border-white/[0.06] bg-white/[0.03] px-4 py-3 text-[13px] leading-6 text-white/58">
                    {preview.handoffLine}
                  </div>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {preview.chips.map((chip) => (
                  <span key={chip} className="rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-[11px] text-white/58">
                    {chip}
                  </span>
                ))}
              </div>
              <p className="mt-4 text-[13px] leading-6 text-white/38">{preview.note}</p>
            </div>
          </div>
        </div>

        {flash ? <div className={`rounded-[22px] border px-4 py-3 text-[13px] ${flash.tone === "success" ? "border-emerald-400/18 bg-emerald-400/[0.08] text-emerald-100" : flash.tone === "warning" ? "border-orange-400/20 bg-orange-500/[0.08] text-orange-100" : "border-red-400/20 bg-red-500/[0.08] text-red-100"}`}>{flash.message}</div> : null}
        {error ? <div className="rounded-[22px] border border-red-400/20 bg-red-500/[0.08] px-4 py-3 text-[13px] text-red-100">{error}</div> : null}
        {renderTab()}
      </div>
    </div>
  );
}

function QuickStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[22px] border border-white/[0.06] bg-white/[0.025] px-4 py-3">
      <p className="text-[10px] uppercase tracking-[0.18em] text-white/24">{label}</p>
      <p className="mt-2 text-[14px] text-white">{value}</p>
    </div>
  );
}
