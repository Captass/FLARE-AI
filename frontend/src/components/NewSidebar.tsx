"use client";

import { useState } from "react";
import {
  Zap,
  Bot,
  BookOpen,
  CreditCard,
  MessageCircle,
  Settings,
  LogOut,
  X,
  PanelLeftClose,
  PanelLeftOpen,
  ChevronRight,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { User } from "firebase/auth";
import FlareMark from "@/components/FlareMark";
import type { NavLevel } from "@/components/NavBreadcrumb";

// ─── Types ────────────────────────────────────────────────────────────────────

interface NewSidebarProps {
  /** Niveau actif dans la pile de navigation */
  activeView: NavLevel;
  /** Callback navigation */
  onNavigate: (level: NavLevel) => void;
  /** Utilisateur Firebase */
  user?: User | null;
  /** Callback déconnexion */
  onLogout?: () => void;
  /** Nom affiché de l'utilisateur */
  displayName?: string;
  /** URL avatar utilisateur */
  avatarUrl?: string;
  /** Nom de la marque (ex: "FLARE AI") */
  brandName?: string;
  /** URL logo de la marque */
  logoUrl?: string;
  /** Sidebar ouverte sur mobile (drawer) */
  open?: boolean;
  /** Fermer le drawer mobile */
  onClose?: () => void;
  /** Langue de l'interface */
  lang?: "fr" | "en";
  /** Token utilisateur (non utilisé dans la sidebar mais accepté pour compat) */
  token?: string | null;
}

// ─── Navigation items ─────────────────────────────────────────────────────────

type NavItem = {
  id: NavLevel;
  labelFr: string;
  labelEn: string;
  icon: typeof Zap;
};

const MAIN_ITEMS: NavItem[] = [
  { id: "automations", labelFr: "Automatisations", labelEn: "Automations", icon: Zap },
  { id: "assistant", labelFr: "Assistant IA", labelEn: "AI Assistant", icon: Bot },
];

const SECONDARY_ITEMS: NavItem[] = [
  { id: "guide", labelFr: "Guide", labelEn: "Guide", icon: BookOpen },
  { id: "billing", labelFr: "Abonnements", labelEn: "Subscriptions", icon: CreditCard },
  { id: "contact", labelFr: "Contactez-nous", labelEn: "Contact us", icon: MessageCircle },
];

const SETTINGS_ITEM: NavItem = {
  id: "settings",
  labelFr: "Paramètres",
  labelEn: "Settings",
  icon: Settings,
};

// ─── NavButton ────────────────────────────────────────────────────────────────

function NavButton({
  item,
  isActive,
  expanded,
  lang,
  onClick,
}: {
  item: NavItem;
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
      onClick={onClick}
      title={!expanded ? label : undefined}
      className={`
        group relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5
        transition-all duration-150 text-left
        ${isActive
          ? "bg-[var(--bg-active)] text-orange-400 font-medium"
          : "text-fg/35 hover:text-fg/70 hover:bg-[var(--bg-hover)]"
        }
      `}
    >
      {/* Active indicator */}
      {isActive && (
        <motion.div
          layoutId="sidebar-active-indicator"
          className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full bg-orange-400"
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
        />
      )}

      <Icon
        size={15}
        strokeWidth={isActive ? 2 : 1.5}
        className="shrink-0"
      />

      {expanded && (
        <span className="flex-1 truncate text-[13px] tracking-[-0.01em]">
          {label}
        </span>
      )}

      {/* Expanded state: show chevron for main items on hover */}
      {expanded && !isActive && (
        <ChevronRight
          size={12}
          className="shrink-0 opacity-0 group-hover:opacity-40 transition-opacity"
        />
      )}
    </button>
  );
}

// ─── SectionDivider ───────────────────────────────────────────────────────────

function SectionDivider() {
  return <div className="mx-3 my-2 h-px bg-fg/[0.05]" />;
}

// ─── Avatar initials ──────────────────────────────────────────────────────────

function UserAvatar({
  avatarUrl,
  displayName,
  size = 28,
}: {
  avatarUrl?: string;
  displayName?: string;
  size?: number;
}) {
  const initial = (displayName || "U")[0].toUpperCase();

  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt={displayName || "Avatar"}
        width={size}
        height={size}
        className="rounded-full object-cover shrink-0"
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full
                 bg-orange-500/20 text-orange-400 font-semibold"
      style={{ width: size, height: size, fontSize: size * 0.44 }}
    >
      {initial}
    </div>
  );
}

// ─── Main NewSidebar ──────────────────────────────────────────────────────────

export default function NewSidebar({
  activeView,
  onNavigate,
  user,
  onLogout,
  displayName,
  avatarUrl,
  brandName,
  open = false,
  onClose,
  lang = "fr",
}: NewSidebarProps) {
  const [expanded, setExpanded] = useState(true);
  const sidebarWidth = expanded ? "w-[240px]" : "w-[64px]";

  // Detect which top-level section is "active" based on current nav level
  const activeMainItem = (["automations", "facebook", "google", "chatbot",
    "chatbot-personnalisation", "chatbot-parametres", "chatbot-dashboard",
    "chatbot-clients", "chatbot-client-detail"] as NavLevel[]).includes(activeView)
    ? "automations"
    : activeView === "assistant"
    ? "assistant"
    : null;

  const navigate = (level: NavLevel) => {
    onNavigate(level);
    onClose?.();
  };

  const collapseLabel = lang === "en" ? "Collapse" : "Réduire";
  const expandLabel = lang === "en" ? "Expand" : "Agrandir";
  const closeLabel = lang === "en" ? "Close menu" : "Fermer le menu";
  const logoutLabel = lang === "en" ? "Log out" : "Se déconnecter";

  return (
    <>
      {/* Mobile overlay */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="sidebar-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[90] bg-black/60 md:hidden"
            onClick={onClose}
            aria-hidden
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-[110] flex h-[100dvh] ${sidebarWidth} flex-col
          border-r border-fg/[0.04] bg-[var(--bg-sidebar)]
          transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]
          md:relative md:translate-x-0
          ${open ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-3 pt-4 pb-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-fg/[0.04]">
              <FlareMark tone="dark" className="w-[16px]" />
            </div>
            {expanded && (
              <span className="text-[11px] font-medium text-fg/45 uppercase tracking-[0.15em] truncate">
                {brandName || "FLARE AI"}
              </span>
            )}
          </div>

          {/* Desktop collapse toggle */}
          <button
            onClick={() => setExpanded((p) => !p)}
            className="hidden md:flex h-7 w-7 items-center justify-center rounded-lg
                       text-fg/20 hover:text-fg/50 hover:bg-[var(--bg-hover)] transition-all"
            title={expanded ? collapseLabel : expandLabel}
            aria-label={expanded ? collapseLabel : expandLabel}
          >
            {expanded ? <PanelLeftClose size={14} /> : <PanelLeftOpen size={14} />}
          </button>

          {/* Mobile close */}
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg
                       text-fg/20 hover:text-fg/50 md:hidden"
            aria-label={closeLabel}
          >
            <X size={14} />
          </button>
        </div>

        {/* ── Main nav ── */}
        <div className="flex flex-1 flex-col min-h-0 overflow-y-auto px-2 pt-1">
          <nav className="space-y-0.5" aria-label="Navigation principale">
            {MAIN_ITEMS.map((item) => (
              <NavButton
                key={item.id}
                item={item}
                isActive={activeMainItem === item.id}
                expanded={expanded}
                lang={lang}
                onClick={() => navigate(item.id)}
              />
            ))}
          </nav>

          <SectionDivider />

          <nav className="space-y-0.5" aria-label="Navigation secondaire">
            {SECONDARY_ITEMS.map((item) => (
              <NavButton
                key={item.id}
                item={item}
                isActive={activeView === item.id}
                expanded={expanded}
                lang={lang}
                onClick={() => navigate(item.id)}
              />
            ))}
          </nav>

          {/* Spacer */}
          <div className="flex-1" />

          <SectionDivider />

          {/* Settings */}
          <nav className="space-y-0.5 pb-1" aria-label="Paramètres">
            <NavButton
              item={SETTINGS_ITEM}
              isActive={activeView === "settings"}
              expanded={expanded}
              lang={lang}
              onClick={() => navigate("settings")}
            />
          </nav>
        </div>

        {/* ── User footer ── */}
        <div className="px-2 pb-3">
          <SectionDivider />
          <div
            className={`flex items-center gap-2.5 rounded-xl px-2.5 py-2.5 ${
              expanded ? "" : "justify-center"
            }`}
          >
            <UserAvatar avatarUrl={avatarUrl} displayName={displayName} size={28} />

            {expanded && (
              <>
                <div className="flex-1 min-w-0">
                  <p className="truncate text-[12px] font-medium text-fg/70 leading-tight">
                    {displayName || user?.email?.split("@")[0] || (lang === "en" ? "User" : "Utilisateur")}
                  </p>
                  {user?.email && (
                    <p className="truncate text-[10px] text-fg/25 leading-tight mt-0.5">
                      {user.email}
                    </p>
                  )}
                </div>

                <button
                  onClick={onLogout}
                  title={logoutLabel}
                  aria-label={logoutLabel}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg
                             text-fg/20 hover:text-red-400 hover:bg-red-500/10
                             transition-all duration-150"
                >
                  <LogOut size={13} />
                </button>
              </>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
