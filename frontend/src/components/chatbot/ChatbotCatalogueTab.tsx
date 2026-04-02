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
          className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] px-4 py-2.5 text-[12px] font-semibold uppercase tracking-[0.12em] text-white/70 transition-all hover:border-white/[0.16] hover:text-white"
        >
          <Plus size={14} />
          Ajouter
        </button>
      }
    >
      <div className="grid gap-6 xl:grid-cols-[minmax(320px,0.9fr)_minmax(0,1.1fr)]">
        <div className="rounded-[26px] border border-white/[0.06] bg-white/[0.02] p-4">
          <h3 className="text-[16px] font-semibold text-white">
            {editingId ? "Modifier un produit ou service" : "Ajouter un produit ou service"}
          </h3>
          {!editingId ? (
            <div className="mt-4 rounded-[22px] border border-white/[0.06] bg-black/20 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/34">Ajout rapide</p>
              <p className="mt-2 text-[13px] leading-6 text-white/46">
                Commencez par votre offre la plus simple ou reutilisez un modele pour remplir le formulaire plus vite.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {templates.map((template) => (
                  <button
                    key={template.name}
                    onClick={() => onApplyTemplate(template)}
                    disabled={!canEdit}
                    className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/72 transition-all hover:border-white/[0.16] hover:text-white disabled:opacity-50"
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
              disabled={!canEdit}
            />
            <TextareaField
              label="Description"
              value={draft.description || ""}
              onChange={(description) => onChangeDraft({ ...draft, description })}
              placeholder="Description utile au bot pour repondre aux prospects."
              rows={4}
              disabled={!canEdit}
            />
            <div className="grid gap-4 md:grid-cols-2">
              <InputField
                label="Prix"
                value={draft.price || ""}
                onChange={(price) => onChangeDraft({ ...draft, price })}
                placeholder="Ex: 120 000 Ar / Sur devis"
                disabled={!canEdit}
              />
              <InputField
                label="Categorie"
                value={draft.category || ""}
                onChange={(category) => onChangeDraft({ ...draft, category })}
                placeholder="Ex: Pack Pro"
                disabled={!canEdit}
              />
            </div>
            <InputField
              label="Image"
              value={draft.image_url || ""}
              onChange={(image_url) => onChangeDraft({ ...draft, image_url })}
              placeholder="Lien image optionnel"
              type="url"
              disabled={!canEdit}
            />
          </div>
          <div className="mt-5 flex gap-2">
            <button
              onClick={onSave}
              disabled={saving || !canEdit}
              className="inline-flex items-center gap-2 rounded-full bg-orange-500 px-4 py-2.5 text-[12px] font-semibold uppercase tracking-[0.12em] text-[#140b02] disabled:opacity-60"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Enregistrer
            </button>
            <button
              onClick={onReset}
              className="rounded-full border border-white/[0.08] px-4 py-2.5 text-[12px] font-semibold uppercase tracking-[0.12em] text-white/70 transition-all hover:border-white/[0.16] hover:text-white"
            >
              Reinitialiser
            </button>
          </div>
          {planFeatures ? (
            <p className="mt-4 text-[12px] text-white/28">
              Limite catalogue pour votre plan: {planFeatures.catalogue_items_limit === -1 ? "illimite" : `${planFeatures.catalogue_items_limit} article(s)`}
            </p>
          ) : null}
          <div className="mt-5 rounded-[22px] border border-white/[0.06] bg-black/20 px-4 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/36">Apercu de reponse</p>
            <div className="mt-3 space-y-3">
              <div className="ml-auto max-w-[18rem] rounded-[18px] border border-white/[0.08] bg-white/[0.04] px-3 py-2.5 text-[12px] leading-6 text-white/66">
                Vous avez quoi pour m&apos;aider ?
              </div>
              <div className="max-w-[22rem] rounded-[18px] border border-orange-400/18 bg-orange-500/[0.08] px-3 py-2.5 text-[12px] leading-6 text-white/84">
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
              <article key={item.id} className="rounded-[26px] border border-white/[0.06] bg-white/[0.02] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-[16px] font-semibold text-white">{item.name}</h3>
                      {item.category ? (
                        <span className="rounded-full border border-white/[0.08] bg-white/[0.04] px-2.5 py-1 text-[10px] text-white/35">
                          {item.category}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-2 text-[13px] leading-6 text-white/42">{item.description || "Sans description."}</p>
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between gap-3">
                  <div className="text-[13px] font-medium text-orange-200">{item.price || "Sur devis"}</div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => onEdit(item)}
                      className="rounded-full border border-white/[0.08] px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/70 transition-all hover:border-white/[0.16] hover:text-white"
                    >
                      Modifier
                    </button>
                    <button
                      onClick={() => onDelete(item.id)}
                      className="rounded-full border border-red-400/18 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-red-100 transition-all hover:bg-red-500/[0.08]"
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
