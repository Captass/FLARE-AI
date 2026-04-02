"use client";

import { Loader2, Save } from "lucide-react";

import type { ChatbotPreferences, ChatbotPrimaryRole, ChatbotTone } from "@/lib/api";
import { KeywordInput, SectionCard, SelectField, TextareaField, InputField } from "@/components/chatbot/ChatbotUi";
import { LANGUAGE_OPTIONS, PRIMARY_ROLE_OPTIONS, TONE_OPTIONS } from "@/components/chatbot/chatbotWorkspaceUtils";

interface ChatbotIdentityTabProps {
  preferences: ChatbotPreferences;
  onChange: (next: ChatbotPreferences) => void;
  canEdit: boolean;
  saving: boolean;
  onSave: () => void;
}

const IDENTITY_PRESETS: Array<{
  id: string;
  label: string;
  description: string;
  values: Pick<ChatbotPreferences, "primary_role" | "tone" | "greeting_message" | "handoff_message" | "handoff_mode">;
}> = [
  {
    id: "sales",
    label: "Vendeur direct",
    description: "Orienter vite vers une offre ou un devis.",
    values: {
      primary_role: "vendeur",
      tone: "amical",
      greeting_message: "Bonjour ! Je suis ici pour vous orienter vers l'offre la plus adaptee. Que recherchez-vous aujourd'hui ?",
      handoff_message: "Je peux aussi transmettre votre demande a notre equipe pour un devis rapide.",
      handoff_mode: "auto",
    },
  },
  {
    id: "support",
    label: "Support rassurant",
    description: "Repondre clairement et escalader proprement.",
    values: {
      primary_role: "support_client",
      tone: "professionnel",
      greeting_message: "Bonjour, je suis la pour repondre a vos questions et vous guider pas a pas.",
      handoff_message: "Si votre demande demande un suivi humain, je la transmettrai tout de suite a notre equipe.",
      handoff_mode: "auto",
    },
  },
  {
    id: "mixed",
    label: "Accueil mixte",
    description: "Informer, qualifier puis orienter.",
    values: {
      primary_role: "mixte",
      tone: "professionnel",
      greeting_message: "Bonjour ! Je peux vous informer, qualifier votre besoin puis vous orienter vers la bonne solution.",
      handoff_message: "Si vous preferez, je peux aussi vous mettre en relation avec notre equipe.",
      handoff_mode: "auto",
    },
  },
];

export default function ChatbotIdentityTab({
  preferences,
  onChange,
  canEdit,
  saving,
  onSave,
}: ChatbotIdentityTabProps) {
  const roleLabel = PRIMARY_ROLE_OPTIONS.find((option) => option.value === preferences.primary_role)?.label || "Mixte";
  const toneLabel = TONE_OPTIONS.find((option) => option.value === preferences.tone)?.label || "Amical";
  const greetingPreview =
    preferences.greeting_message.trim() ||
    `Bonjour ! Je suis ${preferences.bot_name.trim() || "votre assistant"}, comment puis-je vous aider ?`;
  const handoffPreview =
    preferences.handoff_mode === "manual"
      ? "Je prends vos informations et je transmets ensuite a l'equipe humaine."
      : preferences.handoff_message.trim() || "Si besoin, je peux vous mettre en relation avec notre equipe.";

  return (
    <SectionCard
      title="Identite du bot"
      description="Definissez la personnalite du chatbot, sa langue et les conditions de passage vers un humain."
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
      {!canEdit ? (
        <div className="mb-5 rounded-[20px] border border-white/[0.08] bg-white/[0.025] px-4 py-4 text-[14px] leading-6 text-white/54">
          Cette configuration est reservee aux owners et admins de l&apos;organisation active.
        </div>
      ) : null}

      {canEdit ? (
        <div className="mb-5">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/38">Presets rapides</p>
          <div className="grid gap-3 md:grid-cols-3">
            {IDENTITY_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() =>
                  onChange({
                    ...preferences,
                    ...preset.values,
                  })
                }
                className="rounded-[22px] border border-white/[0.08] bg-white/[0.02] px-4 py-4 text-left transition-all hover:border-white/[0.16] hover:bg-white/[0.04]"
              >
                <p className="text-[13px] font-semibold text-white">{preset.label}</p>
                <p className="mt-2 text-[12px] leading-6 text-white/42">{preset.description}</p>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <InputField
          label="Nom du bot"
          value={preferences.bot_name}
          onChange={(bot_name) => onChange({ ...preferences, bot_name })}
          placeholder="Ex: Alex, Sofia"
          disabled={!canEdit}
        />
        <SelectField
          label="Role principal"
          value={preferences.primary_role}
          onChange={(primary_role) => onChange({ ...preferences, primary_role: primary_role as ChatbotPrimaryRole })}
          options={PRIMARY_ROLE_OPTIONS}
          disabled={!canEdit}
        />
        <SelectField
          label="Ton"
          value={preferences.tone}
          onChange={(tone) => onChange({ ...preferences, tone: tone as ChatbotTone })}
          options={TONE_OPTIONS}
          disabled={!canEdit}
        />
        <SelectField
          label="Langue principale"
          value={preferences.language}
          onChange={(language) => onChange({ ...preferences, language })}
          options={LANGUAGE_OPTIONS}
          disabled={!canEdit}
        />
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <TextareaField
          label="Message d'accueil"
          value={preferences.greeting_message}
          onChange={(greeting_message) => onChange({ ...preferences, greeting_message })}
          placeholder="Bonjour ! Je suis Alex, comment puis-je vous aider ?"
          rows={4}
          disabled={!canEdit}
        />
        <TextareaField
          label="Message hors horaires"
          value={preferences.off_hours_message}
          onChange={(off_hours_message) => onChange({ ...preferences, off_hours_message })}
          placeholder="Nous sommes fermes. On vous repond des demain a 8h."
          rows={4}
          disabled={!canEdit}
        />
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <TextareaField
          label="Message de transfert humain"
          value={preferences.handoff_message}
          onChange={(handoff_message) => onChange({ ...preferences, handoff_message })}
          placeholder="Je vous mets en contact avec notre equipe."
          rows={4}
          disabled={!canEdit}
        />
        <div className="space-y-4 rounded-[26px] border border-white/[0.06] bg-white/[0.02] p-4">
          <SelectField
            label="Quand passer en humain"
            value={preferences.handoff_mode}
            onChange={(handoff_mode) =>
              onChange({
                ...preferences,
                handoff_mode: handoff_mode === "manual" ? "manual" : "auto",
              })
            }
            options={[
              { value: "auto", label: "Automatique" },
              { value: "manual", label: "Manuel uniquement" },
            ]}
            disabled={!canEdit}
          />
          <KeywordInput
            label="Mots-cles declencheurs"
            values={preferences.handoff_keywords}
            onChange={(handoff_keywords) => onChange({ ...preferences, handoff_keywords })}
            placeholder="Ex: responsable, urgent, devis complexe"
            disabled={!canEdit}
          />
        </div>
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
        <div className="rounded-[26px] border border-white/[0.06] bg-white/[0.02] p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/38">Resume identite</p>
          <div className="mt-4 flex flex-wrap gap-2 text-[12px] text-white/72">
            <span className="rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1.5">{roleLabel}</span>
            <span className="rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1.5">{toneLabel}</span>
            <span className="rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1.5">
              {preferences.language === "fr" ? "Francais" : preferences.language === "mg" ? "Malagasy" : preferences.language === "en" ? "Anglais" : "Auto-detect"}
            </span>
          </div>
          <p className="mt-4 text-[13px] leading-6 text-white/42">
            Utilisez cet espace pour sentir si le bot sonne humain, rassurant et coherent avant les vrais messages entrants.
          </p>
        </div>

        <div className="rounded-[26px] border border-white/[0.06] bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/38">Apercu conversation</p>
          <div className="mt-4 space-y-3">
            <div className="ml-auto max-w-[24rem] rounded-[22px] border border-white/[0.08] bg-white/[0.05] px-4 py-3 text-[13px] leading-6 text-white/72">
              Bonjour, je veux en savoir plus sur vos services.
            </div>
            <div className="max-w-[28rem] rounded-[22px] border border-orange-400/18 bg-orange-500/[0.08] px-4 py-3 text-[13px] leading-6 text-white/84">
              {greetingPreview}
            </div>
            <div className="max-w-[28rem] rounded-[22px] border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-[13px] leading-6 text-white/58">
              {handoffPreview}
            </div>
          </div>
        </div>
      </div>
    </SectionCard>
  );
}
