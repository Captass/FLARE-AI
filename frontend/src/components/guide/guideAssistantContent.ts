"use client";

export type GuideAudience = "user" | "operator";

export type GuideViewKey =
  | "home"
  | "assistant"
  | "chatbot"
  | "chatbot-activation"
  | "chatbot-parametres"
  | "chatbot-personnalisation"
  | "chatbot-dashboard"
  | "chatbot-clients"
  | "chatbot-client-detail"
  | "chatbot-orders"
  | "billing"
  | "settings"
  | "admin"
  | "guide"
  | "contact"
  | "automations"
  | "automationHub"
  | "facebook"
  | "google"
  | "memory"
  | "dashboard"
  | "leads"
  | "conversations"
  | "expenses"
  | "chatbotFiles"
  | "prompts"
  | "knowledge"
  | "files"
  | "prospection"
  | "content"
  | "followup"
  | "agents";

export interface GuideAction {
  id: string;
  label: string;
  target: GuideViewKey;
  tone?: "primary" | "secondary";
}

export interface GuideStep {
  id: string;
  label: string;
  status?: "todo" | "done" | "blocked" | "next";
}

export interface GuideStageCard {
  title: string;
  nextAction: string;
  unlockCondition: string;
  tone: "info" | "warning" | "success";
}

export interface GuideContentEntry {
  audience: GuideAudience;
  title: string;
  summary: string;
  steps: GuideStep[];
  warnings: string[];
  ctas: GuideAction[];
}

export interface GuideContext {
  hasOrganizationScope: boolean;
  userRole: string | null;
  hasSelectedFacebookPage: boolean;
  hasConnectedFacebookPage: boolean;
  isBotActive: boolean;
  setupStep: string | null;
  activationStatus: string | null;
  paymentStatus: string | null;
  flarePageAdminConfirmed: boolean;
}

export interface ResolvedGuideContent extends GuideContentEntry {
  stageCard: GuideStageCard | null;
}

const GUIDE_CONTENT_BY_VIEW: Record<GuideViewKey, GuideContentEntry> = {
  home: {
    audience: "user",
    title: "Accueil",
    summary: "Ici tu vois ou aller ensuite pour avancer sans te perdre dans l'application.",
    steps: [
      { id: "scope", label: "Verifie ton espace actif", status: "next" },
      { id: "offer", label: "Choisis ou verifie ton offre", status: "todo" },
      { id: "chatbot", label: "Passe sur Chatbot Facebook pour continuer", status: "todo" },
    ],
    warnings: [],
    ctas: [
      { id: "to-chatbot", label: "Ouvrir Chatbot Facebook", target: "chatbot", tone: "primary" },
      { id: "to-billing", label: "Voir les offres", target: "billing" },
    ],
  },
  assistant: {
    audience: "user",
    title: "Assistant IA",
    summary: "Ici tu demandes a FLARE AI d'ecrire, analyser ou creer pour toi.",
    steps: [
      { id: "new-chat", label: "Demarre une nouvelle discussion", status: "next" },
      { id: "ask-task", label: "Donne un objectif concret", status: "todo" },
      { id: "apply", label: "Applique le resultat dans ton workflow", status: "todo" },
    ],
    warnings: [],
    ctas: [
      { id: "to-chatbot", label: "Aller au chatbot", target: "chatbot", tone: "primary" },
      { id: "to-guide", label: "Guide complet", target: "guide" },
    ],
  },
  chatbot: {
    audience: "user",
    title: "Chatbot Facebook",
    summary: "Ici tu relies ton chatbot a ta page Facebook et tu suis son activation.",
    steps: [
      { id: "page", label: "Selectionne une page Facebook", status: "next" },
      { id: "configure", label: "Complete personnalisation et reglages", status: "todo" },
      { id: "activate", label: "Passe a l'activation assistee", status: "todo" },
    ],
    warnings: [],
    ctas: [
      { id: "to-param", label: "Reglages Facebook", target: "chatbot-parametres", tone: "primary" },
      { id: "to-activation", label: "Activer le chatbot", target: "chatbot-activation" },
      { id: "to-persona", label: "Personnalisation", target: "chatbot-personnalisation" },
    ],
  },
  "chatbot-activation": {
    audience: "user",
    title: "Activation",
    summary: "Ici tu passes du paiement au chatbot actif sur ta page Facebook.",
    steps: [
      { id: "offer", label: "Choisir une offre", status: "next" },
      { id: "payment", label: "Payer et envoyer la preuve", status: "todo" },
      { id: "access", label: "Confirmer l'acces page pour FLARE", status: "todo" },
      { id: "wait", label: "Attendre activation et test Messenger", status: "todo" },
    ],
    warnings: [],
    ctas: [
      { id: "to-billing", label: "Voir les offres", target: "billing", tone: "primary" },
      { id: "to-param", label: "Confirmer l'acces page", target: "chatbot-parametres" },
      { id: "to-admin", label: "Aller a Administration", target: "admin" },
    ],
  },
  "chatbot-parametres": {
    audience: "user",
    title: "Parametres Facebook",
    summary: "Ici tu choisis la bonne page Facebook et tu verifies qu'elle est bien reliee au bot.",
    steps: [
      { id: "connect", label: "Connecter Meta", status: "next" },
      { id: "select", label: "Selectionner la page cible", status: "todo" },
      { id: "switch", label: "Verifier le statut ON/OFF", status: "todo" },
    ],
    warnings: [],
    ctas: [
      { id: "to-chatbot", label: "Retour Chatbot", target: "chatbot", tone: "primary" },
      { id: "to-activation", label: "Continuer l'activation", target: "chatbot-activation" },
    ],
  },
  "chatbot-personnalisation": {
    audience: "user",
    title: "Personnalisation",
    summary: "Ici tu apprends au bot qui tu es, ce que tu vends et comment il doit repondre.",
    steps: [
      { id: "identity", label: "Regler nom, ton et message d'accueil", status: "next" },
      { id: "catalog", label: "Ajouter tes produits et visuels", status: "todo" },
      { id: "save", label: "Enregistrer avant de quitter", status: "todo" },
    ],
    warnings: [],
    ctas: [
      { id: "to-dashboard", label: "Voir le dashboard chatbot", target: "chatbot-dashboard", tone: "primary" },
      { id: "to-chatbot", label: "Retour Chatbot", target: "chatbot" },
    ],
  },
  "chatbot-dashboard": {
    audience: "user",
    title: "Dashboard chatbot",
    summary: "Ici tu vois ce que le bot fait, ce qui marche et ce que tu dois reprendre a la main.",
    steps: [
      { id: "read", label: "Lire les KPI du jour", status: "next" },
      { id: "clients", label: "Ouvrir les clients a forte intention", status: "todo" },
      { id: "orders", label: "Verifier les commandes", status: "todo" },
    ],
    warnings: [],
    ctas: [
      { id: "to-clients", label: "Voir les clients", target: "chatbot-clients", tone: "primary" },
      { id: "to-orders", label: "Voir les commandes", target: "chatbot-orders" },
    ],
  },
  "chatbot-clients": {
    audience: "user",
    title: "Clients",
    summary: "Ici tu suis les prospects chauds et les conversations qui demandent ton aide.",
    steps: [
      { id: "sort", label: "Trier par priorite", status: "next" },
      { id: "open", label: "Ouvrir les fiches critiques", status: "todo" },
      { id: "handoff", label: "Passer en mode humain si necessaire", status: "todo" },
    ],
    warnings: [],
    ctas: [
      { id: "to-conversations", label: "Ouvrir conversations", target: "conversations", tone: "primary" },
      { id: "to-dashboard", label: "Retour dashboard", target: "chatbot-dashboard" },
    ],
  },
  "chatbot-client-detail": {
    audience: "user",
    title: "Fiche client",
    summary: "Ici tu regardes un client en detail pour savoir quoi faire ensuite.",
    steps: [
      { id: "timeline", label: "Verifier historique et intention", status: "next" },
      { id: "action", label: "Declencher la prochaine action", status: "todo" },
    ],
    warnings: [],
    ctas: [{ id: "to-clients", label: "Retour clients", target: "chatbot-clients", tone: "primary" }],
  },
  "chatbot-orders": {
    audience: "user",
    title: "Commandes",
    summary: "Ici tu vois les commandes detectees par le bot et leur avancement.",
    steps: [
      { id: "filter", label: "Filtrer les commandes a traiter", status: "next" },
      { id: "status", label: "Mettre a jour les statuts", status: "todo" },
    ],
    warnings: [],
    ctas: [
      { id: "to-dashboard", label: "Retour dashboard", target: "chatbot-dashboard", tone: "primary" },
      { id: "to-chatbot", label: "Retour chatbot", target: "chatbot" },
    ],
  },
  billing: {
    audience: "user",
    title: "Abonnements",
    summary: "Ici tu choisis l'offre qui te convient avant de payer et lancer l'activation.",
    steps: [
      { id: "select", label: "Selectionner l'offre adaptee", status: "next" },
      { id: "proof", label: "Envoyer la preuve de paiement", status: "todo" },
      { id: "follow", label: "Suivre la validation FLARE", status: "todo" },
    ],
    warnings: [],
    ctas: [
      { id: "to-activation", label: "Continuer activation", target: "chatbot-activation", tone: "primary" },
      { id: "to-settings", label: "Ouvrir les reglages", target: "settings" },
    ],
  },
  settings: {
    audience: "user",
    title: "Parametres",
    summary: "Ici tu regles ton profil, ton espace et les options generales de l'application.",
    steps: [
      { id: "profile", label: "Mettre a jour le profil", status: "next" },
      { id: "org", label: "Verifier l'identite de l'espace", status: "todo" },
      { id: "guide", label: "Activer ou couper le guide IA", status: "todo" },
    ],
    warnings: [],
    ctas: [{ id: "to-home", label: "Retour accueil", target: "home", tone: "primary" }],
  },
  admin: {
    audience: "operator",
    title: "Administration",
    summary: "Ici l'equipe FLARE traite les paiements, les activations et les dossiers bloques.",
    steps: [
      { id: "payment", label: "Verifier les paiements en attente", status: "next" },
      { id: "assign", label: "Assigner les activations", status: "todo" },
      { id: "test", label: "Passer testing puis active apres test", status: "todo" },
    ],
    warnings: [],
    ctas: [
      { id: "to-activation", label: "Voir activation", target: "chatbot-activation", tone: "primary" },
      { id: "to-chatbot", label: "Retour chatbot", target: "chatbot" },
    ],
  },
  guide: {
    audience: "user",
    title: "Guide",
    summary: "Ici tu trouves les grandes explications de l'application si tu veux une vue d'ensemble.",
    steps: [
      { id: "read", label: "Parcourir les sections utiles", status: "next" },
      { id: "apply", label: "Appliquer dans ton parcours reel", status: "todo" },
    ],
    warnings: [],
    ctas: [{ id: "to-home", label: "Retour accueil", target: "home", tone: "primary" }],
  },
  contact: {
    audience: "user",
    title: "Contact",
    summary: "Ici tu peux demander de l'aide a l'equipe FLARE.",
    steps: [{ id: "message", label: "Envoyer un message clair", status: "next" }],
    warnings: [],
    ctas: [{ id: "to-home", label: "Retour accueil", target: "home", tone: "primary" }],
  },
  automations: {
    audience: "user",
    title: "Automatisations",
    summary: "Ici tu vois les modules automatiques disponibles et ceux qui restent bloques.",
    steps: [{ id: "pick", label: "Choisir un module", status: "next" }],
    warnings: [],
    ctas: [{ id: "to-chatbot", label: "Ouvrir chatbot", target: "chatbot", tone: "primary" }],
  },
  automationHub: {
    audience: "user",
    title: "Automation Hub",
    summary: "Ici tu choisis le module automatique qui correspond a ton besoin.",
    steps: [{ id: "module", label: "Ouvrir un module", status: "next" }],
    warnings: [],
    ctas: [{ id: "to-automations", label: "Retour automations", target: "automations", tone: "primary" }],
  },
  facebook: {
    audience: "user",
    title: "Facebook",
    summary: "Ici tu verifies l'integration Facebook en dehors du tunnel principal du chatbot.",
    steps: [{ id: "check", label: "Verifier l'integration", status: "next" }],
    warnings: [],
    ctas: [{ id: "to-chatbot-param", label: "Ouvrir parametres Facebook", target: "chatbot-parametres", tone: "primary" }],
  },
  google: {
    audience: "user",
    title: "Google",
    summary: "Ici tu verifies l'integration Google.",
    steps: [{ id: "check", label: "Verifier l'integration", status: "next" }],
    warnings: [],
    ctas: [{ id: "to-home", label: "Retour accueil", target: "home", tone: "primary" }],
  },
  memory: {
    audience: "user",
    title: "Memoire",
    summary: "Ici tu vois ce que l'assistant garde en memoire pour mieux t'aider.",
    steps: [{ id: "review", label: "Relire les faits utiles", status: "next" }],
    warnings: [],
    ctas: [{ id: "to-assistant", label: "Retour assistant", target: "assistant", tone: "primary" }],
  },
  dashboard: {
    audience: "user",
    title: "Dashboard",
    summary: "Ici tu vois les indicateurs principaux de ton espace.",
    steps: [{ id: "kpi", label: "Lire les KPI", status: "next" }],
    warnings: [],
    ctas: [{ id: "to-chatbot-dashboard", label: "Dashboard chatbot", target: "chatbot-dashboard", tone: "primary" }],
  },
  leads: {
    audience: "user",
    title: "Leads",
    summary: "Ici tu vois les prospects les plus chauds detectes dans Messenger.",
    steps: [{ id: "prioritize", label: "Prioriser les leads chauds", status: "next" }],
    warnings: [],
    ctas: [{ id: "to-clients", label: "Voir clients", target: "chatbot-clients", tone: "primary" }],
  },
  conversations: {
    audience: "user",
    title: "Conversations",
    summary: "Ici tu reprends les conversations importantes quand le bot ne suffit plus.",
    steps: [{ id: "reply", label: "Repondre aux conversations critiques", status: "next" }],
    warnings: [],
    ctas: [{ id: "to-dashboard", label: "Retour dashboard chatbot", target: "chatbot-dashboard", tone: "primary" }],
  },
  expenses: {
    audience: "user",
    title: "Depenses",
    summary: "Ici tu surveilles les couts du bot et les depenses anormales.",
    steps: [{ id: "check", label: "Verifier les couts anormaux", status: "next" }],
    warnings: [],
    ctas: [{ id: "to-dashboard", label: "Retour dashboard chatbot", target: "chatbot-dashboard", tone: "primary" }],
  },
  chatbotFiles: {
    audience: "user",
    title: "Fichiers chatbot",
    summary: "Ici tu ranges les documents utiles au chatbot.",
    steps: [{ id: "upload", label: "Ajouter les documents utiles", status: "next" }],
    warnings: [],
    ctas: [{ id: "to-chatbot", label: "Retour chatbot", target: "chatbot", tone: "primary" }],
  },
  prompts: {
    audience: "user",
    title: "Prompts",
    summary: "Ici tu trouves des demandes pretes a l'emploi pour l'assistant.",
    steps: [{ id: "pick", label: "Choisir un prompt", status: "next" }],
    warnings: [],
    ctas: [{ id: "to-assistant", label: "Retour assistant", target: "assistant", tone: "primary" }],
  },
  knowledge: {
    audience: "user",
    title: "Knowledge",
    summary: "Ici tu geres les documents qui servent de base a l'assistant.",
    steps: [{ id: "verify", label: "Verifier les sources", status: "next" }],
    warnings: [],
    ctas: [{ id: "to-assistant", label: "Retour assistant", target: "assistant", tone: "primary" }],
  },
  files: {
    audience: "user",
    title: "Fichiers",
    summary: "Ici tu retrouves les fichiers deja envoyes a l'assistant.",
    steps: [{ id: "review", label: "Revoir les pieces jointes", status: "next" }],
    warnings: [],
    ctas: [{ id: "to-assistant", label: "Retour assistant", target: "assistant", tone: "primary" }],
  },
  prospection: {
    audience: "user",
    title: "Prospection",
    summary: "Ce module n'est pas encore ouvert.",
    steps: [{ id: "wait", label: "Suivre l'ouverture du module", status: "next" }],
    warnings: ["Ce module est encore verrouille."],
    ctas: [{ id: "to-automations", label: "Retour automations", target: "automations", tone: "primary" }],
  },
  content: {
    audience: "user",
    title: "Studio contenu",
    summary: "Ce module n'est pas encore ouvert.",
    steps: [{ id: "wait", label: "Suivre l'ouverture du module", status: "next" }],
    warnings: ["Ce module est encore verrouille."],
    ctas: [{ id: "to-automations", label: "Retour automations", target: "automations", tone: "primary" }],
  },
  followup: {
    audience: "user",
    title: "Suivi client",
    summary: "Ce module n'est pas encore ouvert.",
    steps: [{ id: "wait", label: "Suivre l'ouverture du module", status: "next" }],
    warnings: ["Ce module est encore verrouille."],
    ctas: [{ id: "to-automations", label: "Retour automations", target: "automations", tone: "primary" }],
  },
  agents: {
    audience: "user",
    title: "Agents",
    summary: "Ce module n'est pas encore ouvert.",
    steps: [{ id: "wait", label: "Suivre l'ouverture du module", status: "next" }],
    warnings: ["Ce module est encore verrouille."],
    ctas: [{ id: "to-automations", label: "Retour automations", target: "automations", tone: "primary" }],
  },
};

const ORG_REQUIRED_VIEWS = new Set<GuideViewKey>([
  "chatbot",
  "chatbot-activation",
  "chatbot-parametres",
  "chatbot-personnalisation",
  "chatbot-dashboard",
  "chatbot-clients",
  "chatbot-client-detail",
  "chatbot-orders",
  "leads",
  "conversations",
  "expenses",
  "chatbotFiles",
]);

export function resolveGuideViewKey(activeView: string): GuideViewKey {
  if (activeView === "chat") return "assistant";
  if ((activeView as GuideViewKey) in GUIDE_CONTENT_BY_VIEW) {
    return activeView as GuideViewKey;
  }
  return "home";
}

export function resolveGuideContent(view: GuideViewKey, context: GuideContext): ResolvedGuideContent {
  const base = GUIDE_CONTENT_BY_VIEW[view] ?? GUIDE_CONTENT_BY_VIEW.home;
  const steps = base.steps.map((step) => ({ ...step }));
  const warnings = [...base.warnings];
  let stageCard: GuideStageCard | null = null;

  if (ORG_REQUIRED_VIEWS.has(view) && !context.hasOrganizationScope) {
    warnings.unshift("Aucun espace organisation actif. Connecte un espace pour continuer ce module.");
  }

  if (!context.hasConnectedFacebookPage && (view === "chatbot" || view === "chatbot-parametres")) {
    warnings.unshift("Aucune page Facebook connectee. Connecte Meta puis importe une page.");
  }

  if (!context.hasSelectedFacebookPage && (view === "chatbot" || view === "chatbot-activation" || view === "chatbot-parametres")) {
    warnings.unshift("Aucune page selectionnee dans FLARE. Choisis la page cible avant de continuer.");
  }

  if (view === "chatbot-activation") {
    if (context.activationStatus === "active" || context.isBotActive) {
      stageCard = {
        title: "Activation complete",
        nextAction: "Passe en exploitation et suis les clients dans le dashboard.",
        unlockCondition: "Bot deja actif sur la page cible.",
        tone: "success",
      };
    } else if (context.paymentStatus !== "verified") {
      stageCard = {
        title: "Etape paiement",
        nextAction: "Envoie la preuve de paiement puis attends validation FLARE.",
        unlockCondition: "Le statut paiement doit passer a verified.",
        tone: "warning",
      };
      steps[1].status = "next";
      steps[2].status = "blocked";
      steps[3].status = "blocked";
    } else if (!context.flarePageAdminConfirmed) {
      stageCard = {
        title: "Etape acces page",
        nextAction: "Confirme l'acces admin FLARE sur la page Facebook cible.",
        unlockCondition: "Le champ flare_page_admin_confirmed doit etre true.",
        tone: "warning",
      };
      steps[0].status = "done";
      steps[1].status = "done";
      steps[2].status = "next";
      steps[3].status = "blocked";
    } else {
      stageCard = {
        title: "Activation en cours",
        nextAction: "Attends la verification operateur puis le test Messenger final.",
        unlockCondition: "Le statut activation doit passer a active.",
        tone: "info",
      };
      steps[0].status = "done";
      steps[1].status = "done";
      steps[2].status = "done";
      steps[3].status = "next";
    }
  }

  if (view === "chatbot-parametres") {
    stageCard = context.hasSelectedFacebookPage
      ? {
          title: "Page cible detectee",
          nextAction: "Verifie ON/OFF puis repasse sur Activation pour finaliser.",
          unlockCondition: "La bonne page doit rester selectionnee.",
          tone: "info",
        }
      : {
          title: "Selection de page requise",
          nextAction: "Choisis la page Facebook cible dans la liste.",
          unlockCondition: "selectedPageId non vide.",
          tone: "warning",
        };
  }

  if (view === "chatbot-personnalisation") {
    stageCard = {
      title: "Etape contenu",
      nextAction: "Complete identite + catalogue puis enregistre avant de quitter.",
      unlockCondition: "Les champs bot et business doivent etre remplis.",
      tone: "info",
    };
  }

  if (view === "chatbot") {
    stageCard = context.isBotActive
      ? {
          title: "Bot actif",
          nextAction: "Surveille clients et commandes depuis le dashboard.",
          unlockCondition: "Conserver la page active et la qualite des reponses.",
          tone: "success",
        }
      : {
          title: "Bot non actif",
          nextAction: "Passe sur Activation pour finaliser le tunnel.",
          unlockCondition: "Status activation = active.",
          tone: "warning",
        };
  }

  if (view === "admin") {
    const role = (context.userRole || "").toLowerCase();
    if (role && role !== "owner" && role !== "admin") {
      warnings.unshift("Ton role actuel limite certaines actions admin.");
    }
    stageCard = {
      title: "Mode operateur",
      nextAction: "Traite paiements puis activations avant de passer les dossiers en testing.",
      unlockCondition: "Chaque dossier doit avoir paiement verifie et page cible confirmee.",
      tone: "info",
    };
  }

  return {
    ...base,
    steps,
    warnings,
    ctas: base.ctas.slice(0, 3),
    stageCard,
  };
}
