"use client";

import { useMemo, useState } from "react";
import { BellPlus, Plus, Search, Users } from "lucide-react";
import {
  executiveContacts,
  type ExecutiveContactCategory,
  type ExecutivePriority,
} from "@/data/executiveDeskMock";
import ExecutiveBenefitBadges from "@/components/pages/ExecutiveBenefitBadges";

const ALL = "Tous";
const categories: Array<typeof ALL | ExecutiveContactCategory> = [
  ALL,
  "Famille",
  "Professionnel",
  "Équipe",
  "Client",
  "Partenaire",
  "Personnel",
];
const importances: Array<typeof ALL | ExecutivePriority> = [ALL, "Haute", "Normale", "Basse"];

function importanceClass(value: string) {
  if (value === "Haute") return "border-orange-500/25 bg-orange-500/10 text-orange-600";
  if (value === "Normale") return "border-blue-500/20 bg-blue-500/10 text-blue-700 dark:text-blue-300";
  return "border-[var(--border-default)] bg-[var(--surface-subtle)] text-[var(--text-secondary)]";
}

export default function ExecutiveContactsPage() {
  const [category, setCategory] = useState<string>(ALL);
  const [importance, setImportance] = useState<string>(ALL);
  const [notice, setNotice] = useState<string | null>(null);

  const filteredContacts = useMemo(
    () =>
      executiveContacts.filter(
        (contact) =>
          (category === ALL || contact.category === category) &&
          (importance === ALL || contact.importance === importance),
      ),
    [category, importance],
  );

  const showNotice = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice((current) => (current === message ? null : current)), 2600);
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-6 px-4 py-8 md:px-8 md:py-12">
        <header className="rounded-[28px] border border-[var(--border-default)] bg-[var(--bg-card)] p-6 md:p-8">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-orange-500/20 bg-orange-500/10 px-3 py-1 text-xs font-semibold text-orange-600 dark:text-orange-300">
            <Users size={14} />
            Démo contacts
          </div>
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-3xl font-black tracking-tight text-[var(--text-primary)] md:text-4xl">
                Contacts intelligents
              </h1>
              <p className="mt-3 max-w-3xl text-base leading-relaxed text-[var(--text-secondary)]">
                Classez vos contacts personnels, familiaux et professionnels pour mieux suivre vos relations importantes.
              </p>
              <p className="mt-4 max-w-3xl text-lg font-semibold leading-relaxed text-[var(--text-primary)]">
                Vos relations importantes sont classées pour ne plus oublier les suivis essentiels.
              </p>
              <div className="mt-5">
                <ExecutiveBenefitBadges items={["Moins d’oublis", "Priorités claires", "Gain de temps"]} />
              </div>
            </div>
            <button
              type="button"
              onClick={() => showNotice("Ajout de contact simulé.")}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-orange-500 px-5 py-3 text-sm font-bold text-white hover:bg-orange-600"
            >
              <Plus size={16} />
              Ajouter contact
            </button>
          </div>
        </header>

        {notice && (
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
            {notice}
          </div>
        )}

        <section className="flex flex-col gap-3 rounded-[24px] border border-[var(--border-default)] bg-[var(--bg-card)] p-4 md:flex-row">
          <label className="flex flex-1 flex-col gap-1 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-secondary)]">
            Catégorie
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              className="h-11 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] px-3 text-sm font-medium normal-case tracking-normal text-[var(--text-primary)] outline-none focus:ring-2 focus:ring-orange-500/30"
            >
              {categories.map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-1 flex-col gap-1 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-secondary)]">
            Importance
            <select
              value={importance}
              onChange={(event) => setImportance(event.target.value)}
              className="h-11 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] px-3 text-sm font-medium normal-case tracking-normal text-[var(--text-primary)] outline-none focus:ring-2 focus:ring-orange-500/30"
            >
              {importances.map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>
          </label>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          {filteredContacts.map((contact) => (
            <article key={contact.id} className="rounded-[24px] border border-[var(--border-default)] bg-[var(--bg-card)] p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full border border-[var(--border-default)] bg-[var(--surface-subtle)] px-2.5 py-1 text-xs font-semibold text-[var(--text-secondary)]">
                      {contact.category}
                    </span>
                    <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${importanceClass(contact.importance)}`}>
                      {contact.importance}
                    </span>
                  </div>
                  <h2 className="mt-3 text-xl font-bold text-[var(--text-primary)]">{contact.name}</h2>
                  <p className="mt-1 text-sm text-[var(--text-secondary)]">Dernière interaction : {contact.lastInteraction}</p>
                  <p className="mt-3 text-sm font-semibold text-[var(--text-primary)]">{contact.nextAction}</p>
                  <p className="mt-1 text-sm text-[var(--text-secondary)]">{contact.notes}</p>
                </div>
                <button
                  type="button"
                  onClick={() => showNotice(`Rappel créé : ${contact.nextAction}`)}
                  className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl border border-[var(--border-default)] bg-[var(--surface-subtle)] px-4 py-2.5 text-sm font-bold text-[var(--text-primary)] hover:bg-[var(--surface-raised)]"
                >
                  <BellPlus size={15} />
                  Créer rappel
                </button>
              </div>
            </article>
          ))}
          {filteredContacts.length === 0 && (
            <div className="rounded-[24px] border border-[var(--border-default)] bg-[var(--bg-card)] p-8 text-center text-[var(--text-secondary)] lg:col-span-2">
              <Search className="mx-auto mb-3 text-orange-500" size={24} />
              Aucun contact ne correspond aux filtres.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
