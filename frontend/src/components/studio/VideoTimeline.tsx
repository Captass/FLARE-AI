"use client";

import React, { useMemo, useRef, useState } from "react";
import { Film, Music, Type, Scissors, ZoomIn, ZoomOut, MousePointer2, Wand2 } from "lucide-react";

interface Clip {
  id: string;
  name: string;
  duration: number;
  color: string;
}

interface VideoTimelineProps {
  currentTime: number;
  duration: number;
  onSeek: (time: number) => void;
  clips?: Clip[];
  showSubtitles?: boolean;
}

function formatTime(time: number) {
  const safe = Math.max(0, time || 0);
  const mins = Math.floor(safe / 60);
  const secs = Math.floor(safe % 60);
  const cs = Math.floor((safe % 1) * 100);
  return `${mins}:${secs.toString().padStart(2, "0")}:${cs.toString().padStart(2, "0")}`;
}

export default function VideoTimeline({
  currentTime,
  duration,
  onSeek,
  clips = [],
  showSubtitles = false,
}: VideoTimelineProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [zoom, setZoom] = useState(1.5);

  const effectiveDuration = duration > 0 ? duration : Math.max(30, clips.reduce((sum, clip) => sum + (clip.duration || 0), 0));
  const progressPercentage = effectiveDuration > 0 ? (currentTime / effectiveDuration) * 100 : 0;

  const markers = useMemo(() => {
    const list = [];
    const maxMarkers = 120;
    const rawStep = effectiveDuration / 12;
    const step = rawStep > 0 ? Math.max(2, rawStep) : 5;
    const count = Math.min(maxMarkers, Math.max(10, Math.floor(effectiveDuration / step)));

    for (let i = 0; i <= count; i += 1) {
      const time = (effectiveDuration / count) * i;
      list.push(
        <div
          key={i}
          className="pointer-events-none absolute bottom-0 top-0 border-l border-zinc-800/80"
          style={{ left: `${(i / count) * 100}%` }}
        >
          <span className="mt-1 block pl-1 text-[9px] font-mono text-zinc-500 select-none">
            {formatTime(time).slice(0, 4)}
          </span>
        </div>,
      );
    }

    return list;
  }, [effectiveDuration]);

  const renderedClips = useMemo(() => {
    const total = clips.reduce((sum, clip) => sum + Math.max(clip.duration || 0, 0), 0) || effectiveDuration;
    let cursor = 0;

    return clips.map((clip, index) => {
      const clipDuration = Math.max(clip.duration || 0, 0);
      const start = total > 0 ? (cursor / total) * 100 : 0;
      const width = total > 0 ? (clipDuration / total) * 100 : 100;
      cursor += clipDuration;

      const shades = [
        "from-blue-500/40 to-cyan-500/30 border-blue-400/50",
        "from-fuchsia-500/35 to-purple-500/25 border-fuchsia-400/40",
        "from-emerald-500/35 to-teal-500/25 border-emerald-400/40",
        "from-amber-500/35 to-orange-500/25 border-amber-400/40",
      ];
      const palette = shades[index % shades.length];

      return (
        <div
          key={clip.id}
          className={`absolute bottom-1 top-1 overflow-hidden rounded-md border bg-gradient-to-r ${palette}`}
          style={{ left: `${start}%`, width: `calc(${Math.max(width, 8)}% - 6px)` }}
        >
          <div className="absolute inset-0 opacity-20 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.22),transparent)]" />
          <div className="relative flex h-full items-center justify-between px-3">
            <span className="truncate text-[10px] font-semibold text-white">{clip.name}</span>
            <span className="ml-2 shrink-0 text-[9px] font-mono text-white/70">{formatTime(clip.duration).slice(0, 5)}</span>
          </div>
        </div>
      );
    });
  }, [clips, effectiveDuration]);

  const subtitleBlocks = useMemo(() => {
    if (!showSubtitles || effectiveDuration <= 0) return null;
    const blocks = [
      { left: 6, width: 18, text: '"Hook principal"' },
      { left: 29, width: 26, text: '"Message central plus net"' },
      { left: 60, width: 21, text: '"Call to action"' },
    ];

    return blocks.map((block, index) => (
      <div
        key={`${block.left}-${index}`}
        className="absolute bottom-2 top-2 overflow-hidden rounded border border-orange-400/45 bg-orange-500/28"
        style={{ left: `${block.left}%`, width: `${block.width}%` }}
      >
        <div className="flex h-full items-center justify-center px-2 text-[8px] font-medium text-orange-100">
          <span className="truncate">{block.text}</span>
        </div>
      </div>
    ));
  }, [showSubtitles, effectiveDuration]);

  const updateProgress = (clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const scrollLeft = containerRef.current.scrollLeft;
    const x = Math.max(0, Math.min(clientX - rect.left + scrollLeft, rect.width * zoom));
    const percentage = rect.width > 0 ? x / (rect.width * zoom) : 0;
    onSeek(percentage * effectiveDuration);
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    setIsDragging(true);
    updateProgress(e.clientX);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (isDragging) updateProgress(e.clientX);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isDragging) return;
    setIsDragging(false);
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  return (
    <div className="flex h-full w-full flex-col border-t border-zinc-800/60 bg-[#101114]">
      <div className="flex h-11 shrink-0 items-center justify-between border-b border-zinc-800/50 bg-[#141519] px-4">
        <div className="flex items-center gap-2">
          <button className="rounded bg-zinc-800 px-1.5 py-1.5 text-zinc-200 transition-colors hover:bg-zinc-700" title="Selection">
            <MousePointer2 size={14} />
          </button>
          <button className="rounded px-1.5 py-1.5 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-200" title="Cut">
            <Scissors size={14} />
          </button>
          <button className="rounded px-1.5 py-1.5 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-200" title="AI Assist">
            <Wand2 size={14} />
          </button>
        </div>

        <div className="rounded-md border border-zinc-800 bg-black/30 px-3 py-1 text-[11px] font-mono text-zinc-400">
          <span className="text-white">{formatTime(currentTime)}</span>
          <span className="mx-2 text-zinc-600">/</span>
          <span>{formatTime(effectiveDuration)}</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setZoom((z) => Math.max(1, z - 0.5))}
            className="rounded px-1.5 py-1.5 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
          >
            <ZoomOut size={14} />
          </button>
          <div className="h-1.5 w-24 overflow-hidden rounded-full bg-zinc-800">
            <div className="h-full rounded-full bg-zinc-400" style={{ width: `${(zoom / 6) * 100}%` }} />
          </div>
          <button
            onClick={() => setZoom((z) => Math.min(6, z + 0.5))}
            className="rounded px-1.5 py-1.5 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
          >
            <ZoomIn size={14} />
          </button>
        </div>
      </div>

      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        <div className="z-20 flex w-24 shrink-0 flex-col border-r border-zinc-800 bg-[#15161a]">
          <div className="h-7 border-b border-zinc-800/50" />
          <div className="flex h-20 items-center gap-2 border-b border-zinc-800/40 px-2">
            <div className="flex h-6 w-6 items-center justify-center rounded bg-blue-500/10 text-blue-400">
              <Film size={12} />
            </div>
            <span className="text-[10px] font-bold text-zinc-400">V1</span>
          </div>
          <div className="flex h-12 items-center gap-2 border-b border-zinc-800/40 px-2">
            <div className="flex h-6 w-6 items-center justify-center rounded bg-orange-500/10 text-orange-400">
              <Type size={12} />
            </div>
            <span className="text-[10px] font-bold text-zinc-400">T1</span>
          </div>
          <div className="flex h-16 items-center gap-2 border-b border-zinc-800/40 px-2">
            <div className="flex h-6 w-6 items-center justify-center rounded bg-emerald-500/10 text-emerald-400">
              <Music size={12} />
            </div>
            <span className="text-[10px] font-bold text-zinc-400">A1</span>
          </div>
        </div>

        <div
          ref={containerRef}
          className="custom-scrollbar relative flex-1 overflow-x-auto overflow-y-hidden"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        >
          <div className="absolute left-0 top-0" style={{ width: `${zoom * 100}%`, height: "100%" }}>
            <div className="sticky top-0 z-10 h-7 border-b border-zinc-800/50 bg-[#111217]">{markers}</div>

            <div className="relative h-20 border-b border-zinc-800/30 bg-[linear-gradient(180deg,rgba(255,255,255,0.015),transparent)]">
              {renderedClips.length > 0 ? renderedClips : <div className="h-full opacity-10 bg-[linear-gradient(90deg,transparent_0,rgba(255,255,255,0.08)_50%,transparent_100%)]" />}
            </div>

            <div className="relative h-12 border-b border-zinc-800/30 bg-[#121318]">
              {subtitleBlocks}
            </div>

            <div className="relative h-16 border-b border-zinc-800/30 bg-[#101114]">
              {clips.length > 0 && (
                <div className="absolute inset-x-2 bottom-2 top-2 overflow-hidden rounded-md border border-emerald-400/30 bg-emerald-500/12">
                  <div className="h-full w-full opacity-45 bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.28),transparent_62%)]" />
                </div>
              )}
            </div>

            <div
              className="pointer-events-none absolute bottom-0 top-0 z-30 w-px bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.85)]"
              style={{ left: `${progressPercentage}%` }}
            >
              <div className="pointer-events-auto absolute top-0 h-4 w-3 -translate-x-1/2 rounded-b-sm bg-red-500" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
