"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * SpaLoader
 * Checks auth only after hydration and lazy-loads Firebase/Auth
 * so the public landing does not pay that cost on first render.
 */
export default function SpaLoader() {
  const router = useRouter();

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let cancelled = false;

    const loadAuthCheck = async () => {
      const [{ onAuthStateChanged }, { auth }] = await Promise.all([
        import("firebase/auth"),
        import("@/lib/firebase"),
      ]);

      if (cancelled) return;

      unsubscribe = onAuthStateChanged(auth, (user) => {
        if (user) {
          router.replace("/app");
        }
      });
    };

    void loadAuthCheck();

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [router]);

  return null;
}
