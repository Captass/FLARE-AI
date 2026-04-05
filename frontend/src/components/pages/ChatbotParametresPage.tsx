"use client";

import { useEffect, useState, useCallback } from "react";
import { Loader2 } from "lucide-react";
import { motion } from "framer-motion";


import PageSelector from "@/components/PageSelector";
import { getChatbotOverview, type ChatbotOverview } from "@/lib/api";
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
  onRequestOrganizationSelection?: () => void;
  selectedPageId?: string | null;
  onSelectPage?: (pageId: string) => void;
  onPagesChanged?: (pages: import("@/lib/facebookMessenger").FacebookMessengerPage[]) => void;
}

export default function ChatbotParametresPage({
  token,
  getFreshToken,
  onRequestOrganizationSelection,
  selectedPageId,
  onSelectPage,
  onPagesChanged,
}: ChatbotParametresPageProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [overview, setOverview] = useState<ChatbotOverview | null>(null);
  const [facebookStatus, setFacebookStatus] = useState<FacebookMessengerStatus | null>(null);
  const [facebookAuthLoading, setFacebookAuthLoading] = useState(false);
  const [facebookSyncLoading, setFacebookSyncLoading] = useState(false);
  const [facebookBusyPageId, setFacebookBusyPageId] = useState<string | null>(null);
  const [facebookError, setFacebookError] = useState<string | null>(null);

  const resolveAccessToken = useCallback(
    async (force = false) => {
      if (getFreshToken) {
        return await getFreshToken(force);
      }
      return token || null;
    },
    [getFreshToken, token]
  );

  const loadData = useCallback(
    async (isRefresh = false) => {
      const accessToken = await resolveAccessToken(isRefresh);
      if (!accessToken) {
        setError("Session expirée. Veuillez recharger.");
        setLoading(false);
        return;
      }
      if (!isRefresh) setLoading(true);
      setError(null);
      try {
        const [overviewResult, facebookResult] = await Promise.allSettled([
          getChatbotOverview(accessToken, selectedPageId),
          loadFacebookMessengerStatus(accessToken),
        ]);

        if (overviewResult.status === "fulfilled") setOverview(overviewResult.value);
        if (facebookResult.status === "fulfilled") {
          setFacebookStatus(facebookResult.value);
          onPagesChanged?.(facebookResult.value.pages);
        } else {
          const message =
            facebookResult.reason instanceof Error
              ? facebookResult.reason.message
              : "État Facebook Messenger indisponible.";
          setFacebookError((prev) => prev ?? message);
        }
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Erreur de chargement");
      } finally {
        setLoading(false);
      }
    },
    [onPagesChanged, resolveAccessToken, selectedPageId]
  );

  useEffect(() => {
    void loadData();
  }, [loadData, selectedPageId]);

  useEffect(() => {
    if (!selectedPageId && overview?.active_page?.page_id) {
      onSelectPage?.(overview.active_page.page_id);
    }
  }, [selectedPageId, overview, onSelectPage]);

  const canManagePages = facebookStatus?.can_manage_pages ?? false;

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
    } catch (connectError) {
      setFacebookError(connectError instanceof Error ? connectError.message : "Impossible de connecter Facebook.");
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
    } catch (activateError) {
      setFacebookError(activateError instanceof Error ? activateError.message : "Erreur activation");
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
    } catch (deactivateError) {
      setFacebookError(deactivateError instanceof Error ? deactivateError.message : "Erreur désactivation");
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
    } catch (removeError) {
      setFacebookError(removeError instanceof Error ? removeError.message : "Erreur suppression");
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
    } catch (syncError) {
      const message = syncError instanceof Error ? syncError.message : "";
      if (/expiré|Reconnectez|session|Facebook|actualiser/i.test(message)) {
        setFacebookError(`${message} Utilisez le bouton \"Ouvrir Meta\" pour renouveler l'autorisation.`);
      } else {
        setFacebookError(message || "Impossible d'actualiser la liste des pages.");
      }
    } finally {
      setFacebookSyncLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center py-20">
        <div className="flex items-center gap-3 text-white/40">
          <Loader2 size={18} className="animate-spin" />
          <span className="text-sm">Chargement des paramètres...</span>
        </div>
      </div>
    );
  }

  if (error) {
    const needsWorkspaceSelection = /organisation|espace|workspace/i.test(error);
    return (
      <div className="flex flex-1 items-center justify-center py-20">
        <div className="flex max-w-xl flex-col items-center gap-4 text-center">
          <p className="text-red-400">{error}</p>
          {needsWorkspaceSelection && onRequestOrganizationSelection ? (
            <button
              type="button"
              onClick={onRequestOrganizationSelection}
              className="rounded-lg border border-orange-500/30 bg-orange-500/10 px-4 py-2 text-sm font-medium text-orange-300 hover:bg-orange-500/20"
            >
              Choisir un espace de travail
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  const selectedPageName =
    facebookStatus?.pages.find((page) => page.page_id === selectedPageId)?.page_name ||
    overview?.active_page?.page_name;

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-8 px-4 py-6 md:px-8">
        <motion.header
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="space-y-2"
        >
          <h1 className="text-3xl font-bold tracking-tight text-white/90">
            Paramètres
            {selectedPageName ? (
              <span className="mt-1 block text-xl font-semibold text-cyan-400/95">— {selectedPageName}</span>
            ) : null}
          </h1>
          <p className="text-lg text-[var(--text-muted)]">Gérez votre connexion Facebook.</p>
        </motion.header>

        {facebookError ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200/90 shadow-sm"
          >
            {facebookError}
          </motion.div>
        ) : null}

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          className="pb-12"
        >
          {facebookStatus ? (
            <div className="pt-6">
              <PageSelector
                pages={facebookStatus.pages}
                selectedPageId={selectedPageId || null}
                onSelect={(pageId) => onSelectPage?.(pageId)}
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
          ) : null}
        </motion.div>
      </div>
    </div>
  );
}
