"use client";

import { CheckCircle2 } from "lucide-react";

export const EXECUTIVE_BENEFITS = [
  "Gain de temps",
  "Moins d’oublis",
  "Priorités claires",
  "Réponses prêtes",
  "Organisation automatique",
] as const;

interface ExecutiveBenefitBadgesProps {
  items?: readonly string[];
}

export default function ExecutiveBenefitBadges({ items = EXECUTIVE_BENEFITS }: ExecutiveBenefitBadgesProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <span
          key={item}
          className="inline-flex items-center gap-1.5 rounded-full border border-orange-500/20 bg-orange-500/10 px-3 py-1.5 text-xs font-semibold text-orange-600 dark:text-orange-300"
        >
          <CheckCircle2 size={13} />
          {item}
        </span>
      ))}
    </div>
  );
}
