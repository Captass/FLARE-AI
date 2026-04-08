"use client";

import { useState, useEffect } from "react";
import { X, Settings2, Save, RotateCcw, Info, Sparkles, Monitor, Moon, Sun, Smartphone, Check, Crown, Zap, TrendingUp, BookOpen, Loader2, Brain, FileText, Lightbulb, Layers, Bot } from "lucide-react";
import { WorkspaceIdentity, getUserPreferences, updateUserPreferences, resetUserPreferences, getUserPlan, UserPlan, createCustomerPortalSession } from "@/lib/api";
import {
  DEFAULT_CHATBOT_PREFERENCES,
  type ChatbotPreferences,
  getChatbotPreferences,
  updateChatbotPreferences,
} from "@/lib/api";
import { type ActivationPlanId } from "@/lib/activationFlow";
import KnowledgePanel from "./KnowledgePanel";
import ChatbotPreferencesForm from "./ChatbotPreferencesForm";
import IdentitySettingsSection from "./IdentitySettingsSection";
import FlareMark from "./FlareMark";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  token?: string | null;
  theme?: "dark" | "light";
  onStartTour?: () => void;
  workspaceIdentity?: WorkspaceIdentity | null;
  userEmail?: string | null;
  fallbackDisplayName?: string;
  fallbackPhotoUrl?: string | null;
  hasSharedOrganizations?: boolean;
  onOpenOrganizationAccess?: () => void;
  onIdentitySaved?: (next: WorkspaceIdentity) => void;
  onOpenActivationFlow?: (planId: ActivationPlanId) => void;
}

const LEGACY_PROFILE_MARKERS = ["Profil :", "?? Profil :"];
const LEGACY_TONE_MARKERS = ["Ton :", "?? Ton :"];
const LEGACY_FORMAT_MARKERS = ["Format :", "?? Format :"];
const LEGACY_OTHER_MARKERS = ["Autre :", "?? Autre :"];

const findMarker = (text: string, markers: string[]) => markers.find((marker) => text.includes(marker)) || null;

const parsePreferences = (text: string) => {
  const result = { profile: "", tone: "", format: "", other: "" };
  if (!text) return result;

  const profileMarker = findMarker(text, LEGACY_PROFILE_MARKERS);
  const toneMarker = findMarker(text, LEGACY_TONE_MARKERS);
  const formatMarker = findMarker(text, LEGACY_FORMAT_MARKERS);
  const otherMarker = findMarker(text, LEGACY_OTHER_MARKERS);

  const extractSection = (marker: string | null, nextMarkers: string[]) => {
    if (!marker || !text.includes(marker)) return null;
    const startIndex = text.indexOf(marker) + marker.length;
    let endIndex = text.length;
    for (const next of nextMarkers) {
      const idx = text.indexOf(next, startIndex);
      if (idx !== -1 && idx < endIndex) {
        endIndex = idx;
      }
    }
    return text.substring(startIndex, endIndex).trim();
  };

  const detectedMarkers = [profileMarker, toneMarker, formatMarker, otherMarker].filter(Boolean) as string[];
  if (detectedMarkers.length === 0) {
    result.other = text;
    return result;
  }

  const profile = extractSection(profileMarker, detectedMarkers.filter((marker) => marker !== profileMarker));
  const tone = extractSection(toneMarker, detectedMarkers.filter((marker) => marker !== toneMarker));
  const format = extractSection(formatMarker, detectedMarkers.filter((marker) => marker !== formatMarker));
  const other = extractSection(otherMarker, detectedMarkers.filter((marker) => marker !== otherMarker));

  if (profile) result.profile = profile;
  if (tone) result.tone = tone;
  if (format) result.format = format;
  if (other) result.other = other;

  return result;
};

const formatPreferences = (prefs: { profile: string, tone: string, format: string, other: string }) => {
  let result = "";
  if (prefs.profile) result += `Profil :
${prefs.profile}

`;
  if (prefs.tone) result += `Ton :
${prefs.tone}

`;
  if (prefs.format) result += `Format :
${prefs.format}

`;
  if (prefs.other) result += `Autre :
${prefs.other}

`;
  return result.trim();
};

export default function SettingsModal({
  isOpen,
  onClose,
  token,
  theme = "light",
  onStartTour,
  workspaceIdentity,
  userEmail,
  fallbackDisplayName,
  fallbackPhotoUrl,
  hasSharedOrganizations = false,
  onOpenOrganizationAccess,
  onIdentitySaved,
  onOpenActivationFlow,
}: SettingsModalProps) {
  const [userPreferences, setUserPreferences] = useState("");
  const [prefMode, setPrefMode] = useState<"guided" | "raw">("guided");
  const [guidedPrefs, setGuidedPrefs] = useState({ profile: "", tone: "", format: "", other: "" });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [viewMode, setViewMode] = useState<"pc" | "mobile">("pc");
  const [activeSection, setActiveSection] = useState<"identity" | "interface" | "agent" | "chatbot" | "plan" | "about">("identity");
  const [confirmDialog, setConfirmDialog] = useState<{ message: string; onConfirm: () => void } | null>(null);
  const [userPlan, setUserPlan] = useState<UserPlan | null>(null);
  const [planLoading, setPlanLoading] = useState(false);
  const [viewingFullGuide, setViewingFullGuide] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [billingFeedback, setBillingFeedback] = useState<string | null>(null);
  const [chatbotPreferences, setChatbotPreferences] = useState<ChatbotPreferences>(DEFAULT_CHATBOT_PREFERENCES);
  const [chatbotLoading, setChatbotLoading] = useState(false);
  const [chatbotSaving, setChatbotSaving] = useState(false);
  const [chatbotSaved, setChatbotSaved] = useState(false);
  const [chatbotError, setChatbotError] = useState<string | null>(null);

  const handleCheckout = async (planId: ActivationPlanId) => {
    setBillingFeedback(null);
    onClose();
    onOpenActivationFlow?.(planId);
  };

  const handlePortalSession = async () => {
    setPortalLoading(true);
    setBillingFeedback(null);
    try {
      const session = await createCustomerPortalSession(token);
      if (session.url) {
        window.location.href = session.url;
      } else {
        throw new Error("URL du portail non reçue.");
      }
    } catch (error) {
      console.error("Erreur portail client Stripe:", error);
      setBillingFeedback("Une erreur est survenue lors de l'accès à votre portail de facturation. Veuillez réessayer.");
    } finally {
      setPortalLoading(false);
    }
  };

  useEffect(() => {
    const savedView = localStorage.getItem("flare-view") as "pc" | "mobile";
    if (savedView) setViewMode(savedView);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      setSaved(false);
      setChatbotSaved(false);
      getUserPreferences(token)
        .then((prefs) => {
          setUserPreferences(prefs);
          setGuidedPrefs(parsePreferences(prefs)); // Parse on load
        })
        .catch((err) => console.error("Erreur chargement préférences:", err))
        .finally(() => setLoading(false));
      // Charger le plan de l'utilisateur
      setPlanLoading(true);
      getUserPlan(token)
        .then((plan) => setUserPlan(plan))
        .catch(() => setUserPlan(null))
        .finally(() => setPlanLoading(false));

      if (workspaceIdentity?.current_branding.scope_type === "organization") {
        setChatbotLoading(true);
        setChatbotError(null);
        getChatbotPreferences(token)
          .then((prefs) => setChatbotPreferences(prefs))
          .catch((err) => {
            console.error("Erreur chargement preferences chatbot:", err);
            setChatbotPreferences(DEFAULT_CHATBOT_PREFERENCES);
            setChatbotError(err instanceof Error ? err.message : "Impossible de charger les preferences du chatbot.");
          })
          .finally(() => setChatbotLoading(false));
      } else {
        setChatbotPreferences(DEFAULT_CHATBOT_PREFERENCES);
        setChatbotError(null);
      }
    }
  }, [isOpen, token, workspaceIdentity?.current_branding.scope_type]);

  // Sync guided inputs to the master userPreferences string
  useEffect(() => {
    if (prefMode === 'guided') {
      setUserPreferences(formatPreferences(guidedPrefs));
    }
  }, [guidedPrefs, prefMode]);

  // Sync modes when switching
  useEffect(() => {
    if (prefMode === 'guided') {
      setGuidedPrefs(parsePreferences(userPreferences));
    } 
    // No need for an else, as the other useEffect handles guided -> raw sync
  }, [prefMode, userPreferences]);

  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e: KeyboardEvent) => { if (e.key === "Escape") { setConfirmDialog(null); onClose(); } };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [isOpen, onClose]);

  const isOrganizationScope = workspaceIdentity?.current_branding.scope_type === "organization";
  const canEditChatbot = Boolean(workspaceIdentity?.can_edit_organization);

  if (!isOpen) return null;

  const toggleViewMode = () => {
    const newView = viewMode === "pc" ? "mobile" : "pc";
    setViewMode(newView);
    localStorage.setItem("flare-view", newView);
    if (newView === "mobile") document.body.classList.add("mobile-mode");
    else document.body.classList.remove("mobile-mode");
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateUserPreferences(userPreferences, token);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      console.error("Erreur sauvegarde préférences:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveChatbot = async () => {
    if (!token || !isOrganizationScope) return;
    setChatbotSaving(true);
    setChatbotError(null);
    try {
      const next = await updateChatbotPreferences(chatbotPreferences, token);
      setChatbotPreferences(next);
      setChatbotSaved(true);
      setTimeout(() => setChatbotSaved(false), 2500);
    } catch (err) {
      console.error("Erreur sauvegarde chatbot:", err);
      setChatbotError(err instanceof Error ? err.message : "Impossible d'enregistrer les preferences du chatbot.");
    } finally {
      setChatbotSaving(false);
    }
  };

  const sections = [
    { id: "identity" as const, label: "Identité", icon: <Layers size={16} /> },
    { id: "interface" as const, label: "Interface", icon: <Monitor size={16} /> },
    { id: "agent" as const, label: "Agent IA", icon: <Sparkles size={16} /> },
    { id: "chatbot" as const, label: "Chatbot", icon: <Bot size={16} /> },
    { id: "plan" as const, label: "Mon Abonnement", icon: <Crown size={16} /> },
    { id: "about" as const, label: "À propos", icon: <Info size={16} /> },
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 h-full w-full">
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-2xl animate-fade-in" 
        onClick={onClose}
      />
      
      <div className="relative w-full max-w-4xl h-[85vh] bg-[var(--bg-modal)] border border-[var(--border-glass)] rounded-[32px] overflow-hidden shadow-[var(--shadow-card)] flex flex-col animate-scale-in backdrop-blur-3xl">
        
        {/* Header */}
        <div className="flex items-center justify-between px-8 py-6 border-b border-[var(--border-glass)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-orange-500/20 to-orange-600/10 border border-orange-500/20 flex items-center justify-center">
              <Settings2 className="text-orange-400" size={20} />
            </div>
            <div>
              <h2 className="text-[24px] font-bold text-[var(--text-primary)] tracking-tighter font-[family-name:var(--font-outfit)]">Paramètres IA</h2>
              <p className="text-[13px] text-[var(--text-muted)] font-light mt-0.5 tracking-tight">Configuration et personnalisation de l&apos;environnement</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2.5 rounded-full bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all hover:bg-[var(--bg-card)]"
          >
            <X size={20} />
          </button>
        </div>

        {/* Section Tabs */}
        <div className="flex gap-1 px-4 md:px-8 py-3 border-b border-[var(--border-glass)] bg-[var(--bg-sidebar)] overflow-x-auto no-scrollbar flex-nowrap shrink-0">
          {sections.map((s) => (
            <button
              key={s.id}
              onClick={() => setActiveSection(s.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-bold tracking-wide transition-all whitespace-nowrap font-[family-name:var(--font-outfit)] uppercase ${
                activeSection === s.id
                  ? "bg-[var(--bg-card)] text-orange-400 border border-orange-500/20 shadow-sm"
                  : "text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
              }`}
            >
              <span className="shrink-0">{s.icon}</span>
              <span>{s.label}</span>
            </button>
          ))}
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">

          {activeSection === "identity" && (
            <IdentitySettingsSection
              token={token}
              data={workspaceIdentity || null}
              userEmail={userEmail}
              fallbackDisplayName={fallbackDisplayName}
              fallbackPhotoUrl={fallbackPhotoUrl}
              hasSharedOrganizations={hasSharedOrganizations}
              onOpenOrganizationAccess={onOpenOrganizationAccess}
              onSaved={onIdentitySaved}
            />
          )}

          {/* â”€â”€ Interface Section â”€â”€ */}
          {activeSection === "interface" && (
            <div className="space-y-6 max-w-2xl animate-fade-in-up">
              <div>
                <h3 className="text-[10px] font-bold tracking-[0.2em] uppercase text-orange-500/50 mb-5 font-[family-name:var(--font-outfit)]">Apparence</h3>
                
                <div className="space-y-4">
                  {/* Theme state */}
                  <div className="p-5 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-glass)] flex items-center justify-between group hover:border-[var(--border-subtle)] transition-all">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-[var(--bg-hover)] flex items-center justify-center">
                        {theme === "dark" ? <Moon size={18} className="text-orange-400" /> : <Sun size={18} className="text-orange-400" />}
                      </div>
                      <div>
                        <p className="text-[14px] text-[var(--text-primary)] font-medium">Thème visuel</p>
                        <p className="text-[12px] text-[var(--text-muted)] font-light mt-0.5">{theme === "dark" ? "Mode sombre activé" : "Mode clair activé"}</p>
                        <p className="text-[12px] text-[var(--text-muted)] font-light mt-1">
                          Le thème se change désormais depuis le header principal, à droite, pour rester disponible partout.
                        </p>
                      </div>
                    </div>
                    <div className="rounded-full border border-[var(--border-glass)] bg-[var(--bg-hover)] px-3 py-1 text-[11px] font-medium text-[var(--text-primary)]">
                      {theme === "dark" ? "Sombre" : "Clair"}
                    </div>
                  </div>

                  </div>
                </div>

                {/* Guide Section */}
                <div className="mt-8">
                  <h3 className="text-[10px] font-bold tracking-[0.2em] uppercase text-orange-500/50 mb-5 font-[family-name:var(--font-outfit)]">Guides & Accompagnement</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Replay Tour */}
                    <button 
                      onClick={() => { onClose(); if (onStartTour) onStartTour(); }}
                      className="p-5 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-glass)] flex flex-col gap-3 text-left hover:border-orange-500/30 hover:bg-orange-500/5 transition-all group"
                    >
                      <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-400 group-hover:scale-110 transition-transform">
                        <RotateCcw size={18} />
                      </div>
                      <div>
                        <p className="text-[14px] text-[var(--text-primary)] font-medium">Rejouer le guide interactif</p>
                        <p className="text-[12px] text-[var(--text-muted)] font-light mt-1 whitespace-normal">Parcourez visuellement l&apos;interface avec notre assistant de visite.</p>
                      </div>
                    </button>

                    {/* Full Text Guide */}
                    <button 
                      onClick={() => setViewingFullGuide(true)}
                      className="p-5 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-glass)] flex flex-col gap-3 text-left hover:border-orange-500/30 hover:bg-orange-500/5 transition-all group"
                    >
                      <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-400 group-hover:scale-110 transition-transform">
                        <BookOpen size={18} />
                      </div>
                      <div>
                        <p className="text-[14px] text-[var(--text-primary)] font-medium">Lire le guide complet</p>
                        <p className="text-[12px] text-[var(--text-muted)] font-light mt-1 whitespace-normal">Un guide simple et complet pour bien utiliser FLARE AI.</p>
                      </div>
                    </button>
                  </div>
              </div>
            </div>
          )}

          {/* â”€â”€ System Agent / Preferences Section â”€â”€ */}
          {activeSection === "agent" && (
            <div className="animate-fade-in-up">
              <div className="flex items-center justify-between mb-4">
                 <h3 className="text-[14px] font-bold text-[var(--text-primary)] tracking-[0.05em] uppercase flex items-center gap-2 font-[family-name:var(--font-outfit)]">
                   <Sparkles size={16} className="text-orange-400" />
                  Préférences de l&apos;agent
                 </h3>

                {/* Mode Toggle */}
                <div className="flex items-center gap-1 bg-[var(--bg-sidebar)] p-1 rounded-xl border border-[var(--border-glass)]">
                   <button 
                     onClick={() => setPrefMode("guided")}
                     className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${prefMode === 'guided' ? 'bg-orange-500/20 text-orange-300' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
                   >
                     Guidé
                   </button>
                   <button 
                     onClick={() => setPrefMode("raw")}
                     className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${prefMode === 'raw' ? 'bg-orange-500/20 text-orange-300' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
                   >
                     Brut
                   </button>
                 </div>
              </div>

              <div className="mb-5 p-5 rounded-2xl bg-[var(--bg-active)] border border-[var(--border-glass)]">
                <p className="text-[13px] text-[var(--text-muted)] font-light leading-relaxed">
                  {prefMode === 'guided'
                    ? "Remplissez ces champs pour aider FLARE AI à mieux vous comprendre et à mieux vous répondre dans chaque discussion."
                    : "Décrivez simplement votre profil, le ton souhaité et la façon dont vous voulez recevoir les réponses."
                  }
                </p>
              </div>
              
              <div className="relative">
                {loading ? (
                  <div className="w-full h-80 bg-[var(--bg-card)] rounded-2xl border border-[var(--border-glass)] animate-pulse flex items-center justify-center text-[var(--text-muted)]">
                    Chargement...
                  </div>
                ) : prefMode === 'guided' ? (
                  <div className="space-y-5">
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      {/* Profil Input */}
                      <div>
                        <label className="text-[12px] font-bold text-[var(--text-primary)] flex items-center gap-1.5 mb-2"><Brain size={14} className="text-orange-500" /> Qui êtes-vous ?</label>
                        <textarea
                          value={guidedPrefs.profile}
                          onChange={(e) => setGuidedPrefs(p => ({...p, profile: e.target.value}))}
                          className="w-full h-24 bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-xl p-4 text-[var(--text-primary)] text-[13px] outline-none focus:border-orange-500/50 transition-all resize-none custom-scrollbar"
                          placeholder="Ex. : Je m'appelle Kévin, je suis entrepreneur et je dirige une agence."
                        />
                      </div>

                      {/* Ton Input */}
                      <div>
                        <label className="text-[12px] font-bold text-[var(--text-primary)] flex items-center gap-1.5 mb-2"><Sparkles size={14} className="text-[var(--accent-navy)]" /> Ton & Style de réponse</label>
                        <textarea
                          value={guidedPrefs.tone}
                          onChange={(e) => setGuidedPrefs(p => ({...p, tone: e.target.value}))}
                          className="w-full h-24 bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-xl p-4 text-[var(--text-primary)] text-[13px] outline-none focus:border-[var(--accent-navy)]/50 transition-all resize-none custom-scrollbar"
                          placeholder="Ex. : Réponds de façon professionnelle, claire et directe, sans trop d'emojis."
                        />
                      </div>
                    </div>

                    {/* Format Input */}
                    <div>
                      <label className="text-[12px] font-bold text-[var(--text-primary)] flex items-center gap-1.5 mb-2"><FileText size={14} className="text-orange-500" /> Format & Structure souhaités</label>
                      <textarea
                        value={guidedPrefs.format}
                        onChange={(e) => setGuidedPrefs(p => ({...p, format: e.target.value}))}
                        className="w-full h-24 bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-xl p-4 text-[var(--text-primary)] text-[13px] outline-none focus:border-orange-500/50 transition-all resize-none custom-scrollbar"
                        placeholder="Ex. : Quand je demande un résumé, utilise des listes simples. Si tu écris du code, ajoute des commentaires utiles."
                      />
                    </div>
                    
                    {/* Détails/Autre Input */}
                    <div>
                      <label className="text-[12px] font-bold text-[var(--text-primary)] flex items-center gap-1.5 mb-2"><Lightbulb size={14} className="text-[var(--accent-navy)]" /> Autres instructions spécifiques</label>
                      <textarea
                        value={guidedPrefs.other}
                        onChange={(e) => setGuidedPrefs(p => ({...p, other: e.target.value}))}
                        className="w-full h-28 bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-xl p-4 text-[var(--text-primary)] text-[13px] outline-none focus:border-[var(--accent-navy)]/50 transition-all resize-none custom-scrollbar"
                        placeholder="Ex. : Ne me propose jamais de solutions payantes sauf si je te le demande."
                      />
                    </div>

                  </div>
                ) : (
                  <textarea
                    value={userPreferences}
                    onChange={(e) => setUserPreferences(e.target.value)}
                    className="w-full h-96 bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-2xl p-6 text-[var(--text-primary)] text-[14px] font-sans leading-relaxed outline-none focus:border-orange-500/30 transition-all resize-y custom-scrollbar mb-8"
                    placeholder="Ex: Je m'appelle Marie, je suis graphiste freelance. Je préfère des réponses courtes et directes..."
                    spellCheck={false}
                  />
                )}
              </div>

              <div className="pt-8 mt-8 border-t border-[var(--border-glass)]">
                <h3 className="text-[14px] font-bold text-[var(--text-primary)] tracking-[0.05em] uppercase flex items-center gap-2 font-[family-name:var(--font-outfit)] mb-5">
                   <BookOpen size={16} className="text-orange-400" />
                   Base de Connaissances
                </h3>
                <div className="h-[500px] rounded-2xl overflow-hidden border border-[var(--border-glass)]">
                   <KnowledgePanel token={token ?? null} />
                </div>
              </div>
            </div>
          )}

          {activeSection === "chatbot" && (
            <div className="animate-fade-in-up space-y-6">
              <div className="rounded-2xl border border-[var(--border-glass)] bg-[var(--bg-card)] p-5">
                <h3 className="text-[14px] font-bold uppercase tracking-[0.05em] text-[var(--text-primary)] font-[family-name:var(--font-outfit)]">
                  Chatbot de l&apos;organisation active
                </h3>
                <p className="mt-2 text-[13px] leading-relaxed text-[var(--text-muted)]">
                  Ces reglages pilotent le bot Messenger de l&apos;espace actuellement actif. Ils sont separes des preferences de l&apos;assistant general.
                </p>
              </div>

              {!isOrganizationScope ? (
                <div className="rounded-2xl border border-orange-500/20 bg-orange-500/10 p-6">
                  <h4 className="text-[16px] font-semibold text-[var(--text-primary)]">
                    Ouvrez d&apos;abord une organisation
                  </h4>
                  <p className="mt-2 max-w-[38rem] text-[13px] leading-6 text-[var(--text-muted)]">
                    Le chatbot SaaS fonctionne dans un scope organisation. Choisissez votre organisation active, puis revenez ici pour modifier le ton, les offres et le message d&apos;accueil.
                  </p>
                  {onOpenOrganizationAccess && (
                    <button
                      type="button"
                      onClick={onOpenOrganizationAccess}
                      className="mt-4 rounded-xl bg-orange-600 px-4 py-2.5 text-[12px] font-semibold text-white transition-all hover:bg-orange-500"
                    >
                      Choisir mon organisation
                    </button>
                  )}
                </div>
              ) : chatbotLoading ? (
                <div className="flex h-72 items-center justify-center rounded-2xl border border-[var(--border-glass)] bg-[var(--bg-card)]">
                  <Loader2 size={22} className="animate-spin text-[var(--text-muted)]" />
                </div>
              ) : (
                <>
                  <div className="rounded-2xl border border-[var(--border-glass)] bg-[var(--bg-card)] p-6">
                    <div className="mb-5 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-orange-500/60">
                          Espace cible
                        </p>
                        <h4 className="mt-2 text-[18px] font-semibold text-[var(--text-primary)]">
                          {workspaceIdentity?.current_branding.brand_name || "Organisation"}
                        </h4>
                      </div>
                      <span className="rounded-full border border-[var(--border-glass)] bg-[var(--bg-hover)] px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
                        {canEditChatbot ? "Modifiable" : "Lecture seule"}
                      </span>
                    </div>

                    <ChatbotPreferencesForm
                      value={chatbotPreferences}
                      onChange={setChatbotPreferences}
                      disabled={chatbotSaving || !canEditChatbot}
                    />
                  </div>

                  {!canEditChatbot && (
                    <div className="rounded-2xl border border-orange-500/20 bg-orange-500/10 p-4 text-[13px] leading-6 text-orange-100/95">
                      Seuls le proprietaire ou un admin peuvent enregistrer ces reglages.
                    </div>
                  )}
                  {chatbotError && (
                    <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4 text-[13px] leading-6 text-rose-100/90">
                      {chatbotError}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* â”€â”€ Plan Section â”€â”€ */}
          {activeSection === "plan" && (
            <div className="max-w-2xl animate-fade-in-up space-y-6">
              {billingFeedback ? (
                <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-[13px] leading-6 text-red-200">
                  {billingFeedback}
                </div>
              ) : null}

              {/* Plan & Billing Section */}
              {userPlan && (
                <div className="p-6 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-glass)] flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${userPlan.plan === 'business' ? 'bg-[var(--accent-navy)]/15' : 'bg-orange-500/20'}`}>
                      <Crown size={24} className={`${userPlan.plan === 'business' ? 'text-[var(--accent-navy)] dark:text-[rgb(183,203,255)]' : 'text-orange-400'}`} />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-[var(--text-primary)]">Plan {userPlan.plan_name}</p>
                      <p className="text-xs text-zinc-500 mt-1">Plan actuel de votre compte</p>
                    </div>
                  </div>
                  {userPlan.plan !== "free" && (
                    <button 
                      onClick={handlePortalSession}
                      disabled={portalLoading}
                      className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-zinc-700/50 text-zinc-300 text-[12px] font-medium border border-zinc-700 hover:bg-zinc-600/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {portalLoading ? (
                        <>
                          <Loader2 size={14} className="animate-spin" />
                          <span>Redirection...</span>
                        </>
                      ) : (
                        <span>Gérer mon abonnement</span>
                      )}
                    </button>
                  )}
                </div>
              )}

              {/* Usage Progress */}
              {userPlan && (
                <div className="p-6 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-glass)] space-y-5">
                  <h4 className="text-[10px] font-bold tracking-[0.2em] uppercase text-orange-500/50 font-[family-name:var(--font-outfit)]">Consommation du Jour</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between text-[13px]">
                      <span className="text-[var(--text-muted)] flex items-center gap-1.5"><Zap size={14} /> Budget</span>
                      <span className="text-[var(--text-primary)] font-medium">
                        ${userPlan.daily_cost_usd.toFixed(4)} / {userPlan.daily_budget_usd === -1 ? "∞" : `$${userPlan.daily_budget_usd}`}
                      </span>
                    </div>
                    <div className="h-2 bg-[var(--bg-hover)] rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${
                          userPlan.usage_percent >= 90 ? "bg-red-500" :
                          userPlan.usage_percent >= 70 ? "bg-orange-500" : "bg-green-500"
                        }`}
                        style={{ width: `${Math.min(userPlan.usage_percent, 100)}%` }}
                      />
                    </div>
                    <p className="text-[11px] text-[var(--text-muted)]">
                      {userPlan.usage_percent.toFixed(1)}% utilisé — Réinitialisation à minuit UTC
                    </p>
                  </div>
                </div>
              )}

              {/* Upgrade CTA */}
              {userPlan && userPlan.plan !== "business" && (
                <div className="p-6 rounded-2xl bg-gradient-to-br from-orange-500/10 to-orange-600/5 border border-orange-500/20 flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-orange-500/20 flex items-center justify-center shrink-0">
                    <TrendingUp size={20} className="text-orange-400" />
                  </div>
                  <div>
                    <h4 className="text-[14px] font-semibold text-[var(--text-primary)] mb-1">
                      {userPlan.plan === "free" ? "Passez en Pro" : "Passez en Business"}
                    </h4>
                    <p className="text-[12px] text-[var(--text-muted)] leading-relaxed mb-3">
                      {userPlan.plan === "free"
                        ? "Obtenez 1 000 messages par mois et l’accès aux images générées."
                        : "Messages illimités + modèle Gemini Pro le plus puissant."}
                    </p>
                    <button
                      onClick={() => handleCheckout(userPlan.plan === "free" ? "pro" : "business")}
                      disabled={checkoutLoading}
                      className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-orange-500/20 text-orange-400 text-[12px] font-medium border border-orange-500/30 hover:bg-orange-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {checkoutLoading ? (
                        <>
                          <Loader2 size={14} className="animate-spin" />
                          <span>Redirection...</span>
                        </>
                      ) : (
                        <>
                          <Crown size={14} />
                          <span>{userPlan.plan === "free" ? "Passer en Pro" : "Passer en Business"}</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeSection === "about" && (
            <div className="max-w-2xl animate-fade-in-up space-y-6">
              <div className="p-8 rounded-3xl bg-[var(--bg-card)] border border-[var(--border-glass)] text-center">
                <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-[var(--border-glass)] bg-[var(--bg-hover)]">
                  <FlareMark tone="auto" className="w-9" />
                </div>
                <h3 className="text-[26px] font-bold text-[var(--text-primary)] tracking-tighter uppercase font-[family-name:var(--font-outfit)]">FLARE AI</h3>
                <p className="text-[10px] text-orange-500 font-bold tracking-[0.3em] uppercase mt-2 font-[family-name:var(--font-outfit)] opacity-80">application business + IA</p>
                <p className="text-[32px] font-bold text-[var(--text-primary)] mt-4 font-[family-name:var(--font-outfit)]">v2.0.0</p>
                <p className="text-[12px] text-[var(--text-muted)] mt-1">Build Stable</p>
              </div>

              <div className="p-6 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-glass)] space-y-4">
                <div className="space-y-3">
                  {[
                    { label: "Entree publique", value: "Landing FLARE AI" },
                    { label: "Accueil connecte", value: "Choix d'espace" },
                    { label: "Module principal", value: "Chatbot Facebook" },
                    { label: "Acces partage", value: "Espace perso + organisations" },
                    { label: "Roles d'espace", value: "Proprietaire, Admin, Membre, Lecture" },
                    { label: "Auth", value: "Firebase Auth" },
                    { label: "Backend", value: "Python FastAPI" },
                    { label: "Infra", value: "Google Cloud" },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center justify-between py-2 border-b border-[var(--border-glass)] last:border-b-0">
                      <span className="text-[13px] text-[var(--text-muted)] font-light">{item.label}</span>
                      <span className="text-[13px] text-[var(--text-primary)] font-medium">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-6 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-glass)] space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.24em] text-orange-500/60 font-bold font-[family-name:var(--font-outfit)]">Espace actif</p>
                    <h4 className="mt-2 text-[18px] font-semibold text-[var(--text-primary)]">
                      {workspaceIdentity?.current_branding.workspace_name || "FLARE AI"}
                    </h4>
                  </div>
                  <span className="rounded-full border border-[var(--border-glass)] bg-[var(--bg-hover)] px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
                    {workspaceIdentity?.current_branding.scope_type === "organization" ? "Organisation" : "Personnel"}
                  </span>
                </div>
                <p className="text-[13px] text-[var(--text-muted)] leading-relaxed">
                  {workspaceIdentity?.current_branding.brand_name || "FLARE AI"}
                  {workspaceIdentity?.current_branding.workspace_description
                    ? ` - ${workspaceIdentity.current_branding.workspace_description}`
                    : " - espace de travail actuellement charge dans l'application."}
                </p>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-2xl border border-[var(--border-glass)] bg-[var(--bg-hover)] p-4">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--text-muted)]">Ce que change l&apos;espace</p>
                    <p className="mt-2 text-[13px] text-[var(--text-primary)] leading-relaxed">
                      L&apos;espace actif decide le nom affiche, le logo, l&apos;offre et les modules visibles dans l&apos;app.
                    </p>
                  </div>
                  <div className="rounded-2xl border border-[var(--border-glass)] bg-[var(--bg-hover)] p-4">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--text-muted)]">Vos droits</p>
                    <p className="mt-2 text-[13px] text-[var(--text-primary)] leading-relaxed">
                      {workspaceIdentity?.organization_role_label
                        ? `Dans cet espace, votre role est ${workspaceIdentity.organization_role_label}.`
                        : "Dans votre espace personnel, vous gardez la main sur vos reglages et votre profil."}
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-[var(--bg-hover)] border border-[var(--border-glass)] text-center">
                <p className="text-[12px] text-[var(--text-muted)] font-light leading-relaxed">
                  L&apos;app separe maintenant la landing publique, l&apos;accueil connecte et chaque espace metier.<br/>
                  Le but est simple : moins de surcharge, plus de clarte, et un espace adapte a l&apos;organisation active.<br/>
                  Le chatbot garde des droits sensibles plus stricts que les simples roles d&apos;organisation.<br/>
                  <span className="text-[10px] opacity-30 mt-1 block">documentation integree mise a jour le 28 mars 2026</span>
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 md:px-8 py-4 md:py-5 border-t border-[var(--border-glass)] bg-[var(--bg-sidebar)]">
          {activeSection === "agent" && (
            <button
              onClick={() => setConfirmDialog({ message: "Effacer toutes vos préférences personnelles ?", onConfirm: async () => { try { await resetUserPreferences(token); } catch {} setUserPreferences(""); setConfirmDialog(null); } })}
              disabled={loading || saving || !userPreferences}
              className="text-[13px] text-[var(--text-muted)] hover:text-red-400 transition-colors flex items-center gap-1.5 disabled:opacity-30"
            >
              <RotateCcw size={14} />
              <span>Effacer les préférences</span>
            </button>
          )}
          {activeSection !== "agent" && <div />}
          
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-6 py-2.5 rounded-xl text-[13px] font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] bg-[var(--bg-hover)] transition-all"
            >
              Fermer
            </button>
            {activeSection === "agent" && (
              <button
                onClick={handleSave}
                disabled={loading || saving}
                className={`px-6 py-2.5 rounded-xl text-[13px] font-medium text-white transition-all flex items-center gap-2 disabled:opacity-50 shadow-lg ${
                  saved 
                    ? "bg-green-600 shadow-green-950/20" 
                    : "bg-orange-600 hover:bg-orange-500 shadow-orange-950/20"
                }`}
              >
                {saved ? (
                  <>
                    <Check size={16} />
                    <span>Enregistré !</span>
                  </>
                ) : saving ? (
                  <>Enregistrement...</>
                ) : (
                  <>
                    <Save size={16} />
                    <span>Enregistrer</span>
                  </>
                )}
              </button>
            )}
            {activeSection === "chatbot" && isOrganizationScope && (
              <button
                onClick={handleSaveChatbot}
                disabled={chatbotLoading || chatbotSaving || !canEditChatbot}
                className={`px-6 py-2.5 rounded-xl text-[13px] font-medium text-white transition-all flex items-center gap-2 disabled:opacity-50 shadow-lg ${
                  chatbotSaved
                    ? "bg-green-600 shadow-green-950/20"
                    : "bg-orange-600 hover:bg-orange-500 shadow-orange-950/20"
                }`}
              >
                {chatbotSaved ? (
                  <>
                    <Check size={16} />
                    <span>Enregistre !</span>
                  </>
                ) : chatbotSaving ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Enregistrement...</span>
                  </>
                ) : (
                  <>
                    <Save size={16} />
                    <span>Enregistrer</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
        
      </div>

      {/* Confirm Dialog Inline */}
      {confirmDialog && (
        <div className="absolute inset-0 z-[110] flex items-center justify-center bg-black/40 backdrop-blur-sm rounded-[32px]">
          <div className="bg-[var(--bg-modal)] border border-[var(--border-glass)] rounded-2xl p-6 max-w-sm mx-4 shadow-2xl animate-scale-in">
            <p className="text-[14px] text-[var(--text-primary)] font-medium mb-6 leading-relaxed">{confirmDialog.message}</p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setConfirmDialog(null)}
                className="px-5 py-2.5 rounded-xl text-[13px] font-medium text-[var(--text-muted)] bg-[var(--bg-hover)] hover:text-[var(--text-primary)] transition-all"
              >
                Annuler
              </button>
              <button
                onClick={confirmDialog.onConfirm}
                className="px-5 py-2.5 rounded-xl text-[13px] font-medium text-white bg-red-600 hover:bg-red-500 transition-all shadow-lg"
              >
                Confirmer
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Full Text Guide Overlay */}
      {viewingFullGuide && (
        <div className="absolute inset-0 z-[120] bg-[var(--bg-modal)]/80 backdrop-blur-3xl animate-fade-in flex flex-col">
          <div className="flex items-center justify-between px-8 py-6 border-b border-[var(--border-glass)] sticky top-0 bg-[var(--bg-modal)]/40 backdrop-blur-md z-10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center">
                <BookOpen className="text-orange-400" size={20} />
              </div>
              <h2 className="text-[20px] font-bold text-[var(--text-primary)] tracking-tight font-[family-name:var(--font-outfit)]">Guide d&apos;utilisation FLARE AI</h2>
            </div>
            <button 
              onClick={() => setViewingFullGuide(false)}
              className="p-2.5 rounded-xl bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-orange-400 transition-all flex items-center gap-2"
            >
              <RotateCcw size={16} /> <span className="text-sm font-bold uppercase tracking-widest px-1">Retour</span>
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-10 custom-scrollbar">
            <div className="max-w-3xl mx-auto space-y-12">
              
              <section className="space-y-5">
                <h3 className="text-[22px] font-bold text-orange-400 font-[family-name:var(--font-outfit)]">Introduction</h3>
                <div className="space-y-4 text-[15px] text-[var(--text-primary)] font-light leading-relaxed">
                  <p>
                    <strong>FLARE AI</strong> separe maintenant clairement la vitrine publique et l&apos;application de travail. Avant connexion, l&apos;utilisateur voit la landing. Apres connexion, il entre dans une app simple qui sert a choisir un espace metier.
                  </p>
                  <p>
                    L&apos;objectif est de reduire la surcharge : choisir vite, ouvrir le bon espace, puis agir sans lire des ecrans trop denses.
                  </p>
                  <p>
                    L&apos;ordre est volontairement simple : compte FLARE d&apos;abord, espace actif ensuite, module metier ensuite.
                  </p>
                </div>
              </section>

              <section className="space-y-6">
                <h3 className="text-[22px] font-bold text-orange-400 font-[family-name:var(--font-outfit)]">1. Comment l&apos;app est organisee</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-6 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-glass)]">
                    <h4 className="font-bold text-[var(--text-primary)] mb-2 flex items-center gap-2">
                      <Monitor size={16} className="text-orange-400" /> Landing publique
                    </h4>
                    <p className="text-[13px] text-[var(--text-muted)] font-light leading-relaxed">
                      Elle presente FLARE AI avant connexion et mene vers l&apos;entree utilisateur.
                    </p>
                  </div>
                  <div className="p-6 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-glass)]">
                    <h4 className="font-bold text-[var(--text-primary)] mb-2 flex items-center gap-2">
                      <Layers size={16} className="text-orange-400" /> Accueil connecte
                    </h4>
                    <p className="text-[13px] text-[var(--text-muted)] font-light leading-relaxed">
                      Il sert a choisir un espace. Le menu lateral reste volontairement leger.
                    </p>
                  </div>
                  <div className="p-6 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-glass)]">
                    <h4 className="font-bold text-[var(--text-primary)] mb-2 flex items-center gap-2">
                      <Sparkles size={16} className="text-orange-400" /> Espaces internes
                    </h4>
                    <p className="text-[13px] text-[var(--text-muted)] font-light leading-relaxed">
                      Chaque espace a ensuite sa propre navigation et ses propres actions.
                    </p>
                  </div>
                </div>
              </section>

              <section className="space-y-6">
                <h3 className="text-[22px] font-bold text-orange-400 font-[family-name:var(--font-outfit)]">2. Les espaces disponibles</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-6 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-glass)]">
                    <h4 className="font-bold text-[var(--text-primary)] mb-2">Chatbot Facebook</h4>
                    <p className="text-[13px] text-[var(--text-muted)] font-light leading-relaxed">
                      C&apos;est l&apos;espace metier principal. Il montre les priorites, les discussions a reprendre et le budget du bot.
                    </p>
                  </div>
                  <div className="p-6 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-glass)]">
                    <h4 className="font-bold text-[var(--text-primary)] mb-2">Assistant IA</h4>
                    <p className="text-[13px] text-[var(--text-muted)] font-light leading-relaxed">
                      C&apos;est l&apos;espace de travail general pour discuter, produire, organiser et utiliser vos contenus.
                    </p>
                  </div>
                  <div className="p-6 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-glass)]">
                    <h4 className="font-bold text-[var(--text-primary)] mb-2">Automatisations</h4>
                    <p className="text-[13px] text-[var(--text-muted)] font-light leading-relaxed">
                      Les modules non prets restent visibles mais verrouilles de facon honnete.
                    </p>
                  </div>
                </div>
              </section>

              <section className="space-y-6">
                <h3 className="text-[22px] font-bold text-orange-400 font-[family-name:var(--font-outfit)]">3. Le parcours dans Chatbot Facebook</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-6 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-glass)]">
                    <h4 className="font-bold text-[var(--text-primary)] mb-3">Les 4 vues utiles</h4>
                    <div className="space-y-2 text-[13px] text-[var(--text-muted)] font-light">
                      <p>`Vue d&apos;ensemble` pour voir vite la situation.</p>
                      <p>`Clients chauds` pour les cas a suivre.</p>
                      <p>`Discussions` pour reprendre la main.</p>
                      <p>`Budget` pour surveiller le cout et les conversations a surveiller.</p>
                    </div>
                  </div>
                  <div className="p-6 rounded-2xl bg-[var(--bg-active)] border border-[var(--border-glass)]">
                    <h4 className="font-bold text-[var(--text-primary)] mb-3">Ordre conseille</h4>
                    <div className="space-y-2 text-[13px] text-[var(--text-muted)] font-light">
                      <p>1. ouvrez `Vue d&apos;ensemble` pour comprendre la journee</p>
                      <p>2. ouvrez `Clients chauds` pour voir qui merite votre attention</p>
                      <p>3. ouvrez `Discussions` quand vous devez intervenir</p>
                      <p>4. terminez par `Budget` pour verifier le cout du bot</p>
                    </div>
                  </div>
                </div>
              </section>

              <section className="space-y-6">
                <h3 className="text-[22px] font-bold text-orange-400 font-[family-name:var(--font-outfit)]">4. Espace de travail et organisation</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-6 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-glass)]">
                    <h4 className="font-bold text-[var(--text-primary)] mb-2 flex items-center gap-2">
                      <Brain size={16} className="text-orange-400" /> Espace personnel
                    </h4>
                    <p className="text-[13px] text-[var(--text-muted)] font-light leading-relaxed">
                      Chaque compte garde son profil, sa photo et son espace personnel.
                    </p>
                  </div>
                  <div className="p-6 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-glass)]">
                    <h4 className="font-bold text-[var(--text-primary)] mb-2 flex items-center gap-2">
                      <Layers size={16} className="text-orange-400" /> Organisation partagee
                    </h4>
                    <p className="text-[13px] text-[var(--text-muted)] font-light leading-relaxed">
                      Une organisation peut etre partagee entre plusieurs comptes et afficher son propre nom, logo et espace de travail.
                    </p>
                  </div>
                </div>
                <div className="p-6 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-glass)]">
                  <h4 className="font-bold text-[var(--text-primary)] mb-3">Espace actuellement charge</h4>
                  <div className="space-y-2 text-[13px] text-[var(--text-muted)] font-light">
                    <p>Nom affiche : <span className="text-[var(--text-primary)] font-medium">{workspaceIdentity?.current_branding.brand_name || "FLARE AI"}</span></p>
                    <p>Espace : <span className="text-[var(--text-primary)] font-medium">{workspaceIdentity?.current_branding.workspace_name || "FLARE AI"}</span></p>
                    <p>Type : <span className="text-[var(--text-primary)] font-medium">{workspaceIdentity?.current_branding.scope_type === "organization" ? "Organisation" : "Personnel"}</span></p>
                    <p>Role : <span className="text-[var(--text-primary)] font-medium">{workspaceIdentity?.organization_role_label || "Proprietaire de l'espace personnel"}</span></p>
                    <p>Partage : <span className="text-[var(--text-primary)] font-medium">{hasSharedOrganizations ? "au moins une organisation partagee disponible" : "aucune organisation partagee detectee"}</span></p>
                  </div>
                </div>
                <div className="p-6 rounded-2xl bg-[var(--bg-active)] border border-[var(--border-glass)]">
                  <h4 className="font-bold text-[var(--text-primary)] mb-3">Ce que change le role</h4>
                  <div className="space-y-2 text-[13px] text-[var(--text-muted)] font-light">
                    <p>`Proprietaire` et `Admin` peuvent changer le nom, le logo et la presentation de l&apos;organisation.</p>
                    <p>`Membre` et `Lecture` utilisent l&apos;espace sans pouvoir changer son identite.</p>
                    <p>Les droits sensibles du chatbot restent separes et plus stricts que ce role d&apos;organisation.</p>
                  </div>
                </div>
              </section>

              <section className="space-y-6">
                <h3 className="text-[22px] font-bold text-orange-400 font-[family-name:var(--font-outfit)]">5. Les reglages utiles</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-5 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-glass)]">
                    <h4 className="font-bold text-[var(--text-primary)] mb-2">Identite</h4>
                    <p className="text-[13px] text-[var(--text-muted)] font-light leading-relaxed">
                      Changez le nom, le logo, la photo et la presentation de l&apos;espace actif.
                    </p>
                  </div>
                  <div className="p-5 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-glass)]">
                    <h4 className="font-bold text-[var(--text-primary)] mb-2">Interface</h4>
                    <p className="text-[13px] text-[var(--text-muted)] font-light leading-relaxed">
                      Ajustez le theme, le mode d&apos;affichage et relisez ce guide si besoin.
                    </p>
                  </div>
                  <div className="p-5 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-glass)]">
                    <h4 className="font-bold text-[var(--text-primary)] mb-2">Agent IA</h4>
                    <p className="text-[13px] text-[var(--text-muted)] font-light leading-relaxed">
                      Precisez vos preferences de reponse pour l&apos;assistant general.
                    </p>
                  </div>
                  <div className="p-5 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-glass)]">
                    <h4 className="font-bold text-[var(--text-primary)] mb-2">Abonnement</h4>
                    <p className="text-[13px] text-[var(--text-muted)] font-light leading-relaxed">
                      Verifiez votre usage, votre budget et les options d&apos;upgrade.
                    </p>
                  </div>
                </div>
              </section>

              <section className="space-y-6">
                <h3 className="text-[22px] font-bold text-orange-400 font-[family-name:var(--font-outfit)]">6. Bon ordre pour commencer</h3>
                <div className="p-6 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-glass)]">
                  <div className="space-y-3 text-[13px] text-[var(--text-muted)] font-light leading-relaxed">
                    <p>1. connectez-vous et choisissez l&apos;espace qui correspond a votre besoin</p>
                    <p>2. verifiez le nom, le logo et le role affiches dans l&apos;espace actif</p>
                    <p>3. si vous pilotez un business Messenger, ouvrez d&apos;abord `Chatbot Facebook`</p>
                    <p>4. si vous voulez travailler avec l&apos;IA de facon generale, ouvrez `Assistant IA`</p>
                    <p>5. laissez les modules verrouilles tant qu&apos;ils ne sont pas actifs pour votre offre</p>
                  </div>
                </div>
              </section>

              <section className="bg-orange-500/5 p-8 rounded-[32px] border border-orange-500/10">
                <h3 className="text-[20px] font-bold text-[var(--text-primary)] mb-4 font-[family-name:var(--font-outfit)]">A retenir</h3>
                <p className="text-[14px] text-[var(--text-muted)] font-light leading-relaxed mb-6">
                  FLARE AI est maintenant organise par espaces. La landing vend le produit, l&apos;accueil connecte fait choisir le bon espace, puis chaque espace garde sa propre logique. Le chatbot Facebook reste l&apos;outil metier principal aujourd&apos;hui, mais il applique aussi les regles de l&apos;organisation active.
                </p>
                <button 
                  onClick={() => setViewingFullGuide(false)}
                  className="w-full py-4 rounded-2xl bg-orange-600 text-white font-bold text-[14px] hover:bg-orange-500 transition-all shadow-xl shadow-orange-900/10"
                >
                  Fermer le guide
                </button>
              </section>
<div className="h-20" /> {/* Spacer */}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}



