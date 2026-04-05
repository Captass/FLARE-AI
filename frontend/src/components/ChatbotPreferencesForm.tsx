"use client";

import { BriefcaseBusiness, HeartHandshake, MessageCircleHeart, ShieldCheck, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";

import type { ChatbotPreferences, ChatbotTone } from "@/lib/api";

interface ChatbotPreferencesFormProps {
  value: ChatbotPreferences;
  onChange: (next: ChatbotPreferences) => void;
  disabled?: boolean;
}

type ToneOption = {
  value: ChatbotTone;
  label: string;
  description: string;
  icon: typeof BriefcaseBusiness;
};

const TONE_OPTIONS: ToneOption[] = [
  {
    value: "professionnel",
    label: "Professionnel",
    description: "Clair, structure et rassurant.",
    icon: BriefcaseBusiness,
  },
  {
    value: "amical",
    label: "Amical",
    description: "Chaleureux, simple et accueillant.",
    icon: HeartHandshake,
  },
  {
    value: "decontracte",
    label: "Decontracte",
    description: "Plus spontanee, plus directe, plus cool.",
    icon: MessageCircleHeart,
  },
  {
    value: "formel",
    label: "Formel",
    description: "Tres poli, sobre et institutionnel.",
    icon: ShieldCheck,
  },
];

export default function ChatbotPreferencesForm({
  value,
  onChange,
  disabled = false,
}: ChatbotPreferencesFormProps) {
  const [showAdvanced, setShowAdvanced] = useState(Boolean(value.special_instructions));

  useEffect(() => {
    if (value.special_instructions) {
      setShowAdvanced(true);
    }
  }, [value.special_instructions]);

  const updateField = <K extends keyof ChatbotPreferences>(key: K, nextValue: ChatbotPreferences[K]) => {
    onChange({
      ...value,
      [key]: nextValue,
    });
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <label className="text-[12px] font-semibold uppercase tracking-[0.16em] text-white/45">
          Nom du chatbot
        </label>
        <input
          value={value.bot_name}
          onChange={(event) => updateField("bot_name", event.target.value)}
          placeholder="Ex: Maya, Alex, L'assistant..."
          disabled={disabled}
          className="w-full rounded-2xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-[14px] text-white outline-none transition-colors placeholder:text-white/22 focus:border-orange-500/50 disabled:cursor-not-allowed disabled:opacity-60"
        />
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles size={15} className="text-orange-400" />
          <label className="text-[12px] font-semibold uppercase tracking-[0.16em] text-white/45">
            Ton
          </label>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {TONE_OPTIONS.map((option) => {
            const Icon = option.icon;
            const active = value.tone === option.value;
            return (
              <button
                key={option.value}
                type="button"
                disabled={disabled}
                onClick={() => updateField("tone", option.value)}
                className={`rounded-[22px] border p-4 text-left transition-all ${
                  active
                    ? "border-orange-500/40 bg-orange-500/10 shadow-[0_0_0_1px_rgba(249,115,22,0.12)]"
                    : "border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12] hover:bg-white/[0.04]"
                } disabled:cursor-not-allowed disabled:opacity-60`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${
                      active ? "bg-orange-500/15 text-orange-300" : "bg-white/[0.05] text-white/45"
                    }`}
                  >
                    <Icon size={18} />
                  </div>
                  <div>
                    <p className="text-[15px] font-semibold text-white">{option.label}</p>
                    <p className="mt-1 text-[13px] leading-6 text-white/45">{option.description}</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-[12px] font-semibold uppercase tracking-[0.16em] text-white/45">
          A propos de votre entreprise
        </label>
        <textarea
          value={value.company_description}
          onChange={(event) => updateField("company_description", event.target.value)}
          placeholder="Ex: Salon de beaute a Tana, specialise en soins capillaires..."
          disabled={disabled}
          rows={3}
          className="w-full rounded-2xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-[14px] text-white outline-none transition-colors placeholder:text-white/22 focus:border-orange-500/50 disabled:cursor-not-allowed disabled:opacity-60"
        />
      </div>

      <div className="space-y-2">
        <label className="text-[12px] font-semibold uppercase tracking-[0.16em] text-white/45">
          Vos offres et services
        </label>
        <textarea
          value={value.products_summary}
          onChange={(event) => updateField("products_summary", event.target.value)}
          placeholder="Ex: Coupe femme 15 000 Ar, Lissage 80 000 Ar..."
          disabled={disabled}
          rows={4}
          className="w-full rounded-2xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-[14px] text-white outline-none transition-colors placeholder:text-white/22 focus:border-orange-500/50 disabled:cursor-not-allowed disabled:opacity-60"
        />
      </div>

      <div className="space-y-2">
        <label className="text-[12px] font-semibold uppercase tracking-[0.16em] text-white/45">
          Message d'accueil
        </label>
        <textarea
          value={value.greeting_message}
          onChange={(event) => updateField("greeting_message", event.target.value)}
          placeholder="Ex: Bonjour ! Bienvenue chez [nom]. Comment puis-je vous aider ?"
          disabled={disabled}
          rows={2}
          className="w-full rounded-2xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-[14px] text-white outline-none transition-colors placeholder:text-white/22 focus:border-orange-500/50 disabled:cursor-not-allowed disabled:opacity-60"
        />
      </div>

      <div className="rounded-[22px] border border-white/[0.06] bg-white/[0.02] p-4">
        <button
          type="button"
          disabled={disabled}
          onClick={() => setShowAdvanced((current) => !current)}
          className="flex w-full items-center justify-between text-left"
        >
          <span className="text-[12px] font-semibold uppercase tracking-[0.16em] text-white/45">
            Instructions speciales
          </span>
          <span className="text-[12px] text-white/35">{showAdvanced ? "Masquer" : "Optionnel"}</span>
        </button>

        {showAdvanced ? (
          <textarea
            value={value.special_instructions}
            onChange={(event) => updateField("special_instructions", event.target.value)}
            placeholder="Ex: Toujours proposer un rendez-vous sur WhatsApp apres une demande de devis."
            disabled={disabled}
            rows={3}
            className="mt-3 w-full rounded-2xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-[14px] text-white outline-none transition-colors placeholder:text-white/22 focus:border-orange-500/50 disabled:cursor-not-allowed disabled:opacity-60"
          />
        ) : null}
      </div>
    </div>
  );
}
