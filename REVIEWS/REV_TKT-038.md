# CODE REVIEW REQUEST: TKT-038
**Auteur**: DELTA
**Date**: 2026-03-22T00:50:06.230Z

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
import { X, Download, FileText, FileSpreadsheet, ExternalLink, ImageIcon, Maximize2, Brush, Eraser, Check, Edit3, Save } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export type ArtifactType = "image" | "document" | "sheet" | "code" | "unknown";

export interface Artifact {
  url: string;
  type: ArtifactType;
  name: string;
}

interface ArtifactViewerProps {
  artifact: Artifact | null;
  onClose: () => void;
  onInpaint?: (maskBase64: string) => void;
  onEdit?: (content: string) => void;
}

function ImageMaskEditor({ url, name, onSaveMask }: { url: string, name: string, onSaveMask?: (maskBase64: string) => void }) {
  const [isMasking, setIsMasking] = useState(false);
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
      canvas.width = img.width;
      canvas.height = img.height;
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
    
    // Scale factors to map display size to actual canvas pixels
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    let clientX, clientY;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
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
      
      {!isMasking && onSaveMask && (
        <button 
          onClick={() => setIsMasking(true)}
          className="absolute top-4 right-4 z-10 flex items-center gap-2 px-4 py-2 bg-[var(--bg-modal)] backdrop-blur-md border border-[var(--border-glass)] text-[var(--text-primary)] text-sm rounded-xl hover:bg-[var(--bg-hover)] transition-all shadow-md"
        >
          <Brush size={16} /> Mode Inpainting
        </button>
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
            className="absolute top-0 left-0 w-full h-full cursor-crosshair touch-none rounded-lg"
            style={{ 
              backgroundColor: 'rgba(0,0,0,0.4)', // Dim background slightly to see mask better
            }}
          />
        )}
      </div>
    </div>
  );
}

export default function ArtifactViewer({ artifact, onClose, onInpaint, onEdit }: ArtifactViewerProps) {
  const [iframeError, setIframeError] = useState(false);
  const [isEditingText, setIsEditingText] = useState(false);
  const [editedText, setEditedText] = useState("");

  if (!artifact) return null;

  const handleDownload = () => {
    const link = document.createElement("a");
    link.href = artifact.url;
    link.download = artifact.name;
    link.target = "_blank";
    link.click();
  };

  const getViewerUrl = () => {
    if (artifact.type === "document" || artifact.type === "sheet") {    
      return `https://docs.google.com/viewer?url=${encodeURIComponent(artifact.url)}&embedded=true`;
    }
    return artifact.url;
  };

  const renderContent = () => {
    if (artifact.type === "image") {
      return <ImageMaskEditor url={artifact.url} name={artifact.name} onSaveMask={onInpaint} />;
    }

    if (artifact.type === "document" || artifact.type === "sheet") {
      return (
        <div className="flex-1 w-full h-full bg-white relative flex flex-col overflow-hidden">        
          {!iframeError ? (
            <iframe
              src={getViewerUrl()}
              className="flex-1 w-full h-full border-0"
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
      className="absolute md:relative inset-0 md:inset-auto md:h-full flex flex-col bg-[var(--background)] md:bg-[var(--bg-sidebar)] border-l border-[var(--border-glass)] shadow-[-10px_0_30px_rgba(0,0,0,0.2)] overflow-hidden z-[100] md:z-40 md:w-[50%] md:min-w-[400px] lg:min-w-[500px]"
    >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-glass)] bg-[var(--bg-modal)] backdrop-blur-md z-10 shrink-0">
          <div className="flex items-center gap-3 min-w-0 flex-1 pr-4"> 
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center bg-[var(--bg-active)] shrink-0`}>
              <Icon size={16} className={iconColor} />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-[13px] font-medium text-[var(--text-primary)] truncate">{artifact.name}</h3>
              <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">{artifact.type}</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
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

        {/* Pro Actions Bar */}
        {(artifact.type === "document" || artifact.type === "sheet") && !isEditingText && (
          <div className="flex items-center gap-2 px-4 py-2 border-b border-[var(--border-glass)] bg-[var(--bg-card)] shrink-0 overflow-x-auto custom-scrollbar">
            <span className="text-[10px] font-medium text-[var(--text-muted)] uppercase tracking-wider mr-2 shrink-0">Ouvrir avec :</span>      

            <a
              href={`https://docs.google.com/viewer?url=${encodeURIComponent(artifact.url)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[var(--bg-hover)] border border-[var(--border-glass)] hover:border-blue-500/30 hover:bg-blue-500/10 text-[11px] font-medium text-[var(--text-primary)] transition-all shrink-0"
            >
              <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/0/01/Google_Docs_logo_%282014-2020%29.svg/1481px-Google_Docs_logo_%282014-2020%29.svg.png" alt="Google Docs" className="w-3.5 h-3.5 object-contain" />
              Google {artifact.type === "sheet" ? "Sheets" : "Docs"}    
            </a>

            <a
              href={`https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(artifact.url)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[var(--bg-hover)] border border-[var(--border-glass)] hover:border-blue-700/30 hover:bg-blue-700/10 text-[11px] font-medium text-[var(--text-primary)] transition-all shrink-0"
            >
              <img src={artifact.type === "sheet" ? "https://upload.wikimedia.org/wikipedia/commons/thumb/3/34/Microsoft_Office_Excel_%282019%E2%80%93present%29.svg/1101px-Microsoft_Office_Excel_%282019%E2%80%93present%29.svg.png" : "https://upload.wikimedia.org/wikipedia/commons/thumb/f/fd/Microsoft_Office_Word_%282019%E2%80%93present%29.svg/1101px-Microsoft_Office_Word_%282019%E2%80%93present%29.svg.png"} alt="Microsoft Office" className="w-3.5 h-3.5 object-contain" />
              Word Online
            </a>
          </div>
        )}

        {/* Viewer Content */}
        <div className="flex-1 min-h-0 relative">
          {renderContent()}
        </div>
      </motion.div>
  );
}

```


**INSTRUCTIONS POUR GAMMA :**
1. Lis attentivement ce diff.
2. Si c'est parfait, tape: `node flare_review.js approve TKT-038`
3. S'il y a des erreurs, tape: `node flare_review.js reject TKT-038 "Tes explications..."`
