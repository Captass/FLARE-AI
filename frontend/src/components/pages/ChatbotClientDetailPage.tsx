"use client";

import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";
import { motion } from "framer-motion";

const MessengerWorkspace = dynamic(
  () => import("@/components/MessengerWorkspace"),
  {
    loading: () => (
      <div className="flex flex-1 items-center justify-center py-20">
        <div className="flex items-center gap-3 text-fg/40">
          <Loader2 size={18} className="animate-spin" />
          <span className="text-sm">Chargement de la fiche client…</span>
        </div>
      </div>
    ),
    ssr: false,
  }
);

interface ChatbotClientDetailPageProps {
  token?: string | null;
  getFreshToken?: (forceRefresh?: boolean) => Promise<string | null>;
  /** ID du contact à afficher en focus */
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
      <div className="mx-auto w-full max-w-[1100px] px-4 py-6 md:px-8 flex flex-col gap-6">

        {/* ── Header ── */}
        <motion.header
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="space-y-2"
        >
          <h1 className="text-3xl font-bold tracking-tight text-fg/90">
            Fiche client
          </h1>
          <p className="text-lg text-[var(--text-muted)]">
            Historique de la conversation et données du contact
          </p>
        </motion.header>

        {/* ── MessengerWorkspace with preselected contact ── */}
        <MessengerWorkspace
          authToken={token}
          initialConversationId={contactId}
          selectedPageId={selectedPageId}
        />
      </div>
    </div>
  );
}
