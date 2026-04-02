"use client";

import { useEffect, useState } from "react";
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
    <span className={`relative inline-flex aspect-[3917/3174] shrink-0 ${className}`}>
      <Image
        src="/brand/flare-mark.png"
        alt={alt}
        fill
        unoptimized
        priority={priority}
        className={`object-contain ${shouldInvert ? "brightness-0 invert" : "brightness-0"}`}
      />
    </span>
  );
}
