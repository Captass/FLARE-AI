"use client";

import { Loader2, Save } from "lucide-react";

import type { ChatbotPreferences, ChatbotTone } from "@/lib/api";
import { SectionCard, SelectField, TextareaField, InputField } from "@/components/chatbot/ChatbotUi";
import { LANGUAGE_OPTIONS, TONE_OPTIONS } from "@/components/chatbot/chatbotWorkspaceUtils";

interface ChatbotIdentityTabProps {
  preferences: ChatbotPreferences;
  onChange: (next: ChatbotPreferences) => void;
  canEdit: boolean;
  saving: boolean;
  onSave: () => void;
}

export default function ChatbotIdentityTab({
  preferences,
  onChange,
  canEdit,
  saving,
  onSave,
}: ChatbotIdentityTabProps) {
  const isLocked = !canEdit || saving;

  return (
    <SectionCard
      title="Identite et comportement du bot"
      description="Nom, ton, langue et instructions systeme du chatbot Messenger."
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
      <div className="grid gap-4 lg:grid-cols-2">
        <InputField
          label="Nom du bot"
          value={preferences.bot_name}
          onChange={(bot_name) => onChange({ ...preferences, bot_name })}
          placeholder="Ex: Alex, Sofia, Aina"
          disabled={isLocked}
        />
        <SelectField
          label="Ton"
          value={preferences.tone}
          onChange={(tone) => onChange({ ...preferences, tone: tone as ChatbotTone })}
          options={TONE_OPTIONS}
          disabled={isLocked}
        />
        <SelectField
          label="Langue principale"
          value={preferences.language}
          onChange={(language) => onChange({ ...preferences, language })}
          options={LANGUAGE_OPTIONS}
          disabled={isLocked}
        />
      </div>

      <div className="mt-5">
        <TextareaField
          label="Message d'accueil"
          value={preferences.greeting_message}
          onChange={(greeting_message) => onChange({ ...preferences, greeting_message })}
          placeholder="Bonjour ! Je suis Alex, comment puis-je vous aider ?"
          rows={3}
          disabled={isLocked}
        />
      </div>

      <div className="mt-5">
        <TextareaField
          label="Instructions speciales (system prompt)"
          value={preferences.special_instructions}
          onChange={(special_instructions) => onChange({ ...preferences, special_instructions })}
          placeholder="Ex: Reponds toujours en 3 phrases max. Propose un devis apres 3 echanges. Ne donne jamais les prix exacts, redirige vers un appel."
          rows={6}
          disabled={isLocked}
        />
        <p className="mt-2 text-[12px] leading-6 text-[var(--text-secondary)]">
          Ces instructions modifient le comportement du bot. Soyez precis : ton, limites, redirections.
        </p>
      </div>
    </SectionCard>
  );
}
