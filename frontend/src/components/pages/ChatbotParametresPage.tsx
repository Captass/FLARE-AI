"use client";

import { useEffect, useState, useCallback } from "react";
import { Loader2 } from "lucide-react";
import { motion } from "framer-motion";

import type { NavLevel } from "@/components/NavBreadcrumb";
import PageSelector from "@/components/PageSelector";

import {
  getChatbotOverview,
  type ChatbotOverview,
} from "@/lib/api";
import {
  loadFacebookMessengerStatus,
  activateFacebookMessengerPage,
  deactivateFacebookMessengerPage,
  resyncFacebookMessengerPages,
  runFacebookMessengerOAuthPopup,
  type FacebookMessengerStatus,
} from "@/lib/facebookMessenger";


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
  selectedPageId,
  onSelectPage,
  onPagesChanged,
}: ChatbotParametresPageProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [overview, setOverview] = useState<ChatbotOverview | null>(null);
  const [facebookStatus, setFacebookStatus] = useState<FacebookMessengerStatus | null>(null);

  // States interactifs
  const [facebookAuthLoading, setFacebookAuthLoading] = useState(false);
  const [facebookSyncLoading, setFacebookSyncLoading] = useState(false);
  const [facebookBusyPageId, setFacebookBusyPageId] = useState<string | null>(null);
  const [facebookError, setFacebookError] = useState<string | null>(null);

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
      const [ovResult, fbResult] = await Promise.allSettled([
        getChatbotOverview(accessToken, selectedPageId),
        loadFacebookMessengerStatus(accessToken),
      ]);

      if (ovResult.status === "fulfilled") setOverview(ovResult.value);
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  }, [onPagesChanged, resolveAccessToken, selectedPageId]);

  useEffect(() => {
    void loadData();
  }, [loadData, selectedPageId]);

  // Auto-select the active page if none is selected yet
  useEffect(() => {
    if (!selectedPageId && overview?.active_page?.page_id) {
      onSelectPage?.(overview.active_page.page_id);
    }
  }, [selectedPageId, overview, onSelectPage]);


  const canManagePages = facebookStatus?.can_manage_pages ?? false;

  // --- Facebook Actions ---

  const handleConnectFacebook = async () => {
    const accessToken = await resolveAccessToken(true);
    if (!accessToken) return;
    if (!canManagePages) {
      setFacebookError(
        facebookStatus?.facebook_access_message ||
          "Seuls le proprietaire ou un admin de cet espace peuvent connecter Facebook."
      );
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

  const handleDeactivatePage = async (pageId: string) => {
    if (!canManagePages) return;
    const accessToken = await resolveAccessToken(true);
    if (!accessToken) return;
    setFacebookBusyPageId(pageId);
    try {
      await deactivateFacebookMessengerPage(pageId, accessToken);
      await loadData(true);
    } catch (err) {
      setFacebookError(err instanceof Error ? err.message : "Erreur désactivation");
    } finally {
      setFacebookBusyPageId(null);
    }
  };

  const handleRemovePage = async (pageId: string) => {
    if (!canManagePages) return;
    const accessToken = await resolveAccessToken(true);
    if (!accessToken) return;
    setFacebookBusyPageId(pageId);
    try {
      const { disconnectFacebookMessengerPage } = await import("@/lib/facebookMessenger");
      await disconnectFacebookMessengerPage(pageId, accessToken);
      await loadData(true);
    } catch (err) {
      setFacebookError(err instanceof Error ? err.message : "Erreur suppression");
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
        
        {/* ── Header ── */}
        <motion.header
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="space-y-2"
        >
          <h1 className="text-3xl font-bold tracking-tight text-white/90">
            Paramètres
            {selectedPageName ? (
              <span className="block mt-1 text-xl font-semibold text-cyan-400/95">— {selectedPageName}</span>
            ) : null}
          </h1>
          <p className="text-lg text-[var(--text-muted)]">
            Gérez votre connexion Facebook.
          </p>
        </motion.header>

        {facebookError && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200/90 shadow-sm"
          >
            {facebookError}
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          className="pb-12"
        >
          {/* FACEBOOK PAGES ONLY */}
          {facebookStatus && (
            <div className="pt-6">
              <PageSelector
                pages={facebookStatus.pages}
                selectedPageId={selectedPageId || null}
                onSelect={(pid) => onSelectPage?.(pid)}
                onConnectMetaPages={handleConnectFacebook}
                onSyncPagesList={facebookStatus.pages.length > 0 ? handleSyncPagesListOnly : undefined}
                connectMetaBusy={facebookAuthLoading}
                syncListBusy={facebookSyncLoading}
                onActivatePage={handleActivatePage}
                onDeactivatePage={handleDeactivatePage}
                onRemovePage={handleRemovePage}
                canManagePages={canManagePages}
                busyPageId={facebookBusyPageId}
              />
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
