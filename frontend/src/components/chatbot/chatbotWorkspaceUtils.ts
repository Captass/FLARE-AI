import type {
  CatalogueItem,
  CatalogueItemInput,
  ChatbotOverview,
  ChatbotPreferences,
  ChatbotPrimaryRole,
  ChatbotTone,
  PlanFeatures,
  PortfolioItemInput,
  SalesConfig,
} from "@/lib/api";

export type ChatbotWorkspaceTab = "status" | "identity" | "business" | "catalogue" | "portfolio" | "sales" | "content";
export type BusinessHoursKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
export type BusinessHoursDraft = Record<BusinessHoursKey, string>;
export type WorkspaceReadinessStep = {
  id: string;
  label: string;
  detail: string;
  done: boolean;
  tab: ChatbotWorkspaceTab;
};

export const TAB_DEFINITIONS: Array<{
  id: ChatbotWorkspaceTab;
  label: string;
  feature?: keyof PlanFeatures;
  badge?: string;
}> = [
  { id: "status", label: "Statut" },
  { id: "identity", label: "Identite" },
  { id: "business", label: "Mon entreprise" },
  { id: "catalogue", label: "Catalogue" },
  { id: "portfolio", label: "Portfolio", feature: "has_portfolio", badge: "Pro" },
  { id: "sales", label: "Script de vente", feature: "has_sales_script", badge: "Pro" },
  { id: "content", label: "Contenu IA", feature: "has_chatbot_content", badge: "Starter" },
];

export const PRIMARY_ROLE_OPTIONS: Array<{ value: ChatbotPrimaryRole; label: string }> = [
  { value: "vendeur", label: "Vendeur" },
  { value: "support_client", label: "Support client" },
  { value: "informateur", label: "Informateur" },
  { value: "mixte", label: "Mixte" },
];

export const TONE_OPTIONS: Array<{ value: ChatbotTone; label: string }> = [
  { value: "professionnel", label: "Professionnel" },
  { value: "amical", label: "Amical" },
  { value: "decontracte", label: "Decontracte" },
  { value: "formel", label: "Formel" },
];

export const LANGUAGE_OPTIONS = [
  { value: "fr", label: "Francais" },
  { value: "mg", label: "Malagasy" },
  { value: "en", label: "Anglais" },
  { value: "auto", label: "Auto-detect" },
];

export const BUSINESS_HOUR_ROWS: Array<{ key: BusinessHoursKey; label: string }> = [
  { key: "mon", label: "Lundi" },
  { key: "tue", label: "Mardi" },
  { key: "wed", label: "Mercredi" },
  { key: "thu", label: "Jeudi" },
  { key: "fri", label: "Vendredi" },
  { key: "sat", label: "Samedi" },
  { key: "sun", label: "Dimanche" },
];

export const CTA_OPTIONS = [
  { value: "call", label: "Appel telephonique" },
  { value: "quote", label: "Devis gratuit" },
  { value: "website", label: "Lien site web" },
  { value: "appointment", label: "RDV" },
  { value: "whatsapp", label: "WhatsApp" },
];

export const HOT_LEAD_OPTIONS = [
  { value: "asks_price", label: "Demande un prix" },
  { value: "specific_project", label: "Mentionne un projet precis" },
  { value: "asks_meeting", label: "Demande un rendez-vous" },
  { value: "specific_offer", label: "Pose des questions sur une offre specifique" },
];

export const EMPTY_CATALOGUE_INPUT: CatalogueItemInput = {
  name: "",
  description: "",
  price: "",
  category: "",
  image_url: "",
  product_images: [],
  sort_order: 0,
  is_active: true,
};

export const EMPTY_PORTFOLIO_INPUT: PortfolioItemInput = {
  title: "",
  description: "",
  video_url: "",
  external_url: "",
  client_name: "",
  auto_share: false,
  sort_order: 0,
};

export const EMPTY_SALES_CONFIG: SalesConfig = {
  organization_slug: "",
  qualification_steps: [],
  objections: [],
  cta_type: "quote",
  cta_text: "",
  cta_url: "",
  hot_lead_signals: [],
  handoff_mode: "auto",
  handoff_keywords: [],
  updated_at: null,
};

export const CATALOGUE_STARTER_TEMPLATES: CatalogueItemInput[] = [
  {
    name: "Offre phare",
    description: "Votre service principal, explique en une phrase simple que le bot peut reprendre sans hesiter.",
    price: "A partir de 120 000 Ar",
    category: "Essentiel",
    image_url: "",
    product_images: [],
    sort_order: 0,
    is_active: true,
  },
  {
    name: "Pack sur devis",
    description: "Une offre plus complete pour les demandes serieuses, avec qualification puis proposition adaptee.",
    price: "Sur devis",
    category: "Sur mesure",
    image_url: "",
    product_images: [],
    sort_order: 1,
    is_active: true,
  },
  {
    name: "Appel diagnostic",
    description: "Un premier echange court pour comprendre le besoin, cadrer le projet et orienter vers la bonne offre.",
    price: "Gratuit",
    category: "Qualification",
    image_url: "",
    product_images: [],
    sort_order: 2,
    is_active: true,
  },
];

export function createEmptyHours(): BusinessHoursDraft {
  return {
    mon: "",
    tue: "",
    wed: "",
    thu: "",
    fri: "",
    sat: "",
    sun: "",
  };
}

export function parseBusinessHours(rawValue: string): BusinessHoursDraft {
  const draft = createEmptyHours();
  const value = String(rawValue || "").trim();
  if (!value) return draft;

  for (const line of value.split(/\r?\n/)) {
    const [labelPart, ...rest] = line.split(":");
    const normalizedLabel = String(labelPart || "").trim().toLowerCase();
    const resolvedKey = BUSINESS_HOUR_ROWS.find((row) => row.label.toLowerCase() === normalizedLabel)?.key;
    if (!resolvedKey) continue;
    draft[resolvedKey] = rest.join(":").trim();
  }

  return draft;
}

export function serializeBusinessHours(draft: BusinessHoursDraft): string {
  return BUSINESS_HOUR_ROWS.map((row) => {
    const value = String(draft[row.key] || "").trim();
    return value ? `${row.label}: ${value}` : "";
  })
    .filter(Boolean)
    .join("\n");
}

export function formatRelativeTime(value?: string | null): string {
  if (!value) return "Jamais";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const deltaSeconds = Math.max(0, Math.round((Date.now() - date.getTime()) / 1000));
  if (deltaSeconds < 60) return "A l'instant";
  if (deltaSeconds < 3600) return `Il y a ${Math.round(deltaSeconds / 60)} min`;
  if (deltaSeconds < 86400) return `Il y a ${Math.round(deltaSeconds / 3600)} h`;
  return `Il y a ${Math.round(deltaSeconds / 86400)} j`;
}

function hasValue(value?: string | null): boolean {
  return Boolean(String(value || "").trim());
}

export function getWorkspaceReadiness({
  overview,
  preferences,
  catalogue,
}: {
  overview: ChatbotOverview | null;
  preferences: ChatbotPreferences;
  catalogue: CatalogueItem[];
}) {
  const activePage = overview?.active_page || null;
  const steps: WorkspaceReadinessStep[] = [
    {
      id: "page",
      label: "Page Facebook active",
      detail: activePage?.page_name || "Connectez puis activez une page",
      done: Boolean(activePage),
      tab: "status",
    },
    {
      id: "identity",
      label: "Identite du bot",
      detail: hasValue(preferences.bot_name) && hasValue(preferences.greeting_message)
        ? `${preferences.bot_name} est pret a accueillir les clients`
        : "Nom, role et message d'accueil a finaliser",
      done: hasValue(preferences.bot_name) && hasValue(preferences.greeting_message) && hasValue(preferences.primary_role) && hasValue(preferences.language),
      tab: "identity",
    },
    {
      id: "business",
      label: "Contexte entreprise",
      detail: hasValue(preferences.business_name) && hasValue(preferences.company_description)
        ? `${preferences.business_name || "Entreprise"} est decrite clairement`
        : "Expliquez ce que vous faites et pour qui",
      done: hasValue(preferences.business_name) && hasValue(preferences.company_description),
      tab: "business",
    },
    {
      id: "catalogue",
      label: "Offre concrete",
      detail: catalogue.length > 0
        ? `${catalogue.length} offre(s) disponible(s) pour le bot`
        : hasValue(preferences.products_summary)
          ? "Resume commercial ajoute pour guider les reponses"
          : "Ajoutez au moins une offre phare",
      done: catalogue.length > 0 || hasValue(preferences.products_summary),
      tab: catalogue.length > 0 ? "catalogue" : "business",
    },
  ];

  const completed = steps.filter((step) => step.done).length;
  const nextStep = steps.find((step) => !step.done) || null;

  return {
    steps,
    completed,
    total: steps.length,
    percent: Math.round((completed / steps.length) * 100),
    nextStep,
  };
}

export function buildBotPreview({
  preferences,
  catalogue,
  salesConfig,
}: {
  preferences: ChatbotPreferences;
  catalogue: CatalogueItem[];
  salesConfig: SalesConfig;
}) {
  const botName = String(preferences.bot_name || "").trim() || "votre assistant";
  const businessName = String(preferences.business_name || "").trim() || "notre equipe";
  const firstOffer = catalogue.find((item) => item.is_active) || catalogue[0] || null;
  const commercialSummary = String(preferences.products_summary || "").trim();
  const toneLabel =
    TONE_OPTIONS.find((option) => option.value === preferences.tone)?.label || "Amical";
  const languageLabel =
    LANGUAGE_OPTIONS.find((option) => option.value === preferences.language)?.label || "Francais";

  const intro =
    String(preferences.greeting_message || "").trim() ||
    `Bonjour, je suis ${botName}. Comment puis-je vous aider aujourd'hui ?`;

  const roleLine =
    preferences.primary_role === "vendeur"
      ? `Je peux vous guider vers l'offre la plus adaptee chez ${businessName}.`
      : preferences.primary_role === "support_client"
        ? `Je peux repondre a vos questions et vous orienter vers la bonne personne chez ${businessName}.`
        : preferences.primary_role === "informateur"
          ? `Je peux vous donner les informations utiles sur ${businessName} et ses services.`
          : `Je peux vous informer, vous qualifier et vous orienter rapidement chez ${businessName}.`;

  const offerLine = firstOffer
    ? `Nous proposons deja ${firstOffer.name}${firstOffer.price ? `, ${firstOffer.price}` : ""}.`
    : commercialSummary
      ? commercialSummary
      : "Nous pouvons commencer par cerner votre besoin avant de proposer la bonne offre.";

  const ctaLine = String(salesConfig.cta_text || "").trim()
    ? `${salesConfig.cta_text}.`
    : "Dites-moi votre besoin et je vous orienterai rapidement.";

  const customerPrompt = firstOffer
    ? `Bonjour, je voudrais comprendre votre offre ${firstOffer.name}.`
    : `Bonjour, pouvez-vous m'expliquer ce que propose ${businessName} ?`;
  const handoffLine = String(preferences.handoff_message || "").trim()
    ? preferences.handoff_message.trim()
    : "Si vous preferez, je peux aussi vous passer notre equipe pour finaliser plus vite.";

  return {
    message: [intro, roleLine, offerLine, ctaLine].join(" "),
    customerPrompt,
    handoffLine,
    note: firstOffer
      ? "Le prospect voit tout de suite le ton, l'offre et la prochaine action."
      : "Ajoutez une offre concrete pour que le bot parle de devis, de pack ou de prix de depart.",
    chips: [
      toneLabel,
      languageLabel,
      firstOffer ? firstOffer.name : commercialSummary ? "Resume commercial pret" : "Sans offre phare",
      preferences.handoff_mode === "manual" ? "Transfert manuel" : "Transfert auto",
    ],
  };
}
