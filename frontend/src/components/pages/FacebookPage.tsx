"use client";

import { motion } from "framer-motion";
import { Bot, Users, PenTool } from "lucide-react";

import PlatformCard from "@/components/PlatformCard";
import type { NavLevel } from "@/components/NavBreadcrumb";

interface FacebookPageProps {
  onPush: (level: NavLevel) => void;
  pendingHumanCount?: number;
}

const MODULES: Array<{
  id: string;
  label: string;
  description: string;
  icon: typeof Bot;
  iconColor: string;
  locked: boolean;
  navLevel?: NavLevel;
}> = [
  {
    id: "chatbot",
    label: "Chatbot IA",
    description: "Repond automatiquement a vos messages Facebook Messenger",
    icon: Bot,
    iconColor: "text-orange-500 dark:text-orange-300",
    locked: false,
    navLevel: "chatbot",
  },
  {
    id: "community",
    label: "Community Manager",
    description: "Gere vos commentaires et publications automatiquement",
    icon: Users,
    iconColor: "text-[var(--text-secondary)]",
    locked: true,
  },
  {
    id: "content",
    label: "Content Creator",
    description: "Cree et programme du contenu pour votre page",
    icon: PenTool,
    iconColor: "text-[var(--text-secondary)]",
    locked: true,
  },
];

export default function FacebookPage({ onPush }: FacebookPageProps) {
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto flex w-full max-w-[860px] flex-col gap-8 px-4 py-8 md:px-8 md:py-12">
        <motion.header
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="flex items-center gap-4"
        >
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#1877F2]/15">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="#1877F2">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
            </svg>
          </div>
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight text-[var(--text-primary)]">Facebook</h1>
            <p className="text-lg text-[var(--text-muted)]">Choisissez un module</p>
          </div>
        </motion.header>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3" role="list" aria-label="Modules Facebook">
          {MODULES.map((mod, idx) => {
            const Icon = mod.icon;
            const navLevel = mod.navLevel;
            return (
              <motion.div
                key={mod.id}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.06 + idx * 0.06, ease: [0.16, 1, 0.3, 1] }}
                role="listitem"
              >
                <PlatformCard
                  icon={<Icon size={24} strokeWidth={1.8} className={mod.iconColor} />}
                  label={mod.label}
                  description={mod.description}
                  locked={mod.locked}
                  glowColor={mod.locked ? undefined : "#FF7C1A"}
                  onClick={navLevel ? (() => onPush(navLevel as NavLevel)) : undefined}
                />
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

