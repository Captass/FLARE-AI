"use client";

import { useState, useEffect, useRef, Suspense, useCallback } from "react";
/* eslint-disable @next/next/no-img-element */
import { ArrowDown, ArrowRight, ArrowUpRight, BadgeCheck, BarChart3, Bot, ChevronDown, CheckCircle2, Clock3, Download, Facebook, Globe, Instagram, Linkedin, Mail, Menu, MessageSquare, ShieldCheck, TrendingUp, Workflow, X, Zap } from "lucide-react";
import { motion, useSpring, useTransform, useScroll, useMotionValueEvent, AnimatePresence, useMotionValue, useReducedMotion, type Variants } from "framer-motion";
import dynamic from "next/dynamic";
import React from "react";
import FlareMark from "./FlareMark";

// SplineScene is a browser-only 3D engine wrapper — must stay client-side only
// Using a local wrapper avoids package export resolution issues during SSG
const Spline = dynamic(() => import("./SplineScene"), {
  ssr: false,
  loading: () => (
    <div className="landing-spline-fallback h-full w-full bg-[radial-gradient(circle_at_72%_28%,rgba(255,255,255,0.94),rgba(255,247,237,0.72)_28%,rgba(249,247,242,0.16)_56%,transparent_76%),linear-gradient(180deg,#fbf7f0_0%,#f5ede1_100%)]" />
  ),
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
    if (this.state.hasError) {
      return (
        <div className="landing-spline-fallback h-full w-full bg-[radial-gradient(circle_at_72%_28%,rgba(255,255,255,0.94),rgba(255,247,237,0.72)_28%,rgba(249,247,242,0.16)_56%,transparent_76%),linear-gradient(180deg,#fbf7f0_0%,#f5ede1_100%)]" />
      );
    }
    return this.props.children;
  }
}

/* Preserve the historical hero reveal while keeping Hooks valid. */
function WordReveal({ word, index, scrollYProgress }: { word: string; index: number; scrollYProgress: any }) {
  const wordScroll = useTransform(scrollYProgress, [0, 0.1 + index * 0.05], [0, 1]);
  const wordY = useTransform(wordScroll, [0, 1], [12, 0]);
  const wordScale = useTransform(wordScroll, [0, 1], [0.985, 1]);
  return (
    <motion.span
      style={{ opacity: wordScroll, y: wordY, scale: wordScale }}
      className="inline-block"
    >
      {word}&nbsp;
    </motion.span>
  );
}

/* Animated Chat Simulation Component */
function ChatSimulation({ scenarioId }: { scenarioId: number }) {
  const [messages, setMessages] = useState<any[]>([]);

  const scenarios = useRef([
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
  ]).current;

  useEffect(() => {
    setMessages([]);
    const currentScenario = scenarios.find(s => s.id === scenarioId);
    if (!currentScenario) return;

    const timers = currentScenario.messages.map((msg, i) => {
      return setTimeout(() => {
        setMessages(prev => [...prev, msg]);
      }, msg.delay || (i * 1000));
    });

    return () => timers.forEach(t => clearTimeout(t));
  }, [scenarioId, scenarios]);

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
      {scenarios.find(s => s.id === scenarioId)?.messages.length !== messages.length && (
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

  const handleMouseMove = useCallback((e: MouseEvent) => {
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
  }, [intensity, x, y]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const canHover = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    if (!canHover) return;

    let frame = 0;
    const onMouseMove = (event: MouseEvent) => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        handleMouseMove(event);
      });
    };

    window.addEventListener("mousemove", onMouseMove, { passive: true });
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("mousemove", onMouseMove);
    };
  }, [handleMouseMove]);

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
  const splineAppRef = useRef<any>(null);
  const splineTargetsRef = useRef<{ head: any; eyeL: any; eyeR: any } | null>(null);
  const lastPointerRef = useRef({ x: 0, y: 0 });
  const prefersReducedMotion = useReducedMotion();

  const [isLoaded, setIsLoaded] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [heroSplineReady, setHeroSplineReady] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeFeature, setActiveFeature] = useState<number | null>(0);
  const [activeScenario, setActiveScenario] = useState(0);
  const enableRichEffects = !isMobile && !prefersReducedMotion;
  const shouldRenderHeroSpline = !prefersReducedMotion;

  const { scrollY, scrollYProgress } = useScroll({ container: containerRef });

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
    document.body.classList.add("is-public-landing");
    return () => {
      document.body.classList.remove("is-public-landing");
    };
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    if (mobileMenuOpen) {
      document.body.classList.add("landing-mobile-menu-open");
      return () => {
        document.body.classList.remove("landing-mobile-menu-open");
      };
    }

    document.body.classList.remove("landing-mobile-menu-open");
  }, [mobileMenuOpen]);

  const handleInstallClick = () => {
    window.location.href = "/download";
  };

  const springX = useSpring(0, { stiffness: 150, damping: 20 });
  const springY = useSpring(0, { stiffness: 150, damping: 20 });

  useEffect(() => {
    if (!enableRichEffects || typeof window === "undefined") return;

    let frame = 0;
    const handleMouseMove = (e: MouseEvent) => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        const x = (e.clientX / window.innerWidth - 0.5) * 2;
        const y = (e.clientY / window.innerHeight - 0.5) * 2;

        lastPointerRef.current = { x, y };
        springX.set(x);
        springY.set(y);
      });
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("mousemove", handleMouseMove);
    };
  }, [enableRichEffects, springX, springY]);

  useEffect(() => {
    if (!enableRichEffects || !heroSplineReady || !splineTargetsRef.current) return;

    const updateSpline = () => {
      const x = springX.get();
      const y = springY.get();
      let targets = splineTargetsRef.current;
      if ((!targets?.head && !targets?.eyeL && !targets?.eyeR) && splineAppRef.current) {
        targets = {
          head: splineAppRef.current.findObjectByName("Head"),
          eyeL: splineAppRef.current.findObjectByName("Eye_L") || splineAppRef.current.findObjectByName("Eye Left"),
          eyeR: splineAppRef.current.findObjectByName("Eye_R") || splineAppRef.current.findObjectByName("Eye Right"),
        };
        splineTargetsRef.current = targets;
      }

      if (!targets) return;
      const { head, eyeL, eyeR } = targets;

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
    };

    updateSpline();

    const unsubX = springX.on("change", updateSpline);
    const unsubY = springY.on("change", updateSpline);

    return () => {
      unsubX();
      unsubY();
    };
  }, [enableRichEffects, heroSplineReady, springX, springY]);

  const rotateX = useTransform(springY, (v) => v * -1.5);
  const rotateY = useTransform(springX, (v) => v * 1.5);
  const mousePosX = useTransform(springX, (v) => (v + 1) * 50 + "%");
  const mousePosY = useTransform(springY, (v) => (v + 1) * 50 + "%");
  const heroWordOpacity = useTransform(scrollYProgress, [0, 0.1], [1, 1]);
  const heroWordScale = useTransform(scrollYProgress, [0, 0.1], [1, 1.05]);

  const logoParallaxX = useTransform(springX, (v) => v * 6);
  const logoParallaxY = useTransform(springY, (v) => v * 6);

  function onLoad(app: any) {
    if (!app) return;
    splineAppRef.current = app;
    try {
      splineTargetsRef.current = {
        head: app.findObjectByName("Head"),
        eyeL: app.findObjectByName("Eye_L") || app.findObjectByName("Eye Left"),
        eyeR: app.findObjectByName("Eye_R") || app.findObjectByName("Eye Right"),
      };

      if (isMobile && app.renderer) {
        app.renderer.setPixelRatio(0.65);
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
    setHeroSplineReady(true);
    setIsLoaded(true);
    const { x, y } = lastPointerRef.current;
    springX.set(x);
    springY.set(y);
  }

  /* ── Metrics visibles sur le hero ── */
  const METRICS = [
    { value: "50k+", label: "messages automatisés" },
    { value: "15 min", label: "apres validation" },
    { value: "Support", label: "equipe FLARE incluse" },
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
      text: "Le suivi des messages entrants et des relances nous a rendus beaucoup plus reactifs sur les leads chauds.",
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
      text: "Je vois enfin un parcours clair entre paiement, validation et mise en ligne. C'est concret et rassurant.",
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
      bgGlow: "rgba(249, 115, 22, 0.15)",
      status: "En expansion",
      note: "Brique de plateforme en progression dans l'ecosysteme FLARE."
    },
    {
      id: 1,
      title: "Google",
      description: "Synchronisez vos fiches produits et vos avis Google Business. Soyez trouvé et convertissez quand ils cherchent.",
      promise: "Visibilité Moteur",
      color: "text-[#4285F4]",
      bgGlow: "rgba(66, 133, 244, 0.15)",
      status: "Bientot",
      note: "Vision d'automatisation plus large, non presentee comme flux public principal aujourd'hui."
    },
    {
      id: 2,
      title: "Facebook",
      description: "Capturez les leads de vos publicités Facebook en un clic avec des relances Messenger scénarisées et intelligentes.",
      promise: "Acquisition Sociale",
      color: "text-[#1877F2]",
      bgGlow: "rgba(24, 119, 242, 0.15)",
      status: "Actif aujourd'hui",
      note: "La preuve la plus concrete du moment: chatbot Facebook assiste avec activation FLARE."
    },
    {
      id: 3,
      title: "Instagram",
      description: "Convertissez vos abonnés : le bot répond automatiquement à vos DMs et commente directement sous vos Reels et Posts.",
      promise: "Engagement Actif",
      color: "text-[#E4405F]",
      bgGlow: "rgba(228, 64, 95, 0.15)",
      status: "En expansion",
      note: "Capacite de plateforme en developpement, a distinguer du flux actif aujourd'hui."
    },
    {
      id: 4,
      title: "LinkedIn",
      description: "Automatisez votre prospection B2B. Suscitez l'intérêt et qualifiez vos leads professionnels avec des approches ultra-ciblées.",
      promise: "Réseautage B2B",
      color: "text-[#0A66C2]",
      bgGlow: "rgba(10, 102, 194, 0.15)",
      status: "Vision FLARE",
      note: "Projection de la plateforme d'automatisation, pas promesse de self-serve immediat."
    }
  ];

  /* ── Cas d'usage orientés business ── */
  const USE_CASES = [
    {
      icon: MessageSquare,
      title: "Automatisez vos Ventes",
      description: "Un chatbot Messenger qui répond à vos prospects 24/7 et qualifie les leads. Ne ratez plus aucune vente, même la nuit.",
      cta: "Activer mon assistant",
      prompt: "Configure mon chatbot Facebook pour répondre aux clients automatiquement",
      status: "Actif aujourd'hui",
    },
    {
      icon: Zap,
      title: "Automatisez vos Contenus",
      description: "Générez vos visuels et vidéos TikTok/Facebook en un clic. FLARE s'occupe de la création pour vous rendre visible.",
      cta: "Créer un visuel",
      prompt: "Rédige un post Facebook accrocheur avec un visuel pour promouvoir mes services",
      status: "En expansion",
    },
    {
      icon: BarChart3,
      title: "Automatisez votre Gestion",
      description: "Édition automatique de devis, factures et rapports. Libérez votre temps pour vous concentrer sur vos clients.",
      cta: "Automatiser mes docs",
      prompt: "Génère un modèle de devis professionnel pour mes services",
      status: "Vision FLARE",
    },
  ];

  const HERO_STATUS_BLOCKS = [
    {
      title: "Disponible maintenant",
      tone: "live",
      items: [
        "Chatbot Facebook",
        "Paiement local",
        "Activation FLARE",
      ],
    },
    {
      title: "En cours d'ouverture",
      tone: "opening",
      items: [
        "Plus de cas metier",
        "Parcours plus simple",
        "Plus d'automatisations",
      ],
    },
    {
      title: "Vision FLARE AI",
      tone: "vision",
      items: [
        "Plateforme automation",
        "Modules business",
        "Pilotage unifie",
      ],
    },
  ];

  const BUSINESS_BENEFITS = [
    {
      icon: TrendingUp,
      title: "Plus de demandes",
      description: "Reponse plus rapide.",
    },
    {
      icon: Workflow,
      title: "Moins de repetition",
      description: "Plus de temps utile.",
    },
    {
      icon: Clock3,
      title: "Activation visible",
      description: "Chaque etape est claire.",
    },
    {
      icon: ShieldCheck,
      title: "Support FLARE",
      description: "Humain. Local. Clair.",
    },
  ];

  const ACTIVATION_STEPS = [
    { step: "01", title: "Inscription", description: "Vous creez votre espace FLARE AI et vous ouvrez votre tableau de bord." },
    { step: "02", title: "Choix de l'offre", description: "Vous selectionnez le plan adapte a votre activite et votre volume de demandes." },
    { step: "03", title: "Paiement local", description: "Vous payez en MVola ou Orange Money avec une reference de transaction claire." },
    { step: "04", title: "Validation FLARE", description: "L'equipe valide le paiement et applique le plan choisi sans etat ambigu." },
    { step: "05", title: "Activation", description: "Votre page Facebook est connectee, testee puis le bot passe visible comme actif." },
  ];

  const TRUST_PROOFS = [
    {
      kicker: "Preuve concrete aujourd'hui",
      title: "Chatbot Facebook assiste",
      description: "La preuve active la plus claire est deja exploitable: chatbot Messenger, paiement local, activation FLARE et suivi visible.",
    },
    {
      kicker: "Ce que vous voyez dans l'app",
      title: "Plan, statut, prochaines actions",
      description: "Le client retrouve son plan demande, son plan applique, l'etat d'activation et la prochaine etape a faire.",
    },
    {
      kicker: "Accompagnement Madagascar",
      title: "Support humain sur les points critiques",
      description: "Vous n'etes pas laisse seul sur la validation, la connexion page Facebook et la mise en ligne initiale.",
    },
  ];

  const FAQS = [
    {
      question: "Combien de temps pour activer FLARE AI ?",
      answer: "Le paiement est verifie par l'equipe FLARE, puis l'activation du chatbot Facebook suit selon le dossier et l'acces a la page. Le parcours est visible dans l'application.",
    },
    {
      question: "Comment se fait le paiement ?",
      answer: "Le paiement se fait localement en MVola ou Orange Money, avec une preuve et une reference de transaction verifiees par FLARE.",
    },
    {
      question: "Faut-il etre technique ?",
      answer: "Non. Vous choisissez l'offre, vous confirmez les acces necessaires et l'equipe FLARE accompagne les etapes critiques.",
    },
    {
      question: "Que fait FLARE AI aujourd'hui exactement ?",
      answer: "FLARE AI est une plateforme d'automatisation en construction. La preuve la plus concrete aujourd'hui est le chatbot Facebook assiste pour repondre plus vite et structurer la conversion.",
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
  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15,
        delayChildren: 0.2
      }
    }
  };

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 30, scale: 0.98 },
    visible: { 
      opacity: 1, 
      y: 0,
      scale: 1,
      transition: { duration: 0.8, ease: "easeOut" }
    }
  };

  type PlatformTile =
    | { type: "icon"; icon: typeof Globe; label: string; color: string; id: number; src?: never }
    | { type: "img"; src: string; label: string; color: string; id: number; icon?: never };

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
              <Magnetic>
                <button
                  onClick={() => document.getElementById("hero")?.scrollTo({ top: 0, behavior: "smooth" })}
                  className="landing-nav-link text-[10px] uppercase transition-colors font-medium pb-1"
                >
                  Accueil
                </button>
              </Magnetic>
              {[
                { label: "Comment ca marche", href: "/comment-ca-marche" },
                { label: "Cas d'usage", href: "/cas-usage" },
                { label: "Offres", href: "/offres" },
              ].map((link) => (
                <Magnetic key={link.href}>
                  <a href={link.href} className="landing-nav-link text-[10px] uppercase transition-colors font-medium pb-1">
                    {link.label}
                  </a>
                </Magnetic>
              ))}
              <Magnetic>
                <button
                  onClick={() => {
                    const el = document.getElementById("story");
                    if (el) el.scrollIntoView({ behavior: "smooth" });
                  }}
                  className="landing-nav-link text-[10px] uppercase transition-colors font-medium pb-1"
                >
                  Notre histoire
                </button>
              </Magnetic>
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
            className="landing-mobile-menu fixed inset-0 z-[70] flex flex-col gap-8 overflow-y-auto overscroll-contain bg-[#f6f1e8] px-8 pb-[calc(2rem+env(safe-area-inset-bottom,0px))] pt-[calc(2rem+env(safe-area-inset-top,0px))]"
          >
            <button className="landing-mobile-trigger flex h-11 w-11 items-center justify-center self-end rounded-2xl" onClick={() => setMobileMenuOpen(false)}>
              <X size={32} />
            </button>
            <nav className="flex flex-col gap-6 mt-12">
              <button
                onClick={() => {
                  document.getElementById("hero")?.scrollTo({ top: 0, behavior: "smooth" });
                  setMobileMenuOpen(false);
                }}
                className="landing-mobile-link text-2xl font-semibold uppercase text-left"
              >
                Accueil
              </button>
              {[
                { label: "Comment ca marche", href: "/comment-ca-marche" },
                { label: "Cas d'usage", href: "/cas-usage" },
                { label: "Offres", href: "/offres" },
              ].map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="landing-mobile-link text-2xl font-semibold uppercase text-left"
                >
                  {link.label}
                </a>
              ))}
              <button
                onClick={() => {
                  const el = document.getElementById("story");
                  if (el) el.scrollIntoView({ behavior: "smooth" });
                  setMobileMenuOpen(false);
                }}
                className="landing-mobile-link text-2xl font-semibold uppercase text-left"
              >
                Notre histoire
              </button>
            </nav>
            <div className="landing-mobile-actions mt-auto flex flex-col gap-4 border-t border-white/5 pt-8">
               <button onClick={() => onStart("login")} className="landing-mobile-secondary w-full py-4 uppercase border rounded-2xl">Se connecter</button>
               <button onClick={handleInstallClick} className="landing-mobile-cta w-full py-4 bg-orange-500 uppercase rounded-2xl">Telecharger</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Subtle Cursor Glow (orange) ── */}
      {enableRichEffects ? (
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
      ) : null}

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
      <section className="relative flex h-screen w-full flex-col items-center justify-center overflow-hidden sm:block">
        {/* 3D Robot Background */}
        <div className="pointer-events-none absolute inset-0 z-0 bg-[linear-gradient(180deg,rgba(251,247,240,0.84)_0%,rgba(247,239,228,0.58)_34%,rgba(249,247,242,0.12)_64%,rgba(249,247,242,0)_100%)]" />
        <div className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(circle_at_72%_24%,rgba(255,255,255,0.98),rgba(255,247,237,0.74)_24%,rgba(249,247,242,0.18)_46%,transparent_70%)]" />
        <div className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(circle_at_76%_30%,rgba(249,115,22,0.14),transparent_30%)] sm:bg-[radial-gradient(circle_at_74%_34%,rgba(249,115,22,0.1),transparent_34%)]" />

        <div className="landing-hero-scene absolute left-0 right-0 top-0 z-0 h-[42svh] opacity-[0.96] grayscale-0 sm:inset-0 sm:h-auto sm:opacity-[0.62] sm:grayscale-[26%]">
          {shouldRenderHeroSpline ? (
            <SplineBoundary>
              <Suspense
                fallback={
                  <div className="landing-spline-fallback h-full w-full bg-[radial-gradient(circle_at_72%_28%,rgba(255,255,255,0.94),rgba(255,247,237,0.72)_28%,rgba(249,247,242,0.16)_56%,transparent_76%),linear-gradient(180deg,#fbf7f0_0%,#f5ede1_100%)]" />
                }
              >
                <Spline
                  scene="https://prod.spline.design/JD2om2Ai-FFKwh9D/scene.splinecode"
                  onLoad={onLoad}
                  className="w-full h-full"
                  style={{ pointerEvents: "auto", touchAction: isMobile ? "pan-y" : "auto" }}
                />
              </Suspense>
            </SplineBoundary>
          ) : (
            <div className="landing-spline-fallback h-full w-full bg-[radial-gradient(circle_at_72%_28%,rgba(255,255,255,0.94),rgba(255,247,237,0.72)_28%,rgba(249,247,242,0.16)_56%,transparent_76%),linear-gradient(180deg,#fbf7f0_0%,#f5ede1_100%)]" />
          )}
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
                className="landing-plain-button rounded-full border border-black/10 bg-white/65 px-4 py-2 text-[10px] font-medium uppercase transition-colors hover:bg-white md:px-6 md:text-xs"
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
          <main className="relative z-20 flex min-h-[74vh] flex-1 flex-col justify-end pointer-events-none pt-[18svh] sm:min-h-[70vh] sm:justify-center sm:pt-0">
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate={isLoaded ? "visible" : "hidden"}
              className="relative z-30 max-w-3xl pt-10 pointer-events-auto md:pt-20"
            >
              {/* 1. ATTENTION (Headline) */}
              <motion.h1
                variants={itemVariants}
                style={{ rotateX, rotateY }}
                className="landing-headline text-[38px] sm:text-[56px] md:text-[84px] leading-[1.05] md:leading-[1] perspective-1000 font-[family-name:var(--font-outfit)]"
              >
                {/* Scroll-Scrubbed Reveal */}
                {"Simplifiez. Produisez.".split(" ").map((word, i) => (
                  <WordReveal key={i} word={word} index={i} scrollYProgress={scrollYProgress} />
                ))}
                <br />
                <motion.span
                  style={{ opacity: heroWordOpacity, scale: heroWordScale }}
                  className="inline-block font-black tracking-tight text-black drop-shadow-[0_18px_40px_rgba(0,0,0,0.14)]"
                >
                  Automatisez.
                </motion.span>
              </motion.h1>

              {/* 2. INTEREST (Subtitle) */}
              <div className="w-full mt-6 mb-8 lg:mb-10 lg:mt-8">
                <motion.p 
                  variants={itemVariants}
                  style={{ filter: "none", textShadow: "none", transform: "translateZ(0)" }}
                  className="landing-copy text-sm md:text-xl max-w-xl leading-relaxed text-black font-medium"
                >
                  FLARE AI automatise vos taches repetitives.
                  <br />
                  <strong>Chatbot Facebook actif aujourd&apos;hui. Paiement local. Activation FLARE.</strong>
                </motion.p>
              </div>

              <motion.div variants={itemVariants} className="mb-6 flex justify-start">
                <button
                  onClick={handleInstallClick}
                  className="inline-flex items-center justify-center gap-3 rounded-full border border-black/10 bg-white/68 px-6 py-3 text-[11px] font-bold uppercase tracking-[0.18em] transition-all hover:bg-white hover:border-black/20 sm:px-7"
                >
                  <Download size={15} className="text-black/60" />
                  Telecharger
                </button>
              </motion.div>

              <div className="mb-16" />

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

      <section className="relative z-20 border-t border-black/5 bg-[#F9F7F2] px-6 py-14 sm:px-16 md:px-24">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr] xl:items-start">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              className="max-w-2xl"
            >
              <span className="landing-section-kicker text-[10px] md:text-xs uppercase font-medium">Vision + preuve concrete</span>
              <h2 className="mt-4 text-3xl font-black leading-tight text-black md:text-5xl font-[family-name:var(--font-outfit)]">
                Une plateforme d&apos;automatisation business.
              </h2>
              <p className="landing-copy mt-5 text-sm leading-relaxed text-black/70 md:text-lg">
                Preuve active aujourd&apos;hui : chatbot Facebook assiste.
              </p>

              <div className="mt-8 grid gap-3 sm:grid-cols-2">
                {BUSINESS_BENEFITS.slice(0, 2).map((benefit) => {
                  const Icon = benefit.icon;
                  return (
                    <div key={benefit.title} className="rounded-[1.75rem] border border-black/8 bg-white/70 p-5 shadow-[0_20px_45px_rgba(15,23,42,0.06)]">
                      <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-orange-500/10 text-orange-600">
                        <Icon size={20} />
                      </div>
                      <h3 className="mt-4 text-lg font-black text-black">{benefit.title}</h3>
                      <p className="mt-2 text-sm font-medium leading-relaxed text-black/65">{benefit.description}</p>
                    </div>
                  );
                })}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              className="grid gap-4"
            >
              {HERO_STATUS_BLOCKS.map((block) => {
                const blockClass =
                  block.tone === "live"
                    ? "border-orange-500/25 bg-white shadow-[0_20px_45px_rgba(249,115,22,0.12)]"
                    : block.tone === "vision"
                      ? "border-sky-900/15 bg-sky-950/[0.04]"
                      : "border-black/10 bg-white/75";

                return (
                  <div key={block.title} className={`rounded-[1.8rem] border p-5 ${blockClass}`}>
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-black/65">{block.title}</p>
                      <span className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-black/[0.03] px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-black/55">
                        <span className="h-2 w-2 rounded-full bg-orange-500" />
                        FLARE
                      </span>
                    </div>
                    <div className="mt-5 space-y-3">
                      {block.items.map((item, index) => (
                        <div key={item} className="relative overflow-hidden rounded-2xl border border-black/8 bg-[#fffdf9] px-4 py-3">
                          <motion.div
                            animate={{ opacity: [0.15, 0.5, 0.15], scaleX: [0.92, 1.02, 0.92] }}
                            transition={{ duration: 2.8, repeat: Infinity, delay: index * 0.2 }}
                            className="absolute inset-y-0 left-0 w-1/3 origin-left rounded-full bg-orange-500/10 blur-xl"
                          />
                          <div className="relative flex items-start gap-3">
                            <BadgeCheck size={16} className="mt-0.5 shrink-0 text-orange-600" />
                            <span className="text-sm font-semibold leading-relaxed text-black/75">{item}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </motion.div>
          </div>
        </div>
      </section>

      <section className="relative z-20 border-t border-black/5 bg-white px-6 py-20 sm:px-16 md:px-24">
        <div className="mx-auto max-w-7xl">
          <div className="mb-12 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div className="max-w-2xl">
              <span className="landing-section-kicker text-[10px] md:text-xs uppercase font-medium">Impact business</span>
              <h2 className="mt-4 text-3xl font-black leading-tight text-black md:text-5xl font-[family-name:var(--font-outfit)]">
                Comment FLARE vous fait gagner du temps et de la traction.
              </h2>
            </div>
            <div className="max-w-xl">
              <p className="landing-copy text-sm leading-relaxed text-black/70 md:text-base">
                L&apos;objectif n&apos;est pas juste d&apos;ajouter un outil. L&apos;objectif est de reduire la repetition, accelerer la reponse client et rendre le suivi plus actionnable.
              </p>
            </div>
          </div>

          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {BUSINESS_BENEFITS.map((benefit, index) => {
              const Icon = benefit.icon;
              return (
                <motion.article
                  key={benefit.title}
                  initial={{ opacity: 0, y: 18 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.3 }}
                  transition={{ duration: 0.55, delay: index * 0.08 }}
                  className="group relative overflow-hidden rounded-[2rem] border border-black/8 bg-[#f8f2e7] p-6 shadow-[0_18px_45px_rgba(15,23,42,0.06)]"
                >
                  <motion.div
                    animate={{ opacity: [0.25, 0.6, 0.25], x: ["-15%", "20%", "-15%"] }}
                    transition={{ duration: 4.2, repeat: Infinity, delay: index * 0.25 }}
                    className="absolute inset-x-[-15%] top-0 h-px bg-gradient-to-r from-transparent via-orange-500 to-transparent"
                  />
                  <div className="inline-flex h-12 w-12 items-center justify-center rounded-[1.2rem] border border-orange-500/15 bg-white text-orange-600">
                    <Icon size={22} />
                  </div>
                  <h3 className="mt-5 text-xl font-black text-black">{benefit.title}</h3>
                  <p className="mt-3 text-sm font-medium leading-relaxed text-black/65">{benefit.description}</p>
                </motion.article>
              );
            })}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          SOLUTIONS SECTION (BOTNATION STYLE SIMULATION)
         ══════════════════════════════════════════════════════ */}
      <section id="solutions" className="relative z-20 py-24 sm:py-32 bg-[#F9F7F2] border-t border-black/5 overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 lg:px-24">
          
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
        <div className="max-w-7xl mx-auto px-6 lg:px-24">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24 items-center">
            
            {/* Left: Interactive Platform Grid */}
            <div className="relative">
              {/* Soft background glow for the 'glass' base */}
              <div className="absolute inset-0 bg-orange-500/5 rounded-[4rem] blur-3xl -z-10" />
              
              <div className="grid grid-cols-2 gap-4">
                {([
                  { type: "icon", icon: Globe, label: "Site Web", color: "#f97316", id: 0 },
                  { type: "img", src: "https://upload.wikimedia.org/wikipedia/commons/c/c1/Google_%22G%22_logo.svg", label: "Google", color: "#4285F4", id: 1 },
                  { type: "img", src: "https://upload.wikimedia.org/wikipedia/commons/b/b8/2021_Facebook_icon.svg", label: "Facebook", color: "#1877F2", id: 2 },
                  { type: "img", src: "https://upload.wikimedia.org/wikipedia/commons/e/e7/Instagram_logo_2016.svg", label: "Instagram", color: "#E4405F", id: 3 },
                  { type: "img", src: "https://upload.wikimedia.org/wikipedia/commons/c/ca/LinkedIn_logo_initials.png", label: "LinkedIn", color: "#0A66C2", id: 4 },
                ] as PlatformTile[]).map((platform, i) => (
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

                      <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/80 px-4 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-black/65">
                        <span className="h-2 w-2 rounded-full bg-orange-500" />
                        {MODULES_INFO[activeFeature].status}
                      </div>
                      
                      <p className="text-[15px] sm:text-lg text-black/70 font-medium leading-relaxed mb-8 max-w-lg">
                        {MODULES_INFO[activeFeature].description}
                      </p>

                      <div className="p-5 rounded-[1.5rem] bg-[#F9F7F2] border border-black/5 inline-block">
                        <p className="text-[10px] font-black uppercase tracking-widest text-black/65 mb-1">Impact direct</p>
                        <p className={`text-[15px] sm:text-lg font-black ${MODULES_INFO[activeFeature].color}`}>
                          {MODULES_INFO[activeFeature].promise}
                        </p>
                        <p className="mt-3 max-w-sm text-xs font-semibold leading-relaxed text-black/72">
                          {MODULES_INFO[activeFeature].note}
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
        <div className="max-w-7xl mx-auto px-6 lg:px-24">
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
                      <p className="text-[10px] text-black/65 font-bold uppercase tracking-tight">Ecom Pilot Activé</p>
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
                      <p className="text-[10px] font-black uppercase text-black/60">{item.label}</p>
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
                      <p className="text-[10px] text-black/60 font-bold uppercase">{item.target} • {item.time}</p>
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
      <section className="relative z-20 border-y border-black/5 bg-[#f8f2e7] px-6 py-20 sm:px-16 md:px-24">
        <div className="mx-auto max-w-7xl">
          <div className="mb-12 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <span className="landing-section-kicker text-[10px] md:text-xs uppercase font-medium">Comment ca marche</span>
              <h2 className="mt-4 text-3xl font-black leading-tight text-black md:text-5xl font-[family-name:var(--font-outfit)]">
                Un parcours clair, du paiement local a l&apos;activation visible.
              </h2>
            </div>
            <div className="max-w-xl">
              <p className="landing-copy text-sm leading-relaxed text-black/70 md:text-base">
                FLARE ne vous laisse pas seul dans un tunnel opaque. Le paiement, la validation, l&apos;activation et le support suivent un flux lisible.
              </p>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-5">
            {ACTIVATION_STEPS.map((step, index) => (
              <motion.article
                key={step.step}
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.25 }}
                transition={{ duration: 0.5, delay: index * 0.06 }}
                className="relative overflow-hidden rounded-[1.8rem] border border-black/8 bg-white/88 p-5 shadow-[0_18px_40px_rgba(15,23,42,0.06)]"
              >
                <motion.div
                  animate={{ opacity: [0.3, 0.75, 0.3] }}
                  transition={{ duration: 2.4, repeat: Infinity, delay: index * 0.25 }}
                  className="absolute left-5 top-0 h-full w-px bg-gradient-to-b from-orange-500/0 via-orange-500/40 to-orange-500/0"
                />
                <p className="pl-4 text-[11px] font-black uppercase tracking-[0.18em] text-orange-600">{step.step}</p>
                <h3 className="mt-4 pl-4 text-lg font-black text-black">{step.title}</h3>
                <p className="mt-2 pl-4 text-sm font-medium leading-relaxed text-black/65">{step.description}</p>
              </motion.article>
            ))}
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href="/comment-ca-marche"
              className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-black px-5 py-3 text-xs font-black uppercase tracking-[0.08em] text-white transition hover:bg-black/85"
              style={{ color: "#ffffff" }}
            >
              <span style={{ color: "#ffffff" }}>Voir le parcours detaille</span>
              <ArrowUpRight size={16} style={{ color: "#ffffff" }} />
            </a>
            <a
              href="/offres"
              className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-5 py-3 text-xs font-black uppercase tracking-[0.08em] text-black transition hover:border-black/25"
            >
              Voir les offres
              <ArrowUpRight size={16} />
            </a>
          </div>
        </div>
      </section>

      <section className="relative z-20 border-b border-black/5 bg-white px-6 py-20 sm:px-16 md:px-24">
        <div className="mx-auto max-w-7xl">
          <div className="mb-12 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <span className="landing-section-kicker text-[10px] md:text-xs uppercase font-medium">Preuves et confiance</span>
              <h2 className="mt-4 text-3xl font-black leading-tight text-black md:text-5xl font-[family-name:var(--font-outfit)]">
                Ce que le client comprend, voit et valide avant la mise en ligne.
              </h2>
            </div>
            <div className="max-w-xl">
              <p className="landing-copy text-sm leading-relaxed text-black/70 md:text-base">
                La conversion se gagne avec des signaux nets: paiement local, statut visible, plan applique, support humain et cas d&apos;usage lisibles.
              </p>
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="grid gap-4 md:grid-cols-3">
              {TRUST_PROOFS.map((proof, index) => (
                <motion.article
                  key={proof.title}
                  initial={{ opacity: 0, y: 18 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.25 }}
                  transition={{ duration: 0.5, delay: index * 0.08 }}
                  className="rounded-[1.8rem] border border-black/8 bg-[#f8f2e7] p-5 shadow-[0_18px_40px_rgba(15,23,42,0.05)]"
                >
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-orange-600">{proof.kicker}</p>
                  <h3 className="mt-3 text-xl font-black text-black">{proof.title}</h3>
                  <p className="mt-3 text-sm font-medium leading-relaxed text-black/65">{proof.description}</p>
                </motion.article>
              ))}
            </div>

            <div className="rounded-[2.25rem] border border-black/8 bg-[#020305] p-7 text-white shadow-[0_30px_80px_rgba(2,3,5,0.35)]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.2em] text-white/45">Automation command center</p>
                  <h3 className="mt-2 text-2xl font-black">Paiement valide - activation visible</h3>
                </div>
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
                  <Workflow size={18} className="text-orange-400" />
                </div>
              </div>

              <div className="mt-8 space-y-4">
                {[
                  "Paiement soumis avec reference",
                  "Validation FLARE du dossier",
                  "Plan applique dans l'application",
                  "Connexion page et tests Messenger",
                  "Bot visible comme actif",
                ].map((label, index) => (
                  <div key={label} className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-4">
                    <motion.div
                      animate={{ opacity: [0.2, 0.8, 0.2], x: ["-20%", "20%", "-20%"] }}
                      transition={{ duration: 3.2, repeat: Infinity, delay: index * 0.22 }}
                      className="absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-orange-500/0 via-orange-500/20 to-orange-500/0 blur-xl"
                    />
                    <div className="relative flex items-start gap-3">
                      <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-orange-400" />
                      <span className="text-sm font-semibold leading-relaxed text-white/90">{label}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-8 flex flex-wrap gap-3">
                <a
                  href="/cas-usage"
                  className="inline-flex items-center gap-2 rounded-full bg-orange-500 px-5 py-3 text-xs font-black uppercase tracking-[0.08em] text-black transition hover:bg-orange-400"
                >
                  Voir des cas d&apos;usage
                  <ArrowUpRight size={16} />
                </a>
                <a
                  href="/comment-ca-marche"
                  className="inline-flex items-center gap-2 rounded-full border border-white/14 px-5 py-3 text-xs font-black uppercase tracking-[0.08em] text-white transition hover:border-white/25"
                >
                  Comprendre le process
                  <ArrowUpRight size={16} />
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="relative z-20 px-6 py-20 sm:px-16 md:px-24 overflow-hidden border-y border-black/5 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="mb-12 md:mb-16">
            <span className="text-xs font-black text-orange-600 uppercase tracking-widest">Témoignages</span>
            <h2 className="text-3xl md:text-5xl font-black text-black mt-2">Ils nous font confiance.</h2>
          </div>

          <motion.div 
            drag="x"
            dragConstraints={{ right: 0, left: isMobile ? -1400 : -1800 }}
            dragElastic={0.1}
            className="flex gap-8 cursor-grab active:cursor-grabbing pb-12"
          >
            {REVIEWS.map((rev, i) => (
              <motion.div
                key={i}
                whileHover={{ y: -10, scale: 1.02 }}
                className="relative min-w-[300px] md:min-w-[450px] p-10 md:p-14 rounded-[40px] bg-white border border-black/10 shadow-[0_20px_60px_rgba(0,0,0,0.05)] transition-all duration-500 hover:shadow-2xl hover:border-orange-500/20"
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
          
          <div className="flex items-center gap-4 text-xs font-black text-black/60 uppercase tracking-widest">
            <ArrowRight size={16} />
            Faites glisser pour en voir plus
          </div>
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
          <p className="text-sm md:text-lg text-black/75 max-w-2xl">
            Données chiffrées, hébergement Google Cloud sécurisé et conformité Meta API. Votre business est entre de bonnes mains.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-6">
             <div className="flex items-center gap-2 px-4 py-2 rounded-full border border-black/10 bg-black/[0.03]">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                <span className="text-[10px] uppercase font-bold tracking-wider text-black/70">SSL Encrypted</span>
             </div>
             <div className="flex items-center gap-2 px-4 py-2 rounded-full border border-black/10 bg-black/[0.03]">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                <span className="text-[10px] uppercase font-bold tracking-wider text-black/70">GDPR Comply</span>
             </div>
             <div className="flex items-center gap-2 px-4 py-2 rounded-full border border-black/10 bg-black/[0.03]">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                <span className="text-[10px] uppercase font-bold tracking-wider text-black/70">Meta Verified API</span>
             </div>
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
              { label: "Politique de confidentialite", href: "/privacy-policy" },
              { label: "Conditions d'utilisation", href: "/terms" },
              { label: "Politique cookies", href: "/privacy-policy#cookies" },
            ].map((link) => (
              <a key={link.label} href={link.href} className="landing-footer-link text-xs uppercase transition-colors font-medium">
                {link.label}
              </a>
            ))}
          </motion.div>
        </div>
      </section>

      <section className="landing-section-base relative overflow-hidden border-t border-black/5 bg-white px-6 py-24 sm:px-16 md:px-24 md:py-28">
        <div className="mx-auto max-w-6xl">
          <div className="mb-14 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div className="max-w-2xl">
              <span className="landing-section-kicker text-[10px] md:text-xs uppercase font-medium">FAQ conversion</span>
              <h2 className="mt-4 text-3xl font-black leading-tight text-black md:text-5xl font-[family-name:var(--font-outfit)]">
                Les questions qui comptent avant de demarrer.
              </h2>
            </div>
            <div className="max-w-xl">
              <p className="landing-copy text-sm leading-relaxed text-black/70 md:text-base">
                L&apos;enjeu ici n&apos;est pas de faire joli. L&apos;enjeu est que le visiteur comprenne le paiement local, le support FLARE et la mise en route reelle.
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {FAQS.map((item, index) => (
              <motion.details
                key={item.question}
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.25 }}
                transition={{ duration: 0.45, delay: index * 0.06 }}
                className="group rounded-[1.8rem] border border-black/8 bg-[#f8f2e7] p-6 shadow-[0_16px_38px_rgba(15,23,42,0.05)]"
              >
                <summary className="flex cursor-pointer list-none items-start justify-between gap-4 text-left">
                  <span className="text-lg font-black leading-snug text-black">{item.question}</span>
                  <ChevronDown size={18} className="mt-1 shrink-0 text-black/45 transition group-open:rotate-180" />
                </summary>
                <p className="mt-4 pr-6 text-sm font-medium leading-relaxed text-black/68">{item.answer}</p>
              </motion.details>
            ))}
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href="/comment-ca-marche"
              className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-black px-5 py-3 text-xs font-black uppercase tracking-[0.08em] text-white transition hover:bg-black/85"
              style={{ color: "#ffffff" }}
            >
              <span style={{ color: "#ffffff" }}>Revoir le process</span>
              <ArrowUpRight size={16} style={{ color: "#ffffff" }} />
            </a>
            <a
              href="/cas-usage"
              className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-5 py-3 text-xs font-black uppercase tracking-[0.08em] text-black transition hover:border-black/25"
            >
              Voir les secteurs
              <ArrowUpRight size={16} />
            </a>
          </div>
        </div>
      </section>

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
              Payez par <span className="font-semibold text-orange-500">MVola</span> ou <span className="font-semibold text-orange-500">Orange Money</span>.
            </h2>
            <p className="landing-copy mt-4 text-sm md:text-base leading-relaxed">
              Pas de Stripe. Pas de carte etrangere obligatoire. Vous payez localement, FLARE valide le dossier et votre activation avance avec support humain.
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
            Paiement par <strong>MVola</strong> ou <strong>Orange Money</strong>.<br />
            Verification FLARE, plan applique, puis activation manuelle accompagnee.
          </motion.p>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          NOTRE HISTOIRE
         ══════════════════════════════════════════════════════ */}
      <section id="story" className="landing-section-base relative overflow-hidden px-6 py-24 sm:px-16 md:px-24 md:py-32">
        {/* Brain 3D — arrière-plan, pointer-events désactivé pour ne pas capturer le scroll */}
        {enableRichEffects ? (
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
        ) : null}
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
                <p className="landing-card-copy text-[10px] font-bold text-black/65 uppercase tracking-[0.2em] mt-2">Made in Madagascar</p>
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

        <div className="bg-[#020305] px-6 py-20 sm:px-16 md:px-24">
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
                { type: "icon", icon: Facebook, label: "Facebook", href: "https://www.facebook.com/ramsflare", color: "#1877F2" },
                { type: "icon", icon: Workflow, label: "Offres", href: "/offres", color: "#f97316" },
                { type: "icon", icon: MessageSquare, label: "Process", href: "/comment-ca-marche", color: "#22c55e" },
                { type: "icon", icon: TrendingUp, label: "Cas usage", href: "/cas-usage", color: "#60a5fa" },
                { type: "icon", icon: Mail, label: "Email", href: "mailto:contact@ramsflare.com", color: "#EA4335" },
              ].map((social, i) => (
                <a
                  key={i}
                  href={social.href}
                  target={social.href.startsWith("/") ? undefined : "_blank"}
                  rel={social.href.startsWith("/") ? undefined : "noopener noreferrer"}
                  className="flex flex-col items-center gap-4 cursor-pointer"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
                    <social.icon size={24} style={{ color: social.color }} />
                  </div>
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
                  { label: "Confidentialite", href: "/privacy-policy" },
                  { label: "CGU", href: "/terms" },
                  { label: "Politique Cookies", href: "/privacy-policy#cookies" },
                ].map((link) => (
                  <a key={link.label} href={link.href} className="text-[10px] uppercase font-bold text-white/75 hover:text-white transition-colors tracking-widest">
                    {link.label}
                  </a>
                ))}
              </div>

              <p className="text-[10px] font-bold text-white/60 uppercase tracking-[0.2em]">
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
          text-rendering: geometricPrecision;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
        }

        .landing-copy {
          color: rgba(0, 0, 0, 0.82);
          text-rendering: geometricPrecision;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
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
