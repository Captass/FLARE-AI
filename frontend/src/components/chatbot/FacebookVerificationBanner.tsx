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
        className={`rounded-2xl border border-[color:color-mix(in_srgb,var(--accent-navy)_30%,transparent)] bg-[color:color-mix(in_srgb,var(--accent-navy)_9%,var(--surface-subtle))] px-4 py-4${wrapperClassName}`}
      >
        <p className="text-sm font-semibold uppercase tracking-[0.12em] text-[var(--accent-navy)]">Verification Facebook</p>
        <p className="mt-2 text-base text-[var(--text-primary)]">
          <span className="font-semibold">{page.page_name}</span> est active et la connexion Messenger est en place.
        </p>
        <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">
          Derniere verification : {formatRelativeTime(page.last_synced_at)}.
        </p>
      </div>
    );
  }

  return (
    <div className={`rounded-2xl border border-[color:color-mix(in_srgb,var(--accent-orange)_28%,transparent)] bg-[color:color-mix(in_srgb,var(--accent-orange)_10%,var(--surface-subtle))] px-4 py-4${wrapperClassName}`}>
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="max-w-[42rem]">
          <p className="text-sm font-semibold uppercase tracking-[0.12em] text-[var(--accent-orange)]">Propagation Meta a verifier</p>
          <p className="mt-2 text-base text-[var(--text-primary)]">
            <span className="font-semibold">{page.page_name}</span> est active, mais la connexion Messenger n&apos;est
            pas encore completement confirmee.
          </p>
          <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">
            Derniere verification : {formatRelativeTime(page.last_synced_at)}. Vous pouvez rafraichir l&apos;etat ci-dessous
            si vous venez de modifier quelque chose sur Facebook.
          </p>
          <div className="mt-3 flex flex-wrap gap-2 text-sm text-[var(--text-primary)]">
            <span className="rounded-full border border-[var(--border-default)] bg-[var(--surface-raised)] px-3 py-1.5">
              Messagerie : {page.webhook_subscribed ? "prete" : "en cours"}
            </span>
            <span className="rounded-full border border-[var(--border-default)] bg-[var(--surface-raised)] px-3 py-1.5">
              Synchronisation : {page.direct_service_synced ? "terminee" : "en cours"}
            </span>
          </div>
        </div>
        {onRefresh ? (
          <button
            onClick={onRefresh}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 self-start rounded-full border border-[var(--border-default)] bg-[var(--surface-base)] px-4 py-2.5 text-sm font-semibold uppercase tracking-[0.1em] text-[var(--text-primary)] transition-all hover:bg-[var(--surface-raised)] disabled:opacity-50"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Link2 size={14} />}
            Rafraichir l&apos;etat Facebook
          </button>
        ) : null}
      </div>
    </div>
  );
}
