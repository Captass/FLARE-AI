"use client";

import { Lock } from "lucide-react";
import { motion } from "framer-motion";
import React, { useState, useRef } from "react";

interface PlatformCardProps {
  /** Logo ou icône principale (JSX), taille recommandée 40-48px */
  icon: React.ReactNode;
  /** Nom de la plateforme ou du module */
  label: string;
  /** Description courte optionnelle */
  description?: string;
  /** Si true : carte verrouillée (opacité réduite, curseur not-allowed, cadenas) */
  locked?: boolean;
  /** Texte du tooltip sur carte verrouillée */
  lockTooltip?: string;
  /** Couleur de lueur au hover (ex: "#1877F2" pour Facebook) */
  glowColor?: string;
  /** Badge affiché en haut à droite de l'icône (ex: notification count) */
  badge?: React.ReactNode;
  /** Callback au clic (ignoré si locked=true) */
  onClick?: () => void;
  /** Classes CSS additionnelles */
  className?: string;
}

export default function PlatformCard({
  icon,
  label,
  description,
  locked = false,
  lockTooltip = "Bientôt disponible",
  glowColor,
  badge,
  onClick,
  className = "",
}: PlatformCardProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const tooltipTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMouseEnter = () => {
    if (locked) {
      tooltipTimer.current = setTimeout(() => setShowTooltip(true), 300);
    }
  };

  const handleMouseLeave = () => {
    if (tooltipTimer.current) clearTimeout(tooltipTimer.current);
    setShowTooltip(false);
  };

  const handleClick = () => {
    if (!locked && onClick) onClick();
  };

  // Glow style dynamique au hover
  const glowStyle = glowColor
    ? {
        "--platform-glow": glowColor,
      } as React.CSSProperties
    : undefined;

  return (
    <div
      className={`relative ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <motion.div
        onClick={handleClick}
        whileHover={locked ? {} : { scale: 1.02 }}
        whileTap={locked ? {} : { scale: 0.98 }}
        transition={{ type: "spring", stiffness: 400, damping: 28 }}
        style={glowStyle}
        className={`
          relative flex flex-col items-center gap-3 rounded-2xl p-5 text-center
          backdrop-blur-md border border-[var(--border-glass)]
          transition-all duration-250
          ${locked
            ? "bg-white/[0.015] opacity-50 cursor-not-allowed"
            : `bg-[var(--bg-glass)] cursor-pointer
               hover:bg-white/[0.06] hover:border-white/[0.12]
               hover:shadow-[0_12px_40px_rgba(0,0,0,0.28)]
               ${glowColor ? "hover:shadow-[0_0_32px_var(--platform-glow,transparent)]/20" : ""}`
          }
        `}
        role={locked ? undefined : "button"}
        tabIndex={locked ? -1 : 0}
        onKeyDown={(e) => {
          if (!locked && (e.key === "Enter" || e.key === " ")) handleClick();
        }}
        aria-label={locked ? `${label} — ${lockTooltip}` : label}
        aria-disabled={locked}
      >
        {/* Icon container + badge */}
        <div className="relative mt-1">
          <div
            className={`flex h-12 w-12 items-center justify-center rounded-xl
                        transition-all duration-200
                        ${locked ? "bg-white/[0.04]" : "bg-white/[0.06]"}`}
          >
            {icon}
          </div>

          {/* Badge */}
          {badge && (
            <div className="absolute -top-1.5 -right-1.5">
              {badge}
            </div>
          )}

          {/* Lock icon overlay for locked cards */}
          {locked && (
            <div className="absolute -bottom-1.5 -right-1.5 flex h-5 w-5 items-center justify-center
                            rounded-full bg-[rgb(var(--background))] border border-white/[0.08]">
              <Lock size={9} className="text-white/30" />
            </div>
          )}
        </div>

        {/* Label */}
        <span
          className={`text-base font-semibold leading-tight tracking-tight
                      ${locked ? "text-white/30" : "text-white/80"}`}
        >
          {label}
        </span>

        {/* Description */}
        {description && (
          <p
            className={`text-sm leading-snug max-w-[14rem]
                        ${locked ? "text-white/15" : "text-white/35"}`}
          >
            {description}
          </p>
        )}
      </motion.div>

      {/* Tooltip for locked cards */}
      {locked && showTooltip && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 z-50
                     whitespace-nowrap rounded-lg bg-[rgba(20,21,24,0.98)]
                     border border-white/[0.08] px-3 py-1.5
                     text-xs font-medium text-white/70 shadow-xl pointer-events-none"
          role="tooltip"
        >
          {lockTooltip}
        </motion.div>
      )}
    </div>
  );
}

/** Badge rouge de notification */
export function NotifBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span
      className="flex h-5 min-w-5 items-center justify-center rounded-full
                 bg-red-500 px-1.5 text-[10px] font-bold text-white
                 ring-2 ring-[rgb(var(--background))]"
      aria-label={`${count} notification${count > 1 ? "s" : ""}`}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}
