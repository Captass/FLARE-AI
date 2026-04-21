"use client";

import { useState, useEffect, useCallback, useRef } from "react";
/* eslint-disable @next/next/no-img-element */
import {
  ArrowUpRight,
  BookOpen,
  Building2,
  Check,
  FileImage,
  FileText,
  FolderOpen,
  Image,
  Loader2,
  Plus,
  ShoppingBag,
  Star,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { uploadKnowledgeFile, getApiBaseUrl } from "@/lib/api";
import { STARTER_CHATBOT_LIBRARY, type ChatbotLibraryItem } from "@/lib/chatbotLibrary";

interface KnowledgeDoc {
  id: string;
  title: string;
  content: string;
  source?: string;
  type?: string;
  word_count?: number;
  file_url?: string;
  created_at?: string;
}

type FileCategory = "catalogue" | "portfolio" | "enterprise";

interface ChatbotFilesPanelProps {
  token: string | null;
}

const API = getApiBaseUrl();

const CATEGORIES: {
  key: FileCategory;
  label: string;
  description: string;
  icon: typeof ShoppingBag;
  tags: string[];
  placeholder: string;
}[] = [
  {
    key: "catalogue",
    label: "Catalogue",
    description: "Produits, services, tarifs et offres",
    icon: ShoppingBag,
    tags: ["catalogue", "catalog", "produit", "service", "tarif", "offre", "prix", "menu"],
    placeholder: "Ajoutez vos produits, services et tarifs pour que le chatbot les utilise",
  },
  {
    key: "portfolio",
    label: "Portfolio & Preuves",
    description: "Realisations, temoignages, certifications",
    icon: Star,
    tags: ["portfolio", "preuve", "proof", "temoignage", "realisation", "certification", "avis", "review", "reference"],
    placeholder: "Ajoutez vos realisations et preuves sociales",
  },
  {
    key: "enterprise",
    label: "Documents entreprise",
    description: "Presentation, FAQ, process internes",
    icon: Building2,
    tags: ["entreprise", "company", "faq", "process", "presentation", "apropos", "about", "equipe", "team", "mission"],
    placeholder: "Ajoutez les informations sur votre entreprise",
  },
];

function buildJsonHeaders(token: string | null): Record<string, string> {
  return token
    ? { "Content-Type": "application/json", Authorization: `Bearer ${token}` }
    : { "Content-Type": "application/json" };
}

function categorizeDoc(doc: KnowledgeDoc): FileCategory {
  const text = `${doc.title} ${doc.source || ""} ${doc.content?.slice(0, 200) || ""}`.toLowerCase();

  for (const cat of CATEGORIES) {
    if (cat.tags.some((tag) => text.includes(tag))) return cat.key;
  }

  if (doc.type === "file" && doc.title?.match(/\.(jpg|jpeg|png|gif|webp|bmp)$/i)) return "catalogue";
  return "enterprise";
}

function isImageFile(title: string): boolean {
  return /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(title);
}

function getFileIcon(title: string): typeof FileText {
  if (isImageFile(title)) return Image;
  if (/\.(pdf|docx?|pptx?)$/i.test(title)) return FileText;
  return FolderOpen;
}

function getLibraryItemIcon(item: ChatbotLibraryItem) {
  if (item.category === "catalogue") return FileImage;
  if (item.category === "portfolio") return Star;
  return BookOpen;
}

function clipKeywords(keywords: string[]): string {
  if (keywords.length === 0) return "";
  return keywords.slice(0, 4).join(" · ");
}

export default function ChatbotFilesPanel({ token }: ChatbotFilesPanelProps) {
  const [docs, setDocs] = useState<KnowledgeDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<FileCategory>("catalogue");
  const [uploading, setUploading] = useState(false);
  const [showAddText, setShowAddText] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [addLoading, setAddLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [importingItemId, setImportingItemId] = useState<string | null>(null);
  const [importingCategory, setImportingCategory] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadDocs = useCallback(async (): Promise<KnowledgeDoc[]> => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/knowledge/`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const payload = await res.json();
      const nextDocs = payload.documents || [];
      setDocs(nextDocs);
      return nextDocs;
    } catch {
      setError("Impossible de charger les fichiers.");
      return [];
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadDocs();
  }, [loadDocs]);

  const categorizedDocs = docs.reduce(
    (acc, doc) => {
      const cat = categorizeDoc(doc);
      acc[cat].push(doc);
      return acc;
    },
    { catalogue: [], portfolio: [], enterprise: [] } as Record<FileCategory, KnowledgeDoc[]>
  );

  const activeDocs = categorizedDocs[activeCategory];
  const activeCatConfig = CATEGORIES.find((c) => c.key === activeCategory)!;
  const EmptyStateIcon = activeCatConfig.icon;
  const selectedDoc = selectedDocId ? docs.find((doc) => doc.id === selectedDocId) || null : null;
  const selectedLibraryItem =
    selectedDoc &&
    STARTER_CHATBOT_LIBRARY.find(
      (item) => item.documentTitle.toLowerCase() === selectedDoc.title.toLowerCase()
    );
  const activeLibraryItems = STARTER_CHATBOT_LIBRARY.filter((item) => item.category === activeCategory);
  const importedTitles = new Set(docs.map((doc) => doc.title.toLowerCase()));
  const pendingLibraryItems = activeLibraryItems.filter(
    (item) => !importedTitles.has(item.documentTitle.toLowerCase())
  );
  const isBusy = uploading || addLoading || importingCategory || importingItemId !== null;

  const createTextDocument = useCallback(
    async (title: string, content: string, source: string) => {
      const res = await fetch(`${API}/knowledge/`, {
        method: "POST",
        headers: buildJsonHeaders(token),
        body: JSON.stringify({ title, content, source, type: "text" }),
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
    },
    [token]
  );

  const importLibraryItem = useCallback(
    async (item: ChatbotLibraryItem) => {
      if (item.importMode === "upload") {
        if (!item.previewUrl) {
          throw new Error("Asset local introuvable.");
        }
        const assetResponse = await fetch(item.previewUrl);
        if (!assetResponse.ok) {
          throw new Error("Asset local introuvable.");
        }
        const blob = await assetResponse.blob();
        const file = new File([blob], item.documentTitle, {
          type: blob.type || "image/jpeg",
        });
        await uploadKnowledgeFile(file, token);
        return;
      }

      await createTextDocument(
        item.documentTitle,
        item.content || item.description,
        `starter-${item.category}`
      );
    },
    [createTextDocument, token]
  );

  const handleFileUpload = async (files: FileList) => {
    if (!files.length) return;
    setUploading(true);
    setError(null);
    try {
      for (let i = 0; i < files.length; i += 1) {
        await uploadKnowledgeFile(files[i], token);
      }
      await loadDocs();
    } catch {
      setError("Erreur lors de l'upload.");
    } finally {
      setUploading(false);
    }
  };

  const handleAddText = async () => {
    if (!newTitle.trim() || !newContent.trim()) return;
    setAddLoading(true);
    setError(null);
    try {
      await createTextDocument(newTitle.trim(), newContent.trim(), `chatbot-${activeCategory}`);
      setNewTitle("");
      setNewContent("");
      setShowAddText(false);
      await loadDocs();
    } catch {
      setError("Erreur lors de l'ajout.");
    } finally {
      setAddLoading(false);
    }
  };

  const handleDelete = async (docId: string) => {
    setError(null);
    try {
      const res = await fetch(`${API}/knowledge/${docId}`, {
        method: "DELETE",
        headers: buildJsonHeaders(token),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      if (selectedDocId === docId) setSelectedDocId(null);
      await loadDocs();
    } catch {
      setError("Erreur lors de la suppression.");
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length) {
      void handleFileUpload(e.dataTransfer.files);
    }
  };

  const handleImportLibraryItem = async (item: ChatbotLibraryItem) => {
    if (!token) {
      setError("Connectez votre compte pour importer la bibliotheque FLARE AI.");
      return;
    }

    setImportingItemId(item.id);
    setError(null);
    try {
      await importLibraryItem(item);
      const nextDocs = await loadDocs();
      const importedDoc = nextDocs.find(
        (doc) => doc.title.toLowerCase() === item.documentTitle.toLowerCase()
      );
      if (importedDoc) {
        setSelectedDocId(importedDoc.id);
      }
      setShowAddText(false);
    } catch {
      setError("Erreur lors de l'import de cet asset.");
    } finally {
      setImportingItemId(null);
    }
  };

  const handleImportCategory = async () => {
    if (!token) {
      setError("Connectez votre compte pour importer la bibliotheque FLARE AI.");
      return;
    }
    if (pendingLibraryItems.length === 0) return;

    setImportingCategory(true);
    setError(null);
    try {
      for (const item of pendingLibraryItems) {
        await importLibraryItem(item);
      }
      const nextDocs = await loadDocs();
      const firstImported = pendingLibraryItems
        .map((item) =>
          nextDocs.find((doc) => doc.title.toLowerCase() === item.documentTitle.toLowerCase())
        )
        .find(Boolean);
      if (firstImported) {
        setSelectedDocId(firstImported.id);
      }
      setShowAddText(false);
    } catch {
      setError("Erreur lors de l'import de la categorie.");
    } finally {
      setImportingCategory(false);
    }
  };

  return (
    <div className="flex flex-1 overflow-hidden">
      <div className="flex w-[300px] shrink-0 flex-col border-r border-white/[0.04]">
        <div className="space-y-1 px-3 py-4">
          {CATEGORIES.map((cat) => {
            const count = categorizedDocs[cat.key].length;
            const Icon = cat.icon;
            const isActive = activeCategory === cat.key;

            return (
              <button
                key={cat.key}
                onClick={() => {
                  setActiveCategory(cat.key);
                  setSelectedDocId(null);
                  setShowAddText(false);
                }}
                className={`w-full rounded-xl px-3 py-2.5 text-left transition-all ${
                  isActive ? "bg-white/[0.06]" : "hover:bg-white/[0.03]"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                      isActive ? "bg-white/[0.08]" : "bg-white/[0.04]"
                    }`}
                  >
                    <Icon size={14} className={isActive ? "text-white/60" : "text-white/25"} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`text-[12px] font-medium ${isActive ? "text-white" : "text-white/40"}`}>
                      {cat.label}
                    </p>
                    <p className="text-[10px] text-white/20">{cat.description}</p>
                  </div>
                  <span className={`text-[10px] ${isActive ? "text-white/40" : "text-white/15"}`}>
                    {count}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        <div className="mx-3 border-t border-white/[0.04]" />

        <div className="flex-1 overflow-y-auto px-3 py-3">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={16} className="animate-spin text-white/20" />
            </div>
          ) : activeDocs.length === 0 ? (
            <div className="py-8 text-center">
              <FolderOpen size={24} className="mx-auto mb-2 text-white/10" />
              <p className="text-[11px] text-white/20">Aucun fichier</p>
              <p className="mt-1 text-[10px] text-white/10">{activeCatConfig.placeholder}</p>
            </div>
          ) : (
            <div className="space-y-1">
              {activeDocs.map((doc) => {
                const Icon = getFileIcon(doc.title);
                const isActive = selectedDocId === doc.id;

                return (
                  <div
                    key={doc.id}
                    className={`group flex items-center gap-2 rounded-xl px-2 py-1.5 transition-all ${
                      isActive ? "bg-white/[0.06]" : "hover:bg-white/[0.03]"
                    }`}
                  >
                    <button
                      onClick={() => {
                        setSelectedDocId(doc.id);
                        setShowAddText(false);
                      }}
                      className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                    >
                      <Icon size={14} className={isActive ? "text-white/50" : "text-white/20"} />
                      <div className="min-w-0 flex-1">
                        <p
                          className={`truncate text-[12px] font-medium ${
                            isActive ? "text-white" : "text-white/40"
                          }`}
                        >
                          {doc.title}
                        </p>
                        {doc.word_count ? (
                          <p className="text-[10px] text-white/15">{doc.word_count} mots</p>
                        ) : null}
                      </div>
                    </button>
                    <button
                      onClick={() => void handleDelete(doc.id)}
                      className="rounded-lg p-1 text-white/15 opacity-0 transition-all hover:text-red-400 group-hover:opacity-100"
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="space-y-2 px-3 pb-3">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={`cursor-pointer rounded-xl border border-dashed px-3 py-3 text-center transition-all ${
              isDragging
                ? "border-white/20 bg-white/[0.04]"
                : "border-white/[0.06] hover:border-white/[0.10] hover:bg-white/[0.02]"
            }`}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.docx,.txt,.md,.csv,.json,.jpg,.jpeg,.png,.gif,.webp,.bmp,.pptx"
              className="hidden"
              onChange={(e) => e.target.files && void handleFileUpload(e.target.files)}
            />
            {uploading ? (
              <Loader2 size={14} className="mx-auto animate-spin text-white/20" />
            ) : (
              <>
                <Upload size={14} className="mx-auto mb-1 text-white/15" />
                <p className="text-[10px] text-white/20">Glissez ou cliquez pour ajouter</p>
                <p className="text-[9px] text-white/10">PDF, Word, Images, CSV, TXT</p>
              </>
            )}
          </div>

          <button
            onClick={() => {
              setShowAddText((value) => !value);
              setSelectedDocId(null);
            }}
            className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-white/[0.04] px-3 py-2 text-[11px] text-white/30 transition-all hover:bg-white/[0.06] hover:text-white/50"
          >
            <Plus size={12} />
            Ajouter un texte
          </button>
        </div>
      </div>

      <div className="flex flex-1 flex-col overflow-hidden">
        {showAddText ? (
          <div className="flex-1 overflow-y-auto px-6 py-6">
            <div className="mx-auto flex w-full max-w-[760px] flex-col gap-4">
              <div className="flex items-center justify-between">
                <h2 className="text-[16px] font-semibold text-white">Ajouter un document</h2>
                <button
                  onClick={() => {
                    setShowAddText(false);
                    setNewTitle("");
                    setNewContent("");
                  }}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-white/20 transition-all hover:bg-white/[0.04] hover:text-white/40"
                >
                  <X size={14} />
                </button>
              </div>

              <div>
                <label className="mb-2 block text-[10px] uppercase tracking-[0.12em] text-white/25">
                  Titre
                </label>
                <input
                  autoFocus
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder={`Ex: ${
                    activeCategory === "catalogue"
                      ? "Tarifs 2026"
                      : activeCategory === "portfolio"
                        ? "Projet client X"
                        : "Presentation entreprise"
                  }`}
                  className="w-full rounded-xl bg-white/[0.04] px-4 py-3 text-[13px] text-white outline-none transition-all placeholder:text-white/15 focus:bg-white/[0.06]"
                />
              </div>

              <div>
                <label className="mb-2 block text-[10px] uppercase tracking-[0.12em] text-white/25">
                  Contenu
                </label>
                <textarea
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  placeholder="Collez le texte ici..."
                  rows={12}
                  className="w-full resize-none rounded-xl bg-white/[0.04] px-4 py-3 text-[13px] text-white outline-none transition-all placeholder:text-white/15 focus:bg-white/[0.06]"
                />
              </div>

              {error ? <p className="text-[12px] text-red-400/70">{error}</p> : null}

              <div className="flex justify-end gap-2">
                <button
                  onClick={() => {
                    setShowAddText(false);
                    setNewTitle("");
                    setNewContent("");
                  }}
                  className="rounded-xl px-4 py-2 text-[12px] text-white/25 transition-all hover:bg-white/[0.03] hover:text-white/40"
                >
                  Annuler
                </button>
                <button
                  onClick={() => void handleAddText()}
                  disabled={!newTitle.trim() || !newContent.trim() || addLoading}
                  className="flex items-center gap-1.5 rounded-xl bg-white px-5 py-2 text-[12px] font-medium text-black transition-all hover:bg-white/90 disabled:opacity-30"
                >
                  {addLoading ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                  Ajouter
                </button>
              </div>
            </div>
          </div>
        ) : selectedDoc ? (
          <div className="flex-1 overflow-y-auto px-6 py-6">
            <div className="mx-auto flex w-full max-w-[760px] flex-col gap-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="mb-2 flex items-center gap-2">
                    <span className="rounded-md bg-white/[0.04] px-2 py-0.5 text-[9px] uppercase tracking-wider text-white/25">
                      {activeCatConfig.label}
                    </span>
                    {selectedDoc.type ? (
                      <span className="text-[9px] text-white/15">{selectedDoc.type}</span>
                    ) : null}
                  </div>
                  <h2 className="text-[18px] font-semibold text-white">{selectedDoc.title}</h2>
                  {selectedDoc.word_count ? (
                    <p className="mt-1 text-[11px] text-white/20">{selectedDoc.word_count} mots</p>
                  ) : null}
                </div>
                <button
                  onClick={() => void handleDelete(selectedDoc.id)}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white/15 transition-all hover:bg-red-500/5 hover:text-red-400"
                >
                  <Trash2 size={14} />
                </button>
              </div>

              {selectedDoc.file_url && isImageFile(selectedDoc.title) ? (
                <div className="overflow-hidden rounded-2xl bg-white/[0.02]">
                  <img
                    src={
                      selectedDoc.file_url.startsWith("http")
                        ? `${API}/files/proxy?url=${encodeURIComponent(selectedDoc.file_url)}`
                        : selectedDoc.file_url
                    }
                    alt={selectedDoc.title}
                    className="max-h-[420px] w-full object-contain"
                  />
                </div>
              ) : null}

              <div className="rounded-2xl bg-white/[0.02] px-5 py-4">
                <p className="whitcompte-pre-wrap text-[13px] leading-relaxed text-white/50">
                  {selectedDoc.content || "Aucun contenu textuel."}
                </p>
              </div>

              {selectedLibraryItem ? (
                <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-white/[0.02] px-4 py-3">
                  <span className="rounded-full border border-white/[0.08] px-2.5 py-1 text-[10px] text-white/30">
                    {selectedLibraryItem.sourceLabel}
                  </span>
                  {selectedLibraryItem.externalUrl ? (
                    <a
                      href={selectedLibraryItem.externalUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 rounded-full bg-white/[0.04] px-2.5 py-1 text-[10px] text-white/35 transition-all hover:bg-white/[0.06] hover:text-white/55"
                    >
                      Ouvrir la reference
                      <ArrowUpRight size={11} />
                    </a>
                  ) : null}
                </div>
              ) : null}

              {selectedDoc.source ? (
                <p className="text-[10px] text-white/15">Source: {selectedDoc.source}</p>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto px-6 py-6">
            <div className="mx-auto flex w-full max-w-[860px] flex-col gap-6">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="max-w-[36rem]">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-white/25">
                    Bibliotheque RAM&apos;S FLARE
                  </p>
                  <h2 className="mt-2 text-[22px] font-semibold tracking-[-0.02em] text-white">
                    Assets deja relies au chatbot
                  </h2>
                  <p className="mt-2 text-[13px] leading-6 text-white/35">
                    Importez rapidement les catalogues, preuves et documents RAM&apos;S FLARE deja
                    exploites dans le direct service. Vous gagnez du temps et gardez une base
                    coherente avec le bot Messenger.
                  </p>
                </div>

                {activeLibraryItems.length > 0 ? (
                  <button
                    onClick={() => void handleImportCategory()}
                    disabled={pendingLibraryItems.length === 0 || isBusy}
                    className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-[11px] font-medium uppercase tracking-[0.12em] text-black transition-all hover:bg-white/90 disabled:opacity-30"
                  >
                    {importingCategory ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : pendingLibraryItems.length === 0 ? (
                      <Check size={12} />
                    ) : (
                      <Upload size={12} />
                    )}
                    {pendingLibraryItems.length === 0
                      ? "Categorie deja importee"
                      : `Importer ${pendingLibraryItems.length} asset${pendingLibraryItems.length > 1 ? "s" : ""}`}
                  </button>
                ) : null}
              </div>

              {error ? (
                <div className="rounded-2xl border border-red-500/15 bg-red-500/6 px-4 py-3 text-[12px] text-red-200/80">
                  {error}
                </div>
              ) : null}

              {activeLibraryItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-[28px] bg-white/[0.02] px-8 py-16 text-center">
                  <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/[0.03]">
                    <EmptyStateIcon size={24} className="text-white/15" />
                  </div>
                  <h3 className="text-[15px] font-medium text-white/30">{activeCatConfig.label}</h3>
                  <p className="mt-1 max-w-sm text-[12px] leading-relaxed text-white/15">
                    {activeCatConfig.placeholder}. Ces fichiers sont utilises par le chatbot pour
                    repondre aux clients.
                  </p>
                </div>
              ) : (
                <div className="grid gap-3 lg:grid-cols-2">
                  {activeLibraryItems.map((item) => {
                    const imported = importedTitles.has(item.documentTitle.toLowerCase());
                    const Icon = getLibraryItemIcon(item);

                    return (
                      <article
                        key={item.id}
                        className="overflow-hidden rounded-[24px] bg-white/[0.02] p-4 transition-all hover:bg-white/[0.03]"
                      >
                        {item.previewUrl ? (
                          <div className="overflow-hidden rounded-2xl bg-white/[0.04]">
                            <img
                              src={item.previewUrl}
                              alt={item.title}
                              className="h-[190px] w-full object-cover"
                            />
                          </div>
                        ) : (
                          <div className="flex h-[190px] items-center justify-center rounded-2xl bg-white/[0.03]">
                            <Icon size={30} className="text-white/18" />
                          </div>
                        )}

                        <div className="mt-4 flex flex-wrap items-center gap-2">
                          <span className="rounded-full border border-white/[0.08] px-2.5 py-1 text-[10px] text-white/28">
                            {item.sourceLabel}
                          </span>
                          {imported ? (
                            <span className="rounded-full bg-emerald-500/12 px-2.5 py-1 text-[10px] text-emerald-300">
                              Deja ajoute
                            </span>
                          ) : null}
                        </div>

                        <h3 className="mt-3 text-[15px] font-semibold text-white">{item.title}</h3>
                        <p className="mt-1 text-[12px] leading-6 text-white/35">{item.description}</p>

                        {item.keywords.length > 0 ? (
                          <p className="mt-3 text-[10px] text-white/18">
                            Mots-cles: {clipKeywords(item.keywords)}
                          </p>
                        ) : null}

                        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                          {item.externalUrl ? (
                            <a
                              href={item.externalUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 rounded-full bg-white/[0.04] px-2.5 py-1 text-[10px] text-white/32 transition-all hover:bg-white/[0.06] hover:text-white/50"
                            >
                              Ouvrir la source
                              <ArrowUpRight size={11} />
                            </a>
                          ) : (
                            <span className="text-[10px] text-white/15">
                              Asset local pret a etre importe
                            </span>
                          )}

                          <button
                            onClick={() => void handleImportLibraryItem(item)}
                            disabled={imported || isBusy}
                            className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.06] px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.12em] text-white/60 transition-all hover:bg-white/[0.08] hover:text-white disabled:opacity-30"
                          >
                            {importingItemId === item.id ? (
                              <Loader2 size={11} className="animate-spin" />
                            ) : imported ? (
                              <Check size={11} />
                            ) : (
                              <Plus size={11} />
                            )}
                            {imported ? "Ajoute" : "Importer"}
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
