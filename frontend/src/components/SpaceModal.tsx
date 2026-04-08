"use client";

import { useState, useEffect } from "react";
import { X, Check } from "lucide-react";

interface SpaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (name: string) => void;
}

export default function SpaceModal({ isOpen, onClose, onConfirm }: SpaceModalProps) {
  const [name, setName] = useState("");

  useEffect(() => {
    if (isOpen) setName("");
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={onClose} />

      <div
        className="relative w-full max-w-[400px] overflow-hidden rounded-2xl border border-[var(--border-strong)] bg-[var(--bg-modal)] shadow-[0_30px_80px_rgba(0,0,0,0.45)]"
        style={{ backgroundColor: "rgb(var(--background))", opacity: 1 }}
      >
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-[18px] font-semibold tracking-tight text-white">
              Nouvel espace
            </h2>
            <button
              onClick={onClose}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-white/30 hover:text-white/60 hover:bg-white/[0.04] transition-all"
            >
              <X size={14} />
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-[10px] uppercase tracking-[0.16em] text-white/30 mb-2 px-0.5">
                Nom de l&apos;espace
              </label>
              <input
                autoFocus
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && name.trim()) onConfirm(name);
                  if (e.key === "Escape") onClose();
                }}
                placeholder="Ex: Strategie Marketing..."
                className="w-full bg-white/[0.04] rounded-xl px-4 py-3 text-[14px] text-white outline-none focus:bg-white/[0.06] transition-all placeholder:text-white/20"
              />
            </div>

            <p className="text-[12px] text-white/25 leading-relaxed">
              Les espaces organisent vos discussions par projet ou thematique.
            </p>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl text-[12px] font-medium text-white/30 hover:text-white/50 hover:bg-white/[0.03] transition-all"
              >
                Annuler
              </button>
              <button
                onClick={() => name.trim() && onConfirm(name)}
                disabled={!name.trim()}
                className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-white text-black text-[12px] font-medium hover:bg-white/90 transition-all disabled:opacity-30"
              >
                Creer
                <Check size={13} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
