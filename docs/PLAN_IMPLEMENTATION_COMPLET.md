# PLAN D'IMPLÉMENTATION COMPLET — FLARE AI
**Date :** 2026-04-01
**Statut :** À exécuter correction par correction
**Auteur :** Claude (plan de travail validé)

---

## ⚠️ RÈGLE ABSOLUE — WORKFLOW DE DÉPLOIEMENT

> **Toujours tester en local AVANT de déployer en production.**
>
> **Ordre obligatoire pour chaque correction :**
> 1. `cd backend && uvicorn main:app --reload --port 8000` → vérifier `/health`
> 2. `cd frontend && npm run dev` → ouvrir `http://localhost:3000`
> 3. Tester manuellement la fonctionnalité modifiée
> 4. `cd frontend && npm run build` → zéro erreur
> 5. Seulement après validation locale : `npx firebase-tools deploy --only hosting`

---

## RAPPEL ARCHITECTURE ACTUELLE

```
Frontend : Next.js 14.2.3 · TypeScript · Tailwind CSS · Framer Motion · Firebase Auth
Backend  : FastAPI · SQLAlchemy · Cloud Run (europe-west1)
DB       : SQLite/PostgreSQL via SQLAlchemy
Auth     : Firebase Auth → token Bearer → backend vérifie via firebase-admin
Deploy   : Firebase Hosting (frontend) · Google Cloud Run (backend)

URLs prod :
  Frontend  → https://flareai.ramsflare.com
  Backend   → https://flare-backend-236458687422.europe-west1.run.app
  Messenger → https://messenger-direct-236458687422.europe-west9.run.app
```

---

## RÈGLE DESIGN — LIGHT MODE

> **En light mode :** texte principal = `#0F0F14` (quasi-noir). Pas de gris trop clair sur fond blanc.
> **Couleurs neutres uniquement :** zinc, slate, gray — pas de bleu électrique, pas de violet.
> **Orange FLARE** reste l'unique couleur accent (boutons, actifs, CTA).
> **Fond light :** `#FAFAFA` ou `#F4F4F8` — jamais blanc pur.
> **Tous les `text-white/xx`** remplacés par `text-fg/xx` (variable CSS déjà en place).
> **Icônes** : `text-fg/50` inactif · `text-fg/80` actif · jamais `text-white`.

---

## CORRECTION 1 — PARAMÈTRES : RESTRUCTURATION ET ALLÈGEMENT

### Problème
La page Paramètres est trop chargée, mal organisée, et certaines sections ne servent à rien visuellement.

### Objectif
Une page Paramètres claire, légère, avec 5 sections distinctes et un scroll fluide.

### Structure cible

```
Paramètres
├── 1. Mon Profil
│   ├── Photo de profil (upload fonctionnel)
│   ├── Nom affiché
│   ├── Nom complet
│   └── Email (lecture seule)
├── 2. Sécurité
│   └── Réinitialiser mot de passe (email de reset Firebase)
├── 3. Organisation
│   ├── Nom de l'organisation (si admin/owner)
│   ├── Description courte
│   └── Logo (upload fonctionnel)
├── 4. Apparence & Langue
│   ├── Toggle Dark / Light (avec prévisualisation)
│   └── Sélecteur Français / Anglais
└── 5. Compte
    └── Bouton Se déconnecter
```

### Fichiers concernés

| Fichier | Action |
|---|---|
| `frontend/src/components/pages/SettingsPage.tsx` | Refonte visuelle complète |
| `frontend/src/app/globals.css` | Variables light mode neutres |

### Détail des changements frontend

**SectionCard** :
- Fond : `bg-[var(--bg-card)]` (blanc en light, dark glass en dark)
- Bordure : `border-fg/[0.07]`
- Titre section : `text-fg/55` uppercase small — jamais `text-white/60`

**FieldRow labels** :
- `text-fg/65 text-sm font-medium`
- Hint : `text-fg/35 text-xs`

**TextInput** :
- Fond : `bg-[var(--bg-input)]` — en light = `rgb(235,235,242)`, texte = `text-fg/85`
- Focus : `border-orange-500/50`
- Placeholder : `text-fg/25`

**Toggle (dark/light)** :
- Thumb : `bg-[var(--icon-active)]` — blanc en dark, noir en light ✅ déjà corrigé
- Track inactif : `bg-fg/[0.08] border-fg/[0.14]`

**Bouton Sauvegarder** :
- `bg-orange-500/15 border border-orange-500/30 text-orange-500`
- Hover : `bg-orange-500/25`

**Dividers** : `bg-fg/[0.06]` — visible en light et dark

**Photo de profil** :
- Upload via `<input type="file">` → lecture FileReader → envoi base64 vers `POST /api/identity/upload`
- Affichage immédiat en preview avant sauvegarde

### Détail des changements backend

- `PUT /api/identity/profile` → déjà existant → vérifier que `avatar_url` est bien persisté
- `POST /api/identity/upload` → déjà existant → vérifier retour `{ url: string }`
- `PUT /api/identity/organization` → déjà existant → vérifier droits owner/admin

### Tests locaux attendus
- [ ] Modifier nom → sauvegarder → recharger → nom persisté
- [ ] Changer photo → preview immédiate → sauvegarder → avatar mis à jour dans sidebar
- [ ] Toggle dark/light → toute l'app change immédiatement
- [ ] Changer langue FR/EN → sidebar + paramètres traduits immédiatement

---

## CORRECTION 2 — CONNEXION FACEBOOK + SÉLECTION DE PAGE (CRITIQUE)

### Problème central
Le système actuel confond connexion OAuth Meta, sélection de page, et activation du chatbot dans un wizard trop complexe. La synchro page → chatbot est cassée. Il n'est pas possible de choisir facilement une page parmi plusieurs.

### Architecture cible : 1 Page = 1 Chatbot Indépendant

```
Compte FLARE
└── Organisation
    ├── Page Facebook A  →  Chatbot A  (préférences A, catalogue A, portfolio A)
    ├── Page Facebook B  →  Chatbot B  (préférences B, catalogue B, portfolio B)
    └── Page Facebook C  →  Chatbot C  (préférences C, catalogue C, portfolio C)

PageSelector (nouveau composant)
    ↓ sélection active
    Toutes les vues Chatbot (Personnalisation, Paramètres, Dashboard, Clients)
    filtrent leurs données par selectedPageId
```

### Flow utilisateur complet

```
1. Utilisateur clique "Chatbot Facebook"
   ↓
2. PageSelector affiché en haut
   → Si 0 page connectée : bouton "Connecter une page Facebook"
   → Si 1+ pages : dropdown/cards pour sélectionner
   ↓
3. Sélection d'une page → selectedPageId stocké (localStorage + state)
   ↓
4. Tout le cockpit chatbot charge les données de CETTE page
   (préférences, catalogue, portfolio, clients, dashboard)
   ↓
5. Bouton "Ajouter une page" toujours disponible → relance OAuth Meta
```

### Composant PageSelector (nouveau fichier)

**Fichier :** `frontend/src/components/PageSelector.tsx`

```
Interface :
  props:
    pages: FacebookPage[]          // toutes les pages connectées
    selectedPageId: string | null  // page active
    onSelect: (pageId: string) → void
    onAddPage: () → void           // déclenche OAuth Meta
    loading: boolean

Rendu si 0 pages :
  Card vide avec CTA orange "Connecter votre page Facebook"
  + explication courte (1 ligne max)

Rendu si 1+ pages :
  Chips/tabs cliquables avec :
    - Photo de profil de la page (Facebook Graph API)
    - Nom de la page
    - Badge vert si webhook_subscribed = true / rouge sinon
  + Bouton discret "+ Ajouter une page"

Design :
  - Fond : bg-[var(--bg-card)] border border-fg/[0.07] rounded-2xl
  - Page active : border-orange-500/40 bg-orange-500/[0.06]
  - Aucun texte blanc — tout en text-fg/xx
```

### Flux OAuth Meta — étapes détaillées

```
ÉTAPE 1 : Lancement OAuth
  Frontend → GET /api/facebook/auth-url?org=xxx&frontend_origin=xxx
  Backend  → construit URL Meta OAuth avec state signé HMAC
  Frontend → window.open(url, '_blank', 'popup')

ÉTAPE 2 : Callback Meta
  Meta → GET /api/facebook/callback?code=xxx&state=xxx
  Backend → vérifie state HMAC → échange code → access_token
  Backend → GET /me/accounts (liste pages) → filtre MANAGE+MESSAGING
  Backend → stocke pages en DB (FacebookPageConnection)
  Backend → redirige vers frontend avec ?fb_connected=1

ÉTAPE 3 : Retour frontend
  Frontend détecte ?fb_connected=1 → rafraîchit la liste des pages
  PageSelector affiche les pages disponibles → user choisit

ÉTAPE 4 : Activation d'une page
  User clique "Activer" sur une page
  Frontend → POST /api/facebook/activate { page_id: "xxx" }
  Backend → subscribe webhook → sync messenger-direct → retour statut
  Frontend → badge vert sur la page
```

### Modèle de données — FacebookPageConnection (backend)

```python
# Champs existants à vérifier/ajouter :
class FacebookPageConnection(Base):
    id: int
    user_id: str          # Firebase UID
    org_scope_id: str     # slug organisation
    page_id: str          # ID Facebook de la page
    page_name: str        # Nom de la page
    page_picture_url: str # URL photo profil page (NEW — à ajouter)
    access_token: str     # chiffré via encryption_service
    webhook_subscribed: bool
    direct_service_synced: bool
    is_active: bool       # page sélectionnée pour ce scope
    created_at: datetime
    updated_at: datetime
```

### Préférences par page

Chaque appel aux préférences chatbot doit inclure `page_id` :

```
GET  /api/chatbot/overview?page_id=xxx
POST /api/chatbot/preferences?page_id=xxx
GET  /api/chatbot/catalogue?page_id=xxx
POST /api/chatbot/catalogue?page_id=xxx
GET  /api/chatbot/portfolio?page_id=xxx
POST /api/chatbot/portfolio?page_id=xxx
```

Le backend distingue les préférences par `(user_id, org_scope_id, page_id)` combinés.

**Backend — migration nécessaire :**
- Ajouter colonne `page_id` à `ChatbotPreferences` (nullable pour rétrocompatibilité)
- Ajouter colonne `page_id` à `ChatbotCatalogueItem`
- Ajouter colonne `page_id` à `ChatbotPortfolioItem`
- Toutes les routes chatbot acceptent `page_id` en query param

### Fichiers concernés

| Fichier | Action |
|---|---|
| `frontend/src/components/PageSelector.tsx` | CRÉER — sélecteur de pages |
| `frontend/src/components/pages/ChatbotParametresPage.tsx` | Intégrer PageSelector, passer page_id à tous les appels |
| `frontend/src/components/pages/ChatbotDashboardPage.tsx` | Filtrer par page_id |
| `frontend/src/components/pages/ChatbotClientsPage.tsx` | Filtrer par page_id |
| `frontend/src/components/pages/ChatbotPersonnalisationPage.tsx` | Passer page_id |
| `frontend/src/app/page.tsx` | État selectedFacebookPageId global — déjà en place |
| `backend/routers/chatbot.py` | Ajouter page_id à tous les endpoints |
| `backend/routers/facebook_pages.py` | Ajouter page_picture_url, améliorer activation |
| `backend/core/database.py` | Migration colonnes page_id |

### Section Connexion Facebook dans ChatbotParametresPage

```
Section 1 — Connexion Facebook
┌────────────────────────────────────────────────────────┐
│  Pages connectées                          [+ Ajouter] │
│  ┌──────────────────────────────────────────────────┐  │
│  │ [Photo] Nom de la Page A          ● Actif    [✕] │  │
│  │ [Photo] Nom de la Page B          ○ Inactif  [✕] │  │
│  └──────────────────────────────────────────────────┘  │
│  Dernière vérification : il y a 2 min  [↻ Rafraîchir]  │
└────────────────────────────────────────────────────────┘

Si 0 pages :
┌────────────────────────────────────────────────────────┐
│  Aucune page connectée                                 │
│  Connectez votre page Facebook pour activer le chatbot │
│  [Connecter une page Facebook]                         │
└────────────────────────────────────────────────────────┘
```

### Tests locaux attendus
- [ ] OAuth Meta s'ouvre en popup → page choisie → retour sans erreur
- [ ] PageSelector affiche les pages avec photo + statut
- [ ] Sélectionner une page → préférences chargent pour CETTE page
- [ ] Activer/désactiver une page → webhook status mis à jour
- [ ] Plusieurs pages → chacune a ses propres préférences indépendantes
- [ ] Déconnecter une page → liste mise à jour

---

## CORRECTION 2B — REFONTE UI PARAMÈTRES CHATBOT (DESIGN PREMIUM & GLASS)

### Problème visuel actuel
L'interface de la page "Paramètres du chatbot" est très lourde, sombre et peu engageante :
- Grandes cartes massives avec bordures pleines ou couleurs saturées (ex: le gros bloc marron "ACTION REQUISE").
- Boutons pleins (`bg-orange-500`) qui clashent avec l'esthétique "premium / glass".
- Manque de hiérarchie visuelle claire entre les statuts et les actions.

### Architecture UI cible
La page `ChatbotParametresPage.tsx` doit utiliser exactement les mêmes composants et principes que la page des paramètres généraux (`SettingsPage.tsx`) que nous avons déjà refondue.

**1. Utilisation du composant `SectionCard` (Standardisation) :**
- Remplacer les div massives par le même `<SectionCard>` avec effet glassmorphism (`bg-[var(--bg-card)]`, `border-fg/[0.07]`, ombre portée douce).
- Titres de section discrets en majuscules avec espacement (`text-fg/55 uppercase tracking-widest`).

**2. Statut en temps réel (Allègement) :**
- Remplacer les gros blocs carrés (PAGE FACEBOOK, CHATBOT ACTIF, WEBHOOK) par une ligne épurée d'indicateurs de statut.
- Utiliser des petits badges élégants (`bg-emerald-500/10 text-emerald-400` pour "En ligne", etc.) au lieu de textes bruts "A VERIFIER".

**3. Action Requise (Si aucune page connectée) :**
- Supprimer l'énorme bloc marron. Le remplacer par un `EmptyState` élégant au centre de la vue (icône Facebook avec effet de flou/glow partiel derrière, texte discret, bouton d'action secondaire/premium).

**4. Boutons et appels à l'action :**
- Les boutons d'action principale ("Connecter Facebook") ne doivent plus être de gros blocs solides.
- Utiliser le style Premium : `bg-orange-500/15 border border-orange-500/30 text-orange-500` avec un effet de hover fluide (`bg-orange-500/25`).

### Fichiers concernés
| Fichier | Action |
|---|---|
| `frontend/src/components/pages/ChatbotParametresPage.tsx` | Réécriture totale de l'UI en appliquant le design system glassmorphic (SectionCard, FieldRow, boutons semi-transparents). |

---

## CORRECTION 3 — CLIENTS & CONVERSATIONS : NOMS SYNCHRONISÉS

### Problème
Les noms des contacts Messenger ne sont pas à jour. Les noms affichés sont souvent "PSID" ou anonymes.

### Cause
Le service messenger-direct stocke les contacts par PSID. Le nom Facebook est récupéré via Graph API lors du premier contact mais n'est pas rafraîchi.

### Solution

**Backend — messenger-direct :**
- `GET /me?fields=name,profile_pic` via Graph API lors de chaque nouveau message
- Stocker `first_name + last_name` ou `name` dans la table contacts
- Endpoint existant : `GET /dashboard/internal` → vérifier que `customer` retourne bien le nom et non le PSID

**Backend — FLARE backend :**
- `GET /api/chatbot/clients?page_id=xxx` → retourner `{ psid, name, profile_pic_url, ... }`
- Forcer un refresh du nom si `name` contient uniquement des chiffres (= PSID)

**Frontend — ChatbotClientsPage :**
- Afficher `contact.name` prioritaire
- Si `contact.name` est vide ou = PSID : afficher "Contact #{psid.slice(-4)}"
- Photo de profil : `<img src={contact.profile_pic_url} />` avec fallback initiales

### Fichiers concernés

| Fichier | Action |
|---|---|
| `frontend/src/components/pages/ChatbotClientsPage.tsx` | Affichage nom + photo |
| `frontend/src/components/pages/ChatbotClientDetailPage.tsx` | Nom en tête de fiche |
| `backend/routers/chatbot.py` ou `dashboard.py` | Endpoint clients avec vrais noms |
| `chatbot Facebook/direct_service/app.py` | Refresh nom lors nouveau message |

### Tests locaux attendus
- [ ] Liste clients affiche noms réels (pas PSIDs)
- [ ] Photo de profil ou initiales visibles
- [ ] Après nouveau message d'un contact → nom mis à jour

---

## CORRECTION 4 — BOUTON BOT ACTIF / INACTIF PAR CLIENT

### Problème
Le toggle bot ON/OFF par client (dans Clients & Conversations) n'a pas d'effet réel sur le backend.

### Architecture cible

```
Toggle UI (ChatbotClientsPage / ChatbotClientDetailPage)
  ↓ clic
PATCH /api/chatbot/contacts/{contact_id}/bot-status
  { bot_enabled: boolean, page_id: string }
  ↓
Backend : met à jour contacts.bot_enabled en DB
  ↓
messenger-direct : vérifie bot_enabled avant de traiter chaque message entrant
  → bot_enabled = false → ne répond pas (ou mode humain)
  → bot_enabled = true  → traite le message normalement
```

### Backend — endpoint à créer

**Fichier :** `backend/routers/chatbot.py`

```python
PATCH /api/chatbot/contacts/{contact_id}/bot-status
  Body: { bot_enabled: bool, page_id: str }
  Auth: Bearer token Firebase
  Return: { contact_id, bot_enabled, updated_at }
```

**Table DB à modifier :**
```python
class MessengerContact(Base):
    # Ajouter :
    bot_enabled: bool = True      # true = chatbot actif pour ce contact
    needs_human: bool = False     # true = intervention humaine requise
```

**messenger-direct — modification :**
- Avant de générer une réponse : vérifier `bot_enabled` pour ce PSID
- Si `bot_enabled = false` → ignorer le message (ou notifier l'opérateur)

### Frontend

**ChatbotClientsPage :**
```tsx
// Toggle par ligne
<Toggle
  enabled={contact.bot_enabled}
  onToggle={() => handleBotToggle(contact.psid, !contact.bot_enabled)}
  label="Chatbot actif"
/>
// Appel : PATCH /api/chatbot/contacts/{psid}/bot-status
```

**ChatbotClientDetailPage :**
```tsx
// Toggle bien visible en haut de la fiche
<div className="flex items-center justify-between p-4 rounded-2xl bg-[var(--bg-card)] border border-fg/[0.07]">
  <div>
    <p className="text-base font-semibold text-fg/85">Chatbot</p>
    <p className="text-sm text-fg/45">{bot_enabled ? "Répond automatiquement" : "Désactivé pour ce contact"}</p>
  </div>
  <Toggle enabled={bot_enabled} onToggle={handleToggle} label="Chatbot" />
</div>
```

### Tests locaux attendus
- [ ] Toggle OFF → backend confirme → messenger-direct ne répond plus à ce contact
- [ ] Toggle ON → chatbot reprend les réponses
- [ ] État persisté après rechargement de page
- [ ] Badge rouge "Intervention requise" si needs_human = true

---

## CORRECTION 5 — TABLEAU DE BORD : STATUT CHATBOT RÉELLEMENT ACTIF

### Problème
Le tableau de bord affiche "Statut : Inactif" même quand le chatbot fonctionne. Le statut n'est pas calculé dynamiquement.

### Source de vérité du statut

```
Chatbot ACTIF si :
  ✓ webhook_subscribed = true (page Facebook connectée)
  ✓ direct_service_synced = true (messenger-direct configuré)
  ✓ bot_name non vide (préférences minimales configurées)
  ✓ is_active = true (page sélectionnée comme active)

Chatbot INACTIF si l'un de ces critères manque.
Chatbot DÉGRADÉ si webhook OK mais direct_service pas synced.
```

### Backend — endpoint statut

**Modifier :** `GET /dashboard/stats?page_id=xxx`
Retourner :
```json
{
  "chatbot_status": "active" | "inactive" | "degraded",
  "chatbot_status_reason": "Webhook actif · Synced · 1 page connectée",
  "page_name": "Nom de la page active",
  "webhook_subscribed": true,
  "direct_service_synced": true,
  "messages": { "total": 336, "today": 12 },
  "conversations": { "total": 48, "messenger": 48 },
  "period": { "messages": 120, "days": 30 }
}
```

### Frontend — ChatbotDashboardPage

**KPI Card Statut :**
```tsx
// Affichage dynamique basé sur chatbot_status
const statusConfig = {
  active: {
    color: "text-emerald-500",
    bg: "bg-emerald-500/10",
    dot: "bg-emerald-500",
    label: "Actif",
    desc: stats.chatbot_status_reason
  },
  inactive: {
    color: "text-fg/35",
    bg: "bg-fg/[0.04]",
    dot: "bg-fg/25",
    label: "Inactif",
    desc: "Connectez une page Facebook pour démarrer"
  },
  degraded: {
    color: "text-amber-500",
    bg: "bg-amber-500/10",
    dot: "bg-amber-500",
    label: "Dégradé",
    desc: "Webhook actif mais synchronisation incomplète"
  }
}
```

### Tests locaux attendus
- [ ] Page connectée + webhook actif → badge vert "Actif"
- [ ] Aucune page connectée → badge gris "Inactif"
- [ ] Webhook OK mais direct_service KO → badge orange "Dégradé"
- [ ] Statut mis à jour après activation/désactivation

---

## CORRECTION 6 — PRÉFÉRENCES CHATBOT : TOUT DOIT PRENDRE EFFET (BACKEND RÉEL)

### Problème
Certains champs des préférences chatbot (ton, rôle, message d'accueil, horaires, etc.) sont sauvegardés en DB mais ne sont PAS envoyés au service messenger-direct qui gère réellement les réponses.

### Architecture de sync complète

```
Sauvegarde préférences (frontend)
  ↓
POST /api/chatbot/preferences?page_id=xxx
  ↓
Backend : sauvegarde en DB
  + appel immédiat à _sync_page_to_direct_service(page_id)
    ↓
    messenger-direct reçoit nouvelles préférences
    ↓
    Prochain message traité avec les nouvelles prefs
```

### Champs à vérifier et synchroniser

**ChatbotIdentityTab** → préférences identité :
```
bot_name            → nom du bot dans les messages
tone                → ton de réponse (amical, professionnel, formel, décontracté)
primary_role        → rôle (vendeur, support, informateur, mixte)
language            → langue de réponse
greeting_message    → message d'accueil automatique
handoff_message     → message quand passage à humain
handoff_mode        → auto | manual
handoff_keywords    → mots-clés déclenchant handoff
```

**ChatbotBusinessTab** → infos entreprise :
```
business_name       → nom entreprise dans les réponses
business_sector     → secteur
company_description → description complète
business_hours      → horaires d'ouverture
business_address    → adresse
phone               → téléphone
contact_email       → email
website_url         → site web
```

**ChatbotSalesTab** → configuration vente :
```
products_summary           → résumé produits/services
special_instructions       → instructions spéciales
forbidden_topics_or_claims → sujets interdits
```

### Backend — vérification _sync_page_to_direct_service

**Fichier :** `backend/routers/facebook_pages.py`

La fonction `_sync_page_to_direct_service` doit être appelée APRÈS chaque sauvegarde de préférence.
Vérifier qu'elle envoie bien TOUS les champs ci-dessus au messenger-direct.

Si `direct_service_synced` passe à False après une erreur de sync → afficher un avertissement discret dans l'UI (badge orange sur le bouton Sauvegarder).

### Frontend — retour visuel de sauvegarde

Après `POST /api/chatbot/preferences` :
- Succès : badge vert "Synchronisé" pendant 3 secondes
- Erreur sync : badge orange "Sauvegardé localement — synchronisation en cours"
- Erreur réseau : banner rouge en haut de section

### Tests locaux attendus
- [ ] Modifier ton → sauvegarder → prochain message messenger utilise ce ton
- [ ] Modifier business_hours → chatbot répond avec les bons horaires
- [ ] Modifier bot_name → chatbot se présente avec le nouveau nom
- [ ] Sauvegarde avec erreur de sync → badge orange visible

---

## CORRECTION 7 — TABLEAU DE BORD : GRAPHE KPI EN TEMPS RÉEL

### Problème
Le tableau de bord actuel montre des KPI statiques (cartes chiffres). L'utilisateur veut des graphes dynamiques avec évolution dans le temps.

### Design cible

```
Tableau de bord
├── KPI Row (3 cartes)
│   ├── Statut chatbot (actif/inactif — voir Correction 5)
│   ├── Messages ce mois : XXX    [↑ +12% vs mois dernier]
│   └── Contacts captés : XXX     [↑ +8% vs mois dernier]
│
├── Graphe principal — Activité sur 30 jours (Recharts LineChart)
│   ├── Axe X : jours (J-30 à aujourd'hui)
│   ├── Axe Y : nombre de messages
│   ├── Ligne 1 : messages entrants (bleu neutre)
│   ├── Ligne 2 : messages bot (orange FLARE)
│   └── Tooltip au survol : date + valeurs
│
├── Graphe secondaire — Leads captés (Recharts BarChart)
│   ├── Barres par semaine (4 dernières semaines)
│   └── Couleur : orange FLARE avec opacité
│
└── Activité récente (liste des 10 dernières conversations)
    ├── Nom contact + avatar
    ├── Dernier message (tronqué 60 car)
    └── Horodatage relatif (il y a 2h)
```

### Backend — endpoint stats avec historique

**Modifier :** `GET /dashboard/stats?page_id=xxx&range=30d`

Retourner :
```json
{
  "chatbot_status": "active",
  "messages": { "total": 336, "today": 12, "this_month": 280 },
  "conversations": { "total": 48, "new_this_month": 15 },
  "history": [
    { "date": "2026-03-01", "messages_in": 8, "messages_bot": 6, "leads": 1 },
    { "date": "2026-03-02", "messages_in": 12, "messages_bot": 10, "leads": 2 },
    ...
  ],
  "weekly_leads": [
    { "week": "2026-W09", "leads": 4 },
    { "week": "2026-W10", "leads": 7 },
    ...
  ],
  "recent_conversations": [
    { "psid": "xxx", "name": "Jean", "last_message": "Merci !", "last_at": "2026-04-01T10:30Z" },
    ...
  ]
}
```

Si pas d'historique disponible : générer données vides (zéros) pour les 30 derniers jours.

### Frontend — ChatbotDashboardPage avec Recharts

**Bibliothèque :** Recharts (déjà installée dans le projet)

```tsx
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

// Couleurs adaptées dark/light :
const ORANGE = "rgb(var(--brand-orange-soft))";
const NEUTRAL = "rgb(var(--brand-blue-soft))";

// Tooltip custom (fond var(--bg-card), texte text-fg/80)
```

**Skeleton loader** pendant le chargement (composant SkeletonLoader existant).

**Responsive** : `ResponsiveContainer width="100%" height={220}`

### Tests locaux attendus
- [ ] Graphe s'affiche avec données réelles ou zéros si vide
- [ ] Tooltip fonctionne au survol
- [ ] Graphe en dark = fond sombre, lignes lisibles
- [ ] Graphe en light = fond blanc/gris, lignes bien contrastées
- [ ] Skeleton visible pendant le chargement initial

---

## CORRECTION 8 — PARAMÈTRES APP : TOUT DOIT FONCTIONNER

### Fonctionnalités à rendre 100% opérationnelles

#### 8.1 Nom affiché — frontend + backend
- Champ `displayName` → `PUT /api/identity/profile { display_name: "xxx" }`
- Après sauvegarde : nom mis à jour dans la sidebar (user footer) et le header
- Persisté en localStorage + DB backend

#### 8.2 Changer mot de passe — Firebase
- Bouton "Envoyer lien de réinitialisation" → `sendPasswordResetEmail(auth, email)`
- Confirmation visuelle : "Email envoyé à xxx@xxx.com" (badge vert 6 sec)
- Gestion erreur `auth/too-many-requests`
- ✅ Déjà implémenté dans SettingsPage — vérifier que ça fonctionne en prod

#### 8.3 Sauvegarde profil — upload photo
- Input file caché → click sur avatar → FileReader → base64 → upload
- `POST /api/identity/upload { target: "user_avatar", file_name, mime_type, data_url }`
- Retour `{ url }` → affiché immédiatement en preview
- Sauvegarde finale via `PUT /api/identity/profile { avatar_url: url }`
- Avatar mis à jour partout (sidebar, header) via state global `workspaceIdentity`

#### 8.4 Dark mode / Light mode
- ✅ Corrigé dans la session précédente (`html.light` class)
- Vérifier que TOUTES les pages appliquent bien les variables CSS
- Pages à inspecter : HomePage, ChatbotDashboardPage, ChatbotClientsPage, AssistantPage

#### 8.5 Langue FR / EN
- ✅ Corrigé dans la session précédente (lang global dans page.tsx)
- Étendre les traductions aux autres pages :
  - HomePage : "Bonjour" / "Hello", libellés KPI
  - ChatbotDashboardPage : labels graphes
  - NewSidebar : ✅ déjà traduit
  - BillingPage : labels offres
  - GuidePage : titres
  - ContactPage : textes

#### 8.6 Photo de profil organisation (admin/owner)
- Zone upload logo avec drag & drop optionnel
- Même flow que avatar personnel → `POST /api/identity/upload { target: "organization_logo" }`
- Logo mis à jour dans tout l'espace organisation

### Fichiers concernés

| Fichier | Action |
|---|---|
| `frontend/src/components/pages/SettingsPage.tsx` | ✅ Déjà refactorisé — vérifier upload |
| `frontend/src/app/page.tsx` | Sync workspaceIdentity après sauvegarde |
| `frontend/src/lib/api.ts` | Vérifier uploadIdentityAsset et updateUserProfileSettings |
| `backend/routers/settings.py` | Vérifier upload + profile update |

---

## CORRECTION 9 — ISOLATION PAR COMPTE (PROPRE ESPACE)

### Problème
Chaque compte doit avoir son propre espace complètement isolé : chatbot, assistant, clients, etc.

### Architecture d'isolation existante (à vérifier et renforcer)

```
Firebase Auth UID → user_id unique par compte
  ↓
Backend : toutes les requêtes filtrées par user_id (via Bearer token)
  ↓
Organisation : scope supplémentaire (org_scope_id)
  ↓
Page Facebook : (user_id, org_scope_id, page_id) = clé composite unique
```

### Points à vérifier/corriger

**Backend :**
- Toutes les tables ont une colonne `user_id` et les requêtes SELECT filtrent par `user_id`
- ChatbotPreferences : vérifier que `get_db` + `user_id` isole bien par compte
- ChatbotCatalogueItem : idem
- ChatbotPortfolioItem : idem
- MessengerContacts : scope par `(user_id, page_id)`
- Conversations assistant : scope par `user_id`

**Frontend :**
- Token Firebase rafraîchi avant chaque requête critique (`getFreshToken(true)`)
- Aucun état partagé entre comptes (pas de localStorage commun entre UIDs)
- Déconnexion → purge complète du localStorage FLARE

```javascript
// Dans logoutWithScopeReset (page.tsx)
const KEYS_TO_CLEAR = [
  'flare-theme', 'flare-lang', 'flare-user-name',
  'flare-selected-page-id', 'flare-org-slug',
  'flare_client_events'
];
KEYS_TO_CLEAR.forEach(k => localStorage.removeItem(k));
```

### Tests locaux attendus
- [ ] Compte A configure chatbot X → Compte B ne voit pas X
- [ ] Déconnexion → reconnexion avec autre compte → espace vide
- [ ] Organisations partagées → seuls les membres voient les données

---

## CORRECTION 10 — SÉCURITÉ ET CONFIDENTIALITÉ

### Mesures à implémenter

#### 10.1 Frontend
- **Token refresh automatique** : appeler `getFreshToken(true)` avant toute action sensible (activation page FB, sauvegarde préférences, upload assets)
- **Expiration de session** : si token Firebase expiré et non rafraîchissable → logout automatique avec message clair
- **Sanitisation inputs** : tous les champs TextInput → trim + limite de longueur (déjà partiel)
- **Pas de données sensibles en URL** : access_token Facebook jamais dans les query params frontend

#### 10.2 Backend
- **Access tokens chiffrés** : `encryption_service` déjà utilisé pour tokens Facebook → vérifier que TOUS les tokens sont chiffrés en DB
- **Rate limiting** : ajouter `slowapi` sur les endpoints sensibles (auth, upload, Facebook OAuth)
- **Validation stricte des rôles** : endpoints chatbot admin (`activate`, `deactivate`) → vérifier `user_can_edit_organization`
- **CORS** : vérifier que `CORS_ORIGINS` ne contient que les domaines FLARE autorisés
- **Headers sécurité** : ajouter `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`

#### 10.3 Service Worker
- Bump version SW à chaque déploiement majeur (pattern déjà établi : v15 → v16...)
- Ne jamais cacher les réponses API (déjà le cas — vérifier)

### Fichiers concernés

| Fichier | Action |
|---|---|
| `backend/main.py` | Ajouter headers sécurité + rate limiting |
| `backend/core/config.py` | Vérifier CORS_ORIGINS |
| `frontend/src/app/page.tsx` | Renforcer logout (purge localStorage) |
| `frontend/src/lib/api.ts` | getFreshToken avant requêtes sensibles |

---

## CORRECTION 11 — ASSISTANT IA : TOUTES LES FONCTIONNALITÉS

### Fonctionnalités à restaurer/compléter

```
Assistant IA (layout 2 colonnes)
├── Colonne gauche (280px)
│   ├── Bouton [+ Nouvelle conversation]
│   ├── Recherche dans les conversations
│   ├── Dossiers (liste + [+ Dossier])
│   │   └── Chaque dossier : expand/collapse, déplacer conv dedans
│   ├── Conversations récentes
│   │   └── Chaque conv : nom/date, [Renommer], [Supprimer], [Déplacer]
│   └── Sélection multiple (checkboxes) → [Supprimer la sélection] [Déplacer]
└── Colonne droite (flex-1)
    ├── Header : nom de la conversation active + [Renommer]
    ├── ChatWindow (messages IA + user)
    ├── Mémoire active : chips des souvenirs associés
    └── MessageInput (texte + fichiers + vocal)
```

### Fonctionnalités manquantes à réactiver

#### 11.1 Mémoire
- Panel ou section en bas/côté de la conv : "Ce que l'assistant se souvient"
- Chips affichant les entrées mémoire actives
- Bouton [Gérer la mémoire] → modal avec liste + supprimer
- Hook `useMemory` existant → vérifier qu'il est bien branché

#### 11.2 Connaissances (base documentaire)
- Bouton [Connaissances] dans la sidebar gauche
- KnowledgePanel existant → réintégrer dans AssistantPage
- Upload de documents, recherche dans la base
- L'assistant peut référencer les documents dans ses réponses

#### 11.3 Dossiers
- `useFolders` hook existant → vérifier opérations CRUD
- Drag & drop pour déplacer une conversation dans un dossier
- Renommer/supprimer un dossier
- Conversations affichées dans leur dossier dans la sidebar

#### 11.4 Conversations récentes
- `useConversations` hook existant → vérifier chargement
- Pagination ou scroll infini (10 puis +10)
- Renommer une conversation : double-clic ou crayon icône
- Supprimer : bouton poubelle + confirmation
- Sélection multiple : checkbox apparaît au hover

#### 11.5 Personnalisation de l'assistant
- Section "Personnaliser l'assistant" (dans Paramètres ou dans la sidebar Assistant)
- Choisir le modèle (rapide / raisonnement)
- Choisir la langue des réponses
- Activer/désactiver la mémoire automatique

### Fichiers concernés

| Fichier | Action |
|---|---|
| `frontend/src/components/pages/AssistantPage.tsx` | Restaurer layout 2 colonnes complet |
| `frontend/src/components/ChatWindow.tsx` | Vérifier mémoire + knowledge |
| `frontend/src/components/MemoryPanel.tsx` | Réintégrer |
| `frontend/src/components/KnowledgePanel.tsx` | Réintégrer |
| `frontend/src/components/FilesPanel.tsx` | Réintégrer si nécessaire |

---

## CORRECTION 12 — ABONNEMENTS : 4 OFFRES COMPLÈTES

### Les 4 offres (source : Stratégie_Pricing_FLARE_AI.docx)

| Offre | Prix | Message clé |
|---|---|---|
| **Free** | Gratuit | "Découvrir" |
| **Starter** | 15 000 – 30 000 Ar/mois | "Gagner du temps" |
| **Pro** ⭐ RECOMMANDÉ | 50 000 – 120 000 Ar/mois | "Gagner des clients" |
| **Business** | À partir de 150 000 Ar/mois | "Automatiser et scaler" |

### Design BillingPage cible

```
Abonnements
├── Plan actuel (card mise en avant)
│   ├── Nom du plan + badge coloré
│   ├── Date d'expiration
│   ├── Liste modules actifs (icône ✓ vert)
│   └── Modules verrouillés (icône 🔒 gris)
│
└── Tableau comparatif des 4 offres
    ├── Card Free      : fond bg-[var(--bg-card)]
    ├── Card Starter   : fond bg-[var(--bg-card)]
    ├── Card Pro       : MISE EN AVANT — badge "Le plus populaire"
    │                    fond légèrement orange teinté
    │                    border-orange-500/40
    └── Card Business  : fond bg-[var(--bg-card)]

Chaque card :
    ├── Nom offre (text-xl font-bold)
    ├── Prix (text-3xl font-bold) + "/mois"
    ├── Message clé (text-sm text-fg/50 italic)
    ├── Séparateur
    ├── Liste fonctionnalités (icône ✓)
    └── CTA : [Plan actuel] ou [Passer à Pro] ou [Nous contacter]
```

### Contenu des 4 offres

**Free (Gratuit)**
- ✓ 1 chatbot actif
- ✓ 50–100 messages/mois
- ✓ Accès limité à l'assistant IA
- ✓ Dashboard basique
- ✓ Upload limité (5 images catalogue)
- ✗ Prospection automatique
- ✗ Personnalisation avancée
- ✗ Export des données

**Starter (15 000 – 30 000 Ar/mois)**
- ✓ 1 chatbot complet
- ✓ 500–1 000 messages/mois
- ✓ Assistant IA plus rapide
- ✓ Upload catalogue illimité
- ✓ Dashboard amélioré
- ✓ Personnalisation ton et rôle

**Pro — RECOMMANDÉ (50 000 – 120 000 Ar/mois)**
- ✓ Chatbot avancé
- ✓ Messages quasi illimités
- ✓ Assistant IA complet (rapide + raisonnement)
- ✓ Génération fichiers (Excel, Word)
- ✓ Génération d'images
- ✓ Analytics avancées (leads, conversion)
- ✓ Multi-catalogue
- ✓ Priorité de réponse rapide

**Business (à partir de 150 000 Ar/mois)**
- ✓ Plusieurs chatbots
- ✓ Gestion multi-pages Facebook
- ✓ Automatisation avancée
- ✓ Gestion d'équipes
- ✓ Statistiques avancées
- ✓ Support prioritaire
- ✓ (Futur) API / intégrations

### Frontend — BillingPage

**Fichier :** `frontend/src/components/pages/BillingPage.tsx`

Données viennent de `getBillingFeatures(token)` → `GET /api/billing/features`
Plan actuel stocké dans la réponse billing.

**Traductions FR/EN** : les libellés des fonctionnalités doivent aussi être traduits.

### Tests locaux attendus
- [ ] Plan actuel bien mis en avant
- [ ] 4 cards affichées proprement
- [ ] Card Pro a le badge "Le plus populaire"
- [ ] Fonctionnalités verrouillées grisées
- [ ] CTA "Mettre à niveau" cliquable (lien vers contact ou formulaire)

---

## ORDRE D'EXÉCUTION RECOMMANDÉ

Les corrections sont groupées par impact et dépendances :

### Phase 1 — Fondations visuelles (sans backend) ⚡ Rapide
```
1. Correction 1  : Paramètres restructurés (CSS + layout)
5. Correction 5  : Statut chatbot dynamique (lecture seule backend)
7. Correction 7  : Graphes KPI (endpoint existant + Recharts)
12. Correction 12 : Page Abonnements 4 offres
```

### Phase 2 — Fonctionnalités critiques (backend requis) 🔧 Important
```
2. Correction 2  : PageSelector + connexion Facebook (LE PLUS IMPORTANT)
4. Correction 4  : Toggle bot par client (nouvel endpoint backend)
6. Correction 6  : Sync préférences chatbot (vérification _sync)
```

### Phase 3 — Données et noms 📋 Nécessaire
```
3. Correction 3  : Noms contacts synchronisés
8. Correction 8  : Paramètres app tous fonctionnels (photo, etc.)
```

### Phase 4 — Sécurité et isolation 🔐 Stable
```
9. Correction 9  : Isolation par compte (vérification)
10. Correction 10 : Sécurité renforcée
```

### Phase 5 — Fonctionnalités avancées 🚀 Valeur ajoutée
```
11. Correction 11 : Assistant IA complet (mémoire, dossiers, etc.)
```

---

## CHECKLIST DE DÉPLOIEMENT PAR CORRECTION

Pour chaque correction, suivre OBLIGATOIREMENT :

```
[ ] 1. Backend : uvicorn main:app --reload → tester endpoint local
[ ] 2. Frontend : npm run dev → tester feature sur localhost:3000
[ ] 3. Build : npm run build → 0 erreur TypeScript
[ ] 4. Test manuel complet de la fonctionnalité
[ ] 5. Vérifier light mode : texte lisible, fond clair neutre
[ ] 6. Vérifier dark mode : rien ne casse
[ ] 7. Vérifier mobile (responsive)
[ ] 8. Deploy frontend : npx firebase-tools deploy --only hosting
[ ] 9. Deploy backend si modifié : gcloud run deploy...
[ ] 10. Vérifier sur https://flareai.ramsflare.com
```

---

## RAPPEL COMMANDES LOCALES

```bash
# Backend (depuis D:\...\FLARE AI\backend)
cd backend
venv\Scripts\activate
uvicorn main:app --reload --port 8000
# → http://localhost:8000/health

# Frontend (depuis D:\...\FLARE AI\frontend)
cd frontend
npm run dev
# → http://localhost:3000

# Build check
npm run build

# Deploy hosting seulement
npx firebase-tools deploy --only hosting

# Deploy backend (Google Cloud Run)
gcloud builds submit --tag gcr.io/[PROJECT_ID]/flare-backend
gcloud run deploy flare-backend --image gcr.io/[PROJECT_ID]/flare-backend ...
```

---

## NOTES DESIGN GLOBALES — LIGHT MODE

### Règle des textes
```
text-fg/90   → titres principaux (quasi-noir en light = #0F0F14)
text-fg/70   → sous-titres, labels importants
text-fg/55   → labels secondaires, section headers
text-fg/40   → texte désactivé, hints
text-fg/25   → placeholders, metadata très discrète
```

### Règle des fonds
```
bg-[var(--bg-sidebar)]  → sidebar (light: #F4F4F8)
bg-[var(--bg-card)]     → cards (light: rgba(255,255,255,0.85))
bg-[var(--bg-input)]    → inputs (light: rgb(235,235,242))
bg-[var(--bg-hover)]    → hover state (light: rgba(15,15,20,0.04))
```

### Règle des bordures
```
border-fg/[0.07]   → cards, sections
border-fg/[0.10]   → inputs focus-off
border-orange-500/40 → éléments actifs/sélectionnés
```

### Ce qui est INTERDIT en light mode
- `text-white/xx` → TOUJOURS remplacer par `text-fg/xx`
- `bg-white/[0.0x]` → TOUJOURS remplacer par `bg-fg/[0.0x]`
- `border-white/[0.0x]` → TOUJOURS remplacer par `border-fg/[0.0x]`
- Fond `rgba(7,9,12,0.97)` → TOUJOURS `var(--bg-sidebar)`
- Texte gris `#888` fixe → TOUJOURS une variable CSS ou classe Tailwind adaptative

---

---

## CORRECTION 13 — MOTION GRAPHICS 3D FUTURISTES SUR TOUTES LES PAGES

### Contexte technique — Bibliothèques déjà installées

```json
"@react-three/fiber"      : ^8.17.14  → renderer Three.js dans React
"@react-three/drei"       : ^9.120.3  → helpers 3D (Float, Stars, Sphere, etc.)
"@splinetool/react-spline": ^4.1.0    → intégration scènes Spline 3D
"framer-motion"           : ^12.35.2  → animations 2D/3D CSS
"three"                   : ^0.172.0  → moteur 3D core
```

> **Aucune installation supplémentaire nécessaire.** Tout est déjà en place.
> Les éléments 3D sont `dynamic import` avec `{ ssr: false }` pour éviter les erreurs Next.js.

---

### PRINCIPE DIRECTEUR — PHILOSOPHIE VISUELLE

```
RÈGLE D'OR :
  Les éléments 3D ILLUSTRENT et ACCOMPAGNENT le contenu.
  Ils ne le cachent jamais, ne ralentissent jamais l'interface.

STYLE CIBLE :
  → Futuriste, épuré, professionnel
  → Particules et lumières douces (pas d'effets agressifs)
  → Palette : orange FLARE + bleu nuit + blanc/noir selon mode
  → Mouvement lent, organique (pas de clignotements)
  → Toujours subtil en light mode (opacité réduite)

PERFORMANCE :
  → Tous les canvas 3D : canvas willReadFrequently + pixelRatio max 1.5
  → `Suspense` + skeleton pendant le chargement du canvas
  → `useReducedMotion()` Framer Motion → désactiver animations si accessibilité
  → Désactivé sur mobile basse résolution (< 768px + devicePixelRatio < 1.5)
```

---

### NOUVEAUX COMPOSANTS 3D À CRÉER

**Répertoire :** `frontend/src/components/3d/`

| Composant | Fichier | Description |
|---|---|---|
| `ParticleField` | `ParticleField.tsx` | Champ de particules flottantes (fond global) |
| `OrbGlow` | `OrbGlow.tsx` | Orbe lumineux 3D animé (accueil, statuts) |
| `DataSphere` | `DataSphere.tsx` | Sphère de données tournante (KPIs) |
| `NeuralWeb` | `NeuralWeb.tsx` | Réseau de neurones animé (Assistant IA) |
| `FloatingCard3D` | `FloatingCard3D.tsx` | Card avec effet tilt 3D au hover |
| `WaveformMesh` | `WaveformMesh.tsx` | Mesh ondes animées (fond dashboard) |
| `GlowRing` | `GlowRing.tsx` | Anneau lumineux tournant (statut actif) |
| `IconFloat3D` | `IconFloat3D.tsx` | Icône SVG avec flottement 3D (cards nav) |
| `CounterAnim` | `CounterAnim.tsx` | Compteur animé avec particules (KPIs) |
| `ConnectorLines` | `ConnectorLines.tsx` | Lignes connectant pages Facebook (architecture) |

---

### PAGE PAR PAGE — ÉLÉMENTS 3D DÉTAILLÉS

---

#### 13.1 — FOND GLOBAL (GlobalBackground — toutes pages)

**Fichier :** `frontend/src/components/GlobalBackground.tsx` (modifier)

**Élément : ParticleField**
```
Description :
  Canvas Three.js en position fixed derrière tout le contenu.
  ~150 particules sphériques très petites (r=0.02) qui dérivent lentement.
  Reliées par des lignes fines si distance < seuil.
  Mouvement : sinusoïdal lent, chaque particule a une phase différente.

Dark mode  : particules blanches opacity 0.15, lignes opacity 0.05
Light mode : particules #0F0F14 opacity 0.06, lignes opacity 0.03
             (très discret pour ne pas gêner la lisibilité)

Implémentation :
  @react-three/fiber <Canvas> + useFrame() pour animation
  Points geometry avec BufferGeometry custom
  pixelRatio : Math.min(window.devicePixelRatio, 1.5)
  Désactivé si : prefers-reduced-motion OU mobile < 768px
```

---

#### 13.2 — PAGE ACCUEIL (HomePage)

**Élément 1 : OrbGlow** (zone centrale au-dessus du greeting)
```
Description :
  Orbe 3D sphérique de 120px, positionné en haut-centre de page.
  Composé de 3 sphères concentriques avec MeshBasicMaterial transparent :
    - Noyau : orange FLARE solide r=0.4
    - Halo 1 : orange 40% opacity r=0.6, rotation lente
    - Halo 2 : orange 15% opacity r=0.9, rotation inverse
  Animation : Float de @react-three/drei (speed=1.5, floatIntensity=0.4)
  Pulsation douce via scale oscillant entre 0.95 et 1.05 (sin)

Dark mode  : orange vif + bloom léger
Light mode : orange plus doux (opacity réduite de 30%)
```

**Élément 2 : CounterAnim** (sur les 3 KPI cards)
```
Description :
  À l'entrée de la page, les chiffres KPI comptent de 0 jusqu'à la valeur réelle
  avec une courbe easeOut sur 1.2 secondes.
  Au moment où le compteur atteint la valeur finale : burst de 6 particules
  orange qui s'échappent vers l'extérieur et s'estompent.

Implémentation :
  Framer Motion useMotionValue + useTransform pour le compteur
  Mini canvas Three.js pour le burst de particules (200x200px, transparent)
  Déclenchement : useInView() quand la card devient visible
```

**Élément 3 : FloatingCard3D** (les 2 grandes cards d'accès rapide)
```
Description :
  Au hover sur une card (Automatisations, Assistant IA) :
  Effet parallaxe 3D CSS via Framer Motion rotateX/rotateY
  La card pivote légèrement vers la souris (max ±8 degrés)
  Ombre portée qui se déplace avec l'inclinaison
  Le contenu interne (icône, titre) bouge légèrement en sens inverse (parallaxe)

  Implémentation : Framer Motion motion.div + onMouseMove → calcul angle
  Style : perspective(1200px) + rotateX + rotateY
  Sur mobile : effet désactivé (touch events)
```

---

#### 13.3 — PAGE AUTOMATISATIONS (AutomationsPage)

**Élément 1 : Grille de platform cards avec FloatingCard3D**
```
Description :
  Chaque card plateforme (Facebook, Google, Instagram…) a l'effet tilt 3D.
  Cards débloquées : tilt plein + légère lueur colorée brand au hover
    - Facebook : lueur #1877F2
    - Google   : lueur #4285F4
    - Instagram : lueur #E1306C (verrouillé = grisé)
  Cards verrouillées : tilt réduit (50%) + pas de lueur

  Lueur = box-shadow animé via Framer Motion
  La lueur pulse doucement (oscillation opacity 0.3 → 0.6)
```

**Élément 2 : Entrée staggerée des cards**
```
Description :
  Les 6 cards entrent une à une avec un délai croissant (stagger 80ms)
  Animation : opacity 0→1 + y 20→0 + scale 0.95→1
  Via Framer Motion variants + staggerChildren
```

---

#### 13.4 — PAGE FACEBOOK / CHATBOT HOME (ChatbotHomePage)

**Élément 1 : ConnectorLines** (si plusieurs pages connectées)
```
Description :
  Petites lignes SVG animées reliant visuellement la "Page Facebook"
  aux 4 modules (Personnalisation, Paramètres, Dashboard, Clients).
  Style : lignes pointillées animées avec dashOffset qui défile (effet flux)
  Couleur : orange FLARE, opacity 0.3

  Implémentation : SVG avec <line> ou <path> + Framer Motion animate dashOffset
  Positionnement absolu, en arrière-plan des cards
  Désactivé si layout trop compact (< 480px)
```

**Élément 2 : Badge "Actif" avec GlowRing**
```
Description :
  Quand le chatbot est actif, un anneau lumineux tourne autour du badge vert.
  Anneau SVG fin avec rotation continue (360deg en 3s) via CSS animation
  Couleur : emerald-500 en dark / emerald-600 en light
  Taille : 32x32px autour du dot de statut

  Quand inactif : pas d'anneau, juste le dot gris statique
```

**Élément 3 : 4 cards entrée Chatbot avec FloatingCard3D + icônes animées**
```
Description :
  Chaque card (Personnalisation, Paramètres, Dashboard, Clients) :
  → Tilt 3D au hover (voir FloatingCard3D)
  → L'icône centrale flotte légèrement (Float de @react-three/drei CSS equivalent)
    via Framer Motion animate y: [0, -4, 0] repeat infinite (3s)
  → Badge rouge "Clients nécessitent attention" pulse via scale 1→1.1→1

  Implémentation : Framer Motion motion.div pour tout (pas de Three.js)
  C'est suffisant pour cet effet, plus léger que Three.js
```

---

#### 13.5 — PAGE TABLEAU DE BORD (ChatbotDashboardPage)

**Élément 1 : WaveformMesh** (fond de la zone graphes)
```
Description :
  Derrière la zone des graphes Recharts, un mesh 3D subtil en arrière-plan.
  PlaneGeometry 20x5 avec 60x15 segments, vertices animés en vague sinusoïdale.
  Rotation lente sur l'axe Y.
  Très transparent (opacity 0.06 dark / 0.03 light) pour ne pas gêner les graphes.

  Canvas Three.js 100% width, 220px height, position absolute behind Recharts
  Couleur mesh : orange FLARE wireframe ou bleu nuit
  useFrame : chaque vertex z = sin(x * 0.5 + time * 0.8) * 0.3

  ⚠️ Le mesh est DERRIÈRE les graphes, pas par-dessus.
```

**Élément 2 : OrbGlow miniature** sur la KPI card "Statut Actif"
```
Description :
  Si chatbot_status = "active" : petit orbe vert émeraude (48px) à gauche du statut.
  Même animation que l'OrbGlow de la HomePage mais :
    - Couleur : emerald-500 au lieu d'orange
    - Taille réduite : r=0.3 noyau / r=0.5 halo
    - Float plus léger (floatIntensity=0.2)

  Si chatbot_status = "inactive" : pas d'orbe, juste le dot gris.
  Si chatbot_status = "degraded" : orbe amber-500.
```

**Élément 3 : Lignes de graphe Recharts avec gradient animé**
```
Description :
  Les lignes du LineChart (messages entrants / messages bot) ont un gradient
  en dégradé vertical sous la courbe (LinearGradient SVG Recharts).
  À l'entrée de la page : les lignes se "dessinent" de gauche à droite
  via stroke-dasharray + stroke-dashoffset animé (CSS / Framer Motion).

  Animation d'entrée : 800ms easeOut
  Gradient : orange FLARE 40% → 0% opacity (fill zone sous la courbe)
```

**Élément 4 : CounterAnim** sur les 3 KPI chiffres
```
  Même principe que HomePage — les chiffres comptent à l'entrée.
```

---

#### 13.6 — PAGE CLIENTS & CONVERSATIONS (ChatbotClientsPage)

**Élément 1 : Entrée staggerée des lignes clients**
```
Description :
  Chaque ligne client entre de la droite vers sa position (x: 20 → 0)
  avec opacity 0 → 1 et un stagger de 40ms entre chaque ligne.
  Via Framer Motion variants staggerChildren.
  Seulement les 10 premières lignes visible à l'écran — pas d'animation
  sur le scroll infini (trop coûteux).
```

**Élément 2 : Toggle bot animé avec particules**
```
Description :
  Quand on active le chatbot pour un client (toggle ON) :
  Petit burst de 4-6 particules orange qui s'échappent du toggle
  et disparaissent en 400ms.
  Implémentation : Framer Motion AnimatePresence + motion.div key change
  + confetti CSS particles (pas de Three.js — trop lourd par ligne)

  Quand on désactive : burst de particules grises/rouges qui tombent.
```

**Élément 3 : Badge "Intervention requise" pulsant**
```
Description :
  Le badge rouge "Intervention requise" pulse continuellement
  via scale 1 → 1.08 → 1 en 1.5s répété.
  Une légère glow rouge (box-shadow) pulse en sync.
  Framer Motion animate + repeat: Infinity
```

---

#### 13.7 — PAGE FICHE CLIENT (ChatbotClientDetailPage)

**Élément 1 : Avatar client avec halo animé**
```
Description :
  L'avatar du contact (photo Facebook ou initiales) a un halo circulaire SVG.
  Si bot_enabled = true : halo orange tournant (voir GlowRing).
  Si needs_human = true : halo rouge pulsant.
  Si inactif : pas de halo.

  Implémentation : SVG <circle> stroke-dasharray + rotate animation CSS
```

**Élément 2 : Bulles de conversation animées**
```
Description :
  Les messages dans l'historique Messenger entrent avec une légère animation :
  Messages client (gauche) : slideInLeft (x: -12 → 0 + opacity 0 → 1)
  Messages bot (droite)    : slideInRight (x: +12 → 0 + opacity 0 → 1)
  Stagger : 30ms entre chaque message
  Seulement à l'entrée initiale de la page — pas sur scroll.
  Via Framer Motion AnimatePresence + staggerChildren
```

---

#### 13.8 — PAGE PERSONNALISATION CHATBOT (ChatbotPersonnalisationPage)

**Élément 1 : Bot preview flottant**
```
Description :
  En haut de la page, à droite du titre, une illustration 3D d'un bot.
  Un personnage ou une icône de robot SVG/3D qui flotte doucement.
  Utilise @react-three/drei <Float> avec un mesh simple ou une icône SVG animée.

  Option A (3D léger) : @react-three/fiber avec un OctahedronGeometry animé
    coloré en orange, rotation lente, Float vertical.
  Option B (plus simple) : SVG bot icône + Framer Motion animate y: [0,-6,0]

  Le bot réagit visuellement quand l'utilisateur tape dans les champs :
    - bot_name rempli → le bot "hoche la tête" (rotate légère)
    - greeting_message saisi → le bot "s'illumine" (glow orange pulse)

  Implémentation : Framer Motion + state des champs pour déclencher animations
```

**Élément 2 : Sections avec entrée scrollée**
```
Description :
  Chaque section (Identité, Entreprise, Ventes) entre en view avec :
  opacity 0 → 1 + y 16 → 0 déclenché par useInView()
  Via Framer Motion whileInView + viewport once:true
```

---

#### 13.9 — PAGE PARAMÈTRES CHATBOT (ChatbotParametresPage)

**Élément 1 : PageSelector avec cartes pages animées**
```
Description :
  Les cards de pages Facebook dans le PageSelector entrent avec stagger.
  La page sélectionnée a un border animé (gradient qui tourne en contour).
  Implémentation : CSS conic-gradient + CSS animation rotate 360deg 3s linear infinite
  appliqué comme pseudo-element sur la card active.
  En light mode : gradient orange plus doux (opacity 0.5)
```

**Élément 2 : Statut connexion avec animation "Connecting..."**
```
Description :
  Quand OAuth est en cours : 3 points pulsants (loader), pas un spinner.
  Quand connexion réussie : checkmark SVG se "dessine" (stroke-dashoffset 0→0)
  en 400ms avec un bounce final.
  Quand erreur : X rouge qui shake horizontalement 3 fois (keyframes).
  Via Framer Motion animate/variants.
```

---

#### 13.10 — PAGE ASSISTANT IA (AssistantPage)

**Élément 1 : NeuralWeb** (fond de la colonne de chat)
```
Description :
  Derrière la zone de chat, un réseau de neurones animé très subtil.
  Nœuds (sphères r=0.05) reliés par des lignes fines.
  Des "impulsions" se propagent sur les lignes (points qui voyagent).
  Mouvement très lent, très transparent.

  Dark mode  : nœuds blancs opacity 0.08, lignes opacity 0.04, impulsions orange
  Light mode : nœuds #0F0F14 opacity 0.04, lignes opacity 0.02

  Implémentation : @react-three/fiber avec BufferGeometry nodes + Lines
  useFrame : animer les impulsions comme des lerps le long des arêtes

  ⚠️ Très discret — le chat doit rester parfaitement lisible
```

**Élément 2 : Bulle de message bot avec animation d'apparition**
```
Description :
  Chaque nouveau message de l'assistant IA apparaît avec :
  1. Un curseur clignotant (déjà typique dans les interfaces LLM)
  2. La bulle entre via opacity 0 → 1 + scale 0.97 → 1 (100ms)
  3. Un point indicateur "L'assistant réfléchit" : 3 dots qui pulsent (bounce)
     pendant la génération

  Via Framer Motion AnimatePresence
```

**Élément 3 : Sidebar conversations avec hover animé**
```
Description :
  Chaque item de conversation dans la sidebar gauche :
  Au hover : fond bg-[var(--bg-hover)] + léger translateX(+2px)
  À la sélection : fond bg-[var(--bg-active)] + indicateur orange à gauche
  (même pattern que NewSidebar, avec motion.div layoutId)
```

**Élément 4 : Bouton "Nouvelle conversation" avec sparkle**
```
Description :
  Le bouton [+ Nouvelle conversation] :
  Au clic : 3-4 sparkles (étoiles SVG) surgissent du bouton et s'estompent.
  Animation 300ms via Framer Motion.
  En light mode : sparkles orange foncé (#CC5500).
```

---

#### 13.11 — PAGE ABONNEMENTS (BillingPage)

**Élément 1 : Cards offres avec effets de profondeur**
```
Description :
  Les 4 cards d'offre ont le FloatingCard3D tilt effect.

  Card Pro (recommandée) : effet renforcé
    → Halo orange en border animé (voir PageSelector)
    → Badge "Le plus populaire" avec shimmer (reflet qui passe de gauche à droite)
    → Légère lueur orange en box-shadow pulsante

  Animation shimmer (badge) :
    CSS @keyframes shimmer : background-position -200% → 200%
    linear-gradient(90deg, transparent, orange/20, transparent)
```

**Élément 2 : DataSphere** (visuel décoratif à droite du titre de page)
```
Description :
  Une sphère 3D de 80px avec des points de données disposés à la surface.
  Points : latitude/longitude uniformément distribués (~60 points)
  Chaque point est une petite sphère r=0.05.
  Rotation lente sur Y + légère oscillation Z.
  Quelques lignes connectant les points voisins (réseau).
  Couleurs : orange FLARE pour les points actifs, blanc/gris pour inactifs.

  Représente visuellement "la plateforme qui grandit" → concept abstrait du plan.
  Implémentation : @react-three/fiber + SphereGeometry + BufferGeometry points
```

---

#### 13.12 — PAGE GUIDE (GuidePage)

**Élément : Cards avec icônes animées**
```
Description :
  Les 3 cards guide ont chacune une icône ilustrative qui anime doucement.
  Card "Démarrer en 5 min"      : rocketship SVG qui monte/descend (float)
  Card "Comment ça marche"      : engrenages qui tournent lentement
  Card "Lire vos KPIs"          : graphe SVG dont les barres montent à l'entrée

  Implémentation : SVG inline + Framer Motion animate
  Framer Motion whileInView pour déclencher au scroll
```

---

#### 13.13 — PAGE PARAMÈTRES (SettingsPage)

**Élément 1 : Avatar section avec halo**
```
Description :
  L'avatar de profil a un anneau concentrique pulsant doucement en fond
  (2 cercles concentriques SVG, opacity très faible, scale oscillant 1→1.04).
  Au hover sur l'avatar : l'anneau accélère légèrement.
  Via Framer Motion animate + whileHover.
```

**Élément 2 : Transitions entre sections**
```
Description :
  Chaque SectionCard entre avec whileInView (opacity 0→1, y 14→0)
  staggered avec délays progressifs (déjà en place avec prop delay).
  Aucun changement nécessaire — déjà implémenté.
  ✅ Vérifier que c'est bien déclenché une seule fois (viewport: { once: true })
```

---

### COMPOSANTS PARTAGÉS 3D — DÉTAIL TECHNIQUE

#### FloatingCard3D — Implémentation détaillée

**Fichier :** `frontend/src/components/3d/FloatingCard3D.tsx`

```
Principe :
  HOC/wrapper qui prend children et ajoute l'effet tilt 3D.

Props :
  intensity?: number    // max degrees de tilt (défaut: 8)
  glowColor?: string    // couleur de la lueur hover (défaut: orange FLARE)
  disabled?: boolean    // pour mobile ou cartes verrouillées

Fonctionnement :
  1. onMouseMove → calculer (mouseX - centerX) / width → angle X et Y
  2. Framer Motion motion.div avec style={{ rotateX, rotateY, perspective: 1200 }}
  3. Box-shadow animé selon angle (imitation lumière directionnelle)
  4. onMouseLeave → retour à rotateX=0, rotateY=0 (spring stiffness:200)

Light mode :
  La lueur est plus douce (opacity réduite de 50%)
  Box-shadow neutre (gray) au lieu d'orange si glowColor non spécifié
```

#### OrbGlow — Implémentation détaillée

**Fichier :** `frontend/src/components/3d/OrbGlow.tsx`

```
Principe :
  Composant autonome React + Three.js en canvas isolé.
  dynamic import avec ssr:false obligatoire.

Props :
  size?: number         // px (défaut: 120)
  color?: string        // hex (défaut: orange FLARE)
  intensity?: number    // pulsation (défaut: 1)

Scène Three.js :
  - Ambient light + Point light (warm)
  - Noyau : SphereGeometry + MeshStandardMaterial metalness:0.3 roughness:0.2
  - Halo 1 : SphereGeometry légèrement plus grand + wireframe + opacity 0.15
  - Halo 2 : SphereGeometry encore plus grand + transparent + opacity 0.06
  - @react-three/drei <Float> wrapping tout
  - useFrame : pulsation scale sin(time * intensity)

Rendu :
  Canvas transparent (alpha:true) intégré dans le DOM normal
  Pas de position absolute — s'intègre dans le flux du layout
```

#### ParticleField — Implémentation détaillée

**Fichier :** `frontend/src/components/3d/ParticleField.tsx`

```
Principe :
  Canvas Three.js position:fixed z:-1 derrière tout le contenu.

Optimisation critique :
  - Ne rendre que si !prefersReducedMotion && !isMobile
  - pixelRatio: Math.min(devicePixelRatio, 1.5)
  - Points geometry (1 draw call pour toutes les particules)
  - Pas de raycasting, pas de shadows
  - Cible 30fps stable (frameloop: "demand" si statique, "always" si animé)

Scène :
  150 particules BufferAttribute position (x,y,z random)
  Chaque frame : position.y += velocity * sin(time + phase) * 0.001
  Particules wrappent (si y > 5 → y = -5)
  PointsMaterial size:0.04 transparent opacity:0.15 (dark) ou 0.05 (light)

Lignes (optionnel, peut être désactivé si perf insuffisante) :
  LineSegments entre particules proches (distance < 1.5)
  Recalculé toutes les 30 frames (pas chaque frame)
```

---

### RÈGLES DE PERFORMANCE 3D

```
✅ AUTORISÉ :
  - Framer Motion partout (très léger, CSS-based)
  - Three.js canvas isolés et taille fixe (OrbGlow, DataSphere)
  - ParticleField avec points geometry (1 draw call)
  - SVG animations via CSS/Framer Motion
  - @react-three/drei <Float> (spring-based, très léger)

⚠️ AVEC PRÉCAUTION :
  - WaveformMesh : désactivé si FPS < 30 (requestAnimationFrame monitoring)
  - NeuralWeb : particules max 80 nœuds, pas de recalcul topologie chaque frame
  - Plusieurs canvas Three.js sur la même page : max 3 simultanément

❌ INTERDIT :
  - Three.js fullscreen sur mobile
  - Shadows / reflections (trop coûteux)
  - Post-processing (bloom, DOF) — trop lourd en production
  - Canvas 3D position:fixed sur mobile
  - Animations sur chaque scroll event (utiliser IntersectionObserver)
```

---

### ADAPTATION DARK / LIGHT MODE

```
Tous les composants 3D acceptent la prop `theme: 'dark' | 'light'`
passée depuis page.tsx via le state global `theme`.

Dark mode  → opacités normales, orange vif, fond sombre
Light mode → opacités réduites 40-60%, orange doux, pas de lueurs trop intenses

Variables CSS à utiliser dans les matériaux Three.js :
  Lire les couleurs depuis getComputedStyle(document.documentElement)
    → getPropertyValue('--brand-orange-soft')   → rgb(r g b)
    → parse → { r, g, b } pour Three.js Color

Exemple :
  const orangeValue = getComputedStyle(document.documentElement)
    .getPropertyValue('--brand-orange-soft').trim()
  // "255 163 82" → new THREE.Color(255/255, 163/255, 82/255)
```

---

### PHASE D'EXÉCUTION — MOTION GRAPHICS

Les éléments 3D sont ajoutés **APRÈS** les corrections fonctionnelles (1-12).
Ils ne bloquent aucune fonctionnalité — c'est une couche visuelle indépendante.

**Ordre recommandé :**
```
Phase A — Framer Motion (aucune dépendance Three.js) :
  1. FloatingCard3D wrapper          → toutes les cards de navigation
  2. CounterAnim KPIs                → HomePage + Dashboard
  3. Stagger entrée listes           → AutomationsPage, ClientsPage
  4. Toggle bot burst particles      → ChatbotClientsPage
  5. Badge pulsant (GlowRing SVG)    → Statut actif, Intervention requise
  6. Shimmer badge Pro               → BillingPage

Phase B — Three.js léger (composants isolés) :
  7. OrbGlow                         → HomePage + Dashboard statut
  8. DataSphere                      → BillingPage
  9. Bot flottant (Personnalisation) → ChatbotPersonnalisationPage

Phase C — Three.js ambient (fonds) :
  10. ParticleField global            → GlobalBackground
  11. WaveformMesh dashboard          → ChatbotDashboardPage
  12. NeuralWeb assistant             → AssistantPage

Phase D — Effets avancés :
  13. ConnectorLines Facebook         → ChatbotHomePage / PageSelector
  14. Graphe Recharts entrée animée   → ChatbotDashboardPage
  15. Ligne card Pro halo tournant    → BillingPage
```

**Checklist déploiement motion graphics :**
```
[ ] 1. Tester sur PC bas de gamme (simuler GPU lent dans DevTools)
[ ] 2. Tester avec prefers-reduced-motion activé → animations désactivées
[ ] 3. Tester en light mode → rien n'est illisible
[ ] 4. npm run build → aucune erreur SSR (tous canvas en dynamic + ssr:false)
[ ] 5. Vérifier FPS avec Performance DevTools → target 55-60fps desktop
[ ] 6. Vérifier que Three.js canvas ne bloquent pas les interactions UI
[ ] 7. npm run build && firebase deploy
```

---

*Plan rédigé le 2026-04-01 — À exécuter correction par correction avec validation locale systématique.*
