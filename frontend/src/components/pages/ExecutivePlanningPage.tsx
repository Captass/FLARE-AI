"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { CalendarDays, CheckCircle2, Clock, Sparkles } from "lucide-react";
import { executiveEvents, obligationTasks, personalTasks, professionalTasks } from "@/data/executiveDeskMock";
import ExecutiveBenefitBadges from "@/components/pages/ExecutiveBenefitBadges";

function TaskList({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="rounded-[24px] border border-[var(--border-default)] bg-[var(--bg-card)] p-5">
      <h2 className="text-lg font-bold text-[var(--text-primary)]">{title}</h2>
      <div className="mt-4 space-y-2">
        {items.map((item) => (
          <div
            key={item}
            className="flex items-center gap-3 rounded-2xl border border-[var(--border-default)] bg-[var(--surface-subtle)] px-4 py-3 text-sm font-medium text-[var(--text-primary)]"
          >
            <CheckCircle2 size={16} className="shrink-0 text-orange-500" />
            {item}
          </div>
        ))}
      </div>
    </section>
  );
}

export default function ExecutivePlanningPage() {
  const [optimized, setOptimized] = useState(false);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-6 px-4 py-8 md:px-8 md:py-12">
        <header className="rounded-[28px] border border-[var(--border-default)] bg-[var(--bg-card)] p-6 md:p-8">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-orange-500/20 bg-orange-500/10 px-3 py-1 text-xs font-semibold text-orange-600 dark:text-orange-300">
            <CalendarDays size={14} />
            Démo planning
          </div>
          <h1 className="text-3xl font-black tracking-tight text-[var(--text-primary)] md:text-4xl">Planning</h1>
          <p className="mt-3 max-w-3xl text-base leading-relaxed text-[var(--text-secondary)]">
            Organisez votre journée entre priorités professionnelles, personnelles, charges et rendez-vous.
          </p>
          <p className="mt-4 max-w-3xl text-lg font-semibold leading-relaxed text-[var(--text-primary)]">
            Votre journée est organisée entre priorités professionnelles, obligations personnelles et rendez-vous.
          </p>
          <div className="mt-5">
            <ExecutiveBenefitBadges items={["Priorités claires", "Moins d’oublis", "Gain de temps"]} />
          </div>
        </header>

        <section className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="rounded-[24px] border border-[var(--border-default)] bg-[var(--bg-card)] p-5"
          >
            <h2 className="text-xl font-bold text-[var(--text-primary)]">Agenda du jour</h2>
            <div className="mt-4 space-y-3">
              {executiveEvents.map((event) => (
                <div key={event.id} className="flex gap-4 rounded-2xl border border-[var(--border-default)] bg-[var(--surface-subtle)] p-4">
                  <div className="flex h-12 w-16 shrink-0 items-center justify-center rounded-2xl bg-orange-500/10 text-sm font-black text-orange-600">
                    {event.time}
                  </div>
                  <div>
                    <p className="font-semibold text-[var(--text-primary)]">{event.title}</p>
                    <p className="mt-1 text-sm text-[var(--text-secondary)]">{event.type}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: 0.05 }}
            className="rounded-[24px] border border-orange-500/20 bg-orange-500/10 p-5"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-orange-500/12 text-orange-500">
              <Sparkles size={21} />
            </div>
            <h2 className="mt-5 text-xl font-bold text-[var(--text-primary)]">Recommandation IA</h2>
            <p className="mt-3 text-sm leading-relaxed text-[var(--text-secondary)]">
              Concentrez la matinée sur les tâches professionnelles urgentes. Gardez les obligations personnelles après 17h pour éviter de fragmenter votre journée.
            </p>
            <button
              type="button"
              onClick={() => setOptimized(true)}
              className="mt-5 inline-flex items-center justify-center gap-2 rounded-2xl bg-orange-500 px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-orange-600"
            >
              <Clock size={16} />
              Générer planning optimisé
            </button>
            {optimized && (
              <div className="mt-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                Simulation générée : tâches urgentes avant 12h, rendez-vous préparé à 14h, obligations après 17h.
              </div>
            )}
          </motion.div>
        </section>

        <section className="grid gap-5 lg:grid-cols-3">
          <TaskList title="Tâches professionnelles" items={professionalTasks} />
          <TaskList title="Tâches personnelles / famille" items={personalTasks} />
          <TaskList title="Charges / obligations" items={obligationTasks} />
        </section>
      </div>
    </div>
  );
}
