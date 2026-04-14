"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronRight, HelpCircle } from "lucide-react";

interface TourStep {
  target: string;
  title: string;
  content: string;
  position: "top" | "bottom" | "left" | "right";
  padding: number;
}

interface InteractiveTourProps {
  onComplete: () => void;
}

const VIEWPORT_MARGIN = 16;
const MODAL_FALLBACK_WIDTH = 320;
const MODAL_FALLBACK_HEIGHT = 220;
const MOBILE_BREAKPOINT = 768;
const POSITION_FALLBACKS: TourStep["position"][] = ["top", "right", "bottom", "left"];

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function useWindowSize() {
  const [size, setSize] = useState({
    width: typeof window !== "undefined" ? window.innerWidth : 0,
    height: typeof window !== "undefined" ? window.innerHeight : 0,
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleResize = () => {
      setSize({ width: window.innerWidth, height: window.innerHeight });
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return size;
}

const TOUR_STEPS: TourStep[] = [
  {
    target: "tour-sidebar-main",
    title: "Menu principal",
    content:
      "C'est le point de depart de l'application. Vous y retrouvez vos discussions, la memoire, les connaissances, les fichiers, les agents et les autres outils utiles.",
    position: "right",
    padding: 12,
  },
  {
    target: "tour-new-chat",
    title: "Nouvelle discussion",
    content:
      "Cliquez ici pour repartir sur une nouvelle conversation propre. C'est utile quand vous changez de sujet ou que vous voulez separer vos demandes.",
    position: "right",
    padding: 8,
  },
  {
    target: "tour-nav-knowledge",
    title: "Connaissances",
    content:
      "Ajoutez ici vos PDF, notes, documents internes ou contenus metier. FLARE AI pourra s'appuyer dessus pour repondre avec votre contexte et vos propres informations.",
    position: "right",
    padding: 8,
  },
  {
    target: "tour-nav-memory",
    title: "Memoire",
    content:
      "FLARE AI garde ici vos preferences et informations utiles: votre role, votre activite, vos habitudes ou vos objectifs. Vous pouvez les relire, les corriger ou en ajouter.",
    position: "right",
    padding: 8,
  },
  {
    target: "tour-nav-agents",
    title: "Agents",
    content:
      "Ouvrez ici les agents specialises. Ils servent a faire des taches plus precises, comme creer du contenu, travailler sur des visuels ou lancer des workflows plus structures.",
    position: "right",
    padding: 8,
  },
  {
    target: "tour-nav-dashboard",
    title: "Tableau de bord",
    content:
      "Suivez ici vos usages, vos couts, votre activite et les informations utiles sur votre compte. C'est la vue pratique pour garder le controle.",
    position: "right",
    padding: 8,
  },
  {
    target: "tour-nav-prompts",
    title: "Prompts",
    content:
      "Retrouvez ici vos prompts favoris, vos bases de travail et vos formulations utiles. Vous pouvez les reutiliser en un clic pour gagner du temps.",
    position: "right",
    padding: 8,
  },
  {
    target: "tour-settings",
    title: "Parametres",
    content:
      "Gerez ici votre profil, votre abonnement, vos reglages et l'apparence de l'application. C'est aussi ici que vous adaptez l'experience a votre usage.",
    position: "top",
    padding: 12,
  },
  {
    target: "tour-chat-input",
    title: "Zone de saisie",
    content:
      "Ecrivez ici votre demande. Vous pouvez poser une question, demander un document, une image, une video, une analyse ou une action precise. FLARE AI choisit ensuite le bon outil.",
    position: "top",
    padding: 16,
  },
  {
    target: "tour-attach-file",
    title: "Joindre un fichier",
    content:
      "Ajoutez ici un document, une image ou un autre fichier a analyser. FLARE AI peut lire, resumer, extraire ou utiliser ce fichier dans la suite de la conversation.",
    position: "top",
    padding: 8,
  },
  {
    target: "tour-voice",
    title: "Micro",
    content:
      "Parlez naturellement. FLARE AI transcrit votre voix avant l'envoi, ce qui est pratique sur mobile ou quand vous voulez aller plus vite.",
    position: "top",
    padding: 8,
  },
  {
    target: "tour-deep-research",
    title: "Mode raisonnement",
    content:
      "Utilisez ce mode pour les demandes plus complexes. FLARE AI prend plus de temps pour analyser, structurer et produire une reponse plus solide.",
    position: "top",
    padding: 8,
  },
  {
    target: "tour-top-actions",
    title: "Profil",
    content:
      "Retrouvez ici votre compte, vos integrations, vos acces rapides et la deconnexion. C'est votre compte personnel en haut de l'application.",
    position: "left",
    padding: 8,
  },
];

export default function InteractiveTour({ onComplete }: InteractiveTourProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(true);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [modalSize, setModalSize] = useState({
    width: MODAL_FALLBACK_WIDTH,
    height: MODAL_FALLBACK_HEIGHT,
  });
  const windowSize = useWindowSize();
  const modalRef = useRef<HTMLDivElement | null>(null);

  const step = TOUR_STEPS[currentStep];
  const totalSteps = TOUR_STEPS.length;
  const progressPercent = ((currentStep + 1) / totalSteps) * 100;
  const needsSidebarOpen = useMemo(
    () =>
      step.target.startsWith("tour-nav") ||
      step.target === "tour-sidebar-main" ||
      step.target === "tour-new-chat" ||
      step.target === "tour-settings",
    [step.target]
  );

  const closeTour = useCallback(() => {
    setIsVisible(false);
    onComplete();
  }, [onComplete]);

  const measureTarget = useCallback(() => {
    if (!isVisible) return;

    if (needsSidebarOpen) {
      window.dispatchEvent(new Event("open-sidebar-tour"));
    }

    const element = document.getElementById(step.target);
    if (!element) {
      setTargetRect(null);
      return;
    }

    element.scrollIntoView({ behavior: "auto", block: "center", inline: "center" });

    requestAnimationFrame(() => {
      setTargetRect(element.getBoundingClientRect());
    });
  }, [isVisible, needsSidebarOpen, step.target]);

  useEffect(() => {
    const timers = [0, 180, 360, 540].map((delay) => window.setTimeout(measureTarget, delay));

    window.addEventListener("resize", measureTarget);
    window.addEventListener("scroll", measureTarget, true);

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
      window.removeEventListener("resize", measureTarget);
      window.removeEventListener("scroll", measureTarget, true);
    };
  }, [measureTarget, currentStep]);

  useEffect(() => {
    if (!modalRef.current) return;

    const updateModalSize = () => {
      if (!modalRef.current) return;
      const rect = modalRef.current.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setModalSize({ width: rect.width, height: rect.height });
      }
    };

    updateModalSize();

    if (typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(updateModalSize);
    observer.observe(modalRef.current);
    return () => observer.disconnect();
  }, [currentStep, windowSize.width, windowSize.height]);

  const handleNext = () => {
    if (currentStep < TOUR_STEPS.length - 1) {
      setCurrentStep((previous) => previous + 1);
      return;
    }

    closeTour();
  };

  if (!isVisible) return null;

  const hole = targetRect
    ? {
        t: targetRect.top - step.padding,
        l: targetRect.left - step.padding,
        r: targetRect.right + step.padding,
        b: targetRect.bottom + step.padding,
        w: targetRect.width + (step.padding * 2),
        h: targetRect.height + (step.padding * 2),
      }
    : {
        t: windowSize.height / 2,
        l: windowSize.width / 2,
        r: windowSize.width / 2,
        b: windowSize.height / 2,
        w: 0,
        h: 0,
      };

  const getModalStyle = (): React.CSSProperties => {
    const viewportWidth = Math.max(windowSize.width, 320);
    const viewportHeight = Math.max(windowSize.height, 320);
    const availableWidth = Math.max(viewportWidth - (VIEWPORT_MARGIN * 2), 220);
    const modalWidth = Math.min(modalSize.width || MODAL_FALLBACK_WIDTH, availableWidth);
    const maxModalHeight = Math.max(220, viewportHeight - (VIEWPORT_MARGIN * 2));
    const modalHeight = Math.min(modalSize.height || MODAL_FALLBACK_HEIGHT, maxModalHeight);
    const isMobileViewport = viewportWidth <= MOBILE_BREAKPOINT;

    if (isMobileViewport) {
      return {
        position: "fixed",
        left: `${VIEWPORT_MARGIN}px`,
        right: `${VIEWPORT_MARGIN}px`,
        bottom: `${VIEWPORT_MARGIN}px`,
        width: `calc(100vw - ${VIEWPORT_MARGIN * 2}px)`,
        maxWidth: "none",
        top: "auto",
        maxHeight: `${Math.max(260, viewportHeight - 96)}px`,
      };
    }

    if (!targetRect) {
      return {
        position: "fixed",
        left: "50%",
        top: "50%",
        transform: "translate(-50%, -50%)",
        width: `${modalWidth}px`,
        maxHeight: `${maxModalHeight}px`,
      };
    }

    const gap = 20;
    const candidatePositions = [step.position, ...POSITION_FALLBACKS.filter((position) => position !== step.position)];
    const freeSpace = {
      top: targetRect.top - step.padding - gap,
      bottom: viewportHeight - targetRect.bottom - step.padding - gap,
      left: targetRect.left - step.padding - gap,
      right: viewportWidth - targetRect.right - step.padding - gap,
    };

    const getDesiredPosition = (position: TourStep["position"]) => {
      switch (position) {
        case "top":
          return {
            left: targetRect.left + (targetRect.width / 2) - (modalWidth / 2),
            top: targetRect.top - step.padding - gap - modalHeight,
          };
        case "bottom":
          return {
            left: targetRect.left + (targetRect.width / 2) - (modalWidth / 2),
            top: targetRect.bottom + step.padding + gap,
          };
        case "left":
          return {
            left: targetRect.left - step.padding - gap - modalWidth,
            top: targetRect.top + (targetRect.height / 2) - (modalHeight / 2),
          };
        case "right":
        default:
          return {
            left: targetRect.right + step.padding + gap,
            top: targetRect.top + (targetRect.height / 2) - (modalHeight / 2),
          };
      }
    };

    let bestPlacement = { left: VIEWPORT_MARGIN, top: VIEWPORT_MARGIN };
    let bestPenalty = Number.POSITIVE_INFINITY;

    for (const position of candidatePositions) {
      const desired = getDesiredPosition(position);
      const left = clamp(
        desired.left,
        VIEWPORT_MARGIN,
        Math.max(VIEWPORT_MARGIN, windowSize.width - modalWidth - VIEWPORT_MARGIN)
      );
      const top = clamp(
        desired.top,
        VIEWPORT_MARGIN,
        Math.max(VIEWPORT_MARGIN, windowSize.height - modalHeight - VIEWPORT_MARGIN)
      );
      const penalty = Math.abs(left - desired.left) + Math.abs(top - desired.top);
      const fitPenalty =
        position === "top" || position === "bottom"
          ? Math.max(0, modalHeight - (position === "top" ? freeSpace.top : freeSpace.bottom))
          : Math.max(0, modalWidth - (position === "left" ? freeSpace.left : freeSpace.right));
      const totalPenalty = penalty + (fitPenalty * 3);

      if (totalPenalty < bestPenalty) {
        bestPenalty = totalPenalty;
        bestPlacement = { left, top };
      }

      if (totalPenalty === 0) break;
    }

    return {
      position: "fixed",
      left: `${bestPlacement.left}px`,
      top: `${bestPlacement.top}px`,
      width: `${modalWidth}px`,
      maxHeight: `${maxModalHeight}px`,
    };
  };

  const backdropClass =
    "fixed bg-black/60 backdrop-blur-md z-[400] pointer-events-auto border-[var(--border-glass)]";

  return (
    <div className="fixed inset-0 z-[400] pointer-events-none">
      <motion.div
        className={`${backdropClass} border-b`}
        animate={{ top: 0, left: 0, right: 0, height: Math.max(0, hole.t) }}
        transition={{ duration: 0.4, ease: "easeInOut" }}
        onClick={closeTour}
      />
      <motion.div
        className={`${backdropClass} border-t`}
        animate={{ top: hole.b, left: 0, right: 0, bottom: 0 }}
        transition={{ duration: 0.4, ease: "easeInOut" }}
        onClick={closeTour}
      />
      <motion.div
        className={`${backdropClass} border-r`}
        animate={{ top: hole.t, left: 0, width: Math.max(0, hole.l), height: hole.h }}
        transition={{ duration: 0.4, ease: "easeInOut" }}
        onClick={closeTour}
      />
      <motion.div
        className={`${backdropClass} border-l`}
        animate={{ top: hole.t, left: hole.r, right: 0, height: hole.h }}
        transition={{ duration: 0.4, ease: "easeInOut" }}
        onClick={closeTour}
      />

      <motion.div
        className="absolute z-[405] pointer-events-none rounded-xl border-2 border-[var(--text-primary)] shadow-[0_0_15px_rgba(255,255,255,0.1)_inset,0_0_15px_rgba(255,255,255,0.1)]"
        animate={{ top: hole.t, left: hole.l, width: hole.w, height: hole.h, opacity: targetRect ? 1 : 0 }}
        transition={{ duration: 0.4, ease: "easeInOut" }}
      />

      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep}
          ref={modalRef}
          initial={{ opacity: 0, scale: 0.9, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 10 }}
          transition={{ duration: 0.4 }}
          className="z-[410] pointer-events-auto w-[calc(100vw-32px)] max-w-[360px] overflow-y-auto overscroll-contain bg-[var(--bg-modal)] border border-[var(--border-glass)] rounded-2xl p-6 shadow-2xl"
          style={getModalStyle()}
        >
          <div className="mb-4 shrink-0">
            <div className="mb-4 flex items-center justify-between gap-3">
              <span className="inline-flex items-center rounded-full border border-[var(--border-glass)] bg-[var(--bg-hover)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                Guide interactif
              </span>
              <span className="text-[11px] font-medium text-[var(--text-muted)]">
                {currentStep + 1}/{totalSteps}
              </span>
            </div>
            <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-[var(--bg-hover)]">
              <motion.div
                className="h-full rounded-full bg-[var(--text-primary)]"
                animate={{ width: `${progressPercent}%` }}
                transition={{ duration: 0.35, ease: "easeOut" }}
              />
            </div>
          </div>

          <div className="flex items-center gap-3 mb-4 shrink-0">
            <div className="w-9 h-9 rounded-xl bg-[var(--bg-hover)] flex items-center justify-center text-[var(--text-primary)] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
              <HelpCircle size={18} />
            </div>
            <h3 className="font-bold text-[var(--text-primary)] tracking-tight">{step.title}</h3>
            <button
              onClick={closeTour}
              className="ml-auto rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] transition-colors"
            >
              <X size={14} />
            </button>
          </div>

          <p className="text-[13px] text-[var(--text-muted)] leading-relaxed mb-6">
            {step.content}
          </p>

          <div className="flex items-center justify-between gap-4 shrink-0">
            <div className="flex gap-1.5 flex-wrap max-w-[55%]">
              {TOUR_STEPS.map((_, index) => (
                <div
                  key={index}
                  className={`w-1.5 h-1.5 rounded-full transition-all shrink-0 ${
                    index === currentStep ? "bg-orange-500 w-3" : "bg-[var(--border-subtle)]"
                  }`}
                />
              ))}
            </div>
            <button
              onClick={handleNext}
              className="px-4 py-2 rounded-xl bg-[var(--text-primary)] hover:opacity-90 text-[rgb(var(--background))] text-[12px] font-bold flex items-center gap-2 transition-all active-press shrink-0 shadow-lg"
            >
              {currentStep === TOUR_STEPS.length - 1 ? "Terminer" : "Suivant"}
              <ChevronRight size={14} />
            </button>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
