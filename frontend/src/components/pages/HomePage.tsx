"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Bot, CreditCard, MessageSquare, Rocket, Users } from "lucide-react";
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

function getActivationCopy(activation: ActivationRequest | null, planId: string | null) {
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
      title: "Plan applique, acces page requis",
      body: "Votre paiement est valide. Ajoutez maintenant FLARE comme admin de votre page Facebook pour poursuivre.",
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
      title: "Chatbot actif",
      body: "Votre abonnement est actif et votre chatbot Facebook est en ligne.",
      action: "Ouvrir mon chatbot",
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

  const isActive = overview?.step === "complete";
  const messagesCount = dashStats?.period?.messages ?? dashStats?.messages?.total ?? 0;
  const contactsCount = dashStats?.conversations?.messenger ?? dashStats?.conversations?.total ?? 0;
  const planId = billing?.plan_id ?? activationRequest?.applied_plan_id ?? null;
  const planLabel = useMemo(() => {
    const map: Record<string, string> = {
      free: "Free",
      starter: "Starter",
      pro: "Pro",
      business: "Business",
    };
    return map[String(planId || "free")] ?? String(planId || "Free");
  }, [planId]);
  const activationCopy = getActivationCopy(activationRequest, planId);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto flex w-full max-w-[920px] flex-col gap-8 px-4 py-10 md:px-8 md:py-14">
        <motion.header
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="space-y-4"
        >
          <p className="text-base text-[var(--text-secondary)]">
            Bonjour <span className="font-bold text-[var(--text-primary)]">{displayName || "FLARE AI"}</span>
          </p>
          <div className="max-w-3xl">
            <h1 className="text-3xl font-black tracking-tight text-[var(--text-primary)] md:text-4xl">
              Votre beta FLARE AI se concentre sur un seul moteur:
              <span className="text-orange-500"> le chatbot Facebook assiste.</span>
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-[var(--text-secondary)] md:text-base">
              Paiement local MVola ou Orange Money, activation manuelle par l&apos;equipe FLARE, puis pilotage simple de votre chatbot Facebook depuis un hub unique.
            </p>
          </div>
        </motion.header>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard label="Plan actif" value={loadingKpi ? "..." : planLabel} icon={CreditCard} tone="orange" loading={loadingKpi} delay={0.05} />
          <KpiCard label="Statut bot" value={loadingKpi ? "..." : isActive ? "En ligne" : "En attente"} icon={Bot} tone={isActive ? "navy" : "neutral"} loading={loadingKpi} delay={0.1} />
          <KpiCard label="Messages" value={loadingKpi ? "..." : String(messagesCount)} icon={MessageSquare} loading={loadingKpi} delay={0.15} />
          <KpiCard label="Leads / contacts" value={loadingKpi ? "..." : String(contactsCount)} icon={Users} loading={loadingKpi} delay={0.2} />
        </div>

        <motion.section
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.1 }}
          className="rounded-[28px] border border-[var(--border-default)] bg-[var(--bg-card)] p-6"
        >
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="max-w-2xl">
              <div className="flex items-center gap-2">
                <Rocket size={18} className="text-orange-500" />
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--text-secondary)]">Prochaine action</p>
              </div>
              <h2 className="mt-3 text-2xl font-bold tracking-tight text-[var(--text-primary)]">{activationCopy.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">{activationCopy.body}</p>
              {activationRequest?.applied_plan_id && (
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="rounded-full bg-[var(--surface-subtle)] px-3 py-1 text-[11px] font-medium text-[var(--text-secondary)]">
                    Plan demande: {activationRequest.selected_plan_id}
                  </span>
                  <span className="rounded-full bg-[var(--accent-navy)]/8 px-3 py-1 text-[11px] font-medium text-[var(--accent-navy)]">
                    Plan applique: {activationRequest.applied_plan_id}
                  </span>
                  {activationRequest.subscription_status && (
                    <span className="rounded-full bg-[var(--surface-subtle)] px-3 py-1 text-[11px] font-medium text-[var(--text-secondary)]">
                      Abonnement: {activationRequest.subscription_status}
                    </span>
                  )}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => {
                if (!activationCopy.target) return;
                onPush(activationCopy.target);
              }}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-orange-500 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-orange-600"
            >
              {activationCopy.action}
            </button>
          </div>
        </motion.section>

        <section className="grid gap-4 md:grid-cols-3">
          {[
            {
              title: "Mon chatbot Facebook",
              body: "Suivez l'etat du bot, vos conversations, vos commandes et les prochaines actions utiles.",
              action: "Ouvrir le chatbot",
              target: "chatbot" as NavLevel,
            },
            {
              title: "Offre / Paiement / Activation",
              body: "Choisissez votre plan, envoyez votre preuve et suivez l'activation assistee de bout en bout.",
              action: "Voir le dossier",
              target: "billing" as NavLevel,
            },
            {
              title: "Support / Parametres",
              body: "Mettez a jour vos preferences, votre profil et ouvrez un signalement si quelque chose bloque.",
              action: "Ouvrir le support",
              target: "settings" as NavLevel,
            },
          ].map((card, index) => (
            <motion.button
              key={card.title}
              type="button"
              onClick={() => onPush(card.target)}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.15 + index * 0.06 }}
              className="rounded-[24px] border border-[var(--border-default)] bg-[var(--bg-card)] p-5 text-left transition-colors hover:bg-[var(--surface-subtle)]"
            >
              <h3 className="text-lg font-bold text-[var(--text-primary)]">{card.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">{card.body}</p>
              <p className="mt-4 text-xs font-bold uppercase tracking-[0.12em] text-orange-500">{card.action}</p>
            </motion.button>
          ))}
        </section>
      </div>
    </div>
  );
}
