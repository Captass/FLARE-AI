# PROMPT — Chatbot Self-Service SaaS : Setup Wizard + Multi-Tenant + Environnements

> A copier-coller dans Google Antigravity (Jules) pour implementation.

---

## 1. CONTEXTE PROJET

Tu travailles sur **FLARE AI OS V2**, une plateforme SaaS qui permet a chaque utilisateur (proprietaire de boutique, restaurant, salon, agence...) de connecter un chatbot IA a sa page Facebook en quelques clics. L'app est **deja deployee et fonctionnelle en production** avec de vrais utilisateurs.

**Stack technique :**
- Backend : FastAPI + LangGraph + SQLAlchemy (SQLite dev / PostgreSQL Cloud SQL prod) — dossier `backend/`
- Frontend : Next.js 14 + TypeScript + Tailwind CSS + Framer Motion — dossier `frontend/`
- Frontend deploy : Firebase Hosting (static export, `output: 'export'` dans next.config.js)
- Backend deploy : Cloud Run, region `europe-west9`, projet GCP `rams-flare`
- LLM : Gemini via `core/llm_factory.py`
- Auth : Firebase Admin SDK, header `Authorization: Bearer {token}`
- Multi-tenant : systeme d'organisations avec scopes (`org:slug`)
- Microservice Messenger : `chatbot Facebook/direct_service/app.py` (service separe sur Cloud Run)

**REGLES ABSOLUES :**
- Ne JAMAIS casser la prod deja deployee
- Ne JAMAIS lancer de serveur ou script continu dans le terminal
- Langue francais pour toute communication
- Build frontend doit passer : `cd frontend && npm run build`
- Changements backward-compatible, migration incrementale

---

## 2. AUDIT PREALABLE — COMMENCE PAR LA

Avant de coder quoi que ce soit, **lis et analyse** ces fichiers pour comprendre l'existant :

### Backend
- `backend/core/database.py` — tous les modeles SQLAlchemy (voir `FacebookPageConnection` ligne 295)
- `backend/agents/facebook_cm/agent.py` — agent chatbot (prompt hardcode "Alex" pour FLARE AI)
- `backend/agents/facebook_cm/tools.py` — envoi messages Messenger, catalogue hardcode
- `backend/agents/facebook_cm/webhook.py` — traitement webhooks Meta
- `backend/routers/facebook_pages.py` — OAuth Facebook complet (auth, callback, activate, disconnect)
- `backend/routers/webhooks.py` — reception webhook Facebook
- `backend/routers/settings.py` — endpoints settings, identite workspace
- `backend/core/organizations.py` — registre d'organisations, roles, scopes
- `backend/core/config.py` — variables d'environnement
- `backend/core/encryption_service.py` — chiffrement tokens
- `backend/main.py` — startup, routes, create_all

### Frontend
- `frontend/src/app/page.tsx` — routing principal, ActiveView type, rendering conditionnel
- `frontend/src/components/MessengerWorkspace.tsx` — workspace Messenger (connexion, conversations, leads, expenses)
- `frontend/src/components/Sidebar.tsx` — navigation (3 items : Accueil, Assistant, Automatisations)
- `frontend/src/components/DashboardPanel.tsx` — dashboard accueil (2 choix : Assistant + Automatisations)
- `frontend/src/components/SettingsModal.tsx` — modal parametres
- `frontend/src/lib/facebookMessenger.ts` — fonctions API Facebook (loadStatus, getAuthUrl, activate, disconnect)
- `frontend/src/lib/api.ts` — fonctions API generales, getApiBaseUrl()

### Microservice Messenger
- `chatbot Facebook/direct_service/app.py` — service separe qui recoit les messages

---

## 3. CE QUI EXISTE DEJA (NE PAS REFAIRE)

### OAuth Facebook — COMPLET ET DEPLOYE
- Endpoints : `/api/facebook/status`, `/api/facebook/auth`, `/api/facebook/callback`, `/api/facebook/pages/{id}/activate`, `DELETE /api/facebook/pages/{id}`
- State HMAC-SHA256, exchange short→long-lived token, encryption des tokens
- Webhook subscription automatique (`messages,messaging_postbacks`)
- Sync avec le microservice Messenger Direct

### Agent chatbot — FONCTIONNE mais HARDCODE
- `FacebookCMAgent.handle_message(psid, text)` fonctionne
- Le system prompt est hardcode pour FLARE AI uniquement (nom "Alex", offres fixes)
- **C'est ca qu'il faut rendre dynamique par organisation**

### Multi-tenant — INFRASTRUCTURE PRETE
- Organisations avec roles owner/admin/member/viewer
- Scopes : `org:slug` pour les organisations
- `FacebookPageConnection` lie page_id → organization_slug
- Tokens chiffres par `encryption_service`

---

## 4. OBJECTIF PRODUIT

### Vision
Transformer l'integration Facebook Messenger en systeme **SaaS multi-organisations multi-pages** avec un onboarding tellement simple qu'un proprietaire de restaurant peut le faire seul en 2 minutes.

### Flow utilisateur cible
1. L'utilisateur se connecte a FLARE AI
2. Il entre dans son espace organisation
3. S'il n'a pas encore de chatbot → il voit un **wizard de setup** (pas le dashboard)
4. Etape 1 : "Connecter votre page Facebook" → 1 clic OAuth
5. Etape 2 : "Configurer votre chatbot" → nom du bot, ton, description entreprise, offres, message d'accueil
6. Etape 3 : "Votre chatbot est en ligne !" → confirmation
7. Il arrive sur le dashboard, le chatbot repond deja aux messages sur sa page

---

## 5. TRAVAIL BACKEND

### 5A. Nouveau modele — Preferences chatbot par organisation

Dans `backend/core/database.py`, ajouter :

```python
class ChatbotPreferences(Base):
    __tablename__ = "chatbot_preferences"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    organization_slug = Column(String, unique=True, index=True, nullable=False)
    bot_name = Column(String, default="L'assistant")
    tone = Column(String, default="amical")  # professionnel | amical | decontracte | formel
    language = Column(String, default="fr")
    greeting_message = Column(Text, default="")
    company_description = Column(Text, default="")
    products_summary = Column(Text, default="")
    special_instructions = Column(Text, default="")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
```

La table sera creee automatiquement par `Base.metadata.create_all()` au startup.

### 5B. Endpoints preferences + setup status

Nouveau router ou dans `settings.py` :

```
GET  /api/chatbot-preferences     → retourne les prefs de l'org courante (ou defaults si rien)
PUT  /api/chatbot-preferences     → cree ou met a jour les prefs (owner/admin uniquement)
GET  /api/chatbot/setup-status    → retourne l'etat du setup :
     {
       "step": "need_org" | "connect_page" | "configure" | "complete",
       "has_connected_page": bool,
       "has_preferences": bool,
       "active_page_name": string | null,
       "active_page_id": string | null
     }
```

Logique setup-status :
1. User pas dans un scope org → `"need_org"`
2. Pas de page Facebook active pour cette org → `"connect_page"`
3. Pas de `ChatbotPreferences` pour cette org → `"configure"`
4. Sinon → `"complete"`

### 5C. System prompt dynamique dans l'agent

**Fichier `backend/agents/facebook_cm/agent.py`** — Modifier `handle_message` :

Le webhook contient le `page_id`. Utiliser ce `page_id` pour :
1. Trouver la `FacebookPageConnection` active correspondante → obtenir `organization_slug`
2. Charger les `ChatbotPreferences` de cette org
3. Si prefs existent → construire le prompt dynamiquement
4. Si pas de prefs → **fallback sur l'ancien CM_SYSTEM_PROMPT** (ne rien casser pour FLARE AI)

Prompt dynamique :

```python
def build_dynamic_prompt(prefs):
    tone_map = {
        "professionnel": "Tu es professionnel, courtois et structure. Tu vouvoies.",
        "amical": "Tu es chaleureux, tu tutoies et tu es enthousiaste. Emojis avec moderation.",
        "decontracte": "Tu es cool et decontracte, langage familier, emojis ok.",
        "formel": "Tu vouvoies, tu es tres formel et respectueux. Pas d'emojis.",
    }
    return f"""Tu es {prefs.bot_name}, l'assistant virtuel.

## Personnalite
{tone_map.get(prefs.tone, tone_map["amical"])}

## Entreprise
{prefs.company_description or "Information non fournie."}

## Offres et Services
{prefs.products_summary or "Catalogue non defini. Propose au client de contacter l'equipe."}

## Message d'accueil
Quand un nouveau client te contacte : {prefs.greeting_message or "accueil chaleureux avec prenom."}

## Instructions speciales
{prefs.special_instructions or "Aucune."}

## Regles
- Reponds dans la langue du client
- Ne promets rien qui n'est pas dans les offres
- Si demande hors catalogue → propose contact equipe
- Termine par un appel a l'action clair

{{user_context}}"""
```

### 5D. Amelioration multi-tenant

Verifier et renforcer dans `facebook_pages.py` :
- Une org peut avoir plusieurs pages (deja supporte)
- Pas de doublons page_id pour la meme org
- Statuts explicites : `pending`, `active`, `disconnected`, `sync_error`, `reconnect_required`
- Seuls owner/admin peuvent connecter/activer/desactiver (verifier avec `user_can_edit_organization`)
- Le routage webhook se fait par `page_id` → trouver l'org → charger les prefs

---

## 6. TRAVAIL FRONTEND

### 6A. Composant ChatbotSetupWizard

**Nouveau fichier : `frontend/src/components/ChatbotSetupWizard.tsx`**

Composant plein ecran, 3 etapes avec barre de progression.

**Design :** fond sombre `bg-[var(--background)]`, cartes `bg-white/[0.02]`, bordures `border-white/[0.04]`, accents orange pour actions principales. Meme style que DashboardPanel et LockedModulePanel.

**Ecran 1 — Connecter la page**
- Titre : "Connectez votre page Facebook"
- Sous-titre court : "En un clic, votre chatbot sera actif sur Messenger"
- Gros bouton "Connecter avec Facebook" (utilise `getFacebookMessengerAuthorizationUrl` de `facebookMessenger.ts`)
- Ouvre popup OAuth (voir pattern dans MessengerWorkspace.tsx : `window.open` + ecoute event `flare-facebook-oauth`)
- Apres connexion : affiche nom de la page + icone check verte + bouton "Continuer"
- Bouton discret "Passer pour l'instant" en bas

**Ecran 2 — Configurer le chatbot**
- Champs simples, pas intimidants :
  - **Nom du chatbot** : input, placeholder "Ex: Maya, Alex, L'assistant..."
  - **Ton** : 4 cartes cliquables (icone + 1 phrase) : Professionnel / Amical / Decontracte / Formel
  - **A propos de votre entreprise** : textarea 3 lignes, placeholder "Ex: Salon de beaute a Tana, specialise en soins capillaires..."
  - **Vos offres/services** : textarea 4 lignes, placeholder "Ex: Coupe femme 15 000 Ar, Lissage 80 000 Ar..."
  - **Message d'accueil** : textarea 2 lignes, placeholder "Ex: Bonjour ! Bienvenue chez [nom]. Comment puis-je vous aider ?"
  - **Instructions speciales** : section repliable (optionnel), textarea
- Bouton orange "Activer le chatbot" → appelle PUT /api/chatbot-preferences
- Bouton discret "Passer"

**Ecran 3 — Confirmation**
- Titre : "Votre chatbot est en ligne !"
- Resume visuel : nom du bot, page connectee, ton choisi
- Bouton "Aller au tableau de bord" → callback onComplete

**Barre de progression** : 3 cercles (1-2-3) relies par des lignes, etape active en surbrillance.

### 6B. Integration dans page.tsx

**Fichier `frontend/src/app/page.tsx`** :

1. Ajouter state : `const [setupStatus, setSetupStatus] = useState<{step: string} | null>(null);`
2. Dans le useEffect post-connexion (celui qui fait syncUser + loadOrganizationState), appeler aussi :
   ```tsx
   fetch(`${getApiBaseUrl()}/api/chatbot/setup-status`, { headers: { Authorization: `Bearer ${token}` } })
     .then(r => r.json())
     .then(setSetupStatus)
     .catch(() => null);
   ```
3. Dans le rendu conditionnel, AVANT le case `dashboard` :
   ```tsx
   // Si setup incomplet ET on est sur le dashboard → afficher le wizard
   if (activeView === "dashboard" && setupStatus && setupStatus.step !== "complete") {
     return <ChatbotSetupWizard
       step={setupStatus.step}
       token={token}
       onComplete={() => { /* recharger setup-status */ }}
       onSkip={() => setSetupStatus({ step: "complete" })}
     />;
   }
   ```
4. Dynamic import : `const ChatbotSetupWizard = dynamic(() => import("@/components/ChatbotSetupWizard"), { ssr: false, loading: () => <SkeletonPanel /> });`
5. **Ne PAS bloquer** les autres vues — le wizard s'affiche uniquement a la place du dashboard

### 6C. Onglet Chatbot dans SettingsModal

**Fichier `frontend/src/components/SettingsModal.tsx`** :

Ajouter un onglet "Chatbot" avec les memes champs que l'ecran 2 du wizard. Charge via `GET /api/chatbot-preferences`, sauvegarde via `PUT /api/chatbot-preferences`. Permet de modifier a tout moment.

---

## 7. CE QUI NE CHANGE PAS

- OAuth Facebook (deja fait et deploye, ne pas toucher)
- Webhooks (deja fonctionnels)
- Conversations/leads dans MessengerWorkspace (intact)
- Structure multi-org (on s'appuie dessus)
- Microservice Messenger Direct (pas touche)
- Le flow actuel FLARE AI doit continuer a fonctionner tel quel (fallback ancien prompt)

---

## 8. SEPARATION D'ENVIRONNEMENTS (apres le wizard)

Une fois le wizard fonctionnel, mettre en place :
- Variables d'env separees par environnement (dev/staging/prod)
- Verify tokens Meta separes
- URLs backend/frontend/webhook separees
- Documentation de deploiement par environnement
- Strategie de promotion dev → staging → prod

Mais **ne pas commencer par ca** — d'abord le wizard qui fonctionne.

---

## 9. ORDRE DE REALISATION

1. **Lire les fichiers listes en section 2** — comprendre l'existant
2. Backend : modele `ChatbotPreferences` dans `database.py`
3. Backend : endpoints preferences + setup-status
4. Backend : prompt dynamique dans `agent.py` avec fallback
5. Frontend : `ChatbotSetupWizard.tsx`
6. Frontend : integration dans `page.tsx`
7. Frontend : onglet chatbot dans `SettingsModal.tsx`
8. Build : `cd frontend && npm run build` — zero erreur
9. Tests manuels : connecter une page, configurer, verifier que le chatbot repond

---

## 10. TESTS A COUVRIR

- [ ] Une organisation connecte Facebook via le wizard
- [ ] Liste des pages recuperee apres OAuth
- [ ] Activation d'une page
- [ ] Preferences sauvees et rechargees correctement
- [ ] Prompt dynamique utilise les bonnes prefs
- [ ] Fallback sur ancien prompt si pas de prefs (FLARE AI)
- [ ] Message entrant route vers la bonne org via page_id
- [ ] Reponse envoyee avec le bon token
- [ ] Wizard ne s'affiche plus apres completion
- [ ] Modification prefs via Settings > Chatbot
- [ ] Deconnexion / reconnexion page
- [ ] Build frontend passe sans erreur

---

## 11. POINTS D'ATTENTION CRITIQUES

- Le frontend est un **static export** (`output: 'export'`) — pas de SSR, pas de getServerSideProps
- Les appels API utilisent `getApiBaseUrl()` de `lib/api.ts`
- L'auth passe par `Authorization: Bearer {token}` sur tous les endpoints
- Le scope org courant est determine cote backend via le token (pas de slug dans l'URL)
- L'app Meta est en **Live** avec de vrais utilisateurs — ne rien casser
- Les tokens page sont chiffres via `encryption_service` — utiliser le meme pattern
- Le `page_id` dans le webhook est la cle de routage multi-tenant
