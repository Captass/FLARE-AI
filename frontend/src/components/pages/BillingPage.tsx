"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Crown, CheckCircle2, Lock, ArrowRight, Calendar, Zap, Sparkles, MessageSquare } from "lucide-react";
import { getBillingFeatures, type BillingFeatures, type PlanFeatures } from "@/lib/api";
import { SkeletonCard } from "@/components/SkeletonLoader";
import type { NavLevel } from "@/components/NavBreadcrumb";

interface BillingPageProps {
  token?: string | null;
  getFreshToken?: (forceRefresh?: boolean) => Promise<string | null>;
  planLabel?: string;
  onPush?: (level: NavLevel) => void;
}

// Module display
const MODULE_LIST = [
  { key: "has_leads", label: "Gestion des leads" },
  { key: "has_budget", label: "Suivi du budget" },
  { key: "has_portfolio", label: "Portfolio" },
  { key: "has_sales_script", label: "Script de vente" },
  { key: "has_chatbot_content", label: "Contenu IA chatbot" },
  { key: "has_multi_page", label: "Multi-pages Facebook" },
  { key: "has_team", label: "Equipe & collaboration" },
  { key: "has_image_generation", label: "Generation d'images" },
  { key: "has_file_generation", label: "Generation de fichiers" },
  { key: "has_advanced_analytics", label: "Analytics avances" },
];

type Plan = {
  id: string;
  name: string;
  price: string;
  priceNote?: string;
  color: string;
  accent: string;
  popular?: boolean;
  contact?: boolean;
  features: string[];
};

const PLANS: Plan[] = [
  {
    id: "starter",
    name: "Starter",
    price: "30 000 Ar",
    priceNote: "/mois",
    color: "border-[var(--border-default)] bg-[var(--surface-base)]",
    accent: "text-[var(--text-primary)]",
    features: [
      "1 page Facebook",
      "Chatbot IA 24h/24",
      "Jusqu'a 500 conversations/mois",
      "Personnalisation basique",
      "Support par email",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    price: "60 000 Ar",
    priceNote: "/mois",
    color: "border-orange-500/25 bg-orange-500/[0.08]",
    accent: "text-orange-500",
    popular: true,
    features: [
      "1 page Facebook",
      "Chatbot IA 24h/24",
      "Conversations illimitees",
      "Personnalisation avancee",
      "Catalogue produits",
      "Gestion des commandes",
      "Support prioritaire",
    ],
  },
  {
    id: "business",
    name: "Business",
    price: "120 000 Ar",
    priceNote: "/mois",
    color: "border-[var(--accent-navy)]/25 bg-[var(--accent-navy)]/8",
    accent: "text-[var(--text-primary)]",
    features: [
      "Multi-pages Facebook",
      "Chatbot IA 24h/24",
      "Conversations illimitees",
      "Toutes les personnalisations",
      "Equipe & collaboration",
      "Analytics avances",
      "Support dedie",
    ],
  },
  {
    id: "enterprise",
    name: "Entreprise",
    price: "Sur devis",
    color: "border-[var(--border-default)] bg-[var(--surface-subtle)]",
    accent: "text-[var(--text-primary)]",
    contact: true,
    features: [
      "Solution sur mesure",
      "Infrastructure dediee",
      "Integrations personnalisees",
      "SLA garanti",
      "Accompagnement complet",
    ],
  },
];

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
  const planLabel = planLabelProp ?? (currentPlanId ? currentPlanId.charAt(0).toUpperCase() + currentPlanId.slice(1) : "Gratuit");
  const expiresAt: string | null = null;

  const handleActivate = (plan: Plan) => {
    if (plan.contact) {
      // Use href redirect (not window.open which causes blank page in web apps)
      window.location.href = "mailto:contact@ramsflare.com?subject=Offre%20Entreprise%20FLARE%20AI";
      return;
    }
    onPush?.("chatbot-activation" as NavLevel);
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-[900px] px-4 py-8 md:px-8 md:py-12 flex flex-col gap-10">

        {/* ── Header ── */}
        <motion.header
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="space-y-2"
        >
          <h1 className="text-3xl font-bold tracking-tight text-[var(--text-primary)]">Abonnements</h1>
          <p className="text-lg text-[var(--text-secondary)]">Votre plan actuel et les offres disponibles</p>
        </motion.header>

        {/* ── Plan card ── */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.06, ease: [0.16, 1, 0.3, 1] }}
          className="rounded-2xl bg-[var(--surface-base)]
                     border border-[var(--border-default)] shadow-[var(--shadow-card)]
                     px-6 py-6 flex flex-col gap-6"
        >
          {loading ? (
            <SkeletonCard lines={3} />
          ) : (
            <>
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-500/10">
                    <Crown size={20} className="text-orange-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[var(--text-secondary)]">Plan actuel</p>
                    <p className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">{planLabel}</p>
                  </div>
                </div>

                {expiresAt && (
                  <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                    <Calendar size={13} />
                    <span>Expire le {expiresAt}</span>
                  </div>
                )}
              </div>

              {/* Upgrade CTA */}
              {(billing?.features?.upgrade_to || (!currentPlanId || currentPlanId === "free")) && onPush && (
                <button
                  type="button"
                  onClick={() => onPush("chatbot-activation" as NavLevel)}
                  className="flex items-center justify-between rounded-xl
                             bg-orange-500/10 border border-orange-500/20
                             px-5 py-4 hover:bg-orange-500/15 hover:border-orange-500/30
                             transition-all duration-200 group text-left w-full"
                >
                  <div className="flex items-center gap-3">
                    <Zap size={16} className="text-orange-500" />
                    <span className="text-base font-semibold text-[var(--text-primary)]">
                      {(!currentPlanId || currentPlanId === "free") ? "Choisir un plan" : "Changer de plan"}
                    </span>
                    {billing?.features?.upgrade_to && (
                        <span className="text-sm text-[var(--text-secondary)]">
                        Passer au plan {billing.features.upgrade_to}
                      </span>
                    )}
                  </div>
                  <ArrowRight size={16} className="text-[var(--text-secondary)] group-hover:translate-x-1 transition-transform" />
                </button>
              )}
            </>
          )}
        </motion.div>

        {/* ── Modules list ── */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          className="rounded-2xl bg-[var(--surface-base)]
                     border border-[var(--border-default)] shadow-[var(--shadow-card)]
                     px-6 py-6 flex flex-col gap-2"
        >
          <p className="mb-4 text-sm font-medium text-[var(--text-secondary)]">
            Modules inclus dans votre plan
          </p>
          {loading ? (
            <SkeletonCard lines={5} />
          ) : (
            MODULE_LIST.map((mod) => {
              const features = billing?.features as PlanFeatures | undefined;
              const active = features?.[mod.key as keyof PlanFeatures] ?? false;
              return (
                <div key={mod.key} className="flex items-center justify-between border-b border-[var(--divide-default)] py-2.5 last:border-0">
                  <span className={`text-base ${active ? "text-[var(--text-primary)]" : "text-[var(--text-secondary)]"}`}>
                    {mod.label}
                  </span>
                  {active ? (
                    <CheckCircle2 size={16} className="shrink-0 text-orange-500" />
                  ) : (
                    <Lock size={14} className="shrink-0 text-[var(--text-muted)]" />
                  )}
                </div>
              );
            })
          )}
        </motion.div>

        {/* ── Plans comparison ── */}
        <motion.section
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
        >
          <p className="mb-5 text-sm font-medium text-[var(--text-secondary)]">
            Toutes les offres
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {PLANS.map((plan) => {
              const isCurrent = currentPlanId === plan.id;
              return (
                <div
                  key={plan.id}
                  className={`relative flex flex-col rounded-2xl border px-5 py-5 gap-4 transition-all duration-200 ${plan.color} ${
                    isCurrent ? "ring-1 ring-orange-500/40" : ""
                  }`}
                >
                  {/* Popular badge */}
                  {plan.popular && (
                    <span className="absolute -top-3 left-1/2 inline-flex -translate-x-1/2 items-center gap-1 rounded-full bg-orange-500 px-3 py-0.5 text-[11px] font-semibold text-black shadow-md">
                      <Sparkles size={10} />
                      Recommande
                    </span>
                  )}

                  {/* Current badge */}
                  {isCurrent && (
                    <span className="absolute -top-3 left-1/2 inline-flex -translate-x-1/2 items-center gap-1 rounded-full border border-[var(--accent-navy)]/30 bg-[var(--accent-navy)]/12 px-3 py-0.5 text-[11px] font-semibold text-[var(--text-primary)] shadow-md">
                      <CheckCircle2 size={10} />
                      Plan actuel
                    </span>
                  )}

                  {/* Name & price */}
                  <div>
                    <p className={`text-base font-bold ${plan.accent}`}>{plan.name}</p>
                    <p className="mt-1 text-2xl font-bold tracking-tight text-[var(--text-primary)]">
                      {plan.price}
                      {plan.priceNote && (
                        <span className="ml-1 text-sm font-normal text-[var(--text-secondary)]">{plan.priceNote}</span>
                      )}
                    </p>
                  </div>

                  {/* Features */}
                  <ul className="flex flex-col gap-2 flex-1">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm text-[var(--text-secondary)]">
                        <CheckCircle2 size={13} className="mt-0.5 shrink-0 text-orange-500" />
                        {f}
                      </li>
                    ))}
                  </ul>

                  {/* CTA */}
                  {isCurrent ? (
                    <div className="mt-auto pt-2 text-center text-sm font-medium text-[var(--text-primary)]">
                      Plan actif
                    </div>
                  ) : plan.contact ? (
                    <a
                      href="mailto:contact@ramsflare.com?subject=Offre%20Entreprise%20FLARE%20AI"
                      className="mt-auto flex items-center justify-center gap-2 rounded-xl border border-[var(--border-default)]
                                 bg-[var(--surface-subtle)] px-4 py-2.5 text-sm font-medium text-[var(--text-primary)]
                                 hover:bg-[var(--surface-raised)] transition-all duration-150"
                    >
                      <MessageSquare size={13} />
                      Nous contacter
                    </a>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleActivate(plan)}
                      className={`mt-auto flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-150 ${
                        plan.popular
                          ? "bg-orange-500 text-black hover:bg-orange-400 shadow-md"
                          : "border border-[var(--border-default)] bg-[var(--surface-subtle)] text-[var(--text-primary)] hover:bg-[var(--surface-raised)]"
                      }`}
                    >
                      Choisir ce plan
                      <ArrowRight size={13} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </motion.section>

      </div>
    </div>
  );
}

