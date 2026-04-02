"use client";

import { useEffect, useState, useCallback } from "react";
import { Loader2 } from "lucide-react";
import { motion } from "framer-motion";

import type { NavLevel } from "@/components/NavBreadcrumb";
import ChatbotStatusTab from "@/components/chatbot/ChatbotStatusTab";
import ChatbotCatalogueTab from "@/components/chatbot/ChatbotCatalogueTab";
import ChatbotPortfolioTab from "@/components/chatbot/ChatbotPortfolioTab";
import { FeatureLockedPanel } from "@/components/chatbot/ChatbotUi";
import PageSelector from "@/components/PageSelector";

import {
  getChatbotOverview,
  getBillingFeatures,
  getCatalogue,
  getPortfolio,
  createCatalogueItem,
  updateCatalogueItem,
  deleteCatalogueItem,
  createPortfolioItem,
  updatePortfolioItem,
  deletePortfolioItem,
  type ChatbotOverview,
  type BillingFeatures,
  type CatalogueItem,
  type PortfolioItem,
} from "@/lib/api";
import {
  loadFacebookMessengerStatus,
  activateFacebookMessengerPage,
  disconnectFacebookMessengerPage,
  resyncFacebookMessengerPages,
  runFacebookMessengerOAuthPopup,
  type FacebookMessengerStatus,
} from "@/lib/facebookMessenger";
import { CATALOGUE_STARTER_TEMPLATES, EMPTY_CATALOGUE_INPUT, EMPTY_PORTFOLIO_INPUT } from "@/components/chatbot/chatbotWorkspaceUtils";

interface ChatbotParametresPageProps {
  token?: string | null;
  getFreshToken?: (forceRefresh?: boolean) => Promise<string | null>;
  onPush: (level: NavLevel) => void;
  onRequestAccess?: () => void;
  onRequestOrganizationSelection?: () => void;
  onRequestUpgrade?: () => void;
  selectedPageId?: string | null;
  onSelectPage?: (pageId: string) => void;
  onPagesChanged?: (pages: import("@/lib/facebookMessenger").FacebookMessengerPage[]) => void;
}

export default function ChatbotParametresPage({
  token,
  getFreshToken,
  onRequestAccess,
  onRequestUpgrade,
  selectedPageId,
  onSelectPage,
  onPagesChanged,
}: ChatbotParametresPageProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [overview, setOverview] = useState<ChatbotOverview | null>(null);
  const [billing, setBilling] = useState<BillingFeatures | null>(null);
  const [facebookStatus, setFacebookStatus] = useState<FacebookMessengerStatus | null>(null);
  
  const [catalogue, setCatalogue] = useState<CatalogueItem[]>([]);
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>([]);

  // States interactifs
  const [facebookAuthLoading, setFacebookAuthLoading] = useState(false);
  const [facebookSyncLoading, setFacebookSyncLoading] = useState(false);
  const [facebookBusyPageId, setFacebookBusyPageId] = useState<string | null>(null);
  const [facebookError, setFacebookError] = useState<string | null>(null);

  const [savingSection, setSavingSection] = useState<string | null>(null);
  const [catalogueDraft, setCatalogueDraft] = useState(EMPTY_CATALOGUE_INPUT);
  const [editingCatalogueId, setEditingCatalogueId] = useState<string | null>(null);
  const [portfolioDraft, setPortfolioDraft] = useState(EMPTY_PORTFOLIO_INPUT);
  const [editingPortfolioId, setEditingPortfolioId] = useState<string | null>(null);

  const resolveAccessToken = useCallback(async (force = false) => {
    if (getFreshToken) {
      const t = await getFreshToken(force);
      if (t) return t;
    }
    return token || null;
  }, [getFreshToken, token]);

  const loadData = useCallback(async (isRefresh = false) => {
    const accessToken = await resolveAccessToken(isRefresh);
    if (!accessToken) {
      setError("Session expirée. Veuillez recharger.");
      setLoading(false);
      return;
    }
    if (!isRefresh) setLoading(true);
    setError(null);
    try {
      const [ovResult, billingResult, catalogueResult, fbResult] = await Promise.allSettled([
        getChatbotOverview(accessToken, selectedPageId),
        getBillingFeatures(accessToken),
        getCatalogue(accessToken, selectedPageId),
        loadFacebookMessengerStatus(accessToken),
      ]);

      if (ovResult.status === "fulfilled") setOverview(ovResult.value);
      const nextBilling = billingResult.status === "fulfilled" ? billingResult.value : null;
      if (nextBilling) setBilling(nextBilling);
      if (catalogueResult.status === "fulfilled") setCatalogue(catalogueResult.value);
      if (fbResult.status === "fulfilled") {
        setFacebookStatus(fbResult.value);
        onPagesChanged?.(fbResult.value.pages);
      } else if (fbResult.status === "rejected") {
        const msg =
          fbResult.reason instanceof Error
            ? fbResult.reason.message
            : "État Facebook Messenger indisponible.";
        setFacebookError((prev) => prev ?? msg);
      }

      if (nextBilling?.features.has_portfolio) {
        getPortfolio(accessToken, selectedPageId)
          .then(setPortfolio)
          .catch(() => {});
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  }, [resolveAccessToken, selectedPageId]);

  useEffect(() => {
    void loadData();
  }, [loadData, selectedPageId]);

  // Auto-select the active page if none is selected yet
  useEffect(() => {
    if (!selectedPageId && overview?.active_page?.page_id) {
      onSelectPage?.(overview.active_page.page_id);
    }
  }, [selectedPageId, overview, onSelectPage]);


  const canEdit = facebookStatus?.can_edit ?? false;
  const canManagePages = facebookStatus?.can_manage_pages ?? false;
  const planFeatures = billing?.features || null;

  // --- Facebook Actions ---

  const handleConnectFacebook = async () => {
    const accessToken = await resolveAccessToken(true);
    if (!accessToken) return;
    if (!canManagePages) {
      setFacebookError("Droits insuffisants pour connecter Facebook.");
      return;
    }
    setFacebookAuthLoading(true);
    setFacebookError(null);
    try {
      await runFacebookMessengerOAuthPopup(accessToken);
      await loadData(true);
    } catch (err) {
      setFacebookError(err instanceof Error ? err.message : "Impossible de connecter");
    } finally {
      setFacebookAuthLoading(false);
    }
  };

  const handleActivatePage = async (pageId: string) => {
    if (!canManagePages) return;
    const accessToken = await resolveAccessToken(true);
    if (!accessToken) return;
    setFacebookBusyPageId(pageId);
    try {
      await activateFacebookMessengerPage(pageId, accessToken);
      await loadData(true);
    } catch (err) {
      setFacebookError(err instanceof Error ? err.message : "Erreur activation");
    } finally {
      setFacebookBusyPageId(null);
    }
  };

  const handleDisconnectPage = async (pageId: string) => {
    if (!canManagePages) return;
    const accessToken = await resolveAccessToken(true);
    if (!accessToken) return;
    setFacebookBusyPageId(pageId);
    try {
      await disconnectFacebookMessengerPage(pageId, accessToken);
      await loadData(true);
    } catch (err) {
      setFacebookError(err instanceof Error ? err.message : "Erreur déconnexion");
    } finally {
      setFacebookBusyPageId(null);
    }
  };

  const handleSyncPagesListOnly = async () => {
    if (!canManagePages) return;
    const accessToken = await resolveAccessToken(true);
    if (!accessToken) return;
    setFacebookSyncLoading(true);
    setFacebookError(null);
    try {
      await resyncFacebookMessengerPages(accessToken);
      await loadData(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (/expiré|Reconnectez|session|Reconnectez Facebook|actualiser/i.test(msg)) {
        setFacebookError(
          `${msg} Utilisez le bouton « Ajouter des pages (Meta) » pour rouvrir Facebook et renouveler l’autorisation.`
        );
      } else {
        setFacebookError(msg || "Impossible d'actualiser la liste des pages.");
      }
    } finally {
      setFacebookSyncLoading(false);
    }
  };

  // --- Render ---

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center py-20">
        <div className="flex items-center gap-3 text-white/40">
          <Loader2 size={18} className="animate-spin" />
          <span className="text-sm">Chargement des paramètres…</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center py-20">
        <p className="text-red-400">{error}</p>
      </div>
    );
  }

  const selectedPageName = facebookStatus?.pages.find(p => p.page_id === selectedPageId)?.page_name || overview?.active_page?.page_name;

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-[1100px] px-4 py-6 md:px-8 flex flex-col gap-8">
        <motion.header
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="space-y-2"
        >
          <h1 className="text-3xl font-bold tracking-tight text-white/90">
            {selectedPageName ? `Paramètres : ${selectedPageName}` : "Paramètres Assistant"}
          </h1>
          <p className="text-lg text-[var(--text-muted)]">
            Connexion Facebook, instructions et catalogue
          </p>
        </motion.header>

        <motion.div
           initial={{ opacity: 0, y: 16 }}
           animate={{ opacity: 1, y: 0 }}
           transition={{ duration: 0.4, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
           className="flex flex-col gap-8 pb-12"
        >
           {/* SECTION 0: Multi-pages Facebook */}
           <PageSelector
             pages={facebookStatus?.pages || []}
             selectedPageId={selectedPageId || null}
             onSelect={(pageId) => onSelectPage?.(pageId)}
             onConnectMetaPages={() => void handleConnectFacebook()}
             onSyncPagesList={
               (facebookStatus?.pages?.length ?? 0) > 0 && canManagePages
                 ? () => void handleSyncPagesListOnly()
                 : undefined
             }
             connectMetaBusy={facebookAuthLoading}
             syncListBusy={facebookSyncLoading}
             loading={loading}
             onActivatePage={handleActivatePage}
             canManagePages={canManagePages}
             busyPageId={facebookBusyPageId}
           />

           {/* SECTION 1: Connexion Facebook */}
           <ChatbotStatusTab
             overview={overview}
             status={facebookStatus}
             loading={loading}
             authLoading={facebookAuthLoading}
             busyPageId={facebookBusyPageId}
             error={facebookError}
             canEdit={canEdit}
             canManagePages={canManagePages}
             catalogueCount={catalogue.length}
             onRefresh={() => void loadData(true)}
             onJumpToTab={() => {}} 
             onConnect={handleConnectFacebook}
             onActivate={handleActivatePage}
             onDisconnect={handleDisconnectPage}
           />

           {/* SECTION 2: Catalogue */}
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
               setCatalogueDraft({ ...template, sort_order: Math.max(0, catalogue.length) });
             }}
             onEdit={(item) => {
               setEditingCatalogueId(item.id);
               setCatalogueDraft({ ...item });
             }}
             onReset={() => {
               setEditingCatalogueId(null);
               setCatalogueDraft({ ...EMPTY_CATALOGUE_INPUT, sort_order: Math.max(0, catalogue.length) });
             }}
             onSave={async () => {
               if (!catalogueDraft.name?.trim()) return;
               const accessToken = await resolveAccessToken();
               if (!accessToken) return;
               setSavingSection("catalogue");
               try {
                 if (editingCatalogueId) await updateCatalogueItem(editingCatalogueId, catalogueDraft, accessToken);
                 else await createCatalogueItem(catalogueDraft, accessToken, selectedPageId);
                 setCatalogue(await getCatalogue(accessToken, selectedPageId));
                 setEditingCatalogueId(null);
                 setCatalogueDraft(EMPTY_CATALOGUE_INPUT);
               } catch (err) {
                 console.error(err);
                 alert("Erreur catalogue");
               } finally { setSavingSection(null); }
             }}
             onDelete={async (id) => {
               const accessToken = await resolveAccessToken(true);
               if (!accessToken) return;
               setSavingSection("catalogue");
               try {
                 await deleteCatalogueItem(id, accessToken);
                 setCatalogue(await getCatalogue(accessToken, selectedPageId));
               } catch { alert("Erreur suppr catalogue"); }
               finally { setSavingSection(null); }
             }}
           />

           {/* SECTION 3: Portfolio */}
           {planFeatures?.has_portfolio ? (
             <ChatbotPortfolioTab
               items={portfolio}
               draft={portfolioDraft}
               editingId={editingPortfolioId}
               canEdit={canEdit}
               saving={savingSection === "portfolio"}
               onChangeDraft={setPortfolioDraft}
               onEdit={(item) => {
                 setEditingPortfolioId(item.id);
                 setPortfolioDraft({ ...item });
               }}
               onReset={() => {
                 setEditingPortfolioId(null);
                 setPortfolioDraft({ ...EMPTY_PORTFOLIO_INPUT, sort_order: Math.max(0, portfolio.length) });
               }}
               onSave={async () => {
                 if (!portfolioDraft.title?.trim()) return;
                 const accessToken = await resolveAccessToken();
                 if (!accessToken) return;
                 setSavingSection("portfolio");
                 try {
                   if (editingPortfolioId) await updatePortfolioItem(editingPortfolioId, portfolioDraft, accessToken);
                   else await createPortfolioItem(portfolioDraft, accessToken, selectedPageId);
                   setPortfolio(await getPortfolio(accessToken, selectedPageId));
                   setEditingPortfolioId(null);
                 } catch (err) {
                   console.error(err);
                   alert("Erreur portfolio");
                 } finally { setSavingSection(null); }
               }}
               onDelete={async (id) => {
                 const accessToken = await resolveAccessToken(true);
                 if (!accessToken) return;
                 setSavingSection("portfolio");
                 try {
                   await deletePortfolioItem(id, accessToken);
                   setPortfolio(await getPortfolio(accessToken, selectedPageId));
                 } catch { alert("Erreur suppr portfolio"); }
                 finally { setSavingSection(null); }
               }}
             />
           ) : (
             <FeatureLockedPanel 
               title="Disponible dès le plan Pro" 
               body="Votre chatbot peut partager automatiquement vos réalisations et preuves sociales en conversation." 
               ctaLabel="Passer à Pro" 
               onRequestUpgrade={onRequestUpgrade} 
             />
           )}
        </motion.div>
      </div>
    </div>
  );
}
