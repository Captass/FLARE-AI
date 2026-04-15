"use client";

/**
 * SpaLoader — Invisible client component.
 * Runs after hydration: if the user is already logged in, silently redirects to /app.
 * Google never sees this — it only runs in the browser after JS loads.
 */
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";

export default function SpaLoader() {
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        // User is logged in → redirect to the authenticated app
        router.replace("/app");
      }
    });
    return () => unsubscribe();
  }, [router]);

  // Renders nothing — purely behavioral
  return null;
}
