"use client";

import { useEffect, useState, useCallback } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { motion } from "framer-motion";

import PageSelector from "@/components/PageSelector";
import { getChatbotOverview, type ChatbotOverview } from "@/lib/api";
import {
  consumeFacebookMessengerAuthResult,
  loadFacebookMessengerStatus,
  activateFacebookMessengerPage,
  deactivateFacebookMessengerPage,
  resyncFacebookMessengerPages,
  runFacebookMessengerOAuth,
  type FacebookMessengerStatus,
} from "@/lib/facebookMessenger";

interface ChatbotParametresPageProps {
  token?: string | null;
  getFreshToken?: (forceRefresh?: boolean) => Promise<string | null>;
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
        setError("Session expiree. Veuillez recharger.");
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
              : "Etat Facebook Messenger indisponible.";
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

  useEffect(() => {
    const authResult = consumeFacebookMessengerAuthResult();
    if (!authResult || authResult.provider !== "facebook") {
      return;
    }

    if (authResult.status === "success") {
      setFacebookAuthLoading(true);
      setFacebookError(null);
      void (async () => {
        try {
          await loadData(true);
        } finally {
          setFacebookAuthLoading(false);
        }
      })();
      return;
    }

    setFacebookError(authResult.detail || "Impossible de connecter Facebook.");
  }, [loadData]);

  const canManagePages = facebookStatus?.can_manage_pages ?? false;

  const handleConnectFacebook = async () => {
    const accessToken = await resolveAccessToken(true);
    if (!accessToken) return;
    if (!canManagePages) {
      setFacebookError(
        facebookStatus?.facebook_access_message ||
          "Seuls le proprietaire ou un admin du compte peuvent connecter Facebook."
      );
      return;
    }

    setFacebookAuthLoading(true);
    setFacebookError(null);
    try {
      const flow = await runFacebookMessengerOAuth(accessToken);
      if (flow === "popup") {
        await loadData(true);
      }
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
      setFacebookError(deactivateError instanceof Error ? deactivateError.message : "Erreur desactivation");
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
      if (/expire|Reconnectez|session|Facebook|actualiser/i.test(message)) {
        setFacebookError(`${message} Utilisez le bouton "Ouvrir Meta" pour renouveler l'autorisation.`);
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
        <div className="flex items-center gap-3 text-[var(--text-primary)]">
          <Loader2 size={18} className="animate-spin" />
          <span className="text-sm">Chargement des parametres...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center py-20">
        <div className="flex max-w-xl flex-col items-center gap-4 text-center">
          <p className="text-[var(--text-primary)]">{error}</p>
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
          <h1 className="text-3xl font-bold tracking-tight text-[var(--text-primary)]">
            Parametres
            {selectedPageName ? (
              <span className="mt-1 block text-xl font-semibold text-[var(--text-primary)]">- {selectedPageName}</span>
            ) : null}
          </h1>
          <p className="text-lg text-[var(--text-muted)]">Gerez votre connexion Facebook.</p>
        </motion.header>

        {facebookError ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="rounded-xl border border-[var(--border-strong)] bg-[var(--surface-subtle)] px-4 py-3 text-sm text-[var(--text-primary)] shadow-sm"
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
                connectionSummary={{
                  oauthConfigured: facebookStatus.oauth_configured,
                  directServiceConfigured: facebookStatus.direct_service_configured,
                  permissionWarningCount: facebookStatus.permission_warning_count,
                  accessMessage: facebookStatus.facebook_access_message || null,
                }}
              />
            </div>
          ) : (
            <div className="mt-6 rounded-2xl border border-[var(--border-default)] bg-[var(--surface-base)] p-5 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
              <p className="text-sm font-semibold text-[var(--text-primary)]">Etat Facebook indisponible</p>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                Les controles ne peuvent pas etre affiches tant que FLARE ne recupere pas l&apos;etat de vos pages Facebook.
              </p>
              <button
                type="button"
                onClick={() => void loadData(true)}
                disabled={loading}
                className="mt-4 inline-flex items-center gap-2 rounded-xl border border-[var(--border-default)] bg-[var(--surface-subtle)] px-4 py-2 text-sm font-medium text-[var(--text-primary)] transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--surface-raised)] disabled:pointer-events-none disabled:opacity-50"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Reessayer
              </button>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
