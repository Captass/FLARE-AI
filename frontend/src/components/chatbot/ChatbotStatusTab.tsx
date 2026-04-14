"use client";

import { ArrowUpRight, Link2, Loader2, Sparkles, AlertCircle } from "lucide-react";
import { motion } from "framer-motion";

import type { ChatbotOverview, ChatbotPreferences } from "@/lib/api";
import type { FacebookMessengerPage, FacebookMessengerStatus } from "@/lib/facebookMessenger";
import FacebookVerificationBanner from "@/components/chatbot/FacebookVerificationBanner";
import { SectionCard } from "@/components/chatbot/ChatbotUi";
import { formatRelativeTime, type ChatbotWorkspaceTab } from "@/components/chatbot/chatbotWorkspaceUtils";
import { GlowRing } from "@/components/ui/GlowRing";

interface ChatbotStatusTabProps {
  overview: ChatbotOverview | null;
  status: FacebookMessengerStatus | null;
  loading: boolean;
  authLoading: boolean;
  busyPageId: string | null;
  error: string | null;
  canEdit: boolean;
  canManagePages: boolean;
  catalogueCount: number;
  onRefresh: () => void;
  onJumpToTab: (tab: ChatbotWorkspaceTab) => void;
  onConnect: () => void;
  onActivate: (pageId: string) => void;
  onDisconnect: (pageId: string) => void;
}

function hasValue(value?: string | null): boolean {
  return Boolean(String(value || "").trim());
}
function isIdentityReady(preferences: ChatbotPreferences | null | undefined): boolean {
  return Boolean(preferences && hasValue(preferences.bot_name) && hasValue(preferences.greeting_message) && hasValue(preferences.primary_role));
}
function isBusinessReady(preferences: ChatbotPreferences | null | undefined): boolean {
  return Boolean(preferences && hasValue(preferences.business_name) && hasValue(preferences.company_description));
}
function buildSetupGuide({
  overview,
  canEdit,
  catalogueCount,
}: {
  overview: ChatbotOverview | null;
  canEdit: boolean;
  catalogueCount: number;
}): {
  tone: "success" | "warning" | "error";
  eyebrow: string;
  title: string;
  body: string;
  bullets: string[];
  ctaLabel?: string;
  ctaTab?: ChatbotWorkspaceTab;
} {
  const activePage = overview?.active_page || null;
  const preferences = overview?.preferences || null;

  if (!canEdit) {
    return {
      tone: "warning",
      eyebrow: "Lecture seule",
      title: "Configuration réservée aux administrateurs",
      body: "Seuls les administrateurs de l’compte peuvent modifier la connexion Facebook.",
      bullets: [],
    };
  }
  if (!activePage) {
    return {
      tone: "warning",
      eyebrow: "Étape suivante",
      title: "Choisissez une page Facebook",
      body: "Sélectionnez une page dans la liste ci-dessus, puis activez-la pour Messenger.",
      bullets: [],
    };
  }
  if (activePage.last_error) {
    return {
      tone: "error",
      eyebrow: "À corriger",
      title: "La synchronisation a rencontré un problème",
      body: activePage.last_error,
      bullets: [],
    };
  }
  if (!isIdentityReady(preferences)) {
    return {
      tone: "warning",
      eyebrow: "Étape 1 / 3",
      title: "Définir l’identité du bot",
      body: "Donnez un nom, un rôle et un message d’accueil à votre assistant.",
      bullets: ["Nom du bot", "Rôle principal", "Message d’accueil"],
      ctaLabel: "Aller à l’identité",
      ctaTab: "identity",
    };
  }
  if (!isBusinessReady(preferences)) {
    return {
      tone: "warning",
      eyebrow: "Étape 2 / 3",
      title: "Présenter votre activité",
      body: "Ajoutez une description claire de votre entreprise pour des réponses pertinentes.",
      bullets: ["Description", "Secteur"],
      ctaLabel: "Aller à l’entreprise",
      ctaTab: "business",
    };
  }
  if (catalogueCount === 0) {
    return {
      tone: "warning",
      eyebrow: "Étape 3 / 3",
      title: "Ajouter au moins une offre au catalogue",
      body: "Le bot pourra présenter vos produits ou services aux visiteurs.",
      bullets: ["Au moins un produit ou service"],
      ctaLabel: "Aller au catalogue",
      ctaTab: "catalogue",
    };
  }
  if (!activePage.webhook_subscribed || !activePage.direct_service_synced) {
    return {
      tone: "warning",
      eyebrow: "Presque prêt",
      title: "Finalisation de la connexion",
      body: "Messenger est en cours de liaison avec votre page. Cela peut prendre une minute.",
      bullets: [],
    };
  }
  return {
    tone: "success",
    eyebrow: "Prêt",
    title: "Votre assistant est opérationnel sur Messenger",
    body: "Les messages reçus sur votre page peuvent être traités par le bot selon vos réglages.",
    bullets: ["Messagerie connectée", "Réponses automatiques possibles"],
    ctaLabel: "Script de vente",
    ctaTab: "sales",
  };
}

function PremiumMetric({
  label,
  value,
  ok,
  glowStatus,
}: {
  label: string;
  value: string;
  ok: boolean;
  glowStatus: "active" | "inactive" | "error" | "pending";
}) {
  return (
    <div className="relative flex flex-col gap-2 overflow-hidden rounded-xl border border-[var(--border-default)] bg-[var(--surface-base)] p-4 transition-colors hover:bg-[var(--surface-raised)] group">
      <div className="absolute top-0 right-0 p-4 opacity-30 group-hover:opacity-100 transition-opacity">
        <GlowRing status={glowStatus} size={10} />
      </div>
      <span className="text-[10px] font-medium uppercase tracking-widest text-[var(--text-muted)]">{label}</span>
      <span className={`text-[15px] font-semibold tracking-wide ${ok ? "text-[var(--text-primary)]" : "text-[var(--accent-orange)]"}`}>{value}</span>
    </div>
  );
}

export default function ChatbotStatusTab({
  overview,
  status: _status,
  loading,
  authLoading,
  busyPageId,
  error,
  canEdit,
  canManagePages,
  catalogueCount,
  onRefresh,
  onJumpToTab,
  onConnect,
  onActivate,
  onDisconnect,
}: ChatbotStatusTabProps) {
  const activePage = overview?.active_page || null;
  const guide = buildSetupGuide({ overview, canEdit, catalogueCount });

  return (
    <SectionCard
      title="État de la connexion"
      description="Suivez les étapes pour que votre bot réponde sur la page Facebook choisie."
      action={
        <button
          type="button"
          onClick={onRefresh}
          className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
        >
          Actualiser <ArrowUpRight className="w-3.5 h-3.5" />
        </button>
      }
    >
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4 mb-6">
        <PremiumMetric
          label="Page dans FLARE"
          value={activePage?.page_name || "—"}
          ok={Boolean(activePage)}
          glowStatus={activePage ? "active" : "inactive"}
        />
        <PremiumMetric
          label="Profil du bot"
          value={overview?.has_business_profile ? "Renseigné" : "À compléter"}
          ok={Boolean(overview?.has_business_profile)}
          glowStatus={overview?.has_business_profile ? "active" : "pending"}
        />
        <PremiumMetric
          label="Réception Messenger"
          value={activePage?.webhook_subscribed ? "Active" : "En attente"}
          ok={Boolean(activePage?.webhook_subscribed)}
          glowStatus={activePage?.webhook_subscribed ? "active" : "error"}
        />
        <PremiumMetric
          label="Dernière mise à jour"
          value={formatRelativeTime(activePage?.last_synced_at) || "—"}
          ok={Boolean(activePage?.direct_service_synced)}
          glowStatus={activePage?.direct_service_synced ? "active" : "inactive"}
        />
      </div>

      {error && (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-red-500/35 bg-red-500/10 p-4 text-sm text-red-700 dark:text-red-300">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <p>{error}</p>
        </div>
      )}

      <motion.div
        className={`relative overflow-hidden p-6 rounded-2xl border ${
          guide.tone === "success"
            ? "border-[color:color-mix(in_srgb,var(--accent-navy)_28%,transparent)] bg-[color:color-mix(in_srgb,var(--accent-navy)_9%,var(--surface-base))]"
            : guide.tone === "error"
              ? "border-red-500/20 bg-red-500/5"
              : "border-[color:color-mix(in_srgb,var(--accent-orange)_28%,transparent)] bg-[color:color-mix(in_srgb,var(--accent-orange)_9%,var(--surface-base))]"
        }`}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className={`w-4 h-4 ${guide.tone === "success" ? "text-[var(--accent-navy)]" : "text-[var(--accent-orange)]"}`} />
              <span
                className={`text-[10px] font-bold uppercase tracking-widest ${
                  guide.tone === "success" ? "text-[var(--accent-navy)]" : "text-[var(--accent-orange)]"
                }`}
              >
                {guide.eyebrow}
              </span>
            </div>
            <h3 className="text-lg font-semibold text-[var(--text-primary)]">{guide.title}</h3>
            <p className="mt-1 max-w-xl text-sm text-[var(--text-secondary)]">{guide.body}</p>
            {guide.bullets.length > 0 && (
              <ul className="mt-3 list-inside list-disc space-y-1 text-sm text-[var(--text-secondary)]">
                {guide.bullets.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            )}
          </div>
          {guide.ctaLabel && guide.ctaTab && (
            <button
              type="button"
              onClick={() => onJumpToTab(guide.ctaTab!)}
              className="flex items-center gap-2 whitespace-nowrap rounded-xl bg-[var(--accent-orange)] px-5 py-2.5 text-xs font-semibold uppercase tracking-widest text-[#140b02] transition-all hover:brightness-95"
            >
              {guide.ctaLabel}
              <ArrowUpRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </motion.div>

      <div className="mt-6 rounded-2xl border border-[var(--border-default)] bg-[var(--surface-base)] p-6">
        <h4 className="mb-3 text-xs font-semibold uppercase tracking-widest text-[var(--text-muted)]">Compte Facebook</h4>
        <p className="mb-5 max-w-2xl text-sm leading-relaxed text-[var(--text-secondary)]">
          Connectez le compte Meta qui gère vos pages. Vous pourrez ensuite choisir la page et l’activer pour Messenger.
          Si vous avez déjà connecté un compte, utilisez « Ajouter / resynchroniser » sur l’accueil du chatbot pour mettre
          à jour la liste des pages.
        </p>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={onConnect}
            disabled={authLoading || !canManagePages}
            className="flex items-center gap-2 rounded-xl border border-[color:color-mix(in_srgb,var(--accent-navy)_28%,transparent)] bg-[color:color-mix(in_srgb,var(--accent-navy)_10%,var(--surface-subtle))] px-5 py-2.5 text-xs font-semibold uppercase tracking-wider text-[var(--accent-navy)] transition-all hover:bg-[color:color-mix(in_srgb,var(--accent-navy)_16%,var(--surface-subtle))] disabled:opacity-50"
          >
            {authLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
            {activePage ? "Reconnecter Facebook" : "Connecter Facebook"}
          </button>
          {activePage && canManagePages && !activePage.is_active && (
            <button
              type="button"
              onClick={() => onActivate(activePage.page_id)}
              disabled={busyPageId === activePage.page_id}
              className="flex items-center gap-2 rounded-xl bg-[var(--accent-orange)] px-5 py-2.5 text-xs font-semibold uppercase tracking-wider text-[#140b02] transition-all hover:brightness-95 disabled:opacity-50"
            >
              {busyPageId === activePage.page_id ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : null}
              Activer cette page sur Messenger
            </button>
          )}
          {activePage && canManagePages && activePage.is_active && (
            <button
              type="button"
              onClick={() => onDisconnect(activePage.page_id)}
              disabled={busyPageId === activePage.page_id}
              className="rounded-xl border border-red-500/35 bg-red-500/10 px-5 py-2.5 text-xs font-semibold uppercase tracking-wider text-red-700 transition-all hover:bg-red-500/15 disabled:opacity-50 dark:text-red-300"
            >
              {busyPageId === activePage.page_id ? "Déconnexion…" : "Retirer la page"}
            </button>
          )}
        </div>
      </div>

      {activePage ? (
        <FacebookVerificationBanner
          page={activePage as unknown as FacebookMessengerPage}
          loading={loading}
          onRefresh={onRefresh}
          className="mt-4"
        />
      ) : null}
    </SectionCard>
  );
}
