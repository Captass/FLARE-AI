import type { Metadata, Viewport } from "next";
import { Instrument_Sans, Outfit } from "next/font/google";
import "./globals.css";
import GlobalBackground from "@/components/GlobalBackground";
import { getThemeInitScript } from "@/lib/theme";

const instrumentSans = Instrument_Sans({ 
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"]
});

const outfit = Outfit({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  variable: "--font-outfit",
});

export const metadata: Metadata = {
  title: {
    default: "FLARE AI — Assistant IA & Chatbot Facebook à Madagascar",
    template: "%s | FLARE AI",
  },
  description:
    "FLARE AI est la plateforme d'intelligence artificielle de référence à Madagascar. Assistant IA multi-agents, chatbot Facebook Messenger automatisé, génération de contenu, recherche web et automatisation pour les entreprises africaines.",
  keywords: [
    "FLARE AI",
    "assistant IA Madagascar",
    "intelligence artificielle Madagascar",
    "chatbot Facebook Madagascar",
    "chatbot Messenger automatisé",
    "automatisation IA entreprise",
    "outil IA marketing Madagascar",
    "plateforme IA Afrique",
    "RAM'S FLARE",
    "ramsflare",
    "IA générative Madagascar",
    "agent IA",
  ],
  authors: [{ name: "RAM'S FLARE", url: "https://flareai.ramsflare.com" }],
  creator: "RAM'S FLARE",
  publisher: "RAM'S FLARE",
  metadataBase: new URL("https://flareai.ramsflare.com"),
  alternates: {
    canonical: "https://flareai.ramsflare.com",
  },
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/favicon-v4.ico", type: "image/x-icon" },
      { url: "/app-icon.svg", type: "image/svg+xml" },
    ],
    apple: "/br-symbol-v4-192.png",
    other: [
      { rel: "icon", type: "image/png", sizes: "192x192", url: "/br-symbol-v4-192.png" },
      { rel: "icon", type: "image/png", sizes: "512x512", url: "/br-symbol-v4-512.png" },
    ],
  },
  openGraph: {
    title: "FLARE AI — Assistant IA & Chatbot Facebook à Madagascar",
    description:
      "Plateforme d'intelligence artificielle de référence à Madagascar. Automatisez votre marketing, vos ventes et vos opérations grâce à FLARE AI.",
    url: "https://flareai.ramsflare.com",
    siteName: "FLARE AI",
    locale: "fr_FR",
    type: "website",
    images: [
      {
        url: "/screenshot.png",
        width: 1200,
        height: 630,
        alt: "FLARE AI — Assistant IA & Chatbot Facebook Madagascar",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "FLARE AI — Assistant IA & Chatbot Facebook à Madagascar",
    description:
      "La plateforme IA de référence à Madagascar. Chatbot Messenger, assistant multi-agents, automatisation marketing.",
    creator: "@ramsflare",
    images: ["/screenshot.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-snippet": -1,
      "max-image-preview": "large",
      "max-video-preview": -1,
    },
  },
  verification: {
    // À compléter avec la valeur fournie par Google Search Console
    // google: "VOTRE_CODE_VERIFICATION_ICI",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
    { media: "(prefers-color-scheme: light)", color: "#fcfcfd" },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" className="h-full" suppressHydrationWarning>
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <script
          dangerouslySetInnerHTML={{
            __html: getThemeInitScript(),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify([
              {
                "@context": "https://schema.org",
                "@type": "SoftwareApplication",
                "name": "FLARE AI",
                "alternateName": ["Flare AI", "FLARE", "RAM'S FLARE AI"],
                "applicationCategory": "BusinessApplication",
                "applicationSubCategory": "ArtificialIntelligenceApplication",
                "operatingSystem": "Web, iOS, Android",
                "description": "FLARE AI est la plateforme d'intelligence artificielle de référence à Madagascar. Assistant IA multi-agents, chatbot Facebook Messenger automatisé, génération de contenu, recherche web et automatisation pour les entreprises africaines.",
                "url": "https://flareai.ramsflare.com",
                "screenshot": "https://flareai.ramsflare.com/screenshot.png",
                "softwareVersion": "4.0",
                "inLanguage": ["fr", "mg"],
                "author": {
                  "@type": "Organization",
                  "name": "RAM'S FLARE",
                  "url": "https://flareai.ramsflare.com",
                  "logo": {
                    "@type": "ImageObject",
                    "url": "https://flareai.ramsflare.com/logo-flare-ai.png",
                    "width": 200,
                    "height": 60
                  },
                  "areaServed": [
                    { "@type": "Country", "name": "Madagascar" },
                    { "@type": "Continent", "name": "Africa" }
                  ],
                  "foundingDate": "2024",
                  "sameAs": [
                    "https://www.facebook.com/ramsflare",
                    "https://ramsflare.com"
                  ]
                },
                "offers": [
                  {
                    "@type": "Offer",
                    "name": "Starter",
                    "price": "0",
                    "priceCurrency": "EUR",
                    "description": "Plan gratuit avec accès aux fonctionnalités de base"
                  },
                  {
                    "@type": "Offer",
                    "name": "Pro",
                    "description": "Plan professionnel avec chatbot Facebook et fonctionnalités avancées"
                  }
                ],
                "featureList": [
                  "Assistant IA multi-agents",
                  "Chatbot Facebook Messenger automatisé",
                  "Génération d'images et vidéos par IA",
                  "Recherche web intelligente",
                  "Génération de documents Word et Excel",
                  "Automatisation marketing",
                  "Gestion des commandes Messenger"
                ]
              },
              {
                "@context": "https://schema.org",
                "@type": "Organization",
                "name": "RAM'S FLARE",
                "alternateName": "FLARE AI",
                "url": "https://flareai.ramsflare.com",
                "logo": {
                  "@type": "ImageObject",
                  "url": "https://flareai.ramsflare.com/logo-flare-ai.png"
                },
                "description": "RAM'S FLARE développe FLARE AI, la plateforme d'intelligence artificielle de référence à Madagascar.",
                "areaServed": [
                  { "@type": "Country", "name": "Madagascar" }
                ],
                "foundingDate": "2024",
                "sameAs": [
                  "https://www.facebook.com/ramsflare",
                  "https://ramsflare.com"
                ],
                "contactPoint": {
                  "@type": "ContactPoint",
                  "contactType": "customer support",
                  "email": "contact@ramsflare.com",
                  "availableLanguage": ["French", "Malagasy"]
                }
              }
            ]),
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.deferredPrompt = null;
              window.addEventListener('beforeinstallprompt', (e) => {
                e.preventDefault();
                window.deferredPrompt = e;
                window.dispatchEvent(new CustomEvent('pwa-prompt-ready'));
              });
            `,
          }}
        />
      </head>
      <body className={`${instrumentSans.className} ${outfit.variable} h-full`}>
        <GlobalBackground />
        {children}
      </body>
    </html>
  );
}
