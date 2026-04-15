"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { ArrowDown, ArrowRight, Zap, MessageSquare, BarChart3, Bot, Menu, X, Download, Instagram, Mail, Facebook, TrendingUp, Globe, Search, Linkedin } from "lucide-react";
import { motion, useSpring, useTransform, useScroll, useMotionValueEvent, AnimatePresence, useMotionValue, useMotionTemplate } from "framer-motion";
import dynamic from "next/dynamic";
import React from "react";
import FlareMark from "./FlareMark";
import { ThemePreference } from "@/lib/theme";

// SplineScene is a browser-only 3D engine wrapper — must stay client-side only
// Using a local wrapper avoids package export resolution issues during SSG
const Spline = dynamic(() => import("./SplineScene"), {
  ssr: false,
  loading: () => <div className="landing-spline-fallback w-full h-full" />,
});

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

/* Cinematic Blur-on-Scroll Component */
function BlurScrollText({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });

  const blur = useTransform(scrollYProgress, [0, 0.5, 1], [8, 0, 8]);
  const opacity = useTransform(scrollYProgress, [0, 0.4, 0.6, 1], [0, 1, 1, 0]);

  return (
    <motion.div ref={ref} style={{ filter: useTransform(blur, (v) => `blur(${v}px)`), opacity }} className={className}>
      {children}
    </motion.div>
  );
}

/* Animated Chat Simulation Component */
function ChatSimulation({ scenarioId }: { scenarioId: number }) {
  const [messages, setMessages] = useState<any[]>([]);
  
  const SCENARIOS = [
    {
      id: 0,
      title: "Ventes (24/7)",
      messages: [
        { type: "user", text: "Bonjour ! Est-ce que le sac modèle X est encore dispo ?" },
        { type: "bot", text: "Bonjour ! Un instant, je vérifie nos stocks... 🤖", delay: 1000 },
        { type: "bot", text: "OUI ! Il nous en reste 3 en stock. Il est à 45 000 Ar.", delay: 2500 },
        { type: "bot", options: ["Commander", "Voir photos", "Livraison ?"], delay: 3500 },
      ]
    },
    {
      id: 1,
      title: "Marketing IA",
      messages: [
        { type: "bot", text: "🔥 OFFRE FLASH ! -20% sur toute la collection aujourd'hui.", delay: 500 },
        { type: "user", text: "C'est valable pour la livraison à domicile ?" },
        { type: "bot", text: "Absolument ! Entrez votre quartier pour estimer les frais de livraison.", delay: 2000 },
        { type: "bot", options: ["Analakely", "Ivato", "Tamatave"], delay: 3000 },
      ]
    },
    {
      id: 2,
      title: "Support Client",
      messages: [
        { type: "user", text: "Ma commande n'est pas encore arrivée." },
        { type: "bot", text: "Je suis navré ! Je regarde tout de suite votre statut de livraison.", delay: 1000 },
        { type: "bot", text: "Votre colis est actuellement avec le livreur. Arrivée prévue dans 15 min.", delay: 2500 },
        { type: "bot", text: "Voulez-vous le numéro du livreur ?", delay: 3500 },
      ]
    }
  ];

  useEffect(() => {
    setMessages([]);
    const currentScenario = SCENARIOS.find(s => s.id === scenarioId);
    if (!currentScenario) return;

    const timers = currentScenario.messages.map((msg, i) => {
      return setTimeout(() => {
        setMessages(prev => [...prev, msg]);
      }, msg.delay || (i * 1000));
    });

    return () => timers.forEach(t => clearTimeout(t));
  }, [scenarioId]);

  return (
    <div className="flex flex-col gap-4 p-6 h-full font-sans">
      <AnimatePresence>
        {messages.map((msg, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className={`flex flex-col ${msg.type === 'user' ? 'items-end' : 'items-start'}`}
          >
            {msg.text && (
              <div className={`max-w-[85%] px-4 py-3 rounded-2xl text-xs font-medium shadow-sm leading-relaxed ${
                msg.type === 'user' 
                  ? 'bg-orange-500 text-white rounded-tr-none' 
                  : 'bg-white border border-black/5 text-black rounded-tl-none'
              }`}>
                {msg.text}
              </div>
            )}
            
            {msg.options && (
              <div className="flex flex-wrap gap-2 mt-2">
                {msg.options.map((opt: string, optI: number) => (
                  <button key={optI} className="px-3 py-1.5 rounded-full border border-orange-500/30 bg-orange-500/5 text-orange-600 text-[10px] font-black uppercase hover:bg-orange-500 hover:text-white transition-all">
                    {opt}
                  </button>
                ))}
              </div>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
      
      {/* Typing Indicator */}
      {SCENARIOS.find(s => s.id === scenarioId)?.messages.length !== messages.length && (
        <motion.div 
           initial={{ opacity: 0 }}
           animate={{ opacity: 1 }}
           className="flex gap-1 p-3 bg-white border border-black/5 rounded-2xl w-12"
        >
          <div className="w-1.5 h-1.5 bg-black/20 rounded-full animate-bounce" style={{ animationDelay: '0s' }} />
          <div className="w-1.5 h-1.5 bg-black/20 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
          <div className="w-1.5 h-1.5 bg-black/20 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
        </motion.div>
      )}
    </div>
  );
}

/* Magnetic Wrapper for Interactive Elements */
function Magnetic({ children, intensity = 0.35 }: { children: React.ReactNode; intensity?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springX = useSpring(x, { stiffness: 150, damping: 15 });
  const springY = useSpring(y, { stiffness: 150, damping: 15 });

  const handleMouseMove = (e: MouseEvent) => {
    if (!ref.current) return;
    const { clientX, clientY } = e;
    const { left, top, width, height } = ref.current.getBoundingClientRect();
    const centerX = left + width / 2;
    const centerY = top + height / 2;
    const distanceX = clientX - centerX;
    const distanceY = clientY - centerY;

    if (Math.abs(distanceX) < width * 1.5 && Math.abs(distanceY) < height * 1.5) {
      x.set(distanceX * intensity);
      y.set(distanceY * intensity);
    } else {
      x.set(0);
      y.set(0);
    }
  };

  useEffect(() => {
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  return (
    <motion.div ref={ref} style={{ x: springX, y: springY }}>
      {children}
    </motion.div>
  );
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
  const [activeFeature, setActiveFeature] = useState<number | null>(0);
  const [activeScenario, setActiveScenario] = useState(0);

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

  const handleInstallClick = () => {
    window.location.href = "/download";
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
    { 
      name: "Jean P.", 
      role: "Restaurateur", 
      text: "Gérer les réservations sur Messenger était un enfer. Maintenant, FLARE s'en occupe tout seul.",
      initials: "JP"
    },
    { 
      name: "Fanja M.", 
      role: "Coach Business", 
      text: "La génération de contenu visuel est bluffante. Je gagne un temps précieux sur Instagram.",
      initials: "FM"
    },
    { 
      name: "Tahina Q.", 
      role: "Start-up Founder", 
      text: "Un OS digital qui comprend le marché Malgache. Enfin une solution adaptée à nos besoins.",
      initials: "TQ"
    },
  ];

  /* ── Plateformes Connectées (Glassmorphic Orbit) ── */
  const MODULES_INFO = [
    {
      id: 0,
      title: "Site Web",
      description: "Le Widget FLARE s'intègre à votre site pour accueillir les visiteurs et conclure les ventes en direct de façon fluide.",
      promise: "Conversion Directe",
      color: "text-[#f97316]",
      bgGlow: "rgba(249, 115, 22, 0.15)"
    },
    {
      id: 1,
      title: "Google",
      description: "Synchronisez vos fiches produits et vos avis Google Business. Soyez trouvé et convertissez quand ils cherchent.",
      promise: "Visibilité Moteur",
      color: "text-[#4285F4]",
      bgGlow: "rgba(66, 133, 244, 0.15)"
    },
    {
      id: 2,
      title: "Facebook",
      description: "Capturez les leads de vos publicités Facebook en un clic avec des relances Messenger scénarisées et intelligentes.",
      promise: "Acquisition Sociale",
      color: "text-[#1877F2]",
      bgGlow: "rgba(24, 119, 242, 0.15)"
    },
    {
      id: 3,
      title: "Instagram",
      description: "Convertissez vos abonnés : le bot répond automatiquement à vos DMs et commente directement sous vos Reels et Posts.",
      promise: "Engagement Actif",
      color: "text-[#E4405F]",
      bgGlow: "rgba(228, 64, 95, 0.15)"
    },
    {
      id: 4,
      title: "LinkedIn",
      description: "Automatisez votre prospection B2B. Suscitez l'intérêt et qualifiez vos leads professionnels avec des approches ultra-ciblées.",
      promise: "Réseautage B2B",
      color: "text-[#0A66C2]",
      bgGlow: "rgba(10, 102, 194, 0.15)"
    }
  ];

  /* --- Avantages concrets (Simplifiés) --- */
  const ADVANTAGES = [
    { number: "01", title: "Zéro technique", text: "Activé par nos experts en 15 min." },
    { number: "02", title: "Accompagnement", text: "On configure tout avec vous." },
    { number: "03", title: "Mémoire IA", text: "Elle apprend vos prix et votre ton." },
    { number: "04", title: "Pilote Auto", text: "Répond et vend pendant vos repos." },
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
    hidden: { opacity: 0, y: 30, scale: 0.95, filter: "blur(10px)" },
    visible: { 
      opacity: 1, 
      y: 0,
      scale: 1,
      filter: "blur(0px)",
      transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] }
    }
  };

  return (
    <div
      ref={containerRef}
      id="hero"
      className="landing-theme-scope landing-shell relative w-full h-screen overflow-y-auto no-scrollbar font-sans select-none"
    >
      {/* --- Sticky Navbar --- */}
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
                <Magnetic key={link.id}>
                  <button
                    onClick={() => {
                      const el = document.getElementById(link.id);
                      if (el) el.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className="landing-nav-link text-[10px] uppercase transition-colors font-medium pb-1"
                  >
                    {link.label}
                  </button>
                </Magnetic>
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
        <div className="relative z-10 w-full flex flex-col px-6 pt-2 pb-4 md:px-12 lg:px-24 sm:pt-0 sm:pb-6">
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
                <div className="landing-mark-frame absolute inset-0 rounded-[30%] border border-black/5 bg-[radial-gradient(circle_at_30%_30%,rgba(0,0,0,0.05),rgba(0,0,0,0.02)_55%,transparent_100%)] shadow-[0_0_50px_rgba(0,0,0,0.03)]" />
                <FlareMark tone="light" className="w-8 md:w-14" priority />
              </motion.div>
              <div className="flex flex-col justify-center">
                <span className="landing-brand-title text-lg md:text-3xl uppercase leading-none font-black text-black">FLARE AI</span>
                <span className="landing-brand-subtitle mt-1 uppercase md:mt-3 font-bold text-black/60">Votre business en pilote automatique</span>
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

          {/* ── Hero Content (AIDA Marketing Flow) ── */}
          <main className="flex-1 flex flex-col justify-center min-h-[70vh] relative z-20 pointer-events-none">
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate={isLoaded ? "visible" : "hidden"}
              className="max-w-3xl pt-10 md:pt-20 relative z-30 pointer-events-auto"
            >
              {/* 1. ATTENTION (Headline) */}
              <motion.h1
                variants={itemVariants}
                style={{ rotateX, rotateY }}
                className="landing-headline text-[38px] sm:text-[56px] md:text-[84px] leading-[1.05] md:leading-[1] perspective-1000 font-[family-name:var(--font-outfit)]"
              >
                {/* Scroll-Scrubbed Reveal */}
                {"Simplifiez. Produisez.".split(" ").map((word, i) => {
                  const wordScroll = useTransform(scrollYProgress, [0, 0.1 + i * 0.05], [0, 1]);
                  const wordBlur = useTransform(wordScroll, [0, 1], [15, 0]);
                  return (
                    <motion.span
                      key={i}
                      style={{ opacity: wordScroll, filter: useMotionTemplate`blur(${wordBlur}px)` }}
                      className="inline-block"
                    >
                      {word}&nbsp;
                    </motion.span>
                  );
                })}
                <br />
                <motion.span
                  style={{ 
                    opacity: useTransform(scrollYProgress, [0, 0.1], [1, 1]),
                    scale: useTransform(scrollYProgress, [0, 0.1], [1, 1.05])
                  }}
                  className="font-black tracking-tight text-orange-500 inline-block drop-shadow-xl"
                >
                  Automatisez.
                </motion.span>
              </motion.h1>

              {/* 2. INTEREST (Subtitle) */}
              <div className="w-full mt-6 mb-8 lg:mb-10 lg:mt-8">
                <motion.p 
                  variants={itemVariants}
                  className="landing-copy text-sm md:text-xl max-w-xl leading-relaxed text-black font-medium"
                >
                  <BlurScrollText>
                    La plateforme tout-en-un qui exécute vos <strong>ventes</strong>, vos <strong>contenus</strong> et vos <strong>documents</strong> pour vous.
                    Activé en <strong>15 min</strong> par l&apos;équipe FLARE.
                  </BlurScrollText>
                </motion.p>
              </div>

              {/* 3. ACTION (CTAs directly in flow) */}
              <motion.div 
                variants={itemVariants}
                className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6 mb-16"
              >
                <motion.button
                  onClick={() => onStart("signup")}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="landing-cta-hero group relative flex w-full sm:w-auto items-center justify-center gap-3 rounded-full bg-orange-500 px-8 py-5 md:px-10 md:py-5 text-[14px] font-black uppercase tracking-widest transition-all duration-300 shadow-[0_20px_40px_rgba(249,115,22,0.4)] hover:bg-orange-600 hover:shadow-[0_20px_50px_rgba(249,115,22,0.6)] border border-orange-400"
                >
                  <motion.div
                    className="absolute inset-0 rounded-full bg-white opacity-0 group-hover:opacity-20"
                    initial={false}
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 1, repeat: Infinity }}
                  />
                  Essayer gratuitement
                  <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                </motion.button>

                <button
                  onClick={handleInstallClick}
                  className="flex items-center justify-center gap-3 rounded-full border-2 border-black/10 bg-white/50 backdrop-blur-md px-8 py-4 md:py-5 text-[13px] font-bold uppercase transition-all hover:bg-white hover:border-black/20 hover:scale-105 w-full sm:w-auto"
                >
                  <Download size={16} className="text-black/60" />
                  Installer l&apos;app
                </button>
              </motion.div>

              {/* 4. DESIRE / VALIDATION (Metrics) */}
              <motion.div
                variants={containerVariants}
                className="flex flex-wrap gap-8 md:gap-16 pt-8 border-t border-black/10"
              >
                {METRICS.map((m, i) => (
                  <motion.div key={i} variants={itemVariants} className="flex flex-col">
                    <span className="landing-metric-value text-3xl md:text-5xl font-black tracking-tighter font-[family-name:var(--font-outfit)] text-black">{m.value}</span>
                    <span className="landing-metric-label mt-1 text-[10px] md:text-xs uppercase font-extrabold text-black/60 tracking-widest">{m.label}</span>
                  </motion.div>
                ))}
              </motion.div>
            </motion.div>
          </main>
        </div>

        {/* Trust Section ends here */}
      </section>

      {/* ══════════════════════════════════════════════════════
          SOLUTIONS SECTION (BOTNATION STYLE SIMULATION)
         ══════════════════════════════════════════════════════ */}
      <section id="solutions" className="relative z-20 py-24 sm:py-32 bg-[#F9F7F2] border-t border-black/5 overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 md:px-12 lg:px-24">
          
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-6xl font-black text-black mt-4 font-[family-name:var(--font-outfit)]">FLARE AI en action.</h2>
          </div>

          {/* Scenario Tabs */}
          <div className="flex flex-wrap justify-center gap-4 mb-20">
            {["Trouver des clients", "Vendre mes produits", "Répondre aux questions"].map((tab, i) => (
              <button
                key={i}
                onClick={() => setActiveScenario(i)}
                className={`px-8 py-4 rounded-full font-black uppercase tracking-widest transition-all duration-300 ${
                  activeScenario === i 
                    ? 'bg-black shadow-2xl scale-105 shadow-black/50' 
                    : 'bg-white border border-black/10 hover:border-black/30 text-black/60'
                }`}
              >
                <span className={`text-[11px] sm:text-xs tracking-widest inline-block ${activeScenario === i ? 'invert' : ''}`}>
                  {tab}
                </span>
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            {/* Left: Device Mockup */}
            <motion.div
              key={activeScenario}
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              className="relative aspect-[9/16] max-w-[320px] mx-auto lg:ml-0 rounded-[3rem] border-[8px] border-black bg-white shadow-[0_50px_100px_rgba(0,0,0,0.1)] overflow-hidden"
            >
              {/* Phone Notch */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-black rounded-b-2xl z-20" />
              
              {/* App Bar Simulation */}
              <div className="p-6 pt-10 border-b border-black/5 flex items-center gap-4 bg-white/80 backdrop-blur-md">
                <div className="w-10 h-10 rounded-full bg-orange-500 flex items-center justify-center text-white">
                  <FlareMark tone="light" className="w-5" />
                </div>
                <div>
                  <h4 className="text-sm font-black text-black leading-none">FLARE Business Bot</h4>
                  <span className="text-[10px] text-green-500 font-bold">Online • FLARE AI Actif</span>
                </div>
              </div>

              {/* Chat Content */}
              <div className="h-[calc(100%-100px)] bg-black/[0.02]">
                 <ChatSimulation scenarioId={activeScenario} />
              </div>
            </motion.div>

            {/* Right: Content & Value Prop */}
            <div className="flex flex-col gap-8">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeScenario}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="space-y-6"
                >
                  <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-orange-500/10 text-orange-600 mb-8 border border-orange-500/20">
                    <Zap size={32} />
                  </div>
                  <h3 className="text-3xl md:text-5xl font-black text-black leading-tight">
                    {activeScenario === 0 && "Trouvez vos clients sans lever le petit doigt."}
                    {activeScenario === 1 && "Vendez même quand vous dormez."}
                    {activeScenario === 2 && "Répondez à vos clients 24h/24."}
                  </h3>
                  <p className="text-lg md:text-xl text-black/70 font-medium leading-relaxed max-w-xl">
                    {activeScenario === 0 && "FLARE accueille vos visiteurs, comprend leurs besoins et vous envoie les contacts prêts à acheter."}
                    {activeScenario === 1 && "Le bot donne vos prix, vérifie vos stocks et guide l'acheteur vers le paiement."}
                    {activeScenario === 2 && "Gagnez du temps. FLARE répond aux questions sur vos horaires, vos prix et vos livraisons."}
                  </p>
                  
                  <div className="pt-8">
                    <button
                       onClick={() => onStart("signup")}
                       className="group flex items-center gap-4 text-sm font-black uppercase tracking-widest text-orange-600 hover:gap-6 transition-all"
                    >
                      Essayer ce scénario
                      <ArrowRight size={20} />
                    </button>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          ECOSYSTEM HUB (STANDARD LAYOUT)
         ══════════════════════════════════════════════════════ */}
      <section className="relative py-24 sm:py-32 overflow-hidden border-t border-black/5 bg-white">
        <div className="max-w-7xl mx-auto px-6 md:px-12 lg:px-24">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24 items-center">
            
            {/* Left: Interactive Platform Grid */}
            <div className="relative">
              {/* Soft background glow for the 'glass' base */}
              <div className="absolute inset-0 bg-orange-500/5 rounded-[4rem] blur-3xl -z-10" />
              
              <div className="grid grid-cols-2 gap-4">
                {[
                  { type: "icon", icon: Globe, label: "Site Web", color: "#f97316", id: 0 },
                  { type: "img", src: "https://upload.wikimedia.org/wikipedia/commons/c/c1/Google_%22G%22_logo.svg", label: "Google", color: "#4285F4", id: 1 },
                  { type: "img", src: "https://upload.wikimedia.org/wikipedia/commons/b/b8/2021_Facebook_icon.svg", label: "Facebook", color: "#1877F2", id: 2 },
                  { type: "img", src: "https://upload.wikimedia.org/wikipedia/commons/e/e7/Instagram_logo_2016.svg", label: "Instagram", color: "#E4405F", id: 3 },
                  { type: "img", src: "https://upload.wikimedia.org/wikipedia/commons/c/ca/LinkedIn_logo_initials.png", label: "LinkedIn", color: "#0A66C2", id: 4 },
                ].map((platform, i) => (
                  <motion.div
                    key={i}
                    onClick={() => setActiveFeature(platform.id)}
                    whileHover={{ scale: 1.05 }}
                    className={`cursor-pointer p-6 rounded-[2rem] transition-all duration-300 flex flex-col items-center gap-4 border
                      ${activeFeature === platform.id 
                         ? 'bg-white shadow-[0_20px_40px_rgba(0,0,0,0.08)] border-black/10 z-10' 
                         : 'bg-black/[0.02] border-transparent hover:bg-black/[0.04]'
                      }
                      ${i === 4 ? 'col-span-2 max-w-[50%] mx-auto w-full' : ''}
                    `}
                  >
                    {platform.type === "icon" && platform.icon ? (
                      <platform.icon size={32} style={{ stroke: platform.color }} strokeWidth={2.5} />
                    ) : (
                      <img src={platform.src} alt={platform.label} className="w-8 h-8 object-contain" />
                    )}
                    <span className="text-[10px] sm:text-xs font-black uppercase text-black/80 tracking-widest">{platform.label}</span>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Right: Content dynamically updated */}
            <div className="flex flex-col">
              <span className="landing-section-kicker text-[10px] md:text-xs uppercase font-medium mb-6">Plateformes intégrées</span>
              <h2 className="text-4xl md:text-5xl font-black text-black leading-tight mb-8 font-[family-name:var(--font-outfit)]">
                Où que soient vos clients, <br/>
                <span className="text-orange-500">FLARE est là.</span>
              </h2>

              <div className="relative min-h-[250px]">
                <AnimatePresence mode="wait">
                  {activeFeature !== null && (
                    <motion.div
                      key={activeFeature}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.3 }}
                      className="absolute inset-0"
                    >
                      <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-black/5 border border-black/10 mb-6">
                        <Zap size={14} className={MODULES_INFO[activeFeature].color} />
                        <span className="text-[10px] uppercase font-black tracking-widest text-black/80">
                          {MODULES_INFO[activeFeature].title}
                        </span>
                      </div>
                      
                      <p className="text-[15px] sm:text-lg text-black/70 font-medium leading-relaxed mb-8 max-w-lg">
                        {MODULES_INFO[activeFeature].description}
                      </p>

                      <div className="p-5 rounded-[1.5rem] bg-[#F9F7F2] border border-black/5 inline-block">
                        <p className="text-[10px] font-black uppercase tracking-widest text-black/40 mb-1">Impact direct</p>
                        <p className={`text-[15px] sm:text-lg font-black ${MODULES_INFO[activeFeature].color}`}>
                          {MODULES_INFO[activeFeature].promise}
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>
      </section>
      {/* ══════════════════════════════════════════════════════
          ADVANTAGES SECTION
         ══════════════════════════════════════════════════════ */}
      {/* ══════════════════════════════════════════════════════
          COMMAND CENTER (DASHBOARD ILLUSTRATIONS)
         ══════════════════════════════════════════════════════ */}
      <section id="advantages" className="relative z-20 py-24 sm:py-32 bg-white border-y border-black/5 overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 md:px-12 lg:px-24">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            {/* Left: Direct Text Content */}
            <div>
              <motion.div
                initial={{ opacity: 0, x: -30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                className="max-w-xl"
              >
                <span className="text-xs font-black text-orange-600 uppercase tracking-widest">Performance</span>
                <h2 className="text-4xl md:text-6xl font-black text-black mt-4 mb-8 font-[family-name:var(--font-outfit)]">
                  Tout est sous <span className="text-orange-500">contrôle.</span>
                </h2>
                
                <div className="space-y-10">
                  {ADVANTAGES.map((adv, index) => (
                    <motion.div 
                      key={index}
                      initial={{ opacity: 0, y: 10 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className="flex gap-6 group"
                    >
                      <div className="text-2xl font-black text-orange-500/20 group-hover:text-orange-500 transition-colors">
                        {adv.number}
                      </div>
                      <div>
                        <h3 className="text-xl font-black text-black mb-2">{adv.title}</h3>
                        <p className="text-black/60 font-medium">{adv.text}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            </div>

            {/* Right: Motion Graphics Hub (Refined Maria Dashboard Style) */}
            <div className="relative">
              <div className="absolute inset-0 bg-orange-500/5 rounded-[4rem] blur-3xl -z-10" />
              
              <div className="grid grid-cols-2 gap-6 relative z-10">
                {/* User Welcome & Stats Stack */}
                <motion.div 
                  whileHover={{ y: -5, scale: 1.02 }}
                  className="p-8 rounded-[3rem] bg-white border border-black/5 shadow-2xl flex flex-col gap-6"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-black flex items-center justify-center text-white text-xs font-black">M</div>
                    <div>
                      <h4 className="text-sm font-black text-black leading-tight">Bonjour Maria</h4>
                      <p className="text-[10px] text-black/40 font-bold uppercase tracking-tight">Ecom Pilot Activé</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {/* Stat Items with SVG Circles */}
                    {[
                      { label: "Ventes", val: "$1,250", pct: 75, color: "#f97316", bg: "rgba(249, 115, 22, 0.05)" },
                      { label: "Profit", val: "+42%", pct: 40, color: "#22c55e", bg: "rgba(34, 197, 94, 0.05)" }
                    ].map((item, i) => (
                      <div key={i} className="p-4 rounded-2xl flex items-center justify-between" style={{ background: item.bg }}>
                        <div>
                          <p className="text-[10px] font-black uppercase text-black/40">{item.label}</p>
                          <p className="text-xl font-black text-black">{item.val}</p>
                        </div>
                        <div className="relative w-10 h-10">
                           <svg className="w-full h-full transform -rotate-90">
                             <circle cx="20" cy="20" r="16" stroke="currentColor" strokeWidth="4" fill="transparent" className="text-black/5" />
                             <motion.circle 
                               cx="20" cy="20" r="16" stroke={item.color} strokeWidth="4" fill="transparent"
                               strokeDasharray="100"
                               initial={{ strokeDashoffset: 100 }}
                               whileInView={{ strokeDashoffset: 100 - item.pct }}
                               transition={{ duration: 1.5, ease: "circOut", delay: 0.5 + (i * 0.2) }}
                             />
                           </svg>
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>

                {/* Revenue Bar Chart (Second Inspiration) */}
                <motion.div 
                  whileHover={{ y: -5, scale: 1.02 }}
                  className="p-8 rounded-[3rem] bg-[#020305] text-white shadow-2xl"
                >
                  <div className="mb-6">
                    <span className="text-[10px] font-black uppercase text-white/40 tracking-widest">Revenus</span>
                    <div className="text-3xl font-black mt-2 text-white">4.8k</div>
                  </div>
                  
                  <div className="flex items-end justify-between h-32 gap-2">
                    {[40, 70, 45, 90, 65, 80].map((h, i) => (
                      <div key={i} className="flex-1 bg-white/5 rounded-t-lg relative overflow-hidden h-full">
                        <motion.div 
                          initial={{ height: 0 }}
                          whileInView={{ height: `${h}%` }}
                          transition={{ duration: 1, delay: i * 0.1, ease: "circOut" }}
                          className="absolute bottom-0 left-0 w-full bg-orange-500 rounded-t-lg"
                        />
                      </div>
                    ))}
                  </div>
                </motion.div>

                {/* Live Activity Console (Full Width) */}
                <motion.div 
                  whileHover={{ y: -3, scale: 1.01 }}
                  className="col-span-2 p-8 rounded-[3rem] bg-[#F9F7F2] border border-black/5"
                >
                  <div className="flex items-center justify-between mb-8">
                    <h4 className="text-xs font-black uppercase text-black tracking-widest">Pilotage en temps réel</h4>
                    <motion.div 
                      animate={{ opacity: [0.3, 1, 0.3] }} 
                      transition={{ duration: 2, repeat: Infinity }}
                      className="w-2 h-2 rounded-full bg-green-500" 
                    />
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {[
                      { action: "Réponse Messenger", target: "Sales", time: "maint." },
                      { action: "Update WhatsApp", target: "Price", time: "2m" },
                      { action: "Lead Capturé", target: "Meta", time: "5m" }
                    ].map((item, i) => (
                      <motion.div 
                        key={i}
                        initial={{ opacity: 0, y: 10 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.15 }}
                        className="p-5 rounded-2xl bg-white shadow-sm border border-black/5 flex flex-col gap-2"
                      >
                        <div className="p-2 w-fit rounded-lg bg-orange-500/10 text-orange-600">
                           <Zap size={14} />
                        </div>
                        <div>
                          <p className="text-[12px] font-black text-black leading-tight">{item.action}</p>
                          <p className="text-[10px] text-black/40 font-bold uppercase">{item.target} • {item.time}</p>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Trust / Reviews Section (Draggable Carousel) ── */}
      <section className="relative z-20 px-6 py-20 md:px-12 lg:px-24 overflow-hidden border-y border-black/5 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="mb-12 md:mb-16">
            <span className="text-xs font-black text-orange-600 uppercase tracking-widest">Témoignages</span>
            <h2 className="text-3xl md:text-5xl font-black text-black mt-2">Ils nous font confiance.</h2>
          </div>

          <motion.div 
            drag="x"
            dragConstraints={{ right: 0, left: isMobile ? -1400 : (typeof window !== 'undefined' && window.innerWidth < 1024 ? -1600 : -1800) }}
            dragElastic={0.1}
            className="flex gap-8 cursor-grab active:cursor-grabbing pb-12"
          >
            {REVIEWS.map((rev, i) => (
              <motion.div
                key={i}
                whileHover={{ y: -10, scale: 1.02 }}
                className="relative min-w-[300px] sm:min-w-[380px] lg:min-w-[450px] p-10 md:p-14 rounded-[40px] bg-white border border-black/10 shadow-[0_20px_60px_rgba(0,0,0,0.05)] transition-all duration-500 hover:shadow-2xl hover:border-orange-500/20"
              >
                <div className="flex items-center gap-6 mb-10">
                  <div className="w-16 h-16 rounded-3xl bg-orange-500/10 flex items-center justify-center text-orange-600 font-black text-xl">
                    {rev.initials}
                  </div>
                  <div>
                    <h4 className="text-lg font-black text-black">{rev.name}</h4>
                    <span className="text-xs uppercase text-orange-600 font-black tracking-widest">{rev.role}</span>
                  </div>
                </div>
                
                <p className="text-lg md:text-2xl leading-relaxed text-black font-medium italic opacity-90">&quot;{rev.text}&quot;</p>
                
                <div className="absolute top-8 right-12 text-black/5 text-8xl font-black">”</div>
              </motion.div>
            ))}
          </motion.div>
          
          <div className="flex items-center gap-4 text-xs font-black text-black/40 uppercase tracking-widest">
            <ArrowRight size={16} />
            Faites glisser pour en voir plus
          </div>
        </div>
      </section>

      {/* ── Security / Reliability Section ── */}
      <section className="relative z-20 px-6 py-20 md:px-12 lg:px-24 bg-gradient-to-b from-transparent to-white/[0.01]">
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
          AVIS & CONFIANCE
         ══════════════════════════════════════════════════════ */}
      <section className="landing-section-muted relative overflow-hidden border-t border-white/5 px-6 py-24 md:px-12 lg:px-24 md:py-32">
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

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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

      <section
        id="pricing"
        className="landing-section-muted relative overflow-hidden border-t border-white/5 px-6 py-24 md:px-12 lg:px-24 md:py-32"
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
              Payez par <span className="font-semibold text-orange-500">MVola</span> ou <span className="font-semibold text-orange-500">Orange Money</span>.
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
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8"
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
                className={`relative rounded-[32px] border p-8 md:p-10 flex flex-col gap-6 transition-all duration-500 group ${
                  plan.highlight
                    ? "border-orange-500/40 bg-orange-500/[0.03] shadow-2xl shadow-orange-500/10 scale-[1.02] z-10"
                    : "border-black/[0.06] bg-black/[0.01] hover:border-black/[0.12] hover:bg-white/50 backdrop-blur-xl"
                }`}
              >
                <div className="absolute inset-0 z-0 overflow-hidden rounded-[32px] pointer-events-none">
                  <div className="absolute inset-0 opacity-20 group-hover:opacity-100 transition-opacity duration-700 blur-[30px]">
                    <motion.div
                      animate={{ x: ["-100%", "200%"], scale: [1, 1.2, 1] }}
                      transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                      className={`absolute -inset-y-10 w-1/2 -skew-x-12 ${plan.highlight ? "bg-orange-500/50" : "bg-black/20"}`}
                    />
                  </div>
                </div>

                {plan.highlight && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 rounded-full bg-orange-500 px-6 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] !text-white shadow-xl z-20">
                    Le plus populaire
                  </div>
                )}
                <div className="relative z-10">
                  <span className="landing-section-kicker text-[10px] uppercase font-bold text-orange-600">{plan.name}</span>
                  <div className="mt-4 flex items-baseline gap-1">
                    <span className="landing-headline text-5xl md:text-6xl font-black font-[family-name:var(--font-outfit)] text-black">{plan.price}</span>
                    <span className="landing-copy text-sm font-bold text-black">Ar / mois</span>
                  </div>
                  <p className="landing-card-copy mt-2 text-xs font-bold text-black uppercase">{plan.subtitle}</p>
                </div>
                <ul className="relative z-10 flex flex-col gap-4 flex-1 my-4">
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
                  className={`relative z-10 w-full rounded-2xl py-5 text-[11px] font-bold uppercase tracking-widest transition-all duration-300 ${
                    plan.highlight
                      ? "bg-orange-500 !text-white shadow-lg shadow-orange-500/20 hover:bg-orange-600 hover:scale-[1.02]"
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
            className="mt-10 text-center landing-card-copy text-xs font-bold text-black"
          >
            Paiement par <strong>MVola</strong> · <strong>Orange Money</strong> · <strong>Airtel Money</strong> · Virement · Cash.<br />
            Activation manuelle par l&apos;équipe FLARE sous 15 min après vérification du paiement.
          </motion.p>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          NOTRE HISTOIRE
         ══════════════════════════════════════════════════════ */}
      <section id="story" className="landing-section-base relative overflow-hidden px-6 py-24 md:px-12 lg:px-24 md:py-32">
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
            {/* Animation Drapeau & Logo FLARE */}
            <motion.div
              variants={itemVariants}
              className="shrink-0 group relative flex flex-col items-center"
            >
              <div className="w-40 h-52 md:w-48 md:h-64 rounded-[32px] overflow-hidden shadow-2xl bg-[#020305] relative flex items-center justify-center border border-black/5 group-hover:shadow-[0_30px_60px_rgba(0,0,0,0.15)] transition-all duration-700">
                {/* Smooth Motion Graphic: Flag Colors */}
                <motion.div 
                  className="absolute inset-0 z-0 opacity-80 mix-blend-screen"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
                >
                  <div className="absolute -top-12 -right-12 w-48 h-48 bg-red-600 rounded-full filter blur-[45px] opacity-80"></div>
                  <div className="absolute -bottom-12 -right-12 w-48 h-48 bg-green-600 rounded-full filter blur-[45px] opacity-80"></div>
                  <div className="absolute top-1/2 -left-12 -translate-y-1/2 w-48 h-48 bg-white rounded-full filter blur-[40px] opacity-90"></div>
                </motion.div>
                
                {/* Flare Logo */}
                <div className="relative z-10 w-20 h-20 md:w-24 md:h-24 drop-shadow-[0_0_20px_rgba(255,255,255,0.4)] invert">
                  <FlareMark tone="light" className="w-full h-full" />
                </div>
              </div>
              <div className="mt-6 text-center">
                <p className="landing-card-title text-sm font-black uppercase tracking-widest text-black">FLARE AI</p>
                <p className="landing-card-copy text-[10px] font-bold text-black/40 uppercase tracking-[0.2em] mt-2">Made in Madagascar</p>
              </div>
            </motion.div>

            {/* Texte à droite */}
            <motion.div
              variants={containerVariants}
              className="flex flex-col gap-8 max-w-xl"
            >
              <motion.p variants={itemVariants} className="landing-copy text-lg md:text-2xl leading-snug font-medium text-black">
                FLARE AI est né d&apos;une vision : permettre à chaque entrepreneur de posséder son propre <span className="text-orange-600">FLARE AI</span>.
              </motion.p>
              <motion.p variants={itemVariants} className="landing-copy text-base md:text-lg leading-relaxed opacity-70">
                Nous ne construisons pas de simples outils, nous bâtissons la technologie qui automatise votre travail quotidien pour vous laisser vous concentrer sur votre croissance.
              </motion.p>
              <motion.p variants={itemVariants} className="landing-copy text-base md:text-lg leading-relaxed opacity-70">
                Notre mission est de rendre l&apos;automatisation digitale accessible à tous.
              </motion.p>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          CTA FINAL
         ══════════════════════════════════════════════════════ */}
      <section className="landing-section-base relative overflow-hidden px-6 py-24 md:px-12 lg:px-24 md:py-32">
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
      </section>

      {/* ══════════════════════════════════════════════════════
          CURVED CONTACT HUB (SOCIAL FOOTER)
         ══════════════════════════════════════════════════════ */}
      <section className="relative z-20 mt-[-80px] overflow-hidden theme-dark-override">
        {/* SVG Curve Transition (Symmetrical Dip) */}
        <div className="relative w-full overflow-hidden leading-[0] fill-[#020305]">
           <svg data-name="Layer 1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 100" preserveAspectRatio="none" className="relative block w-full h-[60px] md:h-[120px]">
             <path d="M0,0 Q600,120 1200,0 V120 H0 Z"></path>
           </svg>
        </div>

        <div className="bg-[#020305] px-6 py-20 md:px-12 lg:px-24">
          <div className="max-w-6xl mx-auto flex flex-col items-center text-center">
            <motion.h2 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-3xl md:text-5xl font-black text-white mb-20"
            >
              Restons <span className="text-orange-500">connectés.</span>
            </motion.h2>

            <div className="flex flex-wrap justify-center items-center gap-12 sm:gap-16 w-full max-w-4xl mb-24 mx-auto">
              {[
                { type: "img", src: "https://upload.wikimedia.org/wikipedia/commons/b/b8/2021_Facebook_icon.svg", label: "Facebook", href: "https://facebook.com", color: "#1877F2" },
                { type: "img", src: "https://upload.wikimedia.org/wikipedia/commons/e/e7/Instagram_logo_2016.svg", label: "Instagram", href: "https://instagram.com", color: "#E4405F" },
                { type: "img", src: "https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg", label: "WhatsApp", href: "https://whatsapp.com", color: "#25D366" },
                { type: "img", src: "https://upload.wikimedia.org/wikipedia/commons/b/be/Facebook_Messenger_logo_2020.svg", label: "Messenger", href: "https://messenger.com", color: "#0084FF" },
                { type: "img", src: "https://upload.wikimedia.org/wikipedia/commons/e/ec/Circle-icons-mail.svg", label: "Email", href: "mailto:contact@flare.mg", color: "#EA4335" },
              ].map((social, i) => (
                <a
                  key={i}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-col items-center gap-4 cursor-pointer"
                >
                  <img src={social.src} alt={social.label} className="w-12 h-12 object-contain" />
                  <span className="text-[12px] font-black uppercase tracking-[0.2em] text-white">
                    {social.label}
                  </span>
                </a>
              ))}
            </div>

            {/* Final Legal Footer */}
            <div className="w-full flex flex-col md:flex-row items-center justify-between pt-12 border-t border-white/10 gap-8">
              <div className="flex items-center gap-3">
                <FlareMark className="w-6" /> {/* Now natively white thanks to SVG override */}
                <span className="text-xs font-black uppercase text-white tracking-widest">FLARE AI</span>
              </div>
              
              <div className="flex flex-wrap justify-center gap-8">
                {[
                  { label: "Confidentialité", href: "#" },
                  { label: "CGU", href: "#" },
                  { label: "Politique Cookies", href: "#" },
                ].map((link) => (
                  <a key={link.label} href={link.href} className="text-[10px] uppercase font-bold text-white/60 hover:text-white transition-colors tracking-widest">
                    {link.label}
                  </a>
                ))}
              </div>

              <p className="text-[10px] font-bold text-white/40 uppercase tracking-[0.2em]">
                © 2026 FLARE AI — Madagascar
              </p>
            </div>
          </div>
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
