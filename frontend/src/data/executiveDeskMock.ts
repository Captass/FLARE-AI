"use client";

export type ExecutiveMailCategory = "Pro" | "Famille" | "Personnel" | "Finance" | "Client" | "Partenaire";
export type ExecutivePriority = "Haute" | "Normale" | "Basse";
export type ExecutiveMailStatus = "À lire" | "Réponse proposée" | "Traité";
export type ExecutiveTaskCategory = "Pro" | "Personnel" | "Finance" | "Famille";
export type ExecutiveTaskStatus = "À faire" | "En cours" | "Terminé";
export type ExecutiveContactCategory =
  | "Famille"
  | "Professionnel"
  | "Équipe"
  | "Client"
  | "Partenaire"
  | "Personnel";

export interface ExecutiveMail {
  id: string;
  sender: string;
  email: string;
  subject: string;
  category: ExecutiveMailCategory;
  priority: ExecutivePriority;
  status: ExecutiveMailStatus;
  aiSummary: string;
  suggestedReply: string;
  date: string;
  recommendedAction: string;
}

export interface ExecutiveTask {
  id: string;
  title: string;
  category: ExecutiveTaskCategory;
  level: ExecutivePriority;
  status: ExecutiveTaskStatus;
}

export interface ExecutiveEvent {
  id: string;
  time: string;
  title: string;
  type: "Pro" | "Personnel" | "Finance";
}

export interface ExecutiveContact {
  id: string;
  name: string;
  category: ExecutiveContactCategory;
  importance: ExecutivePriority;
  lastInteraction: string;
  nextAction: string;
  notes: string;
}

export interface ExecutiveFile {
  id: string;
  currentName: string;
  recommendedCategory: string;
  recommendedFolder: string;
  suggestedName: string;
  status: "À trier" | "Tri proposé" | "Tri appliqué";
}

export const executiveMails: ExecutiveMail[] = [
  {
    id: "mail-1",
    sender: "Direction Mazava",
    email: "direction@mazava.mg",
    subject: "Demande de présentation automatisation",
    category: "Partenaire",
    priority: "Haute",
    status: "Réponse proposée",
    aiSummary:
      "Une entreprise souhaite recevoir une présentation claire sur vos solutions d’automatisation et vos capacités.",
    suggestedReply:
      "Bonjour, merci pour votre message. Nous pouvons vous transmettre une présentation synthétique de nos solutions d’automatisation, incluant les cas d’usage, les bénéfices et une proposition de première rencontre. Je reste disponible pour convenir d’un créneau.",
    date: "2026-04-27",
    recommendedAction: "Préparer document de présentation",
  },
  {
    id: "mail-2",
    sender: "Fournisseur Internet",
    email: "facturation@internet.mg",
    subject: "Facture internet avril",
    category: "Finance",
    priority: "Haute",
    status: "À lire",
    aiSummary: "Facture à vérifier et payer avant échéance.",
    suggestedReply:
      "Bonjour, merci pour l’envoi de la facture. Nous allons procéder à la vérification et au paiement dans les délais.",
    date: "2026-04-27",
    recommendedAction: "Ajouter dans charges à payer",
  },
  {
    id: "mail-3",
    sender: "Client audiovisuel",
    email: "production@client.mg",
    subject: "Confirmation planning tournage",
    category: "Client",
    priority: "Haute",
    status: "Réponse proposée",
    aiSummary: "Le client demande une confirmation du planning de tournage.",
    suggestedReply:
      "Bonjour, nous vous confirmons que nous sommes en train de finaliser le planning de tournage. Nous vous transmettrons la version confirmée dès validation interne.",
    date: "2026-04-27",
    recommendedAction: "Créer tâche planning tournage",
  },
  {
    id: "mail-4",
    sender: "Famille",
    email: "famille@example.com",
    subject: "Organisation familiale week-end",
    category: "Famille",
    priority: "Normale",
    status: "À lire",
    aiSummary: "Message lié à l’organisation personnelle et familiale du week-end.",
    suggestedReply: "Merci, je regarde mon planning et je vous confirme l’organisation.",
    date: "2026-04-26",
    recommendedAction: "Ajouter au planning personnel",
  },
  {
    id: "mail-5",
    sender: "Newsletter Business",
    email: "news@business.example",
    subject: "Nouveautés marketing digital",
    category: "Personnel",
    priority: "Basse",
    status: "À lire",
    aiSummary: "Newsletter informative sans action urgente.",
    suggestedReply: "Aucune réponse nécessaire.",
    date: "2026-04-26",
    recommendedAction: "Lire plus tard",
  },
  {
    id: "mail-6",
    sender: "Équipe Production",
    email: "production@ramsflare.com",
    subject: "Matériel à préparer",
    category: "Pro",
    priority: "Haute",
    status: "Réponse proposée",
    aiSummary: "L’équipe demande une validation de la liste matériel avant une production.",
    suggestedReply:
      "Merci pour la liste. Je vais vérifier les éléments et vous confirmer les ajustements nécessaires.",
    date: "2026-04-27",
    recommendedAction: "Créer checklist matériel",
  },
];

export const executiveTasks: ExecutiveTask[] = [
  { id: "task-1", title: "Répondre au mail de partenariat", category: "Pro", level: "Haute", status: "À faire" },
  { id: "task-2", title: "Préparer le planning tournage", category: "Pro", level: "Haute", status: "En cours" },
  { id: "task-3", title: "Vérifier les charges à payer", category: "Finance", level: "Haute", status: "À faire" },
  {
    id: "task-4",
    title: "Confirmer le rendez-vous professionnel",
    category: "Pro",
    level: "Normale",
    status: "À faire",
  },
  { id: "task-5", title: "Appel famille", category: "Famille", level: "Normale", status: "À faire" },
  { id: "task-6", title: "Courses rapides", category: "Personnel", level: "Basse", status: "À faire" },
  { id: "task-7", title: "Vérifier documents maison", category: "Personnel", level: "Basse", status: "Terminé" },
];

export const executiveEvents: ExecutiveEvent[] = [
  { id: "event-1", time: "09h00", title: "Appel équipe", type: "Pro" },
  { id: "event-2", time: "11h00", title: "Préparation devis", type: "Pro" },
  { id: "event-3", time: "14h30", title: "Rendez-vous partenaire", type: "Pro" },
  { id: "event-4", time: "17h00", title: "Suivi production", type: "Pro" },
];

export const professionalTasks = [
  "Préparer planning tournage",
  "Répondre au partenaire",
  "Vérifier devis en attente",
  "Valider liste matériel",
];

export const personalTasks = ["Appel famille", "Courses rapides", "Vérifier documents maison"];

export const obligationTasks = ["Facture internet", "Paiement fournisseur", "Abonnement logiciel"];

export const executiveContacts: ExecutiveContact[] = [
  {
    id: "contact-1",
    name: "Rija",
    category: "Professionnel",
    importance: "Haute",
    lastInteraction: "2026-04-26",
    nextAction: "Faire le point sur l’automatisation",
    notes: "Famille / Professionnel",
  },
  {
    id: "contact-2",
    name: "Responsable Mazava",
    category: "Partenaire",
    importance: "Haute",
    lastInteraction: "2026-04-27",
    nextAction: "Envoyer document de présentation",
    notes: "Demande prioritaire sur l’automatisation",
  },
  {
    id: "contact-3",
    name: "Client audiovisuel",
    category: "Client",
    importance: "Haute",
    lastInteraction: "2026-04-27",
    nextAction: "Confirmer planning",
    notes: "Planning tournage à finaliser",
  },
  {
    id: "contact-4",
    name: "Équipe production",
    category: "Équipe",
    importance: "Normale",
    lastInteraction: "2026-04-27",
    nextAction: "Valider matériel",
    notes: "Checklist à confirmer",
  },
  {
    id: "contact-5",
    name: "Fournisseur internet",
    category: "Professionnel",
    importance: "Normale",
    lastInteraction: "2026-04-26",
    nextAction: "Vérifier facture",
    notes: "Charge mensuelle",
  },
  {
    id: "contact-6",
    name: "Contact personnel",
    category: "Personnel",
    importance: "Basse",
    lastInteraction: "2026-04-25",
    nextAction: "Répondre plus tard",
    notes: "Pas d’urgence",
  },
];

export const executiveFiles: ExecutiveFile[] = [
  {
    id: "file-1",
    currentName: "devis_client_final.pdf",
    recommendedCategory: "Business",
    recommendedFolder: "Clients / Devis",
    suggestedName: "2026-04_Devis_Client_Final.pdf",
    status: "Tri proposé",
  },
  {
    id: "file-2",
    currentName: "facture_internet_avril.pdf",
    recommendedCategory: "Finance",
    recommendedFolder: "Charges / Internet",
    suggestedName: "2026-04_Facture_Internet.pdf",
    status: "Tri proposé",
  },
  {
    id: "file-3",
    currentName: "photo_tournage_001.jpg",
    recommendedCategory: "Production",
    recommendedFolder: "RAMS_FLARE / Tournages / Photos",
    suggestedName: "2026-04_Photo_Tournage_001.jpg",
    status: "Tri proposé",
  },
  {
    id: "file-4",
    currentName: "contrat_partenaire.docx",
    recommendedCategory: "Partenariat",
    recommendedFolder: "Partenaires / Contrats",
    suggestedName: "2026-04_Contrat_Partenaire.docx",
    status: "Tri proposé",
  },
  {
    id: "file-5",
    currentName: "planning_famille.xlsx",
    recommendedCategory: "Personnel",
    recommendedFolder: "Personnel / Famille / Planning",
    suggestedName: "2026-04_Planning_Famille.xlsx",
    status: "Tri proposé",
  },
];
