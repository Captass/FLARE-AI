"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { ArrowDown, ArrowRight, Zap, MessageSquare, BarChart3, Bot, Menu, X, Download } from "lucide-react";
import { motion, useSpring, useTransform, useScroll, useMotionValueEvent, AnimatePresence } from "framer-motion";
import Spline from "@splinetool/react-spline";
import React from "react";
import FlareMark from "./FlareMark";

/* Tiny error boundary so a Spline crash doesn't kill the page */
class SplineBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(err: Error) { console.warn("[Spline]", err.message); }
  render() {
    if (this.state.hasError) return <div className="w-full h-full bg-[#020305]" />;
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
      alert("Pour installer RAM'S FLARE :\n• Sur mobile : utilisez Ajouter a l ecran d accueil.\n• Sur PC : utilisez l option d installation dans la barre d adresse.");
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
    { value: "10x", label: "plus rapide" },
    { value: "24/7", label: "sans pause" },
    { value: "0", label: "compétence technique requise" },
  ];

  /* ── Cas d'usage orientés business ── */
  const USE_CASES = [
    {
      icon: MessageSquare,
      title: "Répondez à vos clients pendant que vous dormez",
      description: "Votre chatbot IA gère chaque message Facebook, qualifie les prospects et relance automatiquement. Vous ne perdez plus aucune vente.",
      cta: "Activer mon chatbot",
      prompt: "Configure mon chatbot Facebook pour répondre aux clients automatiquement",
    },
    {
      icon: Zap,
      title: "Créez en 30 secondes ce qui prenait 3 heures",
      description: "Posts, emails, propositions commerciales, visuels — demandez, c'est prêt. Votre assistant comprend votre marque et écrit comme vous.",
      cta: "Essayer maintenant",
      prompt: "Rédige un post Facebook accrocheur pour promouvoir mes services",
    },
    {
      icon: BarChart3,
      title: "Voyez exactement ce qui rapporte et ce qui coûte",
      description: "Tableau de bord clair : combien de prospects, combien de conversions, combien vous dépensez. Prenez les bonnes décisions, vite.",
      cta: "Voir le tableau de bord",
      prompt: "Montre-moi un résumé de mes performances commerciales",
    },
  ];

  /* ── Avantages concrets ── */
  const ADVANTAGES = [
    { number: "01", title: "Zéro configuration", text: "Connectez votre page Facebook, et c'est parti. Pas de code, pas de formation." },
    { number: "02", title: "Votre IA, votre ton", text: "Elle apprend votre façon de parler, votre offre, vos prix. Chaque réponse sonne comme vous." },
    { number: "03", title: "Résultats mesurables", text: "Suivez vos leads, vos ventes et votre ROI en temps réel depuis un seul écran." },
    { number: "04", title: "Fonctionne non-stop", text: "Pendant que vous dormez, votre IA répond, qualifie et relance. 24h/24, 7j/7." },
  ];

  return (
    <div
      ref={containerRef}
      id="hero"
      className="relative w-full h-screen overflow-y-auto no-scrollbar bg-[#020305] font-sans select-none"
    >
      {/* ── Sticky Navbar ── */}
      <AnimatePresence>
        {isScrolled && (
          <motion.nav
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -100, opacity: 0 }}
            className="fixed top-0 left-0 right-0 z-[60] px-6 py-4 flex items-center justify-between glass border-b border-white/5 mx-4 mt-4 rounded-3xl"
          >
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => document.getElementById('hero')?.scrollTo({ top: 0, behavior: 'smooth' })}>
              <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/5 backdrop-blur-md">
                <FlareMark tone="dark" className="w-[18px]" />
              </div>
              <span className="text-white text-sm font-light tracking-[0.3em] uppercase hidden sm:block">RAM&apos;S FLARE</span>
            </div>

            <div className="hidden md:flex items-center gap-8">
              {[
                { label: "Accueil", id: "hero" },
                { label: "Solutions", id: "solutions" },
                { label: "Avantages", id: "advantages" },
                { label: "Notre histoire", id: "story" },
              ].map((link) => (
                <button
                  key={link.id}
                  onClick={() => {
                    const el = document.getElementById(link.id);
                    if (el) el.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="text-white/50 hover:text-white text-[10px] uppercase tracking-widest transition-colors font-medium pb-1"
                >
                  {link.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-4">
              <button
                onClick={() => onStart("login")}
                className="text-white/60 hover:text-white text-[10px] uppercase font-light tracking-widest hidden sm:block"
              >
                Se connecter
              </button>
              <button
                onClick={() => onStart("signup")}
                className="px-5 py-2.5 bg-orange-500 text-white text-[10px] font-medium uppercase tracking-widest rounded-full hover:bg-orange-600 transition-all shadow-lg shadow-orange-500/20"
              >
                Commencer
              </button>
              <button className="md:hidden text-white" onClick={() => setMobileMenuOpen(true)}>
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
            className="fixed inset-0 z-[70] bg-black p-8 flex flex-col gap-8"
          >
            <button className="self-end text-white" onClick={() => setMobileMenuOpen(false)}>
              <X size={32} />
            </button>
            <nav className="flex flex-col gap-6 mt-12">
              {[
                { label: "Accueil", id: "hero" },
                { label: "Solutions", id: "solutions" },
                { label: "Avantages", id: "advantages" },
                { label: "Notre histoire", id: "story" },
              ].map((link) => (
                <button
                  key={link.id}
                  onClick={() => {
                    const el = document.getElementById(link.id);
                    if (el) el.scrollIntoView({ behavior: 'smooth' });
                    setMobileMenuOpen(false);
                  }}
                  className="text-white text-2xl font-light uppercase tracking-tighter text-left"
                >
                  {link.label}
                </button>
              ))}
            </nav>
            <div className="mt-auto border-t border-white/5 pt-8 flex flex-col gap-4">
               <button onClick={() => onStart("login")} className="w-full py-4 text-white/60 font-light uppercase tracking-widest border border-white/10 rounded-2xl">Se connecter</button>
               <button onClick={() => onStart("signup")} className="w-full py-4 bg-orange-500 text-white font-light uppercase tracking-widest rounded-2xl">Commencer gratuitement</button>
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
        <div className="flex-1 w-[2px] bg-white/5 relative rounded-full overflow-hidden">
          <motion.div
            style={{
              scaleY: scrollYProgress,
              transformOrigin: "top"
            }}
            className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-white/40 to-white/10"
          />
        </div>

        <motion.div
          animate={{ y: [0, 8, 0], opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          className="flex flex-col items-center gap-2"
        >
          <ArrowDown size={14} className="text-white/40" />
        </motion.div>
      </motion.div>

      {/* ══════════════════════════════════════════════════════
          HERO SECTION
         ══════════════════════════════════════════════════════ */}
      <section className="relative w-full h-screen flex flex-col items-center justify-center sm:block">
        {/* 3D Robot Background */}
        <div className="absolute inset-0 z-0 opacity-40 grayscale-[80%]">
          <SplineBoundary>
            <Suspense fallback={<div className="w-full h-full bg-[#020305]" />}>
              <Spline
                scene="https://prod.spline.design/JD2om2Ai-FFKwh9D/scene.splinecode"
                onLoad={onLoad}
                className="w-full h-full"
                style={{ pointerEvents: isMobile ? 'none' : 'auto' }}
              />
            </Suspense>
          </SplineBoundary>
        </div>

        {/* Dark Overlays for readability */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#020305] via-[#020305]/80 to-transparent pointer-events-none z-[1]" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black pointer-events-none z-[1]" />

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
                <div className="absolute inset-0 rounded-[30%] border border-white/10 bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.12),rgba(255,255,255,0.03)_55%,transparent_100%)] shadow-[0_0_50px_rgba(255,255,255,0.08)]" />
                <FlareMark tone="dark" className="w-8 md:w-14" priority />
              </motion.div>
              <div className="flex flex-col justify-center">
                <span className="text-white text-lg md:text-3xl font-extralight tracking-[0.3em] md:tracking-[0.6em] uppercase leading-none">RAM&apos;S FLARE</span>
                <span className="text-[8px] md:text-xs text-white/40 uppercase tracking-[0.1em] md:tracking-[0.4em] mt-1 md:mt-3 font-light">Votre business, en pilote automatique</span>
              </div>
            </div>

            <div className="flex items-center gap-2 md:gap-8 cursor-auto pointer-events-auto">
              <button
                onClick={() => onStart("login")}
                className="text-white/60 hover:text-white transition-colors text-[10px] md:text-xs uppercase tracking-[0.1em] md:tracking-[0.2em] font-medium hidden xs:block"
              >
                Se connecter
              </button>
              <button
                onClick={() => onStart("signup")}
                className="px-4 py-2 md:px-8 md:py-3 bg-orange-500 border border-transparent text-white text-[10px] md:text-xs uppercase tracking-[0.1em] md:tracking-[0.2em] rounded-full hover:bg-orange-600 hover:scale-105 transition-all duration-300 font-medium shadow-[0_0_20px_rgba(249,115,22,0.3)] whitespace-nowrap"
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
              <div className="inline-flex items-center gap-3 px-5 py-2.5 rounded-full bg-white/[0.04] border border-white/[0.08] mb-8 backdrop-blur-md">
                <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
                <span className="text-[10px] md:text-xs font-medium text-white/60 uppercase tracking-[0.2em]">Automatisation intelligente</span>
              </div>

              <motion.h1
                style={{ rotateX, rotateY }}
                className="text-[32px] sm:text-[52px] md:text-[78px] font-extralight text-white leading-[1.1] md:leading-[1] tracking-tighter perspective-1000 font-[family-name:var(--font-outfit)]"
              >
                Vendez plus.<br />
                <span className="font-bold text-white tracking-tight">Travaillez moins.</span>
              </motion.h1>

              <p className="text-white/40 mt-8 mb-10 text-sm md:text-xl max-w-xl font-light leading-relaxed">
                Votre IA répond à vos clients, crée vos contenus et suit vos ventes.
                Vous gardez le contrôle, elle fait le travail.
              </p>

              <div className="flex flex-col sm:flex-row items-start gap-4">
                <button
                  onClick={() => onStart("signup")}
                  className="group px-10 py-5 bg-orange-500 text-white rounded-full font-bold text-[13px] uppercase tracking-widest hover:bg-orange-600 hover:scale-105 transition-all duration-300 shadow-2xl shadow-orange-500/20 flex items-center gap-3"
                >
                  Essayer gratuitement
                  <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                </button>

                {canInstall && (
                  <button
                    onClick={handleInstallClick}
                    className="px-6 py-5 text-white/50 hover:text-white rounded-full font-light text-[12px] uppercase tracking-widest border border-white/10 hover:border-white/20 transition-all flex items-center gap-3"
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
                    <span className="text-2xl md:text-4xl font-bold text-white tracking-tight font-[family-name:var(--font-outfit)]">{m.value}</span>
                    <span className="text-[10px] md:text-xs text-white/30 uppercase tracking-widest mt-1 font-light">{m.label}</span>
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
        className="relative py-24 md:py-32 bg-[#050506] overflow-hidden px-6 sm:px-16 md:px-24 border-t border-white/5 z-20"
      >
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-16 md:mb-24 max-w-2xl"
          >
            <span className="text-orange-500/80 text-[10px] md:text-xs uppercase tracking-[0.5em] font-medium">Ce que RAM&apos;S FLARE fait pour vous</span>
            <h2 className="mt-4 text-3xl md:text-5xl font-light text-white tracking-tighter font-[family-name:var(--font-outfit)]">
              Trois leviers pour <span className="font-semibold">faire décoller votre activité</span>.
            </h2>
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
                  className="group p-8 md:p-10 rounded-[24px] bg-white/[0.02] border border-white/[0.06] hover:border-white/[0.12] relative overflow-hidden text-left w-full transition-all duration-500 hover:bg-white/[0.04]"
                >
                  {/* Subtle glow on hover */}
                  <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-orange-500/[0.04] rounded-full blur-[100px] opacity-0 group-hover:opacity-100 transition-opacity duration-700 -translate-y-1/2 translate-x-1/3" />

                  <div className="relative z-10 flex flex-col md:flex-row md:items-center gap-6 md:gap-10">
                    <div className="w-14 h-14 bg-white/[0.04] rounded-2xl flex items-center justify-center border border-white/[0.08] group-hover:border-orange-500/30 group-hover:bg-orange-500/10 transition-all duration-500 shrink-0">
                      <Icon className="text-white/50 group-hover:text-orange-400 transition-colors" size={22} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <h3 className="text-xl md:text-2xl text-white font-medium tracking-tight mb-3 font-[family-name:var(--font-outfit)]">{item.title}</h3>
                      <p className="text-white/40 text-sm md:text-base leading-relaxed max-w-2xl">{item.description}</p>
                    </div>

                    <div className="flex items-center gap-2 text-[10px] text-white/30 group-hover:text-orange-400 font-medium uppercase tracking-widest transition-colors shrink-0">
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
          ADVANTAGES SECTION
         ══════════════════════════════════════════════════════ */}
      <section
        id="advantages"
        className="relative py-24 md:py-32 bg-black overflow-hidden px-6 sm:px-16 md:px-24"
      >
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-16 md:mb-24 max-w-2xl"
          >
            <span className="text-white/30 text-[10px] md:text-xs uppercase tracking-[0.5em] font-medium">Pourquoi nos clients restent</span>
            <h2 className="mt-4 text-3xl md:text-5xl font-light text-white tracking-tighter font-[family-name:var(--font-outfit)]">
              Conçu pour ceux qui veulent <span className="font-semibold">des résultats, pas des gadgets</span>.
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-white/[0.06] rounded-[24px] overflow-hidden">
            {ADVANTAGES.map((adv, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.08 }}
                className="p-8 md:p-10 bg-[#060607] group"
              >
                <span className="text-[11px] text-white/15 font-mono font-bold tracking-widest">{adv.number}</span>
                <h3 className="mt-4 text-lg md:text-xl text-white font-medium tracking-tight font-[family-name:var(--font-outfit)]">{adv.title}</h3>
                <p className="mt-3 text-white/35 text-sm leading-relaxed">{adv.text}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          NOTRE HISTOIRE
         ══════════════════════════════════════════════════════ */}
      <section id="story" className="relative py-24 md:py-32 bg-[#020305] overflow-hidden px-6 sm:px-16 md:px-24">
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
        <div className="absolute inset-0 bg-gradient-to-r from-[#020305] via-[#020305]/85 to-[#020305]/60 z-[1]" />

        <div className="relative z-10 max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-16 md:mb-20 max-w-2xl"
          >
            <span className="text-white/30 text-[10px] md:text-xs uppercase tracking-[0.5em] font-medium">Notre histoire</span>
            <h2 className="mt-4 text-3xl md:text-5xl font-light text-white tracking-tighter font-[family-name:var(--font-outfit)]">
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
                <p className="text-sm font-medium text-white">Kévin</p>
                <p className="text-xs text-white/30">Fondateur & Architecte</p>
                <p className="text-xs text-white/20">RAM&apos;S FLARE — Madagascar</p>
              </div>
            </motion.div>

            {/* Texte à droite */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="flex flex-col gap-6 max-w-xl"
            >
              <p className="text-white/45 text-base md:text-lg leading-relaxed font-light">
                RAM&apos;S FLARE est né d&apos;un constat simple : les petites entreprises et les entrepreneurs perdent un temps fou sur des tâches que l&apos;IA peut faire mieux et plus vite.
              </p>
              <p className="text-white/45 text-base md:text-lg leading-relaxed font-light">
                Notre mission est de rendre l&apos;intelligence artificielle accessible à tous les professionnels — sans code, sans jargon, sans prise de tête.
              </p>
              <p className="text-white/45 text-base md:text-lg leading-relaxed font-light">
                Chaque fonctionnalité est conçue pour un seul objectif : vous faire gagner du temps et de l&apos;argent, dès le premier jour.
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          AVIS & CONFIANCE
         ══════════════════════════════════════════════════════ */}
      <section className="relative py-24 md:py-32 bg-[#050506] overflow-hidden px-6 sm:px-16 md:px-24 border-t border-white/5">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-16 md:mb-20 text-center"
          >
            <span className="text-orange-500/80 text-[10px] md:text-xs uppercase tracking-[0.5em] font-medium">Confiance & sécurité</span>
            <h2 className="mt-4 text-3xl md:text-5xl font-light text-white tracking-tighter font-[family-name:var(--font-outfit)]">
              Vos données sont <span className="font-semibold">entre de bonnes mains</span>.
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { title: "Chiffrement de bout en bout", text: "Toutes vos données sont chiffrées en transit et au repos. Aucun accès tiers non autorisé." },
              { title: "Hébergement sécurisé", text: "Infrastructure Google Cloud Platform, conformité RGPD, sauvegardes automatiques quotidiennes." },
              { title: "Transparence totale", text: "Pas de revente de données. Pas de tracking publicitaire. Votre business reste votre business." },
            ].map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="p-8 rounded-[24px] bg-white/[0.02] border border-white/[0.06]"
              >
                <div className="w-10 h-10 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center mb-5">
                  <span className="text-white/40 text-lg font-light">{String(i + 1).padStart(2, "0")}</span>
                </div>
                <h3 className="text-lg text-white font-medium tracking-tight">{item.title}</h3>
                <p className="mt-3 text-white/35 text-sm leading-relaxed">{item.text}</p>
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
              <a key={link.label} href={link.href} className="text-white/25 hover:text-white/50 text-xs uppercase tracking-widest transition-colors font-light">
                {link.label}
              </a>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          CTA FINAL
         ══════════════════════════════════════════════════════ */}
      <section className="relative py-24 md:py-32 bg-[#020305] overflow-hidden px-6 sm:px-16 md:px-24">
        <div className="max-w-3xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl md:text-5xl font-light text-white tracking-tighter font-[family-name:var(--font-outfit)]">
              Prêt à automatiser <span className="font-semibold">votre croissance</span> ?
            </h2>
            <p className="mt-6 text-white/35 text-base md:text-lg max-w-xl mx-auto font-light leading-relaxed">
              Commencez gratuitement. Aucune carte bancaire requise. Résultats visibles dès le premier jour.
            </p>

            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <button
                onClick={() => onStart("signup")}
                className="group px-10 py-5 bg-orange-500 text-white rounded-full font-bold text-[13px] uppercase tracking-widest hover:bg-orange-600 hover:scale-105 transition-all duration-300 shadow-2xl shadow-orange-500/20 flex items-center gap-3"
              >
                Créer mon compte
                <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
              </button>
              <button
                onClick={() => onStart("login")}
                className="px-8 py-5 text-white/40 hover:text-white rounded-full font-light text-[12px] uppercase tracking-widest transition-colors"
              >
                J&apos;ai déjà un compte
              </button>
            </div>
          </motion.div>
        </div>

        {/* Footer minimal */}
        <div className="mt-24 pt-8 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4 max-w-6xl mx-auto">
          <div className="flex items-center gap-3">
            <FlareMark tone="dark" className="w-5" />
            <span className="text-white/20 text-xs font-light tracking-[0.2em] uppercase">RAM&apos;S FLARE</span>
          </div>
          <div className="flex items-center gap-6">
            {[
              { label: "Confidentialité", href: "#" },
              { label: "CGU", href: "#" },
            ].map((link) => (
              <a key={link.label} href={link.href} className="text-white/15 hover:text-white/30 text-[10px] uppercase tracking-widest font-light transition-colors">
                {link.label}
              </a>
            ))}
          </div>
          <p className="text-white/15 text-[10px] uppercase tracking-widest font-light">
            Conçu par RAM&apos;S FLARE — Madagascar
          </p>
        </div>
      </section>

      <style jsx global>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        html { scroll-behavior: smooth; }
      `}</style>
    </div>
  );
}
