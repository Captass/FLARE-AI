"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowUpDown,
  File,
  FileAudio,
  FileSpreadsheet,
  FileText,
  FolderOpen,
  ImageIcon,
  Loader2,
  Search,
  Trash2,
  Video,
  X,
} from "lucide-react";

import type { Artifact } from "@/components/ArtifactViewer";
import { BASE_URL, TrackedFile, deleteTrackedFile, getTrackedFiles, toRenderableMediaUrl } from "@/lib/api";

type PanelKind = TrackedFile["kind"];

interface RemoteFile {
  id: string;
  name?: string | null;
  url?: string | null;
  remote_url?: string | null;
  data_url?: string | null;
  type?: string | null;
  kind?: string | null;
  mime_type?: string | null;
  created_at?: string | null;
  size?: number | null;
  conversation_id?: string | null;
  conversation_title?: string | null;
  source?: string | null;
  ephemeral?: boolean | null;
}

interface PanelFile extends TrackedFile {
  url?: string;
  remoteUrl?: string;
  mimeType?: string;
  source?: string;
  inline?: boolean;
  ephemeral?: boolean;
}

interface FilesPanelProps {
  conversationId?: string | null;
  compact?: boolean;
  onClose?: () => void;
  token?: string | null;
  onOpenArtifact?: (artifact: Artifact) => void;
}

function kindIcon(kind: PanelKind) {
  switch (kind) {
    case "image":
      return <ImageIcon size={16} className="text-[var(--text-primary)]" />;
    case "audio":
      return <FileAudio size={16} className="text-[var(--text-muted)]" />;
    case "video":
      return <Video size={16} className="text-[var(--text-muted)]" />;
    case "document":
      return <FileText size={16} className="text-[var(--text-primary)]" />;
    case "sheet":
    case "spreadsheet":
      return <FileSpreadsheet size={16} className="text-[#107C41]" />;
    default:
      return <File size={16} className="text-[var(--text-muted)]" />;
  }
}

function kindLabel(kind: PanelKind) {
  switch (kind) {
    case "image":
      return "Images";
    case "audio":
      return "Audio";
    case "video":
      return "Videos";
    case "document":
      return "Documents";
    case "sheet":
    case "spreadsheet":
      return "Tableurs";
    default:
      return "Autres";
  }
}

function inferKind(file: RemoteFile): PanelKind {
  const explicitKind = (file.kind || "").toLowerCase();
  if (explicitKind === "image") return "image";
  if (explicitKind === "video") return "video";
  if (explicitKind === "audio") return "audio";
  if (explicitKind === "sheet" || explicitKind === "spreadsheet") return "sheet";
  if (explicitKind === "document") return "document";

  const combinedType = `${file.type || ""} ${file.mime_type || ""}`.toLowerCase();
  const lowerName = (file.name || "").toLowerCase();

  if (combinedType.startsWith("image/") || /\.(png|jpg|jpeg|webp|gif)$/i.test(lowerName)) {
    return "image";
  }
  if (combinedType.startsWith("video/") || /\.(mp4|mov|webm|mkv)$/i.test(lowerName)) {
    return "video";
  }
  if (combinedType.startsWith("audio/") || /\.(mp3|wav|ogg|m4a)$/i.test(lowerName)) {
    return "audio";
  }
  if (combinedType.includes("spreadsheet") || combinedType.includes("excel") || /\.(xlsx|xls|csv)$/i.test(lowerName)) {
    return "sheet";
  }
  return "document";
}

function formatDate(iso?: string | null) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";

  const now = new Date();
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (diff < 60) return "A l'instant";
  if (diff < 3600) return `Il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  if (diff < 172800) return `Hier ${date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`;
  return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

function formatSize(size?: number | null) {
  if (!size || size <= 0) return "";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function mapRemoteFile(file: RemoteFile, defaultConversationId?: string | null): PanelFile {
  const sourceUrl = file.remote_url || file.url || undefined;
  const previewUrl = file.data_url || toRenderableMediaUrl(sourceUrl) || sourceUrl;
  const resolvedUrl = sourceUrl || file.data_url || undefined;
  return {
    id: file.id,
    name: file.name || "Fichier",
    kind: inferKind(file),
    timestamp: file.created_at || new Date().toISOString(),
    conversationId: file.conversation_id || defaultConversationId || "",
    conversationTitle: file.conversation_title || "",
    dataUrl: previewUrl,
    url: resolvedUrl,
    remoteUrl: sourceUrl,
    isRemote: true,
    size: file.size || undefined,
    mimeType: file.mime_type || file.type || undefined,
    source: file.source || undefined,
    inline: Boolean(file.data_url) && !file.remote_url,
    ephemeral: Boolean(file.ephemeral),
  };
}

function dedupeFiles(files: PanelFile[]) {
  const merged = new Map<string, PanelFile>();
  for (const file of files) {
    const identity = file.remoteUrl || file.url || file.dataUrl || `${file.conversationId}::${file.name}::${file.timestamp}`;
    const existing = merged.get(identity);
    if (!existing) {
      merged.set(identity, file);
      continue;
    }
    if (file.isRemote && !existing.isRemote) {
      merged.set(identity, { ...existing, ...file });
      continue;
    }
    if (!existing.url && file.url) existing.url = file.url;
    if (!existing.dataUrl && file.dataUrl) existing.dataUrl = file.dataUrl;
    if (!existing.remoteUrl && file.remoteUrl) existing.remoteUrl = file.remoteUrl;
    if (!existing.size && file.size) existing.size = file.size;
    if (!existing.conversationTitle && file.conversationTitle) existing.conversationTitle = file.conversationTitle;
  }
  return Array.from(merged.values());
}

export default function FilesPanel({ conversationId, compact, onClose, token, onOpenArtifact }: FilesPanelProps) {
  const [localFiles, setLocalFiles] = useState<TrackedFile[]>([]);
  const [remoteFiles, setRemoteFiles] = useState<RemoteFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState({ key: "timestamp", asc: false });
  const [preview, setPreview] = useState<PanelFile | null>(null);

  const load = useCallback(async () => {
    const allLocal = getTrackedFiles();
    const filteredLocal = conversationId ? allLocal.filter((file) => file.conversationId === conversationId) : allLocal;
    setLocalFiles(filteredLocal);

    if (typeof window === "undefined") return;

    setLoading(true);
    try {
      const authToken = token || localStorage.getItem("flare_auth_token");
      const endpoint = conversationId
        ? `${BASE_URL}/files/${conversationId}?t=${Date.now()}`
        : `${BASE_URL}/files/all/user?t=${Date.now()}`;
      const response = await fetch(endpoint, {
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
        cache: "no-store",
      });
      if (response.ok) {
        const data = await response.json();
        setRemoteFiles(Array.isArray(data.files) ? data.files : []);
      }
    } catch (error) {
      console.error("Erreur chargement fichiers:", error);
    } finally {
      setLoading(false);
    }
  }, [conversationId, token]);

  useEffect(() => {
    load();
    const handleRefresh = () => load();
    window.addEventListener("refresh-files", handleRefresh);
    return () => window.removeEventListener("refresh-files", handleRefresh);
  }, [load]);

  const handleDelete = async (id: string, isRemote: boolean = false, fileName?: string) => {
    if (isRemote && conversationId && fileName) {
      try {
        const authToken = token || localStorage.getItem("flare_auth_token");
        await fetch(`${BASE_URL}/files/${conversationId}/${fileName}`, {
          method: "DELETE",
          headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
        });
        setRemoteFiles((prev) => prev.filter((file) => file.name !== fileName));
      } catch (error) {
        console.error("Erreur suppression:", error);
      }
    } else {
      deleteTrackedFile(id);
      setLocalFiles((prev) => prev.filter((file) => file.id !== id));
    }
    if (preview?.id === id) setPreview(null);
  };

  const processedFiles = useMemo(() => {
    const mappedRemote = remoteFiles.map((file) => mapRemoteFile(file, conversationId));
    const combined = dedupeFiles([...(mappedRemote as PanelFile[]), ...(localFiles as PanelFile[])]);

    const filtered = search.trim()
      ? combined.filter((file) => file.name.toLowerCase().includes(search.toLowerCase()))
      : combined;

    return filtered.sort((a, b) => {
      let valueA: number | string;
      let valueB: number | string;
      if (sort.key === "name") {
        valueA = a.name.toLowerCase();
        valueB = b.name.toLowerCase();
      } else {
        valueA = new Date(a.timestamp).getTime();
        valueB = new Date(b.timestamp).getTime();
      }
      if (valueA < valueB) return sort.asc ? -1 : 1;
      if (valueA > valueB) return sort.asc ? 1 : -1;
      return 0;
    });
  }, [conversationId, localFiles, remoteFiles, search, sort]);

  const groupedFiles = useMemo(() => {
    return processedFiles.reduce((acc, file) => {
      const group = kindLabel(file.kind);
      if (!acc[group]) acc[group] = [];
      acc[group].push(file);
      return acc;
    }, {} as Record<string, PanelFile[]>);
  }, [processedFiles]);

  const openFile = (file: PanelFile) => {
    const targetUrl = file.url || file.remoteUrl || file.dataUrl;
    const previewUrl = file.dataUrl || toRenderableMediaUrl(file.remoteUrl || file.url) || targetUrl;
    if (!targetUrl) return;

    if (file.kind === "image" || file.kind === "video") {
      if (onOpenArtifact) {
        onOpenArtifact({
          url: targetUrl,
          type: file.kind === "video" ? "video" : "image",
          name: file.name,
          data: previewUrl,
        });
      } else {
        setPreview(file);
      }
      return;
    }

    if (onOpenArtifact && (file.kind === "document" || file.kind === "sheet")) {
      onOpenArtifact({
        url: targetUrl,
        type: file.kind === "sheet" ? "sheet" : "document",
        name: file.name,
        data: previewUrl,
      });
      return;
    }

    window.open(targetUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <div className={`flex flex-col h-full bg-[var(--background)] transition-colors ${compact ? "" : "rounded-2xl border border-[var(--border-glass)] overflow-hidden"}`}>
      <div className="flex items-center justify-between px-4 md:px-5 py-3.5 border-b border-[var(--border-glass)] bg-[var(--bg-sidebar)]">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-[var(--bg-hover)] flex items-center justify-center border border-[var(--border-glass)]">
            <FolderOpen size={14} className="text-[var(--text-primary)]" />
          </div>
          <div>
            <h2 className="text-[13px] font-medium text-[var(--text-primary)]">
              {conversationId ? "Fichiers de la conversation" : "Mes fichiers"}
            </h2>
            <p className="text-[10px] text-[var(--text-muted)] mt-0.5">
              {processedFiles.length} fichier{processedFiles.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
        {onClose && (
          <button onClick={onClose} className="p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-all">
            <X size={16} />
          </button>
        )}
      </div>

      <div className="px-4 md:px-5 py-3 border-b border-[var(--border-glass)] flex items-center gap-2">
        <div className="relative flex-1">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Rechercher..."
            className="w-full pl-8 pr-3 py-2 rounded-lg bg-[var(--bg-input)] border border-[var(--border-glass)] text-[var(--text-primary)] text-[12px] outline-none focus:border-[var(--border-subtle)] transition-all placeholder-[var(--text-muted)]/50"
          />
        </div>
        <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-[var(--bg-input)] border border-[var(--border-glass)]">
          <button
            onClick={() => setSort({ key: "timestamp", asc: false })}
            className={`px-2.5 py-1.5 rounded-md text-[11px] font-medium transition-all ${sort.key === "timestamp" ? "bg-[var(--bg-active)] text-[var(--text-primary)] border border-[var(--border-subtle)]" : "text-[var(--text-muted)] hover:text-[var(--text-primary)] border border-transparent"}`}
          >
            Date
          </button>
          <button
            onClick={() => setSort({ key: "name", asc: true })}
            className={`px-2.5 py-1.5 rounded-md text-[11px] font-medium transition-all ${sort.key === "name" ? "bg-[var(--bg-active)] text-[var(--text-primary)] border border-[var(--border-subtle)]" : "text-[var(--text-muted)] hover:text-[var(--text-primary)] border border-transparent"}`}
          >
            Nom
          </button>
        </div>
        <button
          onClick={() => setSort({ ...sort, asc: !sort.asc })}
          className="p-2 rounded-lg bg-[var(--bg-input)] border border-[var(--border-glass)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-all"
        >
          <ArrowUpDown size={13} className={`transition-transform ${sort.asc ? "" : "rotate-180"}`} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-5 space-y-5">
        {loading && processedFiles.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 size={22} className="animate-spin text-[var(--text-muted)] mb-2" />
            <p className="text-[12px] text-[var(--text-muted)] font-light">Chargement...</p>
          </div>
        )}

        {Object.entries(groupedFiles).map(([group, files]) => (
          <div key={group} className="space-y-2">
            <h3 className="text-[11px] font-medium text-[var(--text-muted)] uppercase tracking-wider px-1">{group}</h3>
            <div className={compact ? "space-y-1.5" : "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5"}>
              {files.map((file) => {
                const canOpen = Boolean(file.dataUrl || file.url);
                const canDelete = !file.isRemote || Boolean(conversationId && file.name);
                const sizeLabel = formatSize(file.size);
                const dateLabel = formatDate(file.timestamp);
                const stateLabel = file.ephemeral ? "Temporaire" : file.isRemote ? "Sauvegarde" : "Local";
                return (
                  <div
                    key={file.id}
                    onClick={() => canOpen && openFile(file)}
                    className={`group relative flex items-center gap-3 p-3 rounded-xl bg-[var(--bg-card)] border border-[var(--border-glass)] transition-all ${canOpen ? "cursor-pointer hover:border-[var(--border-subtle)] hover:bg-[var(--bg-hover)]" : ""}`}
                  >
                    {file.kind === "image" && file.dataUrl ? (
                      <div className="w-9 h-9 rounded-lg overflow-hidden border border-[var(--border-glass)] shrink-0">
                        <img src={file.dataUrl} alt={file.name} className="w-full h-full object-cover" />
                      </div>
                    ) : file.kind === "video" ? (
                      <div className="w-9 h-9 rounded-lg bg-[linear-gradient(135deg,rgba(59,130,246,0.24),rgba(15,23,42,0.9))] flex items-center justify-center shrink-0 border border-blue-500/20">
                        <Video size={16} className="text-blue-300" />
                      </div>
                    ) : (
                      <div className="w-9 h-9 rounded-lg bg-[var(--bg-hover)] flex items-center justify-center shrink-0 border border-[var(--border-glass)]">
                        {kindIcon(file.kind)}
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      <p className={`text-[13px] font-medium truncate ${canOpen ? "text-[var(--text-primary)] hover:text-[var(--text-muted)]" : "text-[var(--text-primary)]"}`}>
                        {file.name}
                      </p>
                      <p className="text-[10px] text-[var(--text-muted)] mt-0.5 font-light truncate">
                        {[sizeLabel, dateLabel].filter(Boolean).join(" • ") || "Fichier disponible"}
                      </p>
                      <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                        <span className={`px-1.5 py-0.5 rounded-full border text-[9px] font-medium ${file.ephemeral ? "border-amber-500/30 bg-amber-500/10 text-amber-300" : "border-[var(--border-glass)] bg-[var(--bg-hover)] text-[var(--text-muted)]"}`}>
                          {stateLabel}
                        </span>
                        {file.inline && (
                          <span className="px-1.5 py-0.5 rounded-full border border-[var(--border-glass)] bg-[var(--bg-hover)] text-[9px] font-medium text-[var(--text-muted)]">
                            Chat
                          </span>
                        )}
                        {!conversationId && file.source && (
                          <span className="px-1.5 py-0.5 rounded-full border border-[var(--border-glass)] bg-[var(--bg-hover)] text-[9px] font-medium text-[var(--text-muted)]">
                            {file.source}
                          </span>
                        )}
                      </div>
                      {!conversationId && file.conversationTitle && (
                        <p className="text-[10px] text-[var(--text-muted)]/80 mt-0.5 truncate">
                          {file.conversationTitle}
                        </p>
                      )}
                    </div>

                    {canDelete && (
                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          handleDelete(file.id, file.isRemote, file.name);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-[var(--text-muted)] hover:text-red-400 transition-all shrink-0"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {processedFiles.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-14 h-14 rounded-2xl bg-[var(--bg-hover)] flex items-center justify-center mb-4 border border-[var(--border-glass)]">
              <FolderOpen size={24} className="text-[var(--text-muted)]" strokeWidth={1.5} />
            </div>
            <p className="text-[14px] text-[var(--text-primary)] font-medium mb-1">Aucun fichier</p>
            <p className="text-[12px] text-[var(--text-muted)] font-light max-w-[220px] leading-relaxed">
              Les images, documents, tableurs et medias generes apparaitront ici.
            </p>
          </div>
        )}
      </div>

      {preview && (preview.dataUrl || preview.url) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md animate-fade-in" onClick={() => setPreview(null)}>
          <div className="relative max-w-[90vw] max-h-[85vh] rounded-2xl overflow-hidden shadow-2xl border border-white/10" onClick={(event) => event.stopPropagation()}>
            {preview.kind === "video" ? (
              <video
                src={preview.dataUrl || preview.url}
                controls
                playsInline
                preload="metadata"
                className="max-h-[80vh] max-w-[90vw] bg-black object-contain"
              />
            ) : (
              <img src={preview.dataUrl || preview.url} alt={preview.name} className="max-h-[80vh] object-contain" />
            )}
            <div className="px-5 py-3 bg-black/80 backdrop-blur-xl border-t border-white/5 flex items-center justify-between">
              <p className="text-white font-medium text-[13px] truncate">{preview.name}</p>
              <button onClick={() => setPreview(null)} className="p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-all">
                <X size={16} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
