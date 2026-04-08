"use client";

import { useEffect, useRef, useState } from "react";
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
  ChevronUp,
  AlertCircle,
  ShieldCheck,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { User } from "firebase/auth";
import FlareMark from "@/components/FlareMark";
import type { NavLevel } from "@/components/NavBreadcrumb";

interface NewSidebarProps {
  activeView: NavLevel;
  onNavigate: (level: NavLevel) => void;
  onOpenReport?: () => void;
  user?: User | null;
  onLogout?: () => void;
  displayName?: string;
  avatarUrl?: string;
  brandName?: string;
  logoUrl?: string;
  open?: boolean;
  onClose?: () => void;
  lang?: "fr" | "en";
  token?: string | null;
  userEmail?: string | null;
}

type NavItem = {
  id: NavLevel;
  labelFr: string;
  labelEn: string;
  icon: typeof Zap;
};

const MAIN_ITEMS: NavItem[] = [
  { id: "chatbot", labelFr: "Chatbot Facebook", labelEn: "Facebook Chatbot", icon: MessageCircle },
  { id: "assistant", labelFr: "Assistant IA", labelEn: "AI Assistant", icon: Bot },
  { id: "automations", labelFr: "Automatisations", labelEn: "Automations", icon: Zap },
];

const SECONDARY_ITEMS: NavItem[] = [
  { id: "guide", labelFr: "Guide", labelEn: "Guide", icon: BookOpen },
  { id: "billing", labelFr: "Abonnements", labelEn: "Subscriptions", icon: CreditCard },
  { id: "contact", labelFr: "Contactez-nous", labelEn: "Contact us", icon: MessageCircle },
];

const ADMIN_ITEM: NavItem = {
  id: "admin" as NavLevel,
  labelFr: "Administration",
  labelEn: "Administration",
  icon: ShieldCheck,
};

const ADMIN_EMAILS = ["cptskevin@gmail.com"];

const SETTINGS_ITEM: NavItem = {
  id: "settings",
  labelFr: "Parametres",
  labelEn: "Settings",
  icon: Settings,
};

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
      className={`group relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all duration-150 ${
        isActive
          ? "bg-[var(--bg-active)] text-orange-500 font-medium"
          : "text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)] hover:text-[var(--text-primary)]"
      }`}
    >
      {isActive && (
        <motion.div
          layoutId="sidebar-active-indicator"
          className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r-full bg-orange-500"
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
        />
      )}

      <Icon size={15} strokeWidth={isActive ? 2 : 1.5} className="shrink-0" />

      {expanded && <span className="flex-1 truncate text-[13px] tracking-[-0.01em]">{label}</span>}

      {expanded && !isActive && (
        <ChevronRight size={12} className="shrink-0 opacity-0 transition-opacity group-hover:opacity-70" />
      )}
    </button>
  );
}

function SectionDivider() {
  return <div className="mx-3 my-2 h-px bg-[var(--divider)]" />;
}

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
  onOpenReport,
  user,
  onLogout,
  displayName,
  avatarUrl,
  brandName,
  open = false,
  onClose,
  lang = "fr",
  userEmail,
}: NewSidebarProps) {
  const [expanded, setExpanded] = useState(true);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);
  const sidebarWidth = expanded ? "w-[240px]" : "w-[64px]";

  const isAdmin = Boolean(userEmail && ADMIN_EMAILS.includes(userEmail.toLowerCase()));
  const activeMainItem = (["chatbot", "facebook", "google", "chatbot-personnalisation", "chatbot-parametres", "chatbot-dashboard", "chatbot-clients", "chatbot-client-detail", "chatbot-orders", "chatbot-activation"] as NavLevel[]).includes(activeView)
    ? "chatbot"
    : (["automations", "prospection", "content", "followup", "agents", "automationHub"] as string[]).includes(activeView as string)
      ? "automations"
      : activeView === "assistant"
        ? "assistant"
        : activeView === ("admin" as NavLevel)
          ? "admin"
          : null;

  const navigate = (level: NavLevel) => {
    setProfileMenuOpen(false);
    onNavigate(level);
    onClose?.();
  };

  const collapseLabel = lang === "en" ? "Collapse" : "Reduire";
  const expandLabel = lang === "en" ? "Expand" : "Agrandir";
  const closeLabel = lang === "en" ? "Close menu" : "Fermer le menu";
  const logoutLabel = lang === "en" ? "Log out" : "Se deconnecter";
  const profileActionsLabel = lang === "en" ? "Profile actions" : "Actions du profil";
  const settingsLabel = lang === "en" ? "Settings" : "Reglages";
  const homeLabel = lang === "en" ? "Go to home" : "Retour a l'accueil";

  useEffect(() => {
    if (!profileMenuOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!profileMenuRef.current?.contains(event.target as Node)) {
        setProfileMenuOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setProfileMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [profileMenuOpen]);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    if (open) {
      document.body.classList.add("sidebar-mobile-open");
      return () => {
        document.body.classList.remove("sidebar-mobile-open");
      };
    }

    document.body.classList.remove("sidebar-mobile-open");
  }, [open]);

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
        className={`fixed inset-y-0 left-0 z-[110] flex h-[100dvh] ${sidebarWidth} flex-col border-r border-[var(--border-default)] bg-[var(--surface-base)] shadow-[0_28px_90px_rgba(0,0,0,0.30)] transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] md:relative md:translate-x-0 md:bg-[var(--bg-sidebar)] md:shadow-none ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-3 pb-3 pt-4">
          <button
            type="button"
            onClick={() => navigate("home")}
            className="flex min-w-0 items-center gap-2.5 rounded-xl px-1 py-1 text-left transition-colors hover:bg-[var(--surface-subtle)]"
            title={homeLabel}
            aria-label={homeLabel}
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--border-default)] bg-[var(--surface-raised)]">
              <FlareMark tone="auto" className="w-[16px]" />
            </div>
            {expanded && (
              <span className="truncate text-[11px] font-medium uppercase tracking-[0.15em] text-[var(--text-muted)]">
                {brandName || "FLARE AI"}
              </span>
            )}
          </button>

          <button
            onClick={() => setExpanded((current) => !current)}
            className="hidden h-7 w-7 items-center justify-center rounded-lg text-[var(--text-muted)] transition-all hover:bg-[var(--surface-subtle)] hover:text-[var(--text-primary)] md:flex"
            title={expanded ? collapseLabel : expandLabel}
            aria-label={expanded ? collapseLabel : expandLabel}
          >
            {expanded ? <PanelLeftClose size={14} /> : <PanelLeftOpen size={14} />}
          </button>

          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] md:hidden"
            aria-label={closeLabel}
          >
            <X size={14} />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-2 pt-1">
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

          {isAdmin && (
            <>
              <SectionDivider />
              <nav className="space-y-0.5" aria-label="Administration">
                <NavButton
                  item={ADMIN_ITEM}
                  isActive={activeView === ("admin" as NavLevel)}
                  expanded={expanded}
                  lang={lang}
                  onClick={() => navigate("admin" as NavLevel)}
                />
              </nav>
            </>
          )}

          <SectionDivider />
          <nav className="space-y-0.5 pb-1" aria-label="Parametres">
            <NavButton
              item={SETTINGS_ITEM}
              isActive={activeView === "settings"}
              expanded={expanded}
              lang={lang}
              onClick={() => navigate("settings")}
            />
          </nav>

          <div className="flex-1" />
        </div>

        <div ref={profileMenuRef} className="relative px-2 pb-3">
          <SectionDivider />

          <button
            type="button"
            onClick={() => setProfileMenuOpen((current) => !current)}
            title={profileActionsLabel}
            aria-label={profileActionsLabel}
            aria-expanded={profileMenuOpen}
            className={`flex w-full items-center gap-2.5 rounded-xl border border-transparent px-2.5 py-2.5 text-left transition-all hover:border-[var(--border-default)] hover:bg-[var(--surface-subtle)] ${
              expanded ? "" : "justify-center"
            }`}
          >
            <UserAvatar avatarUrl={avatarUrl} displayName={displayName} size={28} />

            {expanded && (
              <>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12px] font-medium leading-tight text-[var(--text-primary)]">
                    {displayName || user?.email?.split("@")[0] || (lang === "en" ? "User" : "Utilisateur")}
                  </p>
                  {user?.email && (
                    <p className="mt-0.5 truncate text-[10px] leading-tight text-[var(--text-secondary)]">
                      {user.email}
                    </p>
                  )}
                </div>

                <ChevronUp
                  size={14}
                  className={`shrink-0 text-[var(--text-muted)] transition-transform ${profileMenuOpen ? "rotate-0" : "rotate-180"}`}
                />
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
                className={`absolute bottom-[72px] z-[140] min-w-[220px] rounded-2xl border border-[var(--border-default)] bg-[var(--surface-base)] p-2 shadow-[var(--shadow-card)] ${
                  expanded ? "left-2 right-2" : "left-[72px]"
                }`}
              >
                  <button
                    type="button"
                    onClick={() => navigate("settings")}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-subtle)]"
                >
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
    </>
  );
}

