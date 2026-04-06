"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  applyThemePreference,
  getStoredThemePreference,
  persistThemePreference,
  type ThemePreference,
} from "@/lib/theme";

function getThemeFromDocument(): ThemePreference {
  if (typeof document === "undefined") {
    return "light";
  }

  const root = document.documentElement;
  const dataTheme = root.getAttribute("data-theme");
  if (dataTheme === "dark" || dataTheme === "light") {
    return dataTheme;
  }

  return root.classList.contains("light") ? "light" : "dark";
}

export function useThemePreference() {
  const [theme, setThemeState] = useState<ThemePreference>(() => getThemeFromDocument());

  useEffect(() => {
    const nextTheme = getStoredThemePreference();
    applyThemePreference(nextTheme);
    setThemeState(nextTheme);
  }, []);

  useEffect(() => {
    applyThemePreference(theme);
    persistThemePreference(theme);
  }, [theme]);

  const setTheme = useCallback((nextTheme: ThemePreference) => {
    setThemeState(nextTheme);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => (prev === "light" ? "dark" : "light"));
  }, []);

  return useMemo(
    () => ({
      theme,
      resolvedTheme: theme,
      setTheme,
      toggleTheme,
    }),
    [setTheme, theme, toggleTheme]
  );
}
