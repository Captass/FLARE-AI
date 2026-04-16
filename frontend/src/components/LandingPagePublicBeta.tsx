"use client";

import { motion } from "framer-motion";
import { ArrowRight, Bot, CheckCircle2, CreditCard, Facebook, MessageSquare, ShieldCheck } from "lucide-react";
import FlareMark from "./FlareMark";

interface LandingPagePublicBetaProps {
  onStart: (mode: "login" | "signup") => void;
}

const STEPS = [
  {
    title: "Choisissez votre offre",
    body: "Le client choisit son plan chatbot Facebook selon son volume et son besoin de suivi.",
  },
  {
    title: "Payez en local",
    body: "La beta utilise MVola et Orange Money, avec validation manuelle de la preuve de paiement.",
  },
  {
    title: "FLARE active votre bot",
    body: "Un technicien FLARE reprend la configuration Facebook, teste Messenger et confirme la mise en ligne.",
  },
];

const HIGHLIGHTS = [
  "Chatbot Facebook pour TPE, PME et independants a Madagascar",
  "Activation assistee par une equipe FLARE locale",
  "Paiement manuel MVola / Orange Money",
  "Suivi clair du plan, du paiement et de l'activation",
];

export default function LandingPagePublicBeta({ onStart }: LandingPagePublicBetaProps) {
  return (
    <div className="min-h-screen bg-[#f5f1e8] text-[#0f1720]">
      <section className="relative overflow-hidden border-b border-black/5">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(249,115,22,0.16),_transparent_32%),radial-gradient(circle_at_bottom_right,_rgba(18,52,86,0.12),_transparent_30%)]" />
        <div className="relative mx-auto flex w-full max-w-7xl flex-col gap-12 px-6 py-8 md:px-10 md:py-12 lg:flex-row lg:items-center lg:gap-16 lg:px-16">
          <div className="flex-1">
            <div className="inline-flex items-center gap-3 rounded-full border border-black/10 bg-white/70 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.18em] text-black/70 backdrop-blur">
              <FlareMark tone="auto" className="w-[14px]" />
              Beta publique assistee Madagascar
            </div>
            <h1 className="mt-6 max-w-4xl text-4xl font-black leading-[0.95] tracking-tight md:text-6xl lg:text-7xl">
              Un seul produit vendu publiquement aujourd&apos;hui:
              <span className="block text-orange-500">le chatbot Facebook FLARE AI.</span>
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-7 text-black/70 md:text-lg">
              FLARE AI aide les TPE et PME de Madagascar a mieux repondre sur Facebook Messenger, avec un paiement local, une activation assistee par technicien et un support humain clair du debut a la mise en ligne.
            </p>

            <div className="mt-8 flex flex-col gap-4 sm:flex-row">
              <button
                type="button"
                onClick={() => onStart("signup")}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-orange-500 px-7 py-4 text-sm font-bold uppercase tracking-[0.14em] text-white transition-colors hover:bg-orange-600"
              >
                Demarrer la beta
                <ArrowRight size={16} />
              </button>
              <button
                type="button"
                onClick={() => onStart("login")}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-black/10 bg-white/80 px-7 py-4 text-sm font-bold uppercase tracking-[0.14em] text-black/70 transition-colors hover:bg-white"
              >
                Ouvrir mon espace
              </button>
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              {HIGHLIGHTS.map((item) => (
                <div key={item} className="flex items-start gap-3 rounded-2xl border border-black/8 bg-white/75 px-4 py-4 backdrop-blur">
                  <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-orange-500" />
                  <p className="text-sm leading-6 text-black/75">{item}</p>
                </div>
              ))}
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            className="w-full max-w-xl rounded-[32px] border border-black/8 bg-[#0f1720] p-6 text-white shadow-[0_40px_100px_rgba(15,23,32,0.18)]"
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <p className="text-[11px] uppercase tracking-[0.16em] text-white/60">Produit beta</p>
                <h2 className="mt-2 text-2xl font-bold">Chatbot Facebook assiste</h2>
              </div>
              <div className="rounded-2xl bg-white/8 p-3">
                <Bot size={22} className="text-orange-400" />
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {[
                { label: "Canal", value: "Messenger", icon: Facebook },
                { label: "Paiement", value: "MVola / OM", icon: CreditCard },
                { label: "Support", value: "Equipe FLARE", icon: ShieldCheck },
              ].map((item) => (
                <div key={item.label} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <item.icon size={16} className="text-orange-400" />
                  <p className="mt-3 text-[11px] uppercase tracking-[0.12em] text-white/55">{item.label}</p>
                  <p className="mt-1 text-sm font-semibold text-white">{item.value}</p>
                </div>
              ))}
            </div>

            <div className="mt-5 rounded-[28px] border border-white/10 bg-white/5 p-5">
              <p className="text-[11px] uppercase tracking-[0.16em] text-white/55">Ce que FLARE ne promet pas encore publiquement</p>
              <p className="mt-3 text-sm leading-7 text-white/75">
                Pas de Google, pas d&apos;Instagram, pas de LinkedIn, pas de studio contenu grand public. La beta publique actuelle reste volontairement concentree sur un seul flux qui marche reellement.
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-6 py-16 md:px-10 lg:px-16">
        <div className="grid gap-10 lg:grid-cols-[0.95fr_1.05fr]">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-black/45">Comment la beta fonctionne</p>
            <h2 className="mt-4 text-3xl font-black tracking-tight md:text-5xl">
              Une promesse plus etroite.
              <span className="block text-orange-500">Un parcours plus fiable.</span>
            </h2>
            <p className="mt-4 max-w-xl text-base leading-7 text-black/65">
              Au lieu d&apos;un faux produit “tout-en-un”, FLARE aligne maintenant l&apos;offre publique sur ce qui est reellement operationnel: plan choisi, paiement valide, plan applique, activation Facebook, puis suivi du chatbot.
            </p>
          </div>

          <div className="grid gap-4">
            {STEPS.map((step, index) => (
              <motion.div
                key={step.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.4 }}
                transition={{ duration: 0.35, delay: index * 0.05 }}
                className="rounded-[28px] border border-black/8 bg-white px-5 py-5 shadow-[0_12px_40px_rgba(15,23,32,0.05)]"
              >
                <div className="flex items-start gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-orange-500 text-sm font-black text-white">
                    0{index + 1}
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-[#0f1720]">{step.title}</h3>
                    <p className="mt-2 text-sm leading-7 text-black/65">{step.body}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-black/5 bg-[#101724] px-6 py-16 text-white md:px-10 lg:px-16">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/50">Besoins couverts aujourd&apos;hui</p>
            <h2 className="mt-4 text-3xl font-black tracking-tight md:text-5xl">
              Repondre plus vite.
              <span className="block text-orange-400">Mieux suivre l&apos;activation.</span>
            </h2>
            <p className="mt-4 text-base leading-7 text-white/70">
              Le client ne doit plus se demander si son paiement a ete valide, si le bon plan est actif ou ou en est son chatbot. La beta publique recentree sert d&apos;abord a fermer ce parcours.
            </p>
          </div>

          <div className="grid gap-3 sm:min-w-[360px]">
            {[
              "Plan choisi visible avant paiement",
              "Plan applique visible apres validation",
              "Activation Facebook suivie et comprehensible",
              "Support FLARE joignable sans chercher dans plusieurs menus",
            ].map((item) => (
              <div key={item} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
                <MessageSquare size={16} className="text-orange-400" />
                <span className="text-sm text-white/80">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
