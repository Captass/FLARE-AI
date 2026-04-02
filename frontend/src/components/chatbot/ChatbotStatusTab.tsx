"use client";

import { ArrowUpRight, BadgeCheck, Link2, Loader2, Sparkles, AlertCircle } from "lucide-react";
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

// GUIDES EXPERTS PRE-EXISTANTS (conservés tels quels)
function hasValue(value?: string | null): boolean { return Boolean(String(value || "").trim()); }
function isIdentityReady(preferences: ChatbotPreferences | null | undefined): boolean {
  return Boolean(preferences && hasValue(preferences.bot_name) && hasValue(preferences.greeting_message) && hasValue(preferences.primary_role));
}
function isBusinessReady(preferences: ChatbotPreferences | null | undefined): boolean {
  return Boolean(preferences && hasValue(preferences.business_name) && hasValue(preferences.company_description));
}
function buildSetupGuide({ overview, canEdit, catalogueCount }: any): any {
  const activePage = overview?.active_page || null;
  const preferences = overview?.preferences || null;

  if (!canEdit) return { tone: "warning", eyebrow: "Suivi équipe", title: "Configuration verrouillée", body: "Seuls les admins peuvent configurer.", bullets: [] };
  if (!activePage) return { tone: "warning", eyebrow: "Action requise", title: "Aucune page active sélectionnée.", body: "Veuillez activer une page Facebook via le sélecteur ci-dessus ou en connectant le compte Meta.", bullets: [] };
  if (activePage.last_error) return { tone: "error", eyebrow: "Erreur persistante", title: "Un problème de synchronisation a été détecté.", body: activePage.last_error, bullets: [] };
  if (!isIdentityReady(preferences)) return { tone: "warning", eyebrow: "Setup 1/3", title: "Définir l'identité du bot", body: "Donnez-lui un nom, un rôle et un message d'accueil.", bullets: ["Nom du bot", "Rôle principal"], ctaLabel: "Aller à l'Identité", ctaTab: "identity" };
  if (!isBusinessReady(preferences)) return { tone: "warning", eyebrow: "Setup 2/3", title: "Ajouter le contexte entreprise", body: "Expliquez ce que fait votre entreprise.", bullets: ["Description", "Secteur"], ctaLabel: "Aller à l'Entreprise", ctaTab: "business" };
  if (catalogueCount === 0) return { tone: "warning", eyebrow: "Setup 3/3", title: "Créer le catalogue", body: "Offrez des produits/services pour qualifier les leads.", bullets: ["Au moins un produit"], ctaLabel: "Aller au Catalogue", ctaTab: "catalogue" };
  if (!activePage.webhook_subscribed || !activePage.direct_service_synced) return { tone: "warning", eyebrow: "Synchronisation", title: "Mise en service en cours...", body: "Votre bot déploie actuellement ces configurations vers Messenger.", bullets: [] };
  
  return { tone: "success", eyebrow: "En Ligne", title: "Le système est opérationnel.", body: "Le chatbot intercepte les messages Messenger.", bullets: ["Webhook actif", "Modèles chargés"], ctaLabel: "Script conversationnel", ctaTab: "sales" };
}

// MICRO-COMPOSANTS GLASSMORPHIC
function PremiumMetric({ label, value, ok, glowStatus }: { label: string; value: string; ok: boolean; glowStatus: "active" | "inactive" | "error" | "pending" }) {
  return (
    <div className="flex flex-col gap-2 p-4 rounded-xl border border-fg/[0.06] bg-gradient-to-br from-fg/[0.02] to-transparent hover:bg-fg/[0.04] transition-colors relative overflow-hidden group">
      <div className="absolute top-0 right-0 p-4 opacity-30 group-hover:opacity-100 transition-opacity">
        <GlowRing status={glowStatus} size={10} />
      </div>
      <span className="text-[10px] text-fg/40 uppercase tracking-widest font-medium">{label}</span>
      <span className={`text-[15px] font-semibold tracking-wide ${ok ? 'text-fg/90' : 'text-orange-400'}`}>{value}</span>
    </div>
  );
}

export default function ChatbotStatusTab({
  overview, status, loading, authLoading, busyPageId, error,
  canEdit, canManagePages, catalogueCount, onRefresh, onJumpToTab, onConnect, onActivate, onDisconnect
}: ChatbotStatusTabProps) {
  const activePage = overview?.active_page || null;
  const guide = buildSetupGuide({ overview, canEdit, catalogueCount });

  return (
    <SectionCard
      title="Architecture d'Intégration"
      description="Supervisez le déploiement du chatbot vers l'écosystème Meta."
      action={
        <button onClick={onRefresh} className="flex items-center gap-2 text-xs text-fg/50 hover:text-fg font-medium tracking-wide uppercase transition-colors">
          Actualiser <ArrowUpRight className="w-3.5 h-3.5" />
        </button>
      }
    >
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4 mb-6">
        <PremiumMetric 
          label="Sélecteur Actif" 
          value={activePage?.page_name || "En attente"} 
          ok={Boolean(activePage)}
          glowStatus={activePage ? "active" : "inactive"} 
        />
        <PremiumMetric 
          label="Mécanisme IA" 
          value={activePage && overview?.has_business_profile ? "Initialisé" : "Non configuré"} 
          ok={Boolean(overview?.has_business_profile)}
          glowStatus={overview?.has_business_profile ? "active" : "pending"} 
        />
        <PremiumMetric 
          label="Webhook Meta" 
          value={activePage?.webhook_subscribed ? "Branché" : "Hors ligne"} 
          ok={Boolean(activePage?.webhook_subscribed)}
          glowStatus={activePage?.webhook_subscribed ? "active" : "error"} 
        />
        <PremiumMetric 
          label="Latence Synchro" 
          value={formatRelativeTime(activePage?.last_synced_at) || "Aucune"} 
          ok={Boolean(activePage?.direct_service_synced)}
          glowStatus={activePage?.direct_service_synced ? "active" : "inactive"} 
        />
      </div>

      {error && (
        <div className="p-4 mb-6 rounded-xl border border-red-500/20 bg-red-500/10 text-red-200 text-sm flex items-start gap-3">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <p>{error}</p>
        </div>
      )}

      {/* Guide dynamique épuré */}
      <motion.div 
        className={`relative overflow-hidden p-6 rounded-2xl border ${
          guide.tone === 'success' ? 'border-emerald-500/20 bg-emerald-500/5' :
          guide.tone === 'error' ? 'border-red-500/20 bg-red-500/5' : 'border-orange-500/20 bg-orange-500/5'
        }`}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className={`w-4 h-4 ${guide.tone === 'success' ? 'text-emerald-400' : 'text-orange-400'}`} />
              <span className={`text-[10px] font-bold uppercase tracking-widest ${guide.tone === 'success' ? 'text-emerald-500/80' : 'text-orange-500/80'}`}>
                {guide.eyebrow}
              </span>
            </div>
            <h3 className="text-lg font-semibold text-fg/90">{guide.title}</h3>
            <p className="text-sm text-fg/60 mt-1 max-w-xl">{guide.body}</p>
          </div>
          {guide.ctaLabel && guide.ctaTab && (
            <button
              onClick={() => onJumpToTab(guide.ctaTab!)}
              className="px-5 py-2.5 whitespace-nowrap bg-fg/10 hover:bg-fg/15 text-fg text-xs font-semibold uppercase tracking-widest rounded-xl transition-all flex items-center gap-2"
            >
              {guide.ctaLabel}
              <ArrowUpRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </motion.div>

      {/* Panneau technique Meta */}
      <div className="mt-6 p-6 rounded-2xl bg-[var(--bg-background)] border border-fg/[0.04] grid md:grid-cols-2 gap-8">
        <div>
          <h4 className="text-xs uppercase tracking-widest text-fg/40 mb-4 font-semibold">Contrôle Meta OAuth</h4>
          <p className="text-sm text-fg/60 mb-6 leading-relaxed">
            Gérez la liaison sécurisée entre FLARE AI et votre écosystème Meta. Assurez-vous d'accorder les droits complets `MESSAGING` lors de la fenêtre de consentement.
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={onConnect}
              disabled={authLoading || !canManagePages}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-b from-[#1877F2]/20 to-[#1877F2]/10 border border-[#1877F2]/30 text-[#1877F2] font-semibold text-xs tracking-wider uppercase hover:shadow-[0_0_20px_rgba(24,119,242,0.15)] transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {authLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
              {activePage ? "Renouveler Token" : "Lancer Meta OAuth"}
            </button>
            {activePage && canManagePages && !activePage.is_active && (
              <button
                onClick={() => onActivate(activePage.page_id)}
                disabled={busyPageId === activePage.page_id}
                className="px-5 py-2.5 rounded-xl border border-emerald-500/30 text-emerald-500 font-semibold text-xs tracking-wider uppercase hover:bg-emerald-500/10 transition-all flex items-center gap-2"
              >
                {busyPageId === activePage.page_id ? <Loader2 className="w-4 h-4 animate-spin" /> : <BadgeCheck className="w-4 h-4" />}
                Activer ce canal
              </button>
            )}
            {activePage && canManagePages && activePage.is_active && (
              <button
                onClick={() => onDisconnect(activePage.page_id)}
                disabled={busyPageId === activePage.page_id}
                className="px-5 py-2.5 rounded-xl border border-red-500/20 text-red-400 font-semibold text-xs tracking-wider uppercase hover:bg-red-500/10 transition-all"
              >
                {busyPageId === activePage.page_id ? "Désactivation..." : "Désactiver canal"}
              </button>
            )}
          </div>
        </div>
        
        <div className="bg-white/[0.01] rounded-xl border border-fg/[0.04] p-4 font-mono text-[11px] text-fg/40 break-all h-full">
            <div className="uppercase tracking-widest text-fg/30 mb-2">// Diagnostic de routage</div>
            Webhook Callback URI:<br />
            <span className="text-emerald-500/70">{status?.callback_url || "NON DIFFUSÉ"}</span>
            <br /><br />
            ID Canal Séléctionné:<br />
            <span className="text-orange-500/70">{activePage?.page_id || "AUCUN"}</span>
        </div>
      </div>
      
      {activePage ? <FacebookVerificationBanner page={activePage as any} loading={loading} onRefresh={onRefresh} className="mt-4" /> : null}

    </SectionCard>
  );
}
