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
      title="Informations entreprise"
      description="Donnez au bot le contexte de votre entreprise, vos coordonnees et vos limites."
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
      {/* Identite entreprise */}
      <div className="grid gap-4 lg:grid-cols-2">
        <InputField
          label="Nom de l'entreprise"
          value={preferences.business_name}
          onChange={(business_name) => onChange({ ...preferences, business_name })}
          placeholder="Ex: Mon Entreprise"
          disabled={!canEdit}
        />
        <InputField
          label="Secteur d'activite"
          value={preferences.business_sector}
          onChange={(business_sector) => onChange({ ...preferences, business_sector })}
          placeholder="Ex: Production video, restauration, e-commerce..."
          disabled={!canEdit}
        />
      </div>

      <div className="mt-4">
        <TextareaField
          label="Description de l'entreprise"
          value={preferences.company_description}
          onChange={(company_description) => onChange({ ...preferences, company_description })}
          placeholder="Expliquez en quelques lignes ce que vous faites, pour qui, et ce qui vous differencie."
          rows={4}
          disabled={!canEdit}
        />
      </div>

      {/* Coordonnees */}
      <div className="mt-6 border-t border-white/[0.04] pt-6">
        <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/30">Coordonnees</p>
        <div className="grid gap-4 lg:grid-cols-2">
          <InputField
            label="Telephone"
            value={preferences.phone}
            onChange={(phone) => onChange({ ...preferences, phone })}
            placeholder="Ex: +261 34 00 000 00"
            type="tel"
            disabled={!canEdit}
          />
          <InputField
            label="Email de contact"
            value={preferences.contact_email}
            onChange={(contact_email) => onChange({ ...preferences, contact_email })}
            placeholder="Ex: contact@monentreprise.com"
            type="email"
            disabled={!canEdit}
          />
          <InputField
            label="Site web"
            value={preferences.website_url}
            onChange={(website_url) => onChange({ ...preferences, website_url })}
            placeholder="Ex: https://monentreprise.com"
            type="url"
            disabled={!canEdit}
          />
          <InputField
            label="Adresse"
            value={preferences.business_address}
            onChange={(business_address) => onChange({ ...preferences, business_address })}
            placeholder="Ex: 12 Rue du Commerce, Antananarivo"
            disabled={!canEdit}
          />
        </div>
      </div>

      {/* Horaires */}
      <div className="mt-6 border-t border-white/[0.04] pt-6">
        <TextareaField
          label="Horaires d'ouverture"
          value={preferences.business_hours}
          onChange={(business_hours) => onChange({ ...preferences, business_hours })}
          placeholder={"Ex:\nLundi - Vendredi : 8h00 - 17h00\nSamedi : 9h00 - 12h00\nDimanche : Ferme"}
          rows={4}
          disabled={!canEdit}
        />
        <p className="mt-2 text-[12px] leading-6 text-white/30">
          Le bot communiquera ces horaires quand un client demande si vous etes ouverts.
        </p>
      </div>

      {/* Sujets interdits */}
      <div className="mt-6 border-t border-white/[0.04] pt-6">
        <TextareaField
          label="Sujets a eviter / mentions interdites"
          value={preferences.forbidden_topics_or_claims}
          onChange={(forbidden_topics_or_claims) => onChange({ ...preferences, forbidden_topics_or_claims })}
          placeholder={"Ex:\n- Ne pas mentionner les concurrents\n- Ne pas promettre de delais de livraison\n- Ne pas donner le prix des prestations sur mesure\n- Ne pas discuter de politique"}
          rows={4}
          disabled={!canEdit}
        />
        <p className="mt-2 text-[12px] leading-6 text-white/30">
          Le bot evitera strictement ces sujets et redirections.
        </p>
      </div>

      {/* Produits / services texte libre */}
      <div className="mt-6 border-t border-white/[0.04] pt-6">
        <TextareaField
          label="Produits, services et prix (texte libre)"
          value={preferences.products_summary}
          onChange={(products_summary) => onChange({ ...preferences, products_summary })}
          placeholder={"Ex:\n- Pack Essentiel : 30 000 Ar/mois — 3 posts/semaine\n- Pack Pro : 60 000 Ar/mois — 5 posts, 2 reseaux\n- Production Video : a partir de 80 000 Ar\n\nCe bloc complete le catalogue structure ci-dessous."}
          rows={6}
          disabled={!canEdit}
        />
        <p className="mt-2 text-[12px] leading-6 text-white/30">
          Complement textuel au catalogue. Utilisez ce champ pour des offres complexes ou des notes contextuelles.
        </p>
      </div>
    </SectionCard>
  );
}
