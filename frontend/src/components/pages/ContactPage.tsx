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
    description: "Reponse sous 24h",
  },
  {
    id: "whatsapp",
    icon: MessageCircle,
    label: "WhatsApp",
    value: "+261 34 12 345 67",
    href: "https://wa.me/261341234567",
    description: "Disponible 8h-18h",
  },
  {
    id: "form",
    icon: ExternalLink,
    label: "Formulaire",
    value: "Envoyer un message",
    href: "https://ramsflare.com/contact",
    description: "Pour les demandes detaillees",
  },
] as const;

export default function ContactPage() {
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto flex w-full max-w-[680px] flex-col gap-8 px-4 py-8 md:px-8 md:py-12">
        <motion.header
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="space-y-2"
        >
          <h1 className="text-3xl font-bold tracking-tight text-[var(--text-primary)]">
            Contactez-nous
          </h1>
          <p className="text-lg text-[var(--text-muted)]">
            Une question ? On est la pour vous aider.
          </p>
        </motion.header>

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
                className="group flex items-center gap-5 rounded-2xl border border-[var(--border-default)] bg-[var(--surface-base)] px-6 py-5 shadow-[var(--shadow-card)] transition-all duration-200 hover:border-[var(--border-strong)] hover:bg-[var(--surface-subtle)]"
                aria-label={`${item.label} : ${item.value}`}
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-orange-500/10">
                  <Icon size={20} className="text-orange-500 dark:text-orange-300" />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium leading-tight text-[var(--text-secondary)]">{item.label}</p>
                  <p className="mt-0.5 text-lg font-semibold leading-tight tracking-tight text-[var(--text-primary)]">
                    {item.value}
                  </p>
                  <p className="mt-1 text-sm leading-tight text-[var(--text-secondary)]">{item.description}</p>
                </div>

                <ExternalLink
                  size={15}
                  className="shrink-0 text-[var(--text-muted)] transition-colors duration-150 group-hover:text-[var(--text-primary)]"
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
