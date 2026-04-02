"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { BookOpen, Plus, Trash2, Search, FileText, Loader2, AlertCircle, X, Upload, Check, Square, CheckSquare, Zap, ArrowLeft } from "lucide-react";
import { uploadKnowledgeFile, getApiBaseUrl } from "@/lib/api";

interface KnowledgeDoc {
  id: string;
  title: string;
  content: string;
  source?: string;
  type?: string;
  word_count?: number;
  created_at?: unknown;
}

interface KnowledgePanelProps {
  token: string | null;
  refreshToken?: number;
}

const API = getApiBaseUrl();

export default function KnowledgePanel({ token, refreshToken }: KnowledgePanelProps) {
  const [docs, setDocs] = useState<KnowledgeDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [newDoc, setNewDoc] = useState({ title: "", content: "", source: "" });
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedDoc, setSelectedDoc] = useState<KnowledgeDoc | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDeletingBulk, setIsDeletingBulk] = useState(false);

  const headers: Record<string, string> = token
    ? { "Content-Type": "application/json", Authorization: `Bearer ${token}` }
    : { "Content-Type": "application/json" };

  const loadDocs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/knowledge/`, { headers });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setDocs(data.documents || []);
    } catch {
      setError("Impossible de charger vos documents.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { loadDocs(); }, [loadDocs]);
  useEffect(() => { if (refreshToken) loadDocs(); }, [refreshToken, loadDocs]);

  const handleAdd = async () => {
    if (!newDoc.title.trim() || !newDoc.content.trim()) return;
    setAddLoading(true);
    try {
      const res = await fetch(`${API}/knowledge/`, {
        method: "POST",
        headers,
        body: JSON.stringify({ title: newDoc.title, content: newDoc.content, source: newDoc.source }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setNewDoc({ title: "", content: "", source: "" });
      setShowAddForm(false);
      await loadDocs();
    } catch {
      setError("Erreur lors de l'ajout.");
    } finally {
      setAddLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setAddLoading(true);
    setError(null);
    try {
      await uploadKnowledgeFile(f, token);
      setShowAddForm(false);
      await loadDocs();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erreur lors de l'upload.";
      setError(msg);
    } finally {
      setAddLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); };
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (!f) return;
    const ext = f.name.split('.').pop()?.toLowerCase();
    const SUPPORTED = ['txt', 'md', 'pdf', 'docx', 'csv', 'json', 'jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'pptx'];
    if (!SUPPORTED.includes(ext || '')) {
      setError("Format non supporté. Formats acceptés : PDF, Word, TXT, CSV, Images, PowerPoint");
      return;
    }
    setAddLoading(true);
    setError(null);
    try {
      await uploadKnowledgeFile(f, token);
      setShowAddForm(false);
      await loadDocs();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erreur lors de l'upload.";
      setError(msg);
    } finally {
      setAddLoading(false);
    }
  };

  const handleDelete = async (docId: string) => {
    if (!confirm("Supprimer ce document ?")) return;
    try {
      await fetch(`${API}/knowledge/${docId}`, { method: "DELETE", headers });
      setDocs((prev) => prev.filter((d) => d.id !== docId));
      if (selectedDoc?.id === docId) setSelectedDoc(null);
    } catch {
      setError("Erreur lors de la suppression.");
    }
  };

  const toggleSelection = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleBulkDeleteAction = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Supprimer ${selectedIds.size} document(s) ?`)) return;

    setIsDeletingBulk(true);
    try {
      const deletePromises = Array.from(selectedIds).map(id =>
        fetch(`${API}/knowledge/${id}`, { method: "DELETE", headers })
      );
      await Promise.all(deletePromises);
      setDocs(prev => prev.filter(d => !selectedIds.has(d.id)));
      if (selectedDoc && selectedIds.has(selectedDoc.id)) setSelectedDoc(null);
      setSelectedIds(new Set());
      setSelectionMode(false);
    } catch (err) {
      console.error("Erreur suppression:", err);
      setError("Erreur lors de la suppression.");
    } finally {
      setIsDeletingBulk(false);
    }
  };

  const filtered = docs.filter(
    (d) =>
      search === "" ||
      d.title.toLowerCase().includes(search.toLowerCase()) ||
      d.content.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div
      className="flex-1 flex flex-col md:flex-row overflow-hidden relative bg-[var(--background)] transition-colors"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Overlay Drag & Drop */}
      {isDragging && (
        <div className="absolute inset-0 z-50 bg-[var(--bg-overlay)] backdrop-blur-md border-2 border-dashed border-[var(--border-subtle)] rounded-3xl m-4 md:m-6 flex flex-col items-center justify-center pointer-events-none shadow-2xl">
          <div className="w-16 h-16 bg-[var(--bg-hover)] rounded-2xl flex items-center justify-center mb-4 border border-[var(--border-glass)]">
            <Upload size={32} className="text-[var(--text-primary)] animate-bounce" />
          </div>
          <h2 className="text-lg font-medium text-[var(--text-primary)] mb-1">Lâchez pour importer</h2>
          <p className="text-[var(--text-muted)] text-sm font-light">PDF, Word, Images, CSV, PowerPoint</p>
        </div>
      )}

      {/* Loader upload */}
      {addLoading && (
        <div className="absolute inset-0 z-[100] bg-[var(--bg-overlay)] backdrop-blur-sm flex flex-col items-center justify-center animate-fade-in">
          <div className="w-20 h-20 rounded-2xl bg-[var(--bg-modal)] border border-[var(--border-glass)] flex items-center justify-center shadow-2xl mb-6">
            <Loader2 size={28} className="text-[var(--text-primary)] animate-spin" />
          </div>
          <h2 className="text-lg font-medium text-[var(--text-primary)] mb-2">Import en cours...</h2>
          <p className="text-[var(--text-muted)] text-[14px] font-light animate-pulse">L&apos;IA analyse votre document</p>
        </div>
      )}

      {/* Sidebar Documents */}
      <div className={`${selectedDoc || showAddForm ? 'hidden md:flex' : 'flex'} w-full md:w-[300px] flex-shrink-0 flex-col border-b md:border-b-0 md:border-r border-[var(--border-glass)] bg-[var(--bg-sidebar)]`}>
        <div className="p-4 md:p-5 border-b border-[var(--border-glass)] space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-[var(--bg-hover)] border border-[var(--border-glass)] flex items-center justify-center">
                <BookOpen size={15} className="text-[var(--text-primary)]" />
              </div>
              <span className="text-[14px] font-medium text-[var(--text-primary)]">Mes documents</span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => {
                  setSelectionMode(!selectionMode);
                  if (selectionMode) setSelectedIds(new Set());
                }}
                className={`p-2 rounded-xl border transition-all ${
                  selectionMode
                    ? 'bg-[var(--bg-active)] border-[var(--border-subtle)] text-[var(--text-primary)]'
                    : 'bg-[var(--bg-hover)] border-[var(--border-glass)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                }`}
                title={selectionMode ? "Terminer" : "Sélectionner"}
              >
                {selectionMode ? <Check size={14} strokeWidth={2.5} /> : <CheckSquare size={14} />}
              </button>
              <button
                onClick={() => { setShowAddForm(!showAddForm); setSelectedDoc(null); }}
                className="p-2 rounded-xl bg-[var(--bg-hover)] hover:bg-[var(--bg-card-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all border border-[var(--border-glass)]"
                title="Ajouter un document"
              >
                <Plus size={16} />
              </button>
            </div>
          </div>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              type="text"
              placeholder="Rechercher..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-[var(--bg-input)] border border-[var(--border-glass)] text-[var(--text-primary)] text-[13px] placeholder-[var(--text-muted)]/60 focus:outline-none focus:border-[var(--border-subtle)] transition-all"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-2.5 space-y-1">
          {loading ? (
            <div className="flex items-center justify-center p-12">
              <Loader2 size={22} className="animate-spin text-[var(--text-muted)]" />
            </div>
          ) : error ? (
            <div className="p-6 text-center bg-red-500/5 rounded-2xl border border-red-500/10 mx-1">
              <AlertCircle size={18} className="text-red-500/60 mx-auto mb-2" />
              <p className="text-[13px] text-red-400">{error}</p>
              <button onClick={loadDocs} className="mt-3 px-4 py-1.5 rounded-lg bg-[var(--bg-hover)] text-[var(--text-muted)] text-[11px] font-medium border border-[var(--border-glass)]">Réessayer</button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center flex flex-col items-center">
              <div className="w-14 h-14 rounded-2xl bg-[var(--bg-hover)] flex items-center justify-center border border-[var(--border-glass)] text-[var(--text-muted)] mb-4">
                <BookOpen size={24} strokeWidth={1.5} />
              </div>
              <h3 className="text-[14px] font-medium text-[var(--text-primary)] mb-1.5">
                {search ? "Aucun résultat" : "Aucun document"}
              </h3>
              <p className="text-[12px] text-[var(--text-muted)] font-light leading-relaxed max-w-[200px]">
                {search
                  ? "Essayez avec d'autres mots-clés."
                  : "Ajoutez des documents pour que l'IA puisse s'en servir."}
              </p>
              {!search && (
                <button
                  onClick={() => setShowAddForm(true)}
                  className="mt-4 px-4 py-2 rounded-xl bg-[var(--bg-hover)] hover:text-[var(--text-primary)] text-[var(--text-muted)] border border-[var(--border-glass)] transition-all text-[12px] font-medium"
                >
                  + Ajouter un document
                </button>
              )}
            </div>
          ) : (
            filtered.map((doc, i) => (
              <button
                key={doc.id}
                onClick={() => {
                  if (selectionMode) {
                    toggleSelection(doc.id);
                  } else {
                    setSelectedDoc(doc);
                    setShowAddForm(false);
                  }
                }}
                className={`w-full text-left p-3.5 rounded-xl transition-all group border ${
                  selectedDoc?.id === doc.id && !selectionMode
                    ? "bg-[var(--bg-active)] border-[var(--border-subtle)]"
                    : selectionMode && selectedIds.has(doc.id)
                      ? "bg-[var(--bg-active)] border-[var(--border-glass)]"
                      : "bg-transparent border-transparent hover:bg-[var(--bg-hover)]"
                } relative`}
              >
                <div className="flex items-center gap-3">
                  {selectionMode && (
                    <div className="shrink-0">
                      <span className={`transition-colors ${selectedIds.has(doc.id) ? "text-[var(--text-primary)]" : "text-[var(--text-muted)]"}`}>
                        {selectedIds.has(doc.id) ? <CheckSquare size={16} /> : <Square size={16} />}
                      </span>
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className={`text-[14px] font-medium truncate ${selectedDoc?.id === doc.id && !selectionMode ? "text-[var(--text-primary)]" : "text-[var(--text-primary)]/80 group-hover:text-[var(--text-primary)]"}`}>{doc.title}</p>
                    <p className="text-[11px] text-[var(--text-muted)] mt-0.5 font-light">
                      {doc.word_count || 0} mots
                    </p>
                  </div>
                  {!selectionMode && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(doc.id); }}
                      className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-[var(--text-muted)] hover:text-red-400 transition-all shrink-0"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </button>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-[var(--border-glass)] bg-[var(--bg-sidebar)]">
          {selectionMode && selectedIds.size > 0 ? (
            <button
              onClick={handleBulkDeleteAction}
              disabled={isDeletingBulk}
              className="w-full py-2.5 rounded-xl bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white border border-red-500/20 transition-all text-[12px] font-medium flex items-center justify-center gap-2"
            >
              {isDeletingBulk ? <Zap size={12} className="animate-spin" /> : <Trash2 size={12} />}
              Supprimer ({selectedIds.size})
            </button>
          ) : (
            <p className="text-[11px] text-[var(--text-muted)] font-light text-center">
              {docs.length} document{docs.length !== 1 ? 's' : ''}
            </p>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden bg-[var(--background)] relative">

        {showAddForm ? (
          <div className="flex-1 flex flex-col p-5 md:p-10 overflow-y-auto custom-scrollbar max-w-4xl mx-auto w-full animate-fade-in-up">
            {/* Header */}
            <div className="flex items-center justify-between mb-6 md:mb-10">
              <div>
                <button
                  onClick={() => setShowAddForm(false)}
                  className="flex items-center gap-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors mb-3 md:hidden"
                >
                  <ArrowLeft size={16} />
                  <span className="text-[13px]">Retour</span>
                </button>
                <h2 className="text-xl md:text-2xl font-medium text-[var(--text-primary)] tracking-tight">
                  Ajouter un document
                </h2>
                <p className="text-[13px] md:text-[14px] text-[var(--text-muted)] mt-1 font-light">
                  L&apos;IA utilisera ce contenu pour enrichir ses réponses.
                </p>
              </div>
              <button
                onClick={() => setShowAddForm(false)}
                className="p-2.5 rounded-xl bg-[var(--bg-card)] text-[var(--text-muted)] hover:text-[var(--text-primary)] border border-[var(--border-glass)] transition-all hidden md:flex"
              >
                <X size={18} />
              </button>
            </div>

            {/* Upload zone */}
            <div
              className="p-6 md:p-8 rounded-2xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-card)] flex flex-col items-center justify-center text-center cursor-pointer hover:border-[var(--text-muted)]/30 hover:bg-[var(--bg-hover)] transition-all mb-6 md:mb-8 group"
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="w-12 h-12 rounded-xl bg-[var(--bg-hover)] flex items-center justify-center mb-3 border border-[var(--border-glass)] group-hover:scale-110 transition-transform">
                <Upload size={20} className="text-[var(--text-primary)]" />
              </div>
              <p className="text-[14px] text-[var(--text-primary)] font-medium mb-1">Importer un fichier</p>
              <p className="text-[12px] text-[var(--text-muted)] font-light">PDF, Word, Images, CSV, PowerPoint</p>
              <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".txt,.md,.pdf,.docx,.csv,.json,.jpg,.jpeg,.png,.gif,.webp,.bmp,.pptx" className="hidden" />
            </div>

            {/* Separator */}
            <div className="flex items-center gap-4 mb-6 md:mb-8">
              <div className="flex-1 h-px bg-[var(--border-glass)]" />
              <span className="text-[11px] text-[var(--text-muted)] font-medium uppercase tracking-wider">Ou coller du texte</span>
              <div className="flex-1 h-px bg-[var(--border-glass)]" />
            </div>

            {/* Text form */}
            <div className="space-y-4 md:space-y-5">
              <div>
                <label className="text-[12px] font-medium text-[var(--text-muted)] mb-2 block">Titre</label>
                <input
                  type="text"
                  value={newDoc.title}
                  onChange={(e) => setNewDoc({ ...newDoc, title: e.target.value })}
                  placeholder="Ex : Guide de prospection, FAQ produit..."
                  className="w-full px-4 py-3 rounded-xl bg-[var(--bg-input)] border border-[var(--border-glass)] text-[var(--text-primary)] text-[14px] placeholder-[var(--text-muted)]/50 focus:outline-none focus:border-[var(--border-subtle)] transition-all"
                />
              </div>
              <div>
                <label className="text-[12px] font-medium text-[var(--text-muted)] mb-2 block">Contenu</label>
                <textarea
                  value={newDoc.content}
                  onChange={(e) => setNewDoc({ ...newDoc, content: e.target.value })}
                  placeholder="Collez votre texte ici..."
                  rows={10}
                  className="w-full px-4 py-3 rounded-xl bg-[var(--bg-input)] border border-[var(--border-glass)] text-[var(--text-primary)] text-[14px] placeholder-[var(--text-muted)]/50 focus:outline-none focus:border-[var(--border-subtle)] transition-all resize-y leading-relaxed custom-scrollbar"
                />
              </div>
              <div>
                <label className="text-[12px] font-medium text-[var(--text-muted)] mb-2 block">Source <span className="opacity-50">(optionnel)</span></label>
                <input
                  type="text"
                  value={newDoc.source}
                  onChange={(e) => setNewDoc({ ...newDoc, source: e.target.value })}
                  placeholder="URL ou nom du document original"
                  className="w-full px-4 py-3 rounded-xl bg-[var(--bg-input)] border border-[var(--border-glass)] text-[var(--text-primary)] text-[13px] placeholder-[var(--text-muted)]/50 focus:outline-none focus:border-[var(--border-subtle)] transition-all"
                />
              </div>

              <button
                onClick={handleAdd}
                disabled={addLoading || !newDoc.title.trim() || !newDoc.content.trim()}
                className="w-full py-3.5 rounded-xl bg-[var(--text-primary)] text-[var(--background)] hover:opacity-90 disabled:opacity-30 transition-all text-[14px] font-medium flex items-center justify-center gap-2 active:scale-[0.98] shadow-lg"
              >
                {addLoading ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
                Enregistrer
              </button>
            </div>
          </div>
        ) : selectedDoc ? (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Doc header */}
            <div className="px-5 md:px-10 py-5 md:py-8 border-b border-[var(--border-glass)] flex items-start justify-between">
              <div className="min-w-0 flex-1">
                <button
                  onClick={() => setSelectedDoc(null)}
                  className="flex items-center gap-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors mb-3 md:hidden"
                >
                  <ArrowLeft size={16} />
                  <span className="text-[13px]">Retour</span>
                </button>
                <h2 className="text-xl md:text-2xl font-medium text-[var(--text-primary)] tracking-tight truncate">{selectedDoc.title}</h2>
                <div className="flex items-center gap-3 mt-3 flex-wrap">
                  <span className="text-[11px] font-medium text-[var(--text-muted)] bg-[var(--bg-hover)] px-3 py-1 rounded-full border border-[var(--border-glass)]">{selectedDoc.word_count || 0} mots</span>
                  {selectedDoc.source && (
                    <div className="flex items-center gap-1.5 text-[var(--text-muted)] text-[11px] font-light">
                      <FileText size={12} />
                      <span className="truncate max-w-[200px] md:max-w-[300px]">{selectedDoc.source}</span>
                    </div>
                  )}
                </div>
              </div>
              <button
                onClick={() => setSelectedDoc(null)}
                className="p-2.5 rounded-xl bg-[var(--bg-card)] text-[var(--text-muted)] hover:text-[var(--text-primary)] border border-[var(--border-glass)] transition-all hidden md:flex shrink-0 ml-4"
              >
                <X size={18} />
              </button>
            </div>
            {/* Doc content */}
            <div className="flex-1 overflow-y-auto p-5 md:p-10 custom-scrollbar">
              <div className="max-w-3xl">
                <pre className="text-[14px] md:text-[15px] text-[var(--text-primary)]/90 whitespace-pre-wrap font-light font-sans leading-[1.9] tracking-wide">
                  {selectedDoc.content}
                </pre>
              </div>
            </div>
          </div>
        ) : (
          /* Empty state */
          <div className="flex-1 flex flex-col items-center justify-center gap-6 p-6 md:p-12 select-none">
            <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-[var(--bg-hover)] border border-[var(--border-glass)] flex items-center justify-center">
              <BookOpen size={28} className="text-[var(--text-muted)]" />
            </div>

            <div className="text-center max-w-md px-4">
              <h2 className="text-xl md:text-2xl font-medium text-[var(--text-primary)] mb-3">Vos documents, sa mémoire</h2>
              <p className="text-[var(--text-muted)] text-[14px] leading-relaxed font-light mb-6">
                Importez vos fichiers ou collez du texte.<br />
                L&apos;IA s&apos;en servira pour vous donner des réponses plus précises et personnalisées.
              </p>

              <div className="flex flex-col gap-2.5 text-left max-w-xs mx-auto mb-8">
                <div className="flex items-center gap-3 text-[13px] text-[var(--text-muted)]">
                  <div className="w-6 h-6 rounded-lg bg-[var(--bg-hover)] flex items-center justify-center shrink-0 border border-[var(--border-glass)]">
                    <Upload size={12} className="text-[var(--text-primary)]" />
                  </div>
                  <span className="font-light">Glissez-déposez un fichier</span>
                </div>
                <div className="flex items-center gap-3 text-[13px] text-[var(--text-muted)]">
                  <div className="w-6 h-6 rounded-lg bg-[var(--bg-hover)] flex items-center justify-center shrink-0 border border-[var(--border-glass)]">
                    <FileText size={12} className="text-[var(--text-primary)]" />
                  </div>
                  <span className="font-light">Collez directement du texte</span>
                </div>
                <div className="flex items-center gap-3 text-[13px] text-[var(--text-muted)]">
                  <div className="w-6 h-6 rounded-lg bg-[var(--bg-hover)] flex items-center justify-center shrink-0 border border-[var(--border-glass)]">
                    <BookOpen size={12} className="text-[var(--text-primary)]" />
                  </div>
                  <span className="font-light">Dites &laquo; Retiens ce document &raquo; dans le chat</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowAddForm(true)}
              className="px-6 py-3 rounded-xl bg-[#1B2A4A] hover:bg-[#243556] text-white transition-all text-[14px] font-medium shadow-lg active:scale-[0.98] flex items-center gap-2"
            >
              <Plus size={18} />
              Ajouter un document
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
