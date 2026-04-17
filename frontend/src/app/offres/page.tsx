import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BadgeCheck, Check, Headset, ShieldCheck, Wallet } from "lucide-react";
import PublicPageShell from "@/components/marketing/PublicPageShell";

export const metadata: Metadata = {
  title: "Offres | FLARE AI",
  description:
    "Comparez les offres FLARE AI, choisissez un plan adapte a votre business et lancez votre chatbot Facebook assiste avec paiement local.",
};

const PLANS = [
  {
    name: "Starter",
    badge: "Pour demarrer",
    price: "30 000 Ar / mois",
    summary: "Une base claire pour automatiser les demandes frequentes et lancer le premier flux Messenger.",
    features: [
      "500 messages / mois",
      "Chatbot Facebook assiste",
      "Paiement local et validation FLARE",
      "Suivi d'activation visible dans l'app",
    ],
    cta: "/app?auth=signup",
  },
  {
    name: "Pro",
    badge: "Le plus choisi",
    price: "60 000 Ar / mois",
    summary: "Plus de capacite et plus de scenarios pour les equipes qui veulent convertir davantage.",
    features: [
      "2 000 messages / mois",
      "Automatisation plus large des demandes entrantes",
      "Accompagnement operationnel renforce",
      "Parcours optimises pour conversion et productivite",
    ],
    cta: "/app?auth=signup",
    featured: true,
  },
  {
    name: "Business",
    badge: "Equipe en croissance",
    price: "120 000 Ar / mois",
    summary: "Pour les structures qui ont besoin d'un rythme plus soutenu et d'un cadrage plus large.",
    features: [
      "5 000 messages / mois",
      "Accompagnement prioritaire",
      "Priorisation des cas d'usage metier",
      "Cadrage des prochains modules FLARE",
    ],
    cta: "/app?auth=signup",
  },
];

export default function OffresPage() {
  return (
    <PublicPageShell
      eyebrow="Offres et conversion"
      title="Des offres nettes pour activer vite et scaler proprement."
      description="FLARE AI est une plateforme d'automatisation en construction continue. Aujourd'hui, le module concret et prouve est le chatbot Facebook assiste, avec paiement local et activation guidee."
      statusBlocks={[
        {
          title: "Preuve active",
          tone: "live",
          items: ["Chatbot Facebook assiste", "Paiement MVola / Orange Money", "Validation et statut visibles"],
        },
        {
          title: "En progression",
          tone: "opening",
          items: ["Plus de templates de conversion", "Plus de secteurs couverts", "Processus encore plus fluides"],
        },
        {
          title: "Vision plateforme",
          tone: "vision",
          items: ["Suite d'automatisations metier", "Pilotage operationnel unifie", "Modules avances a connecter"],
        },
      ]}
      metrics={[
        { value: "3", label: "Niveaux d'offre" },
        { value: "Local", label: "Paiement Madagascar" },
        { value: "Humain + IA", label: "Execution assistee" },
      ]}
      primaryAction={{ label: "Choisir mon offre", href: "/app?auth=signup" }}
      secondaryAction={{ label: "Retour accueil", href: "/" }}
    >
      <section className="rounded-[30px] border border-zinc-900/10 bg-white/76 p-6 md:p-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-zinc-500">Grille d&apos;offres</p>
            <h2 className="mt-2 text-3xl font-black tracking-tight text-zinc-950 md:text-4xl">Choisissez votre niveau d&apos;automatisation</h2>
          </div>
          <p className="max-w-sm text-right text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">
            Meme logique d&apos;offres que dans l&apos;espace Offre / Activation
          </p>
        </div>

        <div className="mt-7 grid gap-4 lg:grid-cols-3">
          {PLANS.map((plan) => (
            <article
              key={plan.name}
              className={`rounded-2xl border p-5 shadow-[0_12px_34px_rgba(15,23,42,0.08)] ${
                plan.featured
                  ? "border-orange-500/40 bg-zinc-950 text-zinc-100"
                  : "border-zinc-900/10 bg-[#f8f2e8] text-zinc-900"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-2xl font-black tracking-tight">{plan.name}</h3>
                <span
                  className={`rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-[0.1em] ${
                    plan.featured ? "bg-orange-500 text-zinc-950" : "border border-zinc-900/15 bg-white/70 text-zinc-700"
                  }`}
                >
                  {plan.badge}
                </span>
              </div>
              <p className={`mt-3 text-sm leading-relaxed ${plan.featured ? "text-zinc-200" : "text-zinc-700"}`}>{plan.summary}</p>
              <p className={`mt-4 text-sm font-black uppercase tracking-[0.08em] ${plan.featured ? "text-orange-300" : "text-zinc-500"}`}>
                {plan.price}
              </p>
              <ul className="mt-4 space-y-2">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm font-semibold leading-snug">
                    <Check className={`mt-0.5 h-4 w-4 shrink-0 ${plan.featured ? "text-orange-400" : "text-orange-600"}`} />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              <Link
                href={plan.cta}
                className={`mt-5 inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-xs font-black uppercase tracking-[0.08em] transition ${
                  plan.featured
                    ? "bg-orange-500 text-zinc-950 hover:bg-orange-400"
                    : "border border-zinc-900/15 bg-white text-zinc-900 hover:border-zinc-900/30"
                }`}
              >
                Activer cette offre
                <ArrowRight className="h-4 w-4" />
              </Link>
            </article>
          ))}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {[
          {
            icon: Wallet,
            title: "Paiement local clair",
            copy: "MVola et Orange Money avec reference de transaction et verification explicite.",
          },
          {
            icon: ShieldCheck,
            title: "Plan applique apres validation",
            copy: "Une fois valide, votre plan choisi est applique et visible dans l'app.",
          },
          {
            icon: Headset,
            title: "Support humain FLARE",
            copy: "Accompagnement operationnel pendant la mise en route et les etapes critiques.",
          },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <article key={item.title} className="rounded-2xl border border-zinc-900/10 bg-white/75 p-5">
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-900/12 bg-[#f8f2e8]">
                <Icon className="h-5 w-5 text-zinc-900" />
              </div>
              <h3 className="mt-3 text-xl font-black tracking-tight text-zinc-950">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-700">{item.copy}</p>
            </article>
          );
        })}
      </section>

      <section className="rounded-[28px] border border-zinc-900/10 bg-white/78 p-6 md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-zinc-500">Praticite</p>
            <h2 className="mt-2 text-3xl font-black tracking-tight text-zinc-950">Pret a passer en production ?</h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-zinc-700">
              Ouvrez votre espace, choisissez l&apos;offre adaptee, puis lancez votre activation avec accompagnement FLARE.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/app?auth=signup"
              className="inline-flex items-center gap-2 rounded-full bg-zinc-950 px-5 py-3 text-xs font-black uppercase tracking-[0.08em] text-white transition hover:bg-zinc-800"
            >
              Demarrer maintenant
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/comment-ca-marche"
              className="inline-flex items-center gap-2 rounded-full border border-zinc-900/15 bg-white px-5 py-3 text-xs font-black uppercase tracking-[0.08em] text-zinc-900 transition hover:border-zinc-900/30"
            >
              Voir le parcours
              <BadgeCheck className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
    </PublicPageShell>
  );
}
