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
  return (
    <SectionCard
      title="Script de vente"
      description="Organisez la qualification, les objections, le CTA principal et les signaux de lead chaud."
      action={
        <button
          onClick={onSave}
          disabled={saving || !canEdit}
          className="inline-flex items-center gap-2 rounded-full bg-orange-500 px-4 py-2.5 text-[12px] font-semibold uppercase tracking-[0.12em] text-[#140b02] disabled:opacity-60"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          Enregistrer
        </button>
      }
    >
      <div className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-[26px] border border-white/[0.06] bg-white/[0.02] p-4">
          <h3 className="text-[16px] font-semibold text-white">Etapes de qualification</h3>
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
              className="flex-1 rounded-2xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-[14px] text-white outline-none placeholder:text-white/22"
            />
            <button
              onClick={onAddQualificationStep}
              className="rounded-full bg-white/[0.06] px-4 py-2.5 text-[12px] font-semibold uppercase tracking-[0.12em] text-white"
            >
              Ajouter
            </button>
          </div>
          <div className="mt-4 space-y-3">
            {salesConfig.qualification_steps.length === 0 ? (
              <p className="text-[13px] text-white/25">Aucune etape pour le moment.</p>
            ) : (
              salesConfig.qualification_steps.map((step, index) => (
                <div key={`${step}-${index}`} className="flex items-center gap-3 rounded-2xl bg-white/[0.03] px-4 py-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/[0.05] text-[12px] font-semibold text-white/72">
                    {index + 1}
                  </span>
                  <p className="flex-1 text-[13px] text-white/75">{step}</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        if (index === 0) return;
                        const next = [...salesConfig.qualification_steps];
                        [next[index - 1], next[index]] = [next[index], next[index - 1]];
                        onChange({ ...salesConfig, qualification_steps: next });
                      }}
                      className="rounded-full border border-white/[0.08] p-2 text-white/50"
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
                      className="rounded-full border border-white/[0.08] p-2 text-white/50"
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
                      className="rounded-full border border-red-400/18 p-2 text-red-100"
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
          <div className="rounded-[26px] border border-white/[0.06] bg-white/[0.02] p-4">
            <h3 className="text-[16px] font-semibold text-white">Objections frequentes</h3>
            <div className="mt-4 space-y-3">
              <InputField
                label="Objection"
                value={newObjection}
                onChange={onObjectionDraftChange}
                placeholder="Ex: C'est trop cher"
                disabled={!canEdit}
              />
              <TextareaField
                label="Reponse du bot"
                value={newObjectionResponse}
                onChange={onObjectionResponseDraftChange}
                placeholder="Je comprends. Voici notre offre Starter..."
                rows={3}
                disabled={!canEdit}
              />
              <button
                onClick={onAddObjectionPair}
                className="rounded-full bg-white/[0.06] px-4 py-2.5 text-[12px] font-semibold uppercase tracking-[0.12em] text-white"
              >
                Ajouter l&apos;objection
              </button>
              <div className="space-y-3">
                {salesConfig.objections.length === 0 ? (
                  <p className="text-[13px] text-white/25">Aucune objection enregistree.</p>
                ) : (
                  salesConfig.objections.map((item, index) => (
                    <div key={`${item.objection}-${index}`} className="rounded-2xl bg-white/[0.03] px-4 py-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-[12px] uppercase tracking-[0.14em] text-white/24">Objection</p>
                          <p className="mt-2 text-[13px] text-white/78">{item.objection || "Sans texte"}</p>
                          <p className="mt-3 text-[12px] uppercase tracking-[0.14em] text-white/24">Reponse</p>
                          <p className="mt-2 text-[13px] leading-6 text-white/52">{item.response || "Sans reponse"}</p>
                        </div>
                        <button
                          onClick={() =>
                            onChange({
                              ...salesConfig,
                              objections: salesConfig.objections.filter((_, itemIndex) => itemIndex !== index),
                            })
                          }
                          className="rounded-full border border-red-400/18 p-2 text-red-100"
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

          <div className="rounded-[26px] border border-white/[0.06] bg-white/[0.02] p-4">
            <h3 className="text-[16px] font-semibold text-white">CTA principal</h3>
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

          <div className="rounded-[26px] border border-white/[0.06] bg-white/[0.02] p-4">
            <h3 className="text-[16px] font-semibold text-white">Scoring leads</h3>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {HOT_LEAD_OPTIONS.map((option) => (
                <label key={option.value} className="flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.03] px-4 py-3">
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
                  <span className="text-[13px] text-white/78">{option.label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>
    </SectionCard>
  );
}
