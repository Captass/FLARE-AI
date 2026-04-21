"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
/* eslint-disable @next/next/no-img-element */
import { X, Download, FileText, FileSpreadsheet, ExternalLink, ImageIcon, Maximize2, Brush, Eraser, Check, Edit3, Save, Crop, MonitorPlay, Minimize2, Copy, Code, History, ChevronDown, ListTree, ListCollapse, BarChart3, PieChart as PieChartIcon, LineChart as LineChartIcon } from "lucide-react";
import { BASE_URL } from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";
import * as XLSX from 'xlsx';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

function parseCellRef(ref: string) {
  const match = ref.match(/([A-Z]+)(\d+)/);
  if (!match) return {r:0, c:0};
  const cStr = match[1];
  const rStr = match[2];
  let c = 0;
  for (let i = 0; i < cStr.length; i++) {
    c = c * 26 + (cStr.charCodeAt(i) - 64);
  }
  return { r: parseInt(rStr) - 1, c: c - 1 };
}

function parseRange(rangeStr: string, rows: any[][]) {
  const cleanRange = rangeStr.split('!').pop()?.replace(/\$/g, '') || '';
  const parts = cleanRange.split(':');
  if (parts.length === 1) {
    const p = parseCellRef(parts[0]);
    return [rows[p.r]?.[p.c]?.value || rows[p.r]?.[p.c]];
  }
  const start = parseCellRef(parts[0]);
  const end = parseCellRef(parts[1]);
  const vals = [];
  // Ensure we go top to bottom, left to right
  for (let r = start.r; r <= end.r; r++) {
    for (let c = start.c; c <= end.c; c++) {
      const cell = rows[r]?.[c];
      vals.push(cell && typeof cell === 'object' ? cell.value : cell);
    }
  }
  return vals;
}

function buildChartData(chart: any, rows: any[][]) {
  const cats = chart.category_range ? parseRange(chart.category_range, rows) : [];
  const vals = chart.data_range ? parseRange(chart.data_range, rows) : [];
  return cats.map((cat, i) => ({
    name: cat ? String(cat) : `Catégorie ${i+1}`,
    value: typeof vals[i] === 'number' ? vals[i] : parseFloat(vals[i] || '0') || 0
  }));
}

const COLORS = ['#f97316', '#3b82f6', '#10b981', '#ef4444', '#8b5cf6', '#06b6d4'];

async function dataUrlToArrayBuffer(dataUrl: string): Promise<ArrayBuffer> {
  const response = await fetch(dataUrl);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return response.arrayBuffer();
}

function extractDocumentSectionsFromHtml(html: string): string[] {
  if (typeof DOMParser === "undefined") return ["Document entier"];
  const doc = new DOMParser().parseFromString(html, "text/html");
  const sections = Array.from(doc.querySelectorAll("h1,h2,h3,h4,h5,h6"))
    .map((node) => node.textContent?.trim() || "")
    .filter(Boolean);
  return sections.length > 0 ? sections : ["Document entier"];
}

function workbookToRenderableSheet(workbook: XLSX.WorkBook) {
  const firstSheetName = workbook.SheetNames[0] || "Feuille 1";
  const firstSheet = workbook.Sheets[firstSheetName];
  const rows = firstSheet
    ? (XLSX.utils.sheet_to_json(firstSheet, { header: 1, raw: true, defval: "" }) as any[][])
    : [];

  return {
    name: firstSheetName,
    sheetNames: workbook.SheetNames,
    rows: rows.map((row) => Array.isArray(row) ? row.map((value) => ({ value })) : []),
    charts: [],
  };
}


export type ArtifactType = "image" | "video" | "document" | "sheet" | "code" | "unknown";

export interface Artifact {
  url: string;
  type: ArtifactType;
  name: string;
  data?: string;
  version?: string;
}

const CodeEditor = ({ content, language = "javascript" }: { content: string, language?: string }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="relative w-full h-full bg-[#1e1e1e] group flex flex-col">
      <div className="absolute top-4 right-4 z-10">
        <button
          onClick={handleCopy}
          className="px-3 py-1.5 bg-[#2d2d2d] hover:bg-[#3d3d3d] text-[#d4d4d4] text-[11px] rounded border border-[#3d3d3d] transition-colors opacity-0 group-hover:opacity-100 flex items-center gap-1.5"        
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
          {copied ? "Copié !" : "Copier le code"}
        </button>
      </div>
      <div className="w-full h-full overflow-hidden flex-1 relative">
        <SyntaxHighlighter
          language={language}
          style={vscDarkPlus}
          customStyle={{ margin: 0, height: '100%', paddingTop: '3rem', paddingLeft: '1rem', paddingRight: '1rem', fontSize: '13px', background: 'transparent' }}
          showLineNumbers
        >
          {content}
        </SyntaxHighlighter>
      </div>
    </div>
  );
};
interface ArtifactViewerProps {
  artifact: Artifact | null;
  versions?: Artifact[];
  onSelectVersion?: (artifact: Artifact) => void;
  onClose: () => void;
  onInpaint?: (maskBase64: string) => void;
  onOutpaint?: (ratio: string) => void;
  onEdit?: (content: string) => void;
  onRemoveBackground?: () => void;
  onChangeBackground?: (background: string) => void;
}

/** Retourne une URL proxifiée si c'est une URL GCS (pour CORS canvas), sinon l'URL d'origine. */
function toProxiedUrl(url: string): string {
  if (url.startsWith("data:") || url.startsWith("blob:")) return url; // base64 / blob : pas de proxy
  if (url.includes("storage.googleapis.com")) {
    return `${BASE_URL}/files/proxy?url=${encodeURIComponent(url)}`;
  }
  return url;
}

function resolveArtifactImageSource(artifact: Artifact | null): string {
  if (!artifact) return "";
  if (artifact.data?.startsWith("data:") || artifact.data?.startsWith("blob:")) return artifact.data;
  if (artifact.url?.startsWith("data:") || artifact.url?.startsWith("blob:")) return artifact.url;
  return artifact.url || artifact.data || "";
}

function ImageMaskEditor({
  url,
  name,
  onSaveMask,
  onOutpaint,
  onRemoveBackground,
  onChangeBackground,
}: {
  url: string,
  name: string,
  onSaveMask?: (maskBase64: string) => void,
  onOutpaint?: (ratio: string) => void,
  onRemoveBackground?: () => void,
  onChangeBackground?: (background: string) => void,
}) {
  const [isMasking, setIsMasking] = useState(false);
  // URL proxifiée pour le canvas (inpainting) — fallback sur URL directe si proxy 502
  const proxiedUrl = toProxiedUrl(url);
  const [imgSrc, setImgSrc] = useState(proxiedUrl);
  const [outpaintMenuOpen, setOutpaintMenuOpen] = useState(false);
  const [brushSize, setBrushSize] = useState(30);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [ctx, setCtx] = useState<CanvasRenderingContext2D | null>(null);
  const [imgRenderSize, setImgRenderSize] = useState({ width: 0, height: 0, top: 0, left: 0 });
  const [showBackgroundPrompt, setShowBackgroundPrompt] = useState(false);
  const [backgroundPrompt, setBackgroundPrompt] = useState("");

  useEffect(() => {
    setImgSrc(toProxiedUrl(url));
  }, [url]);

  const updateCanvasSize = useCallback(() => {
    if (imgRef.current) {
      const img = imgRef.current;
      const rect = img.getBoundingClientRect();
      const intrinsicRatio = img.naturalWidth / img.naturalHeight;
      const elementRatio = rect.width / rect.height;
      
      let renderWidth = rect.width;
      let renderHeight = rect.height;
      let offsetX = 0;
      let offsetY = 0;

      if (intrinsicRatio > elementRatio) {
        // Image is wider than element (letterbox top/bottom)
        renderHeight = rect.width / intrinsicRatio;
        offsetY = (rect.height - renderHeight) / 2;
      } else if (intrinsicRatio < elementRatio) {
        // Image is taller than element (pillarbox left/right)
        renderWidth = rect.height * intrinsicRatio;
        offsetX = (rect.width - renderWidth) / 2;
      }

      setImgRenderSize({ width: renderWidth, height: renderHeight, left: offsetX, top: offsetY });
    }
  }, []);

  useEffect(() => {
    if (isMasking) {
      updateCanvasSize();
      window.addEventListener('resize', updateCanvasSize);
    }
    return () => window.removeEventListener('resize', updateCanvasSize);
  }, [isMasking, updateCanvasSize]);

  // Initialize canvas context when masking is enabled
  useEffect(() => {
    if (isMasking && canvasRef.current && imgRef.current) {
      const canvas = canvasRef.current;
      const img = imgRef.current;
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const context = canvas.getContext('2d');
      if (context) {
        context.lineCap = 'round';
        context.lineJoin = 'round';
        setCtx(context);
      }
    }
  }, [isMasking]);

  useEffect(() => {
    if (ctx) {
      ctx.lineWidth = brushSize;
    }
  }, [brushSize, ctx]);

  const getCoordinates = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    
    // Calculate actual rendered size of canvas due to object-contain
    const canvasRatio = canvas.width / canvas.height;
    const boxRatio = rect.width / rect.height;
    
    let renderWidth = rect.width;
    let renderHeight = rect.height;
    let offsetX = 0;
    let offsetY = 0;
    
    if (canvasRatio > boxRatio) {
      renderHeight = rect.width / canvasRatio;
      offsetY = (rect.height - renderHeight) / 2;
    } else {
      renderWidth = rect.height * canvasRatio;
      offsetX = (rect.width - renderWidth) / 2;
    }
    
    const scaleX = canvas.width / renderWidth;
    const scaleY = canvas.height / renderHeight;
    
    let clientX, clientY;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    
    return {
      x: (clientX - rect.left - offsetX) * scaleX,
      y: (clientY - rect.top - offsetY) * scaleY
    };
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!ctx) return;
    setIsDrawing(true);
    const { x, y } = getCoordinates(e);
    
    ctx.beginPath();
    ctx.moveTo(x, y);
    // Draw dot for single click
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.arc(x, y, brushSize / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !ctx) return;
    e.preventDefault(); // Prevent scrolling on touch
    const { x, y } = getCoordinates(e);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    if (ctx) ctx.closePath();
  };

  const clearCanvas = () => {
    if (ctx && canvasRef.current) {
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
  };

  const generateMaskAndSave = () => {
    if (!canvasRef.current || !onSaveMask) return;
    // We want the mask to be white on black background for standard inpainting.
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = canvasRef.current.width;
    exportCanvas.height = canvasRef.current.height;
    const eCtx = exportCanvas.getContext('2d');
    if (eCtx) {
      eCtx.fillStyle = 'black';
      eCtx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
      eCtx.drawImage(canvasRef.current, 0, 0); // The strokes are white/transparent, they will overlay as white on black.
    }
    const dataUrl = exportCanvas.toDataURL('image/png');
    onSaveMask(dataUrl);
    setIsMasking(false);
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-[var(--bg-glass-dark)] p-4 relative overflow-hidden w-full h-full">
      {isMasking && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 px-4 py-2 bg-[var(--bg-modal)] backdrop-blur-md border border-[var(--border-glass)] rounded-full shadow-lg">
          <Brush size={16} className="text-[var(--text-muted)]" />
          <input 
            type="range" 
            min="5" 
            max="100" 
            value={brushSize} 
            onChange={(e) => setBrushSize(parseInt(e.target.value))}
            className="w-24 accent-orange-500"
          />
          <div className="w-px h-4 bg-[var(--border-glass)] mx-1" />
          <button onClick={clearCanvas} className="p-1.5 text-[var(--text-muted)] hover:text-red-400 transition-colors" title="Effacer">
            <Eraser size={16} />
          </button>
          <button onClick={generateMaskAndSave} className="flex items-center gap-1.5 ml-2 px-3 py-1.5 bg-[var(--text-primary)] text-[var(--background)] text-[12px] font-bold rounded-lg hover:opacity-90 transition-all">
            <Check size={14} /> Valider
          </button>
          <button onClick={() => setIsMasking(false)} className="p-1.5 ml-1 text-[var(--text-muted)] hover:text-white transition-colors" title="Annuler">
            <X size={16} />
          </button>
        </div>
      )}
      
      {!isMasking && (onSaveMask || onOutpaint || onRemoveBackground || onChangeBackground) && (
        <div className="absolute top-4 right-4 z-10 flex items-center gap-2 bg-[var(--bg-modal)] backdrop-blur-md border border-[var(--border-glass)] rounded-xl shadow-md p-1">
          {onRemoveBackground && (
            <button
              onClick={onRemoveBackground}
              className="flex items-center gap-2 px-3 py-1.5 text-[var(--text-primary)] text-sm rounded-lg hover:bg-[var(--bg-hover)] transition-all"
            >
              <Eraser size={16} /> Supprimer le fond
            </button>
          )}
          {onChangeBackground && (
            <div className="relative">
              <button
                onClick={() => setShowBackgroundPrompt((value) => !value)}
                className="flex items-center gap-2 px-3 py-1.5 text-[var(--text-primary)] text-sm rounded-lg hover:bg-[var(--bg-hover)] transition-all"
              >
                <ImageIcon size={16} /> Changer le fond
              </button>
              <AnimatePresence>
                {showBackgroundPrompt && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="absolute top-full right-0 mt-2 w-[min(86vw,320px)] p-3 bg-[var(--bg-modal)] border border-[var(--border-glass)] rounded-xl shadow-xl z-50"
                  >
                    <p className="text-[11px] font-medium text-[var(--text-primary)] mb-2">Nouveau fond</p>
                    <textarea
                      value={backgroundPrompt}
                      onChange={(e) => setBackgroundPrompt(e.target.value)}
                      placeholder="Ex: restaurant premium japonais, lumière chaude, style réaliste"
                      className="w-full min-h-[88px] px-3 py-2 rounded-lg bg-[var(--bg-card)] border border-[var(--border-glass)] text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] resize-none outline-none focus:border-orange-500/40"
                    />
                    <div className="mt-3 flex items-center justify-end gap-2">
                      <button
                        onClick={() => {
                          setShowBackgroundPrompt(false);
                          setBackgroundPrompt("");
                        }}
                        className="px-3 py-1.5 text-[12px] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                      >
                        Annuler
                      </button>
                      <button
                        onClick={() => {
                          const value = backgroundPrompt.trim();
                          if (!value) return;
                          onChangeBackground(value);
                          setShowBackgroundPrompt(false);
                          setBackgroundPrompt("");
                        }}
                        className="px-3 py-1.5 rounded-lg bg-[var(--text-primary)] text-[var(--background)] text-[12px] font-semibold hover:opacity-90 transition-opacity"
                      >
                        Appliquer
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
          {(onRemoveBackground || onChangeBackground) && (onSaveMask || onOutpaint) && <div className="w-px h-5 bg-[var(--border-glass)] mx-0.5" />}
          {onSaveMask && (
            <button 
              onClick={() => setIsMasking(true)}
              className="flex items-center gap-2 px-3 py-1.5 text-[var(--text-primary)] text-sm rounded-lg hover:bg-[var(--bg-hover)] transition-all"
            >
              <Brush size={16} /> Mode Inpainting
            </button>
          )}
          {onSaveMask && onOutpaint && <div className="w-px h-5 bg-[var(--border-glass)] mx-0.5" />}
          {onOutpaint && (
            <div className="relative">
              <button 
                onClick={() => setOutpaintMenuOpen(!outpaintMenuOpen)}
                className="flex items-center gap-2 px-3 py-1.5 text-[var(--text-primary)] text-sm rounded-lg hover:bg-[var(--bg-hover)] transition-all"
              >
                <Crop size={16} /> Étendre
              </button>
              
              <AnimatePresence>
                {outpaintMenuOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="absolute top-full right-0 mt-2 p-2 w-48 bg-[var(--bg-modal)] border border-[var(--border-glass)] rounded-xl shadow-xl flex flex-col gap-1 z-50"
                  >
                    <p className="text-[10px] font-medium text-[var(--text-muted)] uppercase tracking-wider px-2 py-1 mb-1">Format</p>
                    {["16:9 (Paysage)", "9:16 (Portrait)", "1:1 (Carré)", "21:9 (Cinéma)"].map((ratio) => (
                      <button
                        key={ratio}
                        onClick={() => {
                          onOutpaint(ratio);
                          setOutpaintMenuOpen(false);
                        }}
                        className="text-left px-3 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-hover)] rounded-lg transition-colors"
                      >
                        {ratio}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      )}

      <div className="relative flex max-w-full max-h-full aspect-auto items-center justify-center">
        <img
          ref={imgRef}
          src={imgSrc}
          alt={name}
          className="max-w-full max-h-full object-contain rounded-lg shadow-xl block select-none"
          draggable={false}
          crossOrigin="anonymous"
          onError={() => {
            // Si le proxy échoue, on retente avec l'URL directe
            if (imgSrc !== url) setImgSrc(url);
          }}
        />
        {isMasking && (
          <canvas
            ref={canvasRef}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
            onTouchCancel={stopDrawing}
            className="absolute top-0 left-0 w-full h-full cursor-crosshair touch-none rounded-lg object-contain"
            style={{ 
              backgroundColor: 'rgba(0,0,0,0.4)', // Dim background slightly to see mask better
            }}
          />
        )}
      </div>
    </div>
  );
}

export default function ArtifactViewer({ artifact, versions, onSelectVersion, onClose, onInpaint, onOutpaint, onEdit, onRemoveBackground, onChangeBackground }: ArtifactViewerProps) {
  const [localHtml, setLocalHtml] = useState<string>("");
  const [localSheet, setLocalSheet] = useState<any>(null);
  const [loadError, setLoadError] = useState<string>("");
  const [isEditingText, setIsEditingText] = useState(false);
  const [editedText, setEditedText] = useState("");
  const [isPresenting, setIsPresenting] = useState(false);
  const [codeContent, setCodeContent] = useState<string>("");
  const [codeLoading, setCodeLoading] = useState(false);
  const [fileStructure, setFileStructure] = useState<any>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // Sélection de texte (document Word)
  const [selectedText, setSelectedText] = useState<string>("");
  const [selectionTooltip, setSelectionTooltip] = useState<{ x: number; y: number } | null>(null);
  const [showSelectionComment, setShowSelectionComment] = useState(false);
  const [selectionComment, setSelectionComment] = useState("");
  const selectionCommentRef = useRef<HTMLTextAreaElement>(null);

  // Sélection de cellules (Excel)
  const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set());
  const [sheetComment, setSheetComment] = useState("");
  const [showSheetComment, setShowSheetComment] = useState(false);
  const artifactSelectionUrl = artifact?.url?.startsWith("data:") ? "" : artifact?.url;

  const handleDocMouseUp = () => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.toString().trim()) {
      return;
    }
    const text = sel.toString().trim();
    const range = sel.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    setSelectedText(text);
    setSelectionTooltip({ x: rect.left + rect.width / 2, y: rect.top - 8 });
    setShowSelectionComment(false);
    setSelectionComment("");
  };

  const sendSelectionComment = () => {
    if (!selectionComment.trim() || !onEdit) return;
    onEdit(JSON.stringify({
      prompt: `[SELECTION]${selectedText}[/SELECTION]\nInstruction : ${selectionComment.trim()}`,
      selection: { type: "document_refinement", file_url: artifactSelectionUrl, file_name: artifact?.name }
    }));
    setSelectionTooltip(null);
    setShowSelectionComment(false);
    setSelectedText("");
    setSelectionComment("");
    setIsEditingText(false);
  };

  const sendSheetComment = () => {
    if (!sheetComment.trim() || !onEdit || selectedCells.size === 0) return;
    const cellsLabel = Array.from(selectedCells).join(", ");
    onEdit(JSON.stringify({
      prompt: `[SELECTION]Cellules : ${cellsLabel}[/SELECTION]\nInstruction : ${sheetComment.trim()}`,
      selection: { type: "document_refinement", file_url: artifactSelectionUrl, file_name: artifact?.name }
    }));
    setSelectedCells(new Set());
    setSheetComment("");
    setShowSheetComment(false);
    setIsEditingText(false);
  };

  const toggleCellSelection = (rowIdx: number, colIdx: number) => {
    const key = `R${rowIdx}C${colIdx}`;
    setSelectedCells(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  useEffect(() => {
    if (!isEditingText || !artifact?.url || (artifact.type !== "document" && artifact.type !== "sheet")) {
      return;
    }

    if (artifact.url.startsWith("data:")) {
      fetch(`${BASE_URL}/files/structure-inline`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data_url: artifact.url, name: artifact.name }),
      })
        .then(res => res.json())
        .then(data => {
          let parsedZones: string[] = [];
          if (Array.isArray(data)) {
            parsedZones = data.map(item => typeof item === 'string' ? item : (item.name || item.title || JSON.stringify(item)));
          } else if (data && typeof data === 'object') {
            const key = Object.keys(data).find(k => Array.isArray((data as any)[k]));
            if (key) {
              parsedZones = (data as any)[key].map((item: any) => typeof item === 'string' ? item : (item.name || item.title || item.label || JSON.stringify(item)));
            } else if (data.sections && Array.isArray(data.sections)) {
              parsedZones = data.sections.map((item: any) => typeof item === "string" ? item : (item.label || item.name || item.title || JSON.stringify(item)));
            } else if (data.sheets && Array.isArray(data.sheets)) {
              parsedZones = data.sheets;
            }
          }
          if (parsedZones.length > 0) setFileStructure(parsedZones);
          else if (artifact.type === "document") setFileStructure(extractDocumentSectionsFromHtml(localHtml));
          else setFileStructure(Array.isArray(localSheet?.sheetNames) ? localSheet.sheetNames : [localSheet?.name || "Feuille 1"]);
        })
        .catch(() => {
          if (artifact.type === "document") {
            setFileStructure(extractDocumentSectionsFromHtml(localHtml));
          } else {
            setFileStructure(Array.isArray(localSheet?.sheetNames) ? localSheet.sheetNames : [localSheet?.name || "Feuille 1"]);
          }
        });
      return;
    }

    if (artifact?.url && (artifact.type === "document" || artifact.type === "sheet")) {
      fetch(`${BASE_URL}/files/structure?url=${encodeURIComponent(artifact.url)}`)
        .then(res => res.json())
        .then(data => {
            let parsedZones: string[] = [];
            if (Array.isArray(data)) {
              parsedZones = data.map(item => typeof item === 'string' ? item : (item.name || item.title || JSON.stringify(item)));
            } else if (data && typeof data === 'object') {
              const key = Object.keys(data).find(k => Array.isArray(data[k]));
              if (key) {
                 parsedZones = data[key].map((item: any) => typeof item === 'string' ? item : (item.name || item.title || JSON.stringify(item)));   
              } else if (data.sections && Array.isArray(data.sections)) {    
                 parsedZones = data.sections;
              } else if (data.sheets && Array.isArray(data.sheets)) {        
                 parsedZones = data.sheets;
              } else {
                 parsedZones = ["Document entier"];
              }
            }
            if (parsedZones.length > 0) setFileStructure(parsedZones);
        })
        .catch(err => console.error("Erreur structure:", err));
    }
  }, [isEditingText, artifact, localHtml, localSheet]);

  useEffect(() => {
    if (!artifact?.url || (artifact.type !== "document" && artifact.type !== "sheet")) {
      return;
    }

    let cancelled = false;

    const loadArtifact = async () => {
      setLocalHtml("");
      setLocalSheet(null);
      setLoadError("");

      try {
        if (artifact.type === "document") {
          if (artifact.url.startsWith("data:")) {
            try {
              const res = await fetch(`${BASE_URL}/files/render-doc-inline`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ data_url: artifact.url, name: artifact.name }),
              });
              if (!res.ok) throw new Error(`HTTP ${res.status}`);
              const data = await res.json();
              if (cancelled) return;
              if (data.html && data.html.trim()) {
                setLocalHtml(data.html);
              } else {
                setLoadError("Le document semble vide ou illisible.");
              }
            } catch {
              const mammoth = await import("mammoth");
              const arrayBuffer = await dataUrlToArrayBuffer(artifact.url);
              const result = await mammoth.convertToHtml({ arrayBuffer });
              if (!cancelled) {
                const html = result?.value?.trim();
                if (html) setLocalHtml(html);
                else setLoadError("Le document semble vide ou illisible.");
              }
            }
          } else {
            const renderUrl = `${BASE_URL}/files/render-doc?url=${encodeURIComponent(artifact.url)}`;
            const res = await fetch(renderUrl);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            if (cancelled) return;
            if (data.html && data.html.trim()) {
              setLocalHtml(data.html);
            } else {
              setLoadError("Le document semble vide ou illisible.");
            }
          }
        } else {
          if (artifact.url.startsWith("data:")) {
            try {
              const res = await fetch(`${BASE_URL}/files/render-sheet-inline`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ data_url: artifact.url, name: artifact.name }),
              });
              if (!res.ok) throw new Error(`HTTP ${res.status}`);
              const data = await res.json();
              if (!cancelled) {
                if (Array.isArray(data) && data.length > 0) setLocalSheet(data[0]);
                else setLoadError("Le tableau semble vide ou aucun format valide n'a été trouvé.");
              }
            } catch {
              const arrayBuffer = await dataUrlToArrayBuffer(artifact.url);
              const workbook = XLSX.read(arrayBuffer, { type: "array" });
              if (!cancelled) {
                setLocalSheet(workbookToRenderableSheet(workbook));
              }
            }
          } else {
            const renderUrl = `${BASE_URL}/files/render-sheet?url=${encodeURIComponent(artifact.url)}`;
            const res = await fetch(renderUrl);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            if (cancelled) return;
            if (Array.isArray(data) && data.length > 0) {
              setLocalSheet(data[0]);
            } else {
              setLoadError("Le tableau semble vide ou aucun format valide n'a été trouvé.");
            }
          }
        }
      } catch (err: any) {
        if (!cancelled) {
          setLoadError(`Impossible de charger le ${artifact.type === "document" ? "document" : "tableau"} : ${err?.message || "erreur inconnue"}`);
        }
      }
    };

    loadArtifact();
    return () => {
      cancelled = true;
    };
  }, [artifact]);

  useEffect(() => {
    if (artifact?.type === "code") {
      setCodeLoading(true);
      fetch(artifact.url)
        .then(res => res.text())
        .then(text => setCodeContent(text))
        .catch(err => setCodeContent(`Erreur de chargement du code: ${err.message}`))
        .finally(() => setCodeLoading(false));
    }
  }, [artifact]);

  if (!artifact) return null;

  const handleDownload = () => {
    // Passe par le proxy avec download=1 pour forcer le téléchargement (contourne la restriction cross-origin)
    const downloadUrl = artifact.url.startsWith("http")
      ? `${BASE_URL}/files/proxy?url=${encodeURIComponent(artifact.url)}&download=1&name=${encodeURIComponent(artifact.name)}`
      : artifact.url;
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = artifact.name;
    link.click();
  };


  const renderContent = () => {
    if (artifact.type === "code" || artifact.name.endsWith('.js') || artifact.name.endsWith('.json') || artifact.name.endsWith('.ts') || artifact.name.endsWith('.tsx') || artifact.name.endsWith('.py') || artifact.name.endsWith('.html') || artifact.name.endsWith('.css')) {
      if (codeLoading) {
        return (
          <div className="flex-1 flex items-center justify-center bg-[#1e1e1e]">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-orange-500"></div>
          </div>
        );
      }
      
      return <CodeEditor content={artifact.data || codeContent || "// Code indisponible pour cet artefact.\n// L'artefact n'a pas transmis de données 'data'."} />;
    }

    if (artifact.type === "image") {
      return <ImageMaskEditor 
        url={resolveArtifactImageSource(artifact)} 
        name={artifact.name} 
        onSaveMask={onInpaint} 
        onOutpaint={onOutpaint || ((ratio) => alert(`Outpainting en cours (ratio: ${ratio})`))}
        onRemoveBackground={onRemoveBackground}
        onChangeBackground={onChangeBackground}
      />;
    }

    if (artifact.type === "video") {
      return (
        <div className={`flex-1 w-full h-full flex items-center justify-center ${isPresenting ? "bg-black p-0" : "bg-[var(--bg-glass-dark)] p-4 md:p-6"}`}>
          <div className={`w-full overflow-hidden ${isPresenting ? "h-full rounded-none" : "max-w-5xl rounded-2xl border border-[var(--border-glass)] bg-black/70 shadow-2xl"}`}>
            <video
              src={artifact.url}
              controls
              playsInline
              preload="metadata"
              className={`w-full ${isPresenting ? "h-full object-contain" : "max-h-[78vh] object-contain bg-black"}`}
            />
          </div>
        </div>
      );
    }

    if (artifact.type === "document" || artifact.type === "sheet") {
      const isLoading = !loadError && ((artifact.type === "document" && !localHtml) || (artifact.type === "sheet" && !localSheet));

      return (
        <div className={`flex-1 w-full h-full relative flex flex-col overflow-hidden ${isPresenting ? 'bg-black p-4 md:p-12' : 'bg-[#f5f5f5]'}`}>

          {loadError ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 px-8 text-center">
              <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center">
                <X size={20} className="text-red-400" />
              </div>
              <p className="text-[var(--text-primary)] font-medium text-sm">Impossible d&apos;afficher le fichier</p>
              <p className="text-[var(--text-muted)] text-xs">{loadError}</p>
              <button onClick={handleDownload} className="mt-2 px-4 py-2 bg-[var(--bg-hover)] hover:bg-[var(--bg-active)] text-[var(--text-primary)] text-xs rounded-lg border border-[var(--border-glass)] transition-colors flex items-center gap-2">
                <Download size={13} /> Télécharger le fichier
              </button>
            </div>
          ) : isLoading ? (
            <div className="flex-1 flex flex-col items-center justify-center">
               <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-orange-500 mb-4"></div>
               <p className="text-[var(--text-muted)] text-sm">Chargement...</p>
            </div>
          ) : (
            <div className={`flex-1 w-full h-full overflow-auto ${isPresenting ? 'max-w-6xl mx-auto shadow-[0_0_40px_rgba(255,255,255,0.1)] rounded-xl bg-white' : 'bg-white p-8'}`}>
              {artifact.type === "document" ? (
                <div
                  className="select-text"
                  onMouseUp={handleDocMouseUp}
                  style={{
                    fontFamily: "'Segoe UI', Arial, sans-serif",
                    fontSize: "14px",
                    lineHeight: "1.7",
                    color: "#1a1a1a",
                  }}
                  dangerouslySetInnerHTML={{__html: localHtml}}
                />
              ) : (
                <div className="w-full h-full overflow-auto bg-white">
                  {isEditingText && selectedCells.size > 0 && (
                    <div className="sticky top-0 z-10 flex items-center gap-2 px-4 py-2 bg-orange-50 border-b border-orange-200">
                      <span className="text-xs text-orange-700 font-medium">{selectedCells.size} cellule(s) sélectionnée(s)</span>
                      <input
                        autoFocus
                        value={sheetComment}
                        onChange={e => setSheetComment(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') sendSheetComment(); }}
                        placeholder="Instruction : ex. Mets en rouge, Ajoute une formule..."
                        className="flex-1 px-3 py-1 text-xs border border-orange-300 rounded-lg focus:outline-none focus:border-orange-500 bg-white text-gray-800"
                      />
                      <button onClick={sendSheetComment} disabled={!sheetComment.trim()} className="px-3 py-1 bg-orange-500 text-white text-xs rounded-lg disabled:opacity-40 hover:bg-orange-600 transition-colors">Envoyer</button>
                      <button onClick={() => { setSelectedCells(new Set()); setSheetComment(""); }} className="p-1 text-gray-400 hover:text-red-500 transition-colors"><X size={14} /></button>
                    </div>
                  )}
                  <div className="flex-1 flex flex-col xl:flex-row gap-6 p-4">
                    {/* Zone Table */}
                    <div className="flex-1 overflow-auto border border-gray-200 rounded-xl shadow-sm bg-white">
                      <table className="min-w-full text-sm text-left text-gray-800 border-collapse">
                        <tbody>
                          {localSheet.rows?.map((row: any[], rowIndex: number) => (
                            <tr key={rowIndex} className="border-b border-gray-200 hover:bg-gray-50 transition-colors">
                              {Array.isArray(row) ? row.map((cell: any, cellIndex: number) => {
                                const key = `R${rowIndex}C${cellIndex}`;
                                const isSelected = selectedCells.has(key);
                                const val = cell && typeof cell === 'object' ? cell.value : cell;
                                const isBold = cell && typeof cell === 'object' ? cell.bold : false;
                                const bgColor = cell && typeof cell === 'object' && cell.bg_color ? `#${cell.bg_color.replace(/^FF/, '')}` : '';
                                const fontColor = cell && typeof cell === 'object' && cell.font_color ? `#${cell.font_color.replace(/^FF/, '')}` : '';
                                const align = cell && typeof cell === 'object' && cell.align ? cell.align : 'left';
                                
                                return (
                                  <td
                                    key={cellIndex}
                                    onClick={() => isEditingText ? toggleCellSelection(rowIndex, cellIndex) : undefined}
                                    className={`px-4 py-2 border-r border-gray-200 transition-colors whitespace-nowrap
                                      ${isSelected ? '!bg-orange-100 outline outline-2 outline-orange-400 cursor-pointer' : ''}
                                      ${isEditingText && !isSelected ? 'cursor-pointer hover:bg-orange-50' : ''}
                                    `}
                                    style={{
                                      backgroundColor: isSelected ? undefined : (bgColor || (rowIndex === 0 ? '#f3f4f6' : undefined)),
                                      color: fontColor || undefined,
                                      fontWeight: isBold || rowIndex === 0 ? '600' : 'normal',
                                      textAlign: align as any
                                    }}
                                    title={isEditingText ? "Cliquer pour sélectionner" : undefined}
                                  >
                                    {val !== null && val !== undefined ? String(val) : ''}
                                  </td>
                                );
                              }) : null}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Zone Charts */}
                    {localSheet.charts && localSheet.charts.length > 0 && (
                      <div className="w-full xl:w-[400px] shrink-0 flex flex-col gap-6">
                        {localSheet.charts.map((chart: any, i: number) => {
                          const cData = buildChartData(chart, localSheet.rows || []);
                          const chartType = chart.type?.toLowerCase() || 'bar';
                          
                          return (
                            <div key={i} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm flex flex-col">
                              <h4 className="text-[13px] font-semibold text-gray-800 mb-4 flex items-center gap-2">
                                {chartType === 'pie' ? <PieChartIcon size={16} className="text-orange-500" /> : 
                                 chartType === 'line' ? <LineChartIcon size={16} className="text-blue-500" /> : 
                                 <BarChart3 size={16} className="text-green-500" />}
                                {chart.title || 'Graphique'}
                              </h4>
                              <div className="h-[250px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                  {chartType === 'pie' ? (
                                    <PieChart>
                                      <Pie data={cData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                                        {cData.map((_, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                                      </Pie>
                                      <Tooltip contentStyle={{ borderRadius: '8px', fontSize: '12px' }} />
                                      <Legend wrapperStyle={{ fontSize: '11px' }} />
                                    </PieChart>
                                  ) : chartType === 'line' ? (
                                    <LineChart data={cData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                                      <XAxis dataKey="name" tick={{fontSize: 11, fill: '#6b7280'}} axisLine={false} tickLine={false} />
                                      <YAxis tick={{fontSize: 11, fill: '#6b7280'}} axisLine={false} tickLine={false} />
                                      <Tooltip contentStyle={{ borderRadius: '8px', fontSize: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }} />
                                      <Line type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={3} dot={{r: 4, fill: '#3b82f6', strokeWidth: 2, stroke: '#fff'}} activeDot={{r: 6}} />
                                    </LineChart>
                                  ) : (
                                    <BarChart data={cData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                                      <XAxis dataKey="name" tick={{fontSize: 11, fill: '#6b7280'}} axisLine={false} tickLine={false} />
                                      <YAxis tick={{fontSize: 11, fill: '#6b7280'}} axisLine={false} tickLine={false} />
                                      <Tooltip contentStyle={{ borderRadius: '8px', fontSize: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }} cursor={{fill: '#f3f4f6'}} />
                                      <Bar dataKey="value" fill="#f97316" radius={[4, 4, 0, 0]} maxBarSize={50}>
                                        {cData.map((_, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                                      </Bar>
                                    </BarChart>
                                  )}
                                </ResponsiveContainer>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Tooltip de sélection de texte (Word) */}
          <AnimatePresence>
            {selectionTooltip && !showSelectionComment && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 4 }}
                transition={{ duration: 0.12 }}
                className="fixed z-[200] -translate-x-1/2 -translate-y-full pointer-events-auto"
                style={{ left: selectionTooltip.x, top: selectionTooltip.y }}
              >
                <div className="flex items-center gap-1 bg-[#1a1a1a] text-white text-xs rounded-xl px-3 py-2 shadow-2xl border border-white/10">
                  <button
                    onClick={() => { setShowSelectionComment(true); setTimeout(() => selectionCommentRef.current?.focus(), 50); }}
                    className="flex items-center gap-1.5 hover:text-orange-400 transition-colors font-medium"
                  >
                    <Edit3 size={12} /> Commenter la sélection
                  </button>
                  <span className="text-white/20 mx-1">|</span>
                  <button onClick={() => setSelectionTooltip(null)} className="text-white/40 hover:text-white/80 transition-colors">
                    <X size={12} />
                  </button>
                </div>
                {/* Flèche vers le bas */}
                <div className="w-2.5 h-2.5 bg-[#1a1a1a] border-r border-b border-white/10 rotate-45 mx-auto -mt-[5px]" />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Panneau de commentaire sur sélection */}
          <AnimatePresence>
            {showSelectionComment && selectedText && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                transition={{ duration: 0.15 }}
                className="fixed z-[200] -translate-x-1/2 pointer-events-auto"
                style={{ left: selectionTooltip?.x ?? "50%", top: (selectionTooltip?.y ?? 100) - 10 }}
              >
                <div className="w-80 bg-[var(--bg-modal)] border border-[var(--border-glass)] rounded-2xl shadow-2xl overflow-hidden -translate-y-full">
                  {/* Extrait sélectionné */}
                  <div className="px-3 py-2 bg-orange-500/10 border-b border-orange-500/20">
                    <p className="text-[10px] font-semibold text-orange-400 uppercase tracking-wider mb-0.5">Sélection</p>
                    <p className="text-[12px] text-[var(--text-primary)] line-clamp-2 italic opacity-80">&quot;{selectedText.slice(0, 80)}{selectedText.length > 80 ? '…' : ''}&quot;</p>
                  </div>
                  {/* Input commentaire */}
                  <div className="p-3 flex flex-col gap-2">
                    <textarea
                      ref={selectionCommentRef}
                      value={selectionComment}
                      onChange={e => setSelectionComment(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendSelectionComment(); } if (e.key === 'Escape') { setShowSelectionComment(false); setSelectionTooltip(null); } }}
                      placeholder="Instruction : ex. Reformule plus professionnel, Traduis en anglais..."
                      rows={2}
                      className="w-full bg-[var(--bg-input)] border border-[var(--border-glass)] rounded-xl px-3 py-2 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-orange-500/50 resize-none transition-colors"
                    />
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-[var(--text-muted)]">Entrée pour envoyer · Échap pour annuler</span>
                      <div className="flex gap-1.5">
                        <button onClick={() => { setShowSelectionComment(false); setSelectionTooltip(null); }} className="px-2.5 py-1 text-[11px] rounded-lg bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors border border-[var(--border-glass)]">Annuler</button>
                        <button onClick={sendSelectionComment} disabled={!selectionComment.trim()} className="px-3 py-1 text-[11px] rounded-lg bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-40 transition-colors font-medium">Envoyer</button>
                      </div>
                    </div>
                  </div>
                </div>
                {/* Flèche */}
                <div className="w-2.5 h-2.5 bg-[var(--bg-modal)] border-r border-b border-[var(--border-glass)] rotate-45 mx-auto -mt-[5px]" />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Exit Button handled at root level now */}

          {/* Floating Refinement Input (Cheat code: contextual manual editing) */}
          <AnimatePresence>
            {isEditingText && (
              <motion.div
                initial={{ y: "100%", opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: "100%", opacity: 0 }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-[var(--bg-sidebar)] via-[var(--bg-sidebar)] to-transparent z-20 pointer-events-none"
              >
                <div className="max-w-3xl mx-auto bg-[var(--bg-modal)] backdrop-blur-xl border border-[var(--border-glass)] rounded-2xl shadow-[0_-10px_40px_rgba(0,0,0,0.15)] overflow-hidden pointer-events-auto flex flex-col">
                  <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--border-glass)] bg-[var(--bg-card)]">
                    <div className="flex items-center gap-2">
                      <Edit3 size={14} className="text-orange-500" />
                      <span className="text-xs font-semibold text-[var(--text-primary)] tracking-wide uppercase">Modifier manuellement</span>
                      {artifact.type === "document" && (
                        <span className="text-[10px] text-orange-400 bg-orange-500/10 px-2 py-0.5 rounded-full border border-orange-500/20">
                          Sélectionnez du texte pour commenter
                        </span>
                      )}
                      {artifact.type === "sheet" && (
                        <span className="text-[10px] text-orange-400 bg-orange-500/10 px-2 py-0.5 rounded-full border border-orange-500/20">
                          Cliquez sur les cellules pour sélectionner
                        </span>
                      )}
                    </div>
                    <button 
                      onClick={() => setIsEditingText(false)}
                      className="p-1 text-[var(--text-muted)] hover:text-red-400 transition-colors rounded-lg"
                    >
                      <X size={14} />
                    </button>
                  </div>
                  
                  <div className="p-3 bg-[var(--bg-input)] flex flex-col gap-2">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-[11px] text-[var(--text-muted)] px-1">
                        <span className="font-medium text-[var(--text-primary)]">Astuce :</span> Indiquez votre sélection (ex: &quot;Pour le bloc Introduction...&quot;) et la modification souhaitée.
                      </p>
                    </div>
                    
                    {fileStructure && (
                      <div className="relative mb-2 px-1">
                        <button
                          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--bg-active)] border border-[var(--border-glass)] text-[11px] font-medium text-[var(--text-primary)] hover:border-orange-500/30 transition-colors"
                        >
                          <ListCollapse size={14} className="text-orange-500" />
                          <span>Choisir une section</span>
                          <ChevronDown size={12} className="text-[var(--text-muted)] ml-1" />
                        </button>
                        {isDropdownOpen && (
                          <>
                            <div className="fixed inset-0 z-40" onClick={() => setIsDropdownOpen(false)} />
                            <div className="absolute left-1 bottom-full mb-2 w-64 max-h-48 overflow-y-auto bg-[var(--bg-modal)] border border-[var(--border-glass)] rounded-xl shadow-2xl z-50 flex flex-col p-1.5 custom-scrollbar">
                              <div className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider px-2 py-1 mb-1">Structure du document</div>
                              {fileStructure.map((z: string, i: number) => (
                                <button
                                  key={i}
                                  onClick={() => {
                                    setEditedText(prev => `[SÉLECTION: ${z}] ${prev}`);
                                    setIsDropdownOpen(false);
                                  }}
                                  className="text-left px-2.5 py-2 text-[11px] text-[var(--text-primary)] hover:bg-[var(--bg-hover)] rounded-md transition-colors truncate"
                                  title={z}
                                >
                                  {z}
                                </button>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    )}
                    
                    <div className="flex items-end gap-2">
                      <textarea
                        value={editedText}
                        onChange={(e) => setEditedText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            if (editedText.trim() && onEdit) {
                              onEdit(JSON.stringify({
                                prompt: editedText.trim(),
                                selection: {
                                  type: "document_refinement",
                                  file_url: artifactSelectionUrl,
                                  file_name: artifact.name
                                }
                              }));
                              setIsEditingText(false);
                              setEditedText("");
                            }
                          }
                        }}
                        placeholder="Ex: Modifie le titre en rouge..."
                        className="flex-1 max-h-32 min-h-[44px] bg-transparent border border-[var(--border-glass)] rounded-xl px-3 py-2.5 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-orange-500/50 resize-none custom-scrollbar transition-colors"
                        rows={1}
                      />
                      <button 
                        onClick={() => {
                          if (editedText.trim() && onEdit) {
                            onEdit(JSON.stringify({
                                prompt: editedText.trim(),
                                selection: {
                                  type: "document_refinement",
                                  file_url: artifactSelectionUrl,
                                  file_name: artifact.name
                                }
                              }));
                            setIsEditingText(false);
                            setEditedText("");
                          }
                        }}
                        disabled={!editedText.trim()}
                        className="p-2.5 bg-[var(--text-primary)] text-[var(--background)] rounded-xl hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shrink-0 mb-[1px]"
                      >
                        <Save size={18} />
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      );
    }

    return (
      <div className="flex-1 flex items-center justify-center bg-[var(--bg-glass-dark)]">
        <p className="text-[var(--text-muted)]">Aperçu non disponible pour ce type de fichier.</p>
      </div>
    );
  };

  const Icon = artifact.type === "document"
    ? FileText
    : artifact.type === "sheet"
      ? FileSpreadsheet
      : artifact.type === "image"
        ? ImageIcon
        : artifact.type === "video"
          ? MonitorPlay
          : FileText;
  const iconColor = artifact.type === "document"
    ? "text-[#1B2A4A]"
    : artifact.type === "sheet"
      ? "text-[#107C41]"
      : artifact.type === "video"
        ? "text-blue-400"
        : "text-[var(--text-muted)]";

  return (
    <motion.div
      initial={{ width: 0, opacity: 0 }}
      animate={{ width: "100%", opacity: 1 }}
      exit={{ width: 0, opacity: 0 }}
      transition={{ type: "spring", damping: 25, stiffness: 200 }}      
      className={`absolute md:relative inset-0 md:inset-auto md:h-full flex flex-col md:border-l md:border-[var(--border-glass)] overflow-hidden z-[100] transition-all duration-300 ${
        isPresenting 
          ? '!fixed !inset-0 !w-full !h-full !max-w-none !z-[9999] bg-black shadow-[0_0_50px_rgba(0,0,0,0.8)]' 
          : 'bg-[var(--background)] md:bg-[var(--bg-sidebar)] shadow-[-10px_0_30px_rgba(0,0,0,0.2)] md:z-40 md:w-[50%] md:min-w-[400px] lg:min-w-[500px]'
      }`}
    >
        {/* Header */}
        {!isPresenting && (
          <div className="flex items-center justify-between px-3 md:px-4 py-3 border-b border-[var(--border-glass)] bg-[var(--bg-modal)] backdrop-blur-md z-10 shrink-0 gap-2">
            <div className="flex items-center gap-2.5 md:gap-3 min-w-0 flex-1 pr-2 md:pr-4"> 
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center bg-[var(--bg-active)] shrink-0`}>
                <Icon size={16} className={iconColor} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                  <h3 className="text-[13px] font-medium text-[var(--text-primary)] truncate">
                    {artifact.name.startsWith('http')
                      ? decodeURIComponent(artifact.name.split('/').pop()?.split('?')[0] || artifact.name)
                          .replace(/^(?:doc|sheet)_[a-f0-9]{8}_/i, '')
                      : artifact.name}
                  </h3>
                  <div className="relative group">
                    <span className="px-1.5 py-0.5 text-[9px] font-medium bg-[var(--bg-hover)] border border-[var(--border-glass)] text-[var(--text-muted)] rounded flex items-center gap-1 cursor-pointer hover:bg-[var(--bg-active)] transition-colors">
                      <History size={10} />
                      {artifact.version || "v1.0"} (Actuelle) <span className="text-[8px]">▼</span>
                    </span>
                    <div className="absolute top-full left-0 mt-1 w-32 bg-[var(--bg-modal)] border border-[var(--border-glass)] rounded-lg shadow-xl opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto transition-all z-50 py-1">
                      <button className="w-full text-left px-3 py-1.5 text-[11px] text-[var(--text-primary)] bg-[var(--bg-active)] font-medium flex items-center justify-between">
                        {artifact.version || "v1.0"} <span className="text-[9px] text-[var(--text-muted)]">Actuel</span>
                      </button>
                      {versions && versions.filter(v => v.version !== artifact.version).map((v, i) => (
                        <button key={i} onClick={() => onSelectVersion && onSelectVersion(v)} className="w-full text-left px-3 py-1.5 text-[11px] text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] transition-colors">
                          {v.version}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider leading-none">{artifact.type}</p>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => setIsPresenting(true)}
                className={`flex items-center gap-1.5 px-3 py-1.5 mr-1 rounded-lg bg-[var(--bg-hover)] border-[var(--border-glass)] text-[var(--text-primary)] border text-[11px] font-medium hover:border-blue-500/30 hover:text-blue-400 transition-colors`}
                title="Mode Présentation"
              >
                <Maximize2 size={14} />
                <span className="hidden md:inline">Présentation</span>
              </button>
              {onEdit && (artifact.type === "document" || artifact.type === "sheet") && !isEditingText && (
                <button
                  onClick={() => setIsEditingText(true)}
                  className="hidden md:flex items-center gap-1.5 px-3 py-1.5 mr-2 rounded-lg bg-[var(--bg-hover)] border border-[var(--border-glass)] text-[11px] font-medium text-[var(--text-primary)] hover:border-orange-500/30 hover:text-orange-400 transition-colors"
                >
                  <Edit3 size={12} /> Éditer manuellement
                </button>
              )}
              <button
                onClick={handleDownload}
                className="p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors" 
                title="Télécharger"
              >
                <Download size={16} />
              </button>
              <div className="w-px h-4 bg-[var(--border-glass)] mx-1" />  
              <button
                onClick={onClose}
                className="p-2 rounded-lg text-[var(--text-muted)] hover:text-white hover:bg-red-500/80 transition-colors"
                title="Fermer"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        )}

        {/* Pro Actions Bar */}
        {(artifact.type === "document" || artifact.type === "sheet") && !isEditingText && !isPresenting && (
          <div className="flex items-center gap-2 px-3 md:px-4 py-2 border-b border-[var(--border-glass)] bg-[var(--bg-card)] shrink-0 overflow-x-auto custom-scrollbar">
            <span className="text-[10px] font-medium text-[var(--text-muted)] uppercase tracking-wider mr-2 shrink-0">Ouvrir avec :</span>      

            <a
              href={`https://docs.google.com/viewer?url=${encodeURIComponent(artifact.url)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[var(--bg-hover)] border border-[var(--border-glass)] hover:border-blue-500/30 hover:bg-blue-500/10 text-[11px] font-medium text-[var(--text-primary)] transition-all shrink-0"
            >
              {artifact.type === "sheet" ? <FileSpreadsheet size={16} className="text-[#0F9D58]" /> : <FileText size={16} className="text-[#4285F4]" />}
              Google {artifact.type === "sheet" ? "Sheets" : "Docs"}    
            </a>

            <a
              href={`https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(artifact.url)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[var(--bg-hover)] border border-[var(--border-glass)] hover:border-blue-700/30 hover:bg-blue-700/10 text-[11px] font-medium text-[var(--text-primary)] transition-all shrink-0"
            >
              {artifact.type === "sheet" ? <FileSpreadsheet size={16} className="text-[#107C41]" /> : <FileText size={16} className="text-[#185ABD]" />}
              Word Online
            </a>
          </div>
        )}

        {/* Viewer Content */}
        <div className="flex-1 min-h-0 relative">
          {isPresenting && (
            <button
              onClick={() => setIsPresenting(false)}
              className="absolute top-4 right-4 z-[999] flex items-center gap-2 px-4 py-2 bg-[var(--bg-modal)] backdrop-blur-md border border-[var(--border-glass)] text-[var(--text-primary)] text-sm rounded-xl shadow-2xl hover:bg-[var(--bg-hover)] transition-all animate-fade-in-up"
            >
              <Minimize2 size={16} /> Quitter
            </button>
          )}
          {renderContent()}
        </div>
      </motion.div>
  );
}



