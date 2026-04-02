"use client";

import React, { useEffect, useRef, useState, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { 
  Plus, 
  MessageSquare, 
  Globe, 
  ChevronDown, 
  ChevronUp, 
  Sparkles, 
  Copy, 
  Check, 
  RotateCcw,
  Search,
  Brain,
  Zap,
  RotateCw,
  FileText,
  FileSpreadsheet,
  ImageIcon,
  Volume2,
  BookOpen,
  ExternalLink,
  Download,
  Maximize2,
  X,
  ArrowUp,
  Home,
  ShieldCheck,
  LayoutDashboard,
  AlertCircle
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Message, SourceInfo, MessageAttachment, toRenderableMediaUrl } from "@/lib/api";
import FlareMark from "@/components/FlareMark";

interface ChatWindowProps {
  messages: Message[];
  isLoading: boolean;
  isFetchingHistory?: boolean;
  thought?: string | null;
  thoughts?: string[];
  error: string | null;
  onSuggestion?: (text: string) => void;
  onEditMessage?: (timestamp: string, newContent: string) => void;
  userName?: string;
  onViewArtifact?: (url: string, type: "image" | "video" | "document" | "sheet" | "code" | "unknown", name: string, previewUrl?: string) => void;
}

function cleanMarkdownForDisplay(raw: string): string {
  return raw
    .replace(/\[SUGGESTION:\s*[^\]]*\]/gi, "")
    .replace(/^\s*https?:\/\/storage\.googleapis\.com\/\S+\s*$/gim, "")
    .trim();
}

function normalizeVisibleText(value: string): string {
  return value
    .replace(/Ã©/g, "é")
    .replace(/Ã¨/g, "è")
    .replace(/Ãª/g, "ê")
    .replace(/Ã /g, "à")
    .replace(/Ã¢/g, "â")
    .replace(/î/g, "î")
    .replace(/ô/g, "ô")
    .replace(/ù/g, "ù")
    .replace(/û/g, "û")
    .replace(/ç/g, "ç")
    .replace(/É/g, "É")
    .replace(/À/g, "À")
    .replace(/·/g, "·")
    .replace(/.../g, "...")
    .replace(/✓/g, "✓")
    .replace(/→/g, "→")
    .replace(/—/g, "—")
    .replace(/–/g, "–")
    .replace(/⚡/g, "⚡");
}

function sanitizeAssistantContent(raw: string): string {
  const cleaned = normalizeVisibleText(cleanMarkdownForDisplay(raw || ""));
  if (!cleaned) return "";
  if (/^[\s\-–—_=~.*?]+$/.test(cleaned)) {
    return "Je n’ai pas pu générer une réponse claire. Réessaie avec une demande plus précise.";
  }
  return cleaned;
}

const SUGGESTIONS = [
  { icon: <Search size={14} />, label: "Rechercher", desc: "Trouvez vite les bonnes infos", text: "Fais une recherche claire sur les tendances du marketing digital en Afrique et donne-moi un résumé utile." },
  { icon: <Sparkles size={14} />, label: "Créer", desc: "Posts, emails et idées sur mesure", text: "Rédige un e-mail simple et convaincant pour trouver de nouveaux clients dans la tech." },
  { icon: <Brain size={14} />, label: "Analyser", desc: "Comprenez mieux avant d'agir", text: "Analyse ma stratégie marketing actuelle et dis-moi ce que je dois améliorer en priorité." },
  { icon: <Zap size={14} />, label: "Automatiser", desc: "Gagnez du temps chaque jour", text: "Aide-moi à automatiser mes relances clients, mon suivi hebdomadaire et ma veille." },
];

const STATUS_MESSAGES = [
  "Analyse de votre demande...",
  "Recherche dans la mémoire...",
  "Consultation de la base de connaissances...",
  "Organisation des informations...",
  "Préparation de la réponse...",
  "Derniers ajustements..."
];

/* Thinking Panel */
function ThinkingPanel({ thoughts, isLive }: { thoughts: string[]; isLive: boolean }) {
  const [isOpen, setIsOpen] = useState(isLive);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isLive) setIsOpen(true);
  }, [isLive]);

  useEffect(() => {
    if (isLive && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [thoughts, isLive]);

  if (!thoughts || thoughts.length === 0) return null;

  return (
    <div className="mb-4 w-full translate-y-1">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="surface-soft flex items-center gap-2.5 px-3.5 py-2 rounded-full hover:bg-[var(--bg-active)] transition-all group/think"
      >
        <div className="relative w-4 h-4 flex items-center justify-center">
            <motion.div 
               animate={{ rotate: 360 }}
               transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
               className={`absolute inset-0 border-t-2 border-blue-400/40 border-r-2 border-transparent rounded-full ${isLive ? 'opacity-100' : 'opacity-0'}`}
            />
            <Sparkles size={11} className={`text-blue-400/80 ${isLive ? 'animate-pulse' : ''}`} />
        </div>
        <span className="text-[11px] font-semibold text-[var(--text-muted)] group-hover:text-[var(--text-primary)] transition-colors tracking-wide uppercase">
          {isLive ? "Analyse en cours..." : "Chemin de réflexion"}
        </span>
        <span className="text-[10px] text-[var(--text-muted)] opacity-50 px-1">({thoughts.length} étapes)</span>
        <ChevronDown size={12} className={`text-[var(--text-muted)] transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div
              ref={scrollRef}
              className="mt-3 ml-2.5 pl-4 border-l border-[var(--border-glass)] space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar"
            >
              {thoughts.map((t, i) => (
                <div key={i} className="flex items-start gap-3 animate-fade-in-up group/thought" style={{ animationDelay: `${i * 30}ms` }}>
                  <span className="text-[10px] text-[var(--text-muted)] font-mono opacity-30 mt-1 shrink-0">{i + 1}</span>
                  <p className={`text-[13.5px] leading-relaxed font-light ${i === thoughts.length - 1 && isLive ? "text-[var(--text-primary)]" : "text-[var(--text-muted)]"}`}>
                    {normalizeVisibleText(t)}
                  </p>
                </div>
              ))}
              {isLive && (
                <div className="flex items-center gap-1.5 pt-2">
                  {[0, 1, 2].map((i) => (
                    <span key={i} className="w-1 h-1 rounded-full bg-blue-400/30" style={{ animation: "typingDot 1.2s ease-in-out infinite", animationDelay: `${i * 0.18}s` }} />
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* Citation Component */
function Citation({ index, url }: { index: number; url?: string }) {
  return (
    <a
      href={url || "#"}
      target={url ? "_blank" : undefined}
      rel="noopener noreferrer"
      className="inline-flex items-center justify-center w-4 h-4 text-[9px] font-bold text-[var(--text-primary)] bg-[var(--bg-hover)] border border-[var(--border-glass)] rounded-full mx-0.5 hover:bg-[var(--bg-active)] hover:scale-110 transition-all cursor-pointer select-none align-top mt-0.5"
      onClick={(e) => {
        if (!url) e.preventDefault();
      }}
    >
      {index}
    </a>
  );
}

function MarkdownImage({
  src,
  alt,
  onViewArtifact,
}: {
  src?: string;
  alt?: string;
  onViewArtifact?: (url: string, type: "image" | "video" | "document" | "sheet" | "code" | "unknown", name: string, previewUrl?: string) => void;
}) {
  const [failed, setFailed] = useState(false);
  const imageSrc = typeof src === "string" ? src.trim() : "";
  const previewSrc = toRenderableMediaUrl(imageSrc) || imageSrc;
  if (!previewSrc) return null;

  const imageName = alt?.trim() || "image";
  if (failed) {
    return (
      <div className="my-4 rounded-2xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-[13px] text-amber-200/80">
        {"L'image liée dans la réponse n'est plus disponible. Relance la génération pour obtenir un fichier exploitable."}
      </div>
    );
  }

  return (
    <div className="my-4 group/markdown-image">
      <img
        src={previewSrc}
        alt={imageName}
        className="w-full max-w-[620px] rounded-2xl border border-[var(--border-glass)] bg-[var(--bg-card)] object-cover shadow-xl cursor-pointer transition-all duration-300 hover:scale-[1.01] hover:border-[var(--border-subtle)]"
        loading="lazy"
        onError={() => setFailed(true)}
        onClick={() => {
          if (onViewArtifact) {
            onViewArtifact(imageSrc || previewSrc, "image", imageName, previewSrc);
          }
        }}
      />
      <div className="mt-2 flex items-center justify-between gap-3 text-[11px] text-[var(--text-muted)]">
        <span className="truncate">{imageName}</span>
        <button
          onClick={() => {
            if (onViewArtifact) {
              onViewArtifact(imageSrc || previewSrc, "image", imageName, previewSrc);
            } else {
              window.open(previewSrc, "_blank", "noopener,noreferrer");
            }
          }}
          className="rounded-full border border-[var(--border-glass)] px-3 py-1 text-[11px] font-medium text-[var(--text-primary)] transition-all hover:border-[var(--border-subtle)] hover:bg-[var(--bg-hover)]"
        >
          {"Voir l'image"}
        </button>
      </div>
    </div>
  );
}

/* Sources Panel */
function SourcesPanel({ sources, layout = "bottom" }: { sources: SourceInfo[]; layout?: "bottom" | "side" }) {
  if (!sources || sources.length === 0) return null;

  const isSide = layout === "side";

  return (
    <div className={`flex flex-col ${isSide ? "w-[240px] shrink-0 sticky top-4" : "mt-6 mb-2"}`}>
      <div className="flex items-center gap-1.5 mb-3">
        <Globe size={11} className="text-[var(--text-muted)]" />
        <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-[0.2em]">
          {isSide ? "Analyse des Sources" : "Sources"}
        </span>
      </div>
      <div className={`flex ${isSide ? "flex-col" : "flex-wrap"} gap-2.5`}>
        {sources.map((src, i) => (
          <a
            key={i}
            href={src.url}
            target="_blank"
            rel="noopener noreferrer"
          className="surface-soft flex items-center gap-3 px-3.5 py-3 rounded-2xl hover:border-[var(--border-subtle)] hover:bg-[var(--bg-hover)] transition-all group/src w-full"
          >
            <div className="flex items-center justify-center w-5 h-5 rounded-lg bg-[var(--bg-hover)] text-[9px] font-bold text-[var(--text-muted)] shrink-0 border border-[var(--border-glass)] group-hover/src:text-[var(--text-primary)] group-hover/src:border-[var(--border-subtle)] transition-all">
              {i + 1}
            </div>
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-[11.5px] font-medium text-[var(--text-primary)] truncate transition-colors group-hover/src:text-orange-400">
                {src.title}
              </span>
              <div className="flex items-center gap-1.5 mt-0.5">
                <img
                  src={`https://www.google.com/s2/favicons?domain=${src.domain || (src.url ? new URL(src.url).hostname : "")}&sz=32`}
                  alt=""
                  className="w-3 h-3 rounded-sm opacity-60 group-hover/src:opacity-100 transition-opacity"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
                <span className="text-[9px] text-[var(--text-muted)] truncate opacity-60">
                  {src.domain || (src.url ? new URL(src.url).hostname.replace("www.", "") : "")}
                </span>
              </div>
            </div>
            <ExternalLink size={10} className="text-[var(--text-muted)] shrink-0 opacity-0 group-hover/src:opacity-100 transition-opacity" />
          </a>
        ))}
      </div>
    </div>
  );
}

/* Suggestions Panel */
function SuggestionsPanel({ suggestions, onSelect }: { suggestions: string[], onSelect: (text: string) => void }) {
  if (!suggestions || suggestions.length === 0) return null;

  return (
    <div className="mt-4 flex flex-wrap gap-2 animate-fade-in-up" style={{ animationDelay: '300ms' }}>
      {suggestions.map((s, i) => (
        <button
          key={i}
          onClick={() => onSelect(s)}
          className="surface-soft flex items-center gap-2 px-4 py-2.5 rounded-2xl hover:bg-[var(--bg-card-hover)] hover:border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)] text-[12px] font-medium transition-all active-press"
        >
          <Sparkles size={11} className="text-[var(--text-muted)] opacity-60" />
          {s}
        </button>
      ))}
    </div>
  );
}

interface TypingIndicatorProps {
  thought?: string | null;
  thoughts?: string[];
  isLoading?: boolean;
}

function TypingIndicator({ thought, thoughts, isLoading }: TypingIndicatorProps) {
  const [step, setStep] = React.useState(0);

  React.useEffect(() => {
    setStep(0);
  }, [thought, isLoading]);

  React.useEffect(() => {
    if (thought) return;
    const interval = setInterval(() => {
      setStep((prev) => (prev < STATUS_MESSAGES.length - 1 ? prev + 1 : prev));
    }, 600);
    return () => clearInterval(interval);
  }, [thought, isLoading]); // Ajout de isLoading pour reset si besoin

  return (
    <div className="flex px-4 md:px-0 mb-8 animate-fade-in-up">
      <div className="w-10 h-10 flex items-center justify-center shrink-0 mt-1">
        <div className="w-9 h-9 rounded-xl bg-[var(--bg-card)] border border-[var(--border-glass)] flex items-center justify-center">
          <FlareMark tone="auto" className="w-4" />
        </div>
      </div>
      <div className="flex flex-col ml-3 max-w-[92%] md:max-w-[85%]">
        {/* Live thinking panel */}
        {thoughts && thoughts.length > 0 && (
          <ThinkingPanel thoughts={thoughts} isLive={true} />
        )}
        {/* Current step indicator */}
        <div className="surface-soft flex items-center gap-3 rounded-[22px] px-5 py-4">
          <div className="flex gap-1 items-center h-4">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="w-1.5 h-1.5 rounded-full bg-[var(--text-muted)]"
                style={{
                  animation: "typingDot 1.2s ease-in-out infinite",
                  animationDelay: `${i * 0.18}s`,
                }}
              />
            ))}
          </div>
          <p className="text-[13px] font-medium text-[var(--text-muted)] tracking-wide">
            {thought || STATUS_MESSAGES[step]}
          </p>
        </div>
      </div>
    </div>
  );
}

/* Image Lightbox */
function ImageLightbox({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  const handleDownload = () => {
    const link = document.createElement("a");
    link.href = src;
    link.download = alt || "image-generee.jpg";
    link.click();
  };

  return (
    <div
      className="fixed inset-0 z-[9999] bg-black/90 backdrop-blur-md flex items-center justify-center animate-fade-in"
      onClick={onClose}
    >
      <div className="absolute top-4 right-4 flex gap-2 z-10">
        <button
          onClick={(e) => { e.stopPropagation(); handleDownload(); }}
          className="p-3 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all border border-white/10"
          title="Télécharger"
        >
          <Download size={20} />
        </button>
        <button
          onClick={onClose}
          className="p-3 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all border border-white/10"
          title="Fermer"
        >
          <X size={20} />
        </button>
      </div>
      <img
        src={src}
        alt={alt}
        className="max-w-[95vw] max-h-[95vh] object-contain rounded-xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}

const AttachmentBubble = React.memo(function AttachmentBubble({ attachment, isUser, onViewArtifact }: { attachment: NonNullable<Message["attachment"]>; isUser: boolean; onViewArtifact?: (url: string, type: "image" | "video" | "document" | "sheet" | "code" | "unknown", name: string, previewUrl?: string) => void }) {
  const [lightboxOpen, setLightboxOpen] = React.useState(false);
  const attachmentName = attachment.name || "";
  const attachmentType = String((attachment as any).type || "").toLowerCase();
  const originalUrl = (attachment as any).url || attachment.dataUrl;
  const fileUrl = attachment.dataUrl || toRenderableMediaUrl((attachment as any).url) || (attachment as any).url;
  const isVideo = attachment.kind === "video" || attachmentType.startsWith("video/") || /\.(mp4|mov|webm|mkv)$/i.test(attachmentName);
  const isAudio = attachment.kind === "audio" || attachmentType.startsWith("audio/") || /\.(mp3|wav|ogg|m4a)$/i.test(attachmentName);
  const isSheet = attachment.kind === "sheet" || attachment.kind === "spreadsheet" || attachmentType.includes("spreadsheet") || attachmentType.includes("excel") || /\.(xlsx|xls|csv)$/i.test(attachmentName);
  const isCode = /\.(json|js|ts|tsx|html|css|py)$/i.test(attachmentName);
  const isDocument = !isCode && (attachment.kind === "document" || attachmentType.includes("wordprocessingml") || /\.(docx|doc|pdf|txt|md)$/i.test(attachmentName));
  const isRealImage = !isVideo && !isSheet && !isDocument && (attachment.kind === "image" || attachmentType.startsWith("image/") || /\.(png|jpe?g|webp|gif)$/i.test(attachmentName));
  const imgSrc = isRealImage ? fileUrl : null;
  if (isRealImage && imgSrc) {
    return (
      <>
        {lightboxOpen && <ImageLightbox src={imgSrc} alt={attachment.name} onClose={() => setLightboxOpen(false)} />}
        <div className="mb-2.5 group/img relative">
          <img
            src={imgSrc}
            alt={attachment.name}
            className="max-w-full md:max-w-[500px] max-h-[500px] rounded-2xl object-contain border border-[var(--border-glass)] shadow-2xl cursor-pointer hover:brightness-110 transition-all"
            onClick={() => {
              if (onViewArtifact) {
                onViewArtifact(originalUrl || imgSrc, "image", attachment.name || "image", imgSrc);
              } else {
                setLightboxOpen(true);
              }
            }}
          />
          <div className="absolute top-2 right-2 opacity-0 group-hover/img:opacity-100 transition-opacity flex gap-1.5">
            {onViewArtifact && (
              <button
                onClick={(e) => { e.stopPropagation(); onViewArtifact(originalUrl || imgSrc, "image", attachment.name || "image", imgSrc); }}
                className="p-2 rounded-lg bg-black/50 hover:bg-black/70 text-white transition-all backdrop-blur-sm"
                title="Ouvrir dans l'Artifact Viewer"
              >
                <LayoutDashboard size={14} />
              </button>
            )}
            <button
              onClick={() => setLightboxOpen(true)}
              className="p-2 rounded-lg bg-black/50 hover:bg-black/70 text-white transition-all backdrop-blur-sm"
              title="Plein écran"
            >
              <Maximize2 size={14} />
            </button>
            <button
              onClick={() => {
                const link = document.createElement("a");
                link.href = imgSrc;
                link.download = attachment.name || "image-generee.jpg";
                link.click();
              }}
              className="p-2 rounded-lg bg-black/50 hover:bg-black/70 text-white transition-all backdrop-blur-sm"
              title="Télécharger"
            >
              <Download size={14} />
            </button>
          </div>
          <p className="flex items-center gap-1 text-[10px] text-[var(--text-muted)] mt-1.5 font-mono">
            <ImageIcon size={9} /> {attachment.name}
          </p>
        </div>
      </>
    );
  }

  if (isAudio && attachment.dataUrl) {
    return (
      <div className={`mb-2.5 flex flex-col gap-1.5 ${isUser ? "items-end" : "items-start"}`}>
        <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${
          isUser
            ? "bg-[var(--bg-active)] border-[var(--border-subtle)]"
            : "bg-[var(--bg-card)] border-[var(--border-glass)]"
        }`}>
          <div className="w-7 h-7 rounded-lg bg-[var(--bg-hover)] border border-[var(--border-glass)] flex items-center justify-center shrink-0">
            <Volume2 size={12} className="text-[var(--text-muted)]" />
          </div>
          <div>
            <p className="text-[10px] font-medium text-[var(--text-primary)]">Audio</p>
            <p className="text-[9px] text-[var(--text-muted)]">{attachment.name || "voice.webm"}</p>
          </div>
        </div>
        <audio
          src={attachment.dataUrl}
          controls
          className="h-8 w-full max-w-[240px] opacity-70 rounded-lg"
          style={{ colorScheme: "dark" }}
        />
      </div>
    );
  }

  if (isVideo && fileUrl) {
    const videoSrc = attachment.dataUrl || toRenderableMediaUrl((attachment as any).url) || fileUrl;
    const handleVideoDownload = () => {
      const link = document.createElement("a");
      link.href = videoSrc;
      link.download = attachment.name || "video-generee.mp4";
      link.click();
    };
    return (
      <div className="mb-3 w-full max-w-[500px]">
        {/* Avertissement vidéo temporaire */}
        <div className="flex items-center gap-2 px-3 py-2 mb-2 rounded-xl bg-amber-500/10 border border-amber-500/20">
          <AlertCircle size={14} className="text-amber-400 shrink-0" />
          <p className="text-[11px] text-amber-300">
            Cette vidéo est <strong>temporaire</strong>. Enregistrez-la pour la garder.
          </p>
          <button
            onClick={handleVideoDownload}
            className="ml-auto px-3 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-[11px] font-medium transition-all shrink-0 flex items-center gap-1"
          >
            <Download size={12} /> Sauvegarder
          </button>
        </div>
        <div className="relative rounded-2xl overflow-hidden border border-[var(--border-glass)] shadow-2xl bg-black aspect-video group/video">
          <video
            src={videoSrc}
            controls
            className="w-full h-full object-contain"
          />
          <button
            onClick={handleVideoDownload}
            className="absolute top-3 right-3 p-2 rounded-lg bg-black/60 hover:bg-black/80 text-white transition-all backdrop-blur-sm opacity-0 group-hover/video:opacity-100"
            title="Télécharger"
          >
            <Download size={16} />
          </button>
        </div>
        <p className="flex items-center gap-1.5 text-[10px] text-[var(--text-muted)] mt-2 font-mono uppercase tracking-wider">
          <Sparkles size={10} className="text-[var(--text-muted)]" /> Généré par VEO 3 • {normalizeVisibleText(attachment.name)}
        </p>
      </div>
    );
  }

  const handleAction = () => {
    if (!fileUrl) return;

    if (onViewArtifact) {
      const type = isSheet ? "sheet" : isCode ? "code" : isDocument ? "document" : "unknown";
      onViewArtifact(fileUrl, type, attachment.name || "document");
    } else {      const link = document.createElement("a");
      link.href = fileUrl;
      link.download = attachment.name || "document";
      link.target = "_blank";
      link.click();
    }
  };

  return (
    <div 
      onClick={handleAction}
      className={`flex items-center gap-3 mb-2.5 px-4 py-3 rounded-2xl border max-w-[320px] transition-all cursor-pointer hover:-translate-y-0.5 hover:shadow-lg ${
      isUser
        ? "bg-[var(--bg-active)] border-[var(--border-subtle)]"
        : "bg-[var(--bg-card)] border-[var(--border-glass)] hover:border-[#1B2A4A]/30 shadow-sm"
    }`}>
      <div className={`p-2 rounded-xl flex items-center justify-center ${
        isDocument ? "bg-[#1B2A4A]/10 text-[#1B2A4A]" : 
        isSheet ? "bg-[#107C41]/10 text-[#107C41]" :
        "bg-[var(--bg-hover)] text-[var(--text-muted)]"
      }`}>
        {isSheet ? (
          <FileSpreadsheet size={16} className="shrink-0" />
        ) : (
          <FileText size={16} className="shrink-0" />
        )}
      </div>
      <div className="flex flex-col min-w-0 flex-1">
        <span className="text-[12px] font-semibold text-[var(--text-primary)] truncate">{attachment.name}</span>
        <span className="text-[10px] text-[var(--text-muted)] font-medium mt-0.5 uppercase tracking-wider">
          {isSheet ? "Tableur Excel" : isDocument ? "Document Word" : "Fichier"}
        </span>
      </div>
      {fileUrl && (
        <div className="p-1.5 rounded-full bg-[var(--bg-hover)] text-[var(--text-muted)] group-hover:text-[var(--text-primary)] transition-colors">
          {onViewArtifact ? <LayoutDashboard size={14} /> : <Download size={14} />}
        </div>
      )}
    </div>
  );
});

function FloatingActionBar({ text, className }: { text: string; className?: string }) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 5 }}
      className={`flex items-center gap-1 p-1 bg-[var(--bg-modal)] backdrop-blur-xl border border-[var(--border-glass)] rounded-xl shadow-2xl z-20 ${className || ""}`}
    >
      <button
        onClick={handleCopy}
        className="p-1.5 hover:bg-[var(--bg-hover)] rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all flex items-center gap-2 px-2"
        title="Copier"
      >
        {copied ? (
          <>
            <Check size={12} className="text-green-400" />
            <span className="text-[10px] font-medium text-green-400">Copié</span>
          </>
        ) : (
          <>
            <Copy size={12} />
            <span className="text-[10px] font-medium">Copier</span>
          </>
        )}
      </button>
      <div className="w-px h-3 bg-[var(--border-glass)] mx-0.5" />
      <button
        className="p-1.5 hover:bg-[var(--bg-hover)] rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all flex items-center gap-2 px-2"
        title="Partager"
      >
        <Sparkles size={12} />
        <span className="text-[10px] font-medium">Améliorer</span>
      </button>
    </motion.div>
  );
}

function CopyButton({ text, className }: { text: string; className?: string }) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className={`p-1 hover:bg-[var(--bg-hover)] rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all ${className || ""}`}
      title="Copier"
    >
      {copied ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
    </button>
  );
}

const MessageBubble = React.memo(function MessageBubble({ message, onEdit, onSuggestion, onViewArtifact }: { message: Message; onEdit?: (ts: string, newContent: string) => void, onSuggestion?: (text: string) => void, onViewArtifact?: (url: string, type: "image" | "video" | "document" | "sheet" | "code" | "unknown", name: string, previewUrl?: string) => void }) {
  const isUser = message.role === "user";
  const [isEditing, setIsEditing] = React.useState(false);
  const [editContent, setEditContent] = React.useState(message.content || "");

  // Si le contenu est un JSON de refinement, afficher le message lisible à la place du JSON brut
  const displayContent = React.useMemo(() => {
    const raw = message.content || "";
    if (!isUser) return sanitizeAssistantContent(raw);
    try {
      const data = JSON.parse(raw);
      if (data?.prompt && data?.selection?.type === "document_refinement") {
        const instruction = data.prompt
          .replace(/\[SELECTION\][\s\S]*?\[\/SELECTION\]\n?/gi, "")
          .replace(/^Instruction\s*:\s*/i, "")
          .trim();
        const fileName = data.selection?.file_name ? ` *(${data.selection.file_name})*` : "";
        return instruction + fileName;
      }
    } catch { /* pas du JSON, on affiche tel quel */ }
    return raw;
  }, [message.content, isUser]);

  // Détection automatique d'un fichier GCS dans le texte si aucun attachment n'est défini
  const extractedAttachment = React.useMemo((): MessageAttachment | null => {
    if (message.attachment || isUser) return null;
    const raw = message.content || "";
    // Cherche soit [nom.docx](url) soit [url-se-terminant-par.docx](url)
    const match = raw.match(/\[([^\]]*\.(docx|xlsx))\]\((https:\/\/storage\.googleapis\.com\/[^)]+)\)/i)
      || raw.match(/\[(https:\/\/storage\.googleapis\.com\/[^)]+\.(docx|xlsx))\]\((https:\/\/storage\.googleapis\.com\/[^)]+)\)/i);
    if (!match) return null;
    const rawName = match[1];
    const ext = (match[2] || rawName.split('.').pop() || "docx").toLowerCase();
    const url = match[3] || match[1];
    // Nettoyer le nom : extraire le vrai filename si c'est une URL
    const cleanedName = rawName.startsWith('http')
      ? decodeURIComponent(rawName.split('/').pop()?.split('?')[0] || rawName)
          .replace(/^(?:doc|sheet)_[a-f0-9]{8}_/i, '')
      : rawName;
    return {
      kind: ext === "xlsx" ? "sheet" : "document",
      name: cleanedName,
      url,
      type: ext === "xlsx"
        ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        : "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    } as MessageAttachment;
  }, [message.attachment, message.content, isUser]);

  const displayAttachment = message.attachment || extractedAttachment;

  const handleSaveEdit = () => {
    if (editContent.trim() !== message.content && message.timestamp && onEdit) {
      onEdit(message.timestamp, editContent);
    }
    setIsEditing(false);
  };

  return (
    <div className={`flex w-full mb-8 msg-appear ${isUser ? "justify-end px-4 md:px-0" : "justify-start px-3 md:px-0"} group overflow-x-hidden`}>
      <div className={`${isUser ? "flex gap-2 md:gap-3 max-w-full md:max-w-[85%] flex-row-reverse" : "w-full"}`}>

        {/* Bubble */}
        <div className={`flex flex-col ${isUser ? "items-end" : "items-start w-full"} min-w-0`}>
        {isUser ? (
          <div className="bg-[var(--bg-active)] border border-[var(--border-glass)] rounded-[28px] md:rounded-3xl px-4 md:px-5 py-3 md:py-3.5 text-[15px] md:text-[15.5px] leading-[1.6] text-[var(--text-primary)] relative group/bubble hover:border-[var(--border-subtle)] transition-all duration-300 shadow-sm dark:shadow-[var(--shadow-card)] max-w-[92vw]">
            {!isEditing && (
              <div className="absolute top-2 right-2 opacity-0 group-hover/bubble:opacity-100 transition-opacity bg-[var(--bg-modal)] rounded-lg p-1 border border-[var(--border-glass)] flex gap-0.5 z-10 shadow-md">
                <button
                  onClick={() => setIsEditing(true)}
                  className="p-1 hover:bg-[var(--bg-hover)] rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all active-press"
                  title="Modifier"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="hover:scale-110 transition-transform"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                </button>
                <CopyButton text={message.content} className="active-press" />
              </div>
            )}

            {message.attachment && <AttachmentBubble attachment={message.attachment} isUser={true} onViewArtifact={onViewArtifact} />}

            {isEditing ? (
              <div className="flex flex-col gap-3 w-full min-w-[260px]">
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="w-full bg-[var(--bg-input)] border border-orange-500/20 text-[var(--text-primary)] text-sm p-3 rounded-xl resize-y min-h-[80px] focus:outline-none focus:border-orange-500/40 transition-all"
                  autoFocus
                />
                <div className="flex justify-end gap-2">
                  <button onClick={() => setIsEditing(false)} className="px-4 py-2 text-[12px] rounded-xl bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all font-medium border border-[var(--border-glass)]">Annuler</button>
                  <button onClick={handleSaveEdit} className="px-4 py-2 text-[12px] rounded-xl bg-[var(--text-primary)] text-[var(--background)] hover:opacity-90 transition-all font-bold">Valider</button>
                </div>
              </div>
            ) : (
              displayContent ? <p className="text-[15.5px] font-normal leading-relaxed whitespace-pre-wrap">{displayContent}</p> : null
            )}

            {message.timestamp && (
              <div className="flex items-center justify-end gap-2 mt-1.5 opacity-80">
                {message.responseTime != null && !isNaN(message.responseTime) && (
                   <span className="text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-tighter">
                     Réponse en {Number(message.responseTime).toFixed(1)}s
                   </span>
                )}
                <p className="text-[11px] font-normal text-[var(--text-muted)] tracking-tight font-mono">
                  {new Date(message.timestamp).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="w-full mt-2.5 selection:bg-white/10">
            {/* Reasoning steps (collapsible) */}
            {message.thoughts && message.thoughts.length > 0 && (
              <ThinkingPanel thoughts={message.thoughts} isLive={false} />
            )}

            <div className="flex flex-col items-start w-full">
              <div className="w-full overflow-hidden py-1 relative group/ai-bubble">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    p: ({ children }) => {
                      // Logic to parse [x] in text nodes
                      const processChildren = (nodes: React.ReactNode): React.ReactNode => {
                        return React.Children.map(nodes, (node) => {
                          if (typeof node === "string") {
                            const parts = node.split(/(\[\d+\])/g);
                            return parts.map((part, i) => {
                              const match = part.match(/^\[(\d+)\]$/);
                              if (match) {
                                const index = parseInt(match[1]);
                                const source = message.sources?.[index - 1];
                                return <Citation key={i} index={index} url={source?.url} />;
                              }
                              return part;
                            });
                          }
                          return node;
                        });
                      };
                      return <p className="mb-4 last:mb-0 leading-[1.8] text-[var(--text-primary)]/85 font-light text-[15px] tracking-wide">{processChildren(children)}</p>;
                    },
                    a: ({ href, children }) => {
                      const text = String(children);
                      const match = text.match(/^\[(\d+)\]$/);
                      if (match) {
                        return <Citation index={parseInt(match[1])} url={href} />;
                      }
                      return (
                        <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 underline underline-offset-2 decoration-blue-400/30 hover:decoration-blue-300/50 transition-colors">
                          {children}
                        </a>
                      );
                    },
                    img: ({ src, alt }) => <MarkdownImage src={typeof src === "string" ? src : undefined} alt={typeof alt === "string" ? alt : undefined} onViewArtifact={onViewArtifact} />,
                    ul: ({ children }) => <ul className="list-disc list-outside mb-4 space-y-2 pl-6 marker:text-[var(--text-muted)] font-light tracking-wide">{children}</ul>,
                    ol: ({ children }) => <ol className="list-decimal list-outside mb-4 space-y-2 pl-6 marker:text-[var(--text-muted)] font-light tracking-wide">{children}</ol>,
                    li: ({ children }) => <li className="text-[15px] text-[var(--text-primary)]/85 font-light leading-[1.8]">{children}</li>,
                    strong: ({ children }) => <strong className="font-semibold text-[var(--text-primary)]">{children}</strong>,
                    em: ({ children }) => <em className="italic text-[var(--text-muted)]/70 font-light">{children}</em>,
                    code: ({ children, className }) => {
                      const isBlock = className?.includes("language-");
                      const lang = className?.replace("language-", "") || "";
                      if (isBlock) return (
                        <div className="my-5 rounded-2xl overflow-hidden border border-[var(--border-glass)] shadow-2xl transition-all hover:border-[var(--border-subtle)] group/code">
                          <div className="flex items-center justify-between px-4 py-2 bg-[var(--bg-glass-dark)] border-b border-[var(--border-glass)] group-hover/code:bg-[var(--bg-active)] transition-colors">
                            <div className="flex items-center gap-1.5 mr-4">
                              <div className="w-2.5 h-2.5 rounded-full bg-[#ff5f56] shadow-[0_0_4px_rgba(255,95,86,0.3)]" />
                              <div className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e] shadow-[0_0_4px_rgba(255,189,46,0.3)]" />
                              <div className="w-2.5 h-2.5 rounded-full bg-[#27c93f] shadow-[0_0_4px_rgba(39,201,63,0.3)]" />
                            </div>
                            <span className="text-[10px] font-mono text-[var(--text-muted)] uppercase tracking-wider flex-1 text-center pr-10">{lang || "code"}</span>
                            <CopyButton text={String(children)} />
                          </div>
                          <code className="block bg-[#0c0c0f] text-[var(--text-primary)]/90 px-6 py-5 text-[13px] font-mono overflow-x-auto custom-scrollbar leading-relaxed">
                            {children}
                          </code>
                        </div>
                      );
                      return <code className="bg-[var(--bg-hover)] text-[var(--text-primary)] px-1.5 py-0.5 rounded text-[14px] font-mono border border-[var(--border-glass)]">{children}</code>;
                    },
                    pre: ({ children }) => <>{children}</>,
                    h1: ({ children }) => <h1 className="text-2xl font-bold mb-5 mt-8 text-[var(--text-primary)] tracking-tight font-[family-name:var(--font-outfit)]">{children}</h1>,
                    h2: ({ children }) => <h2 className="text-xl font-bold mb-4 mt-6 text-[var(--text-primary)] tracking-tight font-[family-name:var(--font-outfit)]">{children}</h2>,
                    h3: ({ children }) => <h3 className="text-lg font-semibold mb-3 mt-5 text-[var(--text-primary)] tracking-tight font-[family-name:var(--font-outfit)]">{children}</h3>,
                    hr: () => <hr className="border-[var(--border-glass)] my-6" />,
                    blockquote: ({ children }) => (
                      <blockquote className="border-l-4 border-[var(--border-glass)] bg-[var(--bg-hover)] px-4 py-2 my-4 rounded-r-xl text-[var(--text-muted)] italic font-light">{children}</blockquote>
                    ),
                    table: ({ children }) => (
                      <div className="my-5 rounded-2xl overflow-hidden border border-[var(--border-glass)] shadow-lg">
                        <div className="overflow-x-auto">
                          <table className="w-full text-left border-collapse">{children}</table>
                        </div>
                      </div>
                    ),
                    thead: ({ children }) => (
                      <thead className="bg-[var(--bg-hover)] border-b border-[var(--border-glass)]">{children}</thead>
                    ),
                    tbody: ({ children }) => (
                      <tbody className="divide-y divide-[var(--border-glass)]">{children}</tbody>
                    ),
                    tr: ({ children }) => (
                      <tr className="hover:bg-[var(--bg-hover)] transition-colors">{children}</tr>
                    ),
                    th: ({ children }) => (
                      <th className="px-4 py-3 text-[12px] font-bold text-[var(--text-primary)] uppercase tracking-wider font-[family-name:var(--font-outfit)]">{children}</th>
                    ),
                    td: ({ children }) => (
                      <td className="px-4 py-3 text-[14px] text-[var(--text-primary)]/80 font-light leading-relaxed">{children}</td>
                    ),
                  }}
                >
                  {sanitizeAssistantContent(message.content || "")}
                </ReactMarkdown>
                
                <AnimatePresence>
                  <div className="hidden md:block absolute top-0 right-2 opacity-0 group-hover/ai-bubble:opacity-100 transition-all duration-300 translate-y-[-4px] group-hover/ai-bubble:translate-y-0 z-20">
                    <FloatingActionBar text={message.content || ""} />
                  </div>
                </AnimatePresence>

                {displayAttachment && (
                  <div className="mt-4 mb-2">
                    <AttachmentBubble attachment={displayAttachment} isUser={false} onViewArtifact={onViewArtifact} />
                  </div>
                )}

                {/* Sources for Mobile (at bottom) */}
                <div className="block md:hidden">
                  {message.sources && message.sources.length > 0 && (
                    <SourcesPanel sources={message.sources} layout="bottom" />
                  )}
                </div>

                {message.timestamp && (
                  <div className="flex items-center gap-2 mt-4 opacity-80">
                    <p className="text-[11px] font-normal text-[var(--text-muted)] font-mono">
                      {new Date(message.timestamp).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                    </p>
                    {message.responseTime != null && !isNaN(message.responseTime) && (
                       <span className="flex items-center gap-1 text-[10px] text-[var(--text-muted)] font-bold ml-2 bg-[var(--bg-hover)] px-1.5 py-0.5 rounded border border-[var(--border-glass)] shadow-sm">
                         <Sparkles size={10} className="fill-[var(--text-muted)]" /> {Number(message.responseTime).toFixed(1)}s
                       </span>
                    )}
                  </div>
                )}
                {message.knowledgeSaved && message.knowledgeSaved.length > 0 && (
                  <div className="flex items-center gap-1.5 mt-3 px-3 py-1.5 rounded-xl bg-[var(--bg-hover)] border border-[var(--border-glass)] w-fit">
                    <BookOpen size={10} className="text-[var(--text-muted)] shrink-0" />
                    <span className="text-[10px] text-[var(--text-muted)] font-semibold tracking-wide uppercase">
                      {message.knowledgeSaved.length === 1
                        ? `Indexé : "${normalizeVisibleText(message.knowledgeSaved[0])}"`
                        : `${message.knowledgeSaved.length} docs indexés`}
                    </span>
                  </div>
                )}
              </div>

              {/* Side Sources Panel for Desktop */}
              <div className="hidden md:block">
                {message.sources && message.sources.length > 0 && (
                  <SourcesPanel sources={message.sources} layout="side" />
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  </div>
  );
}, (prev, next) => 
  prev.message.id === next.message.id && 
  prev.message.content === next.message.content &&
  prev.message.responseTime === next.message.responseTime &&
  prev.message.knowledgeSaved?.length === next.message.knowledgeSaved?.length &&
  prev.message.suggestions?.length === next.message.suggestions?.length
);

export default function ChatWindow({ messages, isLoading, isFetchingHistory, thought, thoughts, error, onSuggestion, onEditMessage, userName, onViewArtifact }: ChatWindowProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showScrollTop, setShowScrollTop] = React.useState(false);
  const [showScrollBottom, setShowScrollBottom] = React.useState(false);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      setShowScrollTop(scrollTop > 300);
      setShowScrollBottom(scrollHeight - scrollTop - clientHeight > 300);
    };
    container.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => container.removeEventListener("scroll", handleScroll);
  }, [messages]);

  const scrollToTop = () => scrollContainerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  const scrollToBottom = () => bottomRef.current?.scrollIntoView({ behavior: "smooth" });

  const isEmpty = messages.length === 0;

  return (
    <div 
      ref={scrollContainerRef} 
      className="flex-1 overflow-y-auto overflow-x-hidden bg-[var(--background)] h-full transition-colors duration-500 relative overscroll-contain"
      style={{ scrollbarGutter: 'stable' }}
    >
      {/* â”€â”€ Neural Glow Background Removed â”€â”€ */}

      {error && isEmpty && (
        <div className="mx-auto max-w-2xl px-4 pt-4 relative z-10">
          <div className="flex items-center gap-2 bg-red-500/5 border border-red-500/20 text-red-400 rounded-2xl px-4 py-2.5 text-[13px] animate-fade-in-up">
            <AlertCircle size={14} className="shrink-0" />
            {error}
          </div>
        </div>
      )}
      {isEmpty && !isLoading ? (
        <div className="flex flex-col items-center justify-center min-h-full px-6 text-center select-none relative pb-16">
          {/* Animated glow orbs Removed */}

          <div className="flex flex-col z-10 max-w-4xl w-full animate-fade-in-up items-center gap-2">
            <div className="flex flex-col items-center text-center gap-0">
              <div className="flex items-center gap-4 md:gap-5 mb-2 md:mb-0">
                <motion.div 
                  initial={{ scale: 0.95, opacity: 0.8 }}
                  animate={{ 
                    scale: [0.95, 1.05, 0.95],
                    opacity: [0.8, 1, 0.8],
                    boxShadow: [
                      "0 0 20px rgba(255,255,255,0.06)",
                      "0 0 40px rgba(255,255,255,0.14)",
                      "0 0 20px rgba(255,255,255,0.06)"
                    ]
                  }}
                  transition={{ 
                    duration: 4, 
                    repeat: Infinity, 
                    ease: "easeInOut" 
                  }}
                  className="flex h-12 w-12 items-center justify-center rounded-[28%] border border-white/10 bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.12),rgba(255,255,255,0.03)_55%,transparent_100%)] md:h-[72px] md:w-[72px]" 
                >
                  <FlareMark tone="auto" className="w-7 md:w-10" />
                </motion.div>
                <h2 className="text-[clamp(1.5rem,4vw,2.25rem)] md:text-[42px] font-medium text-[var(--text-primary)] tracking-tight leading-tight font-[family-name:var(--font-outfit)]">
                  {userName ? `Bonjour ${userName.charAt(0).toUpperCase() + userName.slice(1)}` : "Bonjour"}
                </h2>
              </div>
              <h3 className="text-[clamp(1.25rem,4vw,2.5rem)] md:text-[40px] font-light text-[var(--text-muted)] tracking-tight leading-snug font-[family-name:var(--font-outfit)] opacity-70 max-w-[600px]">
                {"Que voulez-vous créer aujourd'hui ?"}
              </h3>
            </div>
          </div>

          {/* Sous-titre centré */}
          <p className="text-[13px] md:text-[14px] text-[var(--text-muted)] font-light text-center mt-2 mb-2 opacity-60 z-10">
            Recherche, création, images, vidéos et automatisation. Tout au même endroit.
          </p>

          <motion.div 
            initial="hidden"
            animate="show"
            variants={{
              hidden: { opacity: 0 },
              show: {
                opacity: 1,
                transition: {
                  staggerChildren: 0.1
                }
              }
            }}
            className="grid grid-cols-2 gap-2.5 md:gap-3 mt-6 md:mt-10 z-10 max-w-lg md:max-w-3xl w-full px-4 pb-8 md:pb-0 md:grid-cols-4"
          >
            {SUGGESTIONS.map((s, i) => (
              <motion.button
                key={i}
                variants={{
                  hidden: { opacity: 0, y: 20 },
                  show: { opacity: 1, y: 0 }
                }}
                onClick={() => onSuggestion?.(s.text)}
                className="relative flex flex-col items-start gap-2 md:gap-2.5 px-4 md:px-5 py-4 md:py-5 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-glass)] transition-all text-left group active-press hover:scale-[1.03] overflow-hidden"
                style={{
                  boxShadow: "0 0 0 0 transparent",
                  transition: "transform 0.2s ease, box-shadow 0.3s ease"
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = "0 8px 40px -8px rgba(249,115,22,0.55), 0 0 0 1px rgba(249,115,22,0.15)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = "0 0 0 0 transparent"; }}
              >
                {/* Orange LED glow from behind */}
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-3/4 h-1 rounded-full bg-orange-500/0 group-hover:bg-orange-500/60 transition-all duration-500 blur-md" />
                <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-1/2 h-8 bg-orange-500/0 group-hover:bg-orange-500/30 transition-all duration-500 blur-2xl rounded-full" />

                <div className="w-8 h-8 rounded-xl bg-[var(--bg-hover)] flex items-center justify-center text-[var(--text-muted)] group-hover:text-orange-400 group-hover:scale-110 transition-all shrink-0 z-10">
                  {React.cloneElement(s.icon as React.ReactElement, { size: 15 })}
                </div>
                <div className="flex flex-col gap-0.5 z-10">
                  <span className="font-semibold tracking-wide text-[13px] md:text-[14px] text-[var(--text-primary)] leading-snug">{s.label}</span>
                  <span className="text-[10px] md:text-[11px] text-[var(--text-muted)] font-light leading-relaxed">{s.desc}</span>
                </div>
              </motion.button>
            ))}
          </motion.div>
        </div>
      ) : (
        <div className="w-full max-w-3xl mx-auto pt-8 pb-40 px-4 relative z-10">
          {error && (
            <div className="flex items-center gap-2 bg-red-500/5 border border-red-500/20 text-red-400 rounded-2xl px-4 py-2.5 mb-6 text-[13px] animate-fade-in-up">
              <AlertCircle size={14} className="shrink-0" />
              {error}
            </div>
          )}
          {messages.map((msg, i) => (
            <MessageBubble key={msg.id ?? i} message={msg} onEdit={onEditMessage} onSuggestion={onSuggestion} onViewArtifact={onViewArtifact} />
          ))}
          {isFetchingHistory && (
             <div className="flex flex-col gap-4 opacity-50 animate-pulse mt-4">
                <div className="h-4 bg-[var(--bg-hover)] rounded-full w-3/4 ml-4" />
                <div className="h-4 bg-[var(--bg-hover)] rounded-full w-1/2 ml-4" />
             </div>
          )}

          {isLoading && !isFetchingHistory && <TypingIndicator thought={thought} thoughts={thoughts} isLoading={isLoading} />}
          <div ref={bottomRef} />
        </div>
      )}

      {/* Scroll navigation buttons */}
      {!isEmpty && (
        <div className="fixed right-3 md:right-6 bottom-28 md:bottom-44 z-20 flex flex-col gap-2 opacity-80 hover:opacity-100 transition-opacity">
          {showScrollTop && (
            <button
              onClick={scrollToTop}
              className="p-2.5 md:p-3 rounded-xl bg-[var(--bg-card)] border border-[var(--border-glass)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--border-subtle)] shadow-2xl transition-all animate-fade-in active-press backdrop-blur-md"
              title="Remonter en haut"
            >
              <ChevronUp size={20} />
            </button>
          )}
          {showScrollBottom && (
            <button
              onClick={scrollToBottom}
              className="p-2.5 md:p-3 rounded-xl bg-[var(--bg-card)] border border-[var(--border-glass)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--border-subtle)] shadow-2xl transition-all animate-fade-in active-press backdrop-blur-md"
              title="Descendre en bas"
            >
              <ChevronDown size={20} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}




