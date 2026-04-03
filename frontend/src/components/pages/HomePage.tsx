"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Zap, Bot, CheckCircle2, AlertTriangle, MessageSquare, Users } from "lucide-react";
import { getChatbotOverview, getDashboardStats, type ChatbotOverview, type DashboardStats } from "@/lib/api";
import { KPI_POLL_INTERVAL_MS } from "@/lib/kpiPolling";
import { SkeletonCard } from "@/components/SkeletonLoader";
import type { NavLevel } from "@/components/NavBreadcrumb";

interface HomePageProps {
  displayName: string;
  orgName?: string;
  token?: string | null;
  currentScopeType?: "personal" | "organization";
  onPush: (level: NavLevel) => void;
  onCreateWorkspace?: () => void;
}

function KpiCard({
  label,
  value,
  icon: Icon,
  status,
  loading,
  delay,
}: {
  label: string;
  value: string | number;
  icon: typeof Zap;
  status?: "ok" | "warn";
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
      className="flex-1 min-w-0 rounded-2xl backdrop-blur-md
                 bg-[var(--bg-glass)] border border-[var(--border-glass)]
                 shadow-[var(--shadow-card)] px-5 py-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1 min-w-0">
          <span className="text-sm text-white/40 font-medium leading-tight">{label}</span>
          <span className="text-2xl font-bold text-white/90 leading-tight tracking-tight">
            {value}
          </span>
        </div>
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl
            ${status === "ok"
              ? "bg-emerald-500/10 text-emerald-400"
              : status === "warn"
              ? "bg-orange-500/10 text-orange-400"
              : "bg-white/[0.05] text-white/40"
            }`}
        >
          <Icon size={17} />
        </div>
      </div>
      {status === "ok" && (
        <div className="mt-3 flex items-center gap-1.5 text-sm text-emerald-400/80 font-medium">
          <CheckCircle2 size={13} />
          <span>Actif</span>
        </div>
      )}
      {status === "warn" && (
        <div className="mt-3 flex items-center gap-1.5 text-sm text-orange-400/80 font-medium">
          <AlertTriangle size={13} />
          <span>Action requise</span>
        </div>
      )}
    </motion.div>
  );
}

function QuickCard({
  icon: Icon,
  iconColor,
  title,
  description,
  onClick,
  delay,
}: {
  icon: typeof Zap;
  iconColor: string;
  title: string;
  description: string;
  onClick: () => void;
  delay: number;
}) {
  return (
    <motion.button
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.3, delay, ease: [0.16, 1, 0.3, 1] }}
      onClick={onClick}
      className="flex-1 min-w-0 flex flex-col items-start gap-4 rounded-2xl
                 backdrop-blur-md bg-[var(--bg-glass)] border border-[var(--border-glass)]
                 shadow-[var(--shadow-card)] px-6 py-6 text-left
                 hover:bg-white/[0.07] hover:border-white/[0.14]
                 hover:shadow-[0_16px_48px_rgba(0,0,0,0.32)]
                 transition-all duration-250 cursor-pointer group"
      aria-label={title}
    >
      <div
        className={`flex h-12 w-12 items-center justify-center rounded-2xl
                    ${iconColor} transition-transform duration-300 group-hover:scale-105`}
      >
        <Icon size={22} strokeWidth={1.8} />
      </div>
      <div className="space-y-1.5">
        <h3 className="text-xl font-semibold text-white/90 tracking-tight">{title}</h3>
        <p className="text-sm text-white/40 leading-relaxed max-w-[22rem]">{description}</p>
      </div>
    </motion.button>
  );
}

export default function HomePage({
  displayName,
  orgName,
  token,
  currentScopeType = "personal",
  onPush,
  onCreateWorkspace,
}: HomePageProps) {
  const [overview, setOverview] = useState<ChatbotOverview | null>(null);
  const [dashStats, setDashStats] = useState<DashboardStats | null>(null);
  const [loadingKpi, setLoadingKpi] = useState(false);
  const [lastKpiUpdate, setLastKpiUpdate] = useState<Date | null>(null);
  const isOrganizationScope = currentScopeType === "organization";

  const fetchKpis = useCallback(
    async (silent = false) => {
      if (!token || !isOrganizationScope) {
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
    [isOrganizationScope, token]
  );

  useEffect(() => {
    if (!token || !isOrganizationScope) {
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
  }, [fetchKpis, isOrganizationScope, token]);

  const today = new Date().toLocaleDateString("fr-FR", {
    weekday: "long", day: "numeric", month: "long",
  });

  const isActive = isOrganizationScope && overview?.step === "complete";
  const messagesCount = isOrganizationScope ? (dashStats?.period?.messages ?? dashStats?.messages?.total ?? 0) : 0;
  const contactsCount = isOrganizationScope ? (dashStats?.conversations?.messenger ?? dashStats?.conversations?.total ?? 0) : 0;

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-[900px] px-4 py-8 md:px-8 md:py-12 flex flex-col gap-8">

        {/* Header */}
        <motion.header
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="space-y-1"
        >
          <h1 className="text-3xl font-bold tracking-tight text-white/90">
            Bonjour, {displayName || "vous"}
          </h1>
          <p className="text-lg text-[var(--text-muted)]">
            {orgName ? (
              <>{orgName} - </>
            ) : null}
            <span className="capitalize">{today}</span>
          </p>
        </motion.header>

        {/* KPI row */}
        <section aria-label="Indicateurs cles">
          {!isOrganizationScope && (
            <div className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-[#ff7a1a]/20 bg-[#ff7a1a]/[0.05] px-4 py-3">
              <div>
                <p className="text-sm font-medium text-white/80">Aucun espace de travail actif</p>
                <p className="mt-1 text-xs text-white/40">
                  Creez votre espace pour connecter Facebook et lancer le chatbot.
                </p>
              </div>
              {onCreateWorkspace && (
                <button
                  onClick={onCreateWorkspace}
                  className="shrink-0 rounded-lg bg-[#ff7a1a] px-3 py-2 text-xs font-medium text-white"
                >
                  Creer mon espace
                </button>
              )}
            </div>
          )}
          {lastKpiUpdate && (
            <p className="text-sm text-white/35 mb-3">
              Indicateurs synchronises avec le serveur - actualisation automatique toutes les{" "}
              {Math.round(KPI_POLL_INTERVAL_MS / 1000)} s
            </p>
          )}
          <div className="flex flex-col sm:flex-row gap-3">
            <KpiCard
              label="Statut chatbot"
              value={loadingKpi ? "..." : isActive ? "Actif" : overview ? "Inactif" : "--"}
              icon={Bot}
              status={loadingKpi ? undefined : isActive ? "ok" : overview ? "warn" : undefined}
              loading={loadingKpi}
              delay={0.05}
            />
            <KpiCard
              label="Messages traites ce mois"
              value={loadingKpi ? "..." : String(messagesCount)}
              icon={MessageSquare}
              loading={loadingKpi}
              delay={0.1}
            />
            <KpiCard
              label="Contacts / leads captes"
              value={loadingKpi ? "..." : String(contactsCount)}
              icon={Users}
              loading={loadingKpi}
              delay={0.15}
            />
          </div>
        </section>

        {/* Acces rapide */}
        <section aria-label="Acces rapide">
          <motion.h2
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-sm font-medium text-white/25 uppercase tracking-[0.12em] mb-4"
          >
            Acces rapide
          </motion.h2>
          <div className="flex flex-col sm:flex-row gap-4">
            <QuickCard
              icon={Zap}
              iconColor="bg-orange-500/15 text-orange-400"
              title="Automatisations"
              description="Gerez votre chatbot Facebook, suivez vos clients et pilotez vos automatisations."
              onClick={() => onPush("automations")}
              delay={0.22}
            />
            <QuickCard
              icon={Bot}
              iconColor="bg-blue-500/15 text-blue-400"
              title="Assistant IA"
              description="Posez des questions, preparez du contenu et travaillez avec votre assistant intelligent."
              onClick={() => onPush("assistant")}
              delay={0.28}
            />
          </div>
        </section>

      </div>
    </div>
  );
}

