# FLARE AI — Refonte Frontend
**Date** : 2026-03-31
**Statut** : Approuvé
**Cible utilisateur** : Propriétaires de TPE/PME à Madagascar, peu disponibles, RH réduites

---

## 1. Contexte & Objectif

L'application FLARE AI automatise les tâches marketing et commerciales pour les PME malgaches.
Le redesign vise une interface **minimaliste, hiérarchique et jamais surchargée** : l'utilisateur ne doit jamais être perdu, chaque page a un seul objectif.

**Principe directeur** : drill-down progressif via des grilles de glass cards. Chaque niveau présente 2 à 6 cartes maximum. On entre dans une carte, on peut toujours revenir avec le breadcrumb.

---

## 2. Architecture de navigation

### Pattern : pile de navigation (NavStack)

L'état `ActiveView` actuel devient une **pile** :

```ts
type NavLevel =
  | 'home'
  | 'automations'
  | 'facebook'
  | 'google'
  | 'chatbot'
  | 'chatbot-personnalisation'
  | 'chatbot-parametres'
  | 'chatbot-dashboard'
  | 'chatbot-clients'
  | 'chatbot-client-detail'
  | 'assistant'
  | 'guide'
  | 'billing'
  | 'contact'
  | 'settings';

// État global
const [navStack, setNavStack] = useState<NavLevel[]>(['home']);

// Navigation
const push = (level: NavLevel) => setNavStack(prev => [...prev, level]);
const pop = () => setNavStack(prev => prev.slice(0, -1));
const current = navStack[navStack.length - 1];
```

### Breadcrumb

Affiché en haut de la zone principale, calculé depuis `navStack`. Labels lisibles en français.
Exemple : `Accueil > Automatisations > Facebook > Chatbot IA > Clients & Conversations`

Bouton `←` retour visible à gauche du breadcrumb dès que `navStack.length > 1`.

---

## 3. Layout global

```
┌──────────────────────────────────────────────────────┐
│  SIDEBAR (240px, collapsible sur mobile)              │
│  Logo FLARE AI + marque                               │
│  ──────────────────────                               │
│  ⚡ Automatisations                                   │
│  🤖 Assistant IA                                      │
│  ──────────────────────                               │
│  📖 Guide                                             │
│  💳 Abonnements                                       │
│  💬 Contactez-nous                                    │
│  ──────────────────────                               │
│  ⚙️  Paramètres                                       │
│  [Avatar] Prénom Nom    [Déconnexion]                 │
├──────────────────────────────────────────────────────┤
│  MAIN AREA (flex-1, overflow-y-auto)                  │
│  [Breadcrumb + bouton retour]                         │
│  [Contenu du niveau actif]                            │
└──────────────────────────────────────────────────────┘
```

**Sidebar** :
- Item actif : couleur brand orange, fond `--bg-active`
- Items inactifs : texte `--text-muted`, hover `--bg-hover`
- Sur mobile : drawer overlay (comportement existant conservé)
- Supprimé de la sidebar : historique conversations, dossiers, bouton nouvelle conv.

---

## 4. Page : Accueil (post-connexion)

**Route** : `navStack = ['home']`

### Structure
1. **Header** : "Bonjour, {user.displayName}" (`text-3xl font-bold`) + nom organisation + date du jour (`text-lg text-muted`)
2. **KPI row** : 3 glass cards horizontales
   - Statut chatbot (Actif ✅ / Inactif ⚠️)
   - Messages traités ce mois (API `/dashboard`)
   - Contacts/leads captés (API `/dashboard`)
   - Skeleton loader si données en attente
3. **Accès rapide** : 2 grandes glass cards cliquables
   - **Automatisations** : illustration SVG + description courte → push('automations')
   - **Assistant IA** : illustration SVG + description courte → push('assistant')

### Design cards
- `backdrop-blur-md`, bordure `--border-glass`, fond `--bg-glass`
- Hover : `scale(1.02)` via Framer Motion + légère élévation shadow
- Radius : `rounded-2xl`

---

## 5. Page : Automatisations

**Route** : `navStack = [..., 'automations']`

### Structure
- Titre `text-3xl font-bold` : "Automatisations"
- Sous-titre `text-lg` muted : "Choisissez une plateforme"
- Grille 3×2 de platform cards

### Platform cards

| Plateforme | Statut | Action |
|---|---|---|
| Facebook | Débloqué | push('facebook') |
| Google | Débloqué | push('google') |
| Instagram | Verrouillé 🔒 | tooltip "Bientôt disponible" |
| LinkedIn | Verrouillé 🔒 | tooltip "Bientôt disponible" |
| Shopify | Verrouillé 🔒 | tooltip "Bientôt disponible" |
| Site Web | Verrouillé 🔒 | tooltip "Bientôt disponible" |

**Card débloquée** : logo officiel (48px), nom `text-xl font-semibold`, hover avec lueur colorée brand de la plateforme.
**Card verrouillée** : même layout mais fond plus sombre, icône cadenas, `cursor-not-allowed`, pas de hover élévation.

---

## 6. Page : Facebook

**Route** : `navStack = [..., 'facebook']`

Grille de 3 module cards :

| Module | Statut | Action |
|---|---|---|
| Chatbot IA | Débloqué ✅ | push('chatbot') |
| Community Manager | Verrouillé 🔒 | tooltip |
| Content Creator | Verrouillé 🔒 | tooltip |

---

## 7. Page : Google

**Route** : `navStack = [..., 'google']`

Grille de 3 module cards :

| Module | Statut | Action |
|---|---|---|
| Prospection | Verrouillé 🔒 | tooltip |
| Google Ads | Verrouillé 🔒 | tooltip |
| Tableau de bord | Verrouillé 🔒 | tooltip |

---

## 8. Page : Chatbot IA

**Route** : `navStack = [..., 'chatbot']`

4 glass cards d'entrée :

| Carte | Icône | Description | Action |
|---|---|---|---|
| Personnalisation | Brush | Identité, ton, entreprise, offres | push('chatbot-personnalisation') |
| Paramètres | Sliders | Catalogue, portfolio, connexion FB | push('chatbot-parametres') |
| Tableau de bord | BarChart | Stats, statut, activité | push('chatbot-dashboard') |
| Clients & Conversations | Users | Suivi, notifications, toggle bot | push('chatbot-clients') |

Badge rouge sur "Clients & Conversations" si conversations en attente d'intervention.

---

## 9. Page : Personnalisation

**Route** : `navStack = [..., 'chatbot-personnalisation']`

Page scrollable, **3 sections** (pas de sous-onglets) :

### Section 1 — Identité du bot
Composant existant : `ChatbotIdentityTab`
Champs : nom du bot, ton (formel/amical), langue, prompt système, message d'accueil
Bouton [Sauvegarder] à la fin de la section

### Section 2 — Mon entreprise
Composant existant : `ChatbotBusinessTab`
Champs : nom entreprise, secteur, horaires, description, adresse, contact
Bouton [Sauvegarder] à la fin de la section

### Section 3 — Offres & Ventes
Composant existant : `ChatbotSalesTab`
Champs : configuration ventes, message de closing, comportement qualification leads
Bouton [Sauvegarder] à la fin de la section

**Implémentation** : les 3 composants onglets existants sont rendus en séquence verticale dans un scroll unique. Leurs props/API calls restent identiques.

---

## 10. Page : Paramètres chatbot

**Route** : `navStack = [..., 'chatbot-parametres']`

Page scrollable, **3 sections** :

### Section 1 — Connexion Facebook
- Page connectée : nom + statut (✅ actif / ⚠️ problème)
- Boutons : [Connecter une page] / [Déconnecter]
- Logique existante : `ChatbotStatusTab` + `facebookMessenger.ts`
- Seuls `owner` et `admin` voient les boutons d'action (règle existante conservée)

### Section 2 — Catalogue produits/services
Composant existant : `ChatbotCatalogueTab`
Liste + [Ajouter] [Modifier] [Supprimer]

### Section 3 — Portfolio
Composant existant : `ChatbotPortfolioTab`
Galerie + [Ajouter] [Modifier] [Supprimer]

---

## 11. Page : Tableau de bord chatbot

**Route** : `navStack = [..., 'chatbot-dashboard']`

### Structure
1. **KPI row** (3 glass cards) :
   - Statut chatbot (Actif / Inactif)
   - Messages traités ce mois
   - Contacts captés ce mois
2. **Banner vérification Facebook** : repris de `ChatbotStatusTab` (dernière vérification + refresh manuel)
3. **Activité récente** : liste des 10 dernières conversations (nom contact, heure, résumé court)

Données : API `/dashboard` et `/chatbot/overview` déjà existantes.

---

## 12. Page : Clients & Conversations

**Route** : `navStack = [..., 'chatbot-clients']`

### Vue liste

1. **Banner d'alerte** (conditionnel) : "X conversation(s) nécessitent votre attention" + [Voir les alertes] filtre
2. **Barre recherche + filtres** : Tous • Leads • Intervention requise • Désactivé
3. **Liste clients** : chaque ligne contient :
   - Avatar initial + Nom complet (`text-lg font-semibold`)
   - Statut : 🟢 Chatbot actif / 🔴 Intervention requise / ⚫ Désactivé
   - Dernier message : horodatage relatif (`il y a 2h`)
   - Qualification : badge (Lead qualifié / Prospect / Client)
   - Nombre de messages
   - Actions : [Voir →] [Toggle chatbot ON/OFF]

### Toggle chatbot par client
- Flag `bot_enabled: boolean` par `user_id` en base
- Endpoint backend à créer : `PATCH /chatbot/contacts/{contact_id}/bot-status`
- Toggle switch UI : Framer Motion, couleur orange quand actif

### Logique intervention requise
- Le bot marque une conversation `needs_human: true` quand il ne sait pas répondre
- Ce flag déclenche :
  - Statut rouge sur la ligne client
  - Badge rouge sur la carte d'entrée "Clients & Conversations"
  - Banner d'alerte en haut de la liste
- L'utilisateur reprend la main → le flag repasse à `false` (bouton "Reprendre" ou toggle off/on)

---

## 13. Page : Fiche client

**Route** : `navStack = [..., 'chatbot-client-detail']`
Contexte : `selectedContactId: string` stocké dans un état séparé (`useState`), défini au moment du push dans la pile. Exemple : `setSelectedContactId(id); push('chatbot-client-detail')`.

### Structure
1. **Carte info client** (glass card) :
   - Nom, téléphone/email, date premier contact, qualification
   - Toggle chatbot ON/OFF bien visible (`text-base font-medium`)
2. **Historique des échanges** : fil de conversation Messenger, lisible (messages horodatés, distinction bot/client avec couleur)
3. **Notes internes** : zone texte libre pour l'utilisateur (sauvegarde locale ou API)

---

## 14. Page : Assistant IA

**Route** : `navStack = [..., 'assistant']`

Layout **2 colonnes** :
- **Gauche (280px)** : historique conversations + dossiers + [+ Nouvelle conversation]
- **Droite (flex-1)** : `ChatWindow` + `MessageInput` existants

Composants réutilisés : `ChatWindow`, `MessageInput`, `useChat`, `useConversations`, `useFolders` — aucun changement de logique.

---

## 15. Pages secondaires

### Guide
3 glass cards : "Démarrer en 5 min", "Chatbot IA : comment ça marche", "Lire vos KPIs"
Contenu statique (texte ou lien externe). Évolutif.

### Abonnements
Carte plan actuel : nom du plan, date d'expiration, liste des modules actifs/verrouillés
Bouton [Mettre à niveau →] → lien vers page de paiement
Données : API `/billing` existante

### Contactez-nous
Email, WhatsApp, lien formulaire. Grande police. Sobre.

### Paramètres application
Sections scrollables :
- Profil : nom, photo, mot de passe
- Organisation : nom, logo
- Apparence : toggle dark/light (existant)
- Langue
- Déconnexion

---

## 16. Design system

### Typographie (Inter, aucun texte < 14px)

| Élément | Classe Tailwind | Taille |
|---|---|---|
| Titre de page | `text-3xl font-bold` | 30px |
| Sous-titre | `text-lg font-normal text-muted` | 18px |
| Label carte | `text-xl font-semibold` | 20px |
| Corps | `text-base font-normal` | 16px |
| Info secondaire | `text-sm font-medium` | 14px |
| **Interdit** | `text-xs` et moins | < 14px |

### Glass cards
```css
backdrop-filter: blur(12px);
background: var(--bg-glass);
border: 1px solid var(--border-glass);
border-radius: 1rem; /* rounded-2xl */
box-shadow: var(--shadow-card);
```

Hover : `scale(1.02)` Framer Motion + légère hausse de shadow
Card verrouillée : `opacity-50`, fond plus sombre, `cursor-not-allowed`

### Couleurs brand
- Orange actif : `rgb(var(--brand-orange-soft))`
- Bleu accent : `var(--accent-strong)`
- Muted : `var(--text-muted)`

### Animations
Toutes via Framer Motion `motion.div` :
- Entrée page : `initial={{ opacity: 0, y: 16 }}` → `animate={{ opacity: 1, y: 0 }}`
- Transition : `duration: 0.25s ease`
- Cards hover : `whileHover={{ scale: 1.02 }}`

---

## 17. Ce qui est réutilisé vs ce qui est nouveau

### Réutilisé sans modification
- `ChatbotIdentityTab`, `ChatbotBusinessTab`, `ChatbotSalesTab`
- `ChatbotCatalogueTab`, `ChatbotPortfolioTab`
- `ChatbotStatusTab` (Facebook banner)
- `ChatWindow`, `MessageInput`
- `useChat`, `useConversations`, `useFolders`, `useAuth`
- `GlobalBackground`, `FlareMark`, `SkeletonLoader`
- Toutes les fonctions API dans `lib/api.ts`
- `lib/facebookMessenger.ts`

### Modifié
- `Sidebar.tsx` : items réduits aux 7 entrées du menu, suppression historique conversations
- `page.tsx` : `ActiveView` remplacé par `navStack`, routing vers les nouvelles pages
- `AutomationHubPanel.tsx` : remplacé par la nouvelle hiérarchie de cards

### Nouveau
- `NavBreadcrumb.tsx` : composant breadcrumb + bouton retour
- `HomePage.tsx` : accueil avec KPIs + 2 cartes accès rapide
- `AutomationsPage.tsx` : grille plateformes
- `FacebookPage.tsx` : grille modules Facebook
- `GooglePage.tsx` : grille modules Google (tout verrouillé)
- `ChatbotHomePage.tsx` : 4 cartes d'entrée chatbot
- `ChatbotPersonnalisationPage.tsx` : 3 sections verticales
- `ChatbotParametresPage.tsx` : 3 sections verticales
- `ChatbotDashboardPage.tsx` : KPIs + activité récente
- `ChatbotClientsPage.tsx` : liste clients + filtres + alertes
- `ChatbotClientDetailPage.tsx` : fiche client + historique + toggle
- `PlatformCard.tsx` : carte réutilisable (débloquée/verrouillée)
- `AssistantPage.tsx` : layout 2 colonnes avec historique intégré

### Backend (ajout minimal)
- `PATCH /chatbot/contacts/{contact_id}/bot-status` : toggle chatbot par client
- Champ `bot_enabled` + `needs_human` sur le modèle contact/conversation

---

## 18. Hors scope

- Refonte backend
- Nouvelles intégrations (Instagram, LinkedIn, Shopify)
- Analytics avancés
- Application mobile
