"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, User, Briefcase, Zap, ArrowRight, CheckCircle2, ChevronRight } from "lucide-react";

interface WelcomeOnboardingProps {
  userName?: string;
  onComplete: (data: { name: string; role: string; objective: string }, action: "start" | "skip_welcome" | "guide" | "skip_all") => void;
}

export default function WelcomeOnboarding({ userName, onComplete }: WelcomeOnboardingProps) {
  const [step, setStep] = useState(0);
  const [data, setData] = useState({
    name: userName || "",
    role: "",
    objective: ""
  });

  const steps = [
    {
      title: "Parlez-moi de vous",
      subtitle: "Comment dois-je vous appeler ?",
      icon: <User className="text-[var(--text-primary)]" size={32} />,
      field: "name",
      placeholder: "Votre nom ou pseudo...",
      description: "Votre nom me permet de personnaliser nos échanges."
    },
    {
      title: "Votre domaine",
      subtitle: "Quel est votre rôle principal ?",
      icon: <Briefcase className="text-[var(--text-primary)]" size={32} />,
      field: "role",
      placeholder: "Ex: Designer, Entrepreneur, Étudiant...",
      description: "Cela m'aide à adapter mon vocabulaire et mes conseils."
    },
    {
      title: "Votre objectif",
      subtitle: "Que souhaitez-vous accomplir avec FLARE ?",
      icon: <Zap className="text-[var(--text-primary)]" size={32} />,
      field: "objective",
      placeholder: "Ex: Création de contenu, Analyse de données...",
      description: "Je configurerai mes priorités en fonction de vos besoins."
    }
  ];

  const handleNext = () => {
    if (step < steps.length - 1) {
      setStep(step + 1);
    } else {
      onComplete(data, "start");
    }
  };

  const isStepValid = data[steps[step].field as keyof typeof data].trim().length > 1;

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-[#020305]/80 backdrop-blur-2xl px-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-xl bg-[var(--bg-modal)] border border-white/5 rounded-[40px] overflow-hidden shadow-[0_32px_128px_rgba(0,0,0,0.8)] relative"
      >
        {/* Background Gradients */}
        <div className="absolute top-0 left-1/4 w-1/2 h-1/2 bg-[var(--text-primary)]/5 blur-[120px] pointer-events-none" />
        
        <div className="p-10 relative z-10">
          {/* Progress dots */}
          <div className="flex gap-2 mb-12">
            {steps.map((_, i) => (
              <div 
                key={i} 
                className={`h-1 rounded-full transition-all duration-500 ${i <= step ? "w-12 bg-[var(--text-primary)]" : "w-4 bg-white/10"}`} 
              />
            ))}
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.4, ease: "circOut" }}
              className="min-h-[300px]"
            >
              <div className="w-20 h-20 rounded-[28px] bg-white/5 border border-white/10 flex items-center justify-center mb-8 shadow-2xl">
                {steps[step].icon}
              </div>

              <h2 className="text-[32px] font-bold text-white tracking-tight leading-tight mb-2 font-[family-name:var(--font-outfit)]">
                {steps[step].title}
              </h2>
              <p className="text-[18px] text-white/40 font-light mb-10 tracking-tight">
                {steps[step].subtitle}
              </p>

              <div className="relative group">
                <input
                  type="text"
                  autoFocus
                  value={data[steps[step].field as keyof typeof data]}
                  onChange={(e) => setData({ ...data, [steps[step].field]: e.target.value })}
                  onKeyDown={(e) => e.key === "Enter" && isStepValid && handleNext()}
                  placeholder={steps[step].placeholder}
                  className="w-full bg-white/5 border-b-2 border-white/10 py-5 text-[24px] text-white placeholder-white/10 focus:outline-none focus:border-[var(--text-primary)] transition-all font-light"
                />
                <div className="mt-4 flex items-start gap-2 text-[12px] text-white/20 uppercase tracking-[0.2em] font-bold">
                  <Sparkles size={14} className="text-[var(--text-primary)]/40" />
                  {steps[step].description}
                </div>
              </div>
            </motion.div>
          </AnimatePresence>

          <div className="mt-12 flex items-center justify-between">
            <button 
              onClick={() => step > 0 && setStep(step - 1)}
              className={`text-[12px] font-bold uppercase tracking-widest transition-all ${step > 0 ? "text-white/40 hover:text-white" : "text-transparent pointer-events-none"}`}
            >
              Précédent
            </button>
            <button
              onClick={handleNext}
              disabled={!isStepValid}
              className={`px-10 py-5 rounded-[24px] font-bold text-[16px] tracking-wide transition-all flex items-center gap-3 group active-press ${
                isStepValid
                  ? "bg-[var(--text-primary)] text-[var(--background)] hover:opacity-90 shadow-2xl"
                  : "bg-white/12 text-white/45 border border-white/10 cursor-not-allowed shadow-none"
              }`}
            >
              {step === steps.length - 1 ? "Commencer" : "Suivant"}
              <ArrowRight
                size={20}
                className={`transition-transform ${isStepValid ? "group-hover:translate-x-1" : "opacity-45"}`}
              />
            </button>
          </div>

          <div className="mt-10 pt-6 border-t border-white/10 flex items-center justify-center gap-4 flex-wrap">
            <button onClick={() => onComplete(data, "skip_welcome")} className="text-[13px] font-medium text-white/50 hover:text-white transition-colors cursor-pointer">Passer le bienvenue</button>
            <div className="w-1 h-1 rounded-full bg-white/20"></div>
            <button onClick={() => onComplete(data, "guide")} className="text-[13px] font-medium text-[var(--text-primary)] hover:opacity-80 transition-colors flex items-center gap-1 cursor-pointer"><Zap size={14}/> Voir le guide interactif</button>
            <div className="w-1 h-1 rounded-full bg-white/20"></div>
            <button onClick={() => onComplete(data, "skip_all")} className="text-[13px] font-medium text-white/30 hover:text-red-400 transition-colors cursor-pointer">Tout passer</button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
