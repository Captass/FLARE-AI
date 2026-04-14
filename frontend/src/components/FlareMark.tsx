"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import Image from "next/image";

interface FlareMarkProps {
  className?: string;
  tone?: "auto" | "dark" | "light";
  alt?: string;
  priority?: boolean;
}

export default function FlareMark({
  className = "w-10",
  tone = "auto",
  alt = "FLARE AI",
  priority = false,
}: FlareMarkProps) {
  const [isLightTheme, setIsLightTheme] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    const updateTheme = () => {
      setIsLightTheme(root.classList.contains("light"));
    };

    updateTheme();

    const observer = new MutationObserver(updateTheme);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });

    return () => observer.disconnect();
  }, []);

  const shouldInvert = tone === "dark" ? true : tone === "light" ? false : !isLightTheme;

  return (
    <span className={`relative inline-flex aspect-[3917/3174] shrink-0 ${className} group`}>
      {/* Dynamic Pulsing Glow */}
      <motion.div
        animate={{
          opacity: [0.1, 0.4, 0.1],
          scale: [1, 1.2, 1],
        }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        className="absolute inset-[-20%] bg-orange-500/10 blur-xl rounded-full"
      />

      <Image
        src="/brand/flare-mark.png"
        alt={alt}
        fill
        unoptimized
        priority={priority}
        className={`object-contain transition-all duration-300 ${shouldInvert ? "brightness-0 invert" : "brightness-0"} group-hover:scale-110`}
      />

      {/* Shimmer Overlay */}
      <motion.div
        animate={{
          x: ["-100%", "200%"],
        }}
        transition={{ duration: 3, repeat: Infinity, ease: "linear", delay: 1 }}
        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent skew-x-12 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity"
      />
    </span>
  );
}
