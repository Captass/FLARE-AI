"use client";

import { useState } from "react";
import {
  Bot,
  BookOpen,
  Brain,
  Building2,
  ChevronRight,
  DollarSign,
  FileText,
  FolderOpen,
  Home,
  Lock,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Settings,
  Shield,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { ActiveView } from "@/app/page";
import { Conversation, Folder } from "@/lib/api";
import type { PlanFeatures } from "@/lib/api";
import { User } from "firebase/auth";
import FlareMark from "@/components/FlareMark";

interface SidebarProps {
  conversations: Conversation[];
  activeSessionId: string | null;
  activeView: ActiveView;
  onNavigate: (view: ActiveView) => void;
  onNewChat: () => void;
  onSelectConversation: (id: string) => void;
  onRename: (id: string, newTitle: string, folderId?: string | null) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onBulkDelete?: (ids: string[]) => Promise<void>;
  onBulkUpdate?: (ids: string[], updates: { title?: string; folder_id?: string | null }) => Promise<void>;
  isLoading: boolean;
  folders: Folder[];
  onAddFolder: (name: string, color?: string) => Promise<Folder | null>;
  onEditFolder: (id: string, name?: string, color?: string) => Promise<Folder | null>;
  onRemoveFolder: (id: string) => Promise<void>;
  user?: User | null;
  token?: string | null;
  onLogout?: () => void;
  onCreateAccount?: () => void;
  onOpenSpaceModal?: () => void;
  onOpenSpaceManager?: () => void;
  onOpenSettingsModal?: () => void;
  open?: boolean;
  onClose?: () => void;
  brandName?: string;
  workspaceName?: string;
  logoUrl?: string;
  hasOrgScope?: boolean;
  planFeatures?: PlanFeatures | null;
  organizationSlug?: string | null;
}

// ─── Space detection ──────────────────────────────────────────────────────────

const ORG_VIEWS = new Set<ActiveView>([
  "automationHub",
  "chatbot",
  "conversations",
  "leads",
  "expenses",
  "chatbotFiles",
  "prospection",
  "content",
  "followup",
  "agents",
]);

const PERSONAL_VIEWS = new Set<ActiveView>([
  "dashboard",
  "chat",
  "memory",
  "knowledge",
  "files",
  "prompts",
  "admin",
]);

type Space = "personal" | "org";

function detectSpace(view: ActiveView): Space {
  return ORG_VIEWS.has(view) ? "org" : "personal";
}

// ─── Nav item type ────────────────────────────────────────────────────────────

type NavItem = {
  label: string;
  icon: typeof Home;
  view: ActiveView;
  locked?: boolean;
  lockReason?: string;
};

// ─── NavButton ────────────────────────────────────────────────────────────────

function NavButton({
  item,
  isActive,
  expanded,
  onClick,
  indent = false,
}: {
  item: NavItem;
  isActive: boolean;
  expanded: boolean;
  onClick: () => void;
  indent?: boolean;
}) {
  const Icon = item.icon;
  return (
    <button
      onClick={item.locked ? undefined : onClick}
      title={!expanded ? item.label : undefined}
      disabled={item.locked}
      className={`group flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 transition-all duration-150 ${
        indent ? "pl-4" : ""
      } ${
        item.locked
          ? "cursor-default text-white/15"
          : isActive
          ? "bg-white/[0.07] text-white"
          : "text-white/30 hover:bg-white/[0.03] hover:text-white/60"
      }`}
    >
      <Icon size={14} strokeWidth={isActive ? 2 : 1.5} className="shrink-0" />
      {expanded && (
        <>
          <span className="flex-1 text-left text-[11px] font-medium truncate">{item.label}</span>
          {item.locked && <Lock size={10} className="shrink-0 text-white/20" />}
        </>
      )}
    </button>
  );
}

// ─── Section label ────────────────────────────────────────────────────────────

function SectionLabel({ label, expanded }: { label: string; expanded: boolean }) {
  if (!expanded) return null;
  return (
    <p className="px-2.5 pt-3 pb-1 text-[9px] uppercase tracking-[0.2em] text-white/15 font-medium">
      {label}
    </p>
  );
}

// ─── Main Sidebar ─────────────────────────────────────────────────────────────

export default function Sidebar({
  conversations,
  activeSessionId,
  activeView,
  onNavigate,
  onNewChat,
  onSelectConversation,
  open,
  onClose,
  onOpenSettingsModal,
  brandName,
  hasOrgScope = false,
  planFeatures,
  organizationSlug,
}: SidebarProps) {
  const [expanded, setExpanded] = useState(true);

  const space = detectSpace(activeView);
  const sidebarWidth = expanded ? "w-[220px]" : "w-[64px]";

  // ─ Personal nav ──────────────────────────────────────────────────────────
  const personalMainItems: NavItem[] = [
    { label: "Accueil", icon: Home, view: "dashboard" },
    { label: "Assistant IA", icon: Sparkles, view: "chat" },
  ];

  const personalAssistantItems: NavItem[] = [
    { label: "Discussion", icon: MessageSquare, view: "chat" },
    { label: "Mémoire", icon: Brain, view: "memory" },
    { label: "Connaissances", icon: BookOpen, view: "knowledge" },
    { label: "Fichiers", icon: FolderOpen, view: "files" },
    { label: "Prompts", icon: FileText, view: "prompts" },
    { label: "Admin", icon: Shield, view: "admin" },
  ];

  const isInAssistantSection = PERSONAL_VIEWS.has(activeView) && activeView !== "dashboard";

  // ─ Org nav ───────────────────────────────────────────────────────────────
  const orgItems: NavItem[] = [
    { label: "Mon chatbot", icon: Bot, view: "chatbot" },
    { label: "Conversations", icon: MessageSquare, view: "conversations" },
    {
      label: "Prospects",
      icon: Users,
      view: "leads",
      locked: planFeatures ? !planFeatures.has_leads : false,
      lockReason: "Plan Starter requis",
    },
    {
      label: "Budget",
      icon: DollarSign,
      view: "expenses",
      locked: planFeatures ? !planFeatures.has_budget : false,
      lockReason: "Plan Pro requis",
    },
  ];

  const navigate = (view: ActiveView) => {
    onNavigate(view);
    onClose?.();
  };

  return (
    <>
      {/* Mobile overlay */}
      <div
        className={`fixed inset-0 z-[90] bg-black/60 transition-opacity duration-300 md:hidden ${
          open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={onClose}
      />

      <aside
        className={`fixed inset-y-0 left-0 z-[110] flex h-[100dvh] ${sidebarWidth} flex-col border-r border-white/[0.04] bg-[rgba(7,9,12,0.97)] transition-all duration-300
          md:relative md:translate-x-0
          ${open ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-3 py-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/[0.04]">
              <FlareMark tone="dark" className="w-[16px]" />
            </div>
            {expanded && (
              <span className="text-[11px] font-medium text-white/50 uppercase tracking-[0.15em] truncate">
                {brandName || "FLARE AI"}
              </span>
            )}
          </div>

          <button
            onClick={() => setExpanded(!expanded)}
            className="hidden md:flex h-7 w-7 items-center justify-center rounded-lg text-white/20 hover:text-white/50 hover:bg-white/[0.04] transition-all"
            title={expanded ? "Réduire" : "Agrandir"}
          >
            {expanded ? <PanelLeftClose size={14} /> : <PanelLeftOpen size={14} />}
          </button>

          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-white/20 hover:text-white/50 md:hidden"
          >
            <X size={14} />
          </button>
        </div>

        {/* ════════════════════════════════════════════════════
            ESPACE PERSONNEL
            ════════════════════════════════════════════════════ */}
        {space === "personal" && (
          <div className="flex flex-1 flex-col min-h-0">
            <nav className="px-2 space-y-0.5">
              {personalMainItems.map((item) => {
                const isActive =
                  item.view === "dashboard"
                    ? activeView === "dashboard"
                    : isInAssistantSection;
                return (
                  <NavButton
                    key={item.view}
                    item={item}
                    isActive={isActive}
                    expanded={expanded}
                    onClick={() => navigate(item.view)}
                  />
                );
              })}
            </nav>

            {/* Assistant subnav */}
            {isInAssistantSection && (
              <>
                <div className="mx-3 my-2 h-px bg-white/[0.04]" />
                <nav className="px-2 space-y-0.5">
                  <SectionLabel label="Assistant" expanded={expanded} />
                  {personalAssistantItems.map((item) => (
                    <NavButton
                      key={item.view}
                      item={item}
                      isActive={activeView === item.view}
                      expanded={expanded}
                      onClick={() => navigate(item.view)}
                    />
                  ))}

                  <button
                    onClick={() => { onNewChat(); onClose?.(); }}
                    title={!expanded ? "Nouvelle discussion" : undefined}
                    className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 mt-1 text-white/25 hover:text-white/50 hover:bg-white/[0.03] transition-all ${
                      expanded ? "" : "justify-center"
                    }`}
                  >
                    <Plus size={13} className="shrink-0" />
                    {expanded && <span className="text-[11px] font-medium">Nouvelle discussion</span>}
                  </button>
                </nav>
              </>
            )}

            {/* Recent conversations */}
            {isInAssistantSection && expanded && conversations.length > 0 && (
              <div className="mt-2 flex-1 overflow-y-auto px-2 space-y-0.5 min-h-0">
                <SectionLabel label="Récents" expanded={expanded} />
                {conversations.slice(0, 20).map((conv) => (
                  <button
                    key={conv.id}
                    onClick={() => { onSelectConversation(conv.id); onClose?.(); }}
                    className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left transition-all ${
                      activeSessionId === conv.id
                        ? "bg-white/[0.06] text-white"
                        : "text-white/20 hover:bg-white/[0.03] hover:text-white/40"
                    }`}
                  >
                    <MessageSquare size={11} className="shrink-0 opacity-40" />
                    <span className="text-[11px] truncate">{conv.title || "Sans titre"}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Go to org space */}
            {hasOrgScope && (
              <div className="mt-auto px-2 pb-1">
                <div className="mx-1 mb-2 h-px bg-white/[0.04]" />
                <button
                  onClick={() => navigate("chatbot")}
                  title={!expanded ? "Mon chatbot" : undefined}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-white/25 hover:text-white/50 hover:bg-white/[0.03] transition-all"
                >
                  <Building2 size={14} className="shrink-0" />
                  {expanded && (
                    <>
                      <span className="flex-1 text-left text-[11px] font-medium truncate">
                        {organizationSlug || "Mon organisation"}
                      </span>
                      <ChevronRight size={11} className="shrink-0 text-white/20" />
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Settings */}
            <div className={`px-2 pb-3 ${!hasOrgScope ? "mt-auto" : ""}`}>
              <button
                onClick={() => { onOpenSettingsModal?.(); onClose?.(); }}
                title={!expanded ? "Paramètres" : undefined}
                className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-white/20 hover:text-white/40 hover:bg-white/[0.03] transition-all"
              >
                <Settings size={14} className="shrink-0" />
                {expanded && <span className="text-[11px] font-medium">Paramètres</span>}
              </button>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════
            ESPACE ORGANISATION (CHATBOT)
            ════════════════════════════════════════════════════ */}
        {space === "org" && (
          <div className="flex flex-1 flex-col min-h-0">
            {/* Org badge */}
            {expanded && organizationSlug && (
              <div className="mx-3 mb-3 rounded-lg bg-white/[0.03] px-3 py-2">
                <p className="text-[9px] uppercase tracking-[0.18em] text-white/20 font-medium mb-0.5">Organisation</p>
                <p className="text-[12px] font-medium text-white/60 truncate">{organizationSlug}</p>
              </div>
            )}

            <nav className="px-2 space-y-0.5">
              <SectionLabel label="Chatbot" expanded={expanded} />
              {orgItems.map((item) => (
                <NavButton
                  key={item.view}
                  item={item}
                  isActive={activeView === item.view || (item.view === "chatbot" && activeView === "chatbotFiles")}
                  expanded={expanded}
                  onClick={() => navigate(item.view)}
                />
              ))}
            </nav>

            {/* Back to personal */}
            <div className="mt-auto px-2 pb-3">
              <div className="mx-1 mb-2 h-px bg-white/[0.04]" />
              <button
                onClick={() => navigate("dashboard")}
                title={!expanded ? "Espace personnel" : undefined}
                className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-white/20 hover:text-white/40 hover:bg-white/[0.03] transition-all"
              >
                <Sparkles size={14} className="shrink-0" />
                {expanded && <span className="text-[11px] font-medium">Espace personnel</span>}
              </button>
              <button
                onClick={() => { onOpenSettingsModal?.(); onClose?.(); }}
                title={!expanded ? "Paramètres" : undefined}
                className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-white/20 hover:text-white/40 hover:bg-white/[0.03] transition-all"
              >
                <Settings size={14} className="shrink-0" />
                {expanded && <span className="text-[11px] font-medium">Paramètres</span>}
              </button>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}
