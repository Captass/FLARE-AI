"use client";

import { motion } from "framer-motion";
import {
  ShieldCheck, Users, Wifi, UserPlus, DollarSign,
  Rocket, CreditCard, ShoppingBag, AlertCircle, ChevronRight,
} from "lucide-react";

type AdminTab = "menu" | "costs" | "connected" | "accounts" | "activations" | "payments" | "orders" | "reports";

interface AdminMenuProps {
  onNavigate: (tab: AdminTab) => void;
  stats: { totalUsers: number; onlineCount: number; newToday: number; totalCost: number };
}

function formatCost(val: number): string {
  if (!val || isNaN(val)) return "$0.00";
  return `$${val.toFixed(2)}`;
}

export default function AdminMenu({ onNavigate, stats }: AdminMenuProps) {
  const kpis = [
    { label: "Utilisateurs", val: stats.totalUsers, icon: Users, color: "text-[var(--text-primary)]" },
    { label: "En ligne", val: stats.onlineCount, icon: Wifi, color: "text-[var(--accent-navy)]" },
    { label: "Nouveaux (24h)", val: stats.newToday, icon: UserPlus, color: "text-[var(--accent-navy)]" },
    { label: "Coût Total", val: formatCost(stats.totalCost), icon: DollarSign, color: "text-orange-500" },
  ];

  const cards = [
    {
      id: "costs" as AdminTab,
      title: "Cost Intelligence",
      subtitle: "Consommation tokens & coûts par utilisateur",
      icon: DollarSign,
      accent: "orange",
      stat: formatCost(stats.totalCost),
      statLabel: "Coût total",
    },
    {
      id: "connected" as AdminTab,
      title: "Utilisateurs Connectés",
      subtitle: "Activité en temps réel & sessions actives",
      icon: Wifi,
      accent: "navy",
      stat: `${stats.onlineCount}`,
      statLabel: "En ligne",
    },
    {
      id: "accounts" as AdminTab,
      title: "Nouveaux Comptes",
      subtitle: "Inscriptions & croissance utilisateurs",
      icon: UserPlus,
      accent: "navy",
      stat: `${stats.newToday}`,
      statLabel: "Aujourd'hui",
    },
    {
      id: "activations" as AdminTab,
      title: "Activations",
      subtitle: "Demandes d'activation chatbot & suivi opérateur",
      icon: Rocket,
      accent: "orange",
      stat: "—",
      statLabel: "En attente",
    },
    {
      id: "payments" as AdminTab,
      title: "Paiements",
      subtitle: "Vérifier et valider les preuves de paiement",
      icon: CreditCard,
      accent: "navy",
      stat: "—",
      statLabel: "À vérifier",
    },
    {
      id: "orders" as AdminTab,
      title: "Commandes",
      subtitle: "Commandes Messenger de tous les clients",
      icon: ShoppingBag,
      accent: "navy",
      stat: "—",
      statLabel: "Total",
    },
    {
      id: "reports" as AdminTab,
      title: "Signalements",
      subtitle: "Problèmes et retours envoyés par les utilisateurs",
      icon: AlertCircle,
      accent: "orange",
      stat: "—",
      statLabel: "À traiter",
    },
  ];

  const accentStyles = {
    orange: {
      gradient: "from-orange-500/12 to-orange-500/4",
      border: "border-orange-500/18",
      icon: "text-orange-500",
    },
    navy: {
      gradient: "from-[var(--accent-navy)]/10 to-[var(--accent-navy)]/3",
      border: "border-[var(--accent-navy)]/18",
      icon: "text-[var(--accent-navy)]",
    },
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-10 bg-[rgb(var(--background))]">
      {/* Header */}
      <div className="flex items-center gap-4 mb-10">
        <div className="w-12 h-12 rounded-2xl bg-[var(--surface-subtle)] flex items-center justify-center shadow-sm border border-[var(--border-default)]">
          <ShieldCheck size={22} className="text-[var(--text-primary)]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight">Administration</h1>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="h-1.5 w-1.5 rounded-full bg-orange-500 animate-pulse" />
            <p className="text-[11px] font-medium tracking-[0.05em] text-[var(--text-secondary)]">
              FLARE AI — Admin Engine
            </p>
          </div>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        {kpis.map((kpi, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="p-6 rounded-[28px] bg-[var(--bg-card)] border border-[var(--border-default)] hover:bg-[var(--surface-subtle)] transition-all"
          >
            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-secondary)]">
                {kpi.label}
              </span>
              <kpi.icon size={15} className="text-[var(--text-secondary)]" />
            </div>
            <p className={`text-2xl font-bold font-mono tracking-tight ${kpi.color}`}>{kpi.val}</p>
          </motion.div>
        ))}
      </div>

      {/* Section cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {cards.map((card, i) => {
          const styles = accentStyles[card.accent as "orange" | "navy"];
          return (
            <motion.button
              key={card.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 + i * 0.07 }}
              onClick={() => onNavigate(card.id)}
              className={`p-7 rounded-[28px] bg-gradient-to-br ${styles.gradient} border ${styles.border} text-left hover:scale-[1.015] active:scale-[0.99] transition-all group cursor-pointer`}
            >
              <div className={`w-13 h-13 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-default)] flex items-center justify-center mb-5 w-12 h-12 ${styles.icon}`}>
                <card.icon size={26} />
              </div>
              <h3 className="text-base font-bold text-[var(--text-primary)] mb-1 leading-snug">{card.title}</h3>
              <p className="mb-5 text-[12px] leading-relaxed text-[var(--text-secondary)]">{card.subtitle}</p>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xl font-bold text-[var(--text-primary)] font-mono">{card.stat}</p>
                  <p className="text-[10px] font-medium tracking-[0.06em] uppercase text-[var(--text-secondary)] mt-0.5">{card.statLabel}</p>
                </div>
                <ChevronRight
                  size={18}
                  className="text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] group-hover:translate-x-1 transition-all"
                />
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
