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
    title: "1. Inscription rapide",
    copy: "Vous creez votre compte en quelques clics et vous ouvrez votre espace de pilotage.",
  },
  {
    icon: Bot,
    title: "2. Choix de l'offre",
    copy: "Vous choisissez le plan adapte a votre volume de demandes et vos objectifs business.",
  },
  {
    icon: CreditCard,
    title: "3. Paiement local",
    copy: "Vous payez en MVola ou Orange Money avec une reference claire et tracable.",
  },
  {
    icon: ShieldCheck,
    title: "4. Validation FLARE",
    copy: "L'equipe confirme le paiement et applique le plan choisi sans etat ambigu.",
  },
  {
    icon: MessageSquare,
    title: "5. Activation Messenger",
    copy: "Le chatbot Facebook est connecte a votre page puis passe en statut actif.",
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
      title="Un parcours simple, suivi de bout en bout."
      description="FLARE AI automatise les taches repetitives pour TPE/PME. Aujourd'hui, la preuve concrete est le chatbot Facebook assiste avec paiement local et activation accompagnee."
      statusBlocks={[
        {
          title: "Disponible maintenant",
          tone: "live",
          items: ["Chatbot Facebook assiste", "Paiement MVola / Orange Money", "Suivi activation visible"],
        },
        {
          title: "En cours d'ouverture",
          tone: "opening",
          items: ["Plus de cas d'usage metier", "Parcours plus autonome", "Routines de suivi et validation"],
        },
        {
          title: "Vision FLARE AI",
          tone: "vision",
          items: ["Plateforme d'automatisation", "Modules metier connectes", "Pilotage business unifie"],
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
      <section className="rounded-[30px] border border-zinc-900/10 bg-white/75 p-6 shadow-[0_20px_65px_rgba(15,23,42,0.09)] md:p-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-zinc-500">Flow operationnel</p>
            <h2 className="mt-2 text-3xl font-black tracking-tight text-zinc-950 md:text-4xl">
              Comment votre activation avance
            </h2>
          </div>
          <Link
            href="/cas-usage"
            className="inline-flex items-center gap-2 rounded-full border border-zinc-900/15 bg-zinc-950 px-5 py-2.5 text-xs font-black uppercase tracking-[0.08em] text-white transition hover:bg-zinc-800"
          >
            Voir des cas concrets
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="mt-7 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {STEPS.map((step) => {
            const Icon = step.icon;
            return (
              <article
                key={step.title}
                className="group rounded-2xl border border-zinc-900/10 bg-[#f8f2e8] px-4 py-4 transition hover:-translate-y-0.5 hover:border-orange-500/35 hover:shadow-[0_16px_36px_rgba(249,115,22,0.16)]"
              >
                <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-900/10 bg-white text-zinc-900">
                  <Icon className="h-4 w-4" />
                </div>
                <h3 className="mt-3 text-sm font-black uppercase tracking-[0.06em] text-zinc-900">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-700">{step.copy}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {[
          {
            title: "Etat activation en temps reel",
            copy: "Chaque dossier avance avec des statuts clairs: paiement, validation, connexion page, activation.",
          },
          {
            title: "Validation humaine FLARE",
            copy: "Vous n'etes pas seul: l'equipe suit les points critiques pour eviter les blocages silencieux.",
          },
          {
            title: "Sortie orientee resultat",
            copy: "Objectif: repondre plus vite, convertir plus de demandes et structurer le suivi client.",
          },
        ].map((card) => (
          <article
            key={card.title}
            className="rounded-2xl border border-zinc-900/10 bg-white/70 p-5 shadow-[0_12px_40px_rgba(15,23,42,0.06)]"
          >
            <p className="text-xs font-black uppercase tracking-[0.12em] text-orange-600">Preuve terrain</p>
            <h3 className="mt-2 text-xl font-black tracking-tight text-zinc-950">{card.title}</h3>
            <p className="mt-3 text-sm leading-relaxed text-zinc-700">{card.copy}</p>
          </article>
        ))}
      </section>

      <section className="rounded-[28px] border border-zinc-900/10 bg-white/75 p-6 md:p-8">
        <h2 className="text-3xl font-black tracking-tight text-zinc-950">Questions critiques avant de commencer</h2>
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {FAQS.map((item) => (
            <div key={item.question} className="rounded-2xl border border-zinc-900/10 bg-[#fbf7f0] px-4 py-4">
              <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-orange-600" />
                <div>
                  <p className="text-sm font-semibold text-zinc-800">{item.question}</p>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-700">{item.answer}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </PublicPageShell>
  );
}
