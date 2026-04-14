"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { ArrowDown, ArrowRight, Zap, MessageSquare, BarChart3, Bot, Menu, X, Download } from "lucide-react";
import { motion, useSpring, useTransform, useScroll, useMotionValueEvent, AnimatePresence } from "framer-motion";
import Spline from "@splinetool/react-spline";
import React from "react";
import FlareMark from "./FlareMark";
import ThemeToggle from "@/components/ui/ThemeToggle";
import type { ThemePreference } from "@/lib/theme";

/* Tiny error boundary so a Spline crash doesn't kill the page */
class SplineBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(err: Error) { console.warn("[Spline]", err.message); }
  render() {
    if (this.state.hasError) return <div className="landing-spline-fallback w-full h-full bg-[#020305]" />;
    return this.props.children;
  }
}

interface LandingPageProps {
  onStart: (mode: "login" | "signup", prompt?: string) => void;
  theme: ThemePreference;
  onToggleTheme: () => void;
}

export default function LandingPage({ onStart, theme, onToggleTheme }: LandingPageProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const [isLoaded, setIsLoaded] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [splineApp, setSplineApp] = useState<any>(null);
  const [canInstall, setCanInstall] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const { scrollY, scrollYProgress } = useScroll();

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    const frame = window.requestAnimationFrame(() => setIsLoaded(true));
    if (window.innerWidth < 1024) {
      setIsLoaded(true);
    }
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', checkMobile);
    };
  }, []);

  useMotionValueEvent(scrollY, "change", (latest) => {
    setIsScrolled(latest > 100);
  });

  useEffect(() => {
    if ((window as any).deferredPrompt) {
      setCanInstall(true);
    }

    const handlePrompt = () => setCanInstall(true);
    const handleCustomPrompt = () => setCanInstall(true);

    window.addEventListener("beforeinstallprompt", handlePrompt);
    window.addEventListener("pwa-prompt-ready", handleCustomPrompt);

    return () => {
      window.removeEventListener("beforeinstallprompt", handlePrompt);
      window.removeEventListener("pwa-prompt-ready", handleCustomPrompt);
    };
  }, []);

  useEffect(() => {
    document.body.classList.add("is-public-landing");
    return () => {
      document.body.classList.remove("is-public-landing");
    };
  }, []);

  const handleInstallClick = async () => {
    const prompt = (window as any).deferredPrompt;
    if (prompt) {
      prompt.prompt();
      const { outcome } = await prompt.userChoice;
      if (outcome === 'accepted') {
        (window as any).deferredPrompt = null;
        setCanInstall(false);
      }
    } else {
      alert("Pour installer FLARE AI :\n• Sur mobile : utilisez Ajouter a l ecran d accueil.\n• Sur PC : utilisez l option d installation dans la barre d adresse.");
    }
  };

  const springX = useSpring(0, { stiffness: 150, damping: 20 });
  const springY = useSpring(0, { stiffness: 150, damping: 20 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const x = (e.clientX / window.innerWidth - 0.5) * 2;
      const y = (e.clientY / window.innerHeight - 0.5) * 2;
      springX.set(x);
      springY.set(y);
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [springX, springY]);

  useEffect(() => {
    const updateSpline = () => {
      const x = springX.get();
      const y = springY.get();

      if (splineApp) {
        const head = splineApp.findObjectByName("Head");
        const eyeL = splineApp.findObjectByName("Eye_L") || splineApp.findObjectByName("Eye Left");
        const eyeR = splineApp.findObjectByName("Eye_R") || splineApp.findObjectByName("Eye Right");

        if (head) {
          head.rotation.y = x * 0.8;
          head.rotation.x = y * 0.4;
        }
        if (eyeL) {
          eyeL.rotation.y = x * 0.4;
          eyeL.rotation.x = y * 0.2;
        }
        if (eyeR) {
          eyeR.rotation.y = x * 0.4;
          eyeR.rotation.x = y * 0.2;
        }
      }
    };

    const unsubX = springX.on("change", updateSpline);
    const unsubY = springY.on("change", updateSpline);

    return () => {
      unsubX();
      unsubY();
    };
  }, [springX, springY, splineApp]);

  const rotateX = useTransform(springY, (v) => v * -1.5);
  const rotateY = useTransform(springX, (v) => v * 1.5);
  const mousePosX = useTransform(springX, (v) => (v + 1) * 50 + "%");
  const mousePosY = useTransform(springY, (v) => (v + 1) * 50 + "%");

  const logoParallaxX = useTransform(springX, (v) => v * 6);
  const logoParallaxY = useTransform(springY, (v) => v * 6);

  function onLoad(app: any) {
    if (!app) return;
    setSplineApp(app);
    try {
      if (isMobile && app.renderer) {
        app.renderer.setPixelRatio(0.75);
      }

      const allObjects = app.getAllObjects();
      if (allObjects) {
        allObjects.forEach((obj: any) => {
          if (isMobile && obj.shadow) {
            obj.castShadow = false;
            obj.receiveShadow = false;
          }
          if (obj && obj.text !== undefined) obj.visible = false;
        });
      }
    } catch (e) {
      console.warn("Spline onLoad manipulation failed:", e);
    }
    setIsLoaded(true);
  }

  /* ── Metrics visibles sur le hero ── */
  const METRICS = [
    { value: "24/7", label: "ton bot répond" },
    { value: "15 min", label: "pour l'activer" },
    { value: "0", label: "technicien requis" },
  ];

  /* ── Cas d'usage orientés business ── */
  const USE_CASES = [
    {
      icon: MessageSquare,
      title: "Tu réponds à tes prospects 24/7",
      description: "FLARE AI répond aux messages Facebook, qualifie les prospects et relance automatiquement. Tu rates moins de ventes.",
      cta: "Activer le chatbot",
      prompt: "Configure mon chatbot Facebook pour répondre aux clients automatiquement",
    },
    {
      icon: Zap,
      title: "Tu crées tes contenus en quelques minutes",
      description: "Posts, emails, propositions et visuels : tu demandes, FLARE AI génère. Tu publies plus vite, sans blocage.",
      cta: "Créer maintenant",
      prompt: "Rédige un post Facebook accrocheur pour promouvoir mes services",
    },
    {
      icon: BarChart3,
      title: "Tu vois ce qui rapporte en temps réel",
      description: "Leads, conversions, coût et revenus au même endroit. Tu décides vite, avec des chiffres clairs.",
      cta: "Voir les chiffres",
      prompt: "Montre-moi un résumé de mes performances commerciales",
    },
  ];

  /* ── Avantages concrets ── */
  const ADVANTAGES = [
    { number: "01", title: "Zéro configuration", text: "Tu connectes ta page Facebook et c'est parti. Pas de code, pas de formation." },
    { number: "02", title: "Ton IA, ton ton", text: "Elle apprend ta façon de parler, ton offre et tes prix. Chaque réponse sonne comme toi." },
    { number: "03", title: "Résultats mesurables", text: "Tu suis tes leads, tes ventes et ton ROI en temps réel depuis un seul écran." },
    { number: "04", title: "Fonctionne non-stop", text: "Pendant que tu dors, ton IA répond, qualifie et relance. 24h/24, 7j/7." },
  ];

  return (
    <div
      ref={containerRef}
      id="hero"
      className="landing-theme-scope landing-shell relative w-full h-screen overflow-y-auto no-scrollbar font-sans select-none"
    >
      {/* ── Sticky Navbar ── */}
      <AnimatePresence>
        {isScrolled && (
          <motion.nav
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -100, opacity: 0 }}
            className="landing-nav fixed top-0 left-0 right-0 z-[60] mx-4 mt-4 flex items-center justify-between rounded-3xl border-b border-white/5 px-6 py-4 glass"
          >
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => document.getElementById('hero')?.scrollTo({ top: 0, behavior: 'smooth' })}>
              <div className="landing-mark-chip flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/5 backdrop-blur-md">
                <FlareMark tone="auto" className="w-[18px]" />
              </div>
              <span className="landing-brand-title hidden uppercase sm:block">FLARE AI</span>
            </div>

            <div className="hidden md:flex items-center gap-8">
              {[
                { label: "Accueil", id: "hero" },
                { label: "Solutions", id: "solutions" },
                { label: "Offres", id: "pricing" },
                { label: "Notre histoire", id: "story" },
              ].map((link) => (
                <button
                  key={link.id}
                  onClick={() => {
                    const el = document.getElementById(link.id);
                    if (el) el.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="landing-nav-link text-[10px] uppercase transition-colors font-medium pb-1"
                >
                  {link.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-4">
              <ThemeToggle theme={theme} onToggle={onToggleTheme} className="landing-theme-toggle" />
              <button
                onClick={() => onStart("login")}
                className="landing-plain-button text-[10px] uppercase font-medium hidden sm:block"
              >
                Se connecter
              </button>
              <button
                onClick={() => onStart("signup")}
                className="landing-nav-cta px-5 py-2.5 bg-orange-500 text-[10px] font-medium uppercase rounded-full transition-all shadow-lg shadow-orange-500/20"
              >
                Commencer
              </button>
              <button className="landing-mobile-trigger md:hidden" onClick={() => setMobileMenuOpen(true)}>
                <Menu size={20} />
              </button>
            </div>
          </motion.nav>
        )}
      </AnimatePresence>

      {/* ── Mobile Menu ── */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            className="landing-mobile-menu fixed inset-0 z-[70] flex flex-col gap-8 p-8"
          >
            <button className="landing-mobile-trigger self-end" onClick={() => setMobileMenuOpen(false)}>
              <X size={32} />
            </button>
            <nav className="flex flex-col gap-6 mt-12">
              {[
                { label: "Accueil", id: "hero" },
                { label: "Solutions", id: "solutions" },
                { label: "Offres", id: "pricing" },
                { label: "Notre histoire", id: "story" },
              ].map((link) => (
                <button
                  key={link.id}
                  onClick={() => {
                    const el = document.getElementById(link.id);
                    if (el) el.scrollIntoView({ behavior: 'smooth' });
                    setMobileMenuOpen(false);
                  }}
                  className="landing-mobile-link text-2xl font-semibold uppercase text-left"
                >
                  {link.label}
                </button>
              ))}
            </nav>
            <div className="landing-mobile-actions mt-auto flex flex-col gap-4 border-t border-white/5 pt-8">
               <ThemeToggle theme={theme} onToggle={onToggleTheme} className="landing-theme-toggle-mobile justify-center" />
               <button onClick={() => onStart("login")} className="landing-mobile-secondary w-full py-4 uppercase border rounded-2xl">Se connecter</button>
               <button onClick={() => onStart("signup")} className="landing-mobile-cta w-full py-4 bg-orange-500 uppercase rounded-2xl">Commencer gratuitement</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Subtle Cursor Glow (orange) ── */}
      <motion.div
        className="fixed inset-0 z-0 pointer-events-none opacity-30"
        style={{
          background: `radial-gradient(circle at var(--mouse-x, 50%) var(--mouse-y, 50%), rgba(249, 115, 22, 0.12) 0%, transparent 40%)`
        } as any}
        animate={{
          "--mouse-x": mousePosX as any,
          "--mouse-y": mousePosY as any
        } as any}
      />

      {/* ── Scroll Progress (Right Edge) ── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: isLoaded ? 1 : 0 }}
        transition={{ delay: 1, duration: 1 }}
        className="fixed right-4 md:right-8 top-[15vh] bottom-[15vh] hidden sm:flex flex-col items-center gap-4 z-50 pointer-events-none"
      >
          <div className="landing-scroll-track relative flex-1 w-[2px] overflow-hidden rounded-full bg-white/5">
          <motion.div
            style={{
              scaleY: scrollYProgress,
              transformOrigin: "top"
            }}
            className="landing-scroll-fill absolute top-0 left-0 h-full w-full bg-gradient-to-b from-white/40 to-white/10"
          />
        </div>

        <motion.div
          animate={{ y: [0, 8, 0], opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          className="flex flex-col items-center gap-2"
        >
          <ArrowDown size={14} className="landing-scroll-arrow" />
        </motion.div>
      </motion.div>

      {/* ══════════════════════════════════════════════════════
          HERO SECTION
         ══════════════════════════════════════════════════════ */}
      <section className="relative w-full h-screen flex flex-col items-center justify-center sm:block">
        {/* 3D Robot Background */}
        <div className="landing-hero-scene absolute inset-0 z-0 opacity-40 grayscale-[80%]">
          <SplineBoundary>
            <Suspense fallback={<div className="landing-spline-fallback w-full h-full bg-[#020305]" />}>
              <Spline
                scene="https://prod.spline.design/JD2om2Ai-FFKwh9D/scene.splinecode"
                onLoad={onLoad}
                className="w-full h-full"
                style={{ pointerEvents: isMobile ? 'none' : 'auto' }}
              />
            </Suspense>
          </SplineBoundary>
        </div>

        {/* Header */}
        <div className="relative z-10 w-full flex flex-col px-6 pt-2 pb-4 sm:px-16 sm:pt-0 sm:pb-6 md:px-24">
          <motion.header
            initial={{ opacity: 0 }}
            animate={{ opacity: isLoaded ? 1 : 0 }}
            transition={{ duration: 1.5, delay: 0.5 }}
            className="flex items-center justify-between w-full"
          >
            <div className="flex items-center gap-2 md:gap-4 group cursor-pointer">
              <motion.div
                style={{ x: logoParallaxX, y: logoParallaxY }}
                className="relative flex h-14 w-14 items-center justify-center transition-all duration-700 group-hover:scale-110 md:h-24 md:w-24"
              >
                <div className="landing-mark-frame absolute inset-0 rounded-[30%] border border-white/10 bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.12),rgba(255,255,255,0.03)_55%,transparent_100%)] shadow-[0_0_50px_rgba(255,255,255,0.08)]" />
                <FlareMark tone="auto" className="w-8 md:w-14" priority />
              </motion.div>
              <div className="flex flex-col justify-center">
                <span className="landing-brand-title text-lg md:text-3xl uppercase leading-none">FLARE AI</span>
                <span className="landing-brand-subtitle mt-1 uppercase md:mt-3">Ton business, en pilote automatique</span>
              </div>
            </div>

            <div className="flex items-center gap-2 md:gap-5 cursor-auto pointer-events-auto">
              <ThemeToggle theme={theme} onToggle={onToggleTheme} className="landing-theme-toggle" />
              <button
                onClick={() => onStart("login")}
                className="landing-plain-button transition-colors text-[10px] md:text-xs uppercase font-medium hidden xs:block"
              >
                Se connecter
              </button>
              <button
                onClick={() => onStart("signup")}
                className="landing-nav-cta whitespace-nowrap rounded-full border border-transparent bg-orange-500 px-4 py-2 text-[10px] md:px-8 md:py-3 md:text-xs uppercase transition-all duration-300 font-medium shadow-[0_0_20px_rgba(249,115,22,0.3)] hover:scale-105 hover:bg-orange-600"
              >
                Commencer
              </button>
            </div>
          </motion.header>

          {/* ── Hero Content ── */}
          <main className="flex-1 flex flex-col justify-center min-h-[70vh]">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: isLoaded ? 1 : 0, y: isLoaded ? 0 : 20 }}
              transition={{ duration: 1.5, delay: 0.8 }}
              className="max-w-4xl pt-10 md:pt-20"
            >
              {/* Badge */}
              <div className="landing-badge mb-8 inline-flex items-center gap-3 rounded-full border border-white/[0.08] bg-white/[0.04] px-5 py-2.5 backdrop-blur-md">
                <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
                <span className="landing-kicker text-[10px] md:text-xs font-medium uppercase">🔥 Bêta ouverte · Chatbot Facebook · Madagascar</span>
              </div>

              <motion.h1
                style={{ rotateX, rotateY }}
                className="landing-headline text-[32px] sm:text-[52px] md:text-[78px] leading-[1.1] md:leading-[1] perspective-1000 font-[family-name:var(--font-outfit)]"
              >
                Ton bot répond.<br />
                <span className="font-bold tracking-tight">Tu vends plus.</span>
              </motion.h1>

              <p className="landing-copy mt-8 mb-10 text-sm md:text-xl max-w-xl leading-relaxed">
                Ton chatbot Facebook IA répond à tes clients, qualifie tes prospects et capture tes leads — même quand tu dors.
                Activé en <strong>15 min</strong> par l&apos;équipe FLARE. À partir de <strong>30 000 Ar/mois</strong>.
              </p>

              <div className="flex flex-col sm:flex-row items-start gap-4">
                <button
                  onClick={() => onStart("signup")}
                  className="landing-cta-hero group flex items-center gap-3 rounded-full bg-orange-500 px-10 py-5 text-[13px] font-bold uppercase tracking-widest transition-all duration-300 shadow-2xl shadow-orange-500/20 hover:scale-105 hover:bg-orange-600"
                >
                  Essayer gratuitement
                  <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                </button>

                {canInstall && (
                  <button
                    onClick={handleInstallClick}
                    className="landing-secondary-button flex items-center gap-3 rounded-full border px-6 py-5 text-[12px] font-medium uppercase transition-all"
                  >
                    <Download size={14} />
                    Installer l&apos;app
                  </button>
                )}
              </div>

              {/* ── Hero Metrics ── */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: isLoaded ? 1 : 0, y: isLoaded ? 0 : 20 }}
                transition={{ duration: 1.2, delay: 1.5 }}
                className="mt-16 flex gap-10 md:gap-16"
              >
                {METRICS.map((m, i) => (
                  <div key={i} className="flex flex-col">
                    <span className="landing-metric-value text-2xl md:text-4xl font-bold tracking-tight font-[family-name:var(--font-outfit)]">{m.value}</span>
                    <span className="landing-metric-label mt-1 text-[10px] md:text-xs uppercase">{m.label}</span>
                  </div>
                ))}
              </motion.div>
            </motion.div>
          </main>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          SOLUTIONS SECTION
         ══════════════════════════════════════════════════════ */}
      <section
        id="solutions"
        className="landing-section-muted relative z-20 overflow-hidden border-t border-white/5 px-6 py-24 sm:px-16 md:px-24 md:py-32"
      >
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-16 md:mb-24 max-w-2xl"
          >
            <span className="landing-section-kicker text-[10px] md:text-xs uppercase font-medium">Ce que FLARE AI fait pour toi</span>
            <h2 className="landing-section-title mt-4 text-3xl md:text-5xl font-[family-name:var(--font-outfit)]">
              3 services concrets pour <span className="font-semibold">vendre plus</span>.
            </h2>
            <p className="landing-copy mt-4 max-w-xl text-sm md:text-lg leading-relaxed">
              Tu actives, FLARE AI exécute.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 gap-6">
            {USE_CASES.map((item, index) => {
              const Icon = item.icon;
              return (
                <motion.button
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                  onClick={() => onStart("signup", item.prompt)}
                className="landing-card group relative w-full overflow-hidden rounded-[24px] border border-white/[0.06] bg-white/[0.02] p-8 text-left transition-all duration-500 hover:border-white/[0.12] hover:bg-white/[0.04] md:p-10"
                >
                  {/* Subtle glow on hover */}
                  <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-orange-500/[0.04] rounded-full blur-[100px] opacity-0 group-hover:opacity-100 transition-opacity duration-700 -translate-y-1/2 translate-x-1/3" />

                  <div className="relative z-10 flex flex-col md:flex-row md:items-center gap-6 md:gap-10">
                    <div className="landing-icon-panel flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.04] transition-all duration-500 group-hover:border-orange-500/30 group-hover:bg-orange-500/10">
                      <Icon className="landing-solution-icon landing-solution-icon-strong transition-colors" size={26} strokeWidth={2.2} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <h3 className="landing-card-title mb-3 text-xl md:text-2xl font-medium tracking-tight font-[family-name:var(--font-outfit)]">{item.title}</h3>
                      <p className="landing-card-copy text-sm md:text-base leading-relaxed max-w-2xl">{item.description}</p>
                    </div>

                    <div className="landing-card-cta flex items-center gap-2 text-[10px] font-medium uppercase tracking-widest transition-colors shrink-0">
                      {item.cta}
                      <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                </motion.button>
              );
            })}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          PRICING SECTION
         ══════════════════════════════════════════════════════ */}
      <section
        id="pricing"
        className="landing-section-muted relative overflow-hidden border-t border-white/5 px-6 py-24 sm:px-16 md:px-24 md:py-32"
      >
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-16 md:mb-24 max-w-2xl"
          >
            <span className="landing-section-kicker text-[10px] md:text-xs uppercase font-medium">Offres bêta</span>
            <h2 className="landing-section-title mt-4 text-3xl md:text-5xl font-[family-name:var(--font-outfit)]">
              Un prix clair en <span className="font-semibold">Ariary</span>.<br />
              Payez par MVola ou Orange Money.
            </h2>
            <p className="landing-copy mt-4 text-sm md:text-base leading-relaxed">
              Pas de Stripe. Pas de carte étrangère. Tu paies localement, FLARE active ton bot.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                name: "Starter",
                price: "30 000",
                subtitle: "Boutique, artisan, indépendant",
                features: ["500 messages/mois", "Catalogue limité à 10 articles", "IA Réactive (Rapide)", "Dashboard basique", "Support par email"],
                cta: "Commencer",
                highlight: false,
              },
              {
                name: "Pro",
                price: "60 000",
                subtitle: "Commerce actif, plusieurs produits",
                features: ["2 000 messages/mois", "Catalogue jusqu'à 50 articles", "IA Vendeuse (Raisonnement)", "Script de vente IA inclus", "Portfolio de réalisations"],
                cta: "Choisir Pro",
                highlight: true,
              },
              {
                name: "Business",
                price: "120 000",
                subtitle: "PME, équipe commerciale",
                features: ["5 000 messages/mois", "Catalogue étendu (500 articles)", "IA Premium & Multi-Pages", "Rôles & permissions", "Support prioritaire"],
                cta: "Choisir Business",
                highlight: false,
              },
            ].map((plan, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className={`relative rounded-[24px] border p-8 md:p-10 flex flex-col gap-6 transition-all duration-300 ${
                  plan.highlight
                    ? "border-orange-500/40 bg-orange-500/5 shadow-xl shadow-orange-500/10 scale-[1.02]"
                    : "border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12]"
                }`}
              >
                {plan.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-orange-500 px-4 py-1 text-[10px] font-bold uppercase tracking-widest text-white shadow-lg">
                    Le plus populaire
                  </div>
                )}
                <div>
                  <span className="landing-section-kicker text-[10px] uppercase font-medium">{plan.name}</span>
                  <div className="mt-2 flex items-baseline gap-1">
                    <span className="landing-headline text-4xl md:text-5xl font-bold font-[family-name:var(--font-outfit)]">{plan.price}</span>
                    <span className="landing-copy text-sm">Ar / mois</span>
                  </div>
                  <p className="landing-card-copy mt-2 text-xs">{plan.subtitle}</p>
                </div>
                <ul className="flex flex-col gap-3 flex-1">
                  {plan.features.map((f, fi) => (
                    <li key={fi} className="flex items-start gap-2 landing-card-copy text-sm">
                      <span className="text-orange-500 mt-0.5 shrink-0">✓</span>
                      {f}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => onStart("signup")}
                  className={`w-full rounded-full py-4 text-[11px] font-bold uppercase tracking-widest transition-all duration-300 ${
                    plan.highlight
                      ? "bg-orange-500 shadow-lg shadow-orange-500/20 hover:bg-orange-600 hover:scale-105"
                      : "border border-white/10 hover:border-white/30 landing-card-title"
                  }`}
                >
                  {plan.cta}
                </button>
              </motion.div>
            ))}
          </div>

          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="mt-10 text-center landing-card-copy text-xs"
          >
            Paiement par <strong>MVola</strong> · <strong>Orange Money</strong> · <strong>Airtel Money</strong> · Virement · Cash.<br />
            Activation manuelle par l&apos;équipe FLARE sous 15 min après vérification du paiement.
          </motion.p>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          ADVANTAGES SECTION
         ══════════════════════════════════════════════════════ */}
      <section
        id="advantages"
        className="landing-section-base relative overflow-hidden px-6 py-24 sm:px-16 md:px-24 md:py-32"
      >
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-16 md:mb-24 max-w-2xl"
          >
            <span className="landing-section-kicker text-[10px] md:text-xs uppercase font-medium">Pourquoi ça marche</span>
            <h2 className="landing-section-title mt-4 text-3xl md:text-5xl font-[family-name:var(--font-outfit)]">
              Conçu pour <span className="font-semibold">te faire gagner du temps</span>, pas pour faire joli.
            </h2>
          </motion.div>

          <div className="landing-divider grid grid-cols-1 gap-px overflow-hidden rounded-[24px] bg-white/[0.06] md:grid-cols-2">
            {ADVANTAGES.map((adv, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.08 }}
                className="landing-card-muted group bg-[#060607] p-8 md:p-10"
              >
                <span className="landing-card-index text-[11px] font-mono font-bold tracking-widest">{adv.number}</span>
                <h3 className="landing-card-title mt-4 text-lg md:text-xl font-medium tracking-tight font-[family-name:var(--font-outfit)]">{adv.title}</h3>
                <p className="landing-card-copy mt-3 text-sm leading-relaxed">{adv.text}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          NOTRE HISTOIRE
         ══════════════════════════════════════════════════════ */}
      <section id="story" className="landing-section-base relative overflow-hidden px-6 py-24 sm:px-16 md:px-24 md:py-32">
        {/* Brain 3D — arrière-plan, pointer-events désactivé pour ne pas capturer le scroll */}
        <div className="absolute inset-0 z-0 opacity-30 pointer-events-none">
          <SplineBoundary>
            <Suspense fallback={null}>
              <Spline
                scene="https://prod.spline.design/rIcJ6LXEuI7u6Tn6/scene.splinecode"
                className="w-full h-full"
                style={{ pointerEvents: 'none' }}
              />
            </Suspense>
          </SplineBoundary>
        </div>
        {/* Overlay pour lisibilité */}
        <div className="landing-story-overlay absolute inset-0 z-[1] bg-gradient-to-r from-[#020305] via-[#020305]/85 to-[#020305]/60" />

        <div className="relative z-10 max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-16 md:mb-20 max-w-2xl"
          >
            <span className="landing-section-kicker text-[10px] md:text-xs uppercase font-medium">Notre histoire</span>
            <h2 className="landing-section-title mt-4 text-3xl md:text-5xl font-[family-name:var(--font-outfit)]">
              Né à Madagascar, <span className="font-semibold">pensé pour le monde</span>.
            </h2>
          </motion.div>

          <div className="flex flex-col md:flex-row gap-12 items-start">
            {/* Photo Kévin à gauche */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="shrink-0"
            >
              <div className="w-40 h-52 md:w-48 md:h-64 rounded-2xl overflow-hidden shadow-2xl">
                <img src="/kevin.png" alt="Kévin — Fondateur" className="w-full h-full object-cover" />
              </div>
              <div className="mt-4">
                <p className="landing-card-title text-sm font-medium">Kévin</p>
                <p className="landing-card-copy text-xs">Fondateur & Architecte</p>
                <p className="landing-card-copy text-xs">FLARE AI — Madagascar</p>
              </div>
            </motion.div>

            {/* Texte à droite */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="flex flex-col gap-6 max-w-xl"
            >
              <p className="landing-copy text-base md:text-lg leading-relaxed">
                FLARE AI est né d&apos;un constat simple : les petites entreprises perdent un temps fou sur des tâches que l&apos;IA peut faire mieux et plus vite.
              </p>
              <p className="landing-copy text-base md:text-lg leading-relaxed">
                Notre mission est de rendre l&apos;intelligence artificielle accessible, sans code, sans jargon et sans prise de tête.
              </p>
              <p className="landing-copy text-base md:text-lg leading-relaxed">
                Chaque fonctionnalité est conçue pour un seul objectif : te faire gagner du temps et de l&apos;argent, dès le premier jour.
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          AVIS & CONFIANCE
         ══════════════════════════════════════════════════════ */}
      <section className="landing-section-muted relative overflow-hidden border-t border-white/5 px-6 py-24 sm:px-16 md:px-24 md:py-32">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-16 md:mb-20 text-center"
          >
            <span className="landing-section-kicker text-[10px] md:text-xs uppercase font-medium">Confiance & sécurité</span>
            <h2 className="landing-section-title mt-4 text-3xl md:text-5xl font-[family-name:var(--font-outfit)]">
              Tes données sont <span className="font-semibold">entre de bonnes mains</span>.
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { title: "Chiffrement de bout en bout", text: "Toutes tes données sont chiffrées en transit et au repos. Aucun accès tiers non autorisé." },
              { title: "Hébergement sécurisé", text: "Infrastructure Google Cloud Platform, conformité RGPD, sauvegardes automatiques quotidiennes." },
              { title: "Transparence totale", text: "Pas de revente de données. Pas de tracking publicitaire. Ton business reste ton business." },
            ].map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="landing-card rounded-[24px] border border-white/[0.06] bg-white/[0.02] p-8"
              >
                <div className="landing-icon-panel mb-5 flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04]">
                  <span className="landing-card-index text-lg font-light">{String(i + 1).padStart(2, "0")}</span>
                </div>
                <h3 className="landing-card-title text-lg font-medium tracking-tight">{item.title}</h3>
                <p className="landing-card-copy mt-3 text-sm leading-relaxed">{item.text}</p>
              </motion.div>
            ))}
          </div>

          {/* Policies links */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="mt-12 flex flex-wrap items-center justify-center gap-6"
          >
            {[
              { label: "Politique de confidentialité", href: "#" },
              { label: "Conditions d'utilisation", href: "#" },
              { label: "Politique cookies", href: "#" },
            ].map((link) => (
              <a key={link.label} href={link.href} className="landing-footer-link text-xs uppercase transition-colors font-medium">
                {link.label}
              </a>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          CTA FINAL
         ══════════════════════════════════════════════════════ */}
      <section className="landing-section-base relative overflow-hidden px-6 py-24 sm:px-16 md:px-24 md:py-32">
        <div className="max-w-3xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl md:text-5xl font-light text-white tracking-tighter font-[family-name:var(--font-outfit)]">
              Prêt à automatiser <span className="font-semibold">ton business</span> ?
            </h2>
            <p className="landing-copy mt-6 text-base md:text-lg max-w-xl mx-auto leading-relaxed">
              Tu choisis ton plan, tu paies par <strong>MVola ou Orange Money</strong>, l&apos;équipe FLARE active ton bot.
              Des résultats visibles dès le premier jour.
            </p>

            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <button
                onClick={() => onStart("signup")}
                className="landing-cta-hero group px-10 py-5 bg-orange-500 rounded-full font-bold text-[13px] uppercase tracking-widest hover:bg-orange-600 hover:scale-105 transition-all duration-300 shadow-2xl shadow-orange-500/20 flex items-center gap-3"
              >
                Créer mon compte
                <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
              </button>
              <button
                onClick={() => onStart("login")}
                className="landing-plain-button rounded-full px-8 py-5 text-[12px] uppercase transition-colors"
              >
                J&apos;ai déjà un compte
              </button>
            </div>
          </motion.div>
        </div>

        {/* Footer minimal */}
        <div className="landing-footer mx-auto mt-24 flex max-w-6xl flex-col items-center justify-between gap-4 border-t border-white/5 pt-8 sm:flex-row">
          <div className="flex items-center gap-3">
            <FlareMark tone="auto" className="w-5" />
            <span className="landing-brand-title text-xs uppercase">FLARE AI</span>
          </div>
          <div className="flex items-center gap-6">
            {[
              { label: "Confidentialité", href: "#" },
              { label: "CGU", href: "#" },
            ].map((link) => (
              <a key={link.label} href={link.href} className="landing-footer-link text-[10px] uppercase transition-colors font-medium">
                {link.label}
              </a>
            ))}
          </div>
          <p className="landing-footer-link text-[10px] uppercase font-medium">
            Conçu par FLARE AI — Madagascar
          </p>
        </div>
      </section>

      <style jsx global>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        html { scroll-behavior: smooth; }

        .landing-shell {
          background:
            radial-gradient(circle at 12% 18%, rgba(249, 115, 22, 0.12), transparent 24%),
            radial-gradient(circle at 78% 22%, rgba(28, 58, 106, 0.09), transparent 28%),
            linear-gradient(135deg, #f6f0e7 0%, #fcfcfd 44%, #f0f4fb 100%);
        }
        .landing-spline-fallback {
          background:
            radial-gradient(circle at center, rgba(255, 255, 255, 0.55), transparent 55%),
            linear-gradient(135deg, #f6f0e7 0%, #fcfcfd 44%, #f0f4fb 100%);
        }
        .landing-nav,
        .landing-mobile-menu {
          background: rgba(255, 255, 255, 0.92);
          border-color: rgba(15, 23, 42, 0.12);
          box-shadow: 0 18px 42px rgba(15, 23, 42, 0.08);
          backdrop-filter: blur(20px);
        }
        .landing-mobile-actions,
        .landing-footer {
          border-color: rgba(15, 23, 42, 0.1);
        }
        .landing-theme-toggle,
        .landing-theme-toggle-mobile {
          background: rgba(255, 247, 237, 0.98) !important;
          color: #000000 !important;
          border: 1px solid rgba(249, 115, 22, 0.45) !important;
          box-shadow: 0 10px 24px rgba(0,0,0,0.12);
          min-height: 42px;
        }
        .landing-theme-toggle span,
        .landing-theme-toggle-mobile span {
          color: #000 !important;
        }
        .landing-theme-toggle > span:first-child,
        .landing-theme-toggle-mobile > span:first-child {
          background: rgba(249, 115, 22, 0.18) !important;
          border-color: rgba(249, 115, 22, 0.55) !important;
          color: #000 !important;
        }
        .landing-theme-toggle > span:last-child,
        .landing-theme-toggle-mobile > span:last-child {
          font-weight: 700;
          letter-spacing: 0.04em !important;
        }
        .landing-theme-toggle svg,
        .landing-theme-toggle-mobile svg,
        .landing-mobile-trigger,
        .landing-scroll-fill,
        .landing-scroll-track,
        .landing-solution-icon,
        .landing-scroll-arrow {
          color: rgb(234 88 12) !important;
          stroke: currentColor !important;
        }
        .landing-theme-toggle:hover,
        .landing-theme-toggle-mobile:hover {
          background: rgba(255, 247, 237, 1) !important;
          border-color: rgba(249, 115, 22, 0.75) !important;
        }
        .landing-hero-scene {
          opacity: 0.94;
          filter: grayscale(0.1);
        }
        .landing-mark-chip,
        .landing-mark-frame,
        .landing-icon-panel,
        .landing-badge,
        .landing-secondary-button,
        .landing-card,
        .landing-card-muted {
          background: rgba(255, 255, 255, 0.82);
          border-color: rgba(15, 23, 42, 0.1);
          box-shadow: 0 18px 42px rgba(15, 23, 42, 0.04);
        }
        .landing-secondary-button {
          color: #000 !important;
        }
        .landing-icon-panel {
          background: rgba(255, 237, 213, 0.95);
          border-color: rgba(249, 115, 22, 0.42);
          box-shadow: 0 10px 24px rgba(249, 115, 22, 0.12);
        }
        .landing-card:hover {
          background: rgba(255, 255, 255, 0.96);
          border-color: rgba(15, 23, 42, 0.14);
        }
        .landing-card:hover .landing-solution-icon {
          color: rgba(194, 65, 12, 1) !important;
        }
        .landing-solution-icon-strong {
          color: rgb(234 88 12) !important;
          stroke: currentColor !important;
        }
        .landing-divider {
          background: rgba(15, 23, 42, 0.08);
        }
        .landing-section-base {
          background: linear-gradient(180deg, #fcfcfd 0%, #f8f4ec 100%);
        }
        .landing-section-muted {
          background: linear-gradient(180deg, #f4eee3 0%, #fcfcfd 100%);
          border-color: rgba(15, 23, 42, 0.08);
        }
        .landing-story-overlay {
          background: linear-gradient(to right, rgba(252,252,253,0.94), rgba(252,252,253,0.82), rgba(252,252,253,0.46));
        }

        .landing-brand-title {
          color: #000 !important;
          font-weight: 700;
          letter-spacing: 0.015em;
        }
        .landing-brand-subtitle {
          color: #000 !important;
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.045em;
        }
        .landing-nav-link,
        .landing-plain-button,
        .landing-mobile-link,
        .landing-mobile-secondary,
        .landing-mobile-cta,
        .landing-kicker,
        .landing-headline,
        .landing-copy,
        .landing-metric-value,
        .landing-metric-label,
        .landing-section-kicker,
        .landing-section-title,
        .landing-card-index,
        .landing-card-title,
        .landing-card-copy,
        .landing-footer-link {
          color: #000 !important;
        }
        .landing-nav-link,
        .landing-section-kicker,
        .landing-kicker,
        .landing-metric-label,
        .landing-footer-link,
        .landing-mobile-secondary,
        .landing-mobile-cta,
        .landing-plain-button {
          letter-spacing: 0.05em;
        }
        .landing-headline,
        .landing-section-title {
          font-weight: 700;
          letter-spacing: -0.04em;
        }
        .landing-copy,
        .landing-card-copy {
          font-weight: 500;
        }
        .landing-card-cta {
          color: #000 !important;
        }
        .landing-card:hover .landing-card-cta {
          color: rgb(234 88 12) !important;
        }
        .landing-nav-cta,
        .landing-mobile-cta {
          color: #000 !important;
        }
        .landing-theme-scope [class*="text-"],
        .landing-theme-scope [class*="text_"],
        .landing-theme-scope p,
        .landing-theme-scope h1,
        .landing-theme-scope h2,
        .landing-theme-scope h3,
        .landing-theme-scope span,
        .landing-theme-scope a,
        .landing-theme-scope button {
          color: #000 !important;
        }
        .landing-theme-scope svg,
        .landing-theme-scope svg * {
          color: #000 !important;
          stroke: currentColor !important;
        }
        .landing-cta-hero,
        .landing-cta-hero * {
          color: #fff !important;
        }

        html.dark .landing-shell {
          background:
            radial-gradient(circle at 12% 18%, rgba(249, 115, 22, 0.1), transparent 24%),
            radial-gradient(circle at 78% 22%, rgba(28, 58, 106, 0.07), transparent 28%),
            linear-gradient(135deg, #efebe5 0%, #f7f3ed 44%, #ecefed 100%);
        }
        html.dark .landing-theme-scope [class*="text-"],
        html.dark .landing-theme-scope [class*="text_"],
        html.dark .landing-theme-scope p,
        html.dark .landing-theme-scope h1,
        html.dark .landing-theme-scope h2,
        html.dark .landing-theme-scope h3,
        html.dark .landing-theme-scope span,
        html.dark .landing-theme-scope a,
        html.dark .landing-theme-scope button {
          color: #000 !important;
        }
        html.dark .landing-theme-scope svg,
        html.dark .landing-theme-scope svg * {
          color: #000 !important;
          stroke: currentColor !important;
        }
        html.dark .landing-theme-scope .landing-cta-hero,
        html.dark .landing-theme-scope .landing-cta-hero * {
          color: #fff !important;
        }
      `}</style>
    </div>
  );
}
