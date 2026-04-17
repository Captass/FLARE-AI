/**
 * page.tsx — Route publique "/" (Landing Page)
 *
 * Server Component : Next.js pré-rend ce HTML au build.
 * Google reçoit tout le contenu texte, les headings H1/H2/H3 et le Schema JSON-LD.
 *
 * SpaLoader : composant client invisible qui redirige les utilisateurs
 * déjà connectés vers /app, de façon transparente côté navigateur.
 */
import LandingPageClient from "@/components/LandingPageClient";
import dynamic from "next/dynamic";

const SpaLoader = dynamic(() => import("@/components/SpaLoader"), {
  ssr: false,
  loading: () => null,
});

export default function HomePage() {
  return (
    <>
      {/*
        SpaLoader runs only in the browser (client-side).
        If the user is already authenticated → redirect to /app silently.
        Google never sees this — it only executes after JS hydration.
      */}
      <SpaLoader />

      {/*
        LandingPageClient is a Client Component, but Next.js static export
        pre-renders its full HTML at build time (SSG).
        → Google reads all the text, headings, CTAs, testimonials, pricing.
        → Animations (Framer Motion, Spline) hydrate after the JS loads.
        → Zero visual change for real users.
      */}
      <LandingPageClient />
    </>
  );
}
