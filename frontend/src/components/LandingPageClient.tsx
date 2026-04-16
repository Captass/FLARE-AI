"use client";

/**
 * LandingPageClient — Client wrapper for LandingPage.
 * Provides the onStart handler via Next.js router.
 * Needed because page.tsx is a Server Component and can't pass functions as props.
 */
import { useRouter } from "next/navigation";
import LandingPagePublicBeta from "./LandingPagePublicBeta";

export default function LandingPageClient() {
  const router = useRouter();

  const handleStart = (mode: "login" | "signup") => {
    // Redirect to /app with auth intent in the URL
    router.push(`/app?auth=${mode}`);
  };

  return <LandingPagePublicBeta onStart={handleStart} />;
}
