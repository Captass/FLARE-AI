"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Monitor, Smartphone, Download, ArrowLeft, Terminal, Apple } from "lucide-react";
import FlareMark from "@/components/FlareMark";
import Link from "next/link";

export default function DownloadPage() {
  const [detectedOS, setDetectedOS] = useState<string | null>(null);

  useEffect(() => {
    // Basic OS detection logic
    const userAgent = window.navigator.userAgent;
    if (userAgent.indexOf("Win") !== -1) setDetectedOS("Windows");
    if (userAgent.indexOf("Mac") !== -1) setDetectedOS("macOS");
    if (userAgent.indexOf("Android") !== -1) setDetectedOS("Android");
    if (userAgent.indexOf("like Mac") !== -1) setDetectedOS("iOS");
  }, []);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] } }
  };

  const DOWNLOAD_OPTIONS = [
    {
      id: "macOS",
      title: "macOS",
      chip: "Apple Silicon & Intel",
      icon: <LaptopIcon className="w-8 h-8" />,
      size: "142 MB",
      action: "Télécharger pour Mac",
      highlight: detectedOS === "macOS"
    },
    {
      id: "Windows",
      title: "Windows",
      chip: "Windows 10 & 11",
      icon: <Monitor className="w-8 h-8" />,
      size: "135 MB",
      action: "Télécharger pour Windows",
      highlight: detectedOS === "Windows"
    },
    {
      id: "Android",
      title: "Android & iOS",
      chip: "Mobile & Tablette",
      icon: <Smartphone className="w-8 h-8" />,
      size: "Progressive Web App",
      action: "Ajouter à l'écran",
      highlight: detectedOS === "Android" || detectedOS === "iOS"
    }
  ];

  return (
    <main className="min-h-screen bg-[#F9F7F2] text-black flex flex-col items-center justify-center relative overflow-hidden font-sans selection:bg-orange-500 selection:text-white p-6">
      
      {/* Background Gradients */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-3xl h-[500px] bg-orange-500/10 blur-[120px] rounded-full pointer-events-none opacity-50" />

      {/* Nav */}
      <div className="absolute top-0 left-0 w-full p-6 lg:p-10 z-50">
        <Link href="/" className="inline-flex items-center gap-3 text-black/50 hover:text-black transition-colors cursor-pointer group">
          <div className="w-10 h-10 rounded-full border border-black/10 bg-black/5 flex items-center justify-center group-hover:bg-black/10 transition-colors">
             <ArrowLeft size={16} />
          </div>
          <span className="text-xs font-bold uppercase tracking-widest">Retour au site</span>
        </Link>
      </div>

      <motion.div 
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="w-full max-w-5xl mx-auto flex flex-col items-center z-10"
      >
        <motion.div variants={itemVariants} className="w-20 h-20 bg-white border border-black/5 rounded-3xl flex items-center justify-center shadow-xl shadow-orange-500/10 mb-10">
          <FlareMark tone="auto" className="w-10" />
        </motion.div>

        <motion.div variants={itemVariants} className="text-center mb-16 max-w-2xl">
          <h1 className="text-4xl md:text-6xl font-black mb-6 tracking-tighter font-[family-name:var(--font-outfit)]">
            Télécharger <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-orange-600">FLARE AI</span>.
          </h1>
          <p className="text-lg md:text-xl text-black/60 font-medium leading-relaxed">
            Profitez de toute la puissance de FLARE directement sur votre bureau ou votre smartphone. Plus rapide, plus fluide, sans distractions.
          </p>
        </motion.div>

        <motion.div variants={containerVariants} className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full mb-16">
          {DOWNLOAD_OPTIONS.map((opt, i) => (
            <motion.div
              key={i}
              variants={itemVariants}
              whileHover={{ y: -5, scale: 1.02 }}
              className={`relative rounded-[32px] p-8 glass-panel border flex flex-col gap-6 cursor-pointer overflow-hidden group transition-all duration-300
                ${opt.highlight ? 'bg-orange-500/[0.03] border-orange-500/30 shadow-2xl shadow-orange-500/10' : 'bg-white border-black/5 hover:border-black/10 hover:shadow-xl'}`}
            >
              {opt.highlight && (
                <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-orange-400 to-orange-600" />
              )}
              
              <div className="flex items-start justify-between">
                <div className={`p-4 rounded-2xl ${opt.highlight ? 'bg-orange-500/10 text-orange-600' : 'bg-black/5 text-black'}`}>
                  {opt.icon}
                </div>
                {opt.highlight && (
                  <span className="px-3 py-1 bg-orange-500/10 text-orange-600 text-[10px] font-black uppercase tracking-widest rounded-full border border-orange-500/20">
                    Recommandé
                  </span>
                )}
              </div>

              <div>
                <h3 className="text-2xl font-black text-black">{opt.title}</h3>
                <p className="text-[12px] font-bold uppercase tracking-widest text-black/40 mt-1">{opt.chip}</p>
              </div>

              <div className="mt-auto pt-6 flex flex-col gap-4 border-t border-black/5">
                <button className={`w-full py-4 rounded-xl flex items-center justify-center gap-3 text-xs font-black uppercase tracking-widest transition-all
                  ${opt.highlight ? 'bg-orange-500 text-white hover:bg-orange-600 shadow-xl shadow-orange-500/20' : 'bg-black/5 text-black hover:bg-black/10'}`}>
                  <Download size={16} />
                  {opt.action}
                </button>
                <div className="text-center">
                  <span className="text-[10px] text-black/30 font-medium uppercase tracking-widest">Taille : {opt.size}</span>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>

        <motion.div variants={itemVariants} className="flex items-center gap-3 text-black/40 font-medium text-sm">
           <Terminal size={14} />
           <span>CLI disponible via </span><code className="px-2 py-1 bg-black/5 font-black rounded-md text-xs">npm i -g @flare-ai/cli</code>
        </motion.div>

      </motion.div>
    </main>
  );
}

// A generic Laptop Icon since we might not have `Apple` directly in the requested lucide set.
function LaptopIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M20 16V7a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v9m16 0H4m16 0 1.28 2.55a1 1 0 0 1-.9 1.45H3.62a1 1 0 0 1-.9-1.45L4 16"/>
    </svg>
  );
}
