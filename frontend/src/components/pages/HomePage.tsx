"use client";
import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Bot,
  CheckCircle2,
  AlertTriangle,
  MessageSquare,
  Users,
  type LucideIcon,
} from "lucide-react";
import { getChatbotOverview, getDashboardStats, type ChatbotOverview, type DashboardStats } from "@/lib/api";
import { KPI_POLL_INTERVAL_MS } from "@/lib/kpiPolling";
import { SkeletonCard } from "@/components/SkeletonLoader";
import type { NavLevel } from "@/components/NavBreadcrumb";

interface HomePageProps {
  displayName: string;
  token?: string | null;
  onPush: (level: NavLevel) => void;
}

/* ── Brand SVG icons ── */

function FacebookLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

function GoogleLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className}>
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

function TikTokLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.27 6.27 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.34-6.34V9.4a8.16 8.16 0 0 0 4.77 1.53V7.48a4.85 4.85 0 0 1-1.01-.79z" />
    </svg>
  );
}

function InstagramLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zm0 10.162a3.999 3.999 0 1 1 0-7.998 3.999 3.999 0 0 1 0 7.998zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z" />
    </svg>
  );
}

function LinkedInLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

/* ── KPI Card ── */

function KpiCard({
  label,
  value,
  icon: Icon,
  loading,
  delay,
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  loading?: boolean;
  delay: number;
}) {
  if (loading) return <SkeletonCard />;
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay, ease: [0.16, 1, 0.3, 1] }}
      className="flex-1 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] px-5 py-4"
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-bold uppercase tracking-[0.1em] text-[var(--text-secondary)]">{label}</p>
        <Icon size={16} className="text-orange-500/80" />
      </div>
      <p className="mt-1 text-3xl font-black tracking-tight text-[var(--text-primary)] font-[family-name:var(--font-outfit)]">{value}</p>
    </motion.div>
  );
}

/* ── Platform tile ── */

type PlatformDef = {
  id: string;
  name: string;
  logo: React.FC<{ className?: string }>;
  logoColor: string;
  bgColor: string;
  available: boolean;
  nav?: NavLevel;
};

const PLATFORMS: PlatformDef[] = [
  { id: "facebook", name: "Facebook", logo: FacebookLogo, logoColor: "text-[#1877F2]", bgColor: "bg-[#1877F2]/10", available: true, nav: "facebook" as NavLevel },
  { id: "google", name: "Google", logo: GoogleLogo, logoColor: "", bgColor: "bg-[var(--surface-subtle)]", available: true, nav: "google" as NavLevel },
  { id: "tiktok", name: "TikTok", logo: TikTokLogo, logoColor: "text-[var(--text-primary)]", bgColor: "bg-[var(--surface-subtle)]", available: false },
  { id: "instagram", name: "Instagram", logo: InstagramLogo, logoColor: "text-[#E4405F]", bgColor: "bg-[#E4405F]/10", available: false },
  { id: "linkedin", name: "LinkedIn", logo: LinkedInLogo, logoColor: "text-[#0A66C2]", bgColor: "bg-[#0A66C2]/10", available: false },
];

export default function HomePage({
  displayName,
  token,
  onPush,
}: HomePageProps) {
  const [overview, setOverview] = useState<ChatbotOverview | null>(null);
  const [dashStats, setDashStats] = useState<DashboardStats | null>(null);
  const [loadingKpi, setLoadingKpi] = useState(false);

  const fetchKpis = useCallback(
    async (silent = false) => {
      if (!token) {
        setOverview(null);
        setDashStats(null);
        setLoadingKpi(false);
        return;
      }
      if (!silent) setLoadingKpi(true);
      try {
        const [ovResult, statsResult] = await Promise.allSettled([
          getChatbotOverview(token),
          getDashboardStats(token),
        ]);
        if (ovResult.status === "fulfilled") setOverview(ovResult.value);
        if (statsResult.status === "fulfilled") setDashStats(statsResult.value);
      } finally {
        if (!silent) setLoadingKpi(false);
      }
    },
    [token]
  );

  useEffect(() => {
    if (!token) {
      setOverview(null);
      setDashStats(null);
      setLoadingKpi(false);
      return;
    }
    void fetchKpis(false);
    const intervalId = window.setInterval(() => void fetchKpis(true), KPI_POLL_INTERVAL_MS);
    const onVisibility = () => {
      if (document.visibilityState === "visible") void fetchKpis(true);
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [fetchKpis, token]);

  const isActive = overview?.step === "complete";
  const messagesCount = dashStats?.period?.messages ?? dashStats?.messages?.total ?? 0;
  const contactsCount = dashStats?.conversations?.messenger ?? dashStats?.conversations?.total ?? 0;

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto flex w-full max-w-[860px] flex-col gap-10 px-4 py-10 md:px-8 md:py-14">

        {/* ── Hero ── */}
        <motion.header
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="text-center space-y-4"
        >
          <p className="text-base text-[var(--text-secondary)]">
            Bonjour <span className="font-bold text-[var(--text-primary)]">{displayName || "FLARE AI"}</span>
          </p>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-[var(--text-primary)] font-[family-name:var(--font-outfit)] leading-tight">
            Vos automatisations,{" "}
            <span className="text-orange-500">un seul endroit.</span>
          </h1>
        </motion.header>

        {/* ── KPIs ── */}
        <div className="flex flex-col gap-3 sm:flex-row">
          <KpiCard
            label="Status"
            value={loadingKpi ? "..." : isActive ? "En ligne" : overview ? "À configurer" : "--"}
            icon={Bot}
            loading={loadingKpi}
            delay={0.05}
          />
          <KpiCard
            label="Messages ce mois"
            value={loadingKpi ? "..." : String(messagesCount)}
            icon={MessageSquare}
            loading={loadingKpi}
            delay={0.1}
          />
          <KpiCard
            label="Leads captés"
            value={loadingKpi ? "..." : String(contactsCount)}
            icon={Users}
            loading={loadingKpi}
            delay={0.15}
          />
        </div>

        {/* ── Platforms ── */}
        <section>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="mb-5 text-xs font-bold uppercase tracking-[0.18em] text-[var(--text-secondary)]"
          >
            Plateformes connectées
          </motion.p>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
            {PLATFORMS.map((p, i) => {
              const Logo = p.logo;
              return (
                <motion.button
                  key={p.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  whileHover={p.available ? { scale: 1.04, y: -2 } : undefined}
                  whileTap={p.available ? { scale: 0.97 } : undefined}
                  transition={{ delay: 0.2 + i * 0.05, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                  onClick={p.available && p.nav ? () => onPush(p.nav!) : undefined}
                  disabled={!p.available}
                  className={`group relative flex flex-col items-center gap-3 rounded-[24px] border px-4 py-6 transition-all duration-300 ${
                    p.available
                      ? "border-[var(--border-default)] bg-[var(--bg-card)] hover:border-[var(--border-subtle)] hover:shadow-lg cursor-pointer"
                      : "border-[var(--border-faint)] bg-[var(--surface-subtle)] opacity-50 cursor-not-allowed"
                  }`}
                >
                  <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${p.bgColor} transition-transform duration-300 group-hover:scale-110`}>
                    <Logo className={`w-6 h-6 ${p.logoColor}`} />
                  </div>
                  <span className="text-sm font-bold text-[var(--text-primary)]">{p.name}</span>
                  {p.available ? (
                    <span className="text-xs font-bold uppercase tracking-[0.12em] text-orange-600">
                      Connecter →
                    </span>
                  ) : (
                    <span className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--text-secondary)]">
                      Bientôt
                    </span>
                  )}
                </motion.button>
              );
            })}
          </div>
        </section>

      </div>
    </div>
  );
}
