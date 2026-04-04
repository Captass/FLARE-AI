"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import type { MessengerDashboardData } from "@/lib/messengerDirect";

interface ChatbotRealtimeChartProps {
  data: MessengerDashboardData | null;
  loading?: boolean;
}

interface ActivityPoint {
  label: string;
  messages: number;
  needsHuman: number;
}

const CHART_WIDTH = 860;
const CHART_HEIGHT = 240;
const CHART_PADDING_X = 24;
const CHART_PADDING_Y = 26;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function toInt(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.round(value));
}

function buildActivitySeries(data: MessengerDashboardData | null): ActivityPoint[] {
  const period = data?.periodStats ?? [];
  if (period.length > 0) {
    return period.slice(-10).map((item, index) => ({
      label: item.label?.trim() || `P${index + 1}`,
      messages: toInt(item.messages),
      needsHuman: toInt(item.needsHuman),
    }));
  }

  const totalMessages = toInt(data?.totals?.messages24h ?? 0);
  const totalNeedsHuman = toInt(data?.totals?.needsAttentionContacts ?? 0);
  const fallbackLabels = ["-20m", "-15m", "-10m", "-5m", "Now"];

  return fallbackLabels.map((label) => ({
    label,
    messages: totalMessages,
    needsHuman: totalNeedsHuman,
  }));
}

function getMetricMax(points: ActivityPoint[]): number {
  const localMax = points.reduce((max, point) => Math.max(max, point.messages, point.needsHuman), 0);
  return Math.max(4, localMax);
}

function createPath(
  points: ActivityPoint[],
  metric: "messages" | "needsHuman",
  maxValue: number
): { line: string; area: string; coordinates: Array<{ x: number; y: number }> } {
  const drawableWidth = CHART_WIDTH - CHART_PADDING_X * 2;
  const drawableHeight = CHART_HEIGHT - CHART_PADDING_Y * 2;
  const step = points.length > 1 ? drawableWidth / (points.length - 1) : 0;

  const coordinates = points.map((point, index) => {
    const x = CHART_PADDING_X + step * index;
    const yValue = (point[metric] / maxValue) * drawableHeight;
    const y = CHART_HEIGHT - CHART_PADDING_Y - yValue;
    return { x, y: clamp(y, CHART_PADDING_Y, CHART_HEIGHT - CHART_PADDING_Y) };
  });

  if (coordinates.length === 0) {
    return { line: "", area: "", coordinates };
  }

  const line = coordinates
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(" ");

  const area = [
    line,
    `L ${coordinates[coordinates.length - 1].x.toFixed(2)} ${(CHART_HEIGHT - CHART_PADDING_Y).toFixed(2)}`,
    `L ${coordinates[0].x.toFixed(2)} ${(CHART_HEIGHT - CHART_PADDING_Y).toFixed(2)}`,
    "Z",
  ].join(" ");

  return { line, area, coordinates };
}

function formatAxisValue(value: number): string {
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}k`;
  }
  return String(value);
}

export default function ChatbotRealtimeChart({ data, loading = false }: ChatbotRealtimeChartProps) {
  const series = useMemo(() => buildActivitySeries(data), [data]);
  const maxMetric = useMemo(() => getMetricMax(series), [series]);

  const messagesPath = useMemo(() => createPath(series, "messages", maxMetric), [series, maxMetric]);
  const needsHumanPath = useMemo(() => createPath(series, "needsHuman", maxMetric), [series, maxMetric]);

  const latestPoint = messagesPath.coordinates[messagesPath.coordinates.length - 1];
  const yGrid = [1, 0.66, 0.33, 0].map((step) => CHART_PADDING_Y + (CHART_HEIGHT - CHART_PADDING_Y * 2) * step);
  const latestMessages = series.length > 0 ? series[series.length - 1].messages : 0;
  const latestNeedsHuman = series.length > 0 ? series[series.length - 1].needsHuman : 0;

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
      className="overflow-hidden rounded-2xl border border-fg/[0.08] bg-fg/[0.02] p-5 shadow-[var(--shadow-card)]"
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-[var(--text-muted)]">Activite en temps reel</p>
          <p className="mt-1 text-lg font-semibold text-fg/90">Messages et reprises humaines</p>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="rounded-full border border-cyan-400/30 bg-cyan-500/10 px-2.5 py-1 text-cyan-300">
            Messages: {latestMessages}
          </span>
          <span className="rounded-full border border-orange-400/30 bg-orange-500/10 px-2.5 py-1 text-orange-300">
            A reprendre: {latestNeedsHuman}
          </span>
        </div>
      </div>

      {loading ? (
        <div className="h-[240px] animate-pulse rounded-xl border border-fg/[0.06] bg-fg/[0.03]" />
      ) : (
        <div className="relative overflow-hidden rounded-xl border border-fg/[0.06] bg-[linear-gradient(180deg,rgba(255,255,255,0.02)_0%,rgba(255,255,255,0)_100%)]">
          <svg
            viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
            className="h-[240px] w-full"
            role="img"
            aria-label="Evolution en temps reel des messages et des reprises humaines"
          >
            <defs>
              <linearGradient id="messagesGlow" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="rgba(34,211,238,0.32)" />
                <stop offset="100%" stopColor="rgba(34,211,238,0.02)" />
              </linearGradient>
            </defs>

            {yGrid.map((y) => (
              <line
                key={`grid-${y}`}
                x1={CHART_PADDING_X}
                y1={y}
                x2={CHART_WIDTH - CHART_PADDING_X}
                y2={y}
                stroke="rgba(255,255,255,0.08)"
                strokeWidth="1"
                strokeDasharray="3 8"
              />
            ))}

            <motion.path
              d={messagesPath.area}
              fill="url(#messagesGlow)"
              initial={{ opacity: 0.3 }}
              animate={{ opacity: 0.7 }}
              transition={{ duration: 0.45, ease: "easeOut" }}
            />

            <motion.path
              d={messagesPath.line}
              fill="none"
              stroke="rgb(34,211,238)"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.55, ease: "easeOut" }}
            />

            <motion.path
              d={needsHumanPath.line}
              fill="none"
              stroke="rgb(251,146,60)"
              strokeWidth="2.3"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.55, delay: 0.08, ease: "easeOut" }}
            />

            {messagesPath.coordinates.map((point, index) => (
              <motion.circle
                key={`message-point-${series[index]?.label ?? index}`}
                cx={point.x}
                cy={point.y}
                r="3.2"
                fill="rgb(34,211,238)"
                initial={{ scale: 0.7, opacity: 0.5 }}
                animate={{ scale: 1, opacity: 0.95 }}
                transition={{ delay: index * 0.03, duration: 0.25 }}
              />
            ))}

            {needsHumanPath.coordinates.map((point, index) => (
              <motion.circle
                key={`human-point-${series[index]?.label ?? index}`}
                cx={point.x}
                cy={point.y}
                r="2.6"
                fill="rgb(251,146,60)"
                initial={{ scale: 0.7, opacity: 0.5 }}
                animate={{ scale: 1, opacity: 0.9 }}
                transition={{ delay: index * 0.03 + 0.05, duration: 0.25 }}
              />
            ))}

            {latestPoint ? (
              <motion.circle
                cx={latestPoint.x}
                cy={latestPoint.y}
                r="7.5"
                fill="rgba(34,211,238,0.15)"
                stroke="rgba(34,211,238,0.45)"
                strokeWidth="1.5"
                animate={{ scale: [0.95, 1.15, 0.95], opacity: [0.5, 0.85, 0.5] }}
                transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
              />
            ) : null}
          </svg>

          <div className="pointer-events-none absolute inset-x-0 bottom-2 px-4">
            <div className="flex items-center justify-between gap-2 text-[11px] text-fg/40">
              {series.map((point) => (
                <span key={`x-label-${point.label}`} className="truncate">
                  {point.label}
                </span>
              ))}
            </div>
          </div>

          <div className="pointer-events-none absolute right-3 top-3 flex flex-col items-end gap-2 text-[11px] text-fg/35">
            <span>{formatAxisValue(maxMetric)}</span>
            <span>{formatAxisValue(Math.round(maxMetric / 2))}</span>
            <span>0</span>
          </div>
        </div>
      )}
    </motion.section>
  );
}
