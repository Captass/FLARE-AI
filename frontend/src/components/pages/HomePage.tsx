"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Bot, CreditCard, MessageSquare, Rocket, Users, ArrowRight } from "lucide-react";
import {
  getBillingFeatures,
  getChatbotOverview,
  getDashboardStats,
  getMyActivationRequest,
  type ActivationRequest,
  type BillingFeatures,
  type ChatbotOverview,
  type DashboardStats,
} from "@/lib/api";
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
  tone = "neutral",
  icon: Icon,
  loading,
  delay,
}: {
  label: string;
  value: string | number;
  tone?: "neutral" | "orange" | "navy";
  icon: typeof Bot;
  loading?: boolean;
  delay: number;
}) {
  if (loading) return <SkeletonCard />;

  const toneClass =
    tone === "orange"
      ? "text-orange-500"
      : tone === "navy"
      ? "text-[var(--accent-navy)]"
      : "text-[var(--text-primary)]";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay, ease: [0.16, 1, 0.3, 1] }}
      className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] px-5 py-4"
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-bold uppercase tracking-[0.1em] text-[var(--text-secondary)]">{label}</p>
        <Icon size={16} className="text-orange-500/80" />
      </div>
      <p className={`mt-2 text-3xl font-black tracking-tight ${toneClass}`}>{value}</p>
    </motion.div>
  );
}

function getActivationCopy(activation: ActivationRequest | null, planId: string | null, botFullyLive: boolean) {
  if (!planId || planId === "free") {
    return {
      title: "Choisissez votre offre",
      body: "La beta publique actuelle de FLARE est centree sur le chatbot Facebook, avec paiement local et activation assistee.",
      action: "Voir l'offre",
      target: "billing" as NavLevel,
    };
  }

  if (!activation) {
    return {
      title: "Offre activee, activation a lancer",
      body: "Votre abonnement est pret. Il reste a soumettre ou finaliser votre demande d'activation Facebook.",
      action: "Continuer l'activation",
      target: "billing" as NavLevel,
    };
  }

  const map: Record<string, { title: string; body: string; action?: string; target?: NavLevel }> = {
    awaiting_payment: {
      title: "Paiement en attente",
      body: "Votre plan est choisi. Envoyez votre paiement MVola ou Orange Money pour lancer la validation.",
      action: "Payer",
      target: "billing",
    },
    payment_submitted: {
      title: "Paiement recu, verification en cours",
      body: "L'equipe FLARE verifie votre preuve. Le plan applique s'affichera ici apres validation.",
      action: "Voir le dossier",
      target: "billing",
    },
    awaiting_flare_page_admin_access: {
      title: "Plan applique, acces page a confirmer",
      body: "Votre paiement est valide. Confirmez que FLARE dispose bien de l'acces necessaire pour finaliser l'activation Facebook.",
      action: "Confirmer l'acces",
      target: "billing",
    },
    queued_for_activation: {
      title: "Plan applique, activation en file",
      body: "Votre abonnement est actif et votre chatbot attend sa prise en charge par un technicien FLARE.",
      action: "Suivre l'activation",
      target: "billing",
    },
    activation_in_progress: {
      title: "Activation en cours",
      body: "Le chatbot Facebook est en configuration par FLARE. Vous pourrez le piloter depuis le hub chatbot.",
      action: "Suivre l'activation",
      target: "billing",
    },
    testing: {
      title: "Test Messenger en cours",
      body: "Le paiement est valide, le plan est applique et l'equipe teste maintenant la mise en ligne.",
      action: "Voir le statut",
      target: "billing",
    },
    active: {
      title: botFullyLive ? "Chatbot actif" : "Abonnement actif",
      body: botFullyLive
        ? "Votre abonnement est actif et votre chatbot Facebook est en ligne."
        : "Votre abonnement est actif. Verifiez la page Facebook pour confirmer la mise en ligne Messenger.",
      action: botFullyLive ? "Ouvrir mon chatbot" : "Verifier le chatbot",
      target: "chatbot",
    },
    blocked: {
      title: "Activation bloquee",
      body: activation.blocked_reason || "Un blocage doit etre traite avant de reprendre l'activation.",
      action: "Ouvrir le dossier",
      target: "billing",
    },
    rejected: {
      title: "Paiement a reprendre",
      body: activation.blocked_reason || "La preuve de paiement a ete refusee. Vous pouvez renvoyer une nouvelle preuve.",
      action: "Renvoyer une preuve",
      target: "billing",
    },
  };

  return map[activation.status] || {
    title: "Activation en cours",
    body: "Le dossier FLARE suit votre activation Facebook.",
    action: "Voir le dossier",
    target: "billing" as NavLevel,
  };
}

export default function HomePage({
  displayName,
  token,
  onPush,
}: HomePageProps) {
  const [overview, setOverview] = useState<ChatbotOverview | null>(null);
  const [dashStats, setDashStats] = useState<DashboardStats | null>(null);
  const [activationRequest, setActivationRequest] = useState<ActivationRequest | null>(null);
  const [billing, setBilling] = useState<BillingFeatures | null>(null);
  const [loadingKpi, setLoadingKpi] = useState(false);

  const fetchHub = useCallback(
    async (silent = false) => {
      if (!token) {
        setOverview(null);
        setDashStats(null);
        setActivationRequest(null);
        setBilling(null);
        setLoadingKpi(false);
        return;
      }
      if (!silent) setLoadingKpi(true);
      try {
        const [overviewRes, statsRes, activationRes, billingRes] = await Promise.allSettled([
          getChatbotOverview(token),
          getDashboardStats(token),
          getMyActivationRequest(token),
          getBillingFeatures(token),
        ]);
        if (overviewRes.status === "fulfilled") setOverview(overviewRes.value);
        if (statsRes.status === "fulfilled") setDashStats(statsRes.value);
        if (activationRes.status === "fulfilled") setActivationRequest(activationRes.value.activation_request);
        if (billingRes.status === "fulfilled") setBilling(billingRes.value);
      } finally {
        if (!silent) setLoadingKpi(false);
      }
    },
    [token],
  );

  useEffect(() => {
    if (!token) {
      setOverview(null);
      setDashStats(null);
      setActivationRequest(null);
      setBilling(null);
      setLoadingKpi(false);
      return;
    }
    void fetchHub(false);
    const intervalId = window.setInterval(() => void fetchHub(true), KPI_POLL_INTERVAL_MS);
    const onVisibility = () => {
      if (document.visibilityState === "visible") void fetchHub(true);
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [fetchHub, token]);

  const activePage = overview?.active_page;
  const botFullyLive =
    Boolean(activePage?.is_active && activePage?.webhook_subscribed && activePage?.direct_service_synced);
  const messagesCount = dashStats?.period?.messages ?? dashStats?.messages?.total ?? 0;
  const contactsCount = dashStats?.conversations?.messenger ?? dashStats?.conversations?.total ?? 0;
  const planId = billing?.plan_id ?? activationRequest?.applied_plan_id ?? null;
  const subscriptionActive =
    activationRequest?.subscription_status === "active" ||
    Boolean(planId && planId !== "free" && activationRequest?.status === "active");
  const botStatusLabel = botFullyLive ? "En ligne" : subscriptionActive ? "A verifier" : "En attente";
  const planLabel = useMemo(() => {
    const map: Record<string, string> = {
      free: "Free",
      starter: "Starter",
      pro: "Pro",
      business: "Business",
    };
    return map[String(planId || "free")] ?? String(planId || "Free");
  }, [planId]);
  const activationCopy = getActivationCopy(activationRequest, planId, botFullyLive);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto flex w-full max-w-[1000px] flex-col gap-10 px-4 py-8 md:px-8 md:py-12">
        <motion.header
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="relative overflow-hidden rounded-[32px] border border-[var(--border-default)] bg-[var(--bg-card)] p-8 md:p-12"
        >
          {/* Subtle background glow */}
          <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-orange-500/10 blur-3xl" />
          <div className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-[var(--accent-navy)]/10 blur-3xl" />

          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
            <div className="max-w-xl">
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2 }}
                className="mb-4 inline-flex items-center gap-2 rounded-full border border-[var(--border-default)] bg-[var(--surface-subtle)] px-3 py-1.5"
              >
                <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                  Beta Active
                </span>
              </motion.div>
              
              <h1 className="text-3xl font-black tracking-tight text-[var(--text-primary)] md:text-5xl leading-[1.1]">
                Bonjour <span className="text-orange-500">{displayName || "FLARE AI"}</span> 👋
              </h1>
              <p className="mt-4 text-base md:text-lg text-[var(--text-secondary)]">
                Bienvenue dans votre espace d&apos;automatisation centre sur le Chatbot Facebook.
              </p>
            </div>

            {/* Visual Header Graphic */}
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3, duration: 0.5 }}
              className="hidden md:flex shrink-0 items-center justify-center h-32 w-32 rounded-full bg-[var(--surface-subtle)] border border-[var(--border-default)] shadow-xl shadow-orange-500/5 relative"
            >
               <Bot size={48} className="text-orange-500 absolute" />
               <motion.div 
                 animate={{ rotate: 360 }} 
                 transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                 className="absolute inset-0 rounded-full border border-dashed border-orange-500/30"
               />
               <motion.div 
                 animate={{ rotate: -360 }} 
                 transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
                 className="absolute -inset-4 rounded-full border border-dashed border-[var(--accent-navy)]/20"
               />
            </motion.div>
          </div>
        </motion.header>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard label="Plan actif" value={loadingKpi ? "..." : planLabel} icon={CreditCard} tone="orange" loading={loadingKpi} delay={0.05} />
          <KpiCard label="Statut bot" value={loadingKpi ? "..." : botStatusLabel} icon={Bot} tone={botFullyLive ? "navy" : "neutral"} loading={loadingKpi} delay={0.1} />
          <KpiCard label="Messages" value={loadingKpi ? "..." : String(messagesCount)} icon={MessageSquare} loading={loadingKpi} delay={0.15} />
          <KpiCard label="Leads / contacts" value={loadingKpi ? "..." : String(contactsCount)} icon={Users} loading={loadingKpi} delay={0.2} />
        </div>

        <motion.section
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.1 }}
          className="relative overflow-hidden rounded-[28px] border border-[var(--border-default)] bg-[var(--bg-card)] p-6 md:p-8"
        >
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-orange-500/10 text-orange-500">
                <Rocket size={24} />
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--text-secondary)]">Prochaine action</p>
                <h2 className="mt-1 text-xl md:text-2xl font-bold tracking-tight text-[var(--text-primary)]">{activationCopy.title}</h2>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">{activationCopy.body}</p>
                
                {activationRequest?.applied_plan_id && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="rounded-full bg-[var(--surface-subtle)] px-2.5 py-1 text-[10px] font-medium text-[var(--text-secondary)] border border-[var(--border-default)]">
                      Plan demandé: {activationRequest.selected_plan_id}
                    </span>
                    <span className="rounded-full bg-[var(--accent-navy)]/10 px-2.5 py-1 text-[10px] font-medium text-[var(--accent-navy)] border border-[var(--accent-navy)]/20">
                      Plan appliqué: {activationRequest.applied_plan_id}
                    </span>
                    {activationRequest.subscription_status && (
                      <span className="rounded-full bg-[var(--surface-subtle)] px-2.5 py-1 text-[10px] font-medium text-[var(--text-secondary)] border border-[var(--border-default)]">
                        Statut: {activationRequest.subscription_status}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
            
            <button
              type="button"
              onClick={() => {
                if (!activationCopy.target) return;
                onPush(activationCopy.target);
              }}
              className="shrink-0 inline-flex items-center justify-center gap-2 rounded-2xl bg-orange-500 px-6 py-3.5 text-sm font-bold text-white transition-all hover:bg-orange-600 hover:scale-[1.02] active:scale-95 shadow-lg shadow-orange-500/20"
            >
              {activationCopy.action}
            </button>
          </div>
        </motion.section>

        <section className="grid gap-4 md:grid-cols-3">
          {[
            {
              title: "Mon Chatbot",
              body: "Gérez votre IA Facebook",
              action: "Ouvrir",
              target: "chatbot" as NavLevel,
              icon: <Bot size={32} strokeWidth={1.5} />,
              color: "text-orange-500",
              bg: "bg-orange-500/10"
            },
            {
              title: "Abonnement",
              body: "Paiement & Activation",
              action: "Gérer",
              target: "billing" as NavLevel,
              icon: <CreditCard size={32} strokeWidth={1.5} />,
              color: "text-[var(--accent-navy)] dark:text-[rgb(183,203,255)]",
              bg: "bg-[var(--accent-navy)]/10"
            },
            {
              title: "Paramètres",
              body: "Profil & Support",
              action: "Configurer",
              target: "settings" as NavLevel,
              icon: <Users size={32} strokeWidth={1.5} />,
              color: "text-blue-500",
              bg: "bg-blue-500/10"
            },
          ].map((card, index) => (
            <motion.button
              key={card.title}
              type="button"
              onClick={() => onPush(card.target)}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.15 + index * 0.06 }}
              whileHover={{ y: -4, transition: { duration: 0.2 } }}
              className="group relative overflow-hidden rounded-[24px] border border-[var(--border-default)] bg-[var(--bg-card)] p-6 text-left transition-all hover:border-[var(--border-strong)] hover:shadow-xl hover:shadow-black/5 dark:hover:shadow-white/5"
            >
              <div className="relative z-10">
                <div className={`mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl ${card.bg} ${card.color} transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3`}>
                  {card.icon}
                </div>
                <h3 className="text-xl font-bold text-[var(--text-primary)]">{card.title}</h3>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">{card.body}</p>
                <div className="mt-6 flex items-center text-xs font-bold uppercase tracking-wider text-[var(--text-primary)] opacity-60 transition-opacity group-hover:opacity-100">
                  {card.action} <ArrowRight size={14} className="ml-1 -translate-x-2 opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100" />
                </div>
              </div>
              <div className={`absolute -right-8 -top-8 h-32 w-32 rounded-full ${card.bg} blur-3xl opacity-0 transition-opacity duration-500 group-hover:opacity-100`} />
            </motion.button>
          ))}
        </section>
      </div>
    </div>
  );
}

