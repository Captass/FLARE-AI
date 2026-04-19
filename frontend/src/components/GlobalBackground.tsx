"use client";

import { motion, useSpring, useTransform } from "framer-motion";
import { useEffect } from "react";

/**
 * GlobalBackground — Fond immersif pour l'application FLARE AI OS.
 *
 * Uses CSS variables for theming so it adapts to both light and dark modes.
 * All foreground elements use rgb(var(--fg)) which is 0,0,0 in light and 255,255,255 in dark.
 */
export default function GlobalBackground() {
  const mouseX = useSpring(0, { damping: 50, stiffness: 200 });
  const mouseY = useSpring(0, { damping: 50, stiffness: 200 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const x = (e.clientX / window.innerWidth) * 100;
      const y = (e.clientY / window.innerHeight) * 100;
      mouseX.set(x);
      mouseY.set(y);
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [mouseX, mouseY]);

  return (
    <div className="global-app-background fixed inset-0 z-[-1] pointer-events-none overflow-hidden">
      {/* ── Dot grid pattern ── */}
      <div
        className="absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage: `radial-gradient(circle, rgb(var(--fg) / 0.4) 1px, transparent 1px)`,
          backgroundSize: "32px 32px",
        }}
      />

      {/* ── Ambient liquid blobs ── */}
      <motion.div
        animate={{
          scale: [1, 1.1, 1],
          rotate: [0, 45, 0],
          borderRadius: ["40% 60% 70% 30% / 40% 50% 60% 40%", "60% 40% 30% 70% / 60% 30% 70% 40%", "40% 60% 70% 30% / 40% 50% 60% 40%"]
        }}
        style={{
           x: useTransform(mouseX, [0, 100], [-30, 30]),
           y: useTransform(mouseY, [0, 100], [-30, 30]),
        }}
        transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-[10%] left-[5%] w-[400px] h-[400px] bg-orange-500/15 blur-[80px]"
      />

      <motion.div
        animate={{
          scale: [1.1, 1, 1.1],
          rotate: [45, 0, 45],
          borderRadius: ["60% 40% 30% 70% / 60% 30% 70% 40%", "40% 60% 70% 30% / 40% 50% 60% 40%", "60% 40% 30% 70% / 60% 30% 70% 40%"]
        }}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
        className="absolute bottom-[20%] right-[10%] w-[500px] h-[500px] blur-[100px]"
        style={{
          background: `radial-gradient(circle, rgb(var(--fg) / 0.04) 0%, transparent 70%)`,
          x: useTransform(mouseX, [0, 100], [30, -30]),
          y: useTransform(mouseY, [0, 100], [30, -30]),
        }}
      />

      {/* Center ambient glow */}
      <motion.div
        animate={{
          x: [0, 15, -20, 0],
          y: [0, -15, 20, 0],
        }}
        transition={{ duration: 30, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full"
        style={{
          background: `radial-gradient(circle, rgb(var(--fg) / 0.03) 0%, transparent 60%)`,
        }}
      />

      {/* ── Floating geometric shapes ── */}
      {/* Small circles */}
      <motion.div
        animate={{ y: [-8, 8, -8], rotate: [0, 180, 360] }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-[18%] right-[12%] w-3 h-3 rounded-full border"
        style={{ borderColor: `rgb(var(--fg) / 0.08)` }}
      />
      <motion.div
        animate={{ y: [6, -6, 6] }}
        transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-[65%] left-[8%] w-2 h-2 rounded-full"
        style={{ backgroundColor: `rgb(var(--fg) / 0.05)` }}
      />
      <motion.div
        animate={{ y: [-5, 10, -5], x: [0, 5, 0] }}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-[40%] right-[25%] w-1.5 h-1.5 rounded-full bg-orange-500/20"
      />

      {/* Thin crosses / plus signs */}
      <motion.div
        animate={{ rotate: [0, 90, 0], opacity: [0.03, 0.08, 0.03] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-[30%] left-[20%] w-4 h-4"
      >
        <div className="absolute top-1/2 left-0 w-full h-px -translate-y-1/2" style={{ backgroundColor: `rgb(var(--fg) / 0.1)` }} />
        <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2" style={{ backgroundColor: `rgb(var(--fg) / 0.1)` }} />
      </motion.div>

      <motion.div
        animate={{ rotate: [45, 135, 45], opacity: [0.02, 0.06, 0.02] }}
        transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
        className="absolute bottom-[25%] right-[15%] w-5 h-5"
      >
        <div className="absolute top-1/2 left-0 w-full h-px -translate-y-1/2" style={{ backgroundColor: `rgb(var(--fg) / 0.1)` }} />
        <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2" style={{ backgroundColor: `rgb(var(--fg) / 0.1)` }} />
      </motion.div>

      {/* Small squares */}
      <motion.div
        animate={{ rotate: [0, 45, 0], y: [-4, 4, -4] }}
        transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-[55%] left-[35%] w-2.5 h-2.5 rounded-sm"
        style={{ border: `1px solid rgb(var(--fg) / 0.05)` }}
      />
      <motion.div
        animate={{ rotate: [45, 0, 45], y: [3, -5, 3] }}
        transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-[20%] left-[60%] w-3 h-3 rounded-sm"
        style={{ border: `1px solid rgb(var(--fg) / 0.05)` }}
      />

      {/* Hexagon-like shape */}
      <motion.div
        animate={{ rotate: [0, 60, 120, 180, 240, 300, 360] }}
        transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
        className="absolute bottom-[35%] left-[50%] w-6 h-6"
        style={{ border: `1px solid rgb(var(--fg) / 0.04)`, borderRadius: "30% 70% 70% 30% / 30% 30% 70% 70%" }}
      />

      {/* ── Thin line accents ── */}
      <motion.div
        animate={{ opacity: [0.02, 0.04, 0.02], scaleX: [0.8, 1, 0.8] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-[45%] left-[5%] w-20 h-px"
        style={{ background: `linear-gradient(to right, transparent, rgb(var(--fg) / 0.1), transparent)` }}
      />
      <motion.div
        animate={{ opacity: [0.01, 0.04, 0.01], scaleX: [1, 0.7, 1] }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-[70%] right-[8%] w-16 h-px"
        style={{ background: `linear-gradient(to right, transparent, rgb(var(--fg) / 0.05), transparent)` }}
      />

      {/* ── Mouse-following glow ── */}
      <motion.div
        className="absolute inset-0 opacity-30"
        style={{
          background: `radial-gradient(circle at var(--mouse-x, 50%) var(--mouse-y, 50%), rgb(var(--fg) / 0.02) 0%, transparent 40%)`
        } as any}
        animate={{
          "--mouse-x": mouseX.get() + "%",
          "--mouse-y": mouseY.get() + "%"
        } as any}
      />

      {/* ── Vignette edges for depth ── */}
      <div
        className="absolute inset-0"
        style={{
          background: "radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.15) 100%)",
        }}
      />
    </div>
  );
}
