import type { Metadata, Viewport } from "next";
import { Instrument_Sans, Outfit } from "next/font/google";
import "./globals.css";
import GlobalBackground from "@/components/GlobalBackground";

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
  title: "RAM'S FLARE",
  description: "Assistant IA pour rechercher, creer, analyser et automatiser plus vite.",
  keywords: ["RAM'S FLARE", "intelligence artificielle", "assistant IA", "multi-agents", "automatisation", "marketing IA"],
  authors: [{ name: "RAM'S FLARE" }],
  creator: "RAM'S FLARE",
  publisher: "RAM'S FLARE",
  metadataBase: new URL("https://flareaios.ramsflare.com"),
  manifest: "/manifest.json",
  /* appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "RAM'S FLARE",
    startupImage: "/br-symbol-v4-512.png",
  }, */
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
    siteName: "RAM'S FLARE",
    locale: "fr_FR",
    type: "website",
    images: [{ url: "/screenshot.png", width: 1200, height: 630, alt: "RAM'S FLARE" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "RAM'S FLARE",
    description: "Plateforme IA de rÃ©fÃ©rence Ã  Madagascar pour automatiser stratÃ©gie, marketing et opÃ©rations.",
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
    <html lang="fr" className="h-full">
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "SoftwareApplication",
              "name": "RAM'S FLARE",
              "applicationCategory": "BusinessApplication",
              "operatingSystem": "Web",
              "description": "Assistant IA pour rechercher, creer, analyser et automatiser plus vite.",
              "url": "https://flareai.ramsflare.com",
              "author": {
                "@type": "Organization",
                "name": "RAM'S FLARE",
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
              console.log('ðŸ” PWA Status: Waiting for signal...');
              if (window.matchMedia('(display-mode: standalone)').matches) {
                console.log('ðŸ“± PWA Status: Already running in standalone mode.');
              }
              window.addEventListener('beforeinstallprompt', (e) => {
                e.preventDefault();
                window.deferredPrompt = e;
                console.log('ðŸ’š PWA EVENT: beforeinstallprompt received!');
                window.dispatchEvent(new CustomEvent('pwa-prompt-ready'));
              });
            `,
          }}
        />
      </head>
      <body className={`${instrumentSans.className} ${outfit.variable} h-full`}>
        <GlobalBackground />
        {children}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (async function() {
                if (!('serviceWorker' in navigator)) return;
                var SW_VERSION = 'v14';
                var lastVersion = localStorage.getItem('flare-sw-version');
                if (lastVersion !== SW_VERSION) {
                  console.log('ðŸ”„ SW version changed, cleaning...');
                  var regs = await navigator.serviceWorker.getRegistrations();
                  for (var i = 0; i < regs.length; i++) await regs[i].unregister();
                  var cacheNames = await caches.keys();
                  await Promise.all(cacheNames.map(function(n) { return caches.delete(n); }));
                  localStorage.setItem('flare-sw-version', SW_VERSION);
                  console.log('âœ… SW cache cleaned, reloading...');
                  if (lastVersion) { window.location.reload(); return; }
                }
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js').then(function(reg) {
                    if (reg && typeof reg.update === 'function') {
                      reg.update().catch(function(error) {
                        console.warn('SW update skipped', error);
                      });
                    }
                    console.log('âœ… SW Registered ('+SW_VERSION+')');
                  }).catch(function(error) {
                    console.warn('SW registration skipped', error);
                  });
                });
              })();
            `,
          }}
        />
      </body>
    </html>
  );
}

