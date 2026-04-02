"use client";

import React from "react";
import { motion } from "framer-motion";

interface GlowRingProps {
  status: "active" | "inactive" | "error" | "pending";
  size?: number;
}

export function GlowRing({ status, size = 12 }: GlowRingProps) {
  const getColors = () => {
    switch (status) {
      case "active":
        return { ring: "border-emerald-500/50", glow: "bg-emerald-500", dot: "bg-emerald-400" };
      case "error":
        return { ring: "border-red-500/50", glow: "bg-red-500", dot: "bg-red-400" };
      case "pending":
        return { ring: "border-amber-500/50", glow: "bg-amber-500", dot: "bg-amber-400" };
      case "inactive":
      default:
        return { ring: "border-fg/20", glow: "bg-fg/30", dot: "bg-fg/40" };
    }
  };

  const colors = getColors();
  const pxSize = `${size}px`;

  return (
    <div className="relative flex items-center justify-center" style={{ width: pxSize, height: pxSize }}>
      {/* Outer spinning ring (only if active/pending/error) */}
      {status !== "inactive" && (
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 4, ease: "linear" }}
          className={`absolute rounded-full border border-transparent border-t-current opacity-60`}
          style={{ width: size + 8, height: size + 8, color: "inherit" }}
        />
      )}

      {/* Core glowing dot */}
      <div className={`absolute rounded-full ${colors.dot} z-10`} style={{ width: size - 4, height: size - 4 }} />
      
      {/* Pulsing aura */}
      {status !== "inactive" && (
        <motion.div
          animate={{ scale: [1, 1.8, 1], opacity: [0.4, 0, 0.4] }}
          transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
          className={`absolute rounded-full blur-[4px] ${colors.glow}`}
          style={{ width: size, height: size }}
        />
      )}
    </div>
  );
}
