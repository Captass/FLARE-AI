"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { ArrowDown, ArrowRight, Zap, MessageSquare, BarChart3, Bot, Menu, X, Download } from "lucide-react";
import { motion, useSpring, useTransform, useScroll, useMotionValueEvent, AnimatePresence } from "framer-motion";
import Spline from "@splinetool/react-spline";
import React from "react";
import FlareMark from "./FlareMark";
import { ThemePreference } from "@/lib/theme";

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
}

export default function LandingPage({ onStart }: LandingPageProps) {
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
    { value: "50k+", label: "messages automatisés" },
    { value: "15 min", label: "pour l'activer" },
    { value: "0", label: "technicien requis" },
  ];

  /* ── Témoignages pour la confiance ── */
  const REVIEWS = [
    { 
      name: "Andry T.", 
      role: "E-commerçant", 
      text: "Depuis FLARE, mon bot répond à mes clients à 2h du mat. Je ne rate plus aucune vente.",
      initials: "AT"
    },
    { 
      name: "Sarah R.", 
      role: "Agence Digitale", 
      text: "L'automatisation des factures et devis nous a fait gagner 10h par semaine. Indispensable.",
      initials: "SR"
    },
    { 
      name: "Mamy L.", 
      role: "Boutique en ligne", 
      text: "Activation en 15 minutes chrono. Le support est local et ultra réactif.",
      initials: "ML"
    },
  ];

  /* ── Cas d'usage orientés business ── */
  const USE_CASES = [
    {
      icon: MessageSquare,
      title: "Automatisez vos Ventes",
      description: "Un chatbot Messenger qui répond à vos prospects 24/7 et qualifie les leads. Ne ratez plus aucune vente, même la nuit.",
      cta: "Activer mon assistant",
      prompt: "Configure mon chatbot Facebook pour répondre aux clients automatiquement",
    },
    {
      icon: Zap,
      title: "Automatisez vos Contenus",
      description: "Générez vos visuels et vidéos TikTok/Facebook en un clic. FLARE s'occupe de la création pour vous rendre visible.",
      cta: "Créer un visuel",
      prompt: "Rédige un post Facebook accrocheur avec un visuel pour promouvoir mes services",
    },
    {
      icon: BarChart3,
      title: "Automatisez votre Gestion",
      description: "Édition automatique de devis, factures et rapports. Libérez votre temps pour vous concentrer sur vos clients.",
      cta: "Automatiser mes docs",
      prompt: "Génère un modèle de devis professionnel pour mes services",
    },
  ];

  /* ── Avantages concrets ── */
  const ADVANTAGES = [
    { number: "01", title: "Zéro technique", text: "Pas de code, pas de formation. L'équipe FLARE active votre plateforme pour vous en 15 minutes." },
    { number: "02", title: "Accompagnement", text: "Nous configurons vos premières automatisations avec vous pour garantir vos résultats." },
    { number: "03", title: "Mémoire Intelligente", text: "FLARE apprend vos prix et votre ton. Chaque action est parfaitement alignée sur votre marque." },
    { number: "04", title: "Pilote Automatique", text: "Pendant que vous dormez, votre système répond, produit et relance. Votre business ne s'arrête jamais." },
  ];

  /* ── Variants for staggered animations ── */
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15,
        delayChildren: 0.2
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] }
    }
  };

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
                <span className="landing-brand-subtitle mt-1 uppercase md:mt-3">Votre business en pilote automatique</span>
              </div>
            </div>

            <div className="flex items-center gap-2 md:gap-5 cursor-auto pointer-events-auto">
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
              variants={containerVariants}
              initial="hidden"
              animate={isLoaded ? "visible" : "hidden"}
              className="max-w-4xl pt-10 md:pt-20"
            >
              {/* Badge */}
              <motion.div 
                variants={itemVariants}
                className="landing-badge mb-8 inline-flex items-center gap-3 rounded-full border border-white/[0.08] bg-white/[0.04] px-5 py-2.5 backdrop-blur-md"
              >
                <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
                <span className="landing-kicker text-[10px] md:text-xs font-medium uppercase">🔥 Bêta ouverte · Chatbot Facebook · Madagascar</span>
              </motion.div>

              <motion.h1
                variants={itemVariants}
                style={{ rotateX, rotateY }}
                className="landing-headline text-[32px] sm:text-[52px] md:text-[78px] leading-[1.1] md:leading-[1] perspective-1000 font-[family-name:var(--font-outfit)]"
              >
                Simplifiez. Produisez.<br />
                <span className="font-bold tracking-tight">Automatisez.</span>
              </motion.h1>

              <motion.p 
                variants={itemVariants}
                className="landing-copy mt-8 mb-10 text-sm md:text-xl max-w-xl leading-relaxed"
              >
                La plateforme tout-en-un qui exécute vos <strong>ventes</strong>, vos <strong>contenus</strong> et vos <strong>documents</strong> pour vous.
                Activé en <strong>15 min</strong> par l&apos;équipe FLARE. À partir de <strong>30 000 Ar/mois</strong>.
              </motion.p>

              <motion.div 
                variants={itemVariants}
                className="flex flex-col sm:flex-row items-start gap-4"
              >
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
              </motion.div>

              {/* ── Hero Metrics ── */}
              <motion.div
                variants={containerVariants}
                className="mt-16 flex gap-10 md:gap-16"
              >
                {METRICS.map((m, i) => (
                  <motion.div key={i} variants={itemVariants} className="flex flex-col">
                    <span className="landing-metric-value text-2xl md:text-4xl font-bold tracking-tight font-[family-name:var(--font-outfit)]">{m.value}</span>
                    <span className="landing-metric-label mt-1 text-[10px] md:text-xs uppercase">{m.label}</span>
                  </motion.div>
                ))}
              </motion.div>
            </motion.div>
          </main>
        </div>

        {/* ── Social Proof / Trusted Tech Band ── */}
        <motion.div 
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="relative z-10 w-full border-y border-white/5 bg-white/[0.02] backdrop-blur-sm py-8"
        >
          <div className="max-w-6xl mx-auto px-6 flex flex-wrap justify-center items-center gap-8 md:gap-16 grayscale opacity-40">
            <span className="text-[10px] uppercase tracking-widest font-semibold text-white/40">Propulsé par les meilleures technologies</span>
            <div className="flex items-center gap-2">
              <Bot size={16} />
              <span className="text-sm font-bold">Google Cloud</span>
            </div>
            <div className="flex items-center gap-2">
              <Zap size={16} />
              <span className="text-sm font-bold">Next.js 14</span>
            </div>
            <div className="flex items-center gap-2">
              <MessageSquare size={16} />
              <span className="text-sm font-bold">Meta API</span>
            </div>
          </div>
        </motion.div>
      </section>

      {/* ── Trust / Reviews Section ── */}
      <section className="relative z-20 px-6 py-20 sm:px-16 md:px-24">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {REVIEWS.map((rev, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="group relative p-8 rounded-[32px] bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-all duration-500"
              >
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-10 h-10 rounded-full bg-orange-500/10 flex items-center justify-center text-orange-500 font-bold text-xs border border-orange-500/20">
                    {rev.initials}
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">{rev.name}</h4>
                    <span className="text-[10px] uppercase text-white/40">{rev.role}</span>
                  </div>
                </div>
                <p className="text-sm leading-relaxed text-white/70 italic">&quot;{rev.text}&quot;</p>
              </motion.div>
            ))}
          </div>
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
            <span className="landing-section-kicker text-[10px] md:text-xs uppercase font-medium">L&apos;IA qui exécute pour vous</span>
            <h2 className="landing-section-title mt-4 text-3xl md:text-5xl font-[family-name:var(--font-outfit)]">
              3 piliers pour <span className="font-semibold">automatiser votre business</span>.
            </h2>
            <p className="landing-copy mt-4 max-w-xl text-sm md:text-lg leading-relaxed">
              Ne vous souciez plus du &quot;comment&quot;. FLARE AI s&apos;occupe de l&apos;exécution technique.
            </p>
          </motion.div>

          <motion.div 
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            className="grid grid-cols-1 gap-6"
          >
            {USE_CASES.map((item, index) => {
              const Icon = item.icon;
              return (
                <motion.button
                  key={index}
                  variants={itemVariants}
                  onClick={() => onStart("signup", item.prompt)}
                  className="landing-card group relative w-full overflow-hidden rounded-[24px] border border-white/[0.06] bg-white/[0.02] p-8 text-left transition-all duration-500 hover:border-white/[0.12] hover:bg-white/[0.04] md:p-10"
                >
                  {/* Subtle glow on hover */}
                  <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-orange-500/[0.04] rounded-full blur-[100px] opacity-0 group-hover:opacity-100 transition-opacity duration-1000 -translate-y-1/2 translate-x-1/3" />

                  <div className="relative z-10 flex flex-col md:flex-row md:items-center gap-6 md:gap-10">
                    <div className="landing-icon-panel flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.04] transition-all duration-500 group-hover:border-orange-500/30 group-hover:bg-orange-500/10 group-hover:scale-110">
                      <Icon className="landing-solution-icon landing-solution-icon-strong transition-colors" size={28} strokeWidth={2} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <h3 className="landing-card-title mb-3 text-xl md:text-3xl font-medium tracking-tight font-[family-name:var(--font-outfit)]">{item.title}</h3>
                      <p className="landing-card-copy text-sm md:text-lg leading-relaxed max-w-2xl opacity-70 group-hover:opacity-100 transition-opacity">{item.description}</p>
                    </div>

                    <div className="landing-card-cta hidden md:flex items-center gap-3 text-[10px] font-bold uppercase tracking-[0.2em] transition-all shrink-0 opacity-0 -translate-x-4 group-hover:opacity-100 group-hover:translate-x-0">
                      {item.cta}
                      <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                </motion.button>
              );
            })}
          </motion.div>
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

          <motion.div 
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
            className="grid grid-cols-1 md:grid-cols-3 gap-6"
          >
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
                variants={itemVariants}
                className={`relative rounded-[32px] border p-8 md:p-10 flex flex-col gap-6 transition-all duration-500 ${
                  plan.highlight
                    ? "border-orange-500/40 bg-orange-500/[0.03] shadow-2xl shadow-orange-500/10 scale-[1.02] z-10"
                    : "border-black/[0.06] bg-black/[0.01] hover:border-black/[0.12] hover:bg-white/50"
                }`}
              >
                {plan.highlight && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 rounded-full bg-orange-500 px-6 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-white shadow-xl">
                    Le plus populaire
                  </div>
                )}
                <div>
                  <span className="landing-section-kicker text-[10px] uppercase font-bold text-orange-600">{plan.name}</span>
                  <div className="mt-4 flex items-baseline gap-1">
                    <span className="landing-headline text-5xl md:text-6xl font-bold font-[family-name:var(--font-outfit)]">{plan.price}</span>
                    <span className="landing-copy text-sm opacity-60">Ar / mois</span>
                  </div>
                  <p className="landing-card-copy mt-2 text-xs font-semibold">{plan.subtitle}</p>
                </div>
                <ul className="flex flex-col gap-4 flex-1 my-4">
                  {plan.features.map((f, fi) => (
                    <li key={fi} className="flex items-start gap-3 landing-card-copy text-sm font-medium">
                      <div className="w-5 h-5 rounded-full bg-orange-500/10 flex items-center justify-center shrink-0">
                        <span className="text-orange-600 text-[10px]">✓</span>
                      </div>
                      {f}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => onStart("signup")}
                  className={`w-full rounded-2xl py-5 text-[11px] font-bold uppercase tracking-widest transition-all duration-300 ${
                    plan.highlight
                      ? "bg-orange-500 text-white shadow-lg shadow-orange-500/20 hover:bg-orange-600 hover:scale-[1.02]"
                      : "border border-black/10 hover:border-black/30 hover:bg-black/5"
                  }`}
                >
                  {plan.cta}
                </button>
              </motion.div>
            ))}
          </motion.div>

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

          <motion.div 
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
            className="landing-divider grid grid-cols-1 gap-px overflow-hidden rounded-[32px] bg-white/[0.08] md:grid-cols-2 lg:grid-cols-4"
          >
            {ADVANTAGES.map((adv, index) => (
              <motion.div
                key={index}
                variants={itemVariants}
                className="landing-card-muted group bg-[#020305] p-8 md:p-10 transition-colors hover:bg-white/[0.02]"
              >
                <div className="flex items-center justify-between mb-8">
                  <span className="landing-card-index text-[14px] font-mono font-bold tracking-widest text-orange-500/40">{adv.number}</span>
                  <div className="w-1 h-8 bg-orange-500/10 rounded-full group-hover:bg-orange-500/40 transition-colors" />
                </div>
                <h3 className="landing-card-title text-xl md:text-2xl font-medium tracking-tight font-[family-name:var(--font-outfit)]">{adv.title}</h3>
                <p className="landing-card-copy mt-4 text-sm md:text-base leading-relaxed opacity-60 group-hover:opacity-100 transition-opacity">{adv.text}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── Security / Reliability Section ── */}
      <section className="relative z-20 px-6 py-20 sm:px-16 md:px-24 bg-gradient-to-b from-transparent to-white/[0.01]">
        <div className="max-w-6xl mx-auto flex flex-col items-center text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="w-16 h-16 rounded-full bg-orange-500/10 flex items-center justify-center mb-8 border border-orange-500/20"
          >
            <Bot size={32} className="text-orange-500" />
          </motion.div>
          <h2 className="text-2xl md:text-4xl font-bold tracking-tight mb-4">Votre sécurité est notre priorité</h2>
          <p className="text-sm md:text-lg text-white/60 max-w-2xl">
            Données chiffrées, hébergement Google Cloud sécurisé et conformité Meta API. Votre business est entre de bonnes mains.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-6 opacity-60">
             <div className="flex items-center gap-2 px-4 py-2 rounded-full border border-white/10 bg-white/5">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                <span className="text-[10px] uppercase font-bold tracking-wider">SSL Encrypted</span>
             </div>
             <div className="flex items-center gap-2 px-4 py-2 rounded-full border border-white/10 bg-white/5">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                <span className="text-[10px] uppercase font-bold tracking-wider">GDPR Comply</span>
             </div>
             <div className="flex items-center gap-2 px-4 py-2 rounded-full border border-white/10 bg-white/5">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                <span className="text-[10px] uppercase font-bold tracking-wider">Meta Verified API</span>
             </div>
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

          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="flex flex-col md:flex-row gap-12 items-start"
          >
            {/* Photo Kévin à gauche */}
            <motion.div
              variants={itemVariants}
              className="shrink-0 group"
            >
              <div className="w-40 h-52 md:w-48 md:h-64 rounded-[32px] overflow-hidden shadow-2xl grayscale group-hover:grayscale-0 transition-all duration-700">
                <img src="/kevin.png" alt="Kévin — Fondateur" className="w-full h-full object-cover" />
              </div>
              <div className="mt-6">
                <p className="landing-card-title text-sm font-bold uppercase tracking-tight">Kévin</p>
                <p className="landing-card-copy text-xs font-bold text-orange-600/60 mt-1">Fondateur & Architecte</p>
                <p className="landing-card-copy text-xs font-bold text-black/40 uppercase tracking-widest mt-2">FLARE AI — Madagascar</p>
              </div>
            </motion.div>

            {/* Texte à droite */}
            <motion.div
              variants={containerVariants}
              className="flex flex-col gap-8 max-w-xl"
            >
              <motion.p variants={itemVariants} className="landing-copy text-lg md:text-2xl leading-snug font-medium text-black">
                FLARE AI est né d&apos;une vision : permettre à chaque entrepreneur de posséder son propre <span className="text-orange-600">pilote digital intelligent</span>.
              </motion.p>
              <motion.p variants={itemVariants} className="landing-copy text-base md:text-lg leading-relaxed opacity-70">
                Nous ne construisons pas de simples outils, nous bâtissons la technologie qui automatise votre travail quotidien pour vous laisser vous concentrer sur votre croissance.
              </motion.p>
              <motion.p variants={itemVariants} className="landing-copy text-base md:text-lg leading-relaxed opacity-70">
                Notre mission est de rendre l&apos;automatisation digitale accessible à tous, sans barrière technique et sans jargon complexe.
              </motion.p>
            </motion.div>
          </motion.div>
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
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
          >
            <motion.h2 variants={itemVariants} className="text-4xl md:text-7xl font-bold text-black tracking-tighter font-[family-name:var(--font-outfit)] leading-[0.9]">
              Prêt à automatiser <br />
              <span className="text-orange-500">ton business ?</span>
            </motion.h2>
            <motion.p variants={itemVariants} className="landing-copy mt-8 text-lg md:text-2xl max-w-xl mx-auto leading-relaxed font-medium">
              Tu choisis ton plan, tu paies par <strong>MVola ou Orange Money</strong>, l&apos;équipe FLARE active ton bot.
              Des résultats visibles dès le premier jour.
            </motion.p>

            <motion.div 
              variants={itemVariants}
              className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-6"
            >
              <button
                onClick={() => onStart("signup")}
                className="landing-cta-hero group px-12 py-6 bg-orange-500 rounded-2xl font-bold text-[14px] uppercase tracking-widest hover:bg-orange-600 hover:scale-[1.05] transition-all duration-500 shadow-2xl shadow-orange-500/30 flex items-center gap-4 text-white"
              >
                Créer mon compte
                <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
              </button>
              <button
                onClick={() => onStart("login")}
                className="landing-plain-button rounded-2xl px-10 py-6 text-[13px] font-bold uppercase tracking-widest border border-black/5 hover:bg-black/5 hover:text-black transition-all"
              >
                J&apos;ai déjà un compte
              </button>
            </motion.div>
          </motion.div>
        </div>

        {/* Footer minimal */}
        <div className="landing-footer mx-auto mt-24 flex max-w-6xl flex-col items-center justify-between gap-4 border-t border-white/5 pt-8 sm:flex-row">
          <div className="flex items-center gap-3">
            <FlareMark tone="dark" className="w-5" />
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
          background: #fbf7f0;
          color: #000000;
        }
        
        .landing-shell strong {
          color: #f97316;
          font-weight: 700;
        }

        .landing-nav {
          background: rgba(251, 247, 240, 0.8);
          border-color: rgba(0, 0, 0, 0.05);
          box-shadow: 0 4px 24px rgba(0, 0, 0, 0.04);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
        }

        .landing-mobile-menu {
          background: #fbf7f0;
          z-index: 100;
        }

        .landing-mobile-link {
          color: #000000;
        }

        .landing-nav-link {
          color: rgba(0, 0, 0, 0.6);
          position: relative;
        }
        
        .landing-nav-link:hover {
          color: #000000;
        }

        .landing-plain-button {
          color: rgba(0, 0, 0, 0.6) !important;
          transition: color 0.2s;
        }
        
        .landing-plain-button:hover {
          color: #000000 !important;
        }

        .landing-hero-scene {
          opacity: 0.8;
          filter: contrast(1.1);
        }

        .landing-mark-chip,
        .landing-mark-frame,
        .landing-badge,
        .landing-card,
        .landing-adv-card {
          background: rgba(0, 0, 0, 0.02);
          border-color: rgba(0, 0, 0, 0.05);
          transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .landing-card:hover {
          background: #ffffff;
          border-color: rgba(0, 0, 0, 0.1);
          box-shadow: 0 24px 64px rgba(0, 0, 0, 0.08);
          transform: translateY(-4px);
        }

        .landing-nav-cta:hover {
          filter: brightness(1.05);
          box-shadow: 0 4px 20px rgba(249, 115, 22, 0.3);
        }

        .landing-cta-hero:hover {
          box-shadow: 0 20px 60px rgba(249, 115, 22, 0.25);
        }

        .landing-secondary-button {
          background: transparent;
          border-color: rgba(0, 0, 0, 0.1);
          color: #000000 !important;
        }
        
        .landing-secondary-button:hover {
          background: rgba(0, 0, 0, 0.03);
          border-color: rgba(0, 0, 0, 0.2);
        }

        .landing-headline {
          color: #000000;
          letter-spacing: -0.04em;
          line-height: 0.95;
        }

        .landing-copy {
          color: rgba(0, 0, 0, 0.7);
        }

        .landing-kicker,
        .landing-metric-label,
        .landing-section-kicker,
        .landing-card-index,
        .landing-card-cta {
          color: #f97316;
          font-weight: 700;
          letter-spacing: 0.1em;
        }

        .landing-metric-value,
        .landing-section-title,
        .landing-card-title {
          color: #000000;
          font-weight: 700;
        }

        .landing-card-copy {
          color: rgba(0, 0, 0, 0.6);
          font-weight: 500;
        }

        .landing-theme-scope * {
          border-color: rgba(0, 0, 0, 0.06);
        }

        .landing-section-muted {
          background: linear-gradient(180deg, #fbf7f0 0%, #f4eee2 100%);
        }

        .landing-story-overlay {
          background: linear-gradient(to right, #fbf7f0 0%, rgba(251, 247, 240, 0.9) 60%, rgba(251, 247, 240, 0.4) 100%);
        }
      `}</style>
    </div>
  );
}
