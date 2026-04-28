"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Bot,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  ContactRound,
  CreditCard,
  Crown,
  FileBarChart2,
  FolderOpen,
  Home,
  Inbox,
  LayoutDashboard,
  LogOut,
  Mail,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Users,
  Workflow,
  X,
  Lock,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { User } from "firebase/auth";
import FlareMark from "@/components/FlareMark";
import { GmailIcon } from "@/components/icons/GmailIcon";
import { GoogleCalendarIcon } from "@/components/icons/GoogleCalendarIcon";
import { GoogleContactsIcon } from "@/components/icons/GoogleContactsIcon";
import { GoogleDriveIcon } from "@/components/icons/GoogleDriveIcon";
import { MessengerIcon } from "@/components/icons/MessengerIcon";
import { StripeIcon } from "@/components/icons/StripeIcon";
import { FirebaseIcon } from "@/components/icons/FirebaseIcon";
import { ColorfulHomeIcon, ColorfulDashboardIcon } from "@/components/icons/GeneralIcons";
import { ColorfulCrownIcon, ColorfulBriefcaseIcon, ColorfulBuildingIcon } from "@/components/icons/WorkspaceIcons";
import type { NavLevel } from "@/components/NavBreadcrumb";
import {
  emitWorkspaceChange,
  FLARE_MODULE_PREFS_STORAGE_KEY,
  FLARE_WORKSPACE_EVENT,
  FLARE_WORKSPACE_STORAGE_KEY,
  type FlareWorkspaceId,
} from "@/lib/workspacePreferences";

interface NewSidebarProps {
  activeView: NavLevel;
  onNavigate: (level: NavLevel) => void;
  onNavigateHome?: () => void;
  onOpenReport?: () => void;
  user?: User | null;
  onLogout?: () => void;
  displayName?: string;
  avatarUrl?: string;
  logoUrl?: string;
  brandName?: string;
  open?: boolean;
  onClose?: () => void;
  lang?: "fr" | "en";
  token?: string | null;
  canAccessAdmin?: boolean;
}

type SidebarItem = {
  id: string;
  target: NavLevel;
  labelFr: string;
  labelEn: string;
  icon: React.ElementType;
  moduleKey?: string;
  locked?: boolean;
};

const WORKSPACES: Record<
  FlareWorkspaceId,
  { label: string; shortLabel: string; target: NavLevel; icon: React.ElementType; help: string }
> = {
  business: {
    label: "Business Desk",
    shortLabel: "Business",
    target: "business-desk",
    icon: ColorfulBriefcaseIcon,
    help: "Messages, leads, ventes et relation client.",
  },
  enterprise: {
    label: "Enterprise Desk",
    shortLabel: "Enterprise",
    target: "enterprise-desk",
    icon: ColorfulBuildingIcon,
    help: "Demandes internes, documents et pilotage.",
  },
  executive: {
    label: "Executive Desk",
    shortLabel: "Executive",
    target: "executive-desk",
    icon: ColorfulCrownIcon,
    help: "Mails, planning, contacts et fichiers.",
  },
};

const GENERAL_ITEMS: SidebarItem[] = [
  { id: "home", target: "home", labelFr: "Accueil", labelEn: "Home", icon: ColorfulHomeIcon },
  { id: "global-dashboard", target: "global-dashboard", labelFr: "Tableau de bord global", labelEn: "Global dashboard", icon: ColorfulDashboardIcon },
];

const WORKSPACE_ITEMS: Record<FlareWorkspaceId, SidebarItem[]> = {
  business: [
    { id: "business-overview", target: "business-desk", labelFr: "Vue Business", labelEn: "Business view", icon: ColorfulBriefcaseIcon },
    { id: "business-chatbot", target: "chatbot", labelFr: "Chatbot Facebook", labelEn: "Facebook chatbot", icon: MessengerIcon, moduleKey: "business-chatbot" },
    { id: "business-leads", target: "chatbot-clients", labelFr: "Leads / Contacts", labelEn: "Leads / Contacts", icon: Users, moduleKey: "business-leads" },
    { id: "business-automations", target: "automationHub", labelFr: "Automatisations Business", labelEn: "Business automations", icon: Workflow, moduleKey: "business-automations" },
  ],
  enterprise: [
    { id: "enterprise-overview", target: "enterprise-desk", labelFr: "Vue Enterprise", labelEn: "Enterprise view", icon: ColorfulBuildingIcon },
    { id: "enterprise-requests", target: "enterprise-desk", labelFr: "Demandes internes", labelEn: "Internal requests", icon: Inbox, moduleKey: "enterprise-requests" },
    { id: "enterprise-assistant", target: "enterprise-desk", labelFr: "Assistant IA interne", labelEn: "Internal AI assistant", icon: Bot, moduleKey: "enterprise-assistant" },
    { id: "enterprise-docs", target: "enterprise-desk", labelFr: "Base documentaire", labelEn: "Document hub", icon: GoogleDriveIcon, moduleKey: "enterprise-docs" },
    { id: "enterprise-reports", target: "enterprise-desk", labelFr: "Rapports & Dashboard", labelEn: "Reports & dashboard", icon: FileBarChart2, moduleKey: "enterprise-reports" },
  ],
  executive: [
    { id: "executive-overview", target: "executive-desk", labelFr: "Bureau Exécutif", labelEn: "Executive Desk", icon: ColorfulCrownIcon },
    { id: "executive-mail", target: "executive-mail", labelFr: "Assistant Mail", labelEn: "Mail assistant", icon: GmailIcon, moduleKey: "executive-mail" },
    { id: "executive-planning", target: "executive-planning", labelFr: "Planning", labelEn: "Planning", icon: GoogleCalendarIcon, moduleKey: "executive-planning", locked: true },
    { id: "executive-contacts", target: "executive-contacts", labelFr: "Contacts intelligents", labelEn: "Smart contacts", icon: GoogleContactsIcon, moduleKey: "executive-contacts", locked: true },
    { id: "executive-files", target: "executive-files", labelFr: "Organisation fichiers", labelEn: "File organization", icon: GoogleDriveIcon, moduleKey: "executive-files", locked: true },
  ],
};

const ACCOUNT_ITEMS: SidebarItem[] = [
  { id: "billing", target: "billing", labelFr: "Offre / Activation", labelEn: "Offer / Activation", icon: StripeIcon },
  { id: "settings", target: "settings", labelFr: "Support / Parametres", labelEn: "Support / Settings", icon: Settings },
];

const ADMIN_ITEM: SidebarItem = {
  id: "admin",
  target: "admin" as NavLevel,
  labelFr: "Administration",
  labelEn: "Administration",
  icon: FirebaseIcon,
};

const MODULE_LABELS: Record<string, string> = {
  "business-chatbot": "Afficher Chatbot Facebook",
  "business-leads": "Afficher Leads / Contacts",
  "business-automations": "Afficher Automatisations Business",
  "enterprise-requests": "Afficher Demandes internes",
  "enterprise-assistant": "Afficher Assistant IA interne",
  "enterprise-docs": "Afficher Base documentaire",
  "enterprise-reports": "Afficher Rapports & Dashboard",
  "executive-mail": "Afficher Assistant Mail",
  "executive-planning": "Afficher Planning",
  "executive-contacts": "Afficher Contacts intelligents",
  "executive-files": "Afficher Organisation fichiers",
};

function readWorkspace(): FlareWorkspaceId | null {
  if (typeof window === "undefined") return null;
  const value = window.localStorage.getItem(FLARE_WORKSPACE_STORAGE_KEY);
  return value === "business" || value === "enterprise" || value === "executive" ? value : null;
}

function readModulePrefs(): Record<string, boolean> {
  if (typeof window === "undefined") return {};
  try {
    const parsed = JSON.parse(window.localStorage.getItem(FLARE_MODULE_PREFS_STORAGE_KEY) || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function isModuleVisible(item: SidebarItem, prefs: Record<string, boolean>) {
  return !item.moduleKey || prefs[item.moduleKey] !== false;
}

function resolveActiveItem(activeView: NavLevel): string {
  if (activeView === "home") return "home";
  if (activeView === "global-dashboard") return "global-dashboard";
  if (activeView === "business-desk") return "business-overview";
  if (activeView === "enterprise-desk") return "enterprise-overview";
  if (activeView === "executive-desk") return "executive-overview";
  if (activeView === "executive-mail") return "executive-mail";
  if (activeView === "executive-planning") return "executive-planning";
  if (activeView === "executive-contacts") return "executive-contacts";
  if (activeView === "executive-files") return "executive-files";
  if ((["chatbot", "facebook", "google", "chatbot-personnalisation", "chatbot-parametres", "chatbot-dashboard", "chatbot-client-detail", "chatbot-orders"] as string[]).includes(activeView)) return "business-chatbot";
  if ((["chatbot-clients", "leads", "conversations"] as string[]).includes(activeView)) return "business-leads";
  if ((["automationHub", "automations", "prospection", "content", "followup", "agents"] as string[]).includes(activeView)) return "business-automations";
  if ((["billing", "chatbot-activation"] as string[]).includes(activeView)) return "billing";
  if ((["settings", "guide", "contact"] as string[]).includes(activeView)) return "settings";
  if (activeView === ("admin" as NavLevel)) return "admin";
  return "home";
}

function NavButton({
  item,
  isActive,
  expanded,
  lang,
  onClick,
}: {
  item: SidebarItem;
  isActive: boolean;
  expanded: boolean;
  lang: "fr" | "en";
  onClick: () => void;
}) {
  const Icon = item.icon;
  const label = lang === "en" ? item.labelEn : item.labelFr;

  return (
    <button
      id={`nav-btn-${item.id}`}
      onClick={() => {
        if (!item.locked) onClick();
      }}
      title={item.locked ? (lang === "en" ? "Coming soon" : "Bientôt disponible") : (!expanded ? label : undefined)}
      className={`group relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all duration-150 ${
        isActive
          ? "bg-[#f3e4d2] text-[#f97316] font-medium shadow-[inset_0_0_0_1px_rgba(249,115,22,0.08)]"
          : item.locked
            ? "text-[var(--text-muted)] cursor-not-allowed opacity-60"
            : "text-[var(--text-secondary)] hover:bg-white/80 hover:text-[var(--text-primary)]"
      }`}
    >
      {isActive && (
        <motion.div
          layoutId="sidebar-active-indicator"
          className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r-full bg-orange-500"
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
        />
      )}
      <div className={item.locked ? "saturate-50" : ""}>
        <Icon size={15} strokeWidth={isActive ? 2 : 1.5} className="shrink-0" />
      </div>
      {expanded && <span className="flex-1 truncate text-sm tracking-[-0.01em]">{label}</span>}
      {expanded && item.locked && <Lock size={10} className="shrink-0 text-[var(--text-muted)]" />}
      {expanded && !isActive && !item.locked && <ChevronRight size={12} className="shrink-0 opacity-0 transition-opacity group-hover:opacity-70" />}
    </button>
  );
}

function UserAvatar({ avatarUrl, displayName, size = 28 }: { avatarUrl?: string; displayName?: string; size?: number }) {
  const initial = (displayName || "U")[0].toUpperCase();

  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt={displayName || "Avatar"}
        width={size}
        height={size}
        className="shrink-0 rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full bg-orange-500/18 font-semibold text-orange-500"
      style={{ width: size, height: size, fontSize: size * 0.44 }}
    >
      {initial}
    </div>
  );
}

export default function NewSidebar({
  activeView,
  onNavigate,
  onNavigateHome,
  onOpenReport,
  user,
  onLogout,
  displayName,
  avatarUrl,
  brandName,
  open = false,
  onClose,
  lang = "fr",
  canAccessAdmin = false,
}: NewSidebarProps) {
  const [expanded, setExpanded] = useState(true);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false);
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [workspace, setWorkspace] = useState<FlareWorkspaceId | null>(null);
  const [modulePrefs, setModulePrefs] = useState<Record<string, boolean>>({});
  const profileMenuRef = useRef<HTMLDivElement | null>(null);
  const sidebarWidth = expanded ? "w-[240px]" : "w-[64px]";
  const activeItem = resolveActiveItem(activeView);

  useEffect(() => {
    setWorkspace(readWorkspace());
    setModulePrefs(readModulePrefs());

    const handleWorkspaceChange = (event: Event) => {
      const next = (event as CustomEvent<{ workspace?: FlareWorkspaceId | null }>).detail?.workspace ?? readWorkspace();
      setWorkspace(next || null);
    };
    const handleStorageChange = () => {
      setWorkspace(readWorkspace());
      setModulePrefs(readModulePrefs());
    };

    window.addEventListener(FLARE_WORKSPACE_EVENT, handleWorkspaceChange);
    window.addEventListener("storage", handleStorageChange);
    return () => {
      window.removeEventListener(FLARE_WORKSPACE_EVENT, handleWorkspaceChange);
      window.removeEventListener("storage", handleStorageChange);
    };
  }, []);

  useEffect(() => {
    if (!profileMenuOpen) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (!profileMenuRef.current?.contains(event.target as Node)) setProfileMenuOpen(false);
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setProfileMenuOpen(false);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [profileMenuOpen]);

  const visibleWorkspaceItems = useMemo(() => {
    if (!workspace) return [];
    return WORKSPACE_ITEMS[workspace].filter((item) => isModuleVisible(item, modulePrefs));
  }, [workspace, modulePrefs]);

  const moduleItems = workspace ? WORKSPACE_ITEMS[workspace].filter((item) => item.moduleKey) : [];
  const activeWorkspace = workspace ? WORKSPACES[workspace] : null;
  const ActiveWorkspaceIcon = activeWorkspace?.icon;

  const navigate = (level: NavLevel) => {
    setProfileMenuOpen(false);
    setWorkspaceMenuOpen(false);
    onNavigate(level);
    onClose?.();
  };

  const selectWorkspace = (next: FlareWorkspaceId | null, shouldNavigate = true) => {
    setWorkspace(next);
    setWorkspaceMenuOpen(false);
    if (typeof window !== "undefined") {
      if (next) window.localStorage.setItem(FLARE_WORKSPACE_STORAGE_KEY, next);
      else window.localStorage.removeItem(FLARE_WORKSPACE_STORAGE_KEY);
    }
    emitWorkspaceChange(next);
    if (next && shouldNavigate) navigate(WORKSPACES[next].target);
    if (!next && shouldNavigate) navigate("home");
  };

  const toggleModule = (moduleKey: string) => {
    setModulePrefs((current) => {
      const next = { ...current, [moduleKey]: current[moduleKey] === false };
      window.localStorage.setItem(FLARE_MODULE_PREFS_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  const collapseLabel = lang === "en" ? "Collapse" : "Reduire";
  const expandLabel = lang === "en" ? "Expand" : "Agrandir";
  const closeLabel = lang === "en" ? "Close menu" : "Fermer le menu";
  const logoutLabel = lang === "en" ? "Log out" : "Se deconnecter";
  const profileActionsLabel = lang === "en" ? "Profile actions" : "Actions du profil";
  const settingsLabel = lang === "en" ? "Settings" : "Reglages";
  const homeLabel = lang === "en" ? "Go to home" : "Retour a l'accueil";

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            key="sidebar-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[90] bg-black/55 backdrop-blur-lg md:hidden"
            onClick={onClose}
            aria-hidden
          />
        )}
      </AnimatePresence>

      <aside
        className={`fixed inset-y-0 left-0 z-[110] flex h-[100dvh] ${sidebarWidth} flex-col overflow-hidden border-r border-black/8 bg-[#f6f2ea] shadow-[0_24px_60px_rgba(15,23,42,0.18)] transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] md:relative md:translate-x-0 md:bg-[var(--bg-sidebar)] md:shadow-none ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.05)_0%,rgba(15,23,42,0.02)_100%)] md:hidden" />
        <div className="flex items-center justify-between px-3 pb-3 pt-[calc(1rem+env(safe-area-inset-top,0px))]">
          <button
            type="button"
            onClick={() => {
              if (onNavigateHome) {
                setProfileMenuOpen(false);
                onNavigateHome();
                onClose?.();
                return;
              }
              navigate("home");
            }}
            className="relative z-10 flex min-w-0 items-center gap-2.5 rounded-xl px-1 py-1 text-left transition-all hover:bg-[var(--bg-hover)]"
            title={homeLabel}
            aria-label={homeLabel}
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] shadow-[0_8px_20px_rgba(0,0,0,0.04)]">
              <FlareMark tone="auto" className="w-[16px]" />
            </div>
            {expanded && <span className="truncate text-xs font-bold uppercase tracking-[0.15em] text-[var(--text-muted)]">{brandName || "FLARE AI"}</span>}
          </button>

          <button
            onClick={() => setExpanded((current) => !current)}
            className="relative z-10 hidden h-11 w-11 items-center justify-center rounded-xl text-[var(--text-muted)] transition-all hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] md:flex"
            title={expanded ? collapseLabel : expandLabel}
            aria-label={expanded ? collapseLabel : expandLabel}
          >
            {expanded ? <PanelLeftClose size={14} /> : <PanelLeftOpen size={14} />}
          </button>

          <button onClick={onClose} className="relative z-10 flex h-11 w-11 items-center justify-center rounded-xl text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] md:hidden" aria-label={closeLabel}>
            <X size={14} />
          </button>
        </div>

        <div className="relative z-10 flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-2 pt-1">
          {expanded && (
            <div className="mb-3 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)]/50 p-2 backdrop-blur-md">
              <button
                type="button"
                onClick={() => setWorkspaceMenuOpen((current) => !current)}
                className="flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left transition-colors hover:bg-orange-500/10"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-orange-500/10 text-orange-500">
                  {ActiveWorkspaceIcon ? <ActiveWorkspaceIcon size={17} /> : <LayoutDashboard size={17} />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--text-muted)]">Espace actuel</p>
                  <p className="truncate text-sm font-bold text-[var(--text-primary)]">{activeWorkspace?.label || "Choisir un espace"}</p>
                </div>
                <ChevronDown size={14} className={`shrink-0 text-[var(--text-muted)] transition-transform ${workspaceMenuOpen ? "rotate-180" : ""}`} />
              </button>

              <AnimatePresence>
                {workspaceMenuOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className="mt-2 space-y-1"
                  >
                    {(Object.keys(WORKSPACES) as FlareWorkspaceId[]).map((id) => {
                      const option = WORKSPACES[id];
                      const Icon = option.icon;
                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={() => selectWorkspace(id)}
                          className={`flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left text-sm transition-colors ${
                            workspace === id ? "bg-orange-500/10 font-bold text-orange-600" : "text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
                          }`}
                        >
                          <Icon size={14} />
                          <span>{option.label}</span>
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      onClick={() => selectWorkspace(null)}
                      className="flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left text-sm text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)]"
                    >
                      <LayoutDashboard size={14} />
                      <span>Accueil global</span>
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              {workspace && (
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setWorkspaceMenuOpen((current) => !current)}
                    className="inline-flex items-center justify-center rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] px-3 py-2 text-xs font-bold text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-overlay)]"
                  >
                    Changer d&apos;espace
                  </button>
                  <button
                    type="button"
                    onClick={() => setCustomizeOpen(true)}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-orange-500/20 bg-orange-500/10 px-3 py-2 text-xs font-bold text-orange-600 transition-colors hover:bg-orange-500/15"
                  >
                    <SlidersHorizontal size={13} />
                    Modules
                  </button>
                </div>
              )}
            </div>
          )}

          <nav className="space-y-0.5" aria-label="Navigation principale">
            {(workspace ? [GENERAL_ITEMS[0]] : GENERAL_ITEMS).map((item) => (
              <NavButton key={item.id} item={item} isActive={activeItem === item.id} expanded={expanded} lang={lang} onClick={() => navigate(item.target)} />
            ))}

            {expanded && workspace && <div className="px-3 pb-1 pt-3 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--text-muted)]">Modules</div>}
            {visibleWorkspaceItems.map((item) => (
              <NavButton key={item.id} item={item} isActive={activeItem === item.id} expanded={expanded} lang={lang} onClick={() => navigate(item.target)} />
            ))}

            {expanded && <div className="px-3 pb-1 pt-3 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--text-muted)]">Compte</div>}
            {ACCOUNT_ITEMS.map((item) => (
              <NavButton key={item.id} item={item} isActive={activeItem === item.id} expanded={expanded} lang={lang} onClick={() => navigate(item.target)} />
            ))}

            {canAccessAdmin && (
              <NavButton item={ADMIN_ITEM} isActive={activeItem === "admin"} expanded={expanded} lang={lang} onClick={() => navigate("admin" as NavLevel)} />
            )}
          </nav>

          <div className="flex-1" />
        </div>

        <div ref={profileMenuRef} className="relative z-10 px-2 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))]">
          <div className="mx-3 my-2 h-px bg-[var(--divider)]" />
          <button
            type="button"
            onClick={() => setProfileMenuOpen((current) => !current)}
            title={profileActionsLabel}
            aria-label={profileActionsLabel}
            aria-expanded={profileMenuOpen}
            className={`flex w-full items-center gap-2.5 rounded-xl border border-transparent px-2.5 py-2.5 text-left transition-all hover:border-[var(--border-muted)] hover:bg-[var(--bg-hover)] ${expanded ? "" : "justify-center"}`}
          >
            <UserAvatar avatarUrl={avatarUrl} displayName={displayName} size={28} />
            {expanded && (
              <>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold leading-tight text-[var(--text-primary)]">
                    {displayName || user?.email?.split("@")[0] || (lang === "en" ? "User" : "Utilisateur")}
                  </p>
                  {user?.email && <p className="mt-0.5 truncate text-xs leading-tight text-[var(--text-secondary)]">{user.email}</p>}
                </div>
                <ChevronDown size={14} className={`shrink-0 text-[var(--text-muted)] transition-transform ${profileMenuOpen ? "rotate-180" : ""}`} />
              </>
            )}
          </button>

          <AnimatePresence>
            {profileMenuOpen && (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 6, scale: 0.98 }}
                transition={{ duration: 0.16 }}
                className={`absolute bottom-[72px] z-[140] min-w-[220px] rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-2 shadow-[0_24px_50px_rgba(0,0,0,0.18)] backdrop-blur-xl ${expanded ? "left-2 right-2" : "left-[72px]"}`}
              >
                <button type="button" onClick={() => navigate("settings")} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-subtle)]">
                  <Settings size={15} className="shrink-0" />
                  <span>{settingsLabel}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setProfileMenuOpen(false);
                    onOpenReport?.();
                  }}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-subtle)]"
                >
                  <AlertCircle size={15} className="shrink-0" />
                  <span>Signalement</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setProfileMenuOpen(false);
                    onLogout?.();
                  }}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-subtle)]"
                >
                  <LogOut size={15} className="shrink-0" />
                  <span>{logoutLabel}</span>
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </aside>

      <AnimatePresence>
        {customizeOpen && workspace && (
          <motion.div
            className="fixed inset-0 z-[180] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setCustomizeOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.98 }}
              className="w-full max-w-[420px] rounded-[26px] border border-[var(--border-default)] bg-[var(--bg-card)] p-5 shadow-[0_30px_80px_rgba(0,0,0,0.3)] backdrop-blur-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-orange-500">Personnalisation</p>
                  <h2 className="mt-1 text-xl font-black text-[var(--text-primary)]">{WORKSPACES[workspace].label}</h2>
                  <p className="mt-1 text-sm text-[var(--text-secondary)]">Choisissez les modules visibles dans la sidebar.</p>
                </div>
                <button type="button" onClick={() => setCustomizeOpen(false)} className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--surface-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                  <X size={15} />
                </button>
              </div>
              <div className="mt-5 space-y-2">
                {moduleItems.map((item) => (
                  <label key={item.id} className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl border border-[var(--border-default)] bg-[var(--surface-subtle)] p-3">
                    <span className="text-sm font-semibold text-[var(--text-primary)]">{MODULE_LABELS[item.moduleKey || item.id]}</span>
                    <input
                      type="checkbox"
                      checked={modulePrefs[item.moduleKey || ""] !== false}
                      onChange={() => item.moduleKey && toggleModule(item.moduleKey)}
                      className="h-4 w-4 accent-orange-500"
                    />
                  </label>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
