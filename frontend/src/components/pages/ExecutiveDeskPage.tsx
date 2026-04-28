"use client";

import { motion } from "framer-motion";
import { ArrowRight, Lock } from "lucide-react";
import type { NavLevel } from "@/components/NavBreadcrumb";
import { GmailIcon } from "@/components/icons/GmailIcon";
import { GoogleCalendarIcon } from "@/components/icons/GoogleCalendarIcon";
import { GoogleDriveIcon } from "@/components/icons/GoogleDriveIcon";
import { GoogleContactsIcon } from "@/components/icons/GoogleContactsIcon";

interface ExecutiveDeskPageProps {
  onPush: (level: NavLevel) => void;
  token?: string | null;
}

const MODULES = [
  { 
    id: "executive-mail", 
    label: "Assistant Mail", 
    description: "L'IA analyse, trie et prépare les réponses pour vos mails importants.",
    icon: GmailIcon, 
    locked: false 
  },
  { 
    id: "executive-planning", 
    label: "Planning Intelligent", 
    description: "Optimisation automatique de votre agenda et gestion des priorités.",
    icon: GoogleCalendarIcon, 
    locked: true 
  },
  { 
    id: "executive-contacts", 
    label: "Contacts Stratégiques", 
    description: "Suivi intelligent de vos relations clés et rappels de relance.",
    icon: GoogleContactsIcon, 
    locked: true 
  },
  { 
    id: "executive-files", 
    label: "Organisation Fichiers", 
    description: "Classement automatique de vos documents importants via IA.",
    icon: GoogleDriveIcon, 
    locked: true 
  },
];

export default function ExecutiveDeskPage({ onPush }: ExecutiveDeskPageProps) {
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto flex w-full max-w-[1040px] flex-col gap-8 px-4 py-8 md:px-8 md:py-12">
        <motion.header
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="text-center"
        >
          <h1 className="text-4xl font-black tracking-tight text-[var(--text-primary)] md:text-6xl">Executive Desk</h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg font-medium leading-relaxed text-[var(--text-secondary)]">
            Votre suite d&apos;outils IA haute performance. Choisissez un module pour commencer.
          </p>
        </motion.header>

        <div className="grid gap-6 sm:grid-cols-2">
          {MODULES.map((module, index) => {
            const Icon = module.icon;
            return (
              <motion.button
                key={module.id}
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
                disabled={module.locked}
                onClick={() => onPush(module.id as NavLevel)}
                className={`group relative flex flex-col items-center gap-6 rounded-[40px] border p-10 text-center transition-all duration-300
                  ${module.locked 
                    ? "border-[var(--border-default)] bg-[var(--surface-subtle)]/50 cursor-not-allowed" 
                    : "border-[var(--border-default)] bg-[var(--bg-card)] hover:border-blue-500/40 hover:shadow-2xl hover:shadow-blue-500/10 hover:-translate-y-1"
                  }`}
              >
                <div className={`flex h-24 w-24 items-center justify-center rounded-[32px] border shadow-sm transition-transform duration-500 group-hover:scale-110
                  ${module.locked 
                    ? "border-[var(--border-default)] bg-white/50" 
                    : "border-[var(--border-default)] bg-white shadow-blue-500/5"
                  }`}
                >
                  <div className={module.locked ? "opacity-40 saturate-[0.5]" : ""}>
                    <Icon size={module.id === "executive-mail" ? 56 : 48} />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-center gap-2">
                    <h2 className="text-2xl font-black text-[var(--text-primary)]">{module.label}</h2>
                    {module.locked && <Lock size={18} className="text-slate-400" />}
                  </div>
                  <p className="mt-4 text-sm font-medium leading-relaxed text-[var(--text-secondary)]">
                    {module.description}
                  </p>
                </div>

                {!module.locked && (
                  <div className="mt-2 flex items-center gap-2 text-sm font-black text-blue-600 opacity-0 transition-opacity group-hover:opacity-100">
                    Ouvrir le module <ArrowRight size={16} />
                  </div>
                )}
                
                {module.locked && (
                  <div className="mt-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Bientôt disponible
                  </div>
                )}
              </motion.button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
