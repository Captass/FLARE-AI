"use client";

import FlareMark from "./FlareMark";

export function SkeletonLine({ className = "" }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-lg bg-white/5 ${className}`} />
  );
}

export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-5 space-y-3">
      <SkeletonLine className="h-4 w-2/3" />
      {Array.from({ length: lines - 1 }).map((_, i) => (
        <SkeletonLine key={i} className="h-3 w-full" />
      ))}
    </div>
  );
}

export function SkeletonChat() {
  return (
    <div className="flex-1 p-6 space-y-6 overflow-hidden">
      {[0.6, 0.8, 0.4, 0.7, 0.5].map((w, i) => (
        <div key={i} className={`flex ${i % 2 === 0 ? "justify-start" : "justify-end"}`}>
          <div className={`rounded-2xl bg-white/[0.03] p-4 space-y-2 ${i % 2 === 0 ? "max-w-[70%]" : "max-w-[50%]"}`}>
            <SkeletonLine className="h-3" style-w={w} />
            <SkeletonLine className="h-3 w-4/5" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function SkeletonPanel() {
  return (
    <div className="flex-1 p-6 space-y-4 overflow-hidden">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-[16px] border border-white/8 bg-white/[0.03]">
          <FlareMark tone="dark" className="w-5" />
        </div>
        <div className="space-y-2">
          <SkeletonLine className="h-4 w-28" />
          <SkeletonLine className="h-3 w-20" />
        </div>
      </div>
      <SkeletonCard lines={3} />
      <SkeletonCard lines={2} />
      <SkeletonCard lines={4} />
    </div>
  );
}

export default SkeletonPanel;
