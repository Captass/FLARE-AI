"use client";

import { useMemo, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { GripVertical, ImagePlus, Loader2, Plus, Save, Trash2, Upload } from "lucide-react";

import type { CatalogueItem, CatalogueItemInput, PlanFeatures } from "@/lib/api";
import { toRenderableMediaUrl } from "@/lib/api";
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

function normalizeDraftImages(draft: CatalogueItemInput): string[] {
  const values = [...(draft.product_images || [])];
  if (draft.image_url) values.push(draft.image_url);
  const deduped: string[] = [];
  for (const value of values) {
    const trimmed = String(value || "").trim();
    if (!trimmed || deduped.includes(trimmed)) continue;
    deduped.push(trimmed);
    if (deduped.length >= 8) break;
  }
  return deduped;
}

function createDraftWithImages(draft: CatalogueItemInput, images: string[]): CatalogueItemInput {
  const nextImages = images.slice(0, 8);
  return {
    ...draft,
    image_url: nextImages[0] || "",
    product_images: nextImages,
  };
}

async function filesToDataUrls(files: File[]): Promise<string[]> {
  const accepted = files.filter((file) => file.type.startsWith("image/")).slice(0, 8);
  return Promise.all(
    accepted.map(
      (file) =>
        new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result || ""));
          reader.onerror = () => reject(new Error(`Lecture impossible: ${file.name}`));
          reader.readAsDataURL(file);
        }),
    ),
  );
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
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const draftImages = useMemo(() => normalizeDraftImages(draft), [draft]);
  const previewResponse = draft.name?.trim()
    ? `Je peux vous proposer ${draft.name.trim()}${draft.category ? ` dans ${draft.category.trim()}` : ""}. ${draft.description?.trim() || "C'est une offre que nous adaptons selon votre besoin."}${draft.price?.trim() ? ` Le tarif est ${draft.price.trim()}.` : " Le prix se donne apres qualification ou sur devis."}`
    : "Ajoutez un nom, une description et un prix indicatif pour voir comment le bot pourra presenter cette offre.";

  const setDraftImages = (images: string[]) => {
    onChangeDraft(createDraftWithImages(draft, images));
  };

  const handleFiles = async (files: File[]) => {
    if (isLocked || files.length === 0) return;
    try {
      setUploadError(null);
      const nextImages = await filesToDataUrls(files);
      if (nextImages.length === 0) {
        setUploadError("Ajoutez uniquement des images JPG, PNG ou WEBP.");
        return;
      }
      setDraftImages([...draftImages, ...nextImages].slice(0, 8));
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Import impossible.");
    }
  };

  const handleDrop = async (event: DragEvent<HTMLButtonElement>) => {
    event.preventDefault();
    setDragActive(false);
    const files = Array.from(event.dataTransfer.files || []);
    await handleFiles(files);
  };

  const handleInputChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    await handleFiles(files);
    event.target.value = "";
  };

  const addImageUrl = (imageUrl: string) => {
    const trimmed = imageUrl.trim();
    if (!trimmed) {
      setDraftImages(draftImages);
      return;
    }
    setDraftImages([...draftImages.filter((value) => value !== trimmed), trimmed]);
  };

  const removeImage = (image: string) => {
    setDraftImages(draftImages.filter((value) => value !== image));
  };

  const moveImage = (image: string, direction: -1 | 1) => {
    const currentIndex = draftImages.findIndex((value) => value === image);
    const targetIndex = currentIndex + direction;
    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= draftImages.length) return;
    const next = [...draftImages];
    [next[currentIndex], next[targetIndex]] = [next[targetIndex], next[currentIndex]];
    setDraftImages(next);
  };

  return (
    <SectionCard
      title="Catalogue"
      description="Construisez une vraie liste de produits ou services. Le bot lit cette base pour repondre vite, montrer vos visuels et orienter vers la bonne offre."
      action={
        <button
          onClick={onReset}
          disabled={isLocked}
          className="inline-flex items-center gap-2 rounded-full border border-[var(--border-default)] bg-[var(--surface-subtle)] px-4 py-2.5 text-[12px] font-semibold uppercase tracking-[0.12em] text-[var(--text-primary)] transition-all hover:border-[var(--border-strong)] hover:bg-[var(--surface-raised)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus size={14} />
          Nouveau produit
        </button>
      }
    >
      <div className="grid gap-6 xl:grid-cols-[minmax(300px,0.88fr)_minmax(0,1.12fr)]">
        <div className="space-y-4">
          <div className="rounded-[24px] border border-[var(--border-default)] bg-[var(--surface-subtle)] p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
                  Liste produits
                </p>
                <h3 className="mt-2 text-[18px] font-semibold text-[var(--text-primary)]">
                  {items.length} article{items.length > 1 ? "s" : ""}
                </h3>
              </div>
              {planFeatures ? (
                <span className="rounded-full border border-[var(--border-default)] bg-[var(--surface-base)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-secondary)]">
                  {planFeatures.catalogue_items_limit === -1 ? "Illimite" : `${planFeatures.catalogue_items_limit} max`}
                </span>
              ) : null}
            </div>
            {!editingId ? (
              <div className="mt-4 rounded-[18px] border border-[var(--border-default)] bg-[var(--surface-base)] p-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">Ajout rapide</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {templates.map((template) => (
                    <button
                      key={template.name}
                      type="button"
                      onClick={() => onApplyTemplate(template)}
                      disabled={isLocked}
                      className="rounded-full border border-[var(--border-default)] bg-[var(--surface-subtle)] px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-primary)] transition-all hover:border-[var(--border-strong)] hover:bg-[var(--surface-raised)] disabled:opacity-50"
                    >
                      {template.name}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <div className="space-y-3">
            {items.length === 0 ? (
              <EmptyState
                title="Aucun produit ou service"
                body="Ajoutez votre premiere offre pour que le bot sache quoi proposer et quels visuels reprendre."
              />
            ) : (
              items.map((item, index) => {
                const cardImages = item.product_images?.length ? item.product_images : item.image_url ? [item.image_url] : [];
                const isEditing = editingId === item.id;
                return (
                  <article
                    key={item.id}
                    className={`rounded-[22px] border p-4 transition-all ${
                      isEditing
                        ? "border-orange-500/40 bg-[color:color-mix(in_srgb,var(--accent-orange)_10%,var(--surface-subtle))]"
                        : "border-[var(--border-default)] bg-[var(--surface-subtle)]"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 rounded-full border border-[var(--border-default)] bg-[var(--surface-base)] p-2 text-[var(--text-muted)]">
                        <GripVertical size={14} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-[16px] font-semibold text-[var(--text-primary)]">{item.name}</h3>
                          {item.category ? (
                            <span className="rounded-full border border-[var(--border-default)] bg-[var(--surface-base)] px-2.5 py-1 text-[10px] text-[var(--text-secondary)]">
                              {item.category}
                            </span>
                          ) : null}
                          {!item.is_active ? (
                            <span className="rounded-full border border-red-500/25 bg-red-500/10 px-2.5 py-1 text-[10px] text-red-500">
                              Inactif
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-2 line-clamp-3 text-[13px] leading-6 text-[var(--text-secondary)]">
                          {item.description || "Sans description."}
                        </p>
                        <div className="mt-3 flex flex-wrap items-center gap-3 text-[12px] text-[var(--text-secondary)]">
                          <span className="font-semibold text-[var(--accent-orange)]">{item.price || "Sur devis"}</span>
                          <span>{cardImages.length} visuel{cardImages.length > 1 ? "s" : ""}</span>
                          <span>Ordre {typeof item.sort_order === "number" ? item.sort_order + 1 : index + 1}</span>
                        </div>
                        {cardImages.length > 0 ? (
                          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                            {cardImages.slice(0, 4).map((image, imageIndex) => (
                              <img
                                key={`${item.id}-${imageIndex}`}
                                src={toRenderableMediaUrl(image)}
                                alt={`${item.name} ${imageIndex + 1}`}
                                className="h-16 w-16 rounded-2xl border border-[var(--border-default)] object-cover"
                              />
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => onEdit(item)}
                        disabled={isLocked}
                        className="rounded-full border border-[var(--border-default)] bg-[var(--surface-base)] px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-primary)] transition-all hover:border-[var(--border-strong)] hover:bg-[var(--surface-raised)] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Modifier
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(item.id)}
                        disabled={isLocked}
                        className="rounded-full border border-red-500/30 bg-red-500/10 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-red-600 transition-all hover:bg-red-500/15 disabled:cursor-not-allowed disabled:opacity-50 dark:text-red-300"
                      >
                        Supprimer
                      </button>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </div>

        <div className="space-y-5">
          <div className="rounded-[28px] border border-[var(--border-default)] bg-[var(--surface-subtle)] p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h3 className="text-[18px] font-semibold text-[var(--text-primary)]">
                  {editingId ? "Modifier ce produit" : "Nouveau produit"}
                </h3>
                <p className="mt-2 text-[14px] leading-6 text-[var(--text-secondary)]">
                  Renseignez le texte utile au bot et ajoutez plusieurs photos. La premiere image devient le visuel principal.
                </p>
              </div>
              <div className="rounded-full border border-[var(--border-default)] bg-[var(--surface-base)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-secondary)]">
                {draftImages.length}/8 visuels
              </div>
            </div>

            <div className="mt-5 grid gap-4">
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
              <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(280px,0.9fr)]">
                <label className="space-y-2">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
                    Ajouter un visuel par lien
                  </span>
                  <input
                    type="url"
                    value={draft.image_url || ""}
                    onChange={(event) => onChangeDraft({ ...draft, image_url: event.target.value })}
                    onBlur={() => addImageUrl(draft.image_url || "")}
                    placeholder="https://monsite.com/image.jpg"
                    disabled={isLocked}
                    className="w-full rounded-2xl border border-[var(--border-default)] bg-[var(--surface-base)] px-4 py-3 text-[14px] text-[var(--text-primary)] outline-none transition-colors placeholder:text-[var(--text-placeholder)] focus:border-[var(--accent-orange)] focus:ring-2 focus:ring-[var(--focus-ring)] disabled:cursor-not-allowed disabled:opacity-60"
                  />
                  <p className="text-[12px] leading-5 text-[var(--text-secondary)]">
                    Collez un lien image ou utilisez le glisser-deposer ci-contre. Les images locales sont stockees en base64 pour cette v1.
                  </p>
                </label>

                <div className="space-y-2">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
                    Galerie produit
                  </span>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    onDragEnter={(event) => {
                      event.preventDefault();
                      if (!isLocked) setDragActive(true);
                    }}
                    onDragOver={(event) => {
                      event.preventDefault();
                      if (!isLocked) setDragActive(true);
                    }}
                    onDragLeave={(event) => {
                      event.preventDefault();
                      if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
                      setDragActive(false);
                    }}
                    onDrop={handleDrop}
                    disabled={isLocked}
                    className={`flex min-h-[180px] w-full flex-col items-center justify-center rounded-[22px] border border-dashed px-5 py-6 text-center transition-all ${
                      dragActive
                        ? "border-orange-500/50 bg-orange-500/10"
                        : "border-[var(--border-default)] bg-[var(--surface-base)]"
                    } disabled:cursor-not-allowed disabled:opacity-60`}
                  >
                    <Upload size={20} className="text-[var(--accent-orange)]" />
                    <p className="mt-3 text-[13px] font-semibold text-[var(--text-primary)]">
                      Glissez-deposez vos photos ici
                    </p>
                    <p className="mt-2 text-[12px] leading-5 text-[var(--text-secondary)]">
                      JPG, PNG, WEBP. Jusqu&apos;a 8 visuels. Le premier visuel sera la photo principale du produit.
                    </p>
                    <span className="mt-4 inline-flex items-center gap-2 rounded-full border border-[var(--border-default)] bg-[var(--surface-subtle)] px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-primary)]">
                      <ImagePlus size={14} />
                      Choisir des images
                    </span>
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    hidden
                    onChange={handleInputChange}
                  />
                  {uploadError ? <p className="text-[12px] text-red-500">{uploadError}</p> : null}
                </div>
              </div>

              {draftImages.length > 0 ? (
                <div className="rounded-[22px] border border-[var(--border-default)] bg-[var(--surface-base)] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
                      Photos du produit
                    </p>
                    <p className="text-[12px] text-[var(--text-secondary)]">Deplacez ou retirez les visuels inutiles.</p>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {draftImages.map((image, index) => (
                      <div key={`${image}-${index}`} className="rounded-[20px] border border-[var(--border-default)] bg-[var(--surface-subtle)] p-3">
                        <img
                          src={toRenderableMediaUrl(image)}
                          alt={`Produit ${draft.name || "catalogue"} ${index + 1}`}
                          className="h-32 w-full rounded-2xl object-cover"
                        />
                        <div className="mt-3 flex items-center justify-between gap-2">
                          <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-secondary)]">
                            {index === 0 ? "Principal" : `Visuel ${index + 1}`}
                          </span>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => moveImage(image, -1)}
                              disabled={isLocked || index === 0}
                              className="rounded-full border border-[var(--border-default)] bg-[var(--surface-base)] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--text-primary)] disabled:opacity-40"
                            >
                              Haut
                            </button>
                            <button
                              type="button"
                              onClick={() => moveImage(image, 1)}
                              disabled={isLocked || index === draftImages.length - 1}
                              className="rounded-full border border-[var(--border-default)] bg-[var(--surface-base)] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--text-primary)] disabled:opacity-40"
                            >
                              Bas
                            </button>
                            <button
                              type="button"
                              onClick={() => removeImage(image)}
                              disabled={isLocked}
                              className="rounded-full border border-red-500/30 bg-red-500/10 p-2 text-red-500 disabled:opacity-40"
                              aria-label={`Supprimer le visuel ${index + 1}`}
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onSave}
                disabled={isLocked}
                className="inline-flex items-center gap-2 rounded-full bg-orange-500 px-4 py-2.5 text-[12px] font-semibold uppercase tracking-[0.12em] text-[#140b02] disabled:opacity-60"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                {editingId ? "Mettre a jour" : "Enregistrer"}
              </button>
              <button
                type="button"
                onClick={onReset}
                disabled={isLocked}
                className="rounded-full border border-[var(--border-default)] bg-[var(--surface-base)] px-4 py-2.5 text-[12px] font-semibold uppercase tracking-[0.12em] text-[var(--text-primary)] transition-all hover:border-[var(--border-strong)] hover:bg-[var(--surface-raised)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Reinitialiser
              </button>
            </div>
          </div>

          <div className="rounded-[22px] border border-[var(--border-default)] bg-[var(--surface-subtle)] px-4 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">Apercu de reponse</p>
            <div className="mt-3 space-y-3">
              <div className="ml-auto max-w-[18rem] rounded-[18px] border border-[var(--border-default)] bg-[var(--surface-raised)] px-3 py-2.5 text-[12px] leading-6 text-[var(--text-primary)]">
                Vous avez quoi pour m&apos;aider ?
              </div>
              <div className="max-w-[22rem] rounded-[18px] border border-[color:color-mix(in_srgb,var(--accent-orange)_24%,transparent)] bg-[color:color-mix(in_srgb,var(--accent-orange)_12%,var(--surface-base))] px-3 py-2.5 text-[12px] leading-6 text-[var(--text-primary)]">
                {previewResponse}
                {draftImages.length > 0 ? (
                  <span className="mt-2 block text-[11px] text-[var(--text-secondary)]">
                    {draftImages.length} visuel{draftImages.length > 1 ? "s" : ""} disponible{draftImages.length > 1 ? "s" : ""} pour illustrer cette offre.
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    </SectionCard>
  );
}
