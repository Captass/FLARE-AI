"use client";

import { useState, useEffect, useCallback } from "react";
import { 
  User, 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signInWithPopup,
  signInWithRedirect,
  GoogleAuthProvider, 
  signOut,
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink,
  sendPasswordResetEmail,
  sendEmailVerification
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import { sendVerificationPin, verifyEmailPin } from "@/lib/api";

export interface AuthState {
  user: User | null;
  token: string | null;
  loading: boolean;
  error: string | null;
  getFreshToken: (forceRefresh?: boolean) => Promise<string | null>;
  login: (email: string) => Promise<void>;
  loginWithPassword: (email: string, password: string) => Promise<void>;
  signUpWithPassword: (email: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  sendSignupPin: (email: string) => Promise<{ dev_pin?: string }>;
  verifySignupPin: (email: string, pin: string) => Promise<void>;
}

function translateFirebaseError(code: string): string {
  const map: Record<string, string> = {
    "auth/wrong-password": "Mot de passe incorrect.",
    "auth/user-not-found": "Aucun compte associé à cet email.",
    "auth/email-already-in-use": "Cet email est déjà utilisé par un autre compte.",
    "auth/weak-password": "Le mot de passe doit contenir au moins 6 caractères.",
    "auth/invalid-email": "Adresse email invalide.",
    "auth/too-many-requests": "Trop de tentatives. Réessayez dans quelques minutes.",
    "auth/popup-closed-by-user": "La fenêtre de connexion a été fermée.",
    "auth/popup-blocked": "Le navigateur a bloqué la fenêtre Google. Réessayez ou autorisez les popups.",
    "auth/unauthorized-domain": "Ce domaine n'est pas encore autorisé dans Firebase Auth.",
    "auth/network-request-failed": "Erreur réseau. Vérifiez votre connexion internet.",
    "auth/invalid-credential": "Email ou mot de passe incorrect.",
    "auth/user-disabled": "Ce compte a été désactivé.",
    "auth/operation-not-allowed": "Cette méthode de connexion n'est pas activée.",
    "auth/operation-not-supported-in-this-environment": "La connexion Google n'est pas supportée par ce navigateur dans ce contexte.",
    "auth/email-not-verified": "Vérifiez votre email avant de vous connecter. Un nouveau mail de vérification a été envoyé.",
    "auth/expired-action-code": "Ce lien a expiré. Veuillez en demander un nouveau.",
    "auth/invalid-action-code": "Ce lien est invalide ou a déjà été utilisé.",
  };
  return map[code] || "Une erreur est survenue. Veuillez réessayer.";
}

export function useAuth(): AuthState {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const getFreshToken = useCallback(async (forceRefresh = false): Promise<string | null> => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      setToken(null);
      return null;
    }

    try {
      const nextToken = await currentUser.getIdToken(forceRefresh);
      setToken(nextToken);
      return nextToken;
    } catch (nextError) {
      console.error("Failed to resolve Firebase token:", nextError);
      return token;
    }
  }, [token]);

  useEffect(() => {
    let mounted = true;
    let refreshInterval: ReturnType<typeof setInterval> | null = null;

    // S'abonner aux changements d'état d'authentification
    const unsubscribe = onAuthStateChanged(auth, async (currentUser: User | null) => {
      if (!mounted) return;
      setUser(currentUser);
      if (currentUser) {
        const idToken = await currentUser.getIdToken();
        if (mounted) setToken(idToken);
        // Rafraîchir le token toutes les 50 minutes (expire après 60 min)
        if (refreshInterval) clearInterval(refreshInterval);
        refreshInterval = setInterval(async () => {
          try {
            const freshToken = await currentUser.getIdToken(true);
            if (mounted) setToken(freshToken);
          } catch (e) {
            console.error("Token refresh failed:", e);
          }
        }, 50 * 60 * 1000);
      } else {
        setToken(null);
        if (refreshInterval) { clearInterval(refreshInterval); refreshInterval = null; }
      }
      setLoading(false);
    });

    // Gestion du lien magique (Email Link) au chargement
    if (isSignInWithEmailLink(auth, window.location.href)) {
      const email = window.localStorage.getItem('emailForSignIn');
      if (email) {
        signInWithEmailLink(auth, email, window.location.href)
          .then(() => {
            window.localStorage.removeItem('emailForSignIn');
          })
          .catch((err) => {
            if (mounted) setError(translateFirebaseError(err.code));
          });
      }
    }

    return () => { mounted = false; unsubscribe(); if (refreshInterval) clearInterval(refreshInterval); };
  }, []);

  const login = useCallback(async (email: string) => {
    setError(null);
    setLoading(true);
    try {
      const actionCodeSettings = {
        url: window.location.origin,
        handleCodeInApp: true,
      };
      await sendSignInLinkToEmail(auth, email, actionCodeSettings);
      window.localStorage.setItem('emailForSignIn', email);
    } catch (e: any) {
      setError(translateFirebaseError(e.code));
    } finally {
      setLoading(false);
    }
  }, []);

  const loginWithPassword = useCallback(async (email: string, password: string) => {
    setError(null);
    setLoading(true);
    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      if (!result.user.emailVerified) {
        sendEmailVerification(result.user).catch(() => {});
        await signOut(auth);
        const err = new Error("Email non vérifié");
        (err as any).code = "auth/email-not-verified";
        throw err;
      }
    } catch (e: any) {
      setError(translateFirebaseError(e.code));
    } finally {
      setLoading(false);
    }
  }, []);

  const signUpWithPassword = useCallback(async (email: string, password: string) => {
    setError(null);
    setLoading(true);
    try {
      const result = await createUserWithEmailAndPassword(auth, email, password);
      await sendEmailVerification(result.user);
      if (typeof window !== "undefined") {
        window.sessionStorage.setItem("flare_signup_verification_email", email);
      }
      await signOut(auth);
    } catch (e: any) {
      setError(translateFirebaseError(e.code));
    } finally {
      setLoading(false);
    }
  }, []);

  const loginWithGoogle = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      await signInWithPopup(auth, provider);
    } catch (e: any) {
      const code = e?.code || "";
      if (
        code === "auth/popup-blocked" ||
        code === "auth/cancelled-popup-request" ||
        code === "auth/operation-not-supported-in-this-environment"
      ) {
        try {
          const provider = new GoogleAuthProvider();
          provider.setCustomParameters({ prompt: "select_account" });
          await signInWithRedirect(auth, provider);
          return;
        } catch (redirectError: any) {
          setError(translateFirebaseError(redirectError.code));
          return;
        }
      }
      setError(translateFirebaseError(code));
    } finally {
      setLoading(false);
    }
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    setError(null);
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (e: any) {
      setError(translateFirebaseError(e.code));
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    await signOut(auth);
  }, []);

  const sendSignupPin = useCallback(async (email: string): Promise<{ dev_pin?: string }> => {
    setError(null);
    try {
      const res = await sendVerificationPin(email);
      return { dev_pin: res.dev_pin };
    } catch (e: any) {
      setError(e.message || "Erreur lors de l'envoi du code");
      throw e;
    }
  }, []);

  const verifySignupPin = useCallback(async (email: string, pin: string): Promise<void> => {
    setError(null);
    try {
      await verifyEmailPin(email, pin);
    } catch (e: any) {
      setError(e.message || "Code incorrect");
      throw e;
    }
  }, []);

  return { user, token, loading, error, getFreshToken, login, loginWithPassword, signUpWithPassword, loginWithGoogle, resetPassword, logout, sendSignupPin, verifySignupPin };
}
