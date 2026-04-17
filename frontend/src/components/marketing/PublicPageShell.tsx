"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import FlareMark from "@/components/FlareMark";

type Tone = "live" | "opening" | "vision";

export interface PublicStatusBlock {
  title: string;
  tone: Tone;
  items: string[];
}

export interface PublicMetric {
  value: string;
  label: string;
}

export interface PublicAction {
  label: string;
  href: string;
}

interface PublicPageShellProps {
  eyebrow: string;
  title: string;
  description: string;
  statusBlocks: PublicStatusBlock[];
  metrics: PublicMetric[];
  primaryAction: PublicAction;
  secondaryAction: PublicAction;
  children: React.ReactNode;
}

const NAV_ITEMS = [
  { href: "/", label: "Accueil" },
  { href: "/comment-ca-marche", label: "Comment ca marche" },
  { href: "/cas-usage", label: "Cas usage" },
  { href: "/offres", label: "Offres" },
];

const toneClassMap: Record<Tone, string> = {
  live: "border-orange-500/35 bg-orange-500/10 text-zinc-900",
  opening: "border-zinc-900/15 bg-white/70 text-zinc-900",
  vision: "border-blue-900/20 bg-blue-950/10 text-zinc-900",
};

function AutomationBoard() {
  return (
    <div className="relative overflow-hidden rounded-[30px] border border-zinc-900/10 bg-zinc-950 p-6 text-zinc-100 shadow-[0_24px_80px_rgba(15,23,42,0.35)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(249,115,22,0.2),transparent_36%),radial-gradient(circle_at_80%_80%,rgba(56,189,248,0.2),transparent_36%)]" />

      <div className="relative z-10">
        <p className="text-[11px] uppercase tracking-[0.28em] text-zinc-400">Command Center FLARE</p>
        <h3 className="mt-2 text-2xl font-black">Automation flow en direct</h3>

        <div className="mt-6 space-y-4">
          {[
            "Message entrant detecte",
            "Qualification automatique",
            "Reponse + relance intelligente",
            "Conversion ou handoff humain",
          ].map((step, index) => (
            <motion.div
              key={step}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.45, delay: index * 0.12 }}
              className="relative rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
            >
              <motion.span
                animate={{ opacity: [0.35, 0.95, 0.35] }}
                transition={{ duration: 2.1, repeat: Infinity, delay: index * 0.3 }}
                className="absolute left-2 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-orange-400 shadow-[0_0_16px_rgba(251,146,60,0.9)]"
              />
              <p className="pl-4 text-sm font-semibold text-zinc-100">{step}</p>
            </motion.div>
          ))}
        </div>

        <motion.div
          animate={{ backgroundPositionX: ["0%", "100%"] }}
          transition={{ duration: 4.5, repeat: Infinity, ease: "linear" }}
          className="mt-6 h-[2px] w-full bg-[linear-gradient(90deg,rgba(251,146,60,0),rgba(251,146,60,0.95),rgba(251,146,60,0))] bg-[length:220%_100%]"
        />
      </div>
    </div>
  );
}

export default function PublicPageShell({
  eyebrow,
  title,
  description,
  statusBlocks,
  metrics,
  primaryAction,
  secondaryAction,
  children,
}: PublicPageShellProps) {
  const pathname = usePathname();

  return (
    <main className="relative min-h-screen overflow-x-hidden bg-[#f7f1e7] text-zinc-900">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_12%,rgba(249,115,22,0.12),transparent_34%),radial-gradient(circle_at_92%_10%,rgba(30,58,138,0.1),transparent_30%),radial-gradient(circle_at_50%_90%,rgba(15,23,42,0.08),transparent_34%)]" />

      <div className="relative mx-auto w-full max-w-[1180px] px-6 pb-20 pt-8 md:px-8 lg:px-10">
        <header className="rounded-3xl border border-zinc-900/10 bg-white/78 px-5 py-4 backdrop-blur-xl">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <Link href="/" className="flex items-center gap-3">
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-zinc-900/10 bg-white">
                <FlareMark className="w-7" tone="light" />
              </span>
              <div>
                <p className="text-xl font-black tracking-tight">FLARE AI</p>
                <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Automatisation TPE PME</p>
              </div>
            </Link>

            <nav className="flex flex-wrap items-center gap-2">
              {NAV_ITEMS.map((item) => {
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`rounded-full px-4 py-2 text-sm font-bold transition ${
                      active
                        ? "bg-zinc-900 text-white shadow-[0_8px_24px_rgba(24,24,27,0.25)]"
                        : "text-zinc-700 hover:bg-zinc-900/8"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        </header>

        <section className="mt-10 grid gap-8 lg:grid-cols-[1.08fr_0.92fr] lg:items-start">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
            className="space-y-6"
          >
            <div className="inline-flex items-center rounded-full border border-zinc-900/15 bg-white/75 px-4 py-2 text-[11px] font-black uppercase tracking-[0.22em] text-zinc-700">
              {eyebrow}
            </div>

            <h1 className="max-w-3xl text-5xl font-black leading-[0.94] tracking-tight text-zinc-950 md:text-6xl">
              {title}
            </h1>

            <p className="max-w-2xl text-lg font-medium leading-relaxed text-zinc-700">{description}</p>

            <div className="grid gap-3 md:grid-cols-3">
              {statusBlocks.map((block) => (
                <div
                  key={block.title}
                  className={`rounded-2xl border px-4 py-4 ${toneClassMap[block.tone]}`}
                >
                  <p className="text-[11px] font-black uppercase tracking-[0.2em]">{block.title}</p>
                  <ul className="mt-3 space-y-2">
                    {block.items.map((item) => (
                      <li key={item} className="flex items-start gap-2 text-sm font-semibold leading-snug">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Link
                href={primaryAction.href}
                className="group inline-flex items-center gap-2 rounded-full bg-orange-500 px-6 py-3 text-sm font-black uppercase tracking-[0.08em] text-zinc-950 transition hover:bg-orange-400"
              >
                {primaryAction.label}
                <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
              </Link>
              <Link
                href={secondaryAction.href}
                className="inline-flex items-center rounded-full border border-zinc-900/20 bg-white/72 px-6 py-3 text-sm font-black uppercase tracking-[0.08em] text-zinc-900 transition hover:border-zinc-900/35 hover:bg-white"
              >
                {secondaryAction.label}
              </Link>
            </div>

            <div className="grid gap-3 border-t border-zinc-900/10 pt-5 sm:grid-cols-3">
              {metrics.map((metric) => (
                <div key={metric.label} className="rounded-2xl border border-zinc-900/10 bg-white/65 px-4 py-3">
                  <p className="text-3xl font-black leading-none text-zinc-950">{metric.value}</p>
                  <p className="mt-2 text-xs font-black uppercase tracking-[0.14em] text-zinc-500">{metric.label}</p>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, amount: 0.35 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          >
            <AutomationBoard />
          </motion.div>
        </section>

        <section className="mt-16 space-y-14">{children}</section>

        <section className="mt-16 rounded-[30px] border border-zinc-900/12 bg-zinc-950 px-6 py-8 text-zinc-100 md:px-10 md:py-10">
          <div className="grid gap-6 md:grid-cols-[1fr_auto] md:items-center">
            <div>
              <p className="text-[11px] uppercase tracking-[0.22em] text-zinc-400">Conversion ready</p>
              <h2 className="mt-2 text-3xl font-black leading-tight md:text-4xl">
                Passez de l&apos;intention a l&apos;automatisation active.
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-zinc-300 md:text-base">
                Ouvrez votre espace, choisissez une offre, payez en local, puis activez votre premier flux avec l&apos;equipe FLARE.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/app?auth=signup"
                className="inline-flex items-center gap-2 rounded-full bg-orange-500 px-6 py-3 text-sm font-black uppercase tracking-[0.08em] text-zinc-950 transition hover:bg-orange-400"
              >
                Demarrer
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/app?auth=login"
                className="inline-flex items-center rounded-full border border-white/20 px-6 py-3 text-sm font-black uppercase tracking-[0.08em] text-zinc-100 transition hover:border-white/35"
              >
                Se connecter
              </Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
