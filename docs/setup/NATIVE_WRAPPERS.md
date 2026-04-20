# Native wrappers FLARE AI

Derniere mise a jour : 19 avril 2026

Ce document fixe la base technique pour la distribution native / web sans changer l'architecture serveur:

- frontend Next.js statique reutilise
- backend FastAPI Render conserve
- Android via `Capacitor` et `APK` direct
- Windows via `Tauri` + toolchain GNU portable
- macOS / iPhone / iPad via web / `PWA` seulement
- aucun positionnement `App Store` ou `Play Store`

## Variables d'environnement frontend

- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_API_URL_ANDROID`
- `NEXT_PUBLIC_API_URL_DESKTOP`
- `NEXT_PUBLIC_ANDROID_CALLBACK_URL`
- `NEXT_PUBLIC_WINDOWS_CALLBACK_URL`
- `NEXT_PUBLIC_ANDROID_DOWNLOAD_URL`
- `NEXT_PUBLIC_WINDOWS_DOWNLOAD_URL`
- `NEXT_PUBLIC_WEB_APP_URL`

Valeurs de depart recommandées :

- `NEXT_PUBLIC_API_URL_ANDROID=https://flare-backend-ab5h.onrender.com`
- `NEXT_PUBLIC_API_URL_DESKTOP=https://flare-backend-ab5h.onrender.com`
- `NEXT_PUBLIC_ANDROID_CALLBACK_URL=flareai://oauth/android`
- `NEXT_PUBLIC_WINDOWS_CALLBACK_URL=flareai://oauth/windows`
- `NEXT_PUBLIC_ANDROID_DOWNLOAD_URL=https://flareai.ramsflare.com/downloads/flare-ai-android.apk`
- `NEXT_PUBLIC_WINDOWS_DOWNLOAD_URL=https://flareai.ramsflare.com/downloads/flare-ai-windows.exe`
- `NEXT_PUBLIC_WEB_APP_URL=https://flareai.ramsflare.com/app?auth=signup`

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
5. construire l'APK avec `powershell -ExecutionPolicy Bypass -File scripts/build-android-apk.ps1`
6. distribuer l'APK en direct, hors store

## Desktop

Le squelette Tauri est dans [desktop/tauri/src-tauri](../../desktop/tauri/src-tauri).

Il prepare :

- build du frontend avant shell Windows
- copie du shell dans un workspace neutre pour eviter le chemin avec apostrophe
- compilation `x86_64-pc-windows-gnu` sans Visual Studio
- ouverture shell externe
- sortie stable dans `desktop/tauri/dist/windows/`
- aucune cible `App Store` pour macOS
- macOS / iPhone restent sur le web / `PWA`

Etapes suivantes hors repo :

1. installer Rust et Tauri CLI
2. installer `w64devkit` dans `%USERPROFILE%\\tools\\w64devkit\\w64devkit`
3. declarer le deep link `flareai://oauth/windows`
4. lancer `powershell -ExecutionPolicy Bypass -File scripts/build-windows-desktop.ps1`
5. valider `desktop/tauri/dist/windows/FLARE AI.exe` sur Windows 11
6. garder macOS hors native, via web / `PWA`

## OAuth

Le backend Facebook supporte maintenant :

- `return_mode=popup` pour le web actuel
- `return_mode=redirect` pour Android APK et Windows Tauri
- `callback_url` bornee aux URLs frontend/natives configurees

Le runtime frontend stocke les resultats OAuth dans le navigateur et nettoie l'URL de retour au chargement.
Pour macOS et iPhone, le flux reste celui du web / PWA, sans wrapper natif ni cible de store.
