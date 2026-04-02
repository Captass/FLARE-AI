"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { FileText, Image as ImageIcon, Film, X, ChevronLeft, PenTool } from "lucide-react";
import TextEditorPanel from "./TextEditorPanel";
import GraphicDesignerPanel from "./GraphicDesignerPanel";
import VideoEditorPanel from "./VideoEditorPanel";

interface ContentStudioProps {
  onClose: () => void;
  token?: string | null;
}

type TabType = "text" | "visual" | "video";

const TABS: Array<{
  id: TabType;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}> = [
  { id: "text", label: "Ecrire", icon: FileText },
  { id: "visual", label: "Images", icon: ImageIcon },
  { id: "video", label: "Videos", icon: Film },
];

export default function ContentStudioPage({ onClose, token }: ContentStudioProps) {
  const [activeTab, setActiveTab] = useState<TabType>("visual");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    document.body.classList.add("hide-app-sidebar");
    return () => document.body.classList.remove("hide-app-sidebar");
  }, []);

  const content = (
    <motion.div
      initial={{ opacity: 0, scale: 0.985, y: 18 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.985, y: 18 }}
      transition={{ duration: 0.28, ease: "easeOut" }}
      style={{ zIndex: 999999, position: "fixed", inset: 0 }}
      className="flex flex-col overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(249,115,22,0.12),transparent_22%),radial-gradient(circle_at_top_right,rgba(147,51,234,0.12),transparent_26%),#09090b]"
    >
      <style>{`
        aside, .fixed.inset-y-0.left-0 { display: none !important; }
        body { overflow: hidden !important; }
      `}</style>

      <div className="relative shrink-0 border-b border-white/8 bg-black/30 backdrop-blur-xl">
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(249,115,22,0.12),transparent_30%,transparent_70%,rgba(168,85,247,0.12))]" />
        <div className="relative flex h-20 items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <button
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-zinc-400 transition-colors hover:border-white/16 hover:bg-white/10 hover:text-white"
            >
              <ChevronLeft size={18} />
            </button>

            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-orange-500/20 bg-gradient-to-br from-orange-500/18 to-fuchsia-500/10 text-orange-200 shadow-[0_0_40px_rgba(249,115,22,0.12)]">
                <PenTool size={20} />
              </div>
              <div>
                <h1 className="text-base font-bold text-white md:text-lg">Agent creation de contenu</h1>
                <p className="mt-1 text-sm text-zinc-400">
                  Dites ce que vous voulez. L&apos;agent vous aide a ecrire, creer une image ou faire une video.
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-zinc-400 transition-colors hover:border-red-500/30 hover:bg-red-500/10 hover:text-white"
          >
            <X size={18} />
          </button>
        </div>

        <div className="relative border-t border-white/6 px-4 py-3">
          <div className="flex items-center gap-2 overflow-x-auto">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex shrink-0 items-center gap-2 rounded-xl border px-4 py-2 text-xs font-semibold transition-colors ${
                    active
                      ? "border-white/14 bg-white/[0.08] text-white"
                      : "border-white/8 bg-white/[0.03] text-zinc-400"
                  }`}
                >
                  <Icon size={14} />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="relative min-h-0 flex-1 overflow-hidden bg-[var(--bg-sidebar)]">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 h-full w-full"
          >
            {activeTab === "text" && <TextEditorPanel />}
            {activeTab === "visual" && <GraphicDesignerPanel token={token} />}
            {activeTab === "video" && <VideoEditorPanel token={token} />}
          </motion.div>
        </AnimatePresence>
      </div>
    </motion.div>
  );

  if (!mounted) return null;

  return createPortal(content, document.body);
}
