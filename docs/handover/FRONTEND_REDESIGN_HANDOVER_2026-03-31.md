# FLARE AI — Handover Frontend Redesign
**Date** : 2026-03-31 | **Statut** : Spec validée, plan à écrire, implémentation à démarrer

---

## Commande exacte pour reprendre

```
Lis docs/handover/FRONTEND_REDESIGN_HANDOVER_2026-03-31.md en entier,
puis invoque superpowers:writing-plans pour écrire le plan d'implémentation
basé sur la spec docs/superpowers/specs/2026-03-31-flare-ai-frontend-redesign.md
```

---

## Ce qui a été fait

1. **Brainstorming complet** avec `superpowers:brainstorming` — toutes les décisions validées
2. **Spec complète écrite et approuvée** → `docs/superpowers/specs/2026-03-31-flare-ai-frontend-redesign.md`
3. **Plan d'implémentation** → **À ÉCRIRE** (quota épuisé avant de finir)

---

## Projet FLARE AI

- **But** : plateforme d'automatisation marketing pour TPE/PME à Madagascar
- **Frontend live** : `https://flareai.ramsflare.com`
- **Stack** : Next.js 14.2.3, TypeScript, Tailwind CSS 3.4.1, Framer Motion 12, Recharts, Firebase Auth
- **Fonts** : Instrument Sans + Outfit (déjà chargées dans layout.tsx)
- **Aucun test setup** : pas de Jest, pas de RTL (Playwright installé mais non configuré)
- **Répertoire** : `D:/Travail/RAM'S FLARE/Flare Group/Flare AI/FLARE AI/frontend/src/`

---

## Architecture décidée : NavStack Drill-Down

### Types (à créer dans `src/lib/navigation.ts`)

```typescript
export type NavLevel =
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

export const NAV_LABELS: Record<NavLevel, string> = {
  home: 'Accueil',
  automations: 'Automatisations',
  facebook: 'Facebook',
  google: 'Google',
  chatbot: 'Chatbot IA',
  'chatbot-personnalisation': 'Personnalisation',
  'chatbot-parametres': 'Paramètres',
  'chatbot-dashboard': 'Tableau de bord',
  'chatbot-clients': 'Clients & Conversations',
  'chatbot-client-detail': 'Fiche client',
  assistant: 'Assistant IA',
  guide: 'Guide',
  billing: 'Abonnements',
  contact: 'Contactez-nous',
  settings: 'Paramètres',
};

export function getBreadcrumb(stack: NavLevel[]): { level: NavLevel; label: string }[] {
  return stack.map(level => ({ level, label: NAV_LABELS[level] }));
}
```

### NavContext (à créer dans `src/contexts/NavContext.tsx`)

```typescript
interface NavContextValue {
  stack: NavLevel[];
  selectedContactId: string | null;
  push: (level: NavLevel) => void;
  pop: () => void;
  goTo: (level: NavLevel) => void;         // réinitialise la pile
  setSelectedContactId: (id: string | null) => void;
  current: NavLevel;
}
```

---

## Hiérarchie complète de navigation

```
Accueil (home)
├── Automatisations (automations)
│   ├── Facebook (facebook)
│   │   ├── Chatbot IA ✅ (chatbot)
│   │   │   ├── Personnalisation (chatbot-personnalisation)
│   │   │   │   └── [scroll] Identité + Entreprise + Ventes
│   │   │   ├── Paramètres (chatbot-parametres)
│   │   │   │   └── [scroll] Connexion FB + Catalogue + Portfolio
│   │   │   ├── Tableau de bord (chatbot-dashboard)
│   │   │   │   └── KPIs + Banner FB + Activité récente
│   │   │   └── Clients & Conversations (chatbot-clients)
│   │   │       └── Fiche client (chatbot-client-detail)
│   │   ├── CM 🔒
│   │   └── Content Creator 🔒
│   └── Google (google)
│       ├── Prospection 🔒
│       ├── Google Ads 🔒
│       └── Tableau de bord 🔒
│   (Instagram 🔒, LinkedIn 🔒, Shopify 🔒, Site Web 🔒)
└── Assistant IA (assistant)
    └── Layout 2 colonnes : historique gauche + ChatWindow droite
```

---

## Layout global

```
┌─────────────────────────────────────────────────────┐
│  SIDEBAR (240px, collapsible)                        │
│  🔥 FLARE AI  [logo]                                │
│  ─────────────────────                              │
│  ⚡ Automatisations                                  │
│  🤖 Assistant IA                                     │
│  ─────────────────────                              │
│  📖 Guide                                            │
│  💳 Abonnements                                      │
│  💬 Contactez-nous                                   │
│  ─────────────────────                              │
│  ⚙️  Paramètres                                      │
│  [avatar] Nom    [logout]                           │
├─────────────────────────────────────────────────────┤
│  MAIN AREA                                           │
│  [Breadcrumb + ← retour]                            │
│  [Contenu du NavLevel actif]                        │
└─────────────────────────────────────────────────────┘
```

---

## Fichiers à créer (17 nouveaux)

```
src/lib/navigation.ts
src/contexts/NavContext.tsx
src/components/NavBreadcrumb.tsx
src/components/PlatformCard.tsx
src/components/AppShell.tsx
src/components/pages/HomePage.tsx
src/components/pages/AutomationsPage.tsx
src/components/pages/FacebookPage.tsx
src/components/pages/GooglePage.tsx
src/components/pages/ChatbotHomePage.tsx
src/components/pages/ChatbotPersonnalisationPage.tsx
src/components/pages/ChatbotParametresPage.tsx
src/components/pages/ChatbotDashboardPage.tsx
src/components/pages/ChatbotClientsPage.tsx
src/components/pages/ChatbotClientDetailPage.tsx
src/components/pages/AssistantPage.tsx
src/components/pages/GuidePage.tsx
src/components/pages/BillingPage.tsx
src/components/pages/ContactPage.tsx
```

## Fichiers à modifier (2)

```
src/app/page.tsx        (1465 lignes) — remplacer activeView par NavContext + extraire AppShell
src/components/Sidebar.tsx (428 lignes) — simplifier props, supprimer conversations/folders
```

---

## Composants RÉUTILISÉS sans modification

| Composant existant | Utilisé dans |
|---|---|
| `ChatbotIdentityTab` | ChatbotPersonnalisationPage — Section 1 |
| `ChatbotBusinessTab` | ChatbotPersonnalisationPage — Section 2 |
| `ChatbotSalesTab` | ChatbotPersonnalisationPage — Section 3 |
| `ChatbotCatalogueTab` | ChatbotParametresPage — Section 2 |
| `ChatbotPortfolioTab` | ChatbotParametresPage — Section 3 |
| `ChatbotStatusTab` | ChatbotParametresPage (connexion FB) + ChatbotDashboardPage (banner) |
| `ChatWindow` | AssistantPage |
| `MessageInput` | AssistantPage |
| `useChat` hook | AssistantPage |
| `useConversations` hook | AssistantPage |
| `useFolders` hook | AssistantPage |
| `DashboardPanel` (partiellement) | ChatbotDashboardPage |

---

## APIs existantes déjà disponibles

### Données pour ChatbotClientsPage
```typescript
// lib/messengerDirect.ts — DÉJÀ EXISTANT
import { loadMessengerDashboardData, updateMessengerContactMode } from '@/lib/messengerDirect';

// MessengerCustomerHighlight contient :
interface MessengerCustomerHighlight {
  psid: string;           // ID unique du contact
  customer: string;       // Nom
  needsHuman: boolean;    // → badge rouge "Intervention requise"
  mode: string;           // 'agent' | 'human'
  lastMessageAt: string;
  lastMessage: string;
  readyToBuy: boolean;
  messageCount: number;
  totalCostUsd: number;
}

// Toggle bot par client — DÉJÀ EXISTANT
await updateMessengerContactMode(psid, 'human' | 'agent', token);
// 'human' = chatbot désactivé, 'agent' = chatbot actif
```

### Données pour ChatbotDashboardPage
```typescript
// lib/api.ts — DÉJÀ EXISTANT
import { getDashboardStats, getChatbotOverview } from '@/lib/api';
// getDashboardStats → messages, leads, period stats
// getChatbotOverview → step, active_page, preferences
```

### Données pour BillingPage
```typescript
// lib/api.ts — DÉJÀ EXISTANT
import { getBillingFeatures, getUserPlan } from '@/lib/api';
```

---

## Refactoring page.tsx — Logique de changement

**page.tsx actuel** : 1465 lignes gérant auth + chat + navigation + modals + org

**Après refactoring** :
- `page.tsx` : ~300 lignes — auth uniquement + AppShell + modals
- `AppShell.tsx` : NavProvider + Sidebar + MainContent rendering
- `useChat` + `useConversations` + `useFolders` bougent vers `AssistantPage.tsx`

**Props AppShell** :
```typescript
interface AppShellProps {
  user: User;
  token: string;
  displayName: string;
  workspaceIdentity: WorkspaceIdentity | null;
  setupStatus: ChatbotSetupStatus | null;
  planFeatures: PlanFeatures | null;
  onLogout: () => void;
  onOpenSettings: () => void;
  onOpenSpaceModal: () => void;
  onOpenSpaceManager: () => void;
}
```

**Sidebar — props supprimées** (restent dans AssistantPage) :
- `conversations`, `activeSessionId`, `onSelectConversation`, `onNewChat`
- `onRename`, `onDelete`, `onBulkDelete`, `onBulkUpdate`
- `folders`, `onAddFolder`, `onEditFolder`, `onRemoveFolder`

---

## Design system

| Élément | Classe Tailwind | Taille |
|---|---|---|
| Titre de page | `text-3xl font-bold` | 30px |
| Sous-titre | `text-lg font-normal` + muted | 18px |
| Label carte | `text-xl font-semibold` | 20px |
| Corps | `text-base font-normal` | 16px |
| Info secondaire | `text-sm font-medium` | 14px |
| **Interdit** | `text-xs` et moins | < 14px |

**Glass cards** :
```css
backdrop-filter: blur(12px);
background: var(--bg-glass);
border: 1px solid var(--border-glass);
border-radius: 1rem;  /* rounded-2xl */
box-shadow: var(--shadow-card);
```

**Hover** : `whileHover={{ scale: 1.02 }}` Framer Motion
**Cards verrouillées** : `opacity-50`, `cursor-not-allowed`, tooltip "Bientôt disponible"
**Animations entrée page** : `initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}`

---

## Tâches du plan d'implémentation (17 tasks)

Le plan doit être écrit dans `docs/superpowers/plans/2026-03-31-flare-ai-frontend-redesign.md`

1. **Jest setup** + `src/lib/navigation.ts` + tests unitaires (getBreadcrumb, etc.)
2. **NavContext** (`src/contexts/NavContext.tsx`) + test render
3. **NavBreadcrumb** (`src/components/NavBreadcrumb.tsx`) + test
4. **PlatformCard** (`src/components/PlatformCard.tsx`) locked/unlocked + test
5. **AppShell** (`src/components/AppShell.tsx`) — wrapper NavProvider + Sidebar + MainContent
6. **Refactor Sidebar** — simplifier props, 7 items, utiliser useNav()
7. **Refactor page.tsx** — remplacer activeView par NavContext, extraire vers AppShell
8. **HomePage** (`src/components/pages/HomePage.tsx`) — KPIs + 2 cartes accès rapide
9. **AutomationsPage + FacebookPage + GooglePage** — grilles de platform cards
10. **ChatbotHomePage** — 4 cartes (Personnalisation, Paramètres, Dashboard, Clients)
11. **ChatbotPersonnalisationPage** — 3 sections scrollables (IdentityTab + BusinessTab + SalesTab)
12. **ChatbotParametresPage** — 3 sections (connexion FB + CatalogueTab + PortfolioTab)
13. **ChatbotDashboardPage** — KPIs + banner FB + activité récente
14. **ChatbotClientsPage** — liste MessengerCustomerHighlight + filtres + alertes + toggle
15. **ChatbotClientDetailPage** — fiche contact + historique + notes + toggle
16. **AssistantPage** — layout 2 colonnes + useChat + useConversations migré depuis page.tsx
17. **Pages secondaires** — GuidePage + BillingPage + ContactPage + SettingsPage (dans SettingsModal existant)

---

## Notes critiques pour l'implémentation

1. **`page.tsx` exporte `ActiveView`** — importé par `Sidebar.tsx`. Après refactoring, `NavLevel` sera dans `lib/navigation.ts`. Mettre à jour les imports.

2. **`ChatbotWorkspace.tsx`** existe déjà avec les 6 onglets. Les 3 nouvelles pages (Personnalisation, Paramètres, Dashboard) **réutilisent les sous-composants** des onglets, pas le `ChatbotWorkspace` entier.

3. **`SpaceModal`, `SpaceManagerModal`, `SettingsModal`, `OrganizationAccessPanel`** restent dans `page.tsx` — ils ont besoin de l'état auth et org.

4. **`useChat`** dépend de `token` et `sessionId`. Ces valeurs devront être passées en props à `AssistantPage` ou lues depuis un contexte auth.

5. **Aucun changement backend nécessaire** sauf un endpoint optionnel futur pour les notes internes client (hors scope).

6. **`updateMessengerContactMode`** gère déjà le toggle bot — pas de nouveau endpoint backend.

---

## Checklist de complétion

- [x] Brainstorming fait
- [x] Spec écrite : `docs/superpowers/specs/2026-03-31-flare-ai-frontend-redesign.md`
- [ ] Plan écrit : `docs/superpowers/plans/2026-03-31-flare-ai-frontend-redesign.md`
- [ ] Implémentation (via `superpowers:subagent-driven-development`)
- [ ] Build vérifié (`npm run build` dans `frontend/`)
- [ ] Deploy Firebase (`npm run deploy` dans `frontend/`)
