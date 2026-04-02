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
        <p className="text-[11px] uppercase tracking-[0.14em] text-emerald-100/75">Verification Facebook</p>
        <p className="mt-2 text-[15px] text-white">
          <span className="font-semibold">{page.page_name}</span> est active et la connexion Messenger est en place.
        </p>
        <p className="mt-2 text-[13px] leading-6 text-emerald-50/80">
          Derniere verification: {formatRelativeTime(page.last_synced_at)}.
        </p>
      </div>
    );
  }

  return (
    <div className={`rounded-2xl border border-orange-400/25 bg-orange-500/10 px-4 py-4${wrapperClassName}`}>
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="max-w-[42rem]">
          <p className="text-[11px] uppercase tracking-[0.14em] text-orange-100/80">Propagation Meta a verifier</p>
          <p className="mt-2 text-[15px] text-white">
            <span className="font-semibold">{page.page_name}</span> est active, mais la connexion Messenger n&apos;est
            pas encore completement confirmee.
          </p>
          <p className="mt-2 text-[13px] leading-6 text-orange-50/85">
            Derniere verification: {formatRelativeTime(page.last_synced_at)}. Utilisez le rafraichissement manuel si
            Meta ou le service direct finit de propager avec retard.
          </p>
          <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-orange-50/90">
            <span className="rounded-full border border-orange-300/20 bg-black/20 px-3 py-1.5">
              Webhook: {page.webhook_subscribed ? "ok" : "a verifier"}
            </span>
            <span className="rounded-full border border-orange-300/20 bg-black/20 px-3 py-1.5">
              Service direct: {page.direct_service_synced ? "ok" : "a synchroniser"}
            </span>
          </div>
        </div>
        {onRefresh ? (
          <button
            onClick={onRefresh}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 self-start rounded-full border border-orange-300/20 bg-white/[0.06] px-4 py-2.5 text-[12px] font-semibold uppercase tracking-[0.12em] text-white transition-all hover:bg-white/[0.1] disabled:opacity-50"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Link2 size={14} />}
            Rafraichir l&apos;etat Facebook
          </button>
        ) : null}
      </div>
    </div>
  );
}
