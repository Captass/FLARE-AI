"use client";

import { Loader2, Save } from "lucide-react";

import type { ChatbotPreferences } from "@/lib/api";
import { InputField, SectionCard, TextareaField } from "@/components/chatbot/ChatbotUi";
import type { BusinessHoursDraft } from "@/components/chatbot/chatbotWorkspaceUtils";
import { BUSINESS_HOUR_ROWS } from "@/components/chatbot/chatbotWorkspaceUtils";

interface ChatbotBusinessTabProps {
  preferences: ChatbotPreferences;
  businessHoursDraft: BusinessHoursDraft;
  onChange: (next: ChatbotPreferences) => void;
  onBusinessHoursChange: (next: BusinessHoursDraft) => void;
  canEdit: boolean;
  saving: boolean;
  onSave: () => void;
}

export default function ChatbotBusinessTab({
  preferences,
  businessHoursDraft,
  onChange,
  onBusinessHoursChange,
  canEdit,
  saving,
  onSave,
}: ChatbotBusinessTabProps) {
  return (
    <SectionCard
      title="Mon entreprise"
      description="Donnez au bot le contexte reel de l'entreprise, les horaires et les points qu'il ne doit jamais dire."
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
          placeholder="Ex: RAM'S FLARE"
          disabled={!canEdit}
        />
        <InputField
          label="Secteur d'activite"
          value={preferences.business_sector}
          onChange={(business_sector) => onChange({ ...preferences, business_sector })}
          placeholder="Ex: Production video"
          disabled={!canEdit}
        />
      </div>

      <div className="mt-5">
        <TextareaField
          label="Description"
          value={preferences.company_description}
          onChange={(company_description) => onChange({ ...preferences, company_description })}
          placeholder="Expliquez en quelques lignes ce que vous faites et pour qui."
          rows={5}
          disabled={!canEdit}
        />
      </div>

      <div className="mt-5">
        <TextareaField
          label="Ce que le bot doit mettre en avant"
          value={preferences.products_summary}
          onChange={(products_summary) => onChange({ ...preferences, products_summary })}
          placeholder="Ex: Nos offres phares, fourchettes de prix, delais, zones couvertes, differentiants, objections a lever..."
          rows={5}
          disabled={!canEdit}
        />
        <p className="mt-2 text-[12px] leading-6 text-white/30">
          Ce bloc rend les reponses du bot plus concretes. Ajoutez ici ce qui doit ressortir meme quand le prospect pose une question vague.
        </p>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <InputField
          label="Adresse / Localisation"
          value={preferences.business_address}
          onChange={(business_address) => onChange({ ...preferences, business_address })}
          placeholder="Ex: Antananarivo, Madagascar"
          disabled={!canEdit}
        />
        <InputField
          label="Telephone"
          value={preferences.phone}
          onChange={(phone) => onChange({ ...preferences, phone })}
          placeholder="Ex: +261 34 00 000 00"
          disabled={!canEdit}
        />
        <InputField
          label="Email de contact"
          value={preferences.contact_email}
          onChange={(contact_email) => onChange({ ...preferences, contact_email })}
          placeholder="contact@entreprise.com"
          type="email"
          disabled={!canEdit}
        />
        <InputField
          label="Site web"
          value={preferences.website_url}
          onChange={(website_url) => onChange({ ...preferences, website_url })}
          placeholder="https://..."
          type="url"
          disabled={!canEdit}
        />
      </div>

      <div className="mt-5 rounded-[26px] border border-white/[0.06] bg-white/[0.02] p-4">
        <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/40">Horaires d&apos;ouverture</p>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {BUSINESS_HOUR_ROWS.map((row) => (
            <InputField
              key={row.key}
              label={row.label}
              value={businessHoursDraft[row.key]}
              onChange={(value) =>
                onBusinessHoursChange({
                  ...businessHoursDraft,
                  [row.key]: value,
                })
              }
              placeholder="Ex: 8h00 - 17h30"
              disabled={!canEdit}
            />
          ))}
        </div>
      </div>

      <div className="mt-5">
        <TextareaField
          label="Ce que le bot ne doit jamais dire"
          value={preferences.forbidden_topics_or_claims}
          onChange={(forbidden_topics_or_claims) => onChange({ ...preferences, forbidden_topics_or_claims })}
          placeholder="Ex: Ne jamais mentionner les concurrents, ne pas donner de prix avant qualification..."
          rows={4}
          disabled={!canEdit}
        />
      </div>
    </SectionCard>
  );
}
