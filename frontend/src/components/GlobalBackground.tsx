"use client";

import { motion, useSpring } from "framer-motion";
import { useEffect } from "react";

/**
 * GlobalBackground — Fond immersif pour l'application FLARE AI OS.
 *
 * Ajoute de la profondeur avec :
 * - Grille de points subtile
 * - Orbes flottants avec effets de lumière (gris/blanc, touches orange/navy)
 * - Glow dynamique qui suit le curseur
 * - Formes géométriques flottantes en arrière-plan
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
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `radial-gradient(circle, rgba(255,255,255,0.5) 1px, transparent 1px)`,
          backgroundSize: "32px 32px",
        }}
      />

      {/* ── Ambient glow orbs ── */}
      {/* Top-left: warm orange glow */}
      <motion.div
        animate={{
          x: [0, 30, -10, 0],
          y: [0, -20, -40, 0],
          scale: [1, 1.1, 0.95, 1],
        }}
        transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
        className="absolute -top-[15%] -left-[10%] w-[500px] h-[500px] rounded-full"
        style={{
          background: "radial-gradient(circle, rgba(249, 115, 22, 0.04) 0%, transparent 70%)",
        }}
      />

      {/* Bottom-right: cool navy glow */}
      <motion.div
        animate={{
          x: [0, -20, 15, 0],
          y: [0, 30, -10, 0],
          scale: [1, 0.95, 1.05, 1],
        }}
        transition={{ duration: 25, repeat: Infinity, ease: "easeInOut" }}
        className="absolute -bottom-[15%] -right-[10%] w-[600px] h-[600px] rounded-full"
        style={{
          background: "radial-gradient(circle, rgba(39, 77, 178, 0.04) 0%, transparent 70%)",
        }}
      />

      {/* Center: white ambient */}
      <motion.div
        animate={{
          x: [0, 15, -20, 0],
          y: [0, -15, 20, 0],
        }}
        transition={{ duration: 30, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full"
        style={{
          background: "radial-gradient(circle, rgba(255, 255, 255, 0.015) 0%, transparent 60%)",
        }}
      />

      {/* ── Floating geometric shapes ── */}
      {/* Small circles */}
      <motion.div
        animate={{ y: [-8, 8, -8], rotate: [0, 180, 360] }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-[18%] right-[12%] w-3 h-3 rounded-full border border-white/[0.04]"
      />
      <motion.div
        animate={{ y: [6, -6, 6] }}
        transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-[65%] left-[8%] w-2 h-2 rounded-full bg-white/[0.03]"
      />
      <motion.div
        animate={{ y: [-5, 10, -5], x: [0, 5, 0] }}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-[40%] right-[25%] w-1.5 h-1.5 rounded-full bg-orange-500/[0.06]"
      />

      {/* Thin crosses / plus signs */}
      <motion.div
        animate={{ rotate: [0, 90, 0], opacity: [0.03, 0.06, 0.03] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-[30%] left-[20%] w-4 h-4"
      >
        <div className="absolute top-1/2 left-0 w-full h-px bg-white/[0.08] -translate-y-1/2" />
        <div className="absolute left-1/2 top-0 h-full w-px bg-white/[0.08] -translate-x-1/2" />
      </motion.div>

      <motion.div
        animate={{ rotate: [45, 135, 45], opacity: [0.02, 0.05, 0.02] }}
        transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
        className="absolute bottom-[25%] right-[15%] w-5 h-5"
      >
        <div className="absolute top-1/2 left-0 w-full h-px bg-white/[0.06] -translate-y-1/2" />
        <div className="absolute left-1/2 top-0 h-full w-px bg-white/[0.06] -translate-x-1/2" />
      </motion.div>

      {/* Small squares */}
      <motion.div
        animate={{ rotate: [0, 45, 0], y: [-4, 4, -4] }}
        transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-[55%] left-[35%] w-2.5 h-2.5 border border-white/[0.03] rounded-sm"
      />
      <motion.div
        animate={{ rotate: [45, 0, 45], y: [3, -5, 3] }}
        transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-[20%] left-[60%] w-3 h-3 border border-white/[0.025] rounded-sm"
      />

      {/* Hexagon-like shape (using border trick) */}
      <motion.div
        animate={{ rotate: [0, 60, 120, 180, 240, 300, 360] }}
        transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
        className="absolute bottom-[35%] left-[50%] w-6 h-6 border border-white/[0.02] rounded-full"
        style={{ borderRadius: "30% 70% 70% 30% / 30% 30% 70% 70%" }}
      />

      {/* ── Thin line accents ── */}
      <motion.div
        animate={{ opacity: [0.02, 0.04, 0.02], scaleX: [0.8, 1, 0.8] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-[45%] left-[5%] w-20 h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent"
      />
      <motion.div
        animate={{ opacity: [0.01, 0.04, 0.01], scaleX: [1, 0.7, 1] }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-[70%] right-[8%] w-16 h-px bg-gradient-to-r from-transparent via-white/[0.05] to-transparent"
      />

      {/* ── Mouse-following glow ── */}
      <motion.div
        className="absolute inset-0 opacity-[var(--bg-glow-opacity,0.3)] dark:opacity-[0.3]"
        style={{
          background: `radial-gradient(circle at var(--mouse-x, 50%) var(--mouse-y, 50%), rgba(255, 255, 255, 0.03) 0%, transparent 40%)`
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
          background: "radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.3) 100%)",
        }}
      />
    </div>
  );
}
