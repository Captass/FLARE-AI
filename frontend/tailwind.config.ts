import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          950: "#040814",
          900: "#081028",
          800: "#0c183c",
          700: "#10204f",
          600: "#162b66",
          500: "#1c3a88",
          400: "#274db2",
          300: "#3d64c8",
        },
        orange: {
          950: "#4d2100",
          900: "#7a3500",
          800: "#a34700",
          700: "#cc5a00",
          600: "#ef6d00",
          500: "#ff7c1a",
          400: "#ff9a4d",
          300: "#ffb880",
          200: "#ffd6b3",
          100: "#fff0e6",
          50:  "#fff8f2",
        },
        zinc: {
          950: "var(--zinc-950)",
          900: "var(--zinc-900)",
        },
        fg: "rgb(var(--fg) / <alpha-value>)",
      },
      darkMode: 'class',
      animation: {
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
        'float': 'float 6s ease-in-out infinite',
      },
      keyframes: {
        glow: {
          '0%': { boxShadow: '0 0 10px rgba(239, 109, 0, 0.2)' },
          '100%': { boxShadow: '0 0 25px rgba(239, 109, 0, 0.6)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        }
      }
    },
  },
  plugins: [],
};

export default config;
