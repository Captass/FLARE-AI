# Native wrappers FLARE AI

Derniere mise a jour : 19 avril 2026

Ce document fixe la base technique pour la distribution native / web sans changer l'architecture serveur:

- frontend Next.js statique reutilise
- backend FastAPI Render conserve
- Android via `Capacitor` et `APK` direct
- Windows via `Tauri`
- macOS / iPhone / iPad via web / `PWA` seulement
- aucun positionnement `App Store` ou `Play Store`

## Variables d'environnement frontend

- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_API_URL_ANDROID`
- `NEXT_PUBLIC_API_URL_DESKTOP`
- `NEXT_PUBLIC_ANDROID_CALLBACK_URL`
- `NEXT_PUBLIC_WINDOWS_CALLBACK_URL`

Valeurs de depart recommandées :

- `NEXT_PUBLIC_API_URL_ANDROID=https://flare-backend-ab5h.onrender.com`
- `NEXT_PUBLIC_API_URL_DESKTOP=https://flare-backend-ab5h.onrender.com`
- `NEXT_PUBLIC_ANDROID_CALLBACK_URL=flareai://oauth/android`
- `NEXT_PUBLIC_WINDOWS_CALLBACK_URL=flareai://oauth/windows`

## Variables backend

- `NATIVE_CORS_ORIGINS`
- `NATIVE_ANDROID_CALLBACK_URL`
- `NATIVE_WINDOWS_CALLBACK_URL`

Valeurs de depart :

- `NATIVE_CORS_ORIGINS=capacitor://localhost,tauri://localhost,http://tauri.localhost`
- `NATIVE_ANDROID_CALLBACK_URL=flareai://oauth/android`
- `NATIVE_WINDOWS_CALLBACK_URL=flareai://oauth/windows`

## Android

Le fichier [capacitor.config.ts](../../frontend/capacitor.config.ts) prepare :

- `appId`
- `webDir=out`
- ouverture externe OAuth via navigateur systeme
- splash de base
- packaging APK direct, pas de discours store

Etapes suivantes hors repo :

1. installer `@capacitor/cli`, `@capacitor/core`, `@capacitor/android`
2. lancer `npx cap add android`
3. configurer le deep link `flareai://oauth/android`
4. verifier upload fichier/image et reprise apres retour OAuth
5. distribuer l'APK en direct, hors store

## Desktop

Le squelette Tauri est dans [desktop/tauri/src-tauri](../../desktop/tauri/src-tauri).

Il prepare :

- build du frontend avant bundle
- sortie `out/`
- ouverture shell externe
- bundling `msi` Windows
- aucune cible `App Store` pour macOS
- macOS / iPhone restent sur le web / `PWA`

Etapes suivantes hors repo :

1. installer Rust et Tauri CLI
2. declarer le deep link `flareai://oauth/windows`
3. valider l'installateur Windows 11
4. garder macOS hors native, via web / `PWA`

## OAuth

Le backend Facebook supporte maintenant :

- `return_mode=popup` pour le web actuel
- `return_mode=redirect` pour Android APK et Windows Tauri
- `callback_url` bornee aux URLs frontend/natives configurees

Le runtime frontend stocke les resultats OAuth dans le navigateur et nettoie l'URL de retour au chargement.
Pour macOS et iPhone, le flux reste celui du web / PWA, sans wrapper natif ni cible de store.
