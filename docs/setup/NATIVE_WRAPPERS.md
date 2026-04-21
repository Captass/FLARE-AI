# Native wrappers FLARE AI

Derniere mise a jour : 21 avril 2026

Ce document fixe la distribution native v1 de FLARE AI :

- frontend web exporte statiquement via Next.js
- backend FastAPI conserve sur Render
- Android distribue en APK release signe
- Windows distribue en installateur NSIS `.exe`
- macOS / iPhone / iPad restent en web app / PWA
- les binaires publics sont heberges sur GitHub Releases
- les URLs publiques stables restent sur `https://flareai.ramsflare.com/downloads/...`

## Source de verite

- web : `https://flareai.ramsflare.com`
- URL stable Android : `https://flareai.ramsflare.com/downloads/android`
- URL stable Windows : `https://flareai.ramsflare.com/downloads/windows`
- binaires reels : assets GitHub Releases

Les pages `/downloads/android` et `/downloads/windows` sont des pages statiques exportables qui redirigent vers l'asset release configure et affichent un fallback manuel.

## Variables frontend

Variables minimales :

- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_API_URL_ANDROID`
- `NEXT_PUBLIC_API_URL_DESKTOP`
- `NEXT_PUBLIC_ANDROID_CALLBACK_URL`
- `NEXT_PUBLIC_WINDOWS_CALLBACK_URL`
- `NEXT_PUBLIC_ANDROID_DOWNLOAD_URL`
- `NEXT_PUBLIC_WINDOWS_DOWNLOAD_URL`
- `NEXT_PUBLIC_WEB_APP_URL`

Variables optionnelles d'affichage :

- `NEXT_PUBLIC_ANDROID_RELEASE_VERSION`
- `NEXT_PUBLIC_ANDROID_RELEASE_DATE`
- `NEXT_PUBLIC_WINDOWS_RELEASE_VERSION`
- `NEXT_PUBLIC_WINDOWS_RELEASE_DATE`

Valeurs recommandees :

- `NEXT_PUBLIC_ANDROID_CALLBACK_URL=flareai://oauth/android`
- `NEXT_PUBLIC_WINDOWS_CALLBACK_URL=flareai://oauth/windows`
- `NEXT_PUBLIC_ANDROID_DOWNLOAD_URL=https://github.com/<org>/<repo>/releases/download/<tag>/flare-ai-android.apk`
- `NEXT_PUBLIC_WINDOWS_DOWNLOAD_URL=https://github.com/<org>/<repo>/releases/download/<tag>/flare-ai-windows-setup.exe`
- `NEXT_PUBLIC_WEB_APP_URL=https://flareai.ramsflare.com/app?auth=signup`

## Variables backend

- `NATIVE_CORS_ORIGINS=capacitor://localhost,tauri://localhost,http://tauri.localhost`
- `NATIVE_ANDROID_CALLBACK_URL=flareai://oauth/android`
- `NATIVE_WINDOWS_CALLBACK_URL=flareai://oauth/windows`

## Android

Le wrapper Android repose sur Capacitor.

Points importants implementes :

- `launchMode="singleTask"`
- deep link `flareai://oauth/android`
- ouverture OAuth via navigateur systeme
- reprise du callback via `App.getLaunchUrl()` et `appUrlOpen`
- build release bloque si la signature n'est pas configuree

Build local :

```powershell
cd frontend
npm run android:apk:release
```

Variables de signature requises :

- `FLARE_ANDROID_KEYSTORE_PATH`
- `FLARE_ANDROID_KEYSTORE_PASSWORD`
- `FLARE_ANDROID_KEY_ALIAS`
- `FLARE_ANDROID_KEY_PASSWORD`

Artefact local genere :

- `artifacts/native/android/flare-ai-android.apk`

## Windows

Le wrapper Windows repose sur Tauri.

Points importants implementes :

- build du frontend exporte avant bundling
- bundle public NSIS uniquement
- deep link `flareai://oauth/windows`
- enregistrement du protocole `flareai://` au lancement
- sortie stable dans un dossier d'artefacts non versionne

Build local :

```powershell
cd frontend
npm run desktop:build
```

Artefact local genere :

- `artifacts/native/windows/flare-ai-windows-setup.exe`

## OAuth natif

Le backend Facebook supporte :

- `return_mode=popup` pour le web
- `return_mode=redirect` pour Android et Windows
- `callback_url` borne aux URLs frontend / natives configurees

Le frontend consomme :

- les resultats OAuth retour web via query params
- les callbacks Android via `flareai://oauth/android`
- les callbacks Windows via `flareai://oauth/windows`

## Pipeline GitHub Releases

Le workflow `.github/workflows/native-release.yml` :

- s'execute manuellement via `workflow_dispatch`
- s'execute aussi sur un tag `v*`
- build l'APK Android release signe
- build l'installateur Windows NSIS
- publie les deux assets sur GitHub Releases

Secrets GitHub requis :

- `FLARE_ANDROID_KEYSTORE_BASE64`
- `FLARE_ANDROID_KEYSTORE_PASSWORD`
- `FLARE_ANDROID_KEY_ALIAS`
- `FLARE_ANDROID_KEY_PASSWORD`

Variables GitHub optionnelles :

- `FLARE_ANDROID_DEEPLINK_SCHEME`
- `FLARE_ANDROID_DEEPLINK_HOST`
- `FLARE_ANDROID_DEEPLINK_PATH`
- `FLARE_ANDROID_DEEPLINK_WEB_HOST`

## A ne pas faire

- ne pas versionner les binaires dans `frontend/public`
- ne pas pousser `desktop/tauri/dist` ou `artifacts/`
- ne pas presenter macOS / iPhone comme des apps natives store
