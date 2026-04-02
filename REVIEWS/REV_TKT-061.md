# CODE REVIEW REQUEST: TKT-061
**Auteur**: DELTA
**Date**: 2026-03-22T15:37:14.125Z

## Preuve de Travail (Test Automatisé)
Commande exécutée : `cd frontend && npx tsc --noEmit`
Résultat : **SUCCÈS**
```text
 // (Tronqué si trop long)
```

## Changements

### NOUVEAU FICHIER : frontend/src/components/ArtifactViewer.tsx
```
"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { X, Download, FileText, FileSpreadsheet, ExternalLink, ImageIcon, Maximize2, Brush, Eraser, Check, Edit3, Save, Crop, MonitorPlay, Minimize2, Copy, Code, History } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

export type ArtifactType = "image" | "document" | "sheet" | "code" | "unknown";

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
}

function ImageMaskEditor({ url, name, onSaveMask, onOutpaint }: { url: string, name: string, onSaveMask?: (maskBase64: string) => void, onOutpaint?: (ratio: string) => void }) {
  const [isMasking, setIsMasking] = useState(false);
  const [outpaintMenuOpen, setOutpaintMenuOpen] = useState(false);
  const [brushSize, setBrushSize] = useState(30);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [ctx, setCtx] = useState<CanvasRenderingContext2D | null>(null);
  const [imgRenderSize, setImgRenderSize] = useState({ width: 0, height: 0, top: 0, left: 0 });

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
      
      {!isMasking && (onSaveMask || onOutpaint) && (
        <div className="absolute top-4 right-4 z-10 flex items-center gap-2 bg-[var(--bg-modal)] backdrop-blur-md border border-[var(--border-glass)] rounded-xl shadow-md p-1">
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
                    <p className="text-[10px] font-medium text-[var(--text-muted)] uppercase tracking-wider px-2 py-1 mb-1">Format (Outpainting)</p>
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
          src={url} 
          alt={name} 
          className="max-w-full max-h-full object-contain rounded-lg shadow-xl block select-none" 
          draggable={false}
          crossOrigin="anonymous"
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

export default function ArtifactViewer({ artifact, versions, onSelectVersion, onClose, onInpaint, onOutpaint, onEdit }: ArtifactViewerProps) {
  const [iframeError, setIframeError] = useState(false);
  const [isEditingText, setIsEditingText] = useState(false);
  const [editedText, setEditedText] = useState("");
  const [isPresenting, setIsPresenting] = useState(false);
  const [codeContent, setCodeContent] = useState<string>("");
  const [codeLoading, setCodeLoading] = useState(false);

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
    const link = document.createElement("a");
    link.href = artifact.url;
    link.download = artifact.name;
    link.target = "_blank";
    link.click();
  };

  const getViewerUrl = () => {
    if (artifact.url.startsWith('data:')) return '';
    if (artifact.type === "document" || artifact.type === "sheet") {    
      return `https://docs.google.com/viewer?url=${encodeURIComponent(artifact.url)}&embedded=true`;
    }
    return artifact.url;
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
        url={artifact.url} 
        name={artifact.name} 
        onSaveMask={onInpaint} 
        onOutpaint={onOutpaint || ((ratio) => alert(`Outpainting en cours (ratio: ${ratio})`))} 
      />;
    }

    if (artifact.type === "document" || artifact.type === "sheet") {
      return (
        <div className={`flex-1 w-full h-full relative flex flex-col overflow-hidden ${isPresenting ? 'bg-black p-4 md:p-12' : 'bg-white'}`}>        
          {!iframeError && artifact.url && !artifact.url.startsWith('data:') ? (
            <iframe
              src={getViewerUrl()}
              className={`border-0 ${isPresenting ? 'w-full h-full max-w-6xl mx-auto shadow-[0_0_40px_rgba(255,255,255,0.1)] rounded-xl bg-white' : 'flex-1 w-full h-full'}`}
              onError={() => setIframeError(true)}
              title="Viewer"
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full bg-[var(--bg-glass-dark)] text-[var(--text-primary)] p-8 text-center flex-1">
              {artifact.type === "document" ? <FileText size={48} className="mb-4 text-[#1B2A4A]" /> : <FileSpreadsheet size={48} className="mb-4 text-[#107C41]" />}
              <h3 className="text-lg font-medium mb-2">Aperçu indisponible</h3>
              <p className="text-sm text-[var(--text-muted)] max-w-md mb-6">Le fichier ne peut pas être affiché directement dans le navigateur. Veuillez utiliser les options d'ouverture ci-dessus ou le télécharger.</p>
              <button
                onClick={handleDownload}
                className="px-6 py-2.5 bg-[var(--text-primary)] text-[var(--background)] font-medium rounded-xl hover:opacity-90 transition-opacity"
              >
                Télécharger le fichier
              </button>
            </div>
          )}

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
                      <span className="text-xs font-semibold text-[var(--text-primary)] tracking-wide uppercase">Ajustement Contextuel</span>
                    </div>
                    <button 
                      onClick={() => setIsEditingText(false)}
                      className="p-1 text-[var(--text-muted)] hover:text-red-400 transition-colors rounded-lg"
                    >
                      <X size={14} />
                    </button>
                  </div>
                  
                  <div className="p-3 bg-[var(--bg-input)]">
                    <p className="text-[11px] text-[var(--text-muted)] mb-2 px-1">
                      <span className="font-medium text-[var(--text-primary)]">Astuce :</span> Indiquez votre sélection (ex: "Pour le bloc Introduction...") et la modification souhaitée.
                    </p>
                    <div className="flex items-end gap-2">
                      <textarea
                        value={editedText}
                        onChange={(e) => setEditedText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            if (editedText.trim() && onEdit) {
                              onEdit(`Raffiner l'artefact ${artifact.name} : ${editedText.trim()}`);
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
                            onEdit(`Raffiner l'artefact ${artifact.name} : ${editedText.trim()}`);
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

  const Icon = artifact.type === "document" ? FileText : artifact.type === "sheet" ? FileSpreadsheet : artifact.type === "image" ? ImageIcon : FileText;
  const iconColor = artifact.type === "document" ? "text-[#1B2A4A]" : artifact.type === "sheet" ? "text-[#107C41]" : "text-[var(--text-muted)]";

  return (
    <motion.div
      initial={{ width: 0, opacity: 0 }}
      animate={{ width: "100%", opacity: 1 }}
      exit={{ width: 0, opacity: 0 }}
      transition={{ type: "spring", damping: 25, stiffness: 200 }}      
      className={`absolute md:relative inset-0 md:inset-auto md:h-full flex flex-col border-l border-[var(--border-glass)] overflow-hidden z-[100] transition-all duration-300 ${
        isPresenting 
          ? '!fixed !inset-0 !w-full !h-full !max-w-none !z-[9999] bg-black shadow-[0_0_50px_rgba(0,0,0,0.8)]' 
          : 'bg-[var(--background)] md:bg-[var(--bg-sidebar)] shadow-[-10px_0_30px_rgba(0,0,0,0.2)] md:z-40 md:w-[50%] md:min-w-[400px] lg:min-w-[500px]'
      }`}
    >
        {/* Header */}
        {!isPresenting && (
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-glass)] bg-[var(--bg-modal)] backdrop-blur-md z-10 shrink-0">
            <div className="flex items-center gap-3 min-w-0 flex-1 pr-4"> 
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center bg-[var(--bg-active)] shrink-0`}>
                <Icon size={16} className={iconColor} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <h3 className="text-[13px] font-medium text-[var(--text-primary)] truncate">{artifact.name}</h3>
                  <div className="relative group">
                    <span className="px-1.5 py-0.5 text-[9px] font-medium bg-[var(--bg-hover)] border border-[var(--border-glass)] text-[var(--text-muted)] rounded flex items-center gap-1 cursor-pointer hover:bg-[var(--bg-active)] transition-colors">
                      <History size={10} />
                      {artifact.version || "v1.0"} (Current) <span className="text-[8px]">▼</span>
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

            <div className="flex items-center gap-1.5 shrink-0">
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
                  className="flex items-center gap-1.5 px-3 py-1.5 mr-2 rounded-lg bg-[var(--bg-hover)] border border-[var(--border-glass)] text-[11px] font-medium text-[var(--text-primary)] hover:border-orange-500/30 hover:text-orange-400 transition-colors"
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
          <div className="flex items-center gap-2 px-4 py-2 border-b border-[var(--border-glass)] bg-[var(--bg-card)] shrink-0 overflow-x-auto custom-scrollbar">
            <span className="text-[10px] font-medium text-[var(--text-muted)] uppercase tracking-wider mr-2 shrink-0">Ouvrir avec :</span>      

            <a
              href={`https://docs.google.com/viewer?url=${encodeURIComponent(artifact.url)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[var(--bg-hover)] border border-[var(--border-glass)] hover:border-blue-500/30 hover:bg-blue-500/10 text-[11px] font-medium text-[var(--text-primary)] transition-all shrink-0"
            >
              {artifact.type === "sheet" ? (
                <FileSpreadsheet size={14} className="text-green-500" />
              ) : (
                <FileText size={14} className="text-blue-500" />
              )}
              Google {artifact.type === "sheet" ? "Sheets" : "Docs"}    
            </a>

            <a
              href={`https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(artifact.url)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[var(--bg-hover)] border border-[var(--border-glass)] hover:border-blue-700/30 hover:bg-blue-700/10 text-[11px] font-medium text-[var(--text-primary)] transition-all shrink-0"
            >
              {artifact.type === "sheet" ? (
                <FileSpreadsheet size={14} className="text-[#107C41]" />
              ) : (
                <FileText size={14} className="text-[#185ABD]" />
              )}
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



```


**INSTRUCTIONS POUR GAMMA :**
1. Lis attentivement ce diff.
2. Si c'est parfait, tape: `node flare_review.js approve TKT-061`
3. S'il y a des erreurs, tape: `node flare_review.js reject TKT-061 "Tes explications..."`
