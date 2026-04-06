export type ThemePreference = "light" | "dark";

export const THEME_STORAGE_KEY = "flare-theme";
export const DEFAULT_THEME: ThemePreference = "light";
const THEME_COLORS: Record<ThemePreference, string> = {
  light: "#fcfcfd",
  dark: "#050505",
};

export function normalizeThemePreference(value: string | null | undefined): ThemePreference {
  return value === "dark" ? "dark" : "light";
}

export function getStoredThemePreference(): ThemePreference {
  if (typeof window === "undefined") {
    return DEFAULT_THEME;
  }

  return normalizeThemePreference(window.localStorage.getItem(THEME_STORAGE_KEY));
}

export function applyThemePreference(theme: ThemePreference) {
  if (typeof document === "undefined") {
    return;
  }

  const root = document.documentElement;
  root.classList.toggle("light", theme === "light");
  root.classList.toggle("dark", theme === "dark");
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
  const themeColor = THEME_COLORS[theme];
  let metaThemeColor = document.querySelector('meta[name="theme-color"]');
  if (!metaThemeColor) {
    metaThemeColor = document.createElement("meta");
    metaThemeColor.setAttribute("name", "theme-color");
    document.head.appendChild(metaThemeColor);
  }
  metaThemeColor.setAttribute("content", themeColor);
}

export function persistThemePreference(theme: ThemePreference) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(THEME_STORAGE_KEY, theme);
}

export function getThemeInitScript() {
  return `
    (function() {
      try {
        var key = ${JSON.stringify(THEME_STORAGE_KEY)};
        var value = window.localStorage.getItem(key);
        var theme = value === "dark" ? "dark" : "light";
        var root = document.documentElement;
        root.classList.toggle("light", theme === "light");
        root.classList.toggle("dark", theme === "dark");
        root.dataset.theme = theme;
        root.style.colorScheme = theme;
        var themeColor = theme === "dark" ? ${JSON.stringify(THEME_COLORS.dark)} : ${JSON.stringify(THEME_COLORS.light)};
        var metaThemeColor = document.querySelector('meta[name="theme-color"]');
        if (!metaThemeColor) {
          metaThemeColor = document.createElement("meta");
          metaThemeColor.setAttribute("name", "theme-color");
          document.head.appendChild(metaThemeColor);
        }
        metaThemeColor.setAttribute("content", themeColor);
      } catch (error) {
        var root = document.documentElement;
        root.classList.add("light");
        root.classList.remove("dark");
        root.dataset.theme = "light";
        root.style.colorScheme = "light";
        var metaThemeColor = document.querySelector('meta[name="theme-color"]');
        if (!metaThemeColor) {
          metaThemeColor = document.createElement("meta");
          metaThemeColor.setAttribute("name", "theme-color");
          document.head.appendChild(metaThemeColor);
        }
        metaThemeColor.setAttribute("content", ${JSON.stringify(THEME_COLORS.light)});
      }
    })();
  `;
}
