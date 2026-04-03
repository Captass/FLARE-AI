"use client";

import { useEffect, useState, useCallback } from "react";
import { Loader2 } from "lucide-react";
import { motion } from "framer-motion";

import type { NavLevel } from "@/components/NavBreadcrumb";
import ChatbotIdentityTab from "@/components/chatbot/ChatbotIdentityTab";
import ChatbotBusinessTab from "@/components/chatbot/ChatbotBusinessTab";
import {
  DEFAULT_CHATBOT_PREFERENCES,
  type ChatbotPreferences,
  getChatbotPreferences,
  updateChatbotPreferences,
} from "@/lib/api";


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
      const nextPrefs = await getChatbotPreferences(accessToken, selectedPageId);
      setPreferences(nextPrefs);
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
    } catch (err) {
      console.error(err);
      alert("Erreur lors de l'enregistrement de la configuration.");
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
            Configurez l&apos;identité du bot et vos offres / produits
          </p>
        </motion.header>

        {!selectedPageId ? (
          <div
            role="status"
            className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100/90 leading-relaxed"
          >
            Aucune page n&apos;est sélectionnée dans l&apos;accueil Chatbot : les réglages affichés sont les{" "}
            <strong className="text-amber-50">réglages par défaut</strong>. Pour configurer une page précise,
            retournez au hub et sélectionnez une page.
          </div>
        ) : (
          <div className="rounded-xl border border-fg/[0.08] bg-fg/[0.03] px-4 py-3 text-sm text-fg/70 leading-relaxed">
            Ces réglages sont enregistrés pour{" "}
            <strong className="text-fg/90">{selectedPageName || `la page ${selectedPageId}`}</strong>.
          </div>
        )}

        {/* ── Two sections only ── */}
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
        </motion.div>
      </div>
    </div>
  );
}
