"use client";

import { useState, useRef, useEffect, KeyboardEvent, ChangeEvent, DragEvent, useCallback } from "react";
import { Send, X, FileText, Loader2, Square, Mic, Volume2, Plus, ChevronDown, Zap, StopCircle, Info, Sparkles, Brain, Search, Image as ImageIcon, Video, Briefcase, FileSpreadsheet, CornerDownLeft } from "lucide-react";
import { FileAttachment, uploadKnowledgeFile, getPrompts, type PromptTemplate } from "@/lib/api";

export type { FileAttachment };

interface MessageInputProps {
  onSend: (message: string, attachment?: FileAttachment, deepResearch?: boolean, quality?: string, chatMode?: "raisonnement" | "rapide") => void;
  onStop?: () => void;
  isLoading: boolean;
  disabled?: boolean;
  authToken?: string | null;
  onKnowledgeSaved?: (titles: string[]) => void;
  restoredValue?: string;
  onRestoredValueConsumed?: () => void;
  restoredAttachment?: FileAttachment | null;
  onRestoredAttachmentConsumed?: () => void;
  chatMode: "raisonnement" | "rapide";
  setChatMode: (mode: "raisonnement" | "rapide") => void;
}

const ACCEPTED_TYPES = "image/png,image/jpeg,image/gif,image/webp,.txt,.md,.csv,.json,.js,.ts,.tsx,.py,.html,.css,.xml,.yaml,.yml,audio/*,video/*,.pdf,.docx,.xlsx,.xls,.pptx";

export default function MessageInput({
  onSend,
  onStop,
  isLoading,
  disabled,
  authToken,
  onKnowledgeSaved,
  restoredValue,
  onRestoredValueConsumed,
  restoredAttachment,
  onRestoredAttachmentConsumed,
  chatMode,
  setChatMode,
}: MessageInputProps) {
  const [value, setValue] = useState("");
  const [attachment, setAttachment] = useState<FileAttachment | null>(null);
  const [loadingFile, setLoadingFile] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [deepResearch, setDeepResearch] = useState(false);
  const [docGen, setDocGen] = useState(false);
  const [sheetGen, setSheetGen] = useState(false);
  const [showToolsDropdown, setShowToolsDropdown] = useState(false);
  const [imageGen, setImageGen] = useState(false);
  const [videoGen, setVideoGen] = useState(false);
  const [mediaQuality, setMediaQuality] = useState<"HD" | "2K">("HD");
  const [micError, setMicError] = useState<string | null>(null);
  const [placeholder, setPlaceholder] = useState("Demander à Flare AI...");

  // ── Slash commands ──────────────────────────────────────────────────────────
  const [prompts, setPrompts] = useState<PromptTemplate[]>([]);
  const [slashIndex, setSlashIndex] = useState(0);

  // Dérivé — menu slash actif si value = "/..." sans espace
  const isSlashActive = value.startsWith("/") && !value.includes(" ") && !isLoading;
  const slashQuery = isSlashActive ? value.slice(1).toLowerCase() : "";
  const slashSuggestions = isSlashActive
    ? prompts
        .filter((p) => !slashQuery || p.title.toLowerCase().includes(slashQuery))
        .slice(0, 7)
    : [];
  const showSlashMenu = isSlashActive && slashSuggestions.length > 0;

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 180) + "px";
  }, [value]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  useEffect(() => {
    if (restoredValue) {
      setValue(restoredValue);
      onRestoredValueConsumed?.();
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
  }, [restoredValue, onRestoredValueConsumed]);

  useEffect(() => {
    if (restoredAttachment) {
      setAttachment(restoredAttachment);
      onRestoredAttachmentConsumed?.();
    }
  }, [restoredAttachment, onRestoredAttachmentConsumed]);

  // Charger les prompts pour les slash commands
  useEffect(() => {
    if (!authToken) return;
    getPrompts(authToken).then(setPrompts).catch(() => {});
  }, [authToken]);

  // Reset de l'index sélectionné quand les suggestions changent
  useEffect(() => {
    setSlashIndex(0);
  }, [slashSuggestions.length]);

  useEffect(() => {
    const handleInitialPrompt = (e: any) => {
      if (e.detail) {
        setValue(e.detail);
        setTimeout(() => textareaRef.current?.focus(), 100);
      }
    };
    window.addEventListener('initial-prompt', handleInitialPrompt);
    return () => window.removeEventListener('initial-prompt', handleInitialPrompt);
  }, []);

  useEffect(() => {
    if (imageGen) {
      setPlaceholder("Décrivez l'image à générer...");
    } else if (videoGen) {
      setPlaceholder("Décrivez la vidéo à générer...");
    } else if (docGen) {
      setPlaceholder("Sujet du document Word (ex: Rédige un rapport sur...)...");
    } else if (sheetGen) {
      setPlaceholder("Que voulez-vous dans ce tableau Excel ?...");
    } else {
      setPlaceholder("Demander à Flare AI...");
    }
  }, [imageGen, videoGen, docGen, sheetGen]);

  const handleSend = () => {
    let text = value.trim();
    if ((!text && !attachment) || isLoading || disabled) return;
    
    // Command prefixes logic
    if (imageGen && !text.toLowerCase().includes("/image")) {
      text = `/image ${text}`;
    } else if (videoGen && !text.toLowerCase().includes("/video")) {
      text = `/video ${text}`;
    } else if (docGen && !text.toLowerCase().includes("/doc")) {
      text = `/doc ${text}`;
    } else if (sheetGen && !text.toLowerCase().includes("/sheet")) {
      text = `/sheet ${text}`;
    }

    onSend(text, attachment ?? undefined, deepResearch, mediaQuality, chatMode);
    setValue("");
    setAttachment(null);
    setImageGen(false);
    setVideoGen(false);
    setDocGen(false);
    setSheetGen(false);
    setMediaQuality("HD");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  };

  const handleSelectSlash = (prompt: PromptTemplate) => {
    setValue(prompt.content);
    setTimeout(() => textareaRef.current?.focus(), 0);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Navigation dans le menu slash
    if (showSlashMenu) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSlashIndex((i) => Math.min(i + 1, slashSuggestions.length - 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSlashIndex((i) => Math.max(i - 1, 0));
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        const selected = slashSuggestions[slashIndex];
        if (selected) handleSelectSlash(selected);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setValue("");
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const startRecording = useCallback(async () => {
    if (isRecording) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      audioChunksRef.current = [];
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : "audio/webm";
      const recorder = new MediaRecorder(stream, { mimeType });
      recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      recorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: mimeType.split(";")[0] });
        const reader = new FileReader();
        reader.onload = (ev) => {
          const dataUrl = ev.target?.result as string;
          setAttachment({ content: dataUrl.split(",")[1], type: blob.type, name: "message_vocal.webm", dataUrl });
        };
        reader.readAsDataURL(blob);
        stream.getTracks().forEach((t) => t.stop());
      };
      recorder.start(100);
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      timerRef.current = setInterval(() => setRecordingSeconds((s) => s + 1), 1000);
    } catch {
      setMicError("Accès au microphone refusé");
      setTimeout(() => setMicError(null), 3000);
    }
  }, [isRecording]);

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
    if (timerRef.current) clearInterval(timerRef.current);
    setIsRecording(false);
    setRecordingSeconds(0);
  }, []);

  const processFile = useCallback((file: File) => {
    // ── Limite de taille (v3.1.1) ───────────────────────────────────────────
    const MAX_SIZE = 15 * 1024 * 1024; // 15 Mo
    if (file.size > MAX_SIZE) {
      alert(`⚠️ Fichier trop lourd (${(file.size / (1024 * 1024)).toFixed(1)} Mo). \nLa limite est de 15 Mo pour garantir une analyse rapide.`);
      return;
    }
    setLoadingFile(true);
    const reader = new FileReader();

    const BINARY_TYPES = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
      "application/msword",
    ];
    const isBinaryByExt = /\.(xlsx|xls|pptx|docx|pdf)$/i.test(file.name);
    const isBinary = BINARY_TYPES.includes(file.type) || isBinaryByExt;

    // Corriger le MIME type si le navigateur ne le détecte pas (fréquent pour xlsx/pptx)
    const MIME_FALLBACKS: Record<string, string> = {
      ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ".xls": "application/vnd.ms-excel",
      ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ".pdf": "application/pdf",
    };
    const ext = file.name.toLowerCase().match(/\.[^.]+$/)?.[0] || "";
    const effectiveType = file.type || MIME_FALLBACKS[ext] || "application/octet-stream";

    if (file.type.startsWith("image/")) {
      reader.onload = (ev) => {
        const dataUrl = ev.target?.result as string;
        setAttachment({ content: dataUrl.split(",")[1], type: file.type, name: file.name, dataUrl });
        setLoadingFile(false);
      };
      reader.readAsDataURL(file);
    } else if (file.type.startsWith("video/")) {
      reader.onload = (ev) => {
        const dataUrl = ev.target?.result as string;
        setAttachment({ content: dataUrl.split(",")[1], type: file.type, name: file.name, dataUrl });
        setLoadingFile(false);
      };
      reader.readAsDataURL(file);
    } else if (file.type.startsWith("audio/")) {
      reader.onload = (ev) => {
        const dataUrl = ev.target?.result as string;
        setAttachment({ content: dataUrl.split(",")[1], type: file.type, name: file.name, dataUrl });
        setLoadingFile(false);
      };
      reader.readAsDataURL(file);
    } else if (isBinary) {
      reader.onload = (ev) => {
        const dataUrl = ev.target?.result as string;
        setAttachment({ content: dataUrl.split(",")[1], type: effectiveType, name: file.name });
        setLoadingFile(false);
      };
      reader.readAsDataURL(file);
    } else {
      reader.onload = (ev) => {
        setAttachment({ content: ev.target?.result as string, type: file.type || "text/plain", name: file.name });
        setLoadingFile(false);
      };
      reader.readAsText(file);
    }
  }, []);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const onDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const onDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const onDrop = useCallback((e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  }, [processFile]);

  return (
    <div id="tour-chat-input" className="relative w-full flex flex-col items-center group/input px-4 md:px-0 max-w-4xl mx-auto">
      <div 
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={`surface-floating flex flex-col w-full rounded-[32px] md:rounded-[40px] transition-all duration-500 ease-premium relative overflow-visible ${isDragging ? "border-[var(--border-subtle)] bg-[var(--bg-hover)] shadow-[0_18px_40px_rgba(0,0,0,0.28)]" : "focus-within:border-[var(--border-subtle)] focus-within:shadow-[0_18px_48px_rgba(0,0,0,0.3)] hover:border-[var(--border-subtle)]"}`}
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
          {/* Subtle inner focus glow */}
          <div className="absolute inset-0 rounded-[32px] md:rounded-[40px] bg-gradient-to-br from-white/[0.06] via-transparent to-transparent opacity-80 pointer-events-none" />
          <div className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none" />

        {/* ── Slash command menu ── */}
        {showSlashMenu && (
          <div className="absolute bottom-full left-0 right-0 mb-3 z-50 surface-floating rounded-2xl overflow-hidden py-1.5 shadow-xl">
            <div className="flex items-center gap-2 px-4 pt-1 pb-2 border-b border-white/[0.04]">
              <Zap size={10} className="text-white/20" />
              <span className="text-[10px] uppercase tracking-[0.12em] text-white/20">Prompts</span>
              <span className="ml-auto text-[9px] text-white/15">↑↓ naviguer · Entrée sélectionner · Échap fermer</span>
            </div>
            {slashSuggestions.map((p, i) => (
              <button
                key={p.id}
                onMouseDown={(e) => {
                  e.preventDefault(); // empêche le blur textarea
                  handleSelectSlash(p);
                }}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-all ${
                  i === slashIndex ? "bg-white/[0.06]" : "hover:bg-white/[0.03]"
                }`}
              >
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-white/[0.04] text-white/30">
                  <Sparkles size={11} />
                </div>
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="text-[12px] font-medium text-white/80 truncate">{p.title}</span>
                  <span className="text-[10px] text-white/25 truncate">{p.content.slice(0, 55)}…</span>
                </div>
                {i === slashIndex && (
                  <CornerDownLeft size={11} className="shrink-0 text-white/20" />
                )}
              </button>
            ))}
          </div>
        )}

        {attachment && (
          <div className="flex items-center gap-3 w-full px-8 pt-5 pb-2 relative z-10">
             <div className="surface-soft flex items-center gap-2 px-3.5 py-2 rounded-full flex-1 min-w-0">
                {attachment.type.startsWith("video/") ? (
                  <Video size={12} className="text-[var(--text-muted)]" />
                ) : (
                  <FileText size={12} className="text-[var(--text-muted)]" />
                )}
                <span className="text-[11px] text-[var(--text-primary)] font-medium truncate">{attachment.name}</span>
             </div>
             <button onClick={() => setAttachment(null)} className="ui-btn ui-btn-ghost !min-h-0 !p-2 hover:text-red-400 hover:bg-red-500/10"><X size={14}/></button>
          </div>
        )}

        <div className="flex flex-col p-3 md:p-4 gap-2 relative z-10">
          {/* Top: Input Area */}
          <div className="w-full px-4 md:px-6 flex items-end gap-3">
            <textarea
              ref={textareaRef}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              rows={1}
              disabled={isLoading || disabled || isRecording}
              className="flex-1 bg-transparent text-[16px] md:text-[17px] font-light px-0 py-4 md:py-4 resize-none outline-none placeholder-[var(--text-muted)]/50 max-h-[180px] leading-relaxed text-left transition-all"
            />
            {/* Bouton Envoyer dedié Mobile */}
            <button
              onClick={handleSend}
              disabled={(!value.trim() && !attachment) || isLoading}
              className={`ui-btn md:hidden !min-h-0 !rounded-[20px] !p-3 shrink-0 mb-2.5 ${
                (!value.trim() && !attachment) || isLoading
                  ? "ui-btn-secondary text-[var(--text-muted)]/30 border-white/5 opacity-50"
                  : "ui-btn-primary"
              }`}
            >
              <Send size={18} strokeWidth={2.5} />
            </button>
          </div>

          {/* Bottom: Toolbar Actions */}
          <div className="flex items-center justify-between px-1 md:px-3 pb-2 md:pb-1">
            <div className="flex items-center gap-1.5 md:gap-2 shrink-0 flex-wrap">
              <button
                id="tour-attach-file"
                onClick={() => fileInputRef.current?.click()}
                className="ui-btn ui-btn-ghost !min-h-0 !p-2.5 shrink-0"
                title="Ajouter un fichier"
              >
                {loadingFile ? <Loader2 size={18} className="animate-spin" /> : <Plus size={20} />}
              </button>
              
              <div className="shrink-0">
                <button
                  id="tour-tools"
                  onClick={() => setShowToolsDropdown(!showToolsDropdown)}
                  className={`ui-btn !min-h-0 flex items-center gap-1.5 md:gap-2 !p-2 md:!px-4 md:!py-2 ${deepResearch || docGen || sheetGen ? 'ui-btn-secondary text-[var(--text-primary)] border-[#1B2A4A]/20' : 'ui-btn-ghost'}`}
                >
                  <Briefcase size={14} className={`${deepResearch || docGen || sheetGen ? 'text-[#1B2A4A]' : ''}`} />
                  <span className="text-[11px] md:text-[12px] font-medium hidden md:inline">Outils</span>
                  <ChevronDown size={12} className={`transition-transform ${showToolsDropdown ? "rotate-180" : ""}`} />
                </button>
                
                {/* Dropdown Menu Outils */}
                {showToolsDropdown && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowToolsDropdown(false)} />
                    <div className="surface-floating absolute bottom-[56px] md:bottom-[60px] left-6 md:left-[4rem] mb-2 w-52 rounded-3xl z-50 overflow-hidden flex flex-col py-2">
                      
                      <button
                        onClick={() => {
                          setDeepResearch(!deepResearch);
                          setDocGen(false);
                          setSheetGen(false);
                          setShowToolsDropdown(false);
                        }}
                        className={`flex items-center gap-3 px-4 py-2.5 w-full text-left transition-all ${deepResearch ? 'bg-[var(--bg-active)]' : 'hover:bg-[var(--bg-hover)]'}`}
                      >
                        <Sparkles size={14} className={deepResearch ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]'} />
                        <div className="flex flex-col">
                          <span className="text-[12px] font-medium text-[var(--text-primary)]">Deep Research</span>
                          <span className="text-[10px] text-[var(--text-muted)]">Recherche web approfondie</span>
                        </div>
                      </button>

                      <button
                        onClick={() => {
                          setDocGen(!docGen);
                          setDeepResearch(false);
                          setSheetGen(false);
                          setShowToolsDropdown(false);
                        }}
                        className={`flex items-center gap-3 px-4 py-2.5 w-full text-left transition-all ${docGen ? 'bg-[#1B2A4A]/10' : 'hover:bg-[var(--bg-hover)]'}`}
                      >
                        <FileText size={14} className={docGen ? 'text-[#1B2A4A]' : 'text-[var(--text-muted)]'} />
                        <div className="flex flex-col">
                          <span className="text-[12px] font-medium text-[var(--text-primary)]">Créer un Document</span>
                          <span className="text-[10px] text-[var(--text-muted)]">Génère un fichier Word</span>
                        </div>
                      </button>

                      <button
                        onClick={() => {
                          setSheetGen(!sheetGen);
                          setDeepResearch(false);
                          setDocGen(false);
                          setShowToolsDropdown(false);
                        }}
                        className={`flex items-center gap-3 px-4 py-2.5 w-full text-left transition-all ${sheetGen ? 'bg-[#1B2A4A]/10' : 'hover:bg-[var(--bg-hover)]'}`}
                      >
                        <FileSpreadsheet size={14} className={sheetGen ? 'text-[#1B2A4A]' : 'text-[var(--text-muted)]'} />
                        <div className="flex flex-col">
                          <span className="text-[12px] font-medium text-[var(--text-primary)]">Tableur Intelligent</span>
                          <span className="text-[10px] text-[var(--text-muted)]">Génère un fichier Excel</span>
                        </div>
                      </button>

                    </div>
                  </>
                )}
              </div>

              <div className="flex items-center gap-0.5 md:gap-1 shrink-0 ml-0.5 md:ml-1">
                <button
                  onClick={() => {
                    setImageGen(prev => {
                      const next = !prev;
                      if (next) setVideoGen(false);
                      return next;
                    });
                  }}
                  className={`ui-btn !min-h-0 !p-2 ${imageGen ? 'ui-btn-secondary text-[var(--text-primary)] border-[#1B2A4A]/20' : 'ui-btn-ghost'}`}
                  title="Générer une Image"
                >
                  <ImageIcon size={16} className="md:w-[18px] md:h-[18px]" />
                </button>
                <button
                  onClick={() => {
                    setVideoGen(prev => {
                      const next = !prev;
                      if (next) setImageGen(false);
                      return next;
                    });
                  }}
                  className={`ui-btn !min-h-0 !p-2 ${videoGen ? 'ui-btn-secondary text-[var(--text-primary)] border-[#1B2A4A]/20' : 'ui-btn-ghost'}`}
                  title="Générer une Vidéo"
                >
                  <Video size={16} className="md:w-[18px] md:h-[18px]" />
                </button>

                {(imageGen || videoGen) && (
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      const qualities: ("HD" | "2K")[] = ["HD", "2K"];
                      const next = qualities[(qualities.indexOf(mediaQuality) + 1) % qualities.length];
                      setMediaQuality(next);
                    }}
                    className="ui-btn ui-btn-secondary !min-h-0 flex items-center gap-1 !px-2.5 md:!px-3 !py-1.5 text-[9px] md:text-[10px] font-black tracking-tighter ml-0.5 md:ml-1 animate-fade-in"
                    title="Changer la résolution (HD, 2K)"
                  >
                    <Zap size={10} className="text-[var(--text-muted)]" />
                    <span className="text-[var(--text-primary)] font-bold uppercase">
                      {mediaQuality}
                    </span>
                  </button>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1 md:gap-2">
              <div
                id="tour-deep-research"
                className="ui-segment flex items-center p-1 rounded-full mr-0.5 md:mr-1 gap-1"
              >
                 <button
                  onClick={() => setChatMode('raisonnement')}
                  className={`ui-segment-item flex items-center gap-1 md:gap-1.5 p-1.5 md:px-3.5 md:py-2 text-[11px] md:text-[12px] font-medium ${
                    chatMode === 'raisonnement'
                      ? 'bg-black/5 dark:bg-white/10 text-[var(--text-primary)] shadow-sm border border-[var(--border-subtle)]'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] border border-transparent'
                  }`}
                  title="Raisonnement"
                 >
                   <Brain size={13} />
                   <span className="hidden md:inline">Raisonnement</span>
                 </button>
                 <button
                  onClick={() => setChatMode('rapide')}
                  className={`ui-segment-item flex items-center gap-1 md:gap-1.5 p-1.5 md:px-3.5 md:py-2 text-[11px] md:text-[12px] font-medium ${
                    chatMode === 'rapide'
                      ? 'bg-black/5 dark:bg-white/10 text-[var(--text-primary)] shadow-sm border border-[var(--border-subtle)]'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] border border-transparent'
                  }`}
                  title="Rapide"
                 >
                   <Zap size={13} />
                   <span className="hidden md:inline">Rapide</span>
                 </button>
              </div>

              {/* Bouton STOP visible pendant la génération */}
              {isLoading && onStop && (
                <button
                  onClick={onStop}
                  className="ui-btn !min-h-0 flex items-center gap-2 !px-4 !py-2 bg-red-500/10 border border-red-500/30 text-red-500 hover:bg-red-500/20 animate-fade-in shadow-sm"
                  title="Arrêter la génération"
                >
                  <StopCircle size={16} />
                  <span className="text-[11px] font-bold uppercase tracking-wider hidden md:block">Stop</span>
                </button>
              )}
              
              {/* Envoyer — avant le micro sur mobile */}
              {(value.trim() || attachment) && !isLoading && (
                <button
                  id="tour-send"
                  onClick={handleSend}
                  className="ui-btn ui-btn-primary !min-h-0 !p-2.5 ml-1 flex items-center justify-center group/send order-first md:order-last"
                  title="Envoyer"
                >
                  <Send size={18} strokeWidth={2.5} className="group-hover/send:translate-x-0.5 group-hover/send:-translate-y-0.5 transition-transform" />
                </button>
              )}

              <button
                id="tour-voice"
                onClick={isRecording ? stopRecording : startRecording}
                className={`ui-btn !min-h-0 !p-2.5 ${isRecording ? "text-red-500 bg-red-500/15 shadow-inner border border-red-500/20" : "ui-btn-ghost"}`}
                title="Message vocal"
              >
                <Mic size={20} strokeWidth={2} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {micError && (
        <div className="absolute -top-10 left-1/2 -translate-x-1/2 px-4 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-[11px] font-medium animate-fade-in whitespace-nowrap">
          {micError}
        </div>
      )}

      <div className="mt-3 mb-4 md:mb-4">
        <p className="text-[11px] md:text-[12px] text-[var(--text-muted)] font-light tracking-wide px-4 text-center opacity-60">
          FLARE est une IA et peut se tromper.
        </p>
      </div>

      <input ref={fileInputRef} type="file" accept={ACCEPTED_TYPES} onChange={handleFileChange} className="hidden" />
    </div>
  );
}
