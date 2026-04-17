import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BadgeCheck, Clock3, MessageSquare, TrendingUp } from "lucide-react";
import PublicPageShell from "@/components/marketing/PublicPageShell";

export const metadata: Metadata = {
  title: "Cas usage | FLARE AI",
  description:
    "Explorez des cas d'usage FLARE AI pour boutiques, restauration et services: plus de reactivite client et plus de conversions.",
};

const USE_CASES = [
  {
    sector: "Boutique / Ecommerce",
    before: "Demandes en DM traitees en retard, commandes perdues, relances oubliees.",
    after: "Reponses plus rapides, qualification automatique et plus de commandes converties.",
    highlight: "Objectif: transformer chaque message en opportunite suivie.",
  },
  {
    sector: "Restauration / Food",
    before: "Questions repetitives sur menus, horaires, livraison et disponibilites.",
    after: "Reponse instantanee des infos frequentes + redirection intelligente vers equipe.",
    highlight: "Objectif: reduire la charge repetitive du staff en service.",
  },
  {
    sector: "Services / Prestataires",
    before: "Prospects non qualifies, suivi manuel lourd, conversion irreguliere.",
    after: "Qualification initiale automatisee et parcours de prise de contact mieux structure.",
    highlight: "Objectif: gagner du temps et augmenter le taux de conversion.",
  },
];

export default function CasUsagePage() {
  return (
    <PublicPageShell
      eyebrow="Cas concret TPE / PME"
      title="Des automatisations qui servent le chiffre d'affaires."
      description="FLARE AI vise large: automatiser les taches repetitives des entreprises locales. La preuve active aujourd'hui est le chatbot Facebook assiste, deja focalise sur conversion et productivite."
      statusBlocks={[
        {
          title: "Actif aujourd'hui",
          tone: "live",
          items: ["Qualification automatique de messages", "Reponse rapide Messenger", "Suivi d'activation guide"],
        },
        {
          title: "En extension",
          tone: "opening",
          items: ["Plus de templates metier", "Scenarios de relance adaptes", "Meilleur suivi des leads"],
        },
        {
          title: "Plateforme cible",
          tone: "vision",
          items: ["Automatisations multicanales", "Modules metier connectes", "Tableau de pilotage global"],
        },
      ]}
      metrics={[
        { value: "3", label: "Secteurs modeles" },
        { value: "Avant / Apres", label: "Lecture directe" },
        { value: "Actionnable", label: "Conversion focus" },
      ]}
      primaryAction={{ label: "Tester sur mon business", href: "/app?auth=signup" }}
      secondaryAction={{ label: "Comprendre le process", href: "/comment-ca-marche" }}
    >
      <section className="rounded-[30px] border border-zinc-900/10 bg-white/78 p-6 md:p-8">
        <h2 className="text-3xl font-black tracking-tight text-zinc-950 md:text-4xl">Avant / Apres par secteur</h2>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-zinc-700 md:text-base">
          Chaque cas garde une approche simple: accelerer les reponses, reduire la repetition manuelle, puis pousser une action utile vers la conversion.
        </p>

        <div className="mt-6 space-y-4">
          {USE_CASES.map((item) => (
            <article
              key={item.sector}
              className="rounded-2xl border border-zinc-900/10 bg-[#f8f2e7] p-5 shadow-[0_10px_30px_rgba(15,23,42,0.06)]"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-xl font-black tracking-tight text-zinc-950">{item.sector}</h3>
                <span className="inline-flex items-center gap-2 rounded-full border border-orange-500/35 bg-orange-500/10 px-3 py-1 text-xs font-black uppercase tracking-[0.08em] text-zinc-900">
                  <BadgeCheck className="h-3.5 w-3.5 text-orange-600" />
                  Cas prioritaire
                </span>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <div className="rounded-xl border border-zinc-900/10 bg-white/80 p-3">
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-zinc-500">Avant</p>
                  <p className="mt-2 text-sm font-medium leading-relaxed text-zinc-700">{item.before}</p>
                </div>
                <div className="rounded-xl border border-zinc-900/10 bg-zinc-950 p-3 text-zinc-100">
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-zinc-400">Apres automation</p>
                  <p className="mt-2 text-sm font-medium leading-relaxed text-zinc-100">{item.after}</p>
                </div>
              </div>
              <p className="mt-3 text-sm font-semibold text-orange-700">{item.highlight}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {[
          {
            icon: MessageSquare,
            title: "Reponse rapide",
            copy: "Les clients obtiennent une premiere reponse plus vite sur Messenger.",
          },
          {
            icon: Clock3,
            title: "Temps recupere",
            copy: "Votre equipe sort des taches repetitives et se concentre sur les actions a valeur.",
          },
          {
            icon: TrendingUp,
            title: "Conversion mieux suivie",
            copy: "Les demandes avancent vers commande, rendez-vous ou contact qualifie.",
          },
        ].map((card) => {
          const Icon = card.icon;
          return (
            <article
              key={card.title}
              className="rounded-2xl border border-zinc-900/10 bg-white/74 p-5 shadow-[0_12px_30px_rgba(15,23,42,0.05)]"
            >
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-900/10 bg-[#f8f2e7]">
                <Icon className="h-5 w-5 text-zinc-900" />
              </div>
              <h3 className="mt-3 text-xl font-black tracking-tight text-zinc-950">{card.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-700">{card.copy}</p>
            </article>
          );
        })}
      </section>

      <section className="rounded-[26px] border border-zinc-900/10 bg-white/80 p-6 md:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-zinc-500">Prochaine etape</p>
            <h2 className="mt-1 text-3xl font-black tracking-tight text-zinc-950">Passez sur une offre adaptee</h2>
            <p className="mt-2 text-sm text-zinc-700">Choisissez votre rythme de lancement et activez votre premier flux.</p>
          </div>
          <Link
            href="/offres"
            className="inline-flex items-center gap-2 rounded-full bg-orange-500 px-5 py-3 text-xs font-black uppercase tracking-[0.08em] text-zinc-950 transition hover:bg-orange-400"
          >
            Voir les offres
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </PublicPageShell>
  );
}
