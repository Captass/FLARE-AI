import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Bot, CheckCircle2, CreditCard, MessageSquare, ShieldCheck, UserCheck } from "lucide-react";
import PublicPageShell from "@/components/marketing/PublicPageShell";

export const metadata: Metadata = {
  title: "Comment ca marche | FLARE AI",
  description:
    "Decouvrez le parcours FLARE AI: inscription, choix d'offre, paiement local, validation assistee et activation chatbot Facebook.",
};

const STEPS = [
  {
    icon: UserCheck,
    title: "1. Inscription",
    copy: "Compte ouvert.",
  },
  {
    icon: Bot,
    title: "2. Offre",
    copy: "Plan choisi.",
  },
  {
    icon: CreditCard,
    title: "3. Paiement",
    copy: "MVola ou OM.",
  },
  {
    icon: ShieldCheck,
    title: "4. Validation",
    copy: "Plan applique.",
  },
  {
    icon: MessageSquare,
    title: "5. Activation",
    copy: "Bot en ligne.",
  },
];

const FAQS = [
  {
    question: "Combien de temps entre paiement et activation ?",
    answer:
      "Le paiement est verifie par FLARE, puis le plan est applique et l'activation avance selon l'acces a la page Facebook. Le client suit ces etapes dans l'application.",
  },
  {
    question: "Comment FLARE confirme le plan applique ?",
    answer:
      "Apres validation du paiement, le plan choisi devient visible dans l'espace Offre / Activation ainsi que dans le hub du chatbot.",
  },
  {
    question: "Que se passe-t-il si un paiement est refuse ?",
    answer:
      "Le dossier reste bloque a l'etape paiement et le client doit soumettre une nouvelle preuve correcte. Rien n'est active tant que la verification n'est pas validee.",
  },
  {
    question: "Quel support est disponible pendant la mise en ligne ?",
    answer:
      "L'equipe FLARE accompagne les points critiques: verification, acces page Facebook, reprise de blocage et test Messenger final.",
  },
];

export default function CommentCaMarchePage() {
  return (
    <PublicPageShell
      eyebrow="Processus d'activation"
      title="Paiement. Validation. Activation."
      description="Chatbot Facebook actif aujourd'hui. Paiement local. Activation FLARE."
      statusBlocks={[
        {
          title: "Actif maintenant",
          tone: "live",
          items: ["Chatbot Facebook", "Paiement local"],
        },
        {
          title: "En progression",
          tone: "opening",
          items: ["Plus de cas metier", "Parcours plus autonome"],
        },
        {
          title: "Vision FLARE",
          tone: "vision",
          items: ["Plateforme automation", "Pilotage unifie"],
        },
      ]}
      metrics={[
        { value: "5", label: "Etapes lisibles" },
        { value: "100%", label: "Suivi trace" },
        { value: "Local", label: "Paiement Madagascar" },
      ]}
      primaryAction={{ label: "Demarrer la mise en route", href: "/app?auth=signup" }}
      secondaryAction={{ label: "Voir les offres", href: "/offres" }}
    >
      <section className="rounded-[30px] border border-black/12 bg-white p-6 shadow-[0_20px_65px_rgba(15,23,42,0.08)] md:p-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-black/70">Flow operationnel</p>
            <h2 className="mt-2 text-3xl font-black tracking-tight text-black md:text-4xl">
              Le pipeline reel
            </h2>
          </div>
          <Link
            href="/cas-usage"
            className="inline-flex items-center gap-2 rounded-full border border-black/15 bg-[#f8f2e8] px-5 py-2.5 text-xs font-black uppercase tracking-[0.08em] text-black transition hover:border-black/30"
          >
            Voir des cas concrets
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="mt-7 grid gap-3 md:grid-cols-5">
          {STEPS.map((step) => {
            const Icon = step.icon;
            return (
              <article
                key={step.title}
                className="group rounded-2xl border border-black/10 bg-[#f8f2e8] px-4 py-4 transition hover:-translate-y-0.5 hover:border-orange-500/35 hover:shadow-[0_16px_36px_rgba(249,115,22,0.16)]"
              >
                <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-black/10 bg-white text-black">
                  <Icon className="h-4 w-4 text-black" />
                </div>
                <h3 className="mt-3 text-sm font-black uppercase tracking-[0.06em] text-black">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-black/80">{step.copy}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {[
          {
            title: "Statut visible",
            copy: "Paiement. Validation. Activation.",
          },
          {
            title: "Support FLARE",
            copy: "Aide humaine sur les points critiques.",
          },
          {
            title: "Resultat direct",
            copy: "Bot actif. Reponse plus vite.",
          },
        ].map((card) => (
          <article
            key={card.title}
            className="rounded-2xl border border-black/10 bg-white p-5 shadow-[0_12px_40px_rgba(15,23,42,0.05)]"
          >
            <p className="text-xs font-black uppercase tracking-[0.12em] text-black/70">Preuve terrain</p>
            <h3 className="mt-2 text-xl font-black tracking-tight text-black">{card.title}</h3>
            <p className="mt-3 text-sm leading-relaxed text-black/80">{card.copy}</p>
          </article>
        ))}
      </section>

      <section className="rounded-[28px] border border-black/10 bg-white p-6 md:p-8">
        <h2 className="text-3xl font-black tracking-tight text-black">Questions critiques</h2>
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {FAQS.map((item) => (
            <div key={item.question} className="rounded-2xl border border-black/10 bg-[#fbf7f0] px-4 py-4">
              <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-orange-600" />
                <div>
                  <p className="text-sm font-semibold text-black">{item.question}</p>
                  <p className="mt-2 text-sm leading-relaxed text-black/80">{item.answer}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </PublicPageShell>
  );
}
