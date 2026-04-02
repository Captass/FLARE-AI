"use client";

import { Link2, Loader2 } from "lucide-react";

import { formatRelativeTime } from "@/components/chatbot/chatbotWorkspaceUtils";
import type { FacebookMessengerPage } from "@/lib/facebookMessenger";

interface FacebookVerificationBannerProps {
  page: FacebookMessengerPage;
  loading: boolean;
  onRefresh?: () => void;
  className?: string;
}

export default function FacebookVerificationBanner({
  page,
  loading,
  onRefresh,
  className = "",
}: FacebookVerificationBannerProps) {
  const needsVerification = !page.webhook_subscribed || !page.direct_service_synced;
  const wrapperClassName = className ? ` ${className}` : "";

  if (!needsVerification) {
    return (
      <div
        className={`rounded-2xl border border-emerald-400/25 bg-emerald-500/10 px-4 py-4${wrapperClassName}`}
      >
        <p className="text-sm font-semibold uppercase tracking-[0.12em] text-emerald-100/80">Vérification Facebook</p>
        <p className="mt-2 text-base text-white">
          <span className="font-semibold">{page.page_name}</span> est active et la connexion Messenger est en place.
        </p>
        <p className="mt-2 text-sm leading-relaxed text-emerald-50/85">
          Dernière vérification : {formatRelativeTime(page.last_synced_at)}.
        </p>
      </div>
    );
  }

  return (
    <div className={`rounded-2xl border border-orange-400/25 bg-orange-500/10 px-4 py-4${wrapperClassName}`}>
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="max-w-[42rem]">
          <p className="text-sm font-semibold uppercase tracking-[0.12em] text-orange-100/85">Propagation Meta à vérifier</p>
          <p className="mt-2 text-base text-white">
            <span className="font-semibold">{page.page_name}</span> est active, mais la connexion Messenger n&apos;est
            pas encore complètement confirmée.
          </p>
          <p className="mt-2 text-sm leading-relaxed text-orange-50/90">
            Dernière vérification : {formatRelativeTime(page.last_synced_at)}. Vous pouvez rafraîchir l’état ci-dessous
            si vous venez de modifier quelque chose sur Facebook.
          </p>
          <div className="mt-3 flex flex-wrap gap-2 text-sm text-orange-50/95">
            <span className="rounded-full border border-orange-300/20 bg-black/20 px-3 py-1.5">
              Messagerie : {page.webhook_subscribed ? "prête" : "en cours"}
            </span>
            <span className="rounded-full border border-orange-300/20 bg-black/20 px-3 py-1.5">
              Synchronisation : {page.direct_service_synced ? "terminée" : "en cours"}
            </span>
          </div>
        </div>
        {onRefresh ? (
          <button
            onClick={onRefresh}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 self-start rounded-full border border-orange-300/20 bg-white/[0.06] px-4 py-2.5 text-sm font-semibold uppercase tracking-[0.1em] text-white transition-all hover:bg-white/[0.1] disabled:opacity-50"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Link2 size={14} />}
            Rafraichir l&apos;etat Facebook
          </button>
        ) : null}
      </div>
    </div>
  );
}
