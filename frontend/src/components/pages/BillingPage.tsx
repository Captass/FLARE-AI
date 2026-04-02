"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Crown, CheckCircle2, Lock, ArrowRight, Calendar, Zap } from "lucide-react";
import { getBillingFeatures, type BillingFeatures, type PlanFeatures } from "@/lib/api";
import { SkeletonCard } from "@/components/SkeletonLoader";

interface BillingPageProps {
  token?: string | null;
  planLabel?: string;
}

// Module display
const MODULE_LIST = [
  { key: "has_leads", label: "Gestion des leads" },
  { key: "has_budget", label: "Suivi du budget" },
  { key: "has_portfolio", label: "Portfolio" },
  { key: "has_sales_script", label: "Script de vente" },
  { key: "has_chatbot_content", label: "Contenu IA chatbot" },
  { key: "has_multi_page", label: "Multi-pages Facebook" },
  { key: "has_team", label: "Équipe & collaboration" },
  { key: "has_image_generation", label: "Génération d'images" },
  { key: "has_file_generation", label: "Génération de fichiers" },
  { key: "has_advanced_analytics", label: "Analytics avancés" },
];

export default function BillingPage({ token, planLabel: planLabelProp }: BillingPageProps) {
  const [billing, setBilling] = useState<BillingFeatures | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    getBillingFeatures(token)
      .then(setBilling)
      .catch(() => setBilling(null))
      .finally(() => setLoading(false));
  }, [token]);

  const planLabel = planLabelProp ?? (billing?.plan_id ? billing.plan_id.charAt(0).toUpperCase() + billing.plan_id.slice(1) : "Gratuit");
  const expiresAt: string | null = null; // expires_at is in billing router, not in features endpoint

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-[760px] px-4 py-8 md:px-8 md:py-12 flex flex-col gap-8">

        {/* ── Header ── */}
        <motion.header
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="space-y-2"
        >
          <h1 className="text-3xl font-bold tracking-tight text-white/90">Abonnements</h1>
          <p className="text-lg text-[var(--text-muted)]">Votre plan actuel et vos modules</p>
        </motion.header>

        {/* ── Plan card ── */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.06, ease: [0.16, 1, 0.3, 1] }}
          className="rounded-2xl backdrop-blur-md bg-[var(--bg-glass)]
                     border border-[var(--border-glass)] shadow-[var(--shadow-card)]
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
                    <p className="text-sm text-white/40 font-medium">Plan actuel</p>
                    <p className="text-2xl font-bold text-white/90 tracking-tight">{planLabel}</p>
                  </div>
                </div>

                {expiresAt && (
                  <div className="flex items-center gap-2 text-sm text-white/35">
                    <Calendar size={13} />
                    <span>Expire le {expiresAt}</span>
                  </div>
                )}
              </div>

              {/* Upgrade CTA */}
              {billing?.features?.upgrade_to && (
                <a
                  href="#"
                  className="flex items-center justify-between rounded-xl
                             bg-orange-500/10 border border-orange-500/20
                             px-5 py-4 hover:bg-orange-500/15 hover:border-orange-500/30
                             transition-all duration-200 group"
                  aria-label={`Mettre à niveau vers ${billing.features.upgrade_to}`}
                >
                  <div className="flex items-center gap-3">
                    <Zap size={16} className="text-orange-400" />
                    <span className="text-base font-semibold text-orange-400">
                      Mettre à niveau →
                    </span>
                    <span className="text-sm text-white/35">
                      Passer au plan {billing.features.upgrade_to}
                    </span>
                  </div>
                  <ArrowRight size={16} className="text-orange-400/60 group-hover:translate-x-1 transition-transform" />
                </a>
              )}
            </>
          )}
        </motion.div>

        {/* ── Modules list ── */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          className="rounded-2xl backdrop-blur-md bg-[var(--bg-glass)]
                     border border-[var(--border-glass)] shadow-[var(--shadow-card)]
                     px-6 py-6 flex flex-col gap-2"
        >
          <p className="text-sm font-medium text-white/30 uppercase tracking-[0.1em] mb-4">
            Modules inclus
          </p>
          {loading ? (
            <SkeletonCard lines={5} />
          ) : (
            MODULE_LIST.map((mod) => {
              const features = billing?.features as PlanFeatures | undefined;
              const active = features?.[mod.key as keyof PlanFeatures] ?? false;
              return (
                <div key={mod.key} className="flex items-center justify-between py-2.5 border-b border-white/[0.04] last:border-0">
                  <span className={`text-base ${active ? "text-white/75" : "text-white/25"}`}>
                    {mod.label}
                  </span>
                  {active ? (
                    <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                  ) : (
                    <Lock size={14} className="text-white/20 shrink-0" />
                  )}
                </div>
              );
            })
          )}
        </motion.div>

      </div>
    </div>
  );
}
