"use client";

import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import LoginScreen from "@/components/LoginScreen";
import dynamic from "next/dynamic";
import type { FacebookMessengerPage } from "@/lib/facebookMessenger";

import { SkeletonPanel } from "@/components/SkeletonLoader";
import FlareMark from "@/components/FlareMark";

// Code splitting : panels secondaires chargÃ©s Ã  la demande
const MemoryPanel = dynamic(() => import("@/components/MemoryPanel"), { ssr: false, loading: () => <SkeletonPanel /> });
const DashboardPanel = dynamic(() => import("@/components/DashboardPanel"), { ssr: false, loading: () => <SkeletonPanel /> });
const ChatbotSetupWizard = dynamic(() => import("@/components/ChatbotSetupWizard"), { ssr: false, loading: () => <SkeletonPanel /> });
const ChatbotWorkspace = dynamic(() => import("@/components/ChatbotWorkspace"), { ssr: false, loading: () => <SkeletonPanel /> });
const MessengerWorkspace = dynamic(() => import("@/components/MessengerWorkspace"), { ssr: false, loading: () => <SkeletonPanel /> });
const AutomationHubPanel = dynamic(() => import("@/components/AutomationHubPanel"), { ssr: false, loading: () => <SkeletonPanel /> });
const LockedModulePanel = dynamic(() => import("@/components/LockedModulePanel"), { ssr: false, loading: () => <SkeletonPanel /> });
// LandingPage is no longer rendered in /app — it lives at / (root) for SEO
const PromptsPanel = dynamic(() => import("@/components/PromptsPanel"), { ssr: false, loading: () => <SkeletonPanel /> });
const KnowledgePanel = dynamic(() => import("@/components/KnowledgePanel"), { ssr: false, loading: () => <SkeletonPanel /> });
const FilesPanel = dynamic(() => import("@/components/FilesPanel"), { ssr: false, loading: () => <SkeletonPanel /> });
import AdminPanel from "@/components/AdminPanel";
import ArtifactViewer, { Artifact } from "@/components/ArtifactViewer";
// Lazy-load modals â€” jamais nÃ©cessaires au premier rendu
const SettingsModal = dynamic(() => import("@/components/SettingsModal"), { ssr: false });
import { useChat } from "@/hooks/useChat";
import { useConversations } from "@/hooks/useConversations";
import { useFolders } from "@/hooks/useFolders";
import { BookOpen, X, ChevronDown, Menu, Download, AlertCircle, ArrowLeft } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";

import NavBreadcrumb, { type NavLevel, NAV_LABELS } from "@/components/NavBreadcrumb";
import NewSidebar from "@/components/NewSidebar";
import HomePage from "@/components/pages/HomePage";
import AutomationsPage from "@/components/pages/AutomationsPage";
import FacebookPage from "@/components/pages/FacebookPage";
import GooglePage from "@/components/pages/GooglePage";
import ChatbotHomePage from "@/components/pages/ChatbotHomePage";
import GuidePage from "@/components/pages/GuidePage";
import BillingPage from "@/components/pages/BillingPage";
import ContactPage from "@/components/pages/ContactPage";
import SettingsPage from "@/components/pages/SettingsPage";
import AssistantPage from "@/components/pages/AssistantPage";
import ChatbotPersonnalisationPage from "@/components/pages/ChatbotPersonnalisationPage";
import ChatbotParametresPage from "@/components/pages/ChatbotParametresPage";
import ChatbotDashboardPage from "@/components/pages/ChatbotDashboardPage";
import ChatbotClientsPage from "@/components/pages/ChatbotClientsPage";
import ChatbotClientDetailPage from "@/components/pages/ChatbotClientDetailPage";
import ChatbotActivationPage from "@/components/pages/ChatbotActivationPage";
import ChatbotOrdersPage from "@/components/pages/ChatbotOrdersPage";
import ThemeToggle from "@/components/ui/ThemeToggle";
import SignalementModal from "@/components/SignalementModal";
import FloatingContextualGuide from "@/components/guide/FloatingContextualGuide";
import type { GuideContext } from "@/components/guide/guideAssistantContent";
import { useThemePreference } from "@/hooks/useThemePreference";
import { rememberActivationPlan, type ActivationPlanId } from "@/lib/activationFlow";

import {
  ChatMode,
  ActivationRequest,
  FileAttachment,
  WorkspaceIdentity,
  getApiBaseUrl,
  getWorkspaceIdentity,
  healthCheck,
  saveTrackedFile,
  syncUser,
  trackClientEvent,
  toRenderableMediaUrl,
  getMyActivationRequest,
} from "@/lib/api";
import { getChatbotSetupStatus, type ChatbotSetupStatus } from "@/lib/api";

export type ActiveView =
  | "chat"
  | "memory"
  | "dashboard"
  | "facebook"
  | "google"
  | "chatbot"
  | "leads"
  | "conversations"
  | "expenses"
  | "chatbotFiles"
  | "automationHub"
  | "prospection"
  | "content"
  | "followup"
  | "agents"
  | "prompts"
  | "knowledge"
  | "files"
  | "admin";

type AppView = NavLevel | ActiveView;

const DEFAULT_BACK_TARGET: Partial<Record<AppView, AppView>> = {
  assistant: "home",
  chat: "home",
  memory: "assistant",
  prompts: "assistant",
  knowledge: "assistant",
  files: "assistant",
  dashboard: "home",
  automations: "home",
  facebook: "automations",
  google: "automations",
  chatbot: "facebook",
  "chatbot-personnalisation": "chatbot",
  "chatbot-parametres": "chatbot",
  "chatbot-dashboard": "facebook",
  "chatbot-clients": "chatbot-dashboard",
  "chatbot-client-detail": "chatbot-clients",
  "chatbot-orders": "chatbot-dashboard",
  "chatbot-activation": "chatbot",
  leads: "chatbot-dashboard",
  conversations: "chatbot-dashboard",
  expenses: "chatbot-dashboard",
  chatbotFiles: "chatbot-dashboard",
  automationHub: "automations",
  prospection: "automationHub",
  content: "automationHub",
  followup: "automationHub",
  agents: "automationHub",
  guide: "home",
  billing: "home",
  contact: "home",
  settings: "home",
  admin: "home",
};

function resolveFallbackBackTarget(view: AppView): AppView {
  return DEFAULT_BACK_TARGET[view] ?? "home";
}

function resolvePreferredFacebookPageId(
  pages: FacebookMessengerPage[],
  currentSelectedPageId: string | null | undefined,
  activePageId?: string | null
): string | null {
  if (pages.length === 0) {
    return null;
  }

  if (currentSelectedPageId && pages.some((page) => page.page_id === currentSelectedPageId)) {
    return currentSelectedPageId;
  }

  if (activePageId) {
    const activePage = pages.find((page) => page.page_id === activePageId);
    if (activePage) {
      return activePage.page_id;
    }
  }

  const activeFallback = pages.find((page) => page.is_active);
  return (activeFallback || pages[0]).page_id;
}

const GUEST_LOCKED_VIEWS: ActiveView[] = ["chat", "memory", "prompts", "knowledge", "files", "admin"];
const ADMIN_EMAILS = ["cptskevin@gmail.com"];

type LockedModuleView = "prospection" | "content" | "followup" | "agents";

type LockedModuleConfig = {
  eyebrow: string;
  title: string;
  summary: string;
  blockedReason: string;
  upgradeMessage: string;
  highlights: { title: string; description: string }[];
  availableNow: { label: string; description: string; view: ActiveView; tone?: "primary" | "secondary" }[];
};

const DEFAULT_NAV_STACKS: Record<AppView, AppView[]> = {
  home: ["home"],
  automations: ["home", "automations"],
  facebook: ["home", "automations", "facebook"],
  google: ["home", "automations", "google"],
  chatbot: ["home", "automations", "facebook", "chatbot"],
  leads: ["home", "automations", "facebook", "chatbot-dashboard", "leads"],
  conversations: ["home", "automations", "facebook", "chatbot-dashboard", "conversations"],
  expenses: ["home", "automations", "facebook", "chatbot-dashboard", "expenses"],
  chatbotFiles: ["home", "automations", "facebook", "chatbot-dashboard", "chatbotFiles"],
  "chatbot-personnalisation": ["home", "automations", "facebook", "chatbot", "chatbot-personnalisation"],
  "chatbot-parametres": ["home", "automations", "facebook", "chatbot", "chatbot-parametres"],
  "chatbot-dashboard": ["home", "automations", "facebook", "chatbot-dashboard"],
  "chatbot-clients": ["home", "automations", "facebook", "chatbot-dashboard", "chatbot-clients"],
  "chatbot-client-detail": ["home", "automations", "facebook", "chatbot-dashboard", "chatbot-clients", "chatbot-client-detail"],
  "chatbot-orders": ["home", "automations", "facebook", "chatbot-dashboard", "chatbot-orders"],
  "chatbot-activation": ["home", "automations", "facebook", "chatbot", "chatbot-activation"],
  admin: ["home", "admin"],
  assistant: ["home", "assistant"],
  chat: ["home", "assistant"],
  memory: ["home", "assistant", "memory"],
  prompts: ["home", "assistant", "prompts"],
  knowledge: ["home", "assistant", "knowledge"],
  files: ["home", "assistant", "files"],
  billing: ["home", "billing"],
  guide: ["home", "guide"],
  contact: ["home", "contact"],
  settings: ["home", "settings"],
  dashboard: ["home", "automations", "facebook", "chatbot-dashboard"],
  automationHub: ["home", "automations", "automationHub"],
  prospection: ["home", "automations", "prospection"],
  content: ["home", "automations", "content"],
  followup: ["home", "automations", "followup"],
  agents: ["home", "automations", "agents"],
};

function resolveDefaultNavStack(view: AppView): AppView[] {
  return [...(DEFAULT_NAV_STACKS[view] ?? [view])];
}

const LOCKED_MODULES: Record<LockedModuleView, LockedModuleConfig> = {
  prospection: {
    eyebrow: "Prospection bloquee",
    title: "Prospection automatique",
    summary: "Quand cette page sera ouverte, elle trouvera, classera et relancera de nouveaux clients dans FLARE AI.",
    blockedReason: "Cette page n'est pas encore disponible. Elle reste bloquee pour eviter un faux parcours qui ne fait rien.",
    upgradeMessage: "Veuillez ameliorer votre offre pour debloquer cette automatisation des qu'elle sera disponible sur votre compte.",
    highlights: [
      {
        title: "Trouver les bonnes cibles",
        description: "Construire une liste de bons clients au lieu d'empiler des contacts sans contexte.",
      },
      {
        title: "Qualifier avant de relancer",
        description: "Garder seulement les profils utiles, avec besoin, blocage et prochaine action.",
      },
      {
        title: "Relancer sans bricolage",
        description: "Piloter les suivis depuis une vraie page de prospection au lieu de sauter entre plusieurs ecrans.",
      },
    ],
    availableNow: [
      {
        label: "Ouvrir Facebook",
        description: "Le module deja pret pour suivre les messages, leads et activations.",
        view: "facebook",
        tone: "primary",
      },
      {
        label: "Voir les clients chauds",
        description: "Priorisez tout de suite les clients chauds detectes par Facebook.",
        view: "leads",
      },
      {
        label: "Lire les discussions",
        description: "Reprenez la main sur les conversations qui avancent ou qui bloquent.",
        view: "conversations",
      },
    ],
  },
  content: {
    eyebrow: "Studio bloque",
    title: "Studio contenu FLARE",
    summary: "Cette page preparera vos posts, vos visuels et vos campagnes au meme endroit.",
    blockedReason: "Le studio n'est pas encore disponible. Il reste bloque pour eviter un ecran vide ou des boutons inutiles.",
    upgradeMessage: "Veuillez ameliorer votre offre pour debloquer ce studio quand il sera lance dans votre compte.",
    highlights: [
      {
        title: "Ecrire plus vite",
        description: "Generer des brouillons utiles avec angle, promesse et format deja cadres.",
      },
      {
        title: "Produire au meme endroit",
        description: "Rassembler texte, visuel et validation dans une seule page au lieu de disperser le travail.",
      },
      {
        title: "Publier avec contexte",
        description: "Garder les offres, les objections clients et les alertes du chatbot a portee de main.",
      },
    ],
    availableNow: [
      {
        label: "Retour a l'accueil FLARE",
        description: "Revenir a l'accueil pour voir quoi faire en premier.",
        view: "dashboard",
        tone: "primary",
      },
      {
        label: "Ouvrir Facebook",
        description: "Le module deja ouvert pour piloter messages et activations.",
        view: "facebook",
      },
      {
        label: "Voir le budget Facebook",
        description: "Garder une lecture claire des depenses avant d'ajouter d'autres plateformes.",
        view: "expenses",
      },
    ],
  },
  followup: {
    eyebrow: "Suivi client bloque",
    title: "CRM & suivi clients",
    summary: "Cette page reunira rappels, offres et prochaines actions dans un vrai suivi client.",
    blockedReason: "Le suivi client n'est pas encore disponible. Il reste bloque pour ne pas faire passer les leads Messenger pour le module final.",
    upgradeMessage: "Veuillez ameliorer votre offre pour debloquer ce module des qu'il sera pret sur votre compte.",
    highlights: [
      {
        title: "Voir le pipeline d'un coup",
        description: "Comprendre ou en est chaque client sans relire toutes les conversations.",
      },
      {
        title: "Ne rien oublier",
        description: "Faire remonter les rappels, les blocages et les prochaines actions au bon moment.",
      },
      {
        title: "Mesurer ce qui avance",
        description: "Suivre les etapes, offres et relances depuis un vrai suivi client.",
      },
    ],
    availableNow: [
      {
        label: "Ouvrir les clients chauds",
        description: "La vue la plus proche du suivi client aujourd'hui pour voir les urgences remontees par Facebook.",
        view: "leads",
        tone: "primary",
      },
      {
        label: "Ouvrir les discussions",
        description: "Traitez les reprises humaines et gardez le contexte conversationnel.",
        view: "conversations",
      },
      {
        label: "Voir Facebook",
        description: "Revenir a la vue d'ensemble Facebook.",
        view: "facebook",
      },
    ],
  },
  agents: {
    eyebrow: "Agents bloques",
    title: "Agents FLARE",
    summary: "Les agents arriveront ici quand ils pourront vous rendre un vrai resultat, pas juste ouvrir une autre page.",
    blockedReason: "Les agents restent bloques tant qu'ils n'apportent pas un vrai resultat utile.",
    upgradeMessage: "Veuillez ameliorer votre offre pour acceder aux agents des qu'ils seront ouverts sur votre compte.",
    highlights: [
      {
        title: "Executer une mission complete",
        description: "Un agent devra aller jusqu'au resultat attendu au lieu de simplement deleguer vers une autre page.",
      },
      {
        title: "Rester lisible",
        description: "Vous devrez comprendre en un coup d'oeil ce que l'agent fait, ce qu'il attend et ce qu'il a produit.",
      },
      {
        title: "Servir le business",
        description: "Chaque agent devra faire gagner du temps, de la visibilite ou des clients de maniere mesurable.",
      },
    ],
    availableNow: [
      {
        label: "Ouvrir Facebook",
        description: "Le module automatise deja actif pour les demandes entrantes.",
        view: "facebook",
        tone: "primary",
      },
      {
        label: "Voir les automatisations",
        description: "Parcourir tous les modules disponibles et bloques depuis le hub FLARE.",
        view: "automationHub",
      },
      {
        label: "Ouvrir l'assistant IA",
        description: "Utiliser l'assistant d'ecriture si vous avez besoin de cadrer ou preparer une reponse.",
        view: "chat",
      },
    ],
  },
};

export default function Home() {
  const { user, token, loading: authLoading, error: authError, getFreshToken, login, loginWithPassword, signUpWithPassword, loginWithGoogle, resetPassword, logout, sendSignupPin, verifySignupPin } = useAuth();
  const [navStack, setNavStack] = useState<AppView[]>(["home"]);
  const activeView = navStack[navStack.length - 1];
  const onPush = (level: NavLevel) => setNavStack(prev => [...prev, level]);
  const onPop = () => setNavStack(prev => prev.length > 1 ? prev.slice(0, -1) : prev);

  const [selectedMessengerConversationId, setSelectedMessengerConversationId] = useState<string | null>(null);
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null);
  const sessionIdentity = user ? `${user.uid}:${user.email ?? ""}` : "anonymous";
  const sessionIdentityRef = useRef(sessionIdentity);
  const [showFilesPanel, setShowFilesPanel] = useState(false);
  const [activeArtifact, setActiveArtifact] = useState<Artifact | null>(null);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [displayName, setDisplayName] = useState<string>('');
  const [chatMode, setChatMode] = useState<'raisonnement' | 'rapide'>('raisonnement');
  const [workspaceIdentity, setWorkspaceIdentity] = useState<WorkspaceIdentity | null>(null);
  const [setupStatus, setSetupStatus] = useState<ChatbotSetupStatus | null>(null);
  const [activationRequest, setActivationRequest] = useState<ActivationRequest | null>(null);
  const [selectedFacebookPageId, setSelectedFacebookPageId] = useState<string | null>(null);
  const [facebookPages, setFacebookPages] = useState<FacebookMessengerPage[]>([]);
  const { theme, toggleTheme: handleThemeToggle } = useThemePreference();

  const searchParams = useSearchParams();

  const [lang, setLang] = useState<'fr' | 'en'>('fr');
  const hasHistoryBack = navStack.length > 1;
  const showStandaloneBack = activeView !== "home" && !hasHistoryBack;

  // Read ?auth= param from the landing page CTAs (e.g. /app?auth=signup)
  useEffect(() => {
    const authIntent = searchParams?.get("auth");
    if (authIntent === "signup" || authIntent === "login") {
      setAuthMode(authIntent);
      setShowAuth(true);
    }
  }, [searchParams]);

  useEffect(() => {
    const savedLang = localStorage.getItem('flare-lang') as 'fr' | 'en' | null;
    if (savedLang) setLang(savedLang);
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    if (sidebarOpen) {
      document.body.classList.add("sidebar-mobile-open");
      return () => {
        document.body.classList.remove("sidebar-mobile-open");
      };
    }

    document.body.classList.remove("sidebar-mobile-open");
  }, [sidebarOpen]);

  const handleLangChange = (newLang: 'fr' | 'en') => {
    setLang(newLang);
    localStorage.setItem('flare-lang', newLang);
  };


  useEffect(() => {
    const savedName = localStorage.getItem('flare-user-name');
    if (savedName) setDisplayName(savedName);
    
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      const dismissed = localStorage.getItem('flare-install-dismissed');
      if (!dismissed) setShowInstallBanner(true);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
    };
  }, []);

  // ── Force Cache Clear (v4.0.0 — Landing Overhaul) ──
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const currentVersion = "4.0.0";
      const savedVersion = localStorage.getItem("flare-app-version");
      if (savedVersion !== currentVersion) {
        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.getRegistrations().then(registrations => {
            for (let registration of registrations) {
              registration.unregister();
            }
            localStorage.setItem("flare-app-version", currentVersion);
          });
        } else {
          localStorage.setItem("flare-app-version", currentVersion);
        }
      }
      
      const handleOpenSidebar = () => setSidebarOpen(true);
      window.addEventListener('open-sidebar-tour', handleOpenSidebar);
      return () => window.removeEventListener('open-sidebar-tour', handleOpenSidebar);
    }
  }, []);
  // Texte + piÃ¨ce jointe Ã  restaurer dans l'input aprÃ¨s annulation d'un message
  const [pendingRestore, setPendingRestore] = useState("");
  const [pendingRestoreAttachment, setPendingRestoreAttachment] = useState<FileAttachment | null>(null);
  const lastSentAttachmentRef = useRef<FileAttachment | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { folders, addFolder, editFolder, removeFolder } = useFolders(token);

  // Compteur pour forcer le refresh du KnowledgePanel quand l'agent sauvegarde
  const [knowledgeRefreshToken, setKnowledgeRefreshToken] = useState(0);
  // Toast notification quand la base de connaissances est mise Ã  jour par l'agent
  const [knowledgeToast, setKnowledgeToast] = useState<string[] | null>(null);
  const [appNotice, setAppNotice] = useState<{ tone: "error" | "info"; message: string } | null>(null);

  const handleKnowledgeSaved = useCallback((titles: string[]) => {
    setKnowledgeRefreshToken((t) => t + 1);
    setKnowledgeToast(titles);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setKnowledgeToast(null), 4000);
  }, []);

  const pushAppNotice = useCallback((message: string, tone: "error" | "info" = "error") => {
    setAppNotice({ tone, message });
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setAppNotice(null), 4500);
  }, []);

  const { conversations, loading, refresh, rename, remove } =
    useConversations(token);

  const { messages, sessionId, isLoading, isFetchingHistory, thought, thoughts, error, send, stop, loadConversation, newConversation, deleteMessagesAfterPoint } =
    useChat(() => { setTimeout(refresh, 500); }, token, handleKnowledgeSaved);

  const activeConvTitle = conversations.find((c) => c.id === sessionId)?.title ?? null;

  const [showProfileMenu, setShowProfileMenu] = useState(false);

  const activeArtifactVersions = useMemo(() => {
    if (!activeArtifact) return [];
    const baseNameMatch = activeArtifact.name.match(/^(.*?)(_v\d+)?(\.[^.]+)$/);
    const baseName = baseNameMatch ? baseNameMatch[1] : activeArtifact.name;
    const versions: Artifact[] = [];
    let versionCounter = 1;
    
    messages.forEach(msg => {
      if (msg.attachment) {
        const attName = msg.attachment.name || "";
        const attBaseMatch = attName.match(/^(.*?)(_v\d+)?(\.[^.]+)$/);
        const attBaseName = attBaseMatch ? attBaseMatch[1] : attName;
        
        if (attBaseName === baseName || attName === activeArtifact.name) {
           const url = (msg.attachment as any).url || msg.attachment.dataUrl || "";
           if (url && !versions.some(v => v.url === url)) {
             const isSheet = msg.attachment.kind === "sheet" || msg.attachment.kind === "spreadsheet" || attName.endsWith(".xlsx") || attName.endsWith(".csv");
             const isCode = attName.endsWith(".json") || attName.endsWith(".js") || attName.endsWith(".ts") || attName.endsWith(".tsx") || attName.endsWith(".html") || attName.endsWith(".css") || attName.endsWith(".py");
             const isDocument = msg.attachment.kind === "document" && !isCode;
             const isVideo = msg.attachment.kind === "video" || attName.endsWith(".mp4") || attName.endsWith(".mov") || attName.endsWith(".webm");
             const type = isSheet
               ? "sheet"
               : isCode
                 ? "code"
                 : isDocument
                   ? "document"
                   : isVideo
                     ? "video"
                     : (msg.attachment.kind === "image" && !isSheet && !isDocument && !isCode)
                       ? "image"
                       : "unknown";
             const data =
               type === "image"
                 ? msg.attachment.dataUrl
                 : msg.attachment.dataUrl?.startsWith('data:')
                   ? undefined
                   : msg.content;
             
             versions.push({
               url,
               type: type as any,
               name: attName,
               data,
               version: `v${versionCounter++}`
             });
           }
        }
      }
    });

    if (!versions.some(v => v.url === activeArtifact.url)) {
      versions.push({ ...activeArtifact, version: `v${versionCounter}` });
    }
    
    // Assign correct version string to the current active artifact if it matched
    const currentInList = versions.find(v => v.url === activeArtifact.url);
    if (currentInList) {
      activeArtifact.version = currentInList.version;
    }

    return versions.reverse();
  }, [messages, activeArtifact]);

  // Wrapper d'envoi : capture la piÃ¨ce jointe pour restauration Ã©ventuelle + sauvegarde dans le tracker
  const handleSend = useCallback((text: string, attachment?: FileAttachment, deepResearch?: boolean, quality?: string, mode?: ChatMode) => {
    lastSentAttachmentRef.current = attachment ?? null;
    if (attachment) {
      const kind =
        attachment.type.startsWith("image/") ? "image"
        : attachment.type.startsWith("audio/") ? "audio"
        : attachment.name.match(/\.(pdf|docx)$/i) ? "document"
        : "text";
      saveTrackedFile({
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        name: attachment.name,
        kind,
        conversationId: sessionId || "new",
        conversationTitle: activeConvTitle || "Nouvelle conversation",
        timestamp: new Date().toISOString(),
        dataUrl: attachment.dataUrl,
      });
    }
    send(text, attachment, deepResearch, quality, mode ?? chatMode);
  }, [send, sessionId, activeConvTitle, chatMode]);

  const buildInlineArtifactAttachment = useCallback((artifact: Artifact | null): FileAttachment | undefined => {
    const inlineUrl = artifact?.url?.startsWith("data:")
      ? artifact.url
      : artifact?.data?.startsWith("data:")
        ? artifact.data
        : undefined;
    if (!inlineUrl) return undefined;
    const match = inlineUrl.match(/^data:(.*?);base64,(.*)$/);
    if (!match) return undefined;
    return {
      content: match[2],
      type: match[1] || "application/octet-stream",
      name: artifact?.name || "artifact",
      dataUrl: inlineUrl,
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleError = (event: ErrorEvent) => {
      trackClientEvent("window_error", {
        message: event.message,
        source: event.filename,
        line: event.lineno,
        column: event.colno,
      });
    };

    const handleRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason instanceof Error
        ? event.reason.message
        : String(event.reason || "unknown");
      trackClientEvent("unhandled_rejection", { reason });
    };

    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleRejection);

    return () => {
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleRejection);
    };
  }, [refresh]);

  const resolveAccessToken = useCallback(async (forceRefresh = false) => {
    if (getFreshToken) {
      const nextToken = await getFreshToken(forceRefresh);
      return nextToken;
    }
    return token ?? null;
  }, [getFreshToken, token]);

  useEffect(() => {
    sessionIdentityRef.current = sessionIdentity;
  }, [sessionIdentity]);

  const loadWorkspaceIdentity = useCallback(async () => {
    const requestIdentity = sessionIdentityRef.current;
    const accessToken = await resolveAccessToken();
    if (!user || !accessToken) {
      setWorkspaceIdentity(null);
      return null;
    }

    try {
      const next = await getWorkspaceIdentity(accessToken);
      if (sessionIdentityRef.current !== requestIdentity) {
        return null;
      }
      setWorkspaceIdentity(next);
      if (next.user_profile.display_name) {
        setDisplayName(next.user_profile.display_name);
        localStorage.setItem("flare-user-name", next.user_profile.display_name);
      }
      return next;
    } catch (err) {
      if (sessionIdentityRef.current !== requestIdentity) {
        return null;
      }
      console.error("Erreur chargement identite:", err);
      setWorkspaceIdentity(null);
      return null;
    }
  }, [resolveAccessToken, user]);

  const loadSetupStatus = useCallback(async () => {
    const requestIdentity = sessionIdentityRef.current;
    const accessToken = await resolveAccessToken();
    if (!user || !accessToken) {
      setSetupStatus(null);
      return null;
    }

    try {
      const next = await getChatbotSetupStatus(accessToken);
      if (sessionIdentityRef.current !== requestIdentity) {
        return null;
      }
      setSetupStatus(next);
      if (next?.all_pages) {
        const nextPages = next.all_pages as unknown as import("@/lib/facebookMessenger").FacebookMessengerPage[];
        setFacebookPages(nextPages);
        setSelectedFacebookPageId((prev) =>
          resolvePreferredFacebookPageId(nextPages, prev, next.active_page_id)
        );
      } else {
        setFacebookPages([]);
        setSelectedFacebookPageId(null);
      }
      return next;
    } catch (err) {
      if (sessionIdentityRef.current !== requestIdentity) {
        return null;
      }
      console.error("Erreur chargement setup chatbot:", err);
      setSetupStatus(null);
      setFacebookPages([]);
      setSelectedFacebookPageId(null);
      return null;
    }
  }, [resolveAccessToken, user]);

  const loadActivationRequest = useCallback(async () => {
    const requestIdentity = sessionIdentityRef.current;
    const accessToken = await resolveAccessToken();
    if (!user || !accessToken) {
      setActivationRequest(null);
      return null;
    }

    try {
      const response = await getMyActivationRequest(accessToken);
      if (sessionIdentityRef.current !== requestIdentity) {
        return null;
      }
      const next = response.activation_request ?? null;
      setActivationRequest(next);
      return next;
    } catch (err) {
      if (sessionIdentityRef.current !== requestIdentity) {
        return null;
      }
      console.error("Erreur chargement demande activation:", err);
      setActivationRequest(null);
      return null;
    }
  }, [resolveAccessToken, user]);

  // Called by ChatbotParametresPage whenever the FB pages list changes (OAuth, activate, disconnect).
  // Keeps facebookPages in sync without needing a full setup-status reload.
  const handlePagesChanged = useCallback((pages: FacebookMessengerPage[]) => {
    setFacebookPages(pages);
    setSelectedFacebookPageId((prev) => resolvePreferredFacebookPageId(pages, prev));
  }, []);

  const handleStop = useCallback(() => {
    const lastUserMsg = messages.filter((m) => m.role === "user").at(-1);
    if (lastUserMsg?.content) setPendingRestore(lastUserMsg.content);
    if (lastSentAttachmentRef.current) setPendingRestoreAttachment(lastSentAttachmentRef.current);
    stop();
  }, [messages, stop]);

  useEffect(() => {
    refresh();
    healthCheck().then((ok) => setBackendOnline(ok));
    // Re-check backend status every 30s
    const healthInterval = setInterval(() => {
      healthCheck().then((ok) => setBackendOnline(ok));
    }, 30000);
    return () => clearInterval(healthInterval);
  }, [refresh]);

  // Synchronisation avec le backend (crÃ©ation plan/clÃ© GCP automatique pour les nouveaux)
  useEffect(() => {
    // Clear workspace/chatbot state immediately when the authenticated identity changes
    // so a new account never sees the previous account's state during reload.
    setWorkspaceIdentity(null);
    setSetupStatus(null);
    setActivationRequest(null);
    setFacebookPages([]);
    setSelectedFacebookPageId(null);
  }, [sessionIdentity]);

  useEffect(() => {
    if (!user) {
      return;
    }

    let cancelled = false;
    let pingInterval: ReturnType<typeof setInterval> | null = null;

    const pingServer = async () => {
      const accessToken = await resolveAccessToken();
      if (!accessToken || cancelled) return;
      fetch(`${getApiBaseUrl()}/api/users/ping`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
      }).catch(() => {});
    };

    const bootstrapSession = async () => {
      const accessToken = await resolveAccessToken(true);
      if (!accessToken || cancelled) return;

      syncUser(accessToken).catch((err) => console.error("Erreur sync user:", err));
      loadWorkspaceIdentity().catch(() => null);
      loadSetupStatus().catch(() => null);
      loadActivationRequest().catch(() => null);
      localStorage.setItem("flare-onboarding-v2.3.7-done", "1");

      await pingServer();
      pingInterval = setInterval(() => {
        void pingServer();
      }, 30000);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void pingServer();
      }
    };

    void bootstrapSession();
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      cancelled = true;
      if (pingInterval) clearInterval(pingInterval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [loadActivationRequest, loadSetupStatus, loadWorkspaceIdentity, resolveAccessToken, user]);

  useEffect(() => {
    if (!user) return;
    if (
      activeView === "chatbot" ||
      activeView === "chatbot-activation" ||
      activeView === "chatbot-parametres" ||
      activeView === "billing" ||
      activeView === "admin"
    ) {
      loadActivationRequest().catch(() => null);
    }
  }, [activeView, loadActivationRequest, user]);

  useEffect(() => {
    if (!user || user.emailVerified) return;

    if (typeof window !== "undefined" && user.email) {
      window.sessionStorage.setItem("flare_signup_verification_email", user.email);
    }
    setAuthMode("signup");
    setShowAuth(true);
    logout().catch((err) => console.error("Erreur lors de la dÃ©connexion utilisateur non vÃ©rifiÃ©:", err));
  }, [user, logout]);

  // Cleanup toast timer
  useEffect(() => () => { if (toastTimerRef.current) clearTimeout(toastTimerRef.current); }, []);

  const handleSelectConversation = useCallback(async (id: string) => {
    setNavStack(resolveDefaultNavStack("assistant"));
    await loadConversation(id);
  }, [loadConversation]);

  const handleNewChat = useCallback(() => {
    setNavStack(resolveDefaultNavStack("assistant"));
    newConversation();
  }, [newConversation]);

  const [initialPrompt, setInitialPrompt] = useState<string | null>(null);

  useEffect(() => {
    if (token && initialPrompt && activeView === "assistant") {
      // Small delay to ensure ChatWindow is ready
      setTimeout(() => {
        // Envoi automatique ou prÃ©-remplissage via un event ou state
        window.dispatchEvent(new CustomEvent('initial-prompt', { detail: initialPrompt }));
        setInitialPrompt(null);
      }, 500);
    }
  }, [token, initialPrompt, activeView]);

  const handleStart = useCallback((mode: "login" | "signup", prompt?: string) => {
    setAuthMode(mode);
    setShowAuth(true);
    if (prompt) setInitialPrompt(prompt);
  }, []);

  const resolvedUserDisplayName =
    workspaceIdentity?.user_profile.display_name ||
    displayName ||
    user?.displayName ||
    user?.email?.split("@")[0] ||
    "Utilisateur";
  const resolvedUserAvatarUrl = toRenderableMediaUrl(
    workspaceIdentity?.user_profile.avatar_url || user?.photoURL || undefined
  );
  const resolvedWorkspaceName =
    workspaceIdentity?.user_profile.workspace_name || "Mon compte";
  const resolvedBrandLogoUrl = toRenderableMediaUrl(
    workspaceIdentity?.user_profile.avatar_url || undefined
  );
  const canAccessAdmin = Boolean(user?.email && ADMIN_EMAILS.includes(user.email.toLowerCase()));
  const selectedFacebookPage =
    selectedFacebookPageId
      ? facebookPages.find((page) => page.page_id === selectedFacebookPageId) ?? null
      : null;
  const guideAssistantEnabled = workspaceIdentity?.user_profile?.guide_assistant_enabled ?? true;
  const guideContext = useMemo<GuideContext>(
    () => ({
      hasSelectedFacebookPage: Boolean(selectedFacebookPageId),
      hasConnectedFacebookPage: facebookPages.length > 0,
      isBotActive: Boolean(selectedFacebookPage?.is_active || setupStatus?.has_connected_page),
      setupStep: setupStatus?.step ?? null,
      activationStatus: activationRequest?.status ?? null,
      paymentStatus: activationRequest?.payment_status ?? null,
      flarePageAdminConfirmed: activationRequest?.flare_page_admin_confirmed === "true",
    }),
    [
      activationRequest?.flare_page_admin_confirmed,
      activationRequest?.payment_status,
      activationRequest?.status,
      facebookPages.length,
      selectedFacebookPage?.is_active,
      selectedFacebookPageId,
      setupStatus?.has_connected_page,
      setupStatus?.step,
    ]
  );
  const guideBottomClassName =
    activeView === "assistant" || activeView === "chat"
      ? "bottom-[168px] md:bottom-8"
      : showInstallBanner
        ? "bottom-24 md:bottom-28"
        : "bottom-4 md:bottom-6";
  const guideVisible =
    !sidebarOpen &&
    !isSettingsModalOpen &&
    !isReportModalOpen &&
    !(activeView === "assistant" && showFilesPanel) &&
    !activeArtifact;

  const openActivationFlow = useCallback((planId: ActivationPlanId) => {
    rememberActivationPlan(planId);
    onPush("chatbot-activation");
  }, [onPush]);

  const handleWorkspaceIdentitySaved = useCallback(
    (next: WorkspaceIdentity) => {
      setWorkspaceIdentity(next);
      if (next.user_profile.display_name) {
        setDisplayName(next.user_profile.display_name);
        localStorage.setItem("flare-user-name", next.user_profile.display_name);
      }
    },
    []
  );

  const logoutWithScopeReset = useCallback(async () => {
    await logout();
  }, [logout]);

  const requestAuth = useCallback(
    (mode: "login" | "signup" = "login") => {
      handleStart(mode);
    },
    [handleStart]
  );

  const navigateWithAccess = useCallback(
    (view: AppView | string) => {
      // Map legacy views to new nav levels
      if (view === "dashboard") view = "home";
      if (view === "chat") view = "assistant";

      if (!user && GUEST_LOCKED_VIEWS.includes(view as ActiveView)) {
        requestAuth("login");
        return;
      }
      if ((view as AppView) === "admin" && !canAccessAdmin) {
        pushAppNotice("Cette vue est reservee a l'equipe FLARE.");
        return;
      }
      setNavStack(resolveDefaultNavStack(view as AppView));
    },
    [canAccessAdmin, pushAppNotice, requestAuth, user]
  );

  const handleGuideNavigate = useCallback(
    (target: string) => {
      navigateWithAccess(target as AppView);
      setSidebarOpen(false);
    },
    [navigateWithAccess]
  );

  const openMessengerConversation = useCallback(
    (psid: string) => {
      setSelectedMessengerConversationId(psid);
      navigateWithAccess("conversations");
    },
    [navigateWithAccess]
  );

  const openAssistantWithAccess = useCallback(() => {
    if (!user) {
      requestAuth("login");
      return;
    }
    handleNewChat();
  }, [user, requestAuth, handleNewChat]);

  const openSettingsWithAccess = useCallback(() => {
    if (!user) {
      requestAuth("login");
      return;
    }
    setIsSettingsModalOpen(true);
    setSidebarOpen(false);
  }, [user, requestAuth]);

  const selectConversationWithAccess = useCallback(
    async (id: string) => {
      if (!user) {
        requestAuth("login");
        return;
      }
      await handleSelectConversation(id);
    },
    [user, requestAuth, handleSelectConversation]
  );

  useEffect(() => {
    if (!user && GUEST_LOCKED_VIEWS.includes(activeView as ActiveView)) {
      setNavStack(resolveDefaultNavStack("home"));
    }
  }, [activeView, user]);

  const handleHeaderBack = useCallback(() => {
    if (hasHistoryBack) {
      onPop();
      return;
    }

    const fallbackTarget = resolveFallbackBackTarget(activeView);
    setNavStack(resolveDefaultNavStack(fallbackTarget));
  }, [activeView, hasHistoryBack, onPop]);


  // ── Landing page publique, connexion, puis application ──
  if (!user && !showAuth && authLoading) {
    return (
      <div style={{
          position: 'fixed',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#fbf7f0', // Flare Light Background
          zIndex: 9999
      }}>
        {/* Expanding Cosmic Rings */}
        <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: [0.8, 1.2, 1.5], opacity: [0, 0.5, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
            style={{
                position: 'absolute',
                width: '300px',
                height: '300px',
                border: '1px solid rgba(249, 115, 22, 0.2)',
                borderRadius: '50%'
            }}
        />
        <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: [0.5, 1, 1.3], opacity: [0, 0.3, 0] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: "easeOut", delay: 0.5 }}
            style={{
                position: 'absolute',
                width: '300px',
                height: '300px',
                border: '1px solid rgba(0, 0, 0, 0.05)',
                borderRadius: '50%'
            }}
        />

        <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1 }}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '32px', position: 'relative', zIndex: 10 }}
        >
          <motion.div 
            animate={{ 
                rotate: [0, 5, -5, 0],
                boxShadow: ["0 0 20px rgba(249,115,22,0)", "0 0 40px rgba(249,115,22,0.2)", "0 0 20px rgba(249,115,22,0)"]
            }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            style={{
                display: 'flex',
                height: '80px',
                width: '80px',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '28px',
                backgroundColor: '#ffffff',
                border: '1px solid rgba(0,0,0,0.05)',
                boxShadow: '0 20px 40px rgba(0,0,0,0.05)'
            }}
          >
            <FlareMark tone="auto" className="w-10" priority />
          </motion.div>
          
          <div style={{ textAlign: 'center' }}>
            <motion.p 
                initial={{ opacity: 0, letterSpacing: '0.1em' }}
                animate={{ opacity: 1, letterSpacing: '0.5em' }}
                transition={{ duration: 1.5, ease: "easeOut" }}
                style={{ margin: 0, fontSize: '18px', fontWeight: 900, textTransform: 'uppercase', color: '#000000' }}
            >
                FLARE AI
            </motion.p>
            <motion.div 
                animate={{ opacity: [0.3, 0.6, 0.3] }}
                transition={{ duration: 2, repeat: Infinity }}
                style={{ marginTop: '12px', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: '#f97316', letterSpacing: '0.1em' }}
            >
                Initialisation du module organisationnel...
            </motion.div>
          </div>
        </motion.div>
      </div>
    );
  }

  if (!user && showAuth) {
    return (
      <LoginScreen
        onLogin={login}
        onLoginWithPassword={loginWithPassword}
        onSignUpWithPassword={signUpWithPassword}
        onLoginWithGoogle={loginWithGoogle}
        onResetPassword={resetPassword}
        onSendPin={sendSignupPin}
        onVerifyPin={verifySignupPin}
        loading={authLoading}
        error={authError}
        initialMode={authMode}
        onBack={() => setShowAuth(false)}
      />
    );
  }

  if (!user) {
    // Redirect unauthenticated users back to the landing page
    // The landing page handles login/signup modals
    if (typeof window !== "undefined") {
      window.location.replace("/");
    }
    return null;
  }

  const viewTitleMap: Partial<Record<AppView, string>> = {
    home: "Accueil",
    automations: "Automatisations",
    facebook: "Facebook",
    google: "Google",
    assistant: "Assistant IA",
    guide: "Guide",
    billing: "Abonnements",
    contact: "Contact",
    settings: "Parametres",
    "chatbot-personnalisation": "Personnalisation",
    "chatbot-parametres": "Parametres",
    "chatbot-dashboard": "Tableau de bord",
    "chatbot-clients": "Clients",
    "chatbot-client-detail": "Client",
    chat: activeConvTitle || "Assistant IA",
    memory: "Memoire de l'agent",
    dashboard: "Accueil",
    prospection: "Prospection",
    content: "Studio contenu",
    followup: "CRM & suivi",
    agents: "Agents FLARE",
    prompts: "Prompts",
    knowledge: "Base de Connaissances",
    files: "Fichiers partages",
    admin: "Controle Administrateur",
  };
  const viewTitle = viewTitleMap[activeView];
  const breadcrumbStack = navStack.filter((view): view is NavLevel => view in NAV_LABELS);

  const resolvedViewTitleMap: Partial<Record<AppView, string>> = {
    home: "Accueil",
    automations: "Automatisations",
    facebook: "Facebook",
    google: "Google",
    assistant: "Assistant IA",
    guide: "Guide",
    billing: "Abonnements",
    contact: "Contact",
    settings: "Parametres",
    "chatbot-personnalisation": "Personnalisation",
    "chatbot-parametres": "Parametres",
    "chatbot-dashboard": "Tableau de bord",
    "chatbot-clients": "Clients",
    "chatbot-client-detail": "Client",
    chat: activeConvTitle || "Assistant IA",
    dashboard: "Accueil",
    chatbot: "Facebook",
    leads: "Clients chauds Facebook",
    conversations: "Discussions Facebook",
    expenses: "Budget Facebook",
    chatbotFiles: "Fichiers Facebook",
    automationHub: "Automatisations",
    prospection: "Prospection automatique",
    content: "Studio contenu",
    followup: "CRM & suivi clients",
    agents: "Agents FLARE",
  };
  const resolvedViewTitle = resolvedViewTitleMap[activeView] ?? viewTitle;

  const resolvedViewSubtitleMap: Partial<Record<AppView, string>> = {
    home: "Votre compte FLARE actif",
    automations: "Modules disponibles et verrouilles",
    facebook: "Connexion et statut Facebook",
    google: "Connexion Google",
    assistant: sessionId ? "Conversation assistant active" : "Assistant d'ecriture disponible",
    guide: "Reperes rapides pour demarrer",
    billing: "Offre et modules actifs",
    contact: "Besoin d'aide ou de support",
    settings: "Reglages du compte",
    "chatbot-personnalisation": "Identite, ton et entreprise pour Facebook",
    "chatbot-parametres": "Pages Facebook, catalogue et options",
    "chatbot-dashboard": "Stats et verification Facebook",
    "chatbot-clients": "Conversations et leads Facebook",
    "chatbot-client-detail": "Details du contact",
    chat: sessionId ? "Conversation assistant active" : "Assistant d'ecriture disponible",
    dashboard: "Choisissez un agent ou une automatisation",
    chatbot: "Clients a suivre, messages et depenses Facebook",
    leads: "Les clients a traiter en premier",
    conversations: "Les messages a lire et les reponses a envoyer",
    expenses: "Ce que Facebook coute et ce qu'il rapporte",
    chatbotFiles: "Catalogues, portfolio et documents Facebook",
    automationHub: "Ce que vous pouvez deja utiliser et ce qui reste bloque",
    prospection: "Page bloquee tant que l'offre ne le permet pas",
    content: "Page bloquee, sans faux bouton",
    followup: "Page bloquee, distincte des automatisations Facebook",
    agents: "Agents bloques tant qu'ils ne sont pas vraiment utiles",
  };
  const resolvedViewSubtitle = resolvedViewSubtitleMap[activeView] ?? "";

  const viewSubtitleMap: Partial<Record<AppView, string>> = {
    assistant: sessionId ? `Session active` : "Pret a vous aider",
    chat: sessionId ? `Session active` : "Pret a vous aider",
    home: "Vue d'ensemble",
    guide: "Guide rapide",
    billing: "Abonnement et modules",
    contact: "Contacter FLARE",
    settings: "Preferences et securite",
    memory: "Informations memorisees contextuelles",
    dashboard: "Vue d'ensemble",
    prospection: "Page bloquee pour le moment",
    content: "Studio bloque",
    followup: "Suivi client bloque",
    agents: "Agents FLARE bloques",
    prompts: "Bibliotheque de prompts prets a l'emploi",
    knowledge: "Documents de reference injectes au contexte",
    files: "Historique de tous les fichiers envoyes dans le chat",
    admin: "Surveillance de la consommation et des couts",
  };
  const viewSubtitle = viewSubtitleMap[activeView];
  const sidebarActiveView: NavLevel =
    activeView === "assistant" || activeView === "chat"
      ? "assistant"
      : activeView === "dashboard" ||
          activeView === "leads" ||
          activeView === "conversations" ||
          activeView === "expenses" ||
          activeView === "chatbotFiles" ||
          activeView === "facebook" ||
          activeView === "google" ||
          activeView === "chatbot" ||
          activeView === "chatbot-personnalisation" ||
          activeView === "chatbot-parametres" ||
          activeView === "chatbot-dashboard" ||
          activeView === "chatbot-clients" ||
          activeView === "chatbot-client-detail" ||
          activeView === "chatbot-orders" ||
          activeView === "chatbot-activation"
        ? "automations"
        : activeView === "automationHub" ||
          activeView === "prospection" ||
          activeView === "content" ||
          activeView === "followup" ||
          activeView === "agents" ||
          activeView === "automations"
        ? "automations"
        : (activeView as NavLevel);

  // Variables supprimÃ©es â€” la navigation assistant est maintenant dans la sidebar uniquement

  return (
    <>
      <div className={`h-[100dvh] w-full flex flex-row bg-[var(--background)] overflow-hidden font-sans selection:bg-[rgba(28,60,168,0.16)] selection:text-[var(--text-primary)] relative z-0 transition-all duration-500 ${isSettingsModalOpen ? 'blur-sm scale-[0.995]' : ''}`}>
          {/* Background futuriste sobre */}
          <div className="absolute inset-0 bg-[var(--background)] -z-20"></div>

          {/* Toast â€” Base de connaissances mise Ã  jour */}
          {appNotice && (
            <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 flex w-[calc(100vw-24px)] max-w-[460px] items-center gap-3 rounded-2xl border px-4 py-3 shadow-[var(--shadow-card)] animate-msg-pop md:w-auto ${
              appNotice.tone === "error"
                ? "border-red-500/20 bg-[var(--surface-base)] text-red-300"
                : "border-[var(--border-default)] bg-[var(--surface-base)] text-[var(--text-primary)]"
            }`}>
              <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${
                appNotice.tone === "error" ? "bg-red-500/12 text-red-300" : "bg-[var(--surface-subtle)] text-[var(--text-primary)]"
              }`}>
                <AlertCircle size={15} />
              </div>
              <p className="min-w-0 flex-1 text-[13px] leading-relaxed">{appNotice.message}</p>
              <button
                onClick={() => setAppNotice(null)}
                className="shrink-0 rounded-lg p-1.5 text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]"
              >
                <X size={13} />
              </button>
            </div>
          )}

          {knowledgeToast && (
            <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 md:px-5 py-3 rounded-2xl bg-[var(--surface-base)] border border-[var(--border-default)] shadow-[var(--shadow-card)] animate-msg-pop w-[calc(100vw-24px)] max-w-[420px] md:w-auto">
              <div className="w-8 h-8 rounded-xl bg-[var(--surface-subtle)] flex items-center justify-center shrink-0 border border-[var(--border-default)]">
                <BookOpen size={15} className="text-[var(--text-muted)]" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-medium text-[var(--text-muted)] uppercase tracking-widest mb-0.5">Base de connaissances</p>
                <p className="text-[13px] text-[var(--text-primary)] font-light truncate max-w-[320px]">
                  {knowledgeToast.length === 1
                    ? `"${knowledgeToast[0]}" sauvegardÃ©`
                    : `${knowledgeToast.length} documents sauvegardÃ©s`}
                </p>
              </div>
              <button
                onClick={() => setKnowledgeToast(null)}
                className="ml-2 p-1.5 rounded-lg text-navy-400 hover:text-[var(--text-primary)] hover:bg-[var(--surface-raised)] transition-colors shrink-0"
              >
                <X size={13} />
              </button>
            </div>
          )}

        {/* PWA Install Banner */}
        {showInstallBanner && deferredPrompt && (
          <div className="fixed bottom-4 md:bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 md:gap-4 px-4 md:px-6 py-4 rounded-2xl bg-[var(--surface-base)] border border-[var(--border-default)] shadow-[var(--shadow-card)] animate-msg-pop max-w-md w-[calc(100vw-24px)] md:w-[90vw]">
            <div className="w-10 h-10 rounded-xl bg-[var(--surface-subtle)] flex items-center justify-center shrink-0 border border-[var(--border-default)]">
              <Download size={18} className="text-[var(--text-muted)]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-medium text-[var(--text-primary)]">Installer FLARE AI</p>
              <p className="text-[11px] text-[var(--text-muted)] mt-0.5">Acces rapide depuis votre ecran d&apos;accueil</p>
            </div>
            <button
              onClick={async () => {
                deferredPrompt.prompt();
                await deferredPrompt.userChoice;
                setDeferredPrompt(null);
                setShowInstallBanner(false);
              }}
              className="px-4 py-2 rounded-xl bg-[var(--text-primary)] hover:opacity-90 text-[rgb(var(--background))] text-[12px] font-bold tracking-wide transition-all shrink-0"
            >
              Installer
            </button>
            <button
              onClick={() => { setShowInstallBanner(false); localStorage.setItem("flare-install-dismissed", "1"); }}
              className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors shrink-0"
            >
              <X size={14} />
            </button>
          </div>
        )}


        {/* Sidebar */}
        <NewSidebar
          activeView={activeView as NavLevel}
          onNavigate={(v) => { navigateWithAccess(v); setSidebarOpen(false); }}
          onNavigateHome={() => { navigateWithAccess("home"); setSidebarOpen(false); }}
          onOpenReport={() => setIsReportModalOpen(true)}
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          user={user}
          token={token}
          onLogout={logoutWithScopeReset}
          displayName={resolvedUserDisplayName}
          avatarUrl={resolvedUserAvatarUrl}
          brandName="FLARE AI"
          logoUrl={resolvedBrandLogoUrl}
          lang={lang}
          userEmail={user?.email ?? null}
        />

        <SignalementModal
          open={isReportModalOpen}
          token={token}
          currentView={activeView}
          currentViewLabel={resolvedViewTitle ?? "Ecran actuel"}
          getFreshToken={getFreshToken}
          onClose={() => setIsReportModalOpen(false)}
        />

      {/* Zone principale 3D Glass */}
      <main
        className={`relative z-10 flex min-w-0 flex-1 flex-col bg-transparent transition-[filter,opacity] duration-200 md:transition-none ${
          sidebarOpen ? "pointer-events-none blur-[3px] opacity-70 md:pointer-events-auto md:blur-0 md:opacity-100" : ""
        }`}
      >
        {/* Header Gemini Type */}
        <div className="z-20 flex w-full items-center justify-between gap-3 border-b border-[var(--border-default)] bg-[var(--surface-base)] px-3 py-2 md:px-5">
          <div className="flex items-center gap-2 md:gap-4 min-w-0">
             <button
               id="tour-sidebar"
               onClick={() => setSidebarOpen(true)}
               className="md:hidden p-2 rounded-xl text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-all active-press"
               title="Menu"
             >
               <Menu size={20} strokeWidth={1.5} />
             </button>
             {activeView === "dashboard" ? (
               <span className="font-[family-name:var(--font-outfit)] text-[16px] md:text-[18px] font-bold tracking-tight text-[var(--text-primary)] hidden md:block">
                 Accueil
               </span>
             ) : null}
              {showStandaloneBack && (
                <button
                  onClick={handleHeaderBack}
                  aria-label="Retour"
                  className="inline-flex items-center gap-1 rounded-xl border border-[var(--border-default)] bg-[var(--surface-subtle)] px-2.5 py-1.5 text-[var(--text-secondary)] transition-all hover:text-[var(--text-primary)] hover:bg-[var(--surface-raised)]"
                >
                  <ArrowLeft size={15} />
                  <span className="hidden text-xs font-medium sm:inline">Retour</span>
                </button>
              )}
               {breadcrumbStack.length > 1 && (
                 <div className="flex-1 min-w-0">
                  <NavBreadcrumb navStack={breadcrumbStack} onPop={onPop} />
                 </div>
               )}
              {activeView !== "home" && (
                <div className="flex min-w-0 flex-col items-start">
                  <span className="truncate text-[15px] md:text-[18px] font-medium text-[var(--text-primary)] tracking-wide font-sans">{resolvedViewTitle}</span>
                </div>
              )}
          </div>


          {/* Droite : Actions SystÃ¨me & Account */}
          <div className="flex items-center justify-end gap-1.5 md:gap-6">
             {/* Indicateur Online/Offline */}
             <div className="flex items-center gap-2 rounded-full border border-[var(--border-default)] bg-[var(--surface-subtle)] px-3 py-1.5">
                <div className={`h-2 w-2 rounded-full ${backendOnline === null ? 'bg-orange-500 animate-pulse' : backendOnline ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.35)]' : 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.28)]'}`} />
                <span className={`text-[9px] font-bold tracking-[0.1em] uppercase ${backendOnline === null ? 'text-orange-500' : backendOnline ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                   {backendOnline === null ? '...' : backendOnline ? 'Online' : 'Offline'}
                </span>
             </div>

              <div className={`flex items-center gap-1.5 md:gap-3 ${activeView !== "home" ? "md:border-l md:border-[var(--border-muted)] md:pl-4" : ""}`}>
                 {/* Org switcher */}
                 <div className="flex items-center gap-2">
                 {user ? (
                   <ThemeToggle
                     theme={theme}
                     onToggle={handleThemeToggle}
                     className="inline-flex"
                     compact
                   />
                 ) : null}
                 {user ? (
                   <div className="flex items-center gap-2 rounded-xl border border-[var(--border-default)] bg-[var(--surface-subtle)] px-2.5 py-2 text-left md:gap-3 md:px-3">
                     <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl border border-[var(--border-default)] bg-[var(--surface-raised)]">
                       {resolvedUserAvatarUrl ? (
                         <img src={resolvedUserAvatarUrl} alt={resolvedUserDisplayName} className="h-full w-full object-cover" />
                       ) : (
                         <span className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-primary)]">
                           {resolvedUserDisplayName.slice(0, 1)}
                         </span>
                       )}
                     </div>
                     <div className={`min-w-0 ${activeView === "home" ? "" : "max-w-[120px] md:max-w-[160px]"}`}>
                       <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--text-muted)]">Compte</p>
                       <p className="mt-1 truncate text-sm font-medium text-[var(--text-primary)]">
                         {resolvedWorkspaceName}
                       </p>
                     </div>
                   </div>
                 ) : null}
                 {!user && (
                   <>
                     <button onClick={() => handleStart("login")} className="ui-btn ui-btn-secondary !min-h-0 !px-3 !py-2 text-xs">
                       Se connecter
                     </button>
                     <button onClick={() => handleStart("signup")} className="ui-btn ui-btn-primary !min-h-0 !px-3 !py-2 text-xs">
                       CrÃ©er un compte
                     </button>
                   </>
                 )}
                 </div>
               </div>
          </div>
        </div>

        {/* Contenu central */}
        <AnimatePresence mode="wait">

        {activeView === "home" ? (
          <motion.div key="home" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="flex-1 flex flex-col overflow-hidden"><HomePage onPush={onPush} displayName={resolvedUserDisplayName} token={token} /></motion.div>
        ) : activeView === "automations" ? (
          <motion.div key="automations" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="flex-1 flex flex-col overflow-hidden"><AutomationsPage onPush={onPush} /></motion.div>
        ) : activeView === "facebook" ? (
          <motion.div key="facebook" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="flex-1 flex flex-col overflow-hidden"><FacebookPage onPush={onPush} /></motion.div>
        ) : activeView === "google" ? (
          <motion.div key="google" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="flex-1 flex flex-col overflow-hidden"><GooglePage /></motion.div>
        ) : activeView === "chatbot" ? (
          <motion.div key="chatbot" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="flex-1 flex flex-col overflow-hidden"><ChatbotHomePage
              onPush={onPush}
              token={token}
              getFreshToken={getFreshToken}
              pages={facebookPages}
              selectedPageId={selectedFacebookPageId}
              onSelectPage={setSelectedFacebookPageId}
              onPagesChanged={handlePagesChanged}
              setupStatus={setupStatus}
              onRefreshSetupStatus={loadSetupStatus}
            /></motion.div>
        ) : activeView === "chatbot-personnalisation" ? (
          <motion.div key="chatbot-personnalisation" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="flex-1 flex flex-col overflow-hidden"><ChatbotPersonnalisationPage
            token={token}
            getFreshToken={getFreshToken}
            onPush={onPush}
            selectedPageId={selectedFacebookPageId}
            selectedPageName={
              selectedFacebookPageId
                ? facebookPages.find((p) => p.page_id === selectedFacebookPageId)?.page_name ?? null
                : null
            }
          /></motion.div>
        ) : activeView === "chatbot-parametres" ? (
          <motion.div key="chatbot-parametres" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="flex-1 flex flex-col overflow-hidden"><ChatbotParametresPage token={token} getFreshToken={getFreshToken} selectedPageId={selectedFacebookPageId} onSelectPage={setSelectedFacebookPageId} onPagesChanged={handlePagesChanged} /></motion.div>
        ) : activeView === "chatbot-dashboard" ? (
           <motion.div key="chatbot-dashboard" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="flex-1 flex flex-col overflow-hidden"><ChatbotDashboardPage token={token} getFreshToken={getFreshToken} selectedPageId={selectedFacebookPageId} onPush={onPush} onSelectContact={setSelectedMessengerConversationId} /></motion.div>
        ) : activeView === "chatbot-clients" ? (
           <motion.div key="chatbot-clients" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="flex-1 flex flex-col overflow-hidden"><ChatbotClientsPage token={token} getFreshToken={getFreshToken} onPush={onPush} onSelectContact={setSelectedMessengerConversationId} selectedPageId={selectedFacebookPageId} /></motion.div>
        ) : activeView === "chatbot-client-detail" ? (
           <motion.div key="chatbot-client-detail" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="flex-1 flex flex-col overflow-hidden"><ChatbotClientDetailPage token={token} getFreshToken={getFreshToken} contactId={selectedMessengerConversationId} selectedPageId={selectedFacebookPageId} /></motion.div>
        ) : activeView === "chatbot-orders" ? (
           <motion.div key="chatbot-orders" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="flex-1 flex flex-col overflow-hidden"><ChatbotOrdersPage token={token} getFreshToken={getFreshToken} onPush={onPush} selectedPageId={selectedFacebookPageId} /></motion.div>
        ) : activeView === "chatbot-activation" ? (
           <motion.div key="chatbot-activation" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="flex-1 flex flex-col overflow-hidden"><ChatbotActivationPage token={token} getFreshToken={getFreshToken} onPush={onPush} availablePages={facebookPages} selectedPageId={selectedFacebookPageId} /></motion.div>
        ) : activeView === "settings" ? (
           <motion.div key="settings" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="flex-1 flex flex-col overflow-hidden"><SettingsPage token={token} getFreshToken={getFreshToken} workspaceIdentity={workspaceIdentity} user={user} displayName={resolvedUserDisplayName} avatarUrl={resolvedUserAvatarUrl} theme={theme} onLogout={logoutWithScopeReset} onIdentitySaved={setWorkspaceIdentity} lang={lang} onLangChange={handleLangChange} /></motion.div>
        ) : activeView === "billing" ? (
           <motion.div key="billing" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="flex-1 flex flex-col overflow-hidden"><BillingPage token={token} getFreshToken={getFreshToken} onPush={onPush} /></motion.div>
        ) : activeView === "guide" ? (
           <motion.div key="guide" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="flex-1 flex flex-col overflow-hidden"><GuidePage /></motion.div>
        ) : activeView === "contact" ? (
           <motion.div key="contact" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="flex-1 flex flex-col overflow-hidden"><ContactPage /></motion.div>
        ) : activeView === "assistant" || activeView === "chat" ? (
          <motion.div key="assistant" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="flex flex-1 overflow-hidden relative">
            <AssistantPage
              token={token}
              sessionId={sessionId ?? null}
              activeConvTitle={activeConvTitle}
              messages={messages}
              isLoading={isLoading}
              isFetchingHistory={isFetchingHistory}
              thought={thought ?? null}
              thoughts={thoughts}
              error={error ? String(error) : null}
              userName={displayName || user?.email?.split('@')[0] || ""}
              chatMode={chatMode as any}
              setChatMode={(m) => setChatMode(m as any)}
              send={handleSend as any}
              stop={handleStop}
              deleteMessagesAfterPoint={deleteMessagesAfterPoint as any}
              showFilesPanel={showFilesPanel}
              setShowFilesPanel={setShowFilesPanel}
              activeArtifact={activeArtifact}
              setActiveArtifact={setActiveArtifact}
              activeArtifactVersions={activeArtifactVersions}
              onKnowledgeSaved={handleKnowledgeSaved}
              conversations={conversations}
              folders={folders}
              onSelectConversation={handleSelectConversation}
              onNewChat={handleNewChat}
            />
          </motion.div>
        ) : 
        activeView === "memory" ? (
          <motion.div key="memory" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="flex-1 flex flex-col overflow-hidden"><MemoryPanel token={token} /></motion.div>
        ) : activeView === "dashboard" ? (
          <motion.div key={setupStatus && setupStatus.step !== "complete" ? "dashboard-setup" : "dashboard"} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="flex-1 flex flex-col overflow-hidden">
            {setupStatus && setupStatus.step !== "complete" ? (
              <ChatbotSetupWizard
                setupStatus={setupStatus}
                token={token}
                getFreshToken={getFreshToken}
                onComplete={async () => {
                  await loadSetupStatus().catch(() => null);
                }}
                onSkip={() => {
                  setNavStack(resolveDefaultNavStack("chatbot"));
                }}
                onRefreshSetupStatus={loadSetupStatus}
              />
            ) : (
              <DashboardPanel onNavigate={(v) => navigateWithAccess(v as ActiveView)} workspaceName={resolvedWorkspaceName} brandLogoUrl={resolvedBrandLogoUrl} userDisplayName={resolvedUserDisplayName} userAvatarUrl={resolvedUserAvatarUrl} token={token} />
            )}
          </motion.div>
        ) : activeView === "leads" ? (
          <motion.div key="leads" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="flex-1 flex flex-col overflow-hidden"><MessengerWorkspace initialTab="leads" initialConversationId={selectedMessengerConversationId} onOpenAssistant={openAssistantWithAccess} onNavigate={(view) => navigateWithAccess(view as ActiveView)} onOpenConversation={openMessengerConversation} onRequestAccess={() => requestAuth("login")} authToken={token} selectedPageId={selectedFacebookPageId} /></motion.div>
        ) : activeView === "conversations" ? (
          <motion.div key="conversations" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="flex-1 flex flex-col overflow-hidden"><MessengerWorkspace initialTab="conversations" initialConversationId={selectedMessengerConversationId} onOpenAssistant={openAssistantWithAccess} onNavigate={(view) => navigateWithAccess(view as ActiveView)} onOpenConversation={openMessengerConversation} onRequestAccess={() => requestAuth("login")} authToken={token} selectedPageId={selectedFacebookPageId} /></motion.div>
        ) : activeView === "expenses" ? (
          <motion.div key="expenses" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="flex-1 flex flex-col overflow-hidden"><MessengerWorkspace initialTab="expenses" initialConversationId={selectedMessengerConversationId} onOpenAssistant={openAssistantWithAccess} onNavigate={(view) => navigateWithAccess(view as ActiveView)} onOpenConversation={openMessengerConversation} onRequestAccess={() => requestAuth("login")} authToken={token} selectedPageId={selectedFacebookPageId} /></motion.div>
        ) : activeView === "chatbotFiles" ? (
          <motion.div key="chatbotFiles" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="flex-1 flex flex-col overflow-hidden"><ChatbotWorkspace token={token} getFreshToken={getFreshToken} initialTab="content" onRequestAccess={() => requestAuth("login")} onRequestUpgrade={openSettingsWithAccess} /></motion.div>
        ) : activeView === "automationHub" ? (
          <motion.div key="automationHub" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="flex-1 flex flex-col overflow-hidden"><AutomationHubPanel onNavigate={(v) => navigateWithAccess(v as ActiveView)} token={token} /></motion.div>
        ) : activeView === "prospection" ? (
          <motion.div key="prospection" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="flex-1 flex flex-col overflow-hidden"><LockedModulePanel {...LOCKED_MODULES.prospection} onNavigate={(v) => navigateWithAccess(v as ActiveView)} onRequestUpgrade={openSettingsWithAccess} requestLabel={user ? "Voir mon offre" : "Ouvrir ma session"} /></motion.div>
        ) : activeView === "content" ? (
          <motion.div key="content" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="flex-1 flex flex-col overflow-hidden"><LockedModulePanel {...LOCKED_MODULES.content} onNavigate={(v) => navigateWithAccess(v as ActiveView)} onRequestUpgrade={openSettingsWithAccess} requestLabel={user ? "Voir mon offre" : "Ouvrir ma session"} /></motion.div>
        ) : activeView === "followup" ? (
          <motion.div key="followup" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="flex-1 flex flex-col overflow-hidden"><LockedModulePanel {...LOCKED_MODULES.followup} onNavigate={(v) => navigateWithAccess(v as ActiveView)} onRequestUpgrade={openSettingsWithAccess} requestLabel={user ? "Voir mon offre" : "Ouvrir ma session"} /></motion.div>
        ) : activeView === "agents" ? (
          <motion.div key="agents" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="flex-1 flex flex-col overflow-hidden"><LockedModulePanel {...LOCKED_MODULES.agents} onNavigate={(v) => navigateWithAccess(v as ActiveView)} onRequestUpgrade={openSettingsWithAccess} requestLabel={user ? "Voir mon offre" : "Ouvrir ma session"} /></motion.div>
        ) : activeView === "prompts" ? (
          <motion.div key="prompts" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="flex-1 flex flex-col overflow-hidden"><PromptsPanel token={token} /></motion.div>
        ) : activeView === "knowledge" ? (
          <motion.div key="knowledge" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="flex-1 flex flex-col overflow-hidden"><KnowledgePanel token={token} refreshToken={knowledgeRefreshToken} /></motion.div>
        ) : activeView === "files" ? (
          <motion.div key="files" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="flex-1 flex flex-col overflow-hidden">
            <FilesPanel token={token} onOpenArtifact={(artifact) => setActiveArtifact(artifact)} />
          </motion.div>
        ) : activeView === "admin" ? (
          <motion.div key="admin" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="flex-1 flex flex-col overflow-hidden">
            <AdminPanel token={token} />
          </motion.div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-[var(--text-secondary)]">
            Vue introuvable
          </div>
        )}
        </AnimatePresence>
      </main>

      <FloatingContextualGuide
        enabled={guideAssistantEnabled}
        visible={guideVisible}
        activeView={activeView}
        context={guideContext}
        onNavigate={handleGuideNavigate}
        canAccessAdmin={canAccessAdmin}
        bottomClassName={guideBottomClassName}
      />
    </div>


      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        token={token}
        theme={theme}
        workspaceIdentity={workspaceIdentity}
        userEmail={user?.email || ""}
        fallbackDisplayName={resolvedUserDisplayName}
        fallbackPhotoUrl={user?.photoURL || ""}
        onOpenActivationFlow={openActivationFlow}
        onIdentitySaved={handleWorkspaceIdentitySaved}
        onStartTour={() => {}}
      />

    </>
  );
}







