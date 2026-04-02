"use client";

import { useEffect, useState, useCallback } from "react";
import { Loader2 } from "lucide-react";
import { motion } from "framer-motion";

import type { NavLevel } from "@/components/NavBreadcrumb";
import ChatbotIdentityTab from "@/components/chatbot/ChatbotIdentityTab";
import ChatbotBusinessTab from "@/components/chatbot/ChatbotBusinessTab";
import ChatbotSalesTab from "@/components/chatbot/ChatbotSalesTab";
import {
  DEFAULT_CHATBOT_PREFERENCES,
  type ChatbotPreferences,
  type SalesConfig,
  getChatbotPreferences,
  updateChatbotPreferences,
  getSalesConfig,
  updateSalesConfig,
  getBillingFeatures,
  type BillingFeatures,
} from "@/lib/api";
import {
  createEmptyHours,
  parseBusinessHours,
  serializeBusinessHours,
  EMPTY_SALES_CONFIG,
} from "@/components/chatbot/chatbotWorkspaceUtils";


interface ChatbotPersonnalisationPageProps {
  token?: string | null;
  getFreshToken?: (forceRefresh?: boolean) => Promise<string | null>;
  onPush: (level: NavLevel) => void;
  selectedPageId?: string | null;
  /** Nom affiché de la page (hub Chatbot) — les préférences sont enregistrées par page quand un id est sélectionné. */
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
  const [businessHoursDraft, setBusinessHoursDraft] = useState(createEmptyHours());
  const [salesConfig, setSalesConfig] = useState<SalesConfig>(EMPTY_SALES_CONFIG);
  const [hasSalesScript, setHasSalesScript] = useState(false);
  
  const [savingSection, setSavingSection] = useState<string | null>(null);

  const resolveAccessToken = useCallback(async () => {
    if (token) return token;
    if (getFreshToken) return await getFreshToken();
    return null;
  }, [token, getFreshToken]);

  const loadData = useCallback(async () => {
    const accessToken = await resolveAccessToken();
    if (!accessToken) {
      setError("Session expirée. Veuillez recharger.");
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const [nextPrefs, nextBilling] = await Promise.all([
        getChatbotPreferences(accessToken, selectedPageId),
        getBillingFeatures(accessToken)
      ]);
      setPreferences(nextPrefs);
      setBusinessHoursDraft(parseBusinessHours(nextPrefs.business_hours));
      setHasSalesScript(nextBilling.features.has_sales_script);
      
      if (nextBilling.features.has_sales_script) {
        setSalesConfig(await getSalesConfig(accessToken, selectedPageId));
      } else {
        setSalesConfig({
          ...EMPTY_SALES_CONFIG,
          organization_slug: nextPrefs.organization_slug || "",
          handoff_mode: nextPrefs.handoff_mode,
          handoff_keywords: nextPrefs.handoff_keywords,
        });
      }
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
      const payload = { ...preferences };
      if (section === "business") {
        payload.business_hours = serializeBusinessHours(businessHoursDraft);
      }
      const saved = await updateChatbotPreferences(payload, accessToken, selectedPageId);
      setPreferences(saved);
      if (section === "business") setBusinessHoursDraft(parseBusinessHours(saved.business_hours));
    } catch (err) {
      console.error(err);
      alert("Erreur lors de l'enregistrement de la configuration.");
    } finally {
      setSavingSection(null);
    }
  };

  const onSaveSalesConfig = async () => {
    const accessToken = await resolveAccessToken();
    if (!accessToken) return;
    setSavingSection("sales");
    try {
      const saved = await updateSalesConfig(salesConfig, accessToken, selectedPageId);
      setSalesConfig(saved);
      // Synchroniser handoff (si édité dans SalesTab, ça affecte les preferences aussi via webhook ou DB)
      // Mettre à jour l'UI avec certitude:
      const savedPrefs = await getChatbotPreferences(accessToken, selectedPageId);
      setPreferences(savedPrefs);
    } catch (err) {
      console.error(err);
      alert("Erreur de l'enregistrement du script.");
    } finally {
      setSavingSection(null);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center py-20">
        <div className="flex items-center gap-3 text-white/40">
          <Loader2 size={18} className="animate-spin" />
          <span className="text-sm">Chargement de la personnalisation…</span>
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

  // Pour l'instant, seul l'admin peut editer (canEdit = true par defaut selon la table si le endpoint renvoie 200)
  const canEdit = true;

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-[1100px] px-4 py-6 md:px-8 flex flex-col gap-8">
        
        {/* ── Header ── */}
        <motion.header
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="space-y-2"
        >
          <h1 className="text-3xl font-bold tracking-tight text-white/90">
            Personnalisation
            {selectedPageName ? (
              <span className="block mt-1 text-xl font-semibold text-orange-400/95">— {selectedPageName}</span>
            ) : null}
          </h1>
          <p className="text-lg text-[var(--text-muted)]">
            Identité, ton, langue, entreprise et offres du bot Messenger
          </p>
        </motion.header>

        {!selectedPageId ? (
          <div
            role="status"
            className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100/90 leading-relaxed"
          >
            Aucune page n’est sélectionnée dans l’accueil Chatbot : les champs affichés viennent des{" "}
            <strong className="text-amber-50">réglages par défaut de l’espace</strong>. Pour configurer un canal précis,
            retournez au hub, cliquez sur une page dans la liste, puis rouvrez Personnalisation — les enregistrements
            seront alors liés à cette page.
          </div>
        ) : (
          <div className="rounded-xl border border-fg/[0.08] bg-fg/[0.03] px-4 py-3 text-sm text-fg/70 leading-relaxed">
            Ces réglages sont enregistrés pour{" "}
            <strong className="text-fg/90">{selectedPageName || `la page ${selectedPageId}`}</strong>. Pour une autre
            page, changez la sélection sur l’accueil Chatbot puis revenez ici.
          </div>
        )}

        {/* ── Tabs superposées linéairement ── */}
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
             businessHoursDraft={businessHoursDraft} 
             onChange={setPreferences} 
             onBusinessHoursChange={setBusinessHoursDraft} 
             canEdit={canEdit} 
             saving={savingSection === "business"} 
             onSave={() => void onSavePreferences("business")} 
           />

           <ChatbotSalesTab 
             salesConfig={salesConfig} 
             onChange={setSalesConfig} 
             canEdit={canEdit} 
             saving={savingSection === "sales"} 
             hasSalesScript={hasSalesScript} 
             onSave={() => void onSaveSalesConfig()} 
           />
        </motion.div>
      </div>
    </div>
  );
}
