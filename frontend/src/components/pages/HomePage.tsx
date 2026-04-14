"use client";
import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Bot,
  CheckCircle2,
  AlertTriangle,
  MessageSquare,
  Users,
  Facebook,
  Search,
  Radio,
  Instagram,
  Linkedin,
  Globe,
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
function KpiCard({
  label,
  value,
  icon: Icon,
  accent = "navy",
  loading,
  delay,
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  accent?: "navy" | "orange";
  loading?: boolean;
  delay: number;
}) {
  if (loading) {
    return <SkeletonCard />;
  }
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.02 }}
      transition={{ duration: 0.3, delay, ease: [0.16, 1, 0.3, 1] }}
      className="min-w-0 flex-1 rounded-2xl border border-[var(--border-default)] bg-[var(--surface-base)] px-5 py-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <span className="text-sm font-medium leading-tight text-[var(--text-secondary)]">{label}</span>
          <span className="text-2xl font-bold leading-tight tracking-tight text-[var(--text-primary)]">{value}</span>
        </div>
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
            accent === "orange"
              ? "bg-orange-500/12 text-orange-500"
              : "bg-navy-500/12 text-navy-400"
          }`}
        >
          <Icon size={17} />
        </div>
      </div>
      {value === "En ligne" && (
        <div className="mt-3 flex items-center gap-1.5 text-sm font-medium text-navy-500">
          <CheckCircle2 size={13} />
          <span>Operationnel</span>
        </div>
      )}
      {value === "A configurer" && (
        <div className="mt-3 flex items-center gap-1.5 text-sm font-medium text-orange-500">
          <AlertTriangle size={13} />
          <span>Action requise</span>
        </div>
      )}
    </motion.div>
  );
}
function PlatformTile({
  icon: Icon,
  iconColor,
  title,
  description,
  availability,
  cta,
  locked = false,
  onClick,
  delay,
}: {
  icon: LucideIcon;
  iconColor: string;
  title: string;
  description: string;
  availability: string;
  cta: string;
  locked?: boolean;
  onClick?: () => void;
  delay: number;
}) {
  const CardTag = locked ? "div" : "button";
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={locked ? undefined : { scale: 1.02 }}
      whileTap={locked ? undefined : { scale: 0.98 }}
      transition={{ duration: 0.3, delay, ease: [0.16, 1, 0.3, 1] }}
      className="min-w-0"
    >
      <CardTag
        onClick={locked ? undefined : onClick}
        className={`group flex h-full w-full flex-col items-start gap-4 rounded-2xl border border-[var(--border-default)] bg-[var(--surface-base)] px-5 py-5 text-left transition-all duration-250 ${
          locked
            ? "cursor-not-allowed opacity-75"
            : "cursor-pointer hover:border-[var(--border-strong)] hover:bg-[var(--surface-overlay)]"
        }`}
        aria-label={title}
      >
        <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${iconColor} transition-transform duration-300 group-hover:scale-105`}>
          <Icon size={22} strokeWidth={1.8} />
        </div>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold tracking-tight text-[var(--text-primary)]">{title}</h3>
            <span
              className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.07em] ${
                locked
                  ? "bg-[var(--surface-subtle)] text-[var(--text-muted)]"
                  : "bg-orange-500/12 text-orange-500"
              }`}
            >
              {availability}
            </span>
          </div>
          <p className="max-w-[22rem] text-sm leading-relaxed text-[var(--text-secondary)]">{description}</p>
        </div>
        <span className="mt-auto text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">{cta}</span>
      </CardTag>
    </motion.div>
  );
}
export default function HomePage({
  displayName,
  token,
  onPush,
}: HomePageProps) {
  const [overview, setOverview] = useState<ChatbotOverview | null>(null);
  const [dashStats, setDashStats] = useState<DashboardStats | null>(null);
  const [loadingKpi, setLoadingKpi] = useState(false);
  const [lastKpiUpdate, setLastKpiUpdate] = useState<Date | null>(null);
  const fetchKpis = useCallback(
    async (silent = false) => {
      if (!token) {
        setOverview(null);
        setDashStats(null);
        setLastKpiUpdate(null);
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
        setLastKpiUpdate(new Date());
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
      setLastKpiUpdate(null);
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
  const today = new Date().toLocaleDateString("fr-FR", {
    weekday: "long", day: "numeric", month: "long",
  });
  const isActive = overview?.step === "complete";
  const messagesCount = dashStats?.period?.messages ?? dashStats?.messages?.total ?? 0;
  const contactsCount = dashStats?.conversations?.messenger ?? dashStats?.conversations?.total ?? 0;
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto flex w-full max-w-[980px] flex-col gap-8 px-4 py-8 md:px-8 md:py-12">
        <motion.header
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="space-y-3"
        >
          <span className="inline-flex items-center rounded-full border border-[var(--border-default)] bg-[var(--surface-subtle)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-secondary)]">
            Facebook - Google - TikTok - Instagram - LinkedIn
          </span>
          <h1 className="text-3xl font-bold tracking-tight text-[var(--text-primary)] md:text-4xl">
            Automatise tes plateformes. Vends plus sans complexite.
          </h1>
          <p className="max-w-[780px] text-base text-[var(--text-secondary)] md:text-lg">
            FLARE AI centralise tes automatisations marketing et commerciales. Tu lances, tu suis, tu optimises depuis un seul compte.
          </p>
          <p className="text-sm text-[var(--text-muted)]">
            Compte {displayName || "FLARE AI"} - <span className="capitalize">{today}</span>
          </p>
        </motion.header>
        <section aria-label="Indicateurs cles">
          {lastKpiUpdate && (
            <p className="mb-3 text-sm text-[var(--text-secondary)]">
              Indicateurs synchronises avec le serveur - actualisation automatique toutes les {Math.round(KPI_POLL_INTERVAL_MS / 1000)} s
            </p>
          )}
          <div className="flex flex-col gap-3 sm:flex-row">
            <KpiCard
              label="Automatisations en ligne"
              value={loadingKpi ? "..." : isActive ? "En ligne" : overview ? "A configurer" : "--"}
              icon={Bot}
              accent={isActive ? "navy" : "orange"}
              loading={loadingKpi}
              delay={0.05}
            />
            <KpiCard
              label="Actions executees ce mois"
              value={loadingKpi ? "..." : String(messagesCount)}
              icon={MessageSquare}
              accent="navy"
              loading={loadingKpi}
              delay={0.1}
            />
            <KpiCard
              label="Leads captes"
              value={loadingKpi ? "..." : String(contactsCount)}
              icon={Users}
              accent="orange"
              loading={loadingKpi}
              delay={0.15}
            />
          </div>
        </section>
        <section aria-label="Plateformes d'automatisation">
          <motion.h2
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="mb-4 text-sm font-medium uppercase tracking-[0.08em] text-[var(--text-muted)]"
          >
            Plateformes d'automatisation
          </motion.h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <PlatformTile
              icon={Facebook}
              iconColor="bg-blue-600/12 text-blue-600"
              title="Facebook"
              description="Automatise les messages, capte les leads et gere les conversations a grande echelle."
              availability="Disponible"
              cta="Ouvrir Facebook"
              onClick={() => onPush("facebook")}
              delay={0.22}
            />
            <PlatformTile
              icon={Search}
              iconColor="bg-[var(--accent-navy)]/15 text-[var(--accent-navy)]"
              title="Google"
              description="Centralise acquisition, campagnes et suivi de performance dans un flux clair."
              availability="Disponible"
              cta="Ouvrir Google"
              onClick={() => onPush("google")}
              delay={0.28}
            />
            <PlatformTile
              icon={Radio}
              iconColor="bg-[var(--surface-subtle)] text-[var(--text-secondary)]"
              title="TikTok"
              description="Automatise DM, qualification et reactivation des prospects TikTok."
              availability="Bientot"
              cta="Disponible bientot"
              locked
              delay={0.34}
            />
            <PlatformTile
              icon={Instagram}
              iconColor="bg-[var(--surface-subtle)] text-[var(--text-secondary)]"
              title="Instagram"
              description="Active reponses auto, tri des demandes et suivi des interactions."
              availability="Bientot"
              cta="Disponible bientot"
              locked
              delay={0.4}
            />
            <PlatformTile
              icon={Linkedin}
              iconColor="bg-[var(--surface-subtle)] text-[var(--text-secondary)]"
              title="LinkedIn"
              description="Structure la prospection B2B avec sequences et relances automatisees."
              availability="Bientot"
              cta="Disponible bientot"
              locked
              delay={0.46}
            />
            <PlatformTile
              icon={Globe}
              iconColor="bg-[var(--surface-subtle)] text-[var(--text-secondary)]"
              title="Site web"
              description="Capture les leads entrants avec formulaires et assistants connectes."
              availability="Bientot"
              cta="Disponible bientot"
              locked
              delay={0.52}
            />
          </div>
        </section>
      </div>
    </div>
  );
}
