"use client";

import { ChevronDown, ChevronUp, Loader2, Save, Trash2 } from "lucide-react";

import type { SalesConfig } from "@/lib/api";
import { InputField, SectionCard, SelectField, TextareaField } from "@/components/chatbot/ChatbotUi";
import { CTA_OPTIONS, HOT_LEAD_OPTIONS } from "@/components/chatbot/chatbotWorkspaceUtils";

interface ChatbotSalesTabProps {
  salesConfig: SalesConfig;
  canEdit: boolean;
  saving: boolean;
  newQualificationStep: string;
  newObjection: string;
  newObjectionResponse: string;
  onChange: (next: SalesConfig) => void;
  onSave: () => void;
  onQualificationDraftChange: (value: string) => void;
  onObjectionDraftChange: (value: string) => void;
  onObjectionResponseDraftChange: (value: string) => void;
  onAddQualificationStep: () => void;
  onAddObjectionPair: () => void;
}

export default function ChatbotSalesTab({
  salesConfig,
  canEdit,
  saving,
  newQualificationStep,
  newObjection,
  newObjectionResponse,
  onChange,
  onSave,
  onQualificationDraftChange,
  onObjectionDraftChange,
  onObjectionResponseDraftChange,
  onAddQualificationStep,
  onAddObjectionPair,
}: ChatbotSalesTabProps) {
  const isLocked = !canEdit || saving;

  return (
    <SectionCard
      title="Script de vente"
      description="Organisez la qualification, les objections, le CTA principal et les signaux de lead chaud."
      action={
        <button
          onClick={onSave}
          disabled={isLocked}
          className="inline-flex items-center gap-2 rounded-full bg-orange-500 px-4 py-2.5 text-[12px] font-semibold uppercase tracking-[0.12em] text-[#140b02] disabled:opacity-60"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          Enregistrer
        </button>
      }
    >
      <div className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-[26px] border border-[var(--border-default)] bg-[var(--surface-subtle)] p-4">
          <h3 className="text-[16px] font-semibold text-[var(--text-primary)]">Etapes de qualification</h3>
          <div className="mt-4 flex gap-2">
            <input
              value={newQualificationStep}
              onChange={(event) => onQualificationDraftChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== "Enter") return;
                event.preventDefault();
                onAddQualificationStep();
              }}
              placeholder="Ex: Demander le prenom"
              disabled={isLocked}
              className="flex-1 rounded-2xl border border-[var(--border-default)] bg-[var(--surface-base)] px-4 py-3 text-[14px] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-placeholder)] disabled:cursor-not-allowed disabled:opacity-60"
            />
            <button
              onClick={onAddQualificationStep}
              disabled={isLocked || !newQualificationStep.trim()}
              className="rounded-full bg-[var(--accent-orange)] px-4 py-2.5 text-[12px] font-semibold uppercase tracking-[0.12em] text-[#140b02] disabled:cursor-not-allowed disabled:opacity-60"
            >
              Ajouter
            </button>
          </div>
          <div className="mt-4 space-y-3">
            {salesConfig.qualification_steps.length === 0 ? (
              <p className="text-[13px] text-[var(--text-secondary)]">Aucune etape pour le moment.</p>
            ) : (
              salesConfig.qualification_steps.map((step, index) => (
                <div key={`${step}-${index}`} className="flex items-center gap-3 rounded-2xl border border-[var(--border-default)] bg-[var(--surface-base)] px-4 py-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--surface-raised)] text-[12px] font-semibold text-[var(--text-primary)]">
                    {index + 1}
                  </span>
                  <p className="flex-1 text-[13px] text-[var(--text-primary)]">{step}</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        if (index === 0) return;
                        const next = [...salesConfig.qualification_steps];
                        [next[index - 1], next[index]] = [next[index], next[index - 1]];
                        onChange({ ...salesConfig, qualification_steps: next });
                      }}
                      aria-label={`Monter l'etape ${index + 1}`}
                      disabled={isLocked || index === 0}
                      className="rounded-full border border-[var(--border-default)] bg-[var(--surface-subtle)] p-2 text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <ChevronUp size={13} />
                    </button>
                    <button
                      onClick={() => {
                        if (index === salesConfig.qualification_steps.length - 1) return;
                        const next = [...salesConfig.qualification_steps];
                        [next[index + 1], next[index]] = [next[index], next[index + 1]];
                        onChange({ ...salesConfig, qualification_steps: next });
                      }}
                      aria-label={`Descendre l'etape ${index + 1}`}
                      disabled={isLocked || index === salesConfig.qualification_steps.length - 1}
                      className="rounded-full border border-[var(--border-default)] bg-[var(--surface-subtle)] p-2 text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <ChevronDown size={13} />
                    </button>
                    <button
                      onClick={() =>
                        onChange({
                          ...salesConfig,
                          qualification_steps: salesConfig.qualification_steps.filter((_, itemIndex) => itemIndex !== index),
                        })
                      }
                      aria-label={`Supprimer l'etape ${index + 1}`}
                      disabled={isLocked}
                      className="rounded-full border border-red-500/30 bg-red-500/10 p-2 text-red-600 disabled:cursor-not-allowed disabled:opacity-40 dark:text-red-300"
                    >
                        <Trash2 size={13} />
                      </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-[26px] border border-[var(--border-default)] bg-[var(--surface-subtle)] p-4">
            <h3 className="text-[16px] font-semibold text-[var(--text-primary)]">Objections frequentes</h3>
            <div className="mt-4 space-y-3">
              <InputField
                label="Objection"
                value={newObjection}
                onChange={onObjectionDraftChange}
                placeholder="Ex: C'est trop cher"
                disabled={isLocked}
              />
              <TextareaField
                label="Reponse du bot"
                value={newObjectionResponse}
                onChange={onObjectionResponseDraftChange}
                placeholder="Je comprends. Voici notre offre Starter..."
                rows={3}
                disabled={isLocked}
              />
              <button
                onClick={onAddObjectionPair}
                disabled={isLocked || !newObjection.trim() || !newObjectionResponse.trim()}
                className="rounded-full bg-[var(--accent-orange)] px-4 py-2.5 text-[12px] font-semibold uppercase tracking-[0.12em] text-[#140b02] disabled:cursor-not-allowed disabled:opacity-60"
              >
                Ajouter l&apos;objection
              </button>
              <div className="space-y-3">
                {salesConfig.objections.length === 0 ? (
                  <p className="text-[13px] text-[var(--text-secondary)]">Aucune objection enregistree.</p>
                ) : (
                  salesConfig.objections.map((item, index) => (
                    <div key={`${item.objection}-${index}`} className="rounded-2xl border border-[var(--border-default)] bg-[var(--surface-base)] px-4 py-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-[12px] uppercase tracking-[0.14em] text-[var(--text-muted)]">Objection</p>
                          <p className="mt-2 text-[13px] text-[var(--text-primary)]">{item.objection || "Sans texte"}</p>
                          <p className="mt-3 text-[12px] uppercase tracking-[0.14em] text-[var(--text-muted)]">Reponse</p>
                          <p className="mt-2 text-[13px] leading-6 text-[var(--text-secondary)]">{item.response || "Sans reponse"}</p>
                        </div>
                        <button
                          onClick={() =>
                            onChange({
                              ...salesConfig,
                              objections: salesConfig.objections.filter((_, itemIndex) => itemIndex !== index),
                            })
                          }
                          aria-label={`Supprimer l'objection ${index + 1}`}
                          disabled={isLocked}
                          className="rounded-full border border-red-500/30 bg-red-500/10 p-2 text-red-600 disabled:cursor-not-allowed disabled:opacity-40 dark:text-red-300"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="rounded-[26px] border border-[var(--border-default)] bg-[var(--surface-subtle)] p-4">
            <h3 className="text-[16px] font-semibold text-[var(--text-primary)]">CTA principal</h3>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <SelectField
                label="Type de CTA"
                value={salesConfig.cta_type}
                onChange={(cta_type) => onChange({ ...salesConfig, cta_type })}
                options={CTA_OPTIONS}
                disabled={!canEdit}
              />
              <InputField
                label="Texte du CTA"
                value={salesConfig.cta_text}
                onChange={(cta_text) => onChange({ ...salesConfig, cta_text })}
                placeholder="Ex: Obtenez votre devis gratuit"
                disabled={!canEdit}
              />
            </div>
            <div className="mt-4">
              <InputField
                label="Lien CTA"
                value={salesConfig.cta_url}
                onChange={(cta_url) => onChange({ ...salesConfig, cta_url })}
                placeholder="https://..."
                type="url"
                disabled={!canEdit}
              />
            </div>
          </div>

          <div className="rounded-[26px] border border-[var(--border-default)] bg-[var(--surface-subtle)] p-4">
            <h3 className="text-[16px] font-semibold text-[var(--text-primary)]">Scoring leads</h3>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {HOT_LEAD_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className="flex items-center gap-3 rounded-2xl border border-[var(--border-default)] bg-[var(--surface-base)] px-4 py-3"
                >
                  <input
                    type="checkbox"
                    checked={salesConfig.hot_lead_signals.includes(option.value)}
                    onChange={(event) =>
                      onChange({
                        ...salesConfig,
                        hot_lead_signals: event.target.checked
                          ? [...salesConfig.hot_lead_signals, option.value]
                          : salesConfig.hot_lead_signals.filter((value) => value !== option.value),
                      })
                    }
                  />
                  <span className="text-[13px] text-[var(--text-primary)]">{option.label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>
    </SectionCard>
  );
}
