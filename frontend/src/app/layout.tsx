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
  title: "FLARE AI",
  description: "Assistant IA pour rechercher, creer, analyser et automatiser plus vite.",
  keywords: ["FLARE AI", "intelligence artificielle", "assistant IA", "multi-agents", "automatisation", "marketing IA"],
  authors: [{ name: "FLARE AI" }],
  creator: "FLARE AI",
  publisher: "FLARE AI",
  metadataBase: new URL("https://flareaios.ramsflare.com"),
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/app-icon.svg", type: "image/svg+xml" }
    ],
    apple: "/app-icon.svg",
  },
  openGraph: {
    title: "FLARE AI",
    description: "Assistant IA pour rechercher, creer, analyser et automatiser plus vite.",
    url: "https://flareai.ramsflare.com",
    siteName: "FLARE AI",
    locale: "fr_FR",
    type: "website",
    images: [{ url: "/screenshot.png", width: 1200, height: 630, alt: "FLARE AI" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "FLARE AI",
    description: "Plateforme IA de référence à Madagascar pour automatiser stratégie, marketing et opérations.",
    creator: "@ramsflare",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
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
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "SoftwareApplication",
              "name": "FLARE AI",
              "applicationCategory": "BusinessApplication",
              "operatingSystem": "Web",
              "description": "Assistant IA pour rechercher, creer, analyser et automatiser plus vite.",
              "url": "https://flareai.ramsflare.com",
              "author": {
                "@type": "Organization",
                "name": "FLARE AI",
                "url": "https://flareai.ramsflare.com"
              },
              "offers": {
                "@type": "Offer",
                "price": "0",
                "priceCurrency": "EUR"
              }
            }),
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
