"use client";

import { Loader2, Plus, Save } from "lucide-react";

import type { CatalogueItem, CatalogueItemInput, PlanFeatures } from "@/lib/api";
import { EmptyState, InputField, SectionCard, TextareaField } from "@/components/chatbot/ChatbotUi";

interface ChatbotCatalogueTabProps {
  items: CatalogueItem[];
  draft: CatalogueItemInput;
  editingId: string | null;
  canEdit: boolean;
  saving: boolean;
  planFeatures: PlanFeatures | null;
  templates: CatalogueItemInput[];
  onChangeDraft: (next: CatalogueItemInput) => void;
  onApplyTemplate: (template: CatalogueItemInput) => void;
  onEdit: (item: CatalogueItem) => void;
  onReset: () => void;
  onSave: () => void;
  onDelete: (id: string) => void;
}

export default function ChatbotCatalogueTab({
  items,
  draft,
  editingId,
  canEdit,
  saving,
  planFeatures,
  templates,
  onChangeDraft,
  onApplyTemplate,
  onEdit,
  onReset,
  onSave,
  onDelete,
}: ChatbotCatalogueTabProps) {
  const isLocked = !canEdit || saving;
  const previewResponse = draft.name?.trim()
    ? `Je peux vous proposer ${draft.name.trim()}${draft.category ? ` dans ${draft.category.trim()}` : ""}. ${draft.description?.trim() || "C'est une offre que nous adaptons selon votre besoin."}${draft.price?.trim() ? ` Le tarif est ${draft.price.trim()}.` : " Le prix se donne apres qualification ou sur devis."}`
    : "Ajoutez un nom, une description et un prix indicatif pour voir comment le bot pourra presenter cette offre.";

  return (
    <SectionCard
      title="Catalogue"
      description="Ajoutez vos produits et services pour que le bot puisse les presenter rapidement."
      action={
        <button
          onClick={onReset}
          disabled={isLocked}
          className="inline-flex items-center gap-2 rounded-full border border-[var(--border-default)] bg-[var(--surface-subtle)] px-4 py-2.5 text-[12px] font-semibold uppercase tracking-[0.12em] text-[var(--text-primary)] transition-all hover:border-[var(--border-strong)] hover:bg-[var(--surface-raised)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus size={14} />
          Nouveau
        </button>
      }
    >
      <div className="grid gap-6 xl:grid-cols-[minmax(320px,0.9fr)_minmax(0,1.1fr)]">
        <div className="flex flex-col">
          <h3 className="text-[16px] font-semibold text-[var(--text-primary)]">
            {editingId ? "Modifier un produit ou service" : "Ajouter un produit ou service"}
          </h3>
          {!editingId ? (
            <div className="mt-4 rounded-[22px] border border-[var(--border-default)] bg-[var(--surface-subtle)] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">Ajout rapide</p>
              <p className="mt-2 text-[13px] leading-6 text-[var(--text-secondary)]">
                Commencez par votre offre la plus simple ou reutilisez un modele pour remplir le formulaire plus vite.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {templates.map((template) => (
                  <button
                    key={template.name}
                    onClick={() => onApplyTemplate(template)}
                    disabled={isLocked}
                    className="rounded-full border border-[var(--border-default)] bg-[var(--surface-base)] px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-primary)] transition-all hover:border-[var(--border-strong)] hover:bg-[var(--surface-raised)] disabled:opacity-50"
                  >
                    {template.name}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          <div className="mt-4 space-y-4">
            <InputField
              label="Nom"
              value={draft.name || ""}
              onChange={(name) => onChangeDraft({ ...draft, name })}
              placeholder="Ex: Pack Essentiel"
              disabled={isLocked}
            />
            <TextareaField
              label="Description"
              value={draft.description || ""}
              onChange={(description) => onChangeDraft({ ...draft, description })}
              placeholder="Description utile au bot pour repondre aux prospects."
              rows={4}
              disabled={isLocked}
            />
            <div className="grid gap-4 md:grid-cols-2">
              <InputField
                label="Prix"
                value={draft.price || ""}
                onChange={(price) => onChangeDraft({ ...draft, price })}
                placeholder="Ex: 120 000 Ar / Sur devis"
                disabled={isLocked}
              />
              <InputField
                label="Categorie"
                value={draft.category || ""}
                onChange={(category) => onChangeDraft({ ...draft, category })}
                placeholder="Ex: Pack Pro"
                disabled={isLocked}
              />
            </div>
            <InputField
              label="Photo du produit (Lien web URL)"
              value={draft.image_url || ""}
              onChange={(image_url) => onChangeDraft({ ...draft, image_url })}
              placeholder="Ex: https://monsite.com/image.jpg"
              type="url"
              disabled={isLocked}
            />
          </div>
          <div className="mt-5 flex gap-2">
            <button
              onClick={onSave}
              disabled={isLocked}
              className="inline-flex items-center gap-2 rounded-full bg-orange-500 px-4 py-2.5 text-[12px] font-semibold uppercase tracking-[0.12em] text-[#140b02] disabled:opacity-60"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Enregistrer
            </button>
            <button
              onClick={onReset}
              disabled={isLocked}
              className="rounded-full border border-[var(--border-default)] bg-[var(--surface-subtle)] px-4 py-2.5 text-[12px] font-semibold uppercase tracking-[0.12em] text-[var(--text-primary)] transition-all hover:border-[var(--border-strong)] hover:bg-[var(--surface-raised)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Reinitialiser
            </button>
          </div>
          {planFeatures ? (
            <p className="mt-4 text-[12px] text-[var(--text-secondary)]">
              Limite catalogue pour votre plan: {planFeatures.catalogue_items_limit === -1 ? "illimite" : `${planFeatures.catalogue_items_limit} article(s)`}
            </p>
          ) : null}
          <div className="mt-5 rounded-[22px] border border-[var(--border-default)] bg-[var(--surface-subtle)] px-4 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">Apercu de reponse</p>
            <div className="mt-3 space-y-3">
              <div className="ml-auto max-w-[18rem] rounded-[18px] border border-[var(--border-default)] bg-[var(--surface-raised)] px-3 py-2.5 text-[12px] leading-6 text-[var(--text-primary)]">
                Vous avez quoi pour m&apos;aider ?
              </div>
              <div className="max-w-[22rem] rounded-[18px] border border-[color:color-mix(in_srgb,var(--accent-orange)_24%,transparent)] bg-[color:color-mix(in_srgb,var(--accent-orange)_12%,var(--surface-base))] px-3 py-2.5 text-[12px] leading-6 text-[var(--text-primary)]">
                {previewResponse}
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          {items.length === 0 ? (
            <EmptyState
              title="Aucun produit ou service"
              body="Ajoutez au moins un article pour que le bot puisse le presenter en conversation."
            />
          ) : (
            items.map((item) => (
              <article key={item.id} className="rounded-[22px] border border-[var(--border-default)] bg-[var(--surface-subtle)] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-[16px] font-semibold text-[var(--text-primary)]">{item.name}</h3>
                      {item.category ? (
                        <span className="rounded-full border border-[var(--border-default)] bg-[var(--surface-raised)] px-2.5 py-1 text-[10px] text-[var(--text-secondary)]">
                          {item.category}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-2 text-[13px] leading-6 text-[var(--text-secondary)]">{item.description || "Sans description."}</p>
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between gap-3">
                  <div className="text-[13px] font-medium text-[var(--accent-orange)]">{item.price || "Sur devis"}</div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => onEdit(item)}
                      disabled={isLocked}
                      className="rounded-full border border-[var(--border-default)] bg-[var(--surface-base)] px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-primary)] transition-all hover:border-[var(--border-strong)] hover:bg-[var(--surface-raised)] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Modifier
                    </button>
                    <button
                      onClick={() => onDelete(item.id)}
                      disabled={isLocked}
                      className="rounded-full border border-red-500/30 bg-red-500/10 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-red-600 transition-all hover:bg-red-500/15 disabled:cursor-not-allowed disabled:opacity-50 dark:text-red-300"
                    >
                      Supprimer
                    </button>
                  </div>
                </div>
              </article>
            ))
          )}
        </div>
      </div>
    </SectionCard>
  );
}
