# FLARE AI — Handover & Facebook Multipage Architecture

## 1. Contexte Actuel
Nous avons migré l'architecture du Chatbot IA vers un modèle **Multipage**.
Un même compte utilisateur (ou organisation) peut désormais lier plusieurs Pages Facebook Meta, et gérer un chatbot distinct pour chacune d'elles.

## 2. Ce qui a été accompli (Statut Actuel)

### Backend (Cloud Run: `flare-backend`)
- L'infrastructure supporte complètement l'ajout de `page_id` dans toutes les tables de configuration (Catalogue, Portfolio, ChatbotPreferences).
- Le processus OAuth a été corrigé. Les Credentials de production sont bien chargés lors du déploiement `gcloud run deploy`.
- Le callback OAuth `/api/facebook/callback` intercepte la réponse de Meta, sauvegarde les pages dans la base de données, et retourne une page HTML de succès.
- Cette page HTML utilise la méthode `window.opener.postMessage(...)` et `window.close()` pour envoyer le jeton au frontend fluidement sans perdre le contexte.

### Frontend (Firebase Hosting: `flareai.ramsflare.com`)
- L'URL de base dynamique `NEXT_PUBLIC_API_URL` n'est plus un obstacle : le client détecte automatiquement s'il doit taper sur le port `localhost:8000` ou en production `flare-backend-...`.
- Le hub principal du Chatbot (`ChatbotHomePage.tsx`) force désormais l'utilisateur à **sélectionner explicitement une page** depuis un dropdown (`PageSelector.tsx`) avant de pouvoir accéder aux paramètres ou à la personnalisation.
- Le nom de la page s'affiche de manière synchronisée dans les Breadcrumbs / Headers (`ChatbotParametresPage.tsx`).

## 3. Flux OAuth et Connexion
1. Le Frontend appelle `getFacebookMessengerAuthorizationUrl` avec son origine (`window.location.origin`).
2. Le Backend génère l'URL Meta avec l'App ID de production et le bon redirect URI (qui pointe sur l'API, car Meta n'accepte pas `localhost`).
3. L'utilisateur ouvre un pop-up, approuve via Meta.
4. Meta redirige sur `/api/facebook/callback` (Backend).
5. Le Backend sauve la page, et le script JS dans le HTML renvoie l'état au composant React via `postMessage`.

---

## 4. Ce qu'il reste à améliorer (Next Steps pour Claude Code)

1. **Tableau de Bord & Analytics (`ChatbotDashboardPage.tsx`)**
   - Assurez-vous que les statistiques (statut, trafic, hits IA) affichent **uniquement** les métriques de la `selectedPageId`.

2. **Interface "Clients & Conversations"**
   - Implémenter le tri/filtrage des conversations par Page Facebook. Un client qui écrit sur la Page A ne doit pas être vu sur le tableau de la Page B.

3. **La gestion de l'état du Webhook**
   - Bien vérifier la reconnexion automatique des webhooks Meta si un token expire.

4. **Polishing UX**
   - Continuer la transition esthétique vers Glassmorphism (déjà entamée) dans toutes les sous-sections du Chatbot.
