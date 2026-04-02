"use client";

import { motion } from "framer-motion";
import { Mail, MessageCircle, ExternalLink } from "lucide-react";

const CONTACT_ITEMS = [
  {
    id: "email",
    icon: Mail,
    label: "Email",
    value: "support@ramsflare.com",
    href: "mailto:support@ramsflare.com",
    description: "Réponse sous 24h",
  },
  {
    id: "whatsapp",
    icon: MessageCircle,
    label: "WhatsApp",
    value: "+261 34 12 345 67",
    href: "https://wa.me/261341234567",
    description: "Disponible 8h–18h",
  },
  {
    id: "form",
    icon: ExternalLink,
    label: "Formulaire",
    value: "Envoyer un message",
    href: "https://ramsflare.com/contact",
    description: "Pour les demandes détaillées",
  },
];

export default function ContactPage() {
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-[680px] px-4 py-8 md:px-8 md:py-12 flex flex-col gap-8">

        {/* ── Header ── */}
        <motion.header
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="space-y-2"
        >
          <h1 className="text-3xl font-bold tracking-tight text-white/90">
            Contactez-nous
          </h1>
          <p className="text-lg text-[var(--text-muted)]">
            Une question ? On est là pour vous aider.
          </p>
        </motion.header>

        {/* ── Contact cards ── */}
        <div className="flex flex-col gap-3">
          {CONTACT_ITEMS.map((item, idx) => {
            const Icon = item.icon;
            return (
              <motion.a
                key={item.id}
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                transition={{ delay: 0.06 + idx * 0.07, ease: [0.16, 1, 0.3, 1] }}
                className="flex items-center gap-5 rounded-2xl
                           backdrop-blur-md bg-[var(--bg-glass)]
                           border border-[var(--border-glass)]
                           shadow-[var(--shadow-card)] px-6 py-5
                           hover:bg-white/[0.07] hover:border-white/[0.12]
                           transition-all duration-200 group"
                aria-label={`${item.label} : ${item.value}`}
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center
                                rounded-xl bg-orange-500/10">
                  <Icon size={20} className="text-orange-400" />
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white/40 leading-tight">{item.label}</p>
                  <p className="text-lg font-semibold text-white/90 leading-tight mt-0.5 tracking-tight">
                    {item.value}
                  </p>
                  <p className="text-sm text-white/30 mt-1 leading-tight">{item.description}</p>
                </div>

                <ExternalLink
                  size={15}
                  className="shrink-0 text-white/20 group-hover:text-white/50
                             transition-colors duration-150"
                  aria-hidden
                />
              </motion.a>
            );
          })}
        </div>

      </div>
    </div>
  );
}
