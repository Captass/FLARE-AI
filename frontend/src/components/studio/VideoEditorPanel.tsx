"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Play,
  Pause,
  Upload,
  Loader2,
  Wand2,
  Plus,
  Type,
  Scissors,
  Monitor,
  FileVideo,
  Trash2,
  ListVideo,
  SkipBack,
  SkipForward,
  Volume2,
  Sparkles,
  Clapperboard,
  Layers3,
  BadgeCheck,
  ArrowRight,
  CheckCircle2,
  SlidersHorizontal,
  Flame,
  Shapes,
  Stars,
  Download,
  AlertCircle,
  Palette,
  Music,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import VideoTimeline from "./VideoTimeline";
import { getContentStudioVideoJobStatus, submitContentStudioVideoEdit } from "@/lib/api";

interface Rush {
  id: string;
  url: string;
  dataUrl: string;
  name: string;
  duration: number;
  size: number;
  type: string;
}

interface VideoEditorPanelProps {
  token?: string | null;
}

type EditMode = "social" | "cinematic" | "promo" | "motion" | "vfx" | "podcast";
type RatioPreset = "9:16" | "16:9" | "1:1" | "4:5";
type MusicPreset = "none" | "cinematic" | "upbeat" | "lofi" | "corporate";
type OutputQuality = "preview" | "standard" | "high" | "master";
type ExportFormat = "mp4" | "mov";

const MAX_FILE_SIZE = 100 * 1024 * 1024;

const MODE_PRESETS: Array<{
  id: EditMode;
  label: string;
  subtitle: string;
  icon: LucideIcon;
  palette: string;
}> = [
  { id: "social", label: "Social Cut", subtitle: "Cuts rapides, hook, retention", icon: Flame, palette: "from-orange-500/25 to-red-500/10" },
  { id: "cinematic", label: "Cinematic", subtitle: "Montage noble et respiration", icon: Clapperboard, palette: "from-indigo-500/20 to-blue-500/10" },
  { id: "promo", label: "Promo", subtitle: "Reveal produit, offre, CTA", icon: Sparkles, palette: "from-emerald-500/20 to-cyan-500/10" },
  { id: "motion", label: "Motion Design", subtitle: "Typo animee et design graphique", icon: Shapes, palette: "from-fuchsia-500/20 to-purple-500/10" },
  { id: "vfx", label: "VFX Polish", subtitle: "Impact, punch et finitions", icon: Stars, palette: "from-amber-500/20 to-orange-500/10" },
  { id: "podcast", label: "Talking Head", subtitle: "Face cam, podcast, formation", icon: Type, palette: "from-zinc-500/20 to-zinc-400/10" },
];

function formatTime(time: number) {
  const safe = Math.max(0, time || 0);
  const mins = Math.floor(safe / 60);
  const secs = Math.floor(safe % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Lecture du media impossible."));
    reader.readAsDataURL(file);
  });
}

export default function VideoEditorPanel({ token: _token }: VideoEditorPanelProps) {
  const [rushes, setRushes] = useState<Rush[]>([]);
  const [activeRushId, setActiveRushId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [editMode, setEditMode] = useState<EditMode>("social");
  const [prompt, setPrompt] = useState("");
  const [storyGoal, setStoryGoal] = useState("Faire une version plus dynamique et plus premium.");
  const [targetAudience, setTargetAudience] = useState("");
  const [ratio, setRatio] = useState<RatioPreset>("9:16");
  const [musicPreset, setMusicPreset] = useState<MusicPreset>("cinematic");
  const [outputQuality, setOutputQuality] = useState<OutputQuality>("high");
  const [exportFormat, setExportFormat] = useState<ExportFormat>("mp4");
  const [fps, setFps] = useState<24 | 30 | 60>(30);
  const [loading, setLoading] = useState(false);
  const [renderProgress, setRenderProgress] = useState(0);
  const [jobStatus, setJobStatus] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [renderedVideoUrl, setRenderedVideoUrl] = useState<string | null>(null);
  const [enableSubtitles, setEnableSubtitles] = useState(true);
  const [autoCut, setAutoCut] = useState(true);
  const [enableTransitions, setEnableTransitions] = useState(true);
  const [enablePunchZooms, setEnablePunchZooms] = useState(true);
  const [enableMotionGraphics, setEnableMotionGraphics] = useState(false);
  const [enableVfxPolish, setEnableVfxPolish] = useState(false);
  const [enableColorGrade, setEnableColorGrade] = useState(true);
  const [generateBroll, setGenerateBroll] = useState(false);
  const [ctaText, setCtaText] = useState("");

  const videoRef = useRef<HTMLVideoElement>(null);
  const activeRush = rushes.find((rush) => rush.id === activeRushId) || null;
  const activePreset = MODE_PRESETS.find((preset) => preset.id === editMode) || MODE_PRESETS[0];

  useEffect(() => {
    setEnableMotionGraphics(editMode === "motion");
    setEnableVfxPolish(editMode === "vfx");
  }, [editMode]);

  useEffect(() => {
    return () => {
      rushes.forEach((rush) => URL.revokeObjectURL(rush.url));
    };
  }, [rushes]);

  const timelineClips = useMemo(
    () =>
      rushes.map((rush, index) => ({
        id: rush.id,
        name: rush.name,
        duration: rush.duration || Math.max(6, duration / Math.max(rushes.length, 1) || 6),
        color: ["blue", "fuchsia", "emerald", "amber"][index % 4],
      })),
    [rushes, duration],
  );

  const technicalSummary = useMemo(() => {
    return [
      `${ratio} framing`,
      autoCut ? "auto silence cut" : null,
      enableSubtitles ? "animated captions" : null,
      enableTransitions ? "clean transitions" : null,
      enablePunchZooms ? "punch zooms" : null,
      enableMotionGraphics ? "motion graphics" : null,
      enableVfxPolish ? "VFX polish" : null,
      enableColorGrade ? "color grade" : null,
      generateBroll ? "AI b-roll ideas" : null,
      musicPreset !== "none" ? `${musicPreset} music bed` : null,
      `${outputQuality} export`,
      `${fps} fps`,
      exportFormat.toUpperCase(),
      ctaText.trim() ? `CTA: ${ctaText.trim()}` : null,
    ]
      .filter(Boolean)
      .join(", ");
  }, [
    ratio,
    autoCut,
    enableSubtitles,
    enableTransitions,
    enablePunchZooms,
    enableMotionGraphics,
    enableVfxPolish,
    enableColorGrade,
    generateBroll,
    musicPreset,
    outputQuality,
    fps,
    exportFormat,
    ctaText,
  ]);

  const directorBrief = useMemo(() => {
    return [
      `Mode edit: ${activePreset.label}.`,
      storyGoal.trim() ? `Objectif: ${storyGoal.trim()}.` : "",
      targetAudience.trim() ? `Audience cible: ${targetAudience.trim()}.` : "",
      prompt.trim() ? `Instructions creatrices: ${prompt.trim()}.` : "",
      `Execution attendue: ${technicalSummary}.`,
      "Le rendu doit paraitre monte par un senior video editor avec rythme, transitions propres, clarte narrative et finition professionnelle.",
    ]
      .filter(Boolean)
      .join(" ");
  }, [activePreset.label, storyGoal, targetAudience, prompt, technicalSummary]);

  const handleLoadedMetadata = () => {
    if (videoRef.current) setDuration(videoRef.current.duration || 0);
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) setCurrentTime(videoRef.current.currentTime || 0);
  };

  const processIncomingFiles = async (files: File[]) => {
    const validFiles = files.filter((file) => {
      if (!file.type.startsWith("video/")) return false;
      if (file.size > MAX_FILE_SIZE) {
        setError(`Le fichier ${file.name} depasse la limite de 100 MB.`);
        return false;
      }
      return true;
    });

    if (!validFiles.length) return;

    const prepared = await Promise.all(
      validFiles.map(async (file) => ({
        id: Math.random().toString(36).slice(2, 11),
        url: URL.createObjectURL(file),
        dataUrl: await fileToDataUrl(file),
        name: file.name,
        duration: 0,
        size: file.size,
        type: file.type,
      })),
    );

    setRushes((prev) => [...prev, ...prepared]);
    setActiveRushId((prev) => prev || prepared[0]?.id || null);
    setError(null);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    await processIncomingFiles(Array.from(e.target.files));
    e.target.value = "";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (!e.dataTransfer.files?.length) return;
    await processIncomingFiles(Array.from(e.dataTransfer.files));
  };

  const removeRush = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const rushToRemove = rushes.find((rush) => rush.id === id);
    if (rushToRemove) URL.revokeObjectURL(rushToRemove.url);
    const next = rushes.filter((rush) => rush.id !== id);
    setRushes(next);
    setActiveRushId((prev) => (prev === id ? next[0]?.id || null : prev));
  };

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play().catch(() => undefined);
      setIsPlaying(true);
    }
  };

  const pollJob = async (jobId: string) => {
    const started = Date.now();

    while (Date.now() - started < 10 * 60 * 1000) {
      const status = await getContentStudioVideoJobStatus(jobId);
      if (status.status === "processing") {
        const elapsed = Date.now() - started;
        setRenderProgress(Math.min(92, 12 + Math.round(elapsed / 2200)));
        setJobStatus("Montage, transitions et rendu en cours...");
      } else if (status.status === "completed") {
        setRenderProgress(100);
        setJobStatus("Version finalisee.");
        if (!status.result?.video_url) {
          throw new Error("Le rendu est termine mais aucune video n'a ete retournee.");
        }
        setRenderedVideoUrl(status.result.video_url);
        return;
      } else if (status.status === "failed") {
        throw new Error(status.error || "Le rendu video a echoue.");
      }

      await new Promise((resolve) => setTimeout(resolve, 2500));
    }

    throw new Error("Le rendu a pris trop de temps. Reessayez avec un brief plus simple.");
  };

  const applyEdits = async () => {
    if (!rushes.length) {
      setError("Importez au moins un rush video.");
      return;
    }

    setLoading(true);
    setRenderProgress(8);
    setJobStatus("Preparation du montage...");
    setError(null);
    setRenderedVideoUrl(null);

    try {
      const response = await submitContentStudioVideoEdit({
        project_id: "flare-video-studio",
        source_videos: rushes.map((rush) => rush.dataUrl),
        instructions: directorBrief,
        target_resolution: ratio === "9:16" ? "1080x1920" : ratio === "1:1" ? "1080x1080" : ratio === "4:5" ? "1080x1350" : "1920x1080",
        export_quality: outputQuality,
        fps,
        output_format: exportFormat,
      });

      setJobStatus("Plan de montage genere, rendu en file...");
      await pollJob(response.job_id);
    } catch (err: any) {
      setError(err?.message || "Le montage video n'a pas pu etre genere.");
      setJobStatus("");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-[#090a0d] text-zinc-200">
      <div className="flex min-h-0 flex-1">
        <aside className="z-10 flex w-80 shrink-0 flex-col border-r border-white/8 bg-[#111216] shadow-[8px_0_28px_rgba(0,0,0,0.18)]">
          <div className="border-b border-white/8 px-5 py-5">
            <div className="inline-flex items-center gap-2 rounded-full border border-sky-500/20 bg-sky-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.24em] text-sky-300">
              <Clapperboard size={12} />
              Agent video editor
            </div>
            <h2 className="mt-4 text-2xl font-semibold leading-tight text-white">
              Montez vos rushs
              <br />
              avec l&apos;agent
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-zinc-400">
              Ajoutez vos videos, decrivez le rendu voulu, puis choisissez la qualite d&apos;export.
            </p>
          </div>

          <div className="flex h-12 items-center gap-2 border-b border-white/8 px-4">
            <ListVideo size={16} className="text-zinc-500" />
            <h3 className="text-xs font-semibold uppercase tracking-widest text-zinc-200">Bibliotheque rushes</h3>
          </div>

          <div className="custom-scrollbar relative flex-1 overflow-y-auto p-4">
            {rushes.length === 0 ? (
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`absolute inset-4 flex flex-col items-center justify-center rounded-[28px] border-2 border-dashed text-center transition-all ${
                  isDragging ? "border-sky-400 bg-sky-500/8" : "border-white/10 bg-white/[0.02]"
                }`}
              >
                <Upload size={24} className={`${isDragging ? "text-sky-300" : "text-zinc-600"} mb-3`} />
                <p className="px-6 text-sm font-medium text-zinc-300">Glisse tes rushes ici</p>
                <p className="mt-2 px-6 text-xs leading-5 text-zinc-500">MP4, MOV, WebM. 100 MB max par fichier.</p>
              </div>
            ) : (
              <div className="space-y-3">
                <AnimatePresence>
                  {rushes.map((rush) => (
                    <motion.button
                      key={rush.id}
                      initial={{ opacity: 0, scale: 0.96 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.96 }}
                      onClick={() => setActiveRushId(rush.id)}
                      className={`group flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition-all ${
                        activeRushId === rush.id
                          ? "border-sky-400/45 bg-sky-500/10"
                          : "border-white/8 bg-white/[0.03] hover:border-white/14 hover:bg-white/[0.04]"
                      }`}
                    >
                      <div className="flex h-12 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-black/40 text-zinc-500">
                        <FileVideo size={18} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-white">{rush.name}</p>
                        <p className="mt-1 text-[11px] text-zinc-500">{(rush.size / (1024 * 1024)).toFixed(1)} MB</p>
                      </div>
                      <button
                        onClick={(e) => removeRush(e, rush.id)}
                        className="rounded-lg p-1.5 text-zinc-500 opacity-0 transition-all hover:bg-white/5 hover:text-red-300 group-hover:opacity-100"
                      >
                        <Trash2 size={12} />
                      </button>
                    </motion.button>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>

          <div className="border-t border-white/8 bg-[#0f1013] p-4">
            <label className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 py-3 text-xs font-bold text-white transition-colors hover:bg-sky-500">
              <Plus size={14} />
              Importer des medias
              <input type="file" multiple accept="video/*" className="hidden" onChange={handleUpload} />
            </label>
          </div>
        </aside>

        <main className="min-w-0 flex-1 bg-black flex flex-col relative">
          <div className="flex items-center justify-between border-b border-white/8 bg-black/30 px-5 py-3 backdrop-blur-xl">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-zinc-500">Preview live</div>
              <div className="mt-1 text-sm font-medium text-white">
                {renderedVideoUrl ? "Version rendue" : activeRush ? activeRush.name : "Aucun media charge"}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {["Hook", "Captions", "Transitions"].map((item) => (
                <span key={item} className="hidden rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[10px] font-medium text-zinc-300 xl:inline-flex">
                  {item}
                </span>
              ))}
            </div>
          </div>

          <div className="relative flex-1 overflow-hidden">
            {loading && (
              <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/80 backdrop-blur-md">
                <div className="relative h-24 w-24">
                  <div className="absolute inset-0 rounded-full border-4 border-sky-500/15 border-t-sky-400 animate-spin" />
                  <div className="absolute inset-0 flex items-center justify-center text-sm font-bold text-sky-300">{renderProgress}%</div>
                </div>
                <p className="mt-6 text-lg font-semibold text-white">L&apos;agent monte votre sequence</p>
                <p className="mt-2 max-w-lg text-center text-sm leading-6 text-zinc-400">{jobStatus || "Analyse du brief, coupes et rendu en cours."}</p>
                <div className="mt-5 h-1.5 w-72 overflow-hidden rounded-full bg-zinc-800">
                  <motion.div className="h-full bg-sky-500" initial={{ width: 0 }} animate={{ width: `${renderProgress}%` }} />
                </div>
              </div>
            )}

            {renderedVideoUrl || activeRush ? (
              <video
                ref={videoRef}
                src={renderedVideoUrl || activeRush?.url}
                className="h-full w-full object-contain"
                controls={false}
                onLoadedMetadata={handleLoadedMetadata}
                onTimeUpdate={handleTimeUpdate}
                onEnded={() => setIsPlaying(false)}
                onClick={togglePlay}
              />
            ) : (
              <div className="flex h-full flex-col items-center justify-center px-8 text-center">
                <div className="flex h-24 w-24 items-center justify-center rounded-[28px] border border-white/10 bg-white/[0.03] text-zinc-600">
                  <Monitor size={38} />
                </div>
                <h3 className="mt-6 text-xl font-semibold text-white">Montage pret a lancer</h3>
                <p className="mt-3 max-w-xl text-sm leading-7 text-zinc-500">
                  Importez vos rushs, expliquez le rendu voulu, puis laissez l&apos;agent preparer le montage.
                </p>
              </div>
            )}
          </div>

          <div className="z-10 flex h-14 shrink-0 items-center justify-between border-t border-white/8 bg-[#141519] px-6 shadow-[0_-6px_26px_rgba(0,0,0,0.35)]">
            <div className="w-1/3 text-xs font-mono text-zinc-400">
              <span>{formatTime(currentTime)}</span>
              <span className="mx-2 text-zinc-600">/</span>
              <span>{formatTime(duration)}</span>
            </div>
            <div className="flex items-center gap-4">
              <button className="p-2 text-zinc-400 transition-colors hover:text-white"><SkipBack size={18} fill="currentColor" /></button>
              <button
                onClick={togglePlay}
                disabled={!activeRush && !renderedVideoUrl}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-black transition-transform hover:scale-105 disabled:opacity-50"
              >
                {isPlaying ? <Pause size={20} className="fill-current" /> : <Play size={20} className="ml-0.5 fill-current" />}
              </button>
              <button className="p-2 text-zinc-400 transition-colors hover:text-white"><SkipForward size={18} fill="currentColor" /></button>
            </div>
            <div className="flex w-1/3 justify-end gap-2">
              {renderedVideoUrl && (
                <a
                  href={renderedVideoUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-white/[0.08]"
                >
                  <Download size={14} />
                  Ouvrir
                </a>
              )}
              <button className="p-2 text-zinc-400 transition-colors hover:text-white"><Volume2 size={18} /></button>
            </div>
          </div>
        </main>

        <aside className="z-10 flex w-[380px] shrink-0 flex-col border-l border-white/8 bg-[#111216] shadow-[-8px_0_28px_rgba(0,0,0,0.18)]">
          <div className="border-b border-white/8 px-5 py-5">
            <div className="flex items-center gap-3">
              <div className={`flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br ${activePreset.palette} border border-white/10 text-white`}>
                <activePreset.icon size={20} />
              </div>
              <div>
                <div className="text-sm font-semibold text-white">{activePreset.label}</div>
                <div className="mt-1 text-xs text-zinc-500">{activePreset.subtitle}</div>
              </div>
            </div>
          </div>

          <div className="custom-scrollbar flex-1 overflow-y-auto p-5 space-y-6">
            <section>
              <div className="mb-3 text-[10px] font-bold uppercase tracking-[0.22em] text-zinc-500">Mode montage</div>
              <div className="grid grid-cols-2 gap-2">
                {MODE_PRESETS.map((preset) => {
                  const Icon = preset.icon;
                  const active = preset.id === editMode;
                  return (
                    <button
                      key={preset.id}
                      onClick={() => setEditMode(preset.id)}
                      className={`rounded-2xl border px-3 py-3 text-left transition-all ${
                        active ? "border-sky-400/30 bg-sky-500/10" : "border-white/8 bg-white/[0.03] hover:border-white/14 hover:bg-white/[0.05]"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${active ? "bg-sky-500/16 text-sky-300" : "bg-white/5 text-zinc-500"}`}>
                          <Icon size={16} />
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-white">{preset.label}</div>
                          <div className="mt-1 text-[11px] leading-5 text-zinc-500">{preset.subtitle}</div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="rounded-[28px] border border-white/8 bg-white/[0.03] p-4">
              <div className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.22em] text-zinc-500">
                <SlidersHorizontal size={12} />
                Resultat voulu
              </div>
              <div className="space-y-3">
                <div>
                  <label className="mb-2 block text-[11px] font-semibold text-zinc-400">Resultat final</label>
                  <textarea
                    value={storyGoal}
                    onChange={(e) => setStoryGoal(e.target.value)}
                    className="custom-scrollbar min-h-[84px] w-full rounded-2xl border border-white/8 bg-[#171920] px-4 py-3 text-sm text-white outline-none focus:border-sky-400/30 resize-none"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-[11px] font-semibold text-zinc-400">Pour qui</label>
                  <input
                    value={targetAudience}
                    onChange={(e) => setTargetAudience(e.target.value)}
                    className="w-full rounded-2xl border border-white/8 bg-[#171920] px-4 py-3 text-sm text-white outline-none focus:border-sky-400/30"
                    placeholder="Ex: audience TikTok, clients premium"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-[11px] font-semibold text-zinc-400">Details importants</label>
                  <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    className="custom-scrollbar min-h-[120px] w-full rounded-2xl border border-white/8 bg-[#171920] px-4 py-3 text-sm text-white outline-none focus:border-sky-400/30 resize-none"
                    placeholder="Ex: Ouvre avec le moment le plus fort, coupe les temps morts, ajoute des sous-titres plus forts et une fin memorable."
                  />
                </div>
              </div>
            </section>

            <section className="rounded-[28px] border border-white/8 bg-white/[0.03] p-4">
              <div className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.22em] text-zinc-500">
                <BadgeCheck size={12} />
                Stack d execution
              </div>
              <div className="space-y-3">
                {[
                  { label: "Auto silence cut", value: autoCut, setter: setAutoCut, icon: Scissors },
                  { label: "Animated captions", value: enableSubtitles, setter: setEnableSubtitles, icon: Type },
                  { label: "Transitions propres", value: enableTransitions, setter: setEnableTransitions, icon: ArrowRight },
                  { label: "Punch zooms", value: enablePunchZooms, setter: setEnablePunchZooms, icon: Sparkles },
                  { label: "Motion graphics", value: enableMotionGraphics, setter: setEnableMotionGraphics, icon: Layers3 },
                  { label: "VFX polish", value: enableVfxPolish, setter: setEnableVfxPolish, icon: Stars },
                  { label: "Color grade", value: enableColorGrade, setter: setEnableColorGrade, icon: Palette },
                  { label: "AI b-roll ideas", value: generateBroll, setter: setGenerateBroll, icon: FileVideo },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between rounded-2xl border border-white/8 bg-[#15171d] px-3 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/6 text-zinc-200">
                        <item.icon size={14} />
                      </div>
                      <span className="text-sm text-zinc-300">{item.label}</span>
                    </div>
                    <button
                      onClick={() => item.setter(!item.value)}
                      className={`relative h-5 w-10 rounded-full transition-colors ${item.value ? "bg-sky-500" : "bg-zinc-700"}`}
                    >
                      <span className="absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all" style={{ left: item.value ? "22px" : "2px" }} />
                    </button>
                  </div>
                ))}
              </div>
            </section>

            <section className="grid gap-4 md:grid-cols-2">
              <div className="rounded-[24px] border border-white/8 bg-white/[0.03] p-4">
                <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.22em] text-zinc-500">Cadre</div>
                <select value={ratio} onChange={(e) => setRatio(e.target.value as RatioPreset)} className="w-full rounded-2xl border border-white/8 bg-[#171920] px-4 py-3 text-sm text-white outline-none focus:border-sky-400/30">
                  <option value="9:16">9:16 Vertical</option>
                  <option value="16:9">16:9 Landscape</option>
                  <option value="1:1">1:1 Square</option>
                  <option value="4:5">4:5 Feed</option>
                </select>
              </div>
              <div className="rounded-[24px] border border-white/8 bg-white/[0.03] p-4">
                <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.22em] text-zinc-500">Music bed</div>
                <select value={musicPreset} onChange={(e) => setMusicPreset(e.target.value as MusicPreset)} className="w-full rounded-2xl border border-white/8 bg-[#171920] px-4 py-3 text-sm text-white outline-none focus:border-sky-400/30">
                  <option value="none">Aucune</option>
                  <option value="cinematic">Cinematic</option>
                  <option value="upbeat">Upbeat</option>
                  <option value="lofi">Lo-fi</option>
                  <option value="corporate">Corporate</option>
                </select>
              </div>
            </section>

            <section className="grid gap-4 md:grid-cols-3">
              <div className="rounded-[24px] border border-white/8 bg-white/[0.03] p-4">
                <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.22em] text-zinc-500">Qualite</div>
                <select value={outputQuality} onChange={(e) => setOutputQuality(e.target.value as OutputQuality)} className="w-full rounded-2xl border border-white/8 bg-[#171920] px-4 py-3 text-sm text-white outline-none focus:border-sky-400/30">
                  <option value="preview">Preview</option>
                  <option value="standard">Standard</option>
                  <option value="high">High</option>
                  <option value="master">Master</option>
                </select>
              </div>
              <div className="rounded-[24px] border border-white/8 bg-white/[0.03] p-4">
                <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.22em] text-zinc-500">FPS</div>
                <select value={fps} onChange={(e) => setFps(Number(e.target.value) as 24 | 30 | 60)} className="w-full rounded-2xl border border-white/8 bg-[#171920] px-4 py-3 text-sm text-white outline-none focus:border-sky-400/30">
                  <option value={24}>24 fps</option>
                  <option value={30}>30 fps</option>
                  <option value={60}>60 fps</option>
                </select>
              </div>
              <div className="rounded-[24px] border border-white/8 bg-white/[0.03] p-4">
                <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.22em] text-zinc-500">Format export</div>
                <select value={exportFormat} onChange={(e) => setExportFormat(e.target.value as ExportFormat)} className="w-full rounded-2xl border border-white/8 bg-[#171920] px-4 py-3 text-sm text-white outline-none focus:border-sky-400/30">
                  <option value="mp4">MP4</option>
                  <option value="mov">MOV</option>
                </select>
              </div>
            </section>

            <section className="rounded-[28px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.01))] p-4">
              <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.22em] text-zinc-500">Call to action / fin</div>
              <input
                value={ctaText}
                onChange={(e) => setCtaText(e.target.value)}
                className="w-full rounded-2xl border border-white/8 bg-[#171920] px-4 py-3 text-sm text-white outline-none focus:border-sky-400/30"
                placeholder="Ex: Commente AI pour recevoir le guide"
              />
              <div className="mt-4 rounded-2xl border border-white/8 bg-black/20 p-3">
                <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-zinc-500">Brief final envoye a l&apos;agent</div>
                <p className="mt-2 text-sm leading-6 text-zinc-300">{directorBrief}</p>
              </div>
            </section>

            <section className="rounded-[28px] border border-white/8 bg-white/[0.03] p-4">
              <div className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.22em] text-zinc-500">
                <Music size={12} />
                Ce que l&apos;agent vise
              </div>
              <div className="space-y-3">
                {[
                  "Debut plus fort des les premieres secondes",
                  "Transitions propres, jamais gratuites",
                  "Sous-titres plus lisibles",
                  "Fin de video plus memorable",
                ].map((item) => (
                  <div key={item} className="flex items-start gap-3">
                    <CheckCircle2 size={16} className="mt-0.5 text-emerald-400 shrink-0" />
                    <span className="text-sm text-zinc-300">{item}</span>
                  </div>
                ))}
              </div>
            </section>

            <AnimatePresence>
              {error && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="rounded-[24px] border border-red-500/20 bg-red-500/10 p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle size={18} className="mt-0.5 text-red-300 shrink-0" />
                    <p className="text-sm leading-6 text-red-100">{error}</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="border-t border-white/8 bg-[#0f1013] p-4">
            <button onClick={applyEdits} disabled={loading || !rushes.length} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-4 py-4 text-sm font-bold text-black transition-opacity hover:opacity-92 disabled:opacity-50">
              {loading ? <Loader2 size={18} className="animate-spin" /> : <Wand2 size={18} />}
              Generer le montage
            </button>
          </div>
        </aside>
      </div>

      <div className="h-[38%] min-h-[260px] shrink-0 shadow-[0_-10px_30px_rgba(0,0,0,0.45)]">
        <VideoTimeline
          currentTime={currentTime}
          duration={duration || timelineClips.reduce((sum, clip) => sum + clip.duration, 0)}
          onSeek={(time) => {
            if (videoRef.current) {
              videoRef.current.currentTime = time;
              setCurrentTime(time);
            }
          }}
          clips={timelineClips}
          showSubtitles={enableSubtitles}
        />
      </div>
    </div>
  );
}
