"use client";

import { Loader2, Save } from "lucide-react";

import type { ChatbotPreferences } from "@/lib/api";
import { InputField, SectionCard, TextareaField } from "@/components/chatbot/ChatbotUi";

interface ChatbotBusinessTabProps {
  preferences: ChatbotPreferences;
  onChange: (next: ChatbotPreferences) => void;
  canEdit: boolean;
  saving: boolean;
  onSave: () => void;
}

export default function ChatbotBusinessTab({
  preferences,
  onChange,
  canEdit,
  saving,
  onSave,
}: ChatbotBusinessTabProps) {
  return (
    <SectionCard
      title="Entreprise et offres"
      description="Donnez au bot le contexte de votre entreprise et votre catalogue de produits / services."
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
      <div className="grid gap-4 lg:grid-cols-2">
        <InputField
          label="Nom de l'entreprise"
          value={preferences.business_name}
          onChange={(business_name) => onChange({ ...preferences, business_name })}
          placeholder="Ex: Mon entreprise"
          disabled={!canEdit}
        />
        <InputField
          label="Secteur d'activité"
          value={preferences.business_sector}
          onChange={(business_sector) => onChange({ ...preferences, business_sector })}
          placeholder="Ex: Production vidéo, restauration, e-commerce..."
          disabled={!canEdit}
        />
      </div>

      <div className="mt-5">
        <TextareaField
          label="Description de l'entreprise"
          value={preferences.company_description}
          onChange={(company_description) => onChange({ ...preferences, company_description })}
          placeholder="Expliquez en quelques lignes ce que vous faites, pour qui, et ce qui vous différencie."
          rows={5}
          disabled={!canEdit}
        />
      </div>

      <div className="mt-5">
        <TextareaField
          label="Produits, services et prix"
          value={preferences.products_summary}
          onChange={(products_summary) => onChange({ ...preferences, products_summary })}
          placeholder={"Ex:\n- Pack Essentiel : 500 €/mois — 3 posts/semaine, 1 réseau\n- Pack Pro : 1 200 €/mois — 5 posts, 2 réseaux, Meta Ads\n- Production Vidéo : à partir de 800 € — clip, spot, corporate\n\nIndiquez les noms, descriptions et prix de vos offres."}
          rows={10}
          disabled={!canEdit}
        />
        <p className="mt-2 text-[12px] leading-6 text-white/30">
          Le bot utilise ce bloc pour répondre aux questions sur vos offres, vos prix et vos services.
          Plus c&apos;est détaillé, plus les réponses seront précises.
        </p>
      </div>
    </SectionCard>
  );
}
