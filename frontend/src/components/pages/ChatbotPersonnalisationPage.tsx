"use client";

import { useEffect, useState, useCallback } from "react";
import { Loader2 } from "lucide-react";
import { motion } from "framer-motion";

import type { NavLevel } from "@/components/NavBreadcrumb";
import ChatbotIdentityTab from "@/components/chatbot/ChatbotIdentityTab";
import ChatbotBusinessTab from "@/components/chatbot/ChatbotBusinessTab";
import ChatbotCatalogueTab from "@/components/chatbot/ChatbotCatalogueTab";
import ChatbotHandoffTab from "@/components/chatbot/ChatbotHandoffTab";
import {
  DEFAULT_CHATBOT_PREFERENCES,
  type ChatbotPreferences,
  getChatbotPreferences,
  updateChatbotPreferences,
  getCatalogue,
  createCatalogueItem,
  updateCatalogueItem,
  deleteCatalogueItem,
  type CatalogueItem,
  type CatalogueItemInput,
  type PlanFeatures,
} from "@/lib/api";
import { CATALOGUE_STARTER_TEMPLATES, EMPTY_CATALOGUE_INPUT } from "@/components/chatbot/chatbotWorkspaceUtils";

interface ChatbotPersonnalisationPageProps {
  token?: string | null;
  getFreshToken?: (forceRefresh?: boolean) => Promise<string | null>;
  onPush: (level: NavLevel) => void;
  selectedPageId?: string | null;
  selectedPageName?: string | null;
}

export default function ChatbotPersonnalisationPage({
  token,
  getFreshToken,
  selectedPageId,
  selectedPageName = null,
}: ChatbotPersonnalisationPageProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [preferences, setPreferences] = useState<ChatbotPreferences>(DEFAULT_CHATBOT_PREFERENCES);
  const [catalogue, setCatalogue] = useState<CatalogueItem[]>([]);

  const [savingSection, setSavingSection] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ tone: "success" | "error" | "warning"; message: string } | null>(null);
  const [catalogueDraft, setCatalogueDraft] = useState<CatalogueItemInput>(EMPTY_CATALOGUE_INPUT);
  const [editingCatalogueId, setEditingCatalogueId] = useState<string | null>(null);
  const [pendingDeleteCatalogueId, setPendingDeleteCatalogueId] = useState<string | null>(null);

  const resolveAccessToken = useCallback(async () => {
    if (getFreshToken) return await getFreshToken();
    if (token) return token;
    return null;
  }, [token, getFreshToken]);

  const loadData = useCallback(async () => {
    const accessToken = await resolveAccessToken();
    if (!accessToken) {
      setError("Session expiree. Veuillez recharger.");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setFeedback(null);

      const [nextPrefs, nextCat] = await Promise.all([
        getChatbotPreferences(accessToken, selectedPageId),
        getCatalogue(accessToken, selectedPageId),
      ]);

      setPreferences(nextPrefs);
      setCatalogue(nextCat);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  }, [resolveAccessToken, selectedPageId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const onSavePreferences = async (section: string) => {
    const accessToken = await resolveAccessToken();
    if (!accessToken) return;
    setSavingSection(section);
    try {
      const saved = await updateChatbotPreferences(preferences, accessToken, selectedPageId);
      setPreferences(saved);
      setFeedback({ tone: "success", message: "Les reglages ont ete enregistres." });
    } catch (err) {
      console.error(err);
      setFeedback({
        tone: "error",
        message: err instanceof Error ? err.message : "Erreur lors de l'enregistrement de la configuration.",
      });
    } finally {
      setSavingSection(null);
    }
  };

  const handleSaveCatalogue = async () => {
    if (!catalogueDraft.name?.trim()) {
      setFeedback({ tone: "warning", message: "Le nom du produit est requis." });
      return;
    }

    const accessToken = await resolveAccessToken();
    if (!accessToken) return;

    setSavingSection("catalogue");
    try {
      if (editingCatalogueId) {
        await updateCatalogueItem(editingCatalogueId, catalogueDraft, accessToken);
      } else {
        await createCatalogueItem(catalogueDraft, accessToken, selectedPageId);
      }
      const nextCat = await getCatalogue(accessToken, selectedPageId);
      setCatalogue(nextCat);
      setEditingCatalogueId(null);
      setCatalogueDraft(EMPTY_CATALOGUE_INPUT);
      setFeedback({ tone: "success", message: "Le catalogue a ete mis a jour." });
    } catch (err) {
      setFeedback({
        tone: "error",
        message: "Erreur catalogue: " + (err instanceof Error ? err.message : String(err)),
      });
    } finally {
      setSavingSection(null);
    }
  };

  const handleDeleteCatalogue = async (id: string) => {
    const accessToken = await resolveAccessToken();
    if (!accessToken) return;

    try {
      await deleteCatalogueItem(id, accessToken);
      const nextCat = await getCatalogue(accessToken, selectedPageId);
      setCatalogue(nextCat);
      setFeedback({ tone: "success", message: "Le produit a ete supprime du catalogue." });
      setPendingDeleteCatalogueId(null);
    } catch (err) {
      setFeedback({
        tone: "error",
        message: "Erreur suppression catalogue: " + (err instanceof Error ? err.message : String(err)),
      });
    }
  };

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center py-20">
        <div className="flex items-center gap-3 text-[var(--text-secondary)]">
          <Loader2 size={18} className="animate-spin" />
          <span className="text-sm">Chargement de la personnalisation...</span>
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

  const canEdit = true;
  const unlimitedPlan: PlanFeatures = {
    chatbot_messages_limit: -1,
    catalogue_items_limit: -1,
    has_leads: true,
    has_budget: true,
    has_portfolio: true,
    has_sales_script: true,
    has_chatbot_content: true,
    has_multi_page: false,
    has_team: false,
    has_image_generation: true,
    has_file_generation: true,
    assistant_tier: "full",
    upgrade_to: null,
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-[1100px] px-4 py-6 md:px-8 flex flex-col gap-8">
        <motion.header
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="space-y-2"
        >
          <h1 className="text-3xl font-bold tracking-tight text-[var(--text-primary)]">
            Personnalisation
            {selectedPageName ? (
              <span className="mt-1 block text-xl font-semibold text-orange-500">- {selectedPageName}</span>
            ) : null}
          </h1>
          <p className="text-lg text-[var(--text-muted)]">Configurez l&apos;identite du bot et vos offres / produits</p>
        </motion.header>

        {feedback ? (
          <div
            role="status"
            className={`rounded-xl border px-4 py-3 text-sm leading-relaxed ${
              feedback.tone === "success"
                ? "border-orange-500/25 bg-orange-500/10 text-[var(--text-primary)]"
                : feedback.tone === "warning"
                  ? "border-[var(--border-default)] bg-[var(--surface-subtle)] text-[var(--text-primary)]"
                  : "border-red-500/25 bg-red-500/10 text-[var(--text-primary)]"
            }`}
          >
            {feedback.message}
          </div>
        ) : null}

        {pendingDeleteCatalogueId ? (
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-[var(--text-primary)]">
            <span>Confirmer la suppression de ce produit du catalogue ?</span>
            <button
              type="button"
              onClick={() => void handleDeleteCatalogue(pendingDeleteCatalogueId)}
              className="rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-white"
            >
              Supprimer
            </button>
            <button
              type="button"
              onClick={() => setPendingDeleteCatalogueId(null)}
              className="rounded-lg border border-[var(--border-default)] bg-[var(--surface-base)] px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-primary)]"
            >
              Annuler
            </button>
          </div>
        ) : null}

        {!selectedPageId ? (
          <div
            role="status"
            className="rounded-xl border border-orange-500/25 bg-orange-500/10 px-4 py-3 text-sm leading-relaxed text-[var(--text-primary)]"
          >
            Aucune page n&apos;est selectionnee dans l&apos;accueil Chatbot. Les reglages affiches sont les{" "}
            <strong className="text-[var(--text-primary)]">reglages par defaut</strong>. Pour configurer une page precise,
            retournez au hub et selectionnez une page.
          </div>
        ) : (
          <div className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-subtle)] px-4 py-3 text-sm leading-relaxed text-[var(--text-secondary)]">
            Ces reglages sont enregistres pour{" "}
            <strong className="text-[var(--text-primary)]">{selectedPageName || `la page ${selectedPageId}`}</strong>.
          </div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col gap-8 pb-12"
        >
          <ChatbotIdentityTab
            preferences={preferences}
            onChange={setPreferences}
            canEdit={canEdit}
            saving={savingSection === "identity"}
            onSave={() => void onSavePreferences("identity")}
          />

          <ChatbotBusinessTab
            preferences={preferences}
            onChange={setPreferences}
            canEdit={canEdit}
            saving={savingSection === "business"}
            onSave={() => void onSavePreferences("business")}
          />

          <ChatbotCatalogueTab
            items={catalogue}
            draft={catalogueDraft}
            editingId={editingCatalogueId}
            canEdit={canEdit}
            saving={savingSection === "catalogue"}
            planFeatures={unlimitedPlan}
            templates={CATALOGUE_STARTER_TEMPLATES}
            onChangeDraft={setCatalogueDraft}
            onApplyTemplate={(tpl) => setCatalogueDraft(tpl)}
            onEdit={(item) => {
              setEditingCatalogueId(item.id);
              setCatalogueDraft({
                name: item.name,
                description: item.description,
                price: item.price,
                category: item.category,
                image_url: item.image_url,
                sort_order: item.sort_order,
                is_active: item.is_active,
              });
            }}
            onReset={() => {
              setEditingCatalogueId(null);
              setCatalogueDraft(EMPTY_CATALOGUE_INPUT);
            }}
            onSave={() => void handleSaveCatalogue()}
            onDelete={(id) => {
              setPendingDeleteCatalogueId(id);
              setFeedback({ tone: "warning", message: "Suppression en attente de confirmation." });
            }}
          />

          <ChatbotHandoffTab
            preferences={preferences}
            onChange={setPreferences}
            canEdit={canEdit}
            saving={savingSection === "handoff"}
            onSave={() => void onSavePreferences("handoff")}
          />
        </motion.div>
      </div>
    </div>
  );
}
