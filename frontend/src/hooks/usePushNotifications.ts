"use client";

import { useEffect, useState } from "react";
import { detectRuntimePlatform } from "@/lib/platform/runtime";
import { getToken } from "firebase/messaging";
import { messaging } from "@/lib/firebase";

export function usePushNotifications() {
  const [pushStatus, setPushStatus] = useState<"idle" | "requesting" | "granted" | "denied" | "error">("idle");
  const [fcmToken, setFcmToken] = useState<string | null>(null);

  // Fonction pour envoyer le token au backend
  const subscribeToBackend = async (token: string, platform: string) => {
    try {
      const response = await fetch("/api/users/push-subscribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token, platform }),
      });
      if (!response.ok) {
        console.error("[Push] Échec de l'enregistrement backend");
      }
    } catch (e) {
      console.error("[Push] Erreur d'enregistrement backend", e);
    }
  };

  const registerPush = async () => {
    setPushStatus("requesting");
    try {
      const platform = detectRuntimePlatform();

      if (platform === "android") {
        // --- CAPACITOR (ANDROID) ---
        const { PushNotifications } = await import("@capacitor/push-notifications");
        let permStatus = await PushNotifications.checkPermissions();

        if (permStatus.receive === 'prompt') {
          permStatus = await PushNotifications.requestPermissions();
        }

        if (permStatus.receive !== 'granted') {
          setPushStatus("denied");
          return;
        }

        // On enregistre les listeners
        await PushNotifications.addListener('registration', (token) => {
          setFcmToken(token.value);
          setPushStatus("granted");
          subscribeToBackend(token.value, platform);
        });

        await PushNotifications.addListener('registrationError', (error) => {
          console.error("[Capacitor Push] Error on registration:", error);
          setPushStatus("error");
        });

        // Demande l'enregistrement
        await PushNotifications.register();

      } else {
        // --- WEB & WINDOWS (TAURI) ---
        // Les deux utilisent le Web Push standard via Firebase JS SDK
        if (!("Notification" in window)) {
          console.warn("[Push] Ce navigateur ne supporte pas les notifications.");
          setPushStatus("error");
          return;
        }

        const permission = await Notification.requestPermission();
        if (permission === "granted") {
          // Attendre que messaging soit initialisé
          if (!messaging) {
            console.warn("[Push] Firebase Messaging non initialisé ou non supporté");
            setPushStatus("error");
            return;
          }
          
          // Le VAPID key devrait être dans les variables d'environnement idéalement
          // Mais firebase.config permet de récupérer le token sans VAPID si configuré dans le projet par défaut
          const token = await getToken(messaging, {
            vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
          });

          if (token) {
            setFcmToken(token);
            setPushStatus("granted");
            subscribeToBackend(token, platform);
          } else {
            console.warn("[Push] Aucun token FCM reçu.");
            setPushStatus("error");
          }
        } else {
          setPushStatus("denied");
        }
      }
    } catch (error) {
      console.error("[Push] Erreur lors de l'initialisation push:", error);
      setPushStatus("error");
    }
  };

  return { registerPush, pushStatus, fcmToken };
}
