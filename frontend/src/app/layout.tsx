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
    default: "FLARE AI - Automatisation business pour TPE/PME a Madagascar",
    template: "%s | FLARE AI",
  },
  description:
    "FLARE AI est une application d'automatisation pour TPE/PME a Madagascar. Aujourd'hui, la preuve concrete la plus visible est le chatbot Facebook assiste, avec paiement local, validation FLARE et support humain.",
  keywords: [
    "FLARE AI",
    "automatisation PME Madagascar",
    "application automatisation business",
    "chatbot Facebook Madagascar",
    "chatbot Messenger PME",
    "augmentation productivite PME",
    "augmentation chiffre affaires PME",
    "activation chatbot assistee",
    "paiement MVola Orange Money",
    "automatisation Facebook PME",
    "support local Madagascar",
    "RAM'S FLARE",
    "ramsflare",
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
    title: "FLARE AI - Automatisation business a Madagascar",
    description:
      "Plateforme d'automatisation business pour TPE/PME a Madagascar. Preuve concrete aujourd'hui: chatbot Facebook assiste, paiement local et activation FLARE.",
    url: "https://flareai.ramsflare.com",
    siteName: "FLARE AI",
    locale: "fr_FR",
    type: "website",
    images: [
      {
        url: "/screenshot.png",
        width: 1200,
        height: 630,
        alt: "FLARE AI - Automatisation business pour TPE/PME a Madagascar",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "FLARE AI - Automatisation business a Madagascar",
    description:
      "Automatisation business pour TPE/PME a Madagascar, avec preuve actuelle sur le chatbot Facebook assiste et paiement local.",
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
    google: "B7f6yC5e8lX5W5aAdPrjukLca7r66PEhUQboVeF1XZs",
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
                "applicationSubCategory": "CustomerServiceApplication",
                "operatingSystem": "Web, iOS, Android",
                "description": "FLARE AI est une application d'automatisation business pour les TPE et PME a Madagascar. Aujourd'hui, la preuve concrete la plus visible est le chatbot Facebook assiste, avec paiement local, validation FLARE et activation accompagnee.",
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
                    "description": "Plan de decouverte FLARE AI en mode assiste"
                  },
                  {
                    "@type": "Offer",
                    "name": "Business",
                    "description": "Plan chatbot Facebook avec activation manuelle assistee par FLARE"
                  }
                ],
                "featureList": [
                  "Automatisation des taches repetitives pour TPE/PME",
                  "Chatbot Facebook Messenger pour TPE/PME",
                  "Activation assistee par l'equipe FLARE",
                  "Paiement manuel local MVola et Orange Money",
                  "Suivi des messages, leads et commandes Messenger",
                  "Support local en francais et malgache"
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
                "description": "RAM'S FLARE developpe FLARE AI, une application d'automatisation business pour TPE/PME a Madagascar, avec une preuve concrete actuelle autour du chatbot Facebook assiste.",
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
