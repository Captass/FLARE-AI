"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { MessageCircle, Minimize2, SendHorizontal, Sparkles, X } from "lucide-react";
import {
  GuideContext,
  GuideViewKey,
  resolveGuideContent,
  resolveGuideViewKey,
} from "./guideAssistantContent";

type PanelState = "closed" | "open";

type ChatRole = "assistant" | "user";

interface ChatMessage {
  id: string;
  role: ChatRole;
  text: string;
}

interface FloatingContextualGuideProps {
  enabled: boolean;
  visible?: boolean;
  activeView: string;
  context: GuideContext;
  onNavigate: (target: GuideViewKey) => void;
  canAccessAdmin?: boolean;
  bottomClassName?: string;
}

const QUICK_PROMPTS = [
  "Explique cette page",
  "Que faire maintenant ?",
  "Pourquoi je suis bloque ?",
];

function buildIntro(title: string) {
  return `Salut, je suis FLARE AI. Je peux t'expliquer cette page et t'aider etape par etape. Tu es sur ${title}.`;
}

function readNextAction(content: ReturnType<typeof resolveGuideContent>) {
  if (content.stageCard?.nextAction) {
    return content.stageCard.nextAction;
  }
  const nextStep = content.steps.find((step) => step.status === "next")
    || content.steps.find((step) => step.status !== "done")
    || content.steps[0];
  if (nextStep) {
    return `Commence par: ${nextStep.label}.`;
  }
  return "Continue sur cette page, tu es sur la bonne etape.";
}

function readBlocker(content: ReturnType<typeof resolveGuideContent>, context: GuideContext) {
  if (!context.hasOrganizationScope) {
    return "Tu n'as pas encore d'espace organisation actif. Active un espace pour continuer.";
  }
  if (!context.hasSelectedFacebookPage && content.title.toLowerCase().includes("chatbot")) {
    return "Tu n'as pas encore choisi de page Facebook dans FLARE. Choisis la page cible d'abord.";
  }
  if (content.title.toLowerCase().includes("activation") && context.paymentStatus !== "verified") {
    return "Le paiement n'est pas encore valide. Envoie ta preuve puis attends la validation.";
  }
  if (content.title.toLowerCase().includes("activation") && context.paymentStatus === "verified" && !context.flarePageAdminConfirmed) {
    return "Le blocage vient de l'acces page. Confirme que FLARE est bien admin sur la page cible.";
  }
  const role = (context.userRole || "").toLowerCase();
  if (role === "read_only" || role === "reader") {
    return "Ton role est en lecture seule. Tu peux lire, mais pas lancer les actions critiques.";
  }
  if (content.warnings.length > 0) {
    return content.warnings[0];
  }
  return "Je ne vois pas de blocage critique ici. Passe a l'action suivante.";
}

function buildLocalReply(
  rawQuestion: string,
  content: ReturnType<typeof resolveGuideContent>,
  context: GuideContext,
) {
  const question = rawQuestion.toLowerCase();
  if (question.includes("bonjour") || question.includes("salut")) {
    return `Salut. Tu es sur ${content.title}. ${readNextAction(content)}`;
  }
  if (question.includes("explique") || question.includes("page") || question.includes("sert")) {
    return `${content.summary} ${readNextAction(content)}`;
  }
  if (question.includes("maintenant") || question.includes("faire") || question.includes("quoi")) {
    return readNextAction(content);
  }
  if (question.includes("bloque") || question.includes("bloqu") || question.includes("pourquoi")) {
    return readBlocker(content, context);
  }
  if (question.includes("merci")) {
    return "Avec plaisir. Dis-moi ce que tu veux faire ensuite, je te guide.";
  }
  return `${content.summary} ${readNextAction(content)}`;
}

export default function FloatingContextualGuide({
  enabled,
  visible = true,
  activeView,
  context,
  onNavigate,
  canAccessAdmin = false,
  bottomClassName,
}: FloatingContextualGuideProps) {
  const [panelState, setPanelState] = useState<PanelState>("closed");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const initializedViewRef = useRef<string | null>(null);

  const viewKey = useMemo(() => resolveGuideViewKey(activeView), [activeView]);
  const content = useMemo(() => resolveGuideContent(viewKey, context), [viewKey, context]);
  const isAssistantSurface = activeView === "assistant" || activeView === "chat";
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!enabled) {
      setPanelState("closed");
      setMessages([]);
      initializedViewRef.current = null;
    }
  }, [enabled]);

  useEffect(() => {
    if (!visible) {
      setPanelState("closed");
      setMessages([]);
      initializedViewRef.current = null;
    }
  }, [visible]);

  useEffect(() => {
    if (panelState !== "open") return;

    const isNewView = initializedViewRef.current !== viewKey;
    if (isNewView || messages.length === 0) {
      initializedViewRef.current = viewKey;
      setMessages([{ id: `intro-open-${viewKey}`, role: "assistant", text: buildIntro(content.title) }]);
    }
  }, [content.title, messages.length, panelState, viewKey]);

  useEffect(() => {
    if (scrollerRef.current) {
      scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight;
    }
  }, [messages]);

  if (!enabled || !visible) return null;

  const visibleCtas = content.ctas.filter((cta) => cta.target !== "admin" || canAccessAdmin).slice(0, 2);
  const bottomClass = bottomClassName || (isAssistantSurface ? "bottom-28 md:bottom-6" : "bottom-4 md:bottom-6");

  const sendUserMessage = (input: string) => {
    const clean = input.trim();
    if (!clean) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      text: clean,
    };

    const assistantMessage: ChatMessage = {
      id: `assistant-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      role: "assistant",
      text: buildLocalReply(clean, content, context),
    };

    setMessages((prev) => [...prev, userMessage, assistantMessage]);
    setDraft("");
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    sendUserMessage(draft);
  };

  const handleQuickPrompt = (prompt: string) => {
    sendUserMessage(prompt);
  };

  return (
    <div className={`pointer-events-none fixed right-4 z-40 ${bottomClass}`}>
      <AnimatePresence mode="wait">
        {panelState === "closed" && (
          <motion.button
            key="guide-closed"
            type="button"
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => setPanelState("open")}
            className="pointer-events-auto inline-flex h-12 items-center gap-2 rounded-full border border-orange-500/35 bg-[var(--surface-base)] px-4 text-[var(--text-primary)] shadow-[var(--shadow-card)] transition-colors hover:bg-[var(--surface-raised)]"
          >
            <MessageCircle size={16} className="text-orange-500" />
            <span className="text-sm font-semibold">Besoin d'aide ?</span>
          </motion.button>
        )}

        {panelState === "open" && (
          <motion.aside
            key="guide-open"
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            className="pointer-events-auto w-[min(94vw,380px)] overflow-hidden rounded-2xl border border-[var(--border-default)] bg-[var(--surface-base)] shadow-[var(--shadow-card)]"
          >
            <div className="flex items-start justify-between gap-3 border-b border-[var(--border-default)] px-3 py-2.5">
              <div className="min-w-0">
                <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border-default)] bg-[var(--surface-subtle)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-secondary)]">
                  <Sparkles size={12} className="text-orange-500" />
                  FLARE AI
                </div>
                <p className="mt-1 text-xs text-[var(--text-secondary)]">{content.title}</p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setPanelState("closed")}
                  className="rounded-lg p-1 text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]"
                  aria-label="Reduire l'aide"
                >
                  <Minimize2 size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => setPanelState("closed")}
                  className="rounded-lg p-1 text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]"
                  aria-label="Fermer l'aide"
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            <div className="p-3">
              <div
                ref={scrollerRef}
                className="max-h-[52vh] min-h-[200px] space-y-2 overflow-y-auto rounded-xl border border-[var(--border-default)] bg-[var(--surface-subtle)] p-2.5"
              >
                {messages.map((message) => (
                  <div key={message.id} className={`flex ${message.role === "assistant" ? "justify-start" : "justify-end"}`}>
                    <div
                      className={`max-w-[86%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                        message.role === "assistant"
                          ? "border border-[var(--border-default)] bg-[var(--surface-base)] text-[var(--text-primary)]"
                          : "bg-orange-500/18 text-[var(--text-primary)]"
                      }`}
                    >
                      {message.text}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-2 flex flex-wrap gap-1.5">
                {QUICK_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => handleQuickPrompt(prompt)}
                    className="rounded-full border border-[var(--border-default)] bg-[var(--surface-base)] px-2.5 py-1 text-[11px] font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-raised)]"
                  >
                    {prompt}
                  </button>
                ))}
              </div>

              {visibleCtas.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {visibleCtas.map((cta) => (
                    <button
                      key={cta.id}
                      type="button"
                      onClick={() => onNavigate(cta.target)}
                      className="rounded-full border border-orange-500/30 bg-orange-500/12 px-2.5 py-1 text-[11px] font-semibold text-[var(--text-primary)] transition-colors hover:bg-orange-500/20"
                    >
                      Aller: {cta.label}
                    </button>
                  ))}
                </div>
              )}

              <form onSubmit={handleSubmit} className="mt-2 flex items-center gap-2">
                <input
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder="Ecris ta question..."
                  className="h-10 w-full rounded-full border border-[var(--border-default)] bg-[var(--surface-base)] px-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-orange-500/40"
                />
                <button
                  type="submit"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-orange-500/40 bg-orange-500/16 text-[var(--text-primary)] transition-colors hover:bg-orange-500/24"
                  aria-label="Envoyer"
                >
                  <SendHorizontal size={16} />
                </button>
              </form>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </div>
  );
}
