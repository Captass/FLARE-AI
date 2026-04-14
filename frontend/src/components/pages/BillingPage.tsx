"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Crown, CheckCircle2, ArrowRight, Sparkles, MessageSquare, Zap } from "lucide-react";
import { getBillingFeatures, type BillingFeatures } from "@/lib/api";
import { SkeletonCard } from "@/components/SkeletonLoader";
import type { NavLevel } from "@/components/NavBreadcrumb";
import { rememberActivationPlan, type ActivationPlanId } from "@/lib/activationFlow";

interface BillingPageProps {
  token?: string | null;
  getFreshToken?: (forceRefresh?: boolean) => Promise<string | null>;
  planLabel?: string;
  onPush?: (level: NavLevel) => void;
}

const PLANS = [
  {
    id: "starter",
    name: "Starter",
    price: "30 000",
    subtitle: "Boutique · Artisan · Indépendant",
    highlight: false,
    contact: false,
    cta: "Commencer",
    features: [
      "500 messages / mois",
      "1 page Facebook",
      "Chatbot IA 24h/24",
      "Catalogue limité à 10 articles",
      "Support par email",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    price: "60 000",
    subtitle: "Commerce actif · Plusieurs produits",
    highlight: true,
    contact: false,
    cta: "Choisir Pro",
    features: [
      "2 000 messages / mois",
      "1 page Facebook",
      "IA Vendeuse (Raisonnement)",
      "Catalogue jusqu'à 50 articles",
      "Script de vente IA inclus",
      "Gestion des commandes",
      "Support prioritaire",
    ],
  },
  {
    id: "business",
    name: "Business",
    price: "120 000",
    subtitle: "PME · Équipe commerciale",
    highlight: false,
    contact: false,
    cta: "Choisir Business",
    features: [
      "5 000 messages / mois",
      "Multi-pages Facebook",
      "IA Premium & avancée",
      "Catalogue étendu (500 articles)",
      "Rôles & permissions équipe",
      "Analytics avancés",
      "Support dédié",
    ],
  },
];

const PLAN_LABEL: Record<string, string> = {
  starter: "Starter",
  pro: "Pro",
  business: "Business",
  enterprise: "Entreprise",
  free: "Gratuit",
};

export default function BillingPage({ token, getFreshToken, planLabel: planLabelProp, onPush }: BillingPageProps) {
  const [billing, setBilling] = useState<BillingFeatures | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      const t = getFreshToken ? await getFreshToken() : token;
      if (!t) return;
      setLoading(true);
      getBillingFeatures(t)
        .then(setBilling)
        .catch(() => setBilling(null))
        .finally(() => setLoading(false));
    };
    void load();
  }, [token, getFreshToken]);

  const currentPlanId = billing?.plan_id ?? null;
  const resolvedPlanLabel =
    planLabelProp ??
    (currentPlanId ? (PLAN_LABEL[currentPlanId] ?? currentPlanId) : "Gratuit");

  const handleActivate = (plan: (typeof PLANS)[0]) => {
    rememberActivationPlan(plan.id as ActivationPlanId);
    onPush?.("chatbot-activation" as NavLevel);
  };

  const cardVariants = {
    hidden: { opacity: 0, y: 32 },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: { delay: 0.1 + i * 0.09, duration: 0.45, ease: [0.16, 1, 0.3, 1] },
    }),
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-[1020px] px-4 py-10 md:px-8 md:py-14 flex flex-col gap-12">

        {/* ── Header ── */}
        <motion.header
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="text-center space-y-2"
        >
          <span className="inline-block text-[10px] font-bold uppercase tracking-[0.2em] text-orange-500">
            Offres
          </span>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight text-[var(--text-primary)] font-[family-name:var(--font-outfit)]">
            Payez par <span className="text-orange-500">MVola</span> ou{" "}
            <span className="text-orange-500">Orange Money</span>.
          </h1>
          <p className="text-base text-[var(--text-muted)] max-w-lg mx-auto">
            Choisissez votre plan, l&apos;équipe FLARE active votre bot. Résultats visibles dès le premier jour.
          </p>
        </motion.header>

        {/* ── Plan actuel ── */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
          className="mx-auto w-full max-w-md rounded-[24px] border border-[var(--border-default)] bg-[var(--bg-card)] shadow-sm px-6 py-4 flex items-center gap-4"
        >
          {loading ? (
            <SkeletonCard lines={1} />
          ) : (
            <>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/10 shrink-0">
                <Crown size={18} className="text-orange-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--text-muted)]">Votre plan actuel</p>
                <p className="text-xl font-black tracking-tight text-[var(--text-primary)] font-[family-name:var(--font-outfit)]">
                  {resolvedPlanLabel}
                </p>
              </div>
              <span className="shrink-0 rounded-full bg-orange-500 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-white">
                Actif
              </span>
            </>
          )}
        </motion.div>

        {/* ── Plans Cards ── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 items-stretch pt-8">
          {PLANS.map((plan, i) => {
            const isCurrent = currentPlanId === plan.id;
            return (
              <motion.div
                key={plan.id}
                custom={i}
                variants={cardVariants}
                initial="hidden"
                animate="visible"
                className={`relative rounded-[32px] border p-8 md:p-10 flex flex-col gap-6 transition-all duration-500 group ${
                  plan.highlight
                    ? "border-orange-500/40 bg-orange-500/[0.03] shadow-2xl shadow-orange-500/10 scale-[1.02] z-10"
                    : "border-[var(--border-default)] bg-[var(--surface-subtle)] hover:border-[var(--border-subtle)] hover:bg-[var(--surface-overlay)] backdrop-blur-xl"
                }`}
              >
                {/* Shimmer blur background */}
                <div className="absolute inset-0 z-0 overflow-hidden rounded-[32px] pointer-events-none">
                  <div
                    className={`absolute inset-0 transition-opacity duration-700 blur-[30px] ${
                      plan.highlight ? "opacity-20 group-hover:opacity-40" : "opacity-0 group-hover:opacity-10"
                    }`}
                  >
                    <motion.div
                      animate={{ x: ["-100%", "200%"], scale: [1, 1.2, 1] }}
                      transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                      className={`absolute -inset-y-10 w-1/2 -skew-x-12 ${
                        plan.highlight ? "bg-orange-500/50" : "bg-[var(--text-primary)]/20"
                      }`}
                    />
                  </div>
                </div>

                {/* Popular badge */}
                {plan.highlight && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 rounded-full bg-orange-500 px-6 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-white shadow-xl z-20">
                    Le plus populaire
                  </div>
                )}

                {/* Current badge */}
                {isCurrent && !plan.highlight && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 rounded-full bg-[var(--text-primary)] px-6 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--surface-base)] shadow-xl z-20">
                    Plan actuel ✓
                  </div>
                )}
                {isCurrent && plan.highlight && (
                  <div className="absolute top-3 right-3 rounded-full bg-[var(--surface-overlay)] backdrop-blur px-3 py-1 text-[9px] font-bold uppercase tracking-widest text-orange-500 z-20">
                    Actuel ✓
                  </div>
                )}

                {/* Name & Price */}
                <div className="relative z-10">
                  <span className="text-[10px] uppercase font-bold tracking-[0.15em] text-orange-500">
                    {plan.name}
                  </span>
                  <div className="mt-4 flex items-baseline gap-1">
                    <span className="whitespace-nowrap text-5xl md:text-6xl font-black tracking-tight text-[var(--text-primary)] font-[family-name:var(--font-outfit)]">
                      {plan.price}
                    </span>
                    <span className="text-sm font-bold text-[var(--text-muted)]">Ar / mois</span>
                  </div>
                  <p className="mt-2 text-[11px] font-bold uppercase tracking-wide text-[var(--text-muted)]">
                    {plan.subtitle}
                  </p>
                </div>

                {/* Features */}
                <ul className="relative z-10 flex flex-col gap-3.5 flex-1 my-2">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-3 text-sm font-medium text-[var(--text-secondary)]">
                      <div className="w-5 h-5 rounded-full bg-orange-500/10 flex items-center justify-center shrink-0 mt-0.5">
                        <CheckCircle2 size={11} className="text-orange-500" />
                      </div>
                      {f}
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                <div className="relative z-10">
                  {isCurrent ? (
                    <div className="w-full rounded-2xl border border-[var(--border-default)] py-4 text-center text-[11px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
                      Plan actif ✓
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleActivate(plan)}
                      className={`w-full rounded-2xl py-5 text-[11px] font-bold uppercase tracking-widest transition-all duration-300 flex items-center justify-center gap-2 ${
                        plan.highlight
                          ? "bg-orange-500 text-white shadow-lg shadow-orange-500/20 hover:bg-orange-600 hover:scale-[1.02]"
                          : "border border-[var(--border-default)] text-[var(--text-primary)] hover:border-[var(--border-subtle)] hover:bg-[var(--surface-raised)]"
                      }`}
                    >
                      {plan.highlight ? <Zap size={13} /> : <ArrowRight size={13} />}
                      {plan.cta}
                    </button>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* ── Entreprise card ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="rounded-[32px] border border-[var(--border-default)] bg-[var(--surface-subtle)] px-8 py-7 flex flex-col sm:flex-row items-start sm:items-center gap-6"
        >
          <div className="flex-1 min-w-0">
            <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-orange-500">Entreprise</span>
            <h3 className="mt-2 text-2xl font-black tracking-tight text-[var(--text-primary)] font-[family-name:var(--font-outfit)]">
              Solution 100% sur mesure
            </h3>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              Infrastructure dédiée · Intégrations personnalisées · SLA garanti · Accompagnement complet
            </p>
          </div>
          <a
            href="mailto:contact@ramsflare.com?subject=Offre%20Entreprise%20FLARE%20AI"
            className="shrink-0 flex items-center gap-2 rounded-2xl border border-[var(--border-default)] bg-[var(--surface-raised)] px-7 py-4 text-[11px] font-bold uppercase tracking-widest text-[var(--text-primary)] hover:border-[var(--border-subtle)] hover:bg-[var(--surface-overlay)] transition-all duration-200"
          >
            <MessageSquare size={13} />
            Nous contacter
          </a>
        </motion.div>

        {/* ── Note bas ── */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-center text-xs text-[var(--text-muted)] -mt-4"
        >
          Paiement par MVola ou Orange Money · Activation sous 24h · Résiliation à tout moment
        </motion.p>

      </div>
    </div>
  );
}
