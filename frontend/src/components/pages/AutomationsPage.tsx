"use client";

import { motion } from "framer-motion";
import PlatformCard from "@/components/PlatformCard";
import type { NavLevel } from "@/components/NavBreadcrumb";

interface AutomationsPageProps {
  onPush: (level: NavLevel) => void;
}

// ── Platform logos inline SVG ─────────────────────────────────────────────────

function FacebookLogo() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="#1877F2">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
    </svg>
  );
}

function GoogleLogo() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  );
}

function InstagramLogo() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="url(#ig-grad)">
      <defs>
        <linearGradient id="ig-grad" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#f09433"/>
          <stop offset="25%" stopColor="#e6683c"/>
          <stop offset="50%" stopColor="#dc2743"/>
          <stop offset="75%" stopColor="#cc2366"/>
          <stop offset="100%" stopColor="#bc1888"/>
        </linearGradient>
      </defs>
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
    </svg>
  );
}

function LinkedInLogo() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="#0A66C2">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
    </svg>
  );
}

function ShopifyLogo() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="#96bf48">
      <path d="M15.337.925c-.06-.018-.12-.024-.186-.024-.054 0-.108.006-.162.018C14.883.937 14.037 1.303 13.605 1.471c-.366-1.053-.939-2.019-1.985-2.019-.03 0-.06 0-.09.003C11.265-1.025 10.893-1.5 10.449-1.5c-3.705 0-5.49 4.647-6.045 7.005-.024.09-.042.183-.048.273-.633.195-1.083.336-1.143.357-.354.111-.366.123-.411.459-.033.249-.999 7.734-.999 7.734L14.367 16.5l5.799-1.254S15.513 1.023 15.337.925zM11.673 2.283c-.015 0-.024 0-.036.003-.012 0-.024.003-.036.003-.396.033-.78.465-.974.819-.165-.027-.333-.051-.495-.057.18-.681.462-1.329.81-1.794.147.276.291.633.39 1.026h.341zm1.008 3.372l-1.95.597c.18-.69.54-1.35.987-1.794.168.366.312.84.372 1.266-.135-.03-.273-.051-.411-.069h.002zM12 4.578l-.168.048a3.97 3.97 0 00-.369-1.008c.162.054.321.12.471.204L12 4.578zM10.878 1.992c.114 0 .228.012.339.042-.111.144-.219.306-.318.492a2.994 2.994 0 00-.438-.036c.138-.312.279-.498.417-.498zM13.218 2.4c.18.468.312.978.378 1.5l-.84.255c.114-.459.279-.915.462-1.257zM12.75.243c.03.018.054.036.072.054a1.617 1.617 0 01-.384.246c-.09-.396-.219-.726-.372-.981.255.156.498.402.684.681z"/>
    </svg>
  );
}

function GlobeLogo() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="text-white/40">
      <circle cx="12" cy="12" r="10"/>
      <path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/>
    </svg>
  );
}

// ── Platform definitions ──────────────────────────────────────────────────────

const PLATFORMS = [
  {
    id: "facebook",
    label: "Facebook",
    description: "Chatbot IA, Community Manager, Content",
    icon: <FacebookLogo />,
    locked: false,
    glowColor: "#1877F2",
    navLevel: "facebook" as NavLevel,
  },
  {
    id: "google",
    label: "Google",
    description: "Prospection, Google Ads, tableau de bord",
    icon: <GoogleLogo />,
    locked: false,
    glowColor: "#4285F4",
    navLevel: "google" as NavLevel,
  },
  {
    id: "instagram",
    label: "Instagram",
    description: "Publications, Stories, DM automatisés",
    icon: <InstagramLogo />,
    locked: true,
  },
  {
    id: "linkedin",
    label: "LinkedIn",
    description: "B2B, prospection et contenu pro",
    icon: <LinkedInLogo />,
    locked: true,
  },
  {
    id: "shopify",
    label: "Shopify",
    description: "E-commerce, commandes et relances",
    icon: <ShopifyLogo />,
    locked: true,
  },
  {
    id: "website",
    label: "Site Web",
    description: "Chatbot, formulaires et SEO",
    icon: <GlobeLogo />,
    locked: true,
  },
];

export default function AutomationsPage({ onPush }: AutomationsPageProps) {
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-[860px] px-4 py-8 md:px-8 md:py-12 flex flex-col gap-8">

        {/* ── Header ── */}
        <motion.header
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="space-y-2"
        >
          <h1 className="text-3xl font-bold tracking-tight text-white/90">
            Automatisations
          </h1>
          <p className="text-lg text-[var(--text-muted)]">
            Choisissez une plateforme
          </p>
        </motion.header>

        {/* ── Platform grid ── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.05 }}
          className="grid grid-cols-2 gap-4 md:grid-cols-3"
          role="list"
          aria-label="Plateformes disponibles"
        >
          {PLATFORMS.map((platform, idx) => (
            <motion.div
              key={platform.id}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 + idx * 0.05, ease: [0.16, 1, 0.3, 1] }}
              role="listitem"
            >
              <PlatformCard
                icon={platform.icon}
                label={platform.label}
                description={platform.description}
                locked={platform.locked}
                glowColor={platform.glowColor}
                onClick={platform.navLevel ? () => onPush(platform.navLevel!) : undefined}
              />
            </motion.div>
          ))}
        </motion.div>

      </div>
    </div>
  );
}
