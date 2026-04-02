"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Zap, Bot, CheckCircle2, AlertTriangle, MessageSquare, Users } from "lucide-react";
import { getChatbotOverview, getDashboardStats, type ChatbotOverview, type DashboardStats } from "@/lib/api";
import { SkeletonCard } from "@/components/SkeletonLoader";
import type { NavLevel } from "@/components/NavBreadcrumb";

interface HomePageProps {
  displayName: string;
  orgName?: string;
  token?: string | null;
  onPush: (level: NavLevel) => void;
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

export default function HomePage({ displayName, orgName, token, onPush }: HomePageProps) {
  const [overview, setOverview] = useState<ChatbotOverview | null>(null);
  const [dashStats, setDashStats] = useState<DashboardStats | null>(null);
  const [loadingKpi, setLoadingKpi] = useState(false);

  useEffect(() => {
    if (!token) return;
    setLoadingKpi(true);
    Promise.allSettled([
      getChatbotOverview(token),
      getDashboardStats(token),
    ]).then(([ovResult, statsResult]) => {
      if (ovResult.status === "fulfilled") setOverview(ovResult.value);
      if (statsResult.status === "fulfilled") setDashStats(statsResult.value);
    }).finally(() => setLoadingKpi(false));
  }, [token]);

  const today = new Date().toLocaleDateString("fr-FR", {
    weekday: "long", day: "numeric", month: "long",
  });

  const isActive = overview?.step === "complete";
  const messagesCount = dashStats?.period?.messages ?? dashStats?.messages?.total ?? "—";
  const contactsCount = dashStats?.conversations?.messenger ?? dashStats?.conversations?.total ?? "—";

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-[900px] px-4 py-8 md:px-8 md:py-12 flex flex-col gap-8">

        {/* ── Header ── */}
        <motion.header
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="space-y-1"
        >
          <h1 className="text-3xl font-bold tracking-tight text-white/90">
            Bonjour, {displayName || "vous"} 👋
          </h1>
          <p className="text-lg text-[var(--text-muted)]">
            {orgName ? (
              <>{orgName} · </>
            ) : null}
            <span className="capitalize">{today}</span>
          </p>
        </motion.header>

        {/* ── KPI row ── */}
        <section aria-label="Indicateurs clés">
          <div className="flex flex-col sm:flex-row gap-3">
            <KpiCard
              label="Statut chatbot"
              value={loadingKpi ? "…" : isActive ? "Actif" : overview ? "Inactif" : "—"}
              icon={Bot}
              status={loadingKpi ? undefined : isActive ? "ok" : overview ? "warn" : undefined}
              loading={loadingKpi}
              delay={0.05}
            />
            <KpiCard
              label="Messages traités ce mois"
              value={loadingKpi ? "…" : String(messagesCount)}
              icon={MessageSquare}
              loading={loadingKpi}
              delay={0.1}
            />
            <KpiCard
              label="Contacts / leads captés"
              value={loadingKpi ? "…" : String(contactsCount)}
              icon={Users}
              loading={loadingKpi}
              delay={0.15}
            />
          </div>
        </section>

        {/* ── Accès rapide ── */}
        <section aria-label="Accès rapide">
          <motion.h2
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-sm font-medium text-white/25 uppercase tracking-[0.12em] mb-4"
          >
            Accès rapide
          </motion.h2>
          <div className="flex flex-col sm:flex-row gap-4">
            <QuickCard
              icon={Zap}
              iconColor="bg-orange-500/15 text-orange-400"
              title="Automatisations"
              description="Gérez votre chatbot Facebook, suivez vos clients et pilotez vos automatisations."
              onClick={() => onPush("automations")}
              delay={0.22}
            />
            <QuickCard
              icon={Bot}
              iconColor="bg-blue-500/15 text-blue-400"
              title="Assistant IA"
              description="Posez des questions, préparez du contenu et travaillez avec votre assistant intelligent."
              onClick={() => onPush("assistant")}
              delay={0.28}
            />
          </div>
        </section>

      </div>
    </div>
  );
}
