export type ChatbotLibraryCategory = "catalogue" | "portfolio" | "enterprise";

export interface ChatbotLibraryItem {
  id: string;
  category: ChatbotLibraryCategory;
  title: string;
  documentTitle: string;
  description: string;
  sourceLabel: string;
  keywords: string[];
  importMode: "upload" | "text";
  previewUrl?: string;
  externalUrl?: string;
  content?: string;
}

export const STARTER_CHATBOT_LIBRARY: ChatbotLibraryItem[] = [
  {
    id: "offer-1-flash-video-express",
    category: "catalogue",
    title: "Offre 1 - Flash Video Express",
    documentTitle: "Offre 1 - Flash Video Express.jpg",
    description:
      "Offre de publicite video rapide en 24h avec tournage court, montage dynamique et format Facebook ou WhatsApp. Point d'entree a 200 000 Ar.",
    sourceLabel: "Galerie d'offres deja utilisee par Messenger",
    keywords: ["offre 1", "flash video express", "video express", "offre flash"],
    importMode: "upload",
    previewUrl: "/chatbot-library/service_choice/catalog_images/offer-1-flash-video-express.jpg",
  },
  {
    id: "offer-2-pack-boost-business",
    category: "catalogue",
    title: "Offre 2 - Pack Boost Business",
    documentTitle: "Offre 2 - Pack Boost Business.jpg",
    description:
      "Pack de 3 publicites video avec presentation, produit ou service, temoignage client et conseils de diffusion. Offre pack a 800 000 Ar.",
    sourceLabel: "Galerie d'offres deja utilisee par Messenger",
    keywords: ["offre 2", "pack boost business", "boost business", "pack boost"],
    importMode: "upload",
    previewUrl: "/chatbot-library/service_choice/catalog_images/offer-2-pack-boost-business.jpg",
  },
  {
    id: "offer-3-story-pro-impact",
    category: "catalogue",
    title: "Offre 3 - Story Pro Impact",
    documentTitle: "Offre 3 - Story Pro Impact.jpg",
    description:
      "Offre publicitaire premium avec storytelling, interview, images travaillees et montage pro. Base a partir de 1 500 000 Ar.",
    sourceLabel: "Galerie d'offres deja utilisee par Messenger",
    keywords: ["offre 3", "story pro impact", "story", "story pro"],
    importMode: "upload",
    previewUrl: "/chatbot-library/service_choice/catalog_images/offer-3-story-pro-impact.jpg",
  },
  {
    id: "offer-4-sur-mesure-pro",
    category: "catalogue",
    title: "Offre 4 - Sur Mesure Pro",
    documentTitle: "Offre 4 - Sur Mesure Pro.jpg",
    description:
      "Offre publicitaire sur mesure avec concept, ecriture de scenario et strategie de communication. Tarif sur devis.",
    sourceLabel: "Galerie d'offres deja utilisee par Messenger",
    keywords: ["offre 4", "sur mesure pro", "ultra premium"],
    importMode: "upload",
    previewUrl: "/chatbot-library/service_choice/catalog_images/offer-4-sur-mesure-pro.jpg",
  },
  {
    id: "offer-5-gold-sur-mesure-pro",
    category: "catalogue",
    title: "Offre 5 - Gold Sur Mesure Pro",
    documentTitle: "Offre 5 - Gold Sur Mesure Pro.jpg",
    description:
      "Offre premium sur mesure pour campagne video publicitaire avec concept strategique, scenario adapte et diffusion integree. Tarif sur devis.",
    sourceLabel: "Galerie d'offres deja utilisee par Messenger",
    keywords: ["offre 5", "gold sur mesure pro", "gold", "gold premium"],
    importMode: "upload",
    previewUrl: "/chatbot-library/service_choice/catalog_images/offer-5-gold-sur-mesure-pro.jpg",
  },
  {
    id: "proof-spot-publicitaire",
    category: "portfolio",
    title: "Preuve video - Spot publicitaire",
    documentTitle: "Preuve video - Spot publicitaire",
    description:
      "Reference Drive deja branchee dans le chatbot pour montrer une realisation de spot publicitaire quand un prospect demande des exemples.",
    sourceLabel: "Portfolio direct service",
    keywords: ["portfolio", "spot publicitaire", "realisations", "exemple"],
    importMode: "text",
    externalUrl: "https://drive.google.com/file/d/1RqEGvEk_jd78JPwDwNJ9s_7wFVHqyzFv/view?usp=sharing",
    content: [
      "Service: Spot publicitaire",
      "Type: preuve video",
      "Description: Video exemple a envoyer quand le prospect veut voir une realisation de spot publicitaire.",
      "Usage: a mobiliser quand le client demande des realisations, exemples ou preuves concretes.",
      "Lien de reference: https://drive.google.com/file/d/1RqEGvEk_jd78JPwDwNJ9s_7wFVHqyzFv/view?usp=sharing",
    ].join("\n\n"),
  },
  {
    id: "proof-film-documentaire",
    category: "portfolio",
    title: "Preuve video - Film documentaire",
    documentTitle: "Preuve video - Film documentaire",
    description:
      "Reference Drive deja branchee dans le chatbot pour montrer une realisation documentaire quand le prospect veut voir le niveau de production.",
    sourceLabel: "Portfolio direct service",
    keywords: ["portfolio", "documentaire", "film institutionnel", "realisations"],
    importMode: "text",
    externalUrl: "https://drive.google.com/file/d/1p-gvQgj21BHVcxihL1p9FTOf8nLxOpEi/view?usp=sharing",
    content: [
      "Service: Film documentaire",
      "Type: preuve video",
      "Description: Video exemple a envoyer quand le prospect veut voir une realisation documentaire ou institutionnelle.",
      "Usage: a mobiliser quand le client demande des exemples, des references ou des preuves de qualite.",
      "Lien de reference: https://drive.google.com/file/d/1p-gvQgj21BHVcxihL1p9FTOf8nLxOpEi/view?usp=sharing",
    ].join("\n\n"),
  },
  {
    id: "proof-livestream-note",
    category: "portfolio",
    title: "Note preuve - Livestream multicamera",
    documentTitle: "Note preuve - Livestream multicamera",
    description:
      "Note de cadrage deja appliquee par le chatbot: RAM'S FLARE a de l'experience sur le livestream multicamera, mais aucune preuve video n'est encore prete ici.",
    sourceLabel: "Regle commerciale du direct service",
    keywords: ["livestream", "multicamera", "preuve", "portfolio", "direct"],
    importMode: "text",
    content: [
      "Service: Livestream multicamera",
      "Etat des preuves: aucune video de preuve prete a envoyer ici pour le moment.",
      "Consigne commerciale: ne jamais inventer de preuve video pour ce service.",
      "Message autorise: RAM'S FLARE en a deja realise plusieurs parmi plus de 300 projets et peut orienter vers un devis rapide.",
    ].join("\n\n"),
  },
  {
    id: "enterprise-company-profile",
    category: "enterprise",
    title: "RAM'S FLARE - Presentation entreprise",
    documentTitle: "RAM'S FLARE - Presentation entreprise",
    description:
      "Base courte sur l'activite, les services principaux et le positionnement commercial de RAM'S FLARE.",
    sourceLabel: "Synthese depuis le direct service",
    keywords: ["entreprise", "presentation", "a propos", "services", "mission"],
    importMode: "text",
    content: [
      "RAM'S FLARE est un studio de production et d'automatisation commerciale.",
      "Services actuellement mis en avant dans le chatbot: spot publicitaire, film documentaire, livestream multicamera, captation evenementielle, regie multicamera, shooting photo et location studio.",
      "RAM'S FLARE a deja realise plus de 300 projets selon le cadrage commercial du chatbot.",
      "Le role du chatbot est de guider, rassurer, qualifier et faire avancer la vente de maniere concrete.",
    ].join("\n\n"),
  },
  {
    id: "enterprise-sales-flow",
    category: "enterprise",
    title: "RAM'S FLARE - Flow commercial Messenger",
    documentTitle: "RAM'S FLARE - Flow commercial Messenger",
    description:
      "Cadre de reponse commercial deja utilise par le chatbot Messenger pour guider la vente avec des messages courts et actionnables.",
    sourceLabel: "Regles internes Messenger",
    keywords: ["process", "commercial", "messenger", "qualification", "vente"],
    importMode: "text",
    content: [
      "Flow commercial a suivre: 1. Accueillir 2. Comprendre 3. Montrer 4. Proposer 5. Pousser 6. Capturer 7. Confirmer.",
      "Regle d'or: chaque message doit rester court, clair et oriente action.",
      "Quand le prospect demande un prix: demander une seule variable de cadrage puis pousser vers un devis rapide.",
      "Quand le prospect demande des realisations: montrer 1 ou 2 preuves pertinentes maximum, jamais plus.",
      "Quand le cas est urgent, complexe, sensible ou litigieux: basculer vers une reprise humaine RAM'S FLARE.",
    ].join("\n\n"),
  },
];
