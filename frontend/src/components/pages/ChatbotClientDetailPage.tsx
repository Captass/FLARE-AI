"use client";

import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";
import { motion } from "framer-motion";

const MessengerWorkspace = dynamic(() => import("@/components/MessengerWorkspace"), {
  loading: () => (
    <div className="flex flex-1 items-center justify-center py-20">
      <div className="flex items-center gap-3 text-fg/40">
        <Loader2 size={18} className="animate-spin" />
        <span className="text-sm">Chargement de la fiche client...</span>
      </div>
    </div>
  ),
  ssr: false,
});

interface ChatbotClientDetailPageProps {
  token?: string | null;
  getFreshToken?: (forceRefresh?: boolean) => Promise<string | null>;
  contactId?: string | null;
  selectedPageId?: string | null;
}

export default function ChatbotClientDetailPage({
  token,
  getFreshToken,
  contactId,
  selectedPageId,
}: ChatbotClientDetailPageProps) {
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-6 px-4 py-6 md:px-8">
        <motion.header
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="space-y-2"
        >
          <h1 className="text-3xl font-bold tracking-tight text-fg/90">Fiche client</h1>
          <p className="text-lg text-[var(--text-muted)]">Historique de la conversation et donnees du contact</p>
        </motion.header>

        {!selectedPageId ? (
          <div className="rounded-xl border border-orange-500/30 bg-orange-500/10 px-4 py-3 text-sm text-orange-200/90">
            Selectionnez d&apos;abord une page Facebook dans l&apos;accueil Chatbot.
          </div>
        ) : !contactId ? (
          <div className="rounded-xl border border-fg/[0.1] bg-fg/[0.03] px-4 py-3 text-sm text-fg/70">
            Aucun client selectionne. Ouvrez la section Clients et choisissez une conversation.
          </div>
        ) : (
          <MessengerWorkspace authToken={token} getFreshToken={getFreshToken} initialConversationId={contactId} selectedPageId={selectedPageId} />
        )}
      </div>
    </div>
  );
}
