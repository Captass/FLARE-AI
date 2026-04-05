"use client";

import { Loader2, Save } from "lucide-react";

import type { ChatbotPreferences, ChatbotHandoffMode } from "@/lib/api";
import { KeywordInput, SectionCard, SelectField, TextareaField } from "@/components/chatbot/ChatbotUi";

const HANDOFF_MODE_OPTIONS: Array<{ value: ChatbotHandoffMode; label: string }> = [
  { value: "auto", label: "Auto — le bot detente les signaux et propose un humain" },
  { value: "manual", label: "Manuel — uniquement sur les mots-cles definis" },
];

interface ChatbotHandoffTabProps {
  preferences: ChatbotPreferences;
  onChange: (next: ChatbotPreferences) => void;
  canEdit: boolean;
  saving: boolean;
  onSave: () => void;
}

export default function ChatbotHandoffTab({
  preferences,
  onChange,
  canEdit,
  saving,
  onSave,
}: ChatbotHandoffTabProps) {
  return (
    <SectionCard
      title="Transfert et disponibilite"
      description="Definissez quand le bot passe la main a un humain et ce qu'il dit quand vous etes ferme."
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
      {/* Mode handoff */}
      <div className="max-w-lg">
        <SelectField
          label="Mode de transfert"
          value={preferences.handoff_mode}
          onChange={(v) => onChange({ ...preferences, handoff_mode: v as ChatbotHandoffMode })}
          options={HANDOFF_MODE_OPTIONS}
          disabled={!canEdit}
        />
        <p className="mt-2 text-[12px] leading-6 text-white/30">
          En mode &quot;Auto&quot;, le bot propose un transfert quand il detecte une situation complexe
          (reclamation, devis sur mesure, urgence). En mode &quot;Manuel&quot;, il ne transfere que si
          les mots-cles ci-dessous sont detectes.
        </p>
      </div>

      {/* Mots-cles de transfert */}
      <div className="mt-6">
        <KeywordInput
          label="Mots-cles de transfert (entrez et appuyez sur Entree)"
          values={preferences.handoff_keywords}
          onChange={(handoff_keywords) => onChange({ ...preferences, handoff_keywords })}
          placeholder="Ex: parler humain, agent, probleme, remboursement..."
          disabled={!canEdit}
        />
        <p className="mt-2 text-[12px] leading-6 text-white/30">
          Si un client utilise l&apos;un de ces mots ou expressions, le bot envoie immediatement le message
          de transfert ci-dessous et ne repond plus.
        </p>
      </div>

      {/* Message de transfert */}
      <div className="mt-6">
        <TextareaField
          label="Message de transfert vers un humain"
          value={preferences.handoff_message}
          onChange={(handoff_message) => onChange({ ...preferences, handoff_message })}
          placeholder="Je vous mets en contact avec un membre de notre equipe. Merci de patienter, nous revenons vers vous dans les plus brefs delais."
          rows={3}
          disabled={!canEdit}
        />
      </div>

      {/* Message hors horaires */}
      <div className="mt-6 border-t border-white/[0.04] pt-6">
        <TextareaField
          label="Message hors horaires"
          value={preferences.off_hours_message}
          onChange={(off_hours_message) => onChange({ ...preferences, off_hours_message })}
          placeholder="Nous sommes actuellement fermes. Nous reviendrons vers vous pendant nos horaires d'ouverture. Merci de votre patience !"
          rows={3}
          disabled={!canEdit}
        />
        <p className="mt-2 text-[12px] leading-6 text-white/30">
          Ce message est affiche en dehors de vos horaires d&apos;ouverture (si configures ci-dessus).
          Si laisse vide, le bot repond normalement 24h/24.
        </p>
      </div>
    </SectionCard>
  );
}
