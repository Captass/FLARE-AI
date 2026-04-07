"use client";

import { Loader2, Plus, Save } from "lucide-react";

import type { PortfolioItem, PortfolioItemInput } from "@/lib/api";
import { EmptyState, InputField, SectionCard, TextareaField } from "@/components/chatbot/ChatbotUi";

interface ChatbotPortfolioTabProps {
  items: PortfolioItem[];
  draft: PortfolioItemInput;
  editingId: string | null;
  canEdit: boolean;
  saving: boolean;
  onChangeDraft: (next: PortfolioItemInput) => void;
  onEdit: (item: PortfolioItem) => void;
  onReset: () => void;
  onSave: () => void;
  onDelete: (id: string) => void;
}

export default function ChatbotPortfolioTab({
  items,
  draft,
  editingId,
  canEdit,
  saving,
  onChangeDraft,
  onEdit,
  onReset,
  onSave,
  onDelete,
}: ChatbotPortfolioTabProps) {
  const isLocked = !canEdit || saving;

  return (
    <SectionCard
      title="Portfolio"
      description="Ajoutez les exemples et preuves sociales que le bot peut partager quand un prospect demande des references."
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
        <div className="rounded-[26px] border border-[var(--border-default)] bg-[var(--surface-subtle)] p-4">
          <h3 className="text-[16px] font-semibold text-[var(--text-primary)]">
            {editingId ? "Modifier une realisation" : "Ajouter une realisation"}
          </h3>
          <div className="mt-4 space-y-4">
            <InputField
              label="Titre"
              value={draft.title || ""}
              onChange={(title) => onChangeDraft({ ...draft, title })}
              placeholder="Ex: Campagne spot publicitaire"
              disabled={isLocked}
            />
            <TextareaField
              label="Description"
              value={draft.description || ""}
              onChange={(description) => onChangeDraft({ ...draft, description })}
              placeholder="Que faut-il retenir de cette realisation ?"
              rows={4}
              disabled={isLocked}
            />
            <InputField
              label="Lien video"
              value={draft.video_url || ""}
              onChange={(video_url) => onChangeDraft({ ...draft, video_url })}
              placeholder="YouTube, Vimeo, TikTok..."
              type="url"
              disabled={isLocked}
            />
            <InputField
              label="Lien image / site"
              value={draft.external_url || ""}
              onChange={(external_url) => onChangeDraft({ ...draft, external_url })}
              placeholder="Lien vers un site ou une image"
              type="url"
              disabled={isLocked}
            />
            <InputField
              label="Client"
              value={draft.client_name || ""}
              onChange={(client_name) => onChangeDraft({ ...draft, client_name })}
              placeholder="Optionnel"
              disabled={isLocked}
            />
            <label className="flex items-center gap-3 rounded-2xl border border-[var(--border-default)] bg-[var(--surface-base)] px-4 py-3">
              <input
                type="checkbox"
                checked={Boolean(draft.auto_share)}
                onChange={(event) => onChangeDraft({ ...draft, auto_share: event.target.checked })}
                disabled={isLocked}
              />
              <span className="text-[13px] text-[var(--text-primary)]">Partager automatiquement en fin de conversation</span>
            </label>
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
              className="rounded-full border border-[var(--border-default)] bg-[var(--surface-base)] px-4 py-2.5 text-[12px] font-semibold uppercase tracking-[0.12em] text-[var(--text-primary)] transition-all hover:border-[var(--border-strong)] hover:bg-[var(--surface-raised)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Reinitialiser
            </button>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          {items.length === 0 ? (
            <EmptyState
              title="Aucune realisation"
              body="Ajoutez vos meilleurs exemples pour que le bot puisse prouver votre savoir-faire."
            />
          ) : (
            items.map((item) => (
              <article key={item.id} className="rounded-[26px] border border-[var(--border-default)] bg-[var(--surface-subtle)] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-[16px] font-semibold text-[var(--text-primary)]">{item.title}</h3>
                    <p className="mt-2 text-[13px] leading-6 text-[var(--text-secondary)]">{item.description || "Sans description."}</p>
                  </div>
                </div>
                <div className="mt-4 space-y-2 text-[12px] text-[var(--text-secondary)]">
                  {item.client_name ? <p>Client: {item.client_name}</p> : null}
                  <p>Auto-share: {item.auto_share ? "Oui" : "Non"}</p>
                </div>
                <div className="mt-4 flex gap-2">
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
              </article>
            ))
          )}
        </div>
      </div>
    </SectionCard>
  );
}
