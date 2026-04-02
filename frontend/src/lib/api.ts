/**
 * Client API typé pour FLARE AI Backend.
 * Toutes les requêtes vers le backend FLARE AI
 */

const PRODUCTION_BACKEND_URL = "https://flare-backend-236458687422.europe-west1.run.app";
const PROD_FRONTEND_HOSTS = new Set([
  "flareai.ramsflare.com",
  "www.flareai.ramsflare.com",
  "ramsflare.web.app",
  "ramsflare.firebaseapp.com",
  "rams-flare.web.app",
  "rams-flare.firebaseapp.com",
  "rams-flare-ai.web.app",
  "rams-flare-ai.firebaseapp.com",
]);

export function getApiBaseUrl(): string {
  const configuredUrl = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (configuredUrl) {
    return configuredUrl.replace(/\/+$/, "");
  }

  if (typeof window !== "undefined") {
    const { hostname, protocol } = window.location;

    if (PROD_FRONTEND_HOSTS.has(hostname)) {
      return PRODUCTION_BACKEND_URL;
    }

    if (hostname === "localhost" || hostname === "127.0.0.1") {
      return "http://localhost:8000";
    }

    return `${protocol}//${hostname}:8000`;
  }

  return PRODUCTION_BACKEND_URL;
}

export const BASE_URL = getApiBaseUrl();

export function toRenderableMediaUrl(url?: string | null): string | undefined {
  const value = String(url || "").trim();
  if (!value) return undefined;
  if (value.startsWith("data:") || value.startsWith("blob:")) return value;
  if (
    value.includes("storage.googleapis.com") ||
    value.includes("firebasestorage.googleapis.com")
  ) {
    return `${BASE_URL}/files/proxy?url=${encodeURIComponent(value)}`;
  }
  return value;
}

export function trackClientEvent(type: string, detail: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;
  try {
    const payload = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type,
      detail,
      timestamp: new Date().toISOString(),
      path: window.location.pathname,
    };
    const raw = localStorage.getItem("flare_client_events");
    const events = raw ? JSON.parse(raw) : [];
    const next = [payload, ...events].slice(0, 80);
    localStorage.setItem("flare_client_events", JSON.stringify(next));
    window.dispatchEvent(new CustomEvent("flare-client-event", { detail: payload }));
  } catch (error) {
    console.warn("Failed to track client event", error);
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FileAttachment {
  content: string;    // base64 (images) ou texte brut
  type: string;       // MIME type : "image/png", "text/plain", etc.
  name: string;
  dataUrl?: string;   // URL data: pour prévisualisation côté client
}

export interface MessageAttachment {
  kind: "image" | "file" | "audio" | "video" | "document" | "sheet" | "spreadsheet";
  name: string;
  dataUrl?: string;   // Pour afficher l'image ou audio dans la bulle
  url?: string;       // URL Firebase Storage (persistance après rechargement)
  duration?: number;  // Durée audio en secondes
  type?: string;
}

export interface Message {
  id?: string | number;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp?: string;
  attachment?: MessageAttachment;
  knowledgeSaved?: string[];  // Titres des docs sauvegardés dans ce message
  sources?: SourceInfo[];     // Sources web citées dans la réponse
  thoughts?: string[];        // Étapes de raisonnement (pensées intermédiaires)
  responseTime?: number;      // Temps de réponse en secondes
  suggestions?: string[];      // Suggestions d'actions de suivi
}

export interface Conversation {
  id: string;
  title: string;
  platform: string;
  status: string;
  created_at: string;
  updated_at: string;
  message_count: number;
  folder_id?: string; // Ajout pour les dossiers
}

export interface Folder {
  id: string;
  name: string;
  color?: string;
  created_at?: string;
  conversationIds?: string[];
}

export interface ChatResponse {
  response: string;
  session_id: string;
  images?: { prompt: string; type: string; data: string }[];
  knowledge_saved?: string[];  // Titres des docs sauvegardés/mis à jour par l'agent
  suggestions?: string[];
}

export type ChatMode = "raisonnement" | "rapide";

export interface AgentStatus {
  agent: string;
  statut: string;
  meta_configured?: boolean;
}

export interface Campaign {
  id: string;
  sector: string;
  city: string;
  status: string;
  leads_found: number;
  emails_sent: number;
  responses: number;
  created_at: string;
  completed_at?: string;
}

export interface MemoryFact {
  id: number;
  key: string;
  value: string;
  category: string;
  created_at?: string | null;
  updated_at: string;
}

// ─── Helper ───────────────────────────────────────────────────────────────────

async function apiRequest<T>(
  endpoint: string,
  options?: RequestInit,
  authToken?: string | null
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((options?.headers as Record<string, string>) || {}),
  };

  if (authToken) {
    headers["Authorization"] = `Bearer ${authToken}`;
  }

  const url = `${getApiBaseUrl()}${endpoint}`;
  const method = (options?.method || "GET").toUpperCase();
  const shouldRetry = method === "GET";
  const timeoutMs = shouldRetry ? 10000 : 30000;
  const attempts = shouldRetry ? 2 : 1;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < attempts; attempt++) {
    const controller = options?.signal ? null : new AbortController();
    const timeout = setTimeout(() => controller?.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        signal: options?.signal ?? controller?.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || "Erreur réseau.");
      }

      if (response.status === 204) return undefined as T;
      try {
        return await response.json();
      } catch {
        return undefined as T;
      }
    } catch (error) {
      clearTimeout(timeout);
      lastError = error instanceof Error ? error : new Error(String(error));
      const aborted = lastError.name === "AbortError";

      if (!shouldRetry || attempt === attempts - 1 || aborted) {
        break;
      }
    }
  }

  throw lastError ?? new Error("Erreur réseau.");
}

/**
 * Health Check du backend
 */
export async function healthCheck(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    // mode:'no-cors' avoids CORS preflight — opaque response means server is up,
    // only a real network failure throws an exception.
    await fetch(`${getApiBaseUrl()}/health`, {
      signal: controller.signal,
      mode: "no-cors",
    });
    clearTimeout(timeout);
    return true;
  } catch (e) {
    return false;
  }
}

// ─── Chat API ─────────────────────────────────────────────────────────────────

export async function sendMessage(
  message: string,
  sessionId?: string,
  attachment?: FileAttachment,
  signal?: AbortSignal,
  authToken?: string | null,
  deepResearch: boolean = false,
  quality: string = "HD",
  chatMode: ChatMode = "raisonnement"
): Promise<ChatResponse> {
  return apiRequest<ChatResponse>("/chat", {
    method: "POST",
    body: JSON.stringify({
      message,
      session_id: sessionId,
      file_content: attachment?.content,
      file_type: attachment?.type,
      file_name: attachment?.name,
      deep_research: deepResearch,
      quality: quality,
      chat_mode: chatMode,
    }),
    signal,
  }, authToken);
}

export interface SourceInfo {
  url: string;
  domain: string;
  title: string;
}

export type StreamEvent =
  | { type: "thought"; content: string }
  | { type: "delta"; content: string }
  | { type: "final"; response: string; images: any[]; sources?: SourceInfo[]; knowledge_saved: string[]; session_id: string; response_time?: number; suggestions?: string[] }
  | { type: "error"; content: string };

export async function* sendMessageStream(
  message: string,
  sessionId?: string,
  attachment?: FileAttachment,
  signal?: AbortSignal,
  authToken?: string | null,
  deepResearch: boolean = false,
  quality: string = "HD",
  chatMode: ChatMode = "raisonnement"
): AsyncGenerator<StreamEvent> {
  const response = await fetch(`${getApiBaseUrl()}/chat/stream`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(authToken ? { "Authorization": `Bearer ${authToken}` } : {}),
    },
    body: JSON.stringify({
      message,
      session_id: sessionId,
      file_content: attachment?.content,
      file_type: attachment?.type,
      file_name: attachment?.name,
      deep_research: deepResearch,
      quality: quality,
      chat_mode: chatMode,
    }),
    signal,
  });

  if (!response.ok) {
    const errorBody = await response.text();
    yield { type: "error", content: errorBody || response.statusText };
    return;
  }

  const reader = response.body?.getReader();
  if (!reader) {
    yield { type: "error", content: "No response body" };
    return;
  }

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        try {
          const data = JSON.parse(line.slice(6));
          if (data.type === "keepalive") continue; // Heartbeat SSE, ignorer
          yield data as StreamEvent;
        } catch (e) {
          console.error("Error parsing SSE line:", e);
        }
      }
    }
  }
}

export interface ContentStudioVideoJobResponse {
  job_id: string;
}

export interface ContentStudioVideoJobStatus {
  job_id: string;
  status: "processing" | "completed" | "failed";
  result?: {
    video_url?: string;
    status?: string;
  } | null;
  error?: string | null;
}

export async function submitContentStudioVideoEdit(payload: {
  project_id: string;
  source_videos: string[];
  instructions: string;
  target_resolution: string;
  export_quality?: "preview" | "standard" | "high" | "master";
  fps?: 24 | 30 | 60;
  output_format?: "mp4" | "mov";
}): Promise<ContentStudioVideoJobResponse> {
  return apiRequest<ContentStudioVideoJobResponse>("/api/content-studio/video/edit", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getContentStudioVideoJobStatus(jobId: string): Promise<ContentStudioVideoJobStatus> {
  return apiRequest<ContentStudioVideoJobStatus>(`/api/content-studio/video/status/${jobId}`);
}

export interface ContentStudioVisualResponse {
  image_url: string;
  layers?: Array<Record<string, unknown>>;
}

export async function generateContentStudioVisual(payload: {
  project_id: string;
  format: string;
  brief: string;
}): Promise<ContentStudioVisualResponse> {
  return apiRequest<ContentStudioVisualResponse>("/api/content-studio/generate/visual", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function listConversations(authToken?: string | null): Promise<Conversation[]> {
  return apiRequest<Conversation[]>("/chat/conversations", {}, authToken);
}

export async function getMessages(conversationId: string, authToken?: string | null): Promise<Message[]> {
  const msgs = await apiRequest<Message[]>(`/chat/conversations/${conversationId}/messages`, {}, authToken);
  return (msgs || []).map(m => {
    if (m.attachment) {
      const att = m.attachment as any;
      const attachmentName = String(att.name || "").toLowerCase();
      const attachmentType = String(att.type || "").toLowerCase();

      if (!att.kind || att.kind === "file") {
        if (attachmentType.startsWith("video/") || /\.(mp4|mov|webm|mkv)$/i.test(attachmentName)) {
          m.attachment.kind = "video";
        } else if (attachmentType.startsWith("audio/") || /\.(mp3|wav|ogg|m4a)$/i.test(attachmentName)) {
          m.attachment.kind = "audio";
        } else if (attachmentType.startsWith("image/") || /\.(png|jpe?g|webp|gif)$/i.test(attachmentName)) {
          m.attachment.kind = "image";
        } else if (attachmentType.includes("spreadsheet") || attachmentType.includes("excel") || /\.(xlsx|xls|csv)$/i.test(attachmentName)) {
          m.attachment.kind = "sheet";
        } else if (attachmentType.includes("wordprocessingml") || /\.(docx|doc|pdf|txt|md)$/i.test(attachmentName)) {
          m.attachment.kind = "document";
        }
      }

      // Reconstituer les URLs pour l'affichage (images ET vidéos)
      if (att.url) {
        m.attachment.url = att.url;
        // Si pas de dataUrl mais on a une URL distante, utiliser une URL d'aperçu fiable
        if (!m.attachment.dataUrl) {
          m.attachment.dataUrl = toRenderableMediaUrl(att.url);
        }
      }
      if (att.data && att.type) {
        if (attachmentType.startsWith("video/")) {
          try {
            const binary = atob(att.data);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i += 1) {
              bytes[i] = binary.charCodeAt(i);
            }
            m.attachment.dataUrl = URL.createObjectURL(new Blob([bytes], { type: att.type }));
          } catch {
            m.attachment.dataUrl = `data:${att.type};base64,${att.data}`;
          }
        } else {
          m.attachment.dataUrl = `data:${att.type};base64,${att.data}`;
        }
      }
      if (att.type && !m.attachment.type) {
        m.attachment.type = att.type;
      }
    }
    return m;
  });
}

export async function renameConversation(id: string, title: string, folder_id?: string | null, authToken?: string | null): Promise<void> {
  await apiRequest(`/chat/conversations/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ title, folder_id }),
  }, authToken);
}

export async function archiveConversation(id: string, authToken?: string | null): Promise<void> {
  await apiRequest(`/chat/conversations/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ status: "archived" }),
  }, authToken);
}

export async function deleteConversation(id: string, authToken?: string | null): Promise<void> {
  await apiRequest(`/chat/conversations/${id}`, {
    method: "DELETE",
  }, authToken);
}

export async function deleteMessagesAfter(conversationId: string, timestamp: string, authToken?: string | null): Promise<{success: boolean, deleted_count: number}> {
  return apiRequest<{success: boolean, deleted_count: number}>(
    `/chat/conversations/${conversationId}/messages/after/${encodeURIComponent(timestamp)}`,
    {
      method: "DELETE",
    }, authToken
  );
}

// ─── Folders API ──────────────────────────────────────────────────────────────

export async function getFolders(authToken?: string | null): Promise<Folder[]> {
  return apiRequest<Folder[]>("/folders", {}, authToken);
}

export async function createFolder(name: string, color?: string, authToken?: string | null): Promise<Folder> {
  return apiRequest<Folder>("/folders", {
    method: "POST",
    body: JSON.stringify({ name, color }),
  }, authToken);
}

export async function updateFolder(id: string, name?: string, color?: string, authToken?: string | null): Promise<Folder> {
  return apiRequest<Folder>(`/folders/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ name, color }),
  }, authToken);
}

export async function deleteFolder(id: string, authToken?: string | null): Promise<void> {
  await apiRequest(`/folders/${id}`, {
    method: "DELETE",
  }, authToken);
}

// ─── Files API ──────────────────────────────────────────────────────────────

export interface ChatFile {
  id: string;
  name: string;
  type: string;
  kind?: "image" | "audio" | "video" | "document" | "sheet" | "spreadsheet" | "upload";
  mime_type?: string;
  dataUrl?: string;
  data_url?: string;
  url?: string;
  remote_url?: string;
  generated?: boolean;
  timestamp?: string;
  created_at?: string;
}

export async function getConversationFiles(conversationId: string, authToken?: string | null): Promise<{files: ChatFile[], count: number}> {
  return apiRequest<{files: ChatFile[], count: number}>(`/files/${conversationId}`, {}, authToken);
}

export async function getAllUserFiles(authToken?: string | null): Promise<{files: (ChatFile & { conversation_id?: string; conversation_title?: string })[], count: number}> {
  return apiRequest<{files: (ChatFile & { conversation_id?: string; conversation_title?: string })[], count: number}>(`/files/all/user`, {}, authToken);
}

export async function deleteConversationFile(conversationId: string, fileId: string, authToken?: string | null): Promise<void> {
  await apiRequest(`/files/${conversationId}/${fileId}`, {
    method: "DELETE",
  }, authToken);
}

// ─── Knowledge API ────────────────────────────────────────────────────────────

export interface KnowledgeDoc {
  id: string;
  title: string;
  content: string;
  source?: string;
  type?: string;
  word_count?: number;
  created_at?: string;
}

export async function listKnowledge(authToken?: string | null): Promise<KnowledgeDoc[]> {
  const response = await apiRequest<{ documents?: KnowledgeDoc[] }>("/knowledge/", {}, authToken);
  return response.documents || [];
}

export async function deleteKnowledge(docId: string, authToken?: string | null): Promise<void> {
  await apiRequest(`/knowledge/${encodeURIComponent(docId)}`, {
    method: "DELETE",
  }, authToken);
}

export async function refreshKnowledge(authToken?: string | null): Promise<{ status: string; count: number }> {
    return apiRequest<{ status: string; count: number }>("/knowledge/refresh", { method: "POST" }, authToken);
}

export async function updateKnowledgeDoc(
  docId: string,
  additionalContent: string,
  append = true,
  authToken?: string | null,
): Promise<{ id: string; status: string }> {
  return apiRequest<{ id: string; status: string }>(`/knowledge/${encodeURIComponent(docId)}`, {
    method: "PATCH",
    body: JSON.stringify({ additional_content: additionalContent, append }),
  }, authToken);
}

export async function uploadKnowledgeFile(file: File, authToken?: string | null): Promise<any> {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch(`${getApiBaseUrl()}/knowledge/upload`, {
        method: "POST",
        headers: authToken ? { "Authorization": `Bearer ${authToken}` } : {},
        body: formData,
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Upload Error ${response.status}: ${error}`);
    }

    return response.json();
}

// ─── Memory API ───────────────────────────────────────────────────────────────

export async function getFacts(category?: string, authToken?: string | null): Promise<MemoryFact[]> {
  const qs = category ? `?category=${encodeURIComponent(category)}` : "";
  return apiRequest<MemoryFact[]>(`/memory/facts${qs}`, {}, authToken);
}

export async function addFact(key: string, value: string, category: string, authToken?: string | null): Promise<MemoryFact> {
  return apiRequest<MemoryFact>("/memory/facts", {
    method: "POST",
    body: JSON.stringify({ key, value, category }),
  }, authToken);
}

export async function deleteFact(key: string, authToken?: string | null): Promise<void> {
  await apiRequest(`/memory/facts/${encodeURIComponent(key)}`, { method: "DELETE" }, authToken);
}

// ─── Agents API ───────────────────────────────────────────────────────────────

export async function getCMStatus(authToken?: string | null): Promise<AgentStatus> {
  return apiRequest<AgentStatus>("/agents/cm/status", {}, authToken);
}

export async function launchCampaign(params: {
  sector: string;
  city?: string;
  target_count?: number;
  email_subject?: string;
}, authToken?: string | null): Promise<{ campaign_id: string; status: string; message: string }> {
  return apiRequest("/agents/prosp/launch", {
    method: "POST",
    body: JSON.stringify(params),
  }, authToken);
}

export async function listCampaigns(authToken?: string | null): Promise<Campaign[]> {
  return apiRequest<Campaign[]>("/agents/prosp/campaigns", {}, authToken);
}


// ─── Skills API ───────────────────────────────────────────────────────────────

export interface Skill {
  id: number;
  name: string;
  title: string;
  description: string;
  prompt_template: string;
  category: string;
  is_active: boolean;
  usage_count: number;
  created_at: string;
  updated_at: string;
}

export interface SkillIn {
  name: string;
  title: string;
  description?: string;
  prompt_template: string;
  category?: string;
}

export async function listSkills(category?: string, authToken?: string | null): Promise<Skill[]> {
  const qs = category ? `?category=${encodeURIComponent(category)}` : "";
  return apiRequest<Skill[]>(`/skills${qs}`, {}, authToken);
}

export async function createSkill(skill: SkillIn, authToken?: string | null): Promise<Skill> {
  return apiRequest<Skill>("/skills", {
    method: "POST",
    body: JSON.stringify(skill),
  }, authToken);
}

export async function updateSkill(name: string, updates: Partial<SkillIn>, authToken?: string | null): Promise<Skill> {
  return apiRequest<Skill>(`/skills/${name}`, {
    method: "PATCH",
    body: JSON.stringify(updates),
  }, authToken);
}

export async function deleteSkill(name: string, authToken?: string | null): Promise<void> {
  await apiRequest(`/skills/${name}`, { method: "DELETE" }, authToken);
}

// ─── Tracker (Local only) ──────────────────────────────────────────────────

export interface TrackedFile {
    id: string;
    name: string;
    kind: "image" | "audio" | "video" | "document" | "text" | "sheet" | "spreadsheet";
    conversationId: string;
    conversationTitle: string;
    timestamp: string;
    dataUrl?: string;
    remoteUrl?: string;
    isRemote?: boolean;
    size?: number;
}

export function getTrackedFiles(): TrackedFile[] {
    if (typeof window === "undefined") return [];
    const saved = localStorage.getItem("flare_tracked_files");
    return saved ? JSON.parse(saved) : [];
}

export function saveTrackedFile(file: TrackedFile) {
    if (typeof window === "undefined") return;
    try {
        const list = getTrackedFiles();
        // Eviter les doublons par ID
        const filtered = list.filter(f => f.id !== file.id);
        filtered.unshift(file);
        
        // Limiter à 40 éléments max pour le confort, mais on va prôner la sécurité
        const limitedList = filtered.slice(0, 40);
        
        try {
            localStorage.setItem("flare_tracked_files", JSON.stringify(limitedList));
        } catch (e) {
            // Si quota dépassé, on essaie une version plus légère (sans les dataUrls pour les vieux fichiers)
            console.warn("localStorage quota exceeded, pruning tracked files...");
            const prunedList = limitedList.map((f, idx) => {
                if (idx > 5) { // Garder les previews uniquement pour les 5 derniers
                    const { dataUrl, ...rest } = f;
                    return rest;
                }
                return f;
            });
            localStorage.setItem("flare_tracked_files", JSON.stringify(prunedList.slice(0, 20)));
        }
    } catch (err) {
        console.error("Critical localStorage error:", err);
    }
}

export function deleteTrackedFile(id: string) {
    if (typeof window === "undefined") return;
    const list = getTrackedFiles();
    const filtered = list.filter(f => f.id !== id);
    localStorage.setItem("flare_tracked_files", JSON.stringify(filtered));
}
// ─── Settings API ────────────────────────────────────────────────────────────

export async function getUserPreferences(authToken?: string | null): Promise<string> {
  const res = await apiRequest<{ value: string }>("/api/settings/user-preferences", {}, authToken);
  return res.value;
}

export async function updateUserPreferences(value: string, authToken?: string | null): Promise<void> {
  await apiRequest("/api/settings/user-preferences", {
    method: "POST",
    body: JSON.stringify({ value }),
  }, authToken);
}

export async function resetUserPreferences(authToken?: string | null): Promise<string> {
  const res = await apiRequest<{ value: string }>("/api/settings/user-preferences", {
    method: "DELETE",
  }, authToken);
  return res.value;
}

export type ChatbotTone = "professionnel" | "amical" | "decontracte" | "formel";
export type ChatbotPrimaryRole = "vendeur" | "support_client" | "informateur" | "mixte";
export type ChatbotHandoffMode = "auto" | "manual";
export type ChatbotSetupStep = "need_org" | "connect_page" | "configure" | "complete";

export interface ChatbotPreferences {
  organization_slug?: string | null;
  bot_name: string;
  primary_role: ChatbotPrimaryRole;
  tone: ChatbotTone;
  language: string;
  greeting_message: string;
  off_hours_message: string;
  handoff_message: string;
  company_description: string;
  business_name: string;
  business_sector: string;
  business_address: string;
  business_hours: string;
  phone: string;
  contact_email: string;
  website_url: string;
  forbidden_topics_or_claims: string;
  products_summary: string;
  handoff_mode: ChatbotHandoffMode;
  handoff_keywords: string[];
  special_instructions: string;
  created_at?: string | null;
  updated_at?: string | null;
  sync_warning?: string | null;
}

export interface ChatbotSetupStatus {
  step: ChatbotSetupStep;
  has_connected_page: boolean;
  has_preferences: boolean;
  has_identity: boolean;
  has_business_profile: boolean;
  configure_stage: "identity" | "company" | null;
  active_page_name: string | null;
  active_page_id: string | null;
  all_pages?: ChatbotPageSummary[];
}

export const DEFAULT_CHATBOT_PREFERENCES: ChatbotPreferences = {
  bot_name: "L'assistant",
  primary_role: "mixte",
  tone: "amical",
  language: "fr",
  greeting_message: "",
  off_hours_message: "",
  handoff_message: "",
  company_description: "",
  business_name: "",
  business_sector: "",
  business_address: "",
  business_hours: "",
  phone: "",
  contact_email: "",
  website_url: "",
  forbidden_topics_or_claims: "",
  products_summary: "",
  handoff_mode: "auto",
  handoff_keywords: [],
  special_instructions: "",
};

export async function getChatbotPreferences(authToken?: string | null, pageId?: string | null): Promise<ChatbotPreferences> {
  const url = pageId ? `/api/chatbot-preferences?page_id=${pageId}` : `/api/chatbot-preferences`;
  const response = await apiRequest<Partial<ChatbotPreferences>>(url, {}, authToken);
  return {
    ...DEFAULT_CHATBOT_PREFERENCES,
    ...response,
    primary_role: (response.primary_role as ChatbotPrimaryRole) || DEFAULT_CHATBOT_PREFERENCES.primary_role,
    tone: (response.tone as ChatbotTone) || DEFAULT_CHATBOT_PREFERENCES.tone,
    handoff_mode: (response.handoff_mode as ChatbotHandoffMode) || DEFAULT_CHATBOT_PREFERENCES.handoff_mode,
    handoff_keywords: Array.isArray(response.handoff_keywords)
      ? response.handoff_keywords.map((item) => String(item || "").trim()).filter(Boolean)
      : DEFAULT_CHATBOT_PREFERENCES.handoff_keywords,
  };
}

export async function updateChatbotPreferences(
  payload: ChatbotPreferences,
  authToken?: string | null,
  pageId?: string | null
): Promise<ChatbotPreferences> {
  const url = pageId ? `/api/chatbot-preferences?page_id=${pageId}` : `/api/chatbot-preferences`;
  const response = await apiRequest<Partial<ChatbotPreferences>>(
    url,
    {
      method: "PUT",
      body: JSON.stringify({
        bot_name: payload.bot_name,
        primary_role: payload.primary_role,
        tone: payload.tone,
        language: payload.language,
        greeting_message: payload.greeting_message,
        off_hours_message: payload.off_hours_message,
        handoff_message: payload.handoff_message,
        company_description: payload.company_description,
        business_name: payload.business_name,
        business_sector: payload.business_sector,
        business_address: payload.business_address,
        business_hours: payload.business_hours,
        phone: payload.phone,
        contact_email: payload.contact_email,
        website_url: payload.website_url,
        forbidden_topics_or_claims: payload.forbidden_topics_or_claims,
        products_summary: payload.products_summary,
        handoff_mode: payload.handoff_mode,
        handoff_keywords: payload.handoff_keywords,
        special_instructions: payload.special_instructions,
      }),
    },
    authToken
  );
  return {
    ...DEFAULT_CHATBOT_PREFERENCES,
    ...response,
    primary_role: (response.primary_role as ChatbotPrimaryRole) || DEFAULT_CHATBOT_PREFERENCES.primary_role,
    tone: (response.tone as ChatbotTone) || DEFAULT_CHATBOT_PREFERENCES.tone,
    handoff_mode: (response.handoff_mode as ChatbotHandoffMode) || DEFAULT_CHATBOT_PREFERENCES.handoff_mode,
    handoff_keywords: Array.isArray(response.handoff_keywords)
      ? response.handoff_keywords.map((item) => String(item || "").trim()).filter(Boolean)
      : DEFAULT_CHATBOT_PREFERENCES.handoff_keywords,
  };
}

export async function getChatbotSetupStatus(authToken?: string | null): Promise<ChatbotSetupStatus> {
  return apiRequest<ChatbotSetupStatus>("/api/chatbot/setup-status", {}, authToken);
}

export interface ChatbotPageSummary {
  page_id: string;
  page_name: string;
  page_picture_url?: string;
  page_category?: string;
  status: string;
  is_active: boolean;
  webhook_subscribed: boolean;
  direct_service_synced: boolean;
  last_error: string | null;
  connected_at: string | null;
  last_synced_at: string | null;
}

export interface ChatbotOverview {
  step: ChatbotSetupStep;
  has_connected_page: boolean;
  has_preferences: boolean;
  has_identity: boolean;
  has_business_profile: boolean;
  configure_stage: "identity" | "company" | null;
  active_page: ChatbotPageSummary | null;
  preferences: ChatbotPreferences | null;
  all_pages: ChatbotPageSummary[];
  total_pages: number;
  pending_human_count?: number;
}

export async function getChatbotOverview(authToken?: string | null, pageId?: string | null): Promise<ChatbotOverview> {
  const url = pageId ? `/api/chatbot/overview?page_id=${pageId}` : `/api/chatbot/overview`;
  return apiRequest<ChatbotOverview>(url, {}, authToken);
}

// ─── Plan features ────────────────────────────────────────────────────────────

export interface PlanFeatures {
  chatbot_messages_limit: number;
  catalogue_items_limit: number;
  has_leads: boolean;
  has_budget: boolean;
  has_portfolio: boolean;
  has_sales_script: boolean;
  has_chatbot_content: boolean;
  has_multi_page: boolean;
  has_team: boolean;
  has_image_generation: boolean;
  has_file_generation?: boolean;
  assistant_tier: "slow" | "fast" | "full";
  upgrade_to: string | null;
}

export interface BillingFeatures {
  plan_id: string;
  features: PlanFeatures;
}

export async function getBillingFeatures(authToken?: string | null): Promise<BillingFeatures> {
  return apiRequest<BillingFeatures>("/api/billing/features", {}, authToken);
}

// ─── Catalogue ────────────────────────────────────────────────────────────────

export interface CatalogueItem {
  id: string;
  organization_slug: string;
  name: string;
  description: string;
  price: string | null;
  category: string;
  image_url: string;
  sort_order: number;
  is_active: boolean;
  created_at: string | null;
  updated_at: string | null;
  sync_warning?: string | null;
}

export interface CatalogueItemInput {
  name: string;
  description?: string;
  price?: string | null;
  category?: string;
  image_url?: string;
  sort_order?: number;
  is_active?: boolean;
}

export async function getCatalogue(authToken?: string | null, pageId?: string | null): Promise<CatalogueItem[]> {
  const url = pageId ? `/api/chatbot/catalogue?page_id=${pageId}` : `/api/chatbot/catalogue`;
  return apiRequest<CatalogueItem[]>(url, {}, authToken);
}

export async function createCatalogueItem(
  payload: CatalogueItemInput,
  authToken?: string | null,
  pageId?: string | null
): Promise<CatalogueItem> {
  const url = pageId ? `/api/chatbot/catalogue?page_id=${pageId}` : `/api/chatbot/catalogue`;
  return apiRequest<CatalogueItem>(url, { method: "POST", body: JSON.stringify(payload) }, authToken);
}

export async function updateCatalogueItem(
  id: string,
  payload: CatalogueItemInput,
  authToken?: string | null,
): Promise<CatalogueItem> {
  return apiRequest<CatalogueItem>(`/api/chatbot/catalogue/${id}`, { method: "PUT", body: JSON.stringify(payload) }, authToken);
}

export async function deleteCatalogueItem(id: string, authToken?: string | null): Promise<void> {
  await apiRequest<void>(`/api/chatbot/catalogue/${id}`, { method: "DELETE" }, authToken);
}

// ─── Portfolio ────────────────────────────────────────────────────────────────

export interface PortfolioItem {
  id: string;
  organization_slug: string;
  title: string;
  description: string;
  video_url: string;
  external_url: string;
  client_name: string;
  auto_share: boolean;
  sort_order: number;
  created_at: string | null;
  updated_at: string | null;
  sync_warning?: string | null;
}

export interface PortfolioItemInput {
  title: string;
  description?: string;
  video_url?: string;
  external_url?: string;
  client_name?: string;
  auto_share?: boolean;
  sort_order?: number;
}

export async function getPortfolio(authToken?: string | null, pageId?: string | null): Promise<PortfolioItem[]> {
  const url = pageId ? `/api/chatbot/portfolio?page_id=${pageId}` : `/api/chatbot/portfolio`;
  return apiRequest<PortfolioItem[]>(url, {}, authToken);
}

export async function createPortfolioItem(
  payload: PortfolioItemInput,
  authToken?: string | null,
  pageId?: string | null
): Promise<PortfolioItem> {
  const url = pageId ? `/api/chatbot/portfolio?page_id=${pageId}` : `/api/chatbot/portfolio`;
  return apiRequest<PortfolioItem>(url, { method: "POST", body: JSON.stringify(payload) }, authToken);
}

export async function updatePortfolioItem(
  id: string,
  payload: PortfolioItemInput,
  authToken?: string | null,
): Promise<PortfolioItem> {
  return apiRequest<PortfolioItem>(`/api/chatbot/portfolio/${id}`, { method: "PUT", body: JSON.stringify(payload) }, authToken);
}

export async function deletePortfolioItem(id: string, authToken?: string | null): Promise<void> {
  await apiRequest<void>(`/api/chatbot/portfolio/${id}`, { method: "DELETE" }, authToken);
}

// ─── Sales config ─────────────────────────────────────────────────────────────

export interface SalesObjectionPair {
  objection: string;
  response: string;
}

export interface SalesConfig {
  organization_slug: string;
  qualification_steps: string[];
  objections: SalesObjectionPair[];
  cta_type: string;
  cta_text: string;
  cta_url: string;
  hot_lead_signals: string[];
  handoff_mode: string;
  handoff_keywords: string[];
  updated_at: string | null;
  sync_warning?: string | null;
}

function normalizeSalesObjections(input: unknown): SalesObjectionPair[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((item) => {
      if (typeof item === "string") {
        return { objection: item, response: "" };
      }
      if (item && typeof item === "object") {
        const pair = item as Record<string, unknown>;
        return {
          objection: String(pair.objection || "").trim(),
          response: String(pair.response || "").trim(),
        };
      }
      return null;
    })
    .filter((item): item is SalesObjectionPair => Boolean(item) && (item!.objection.length > 0 || item!.response.length > 0));
}

export async function getSalesConfig(authToken?: string | null, pageId?: string | null): Promise<SalesConfig> {
  const url = pageId ? `/api/chatbot/sales-config?page_id=${pageId}` : `/api/chatbot/sales-config`;
  const raw = await apiRequest<SalesConfig & { objections?: unknown }>(url, {}, authToken);
  return {
    ...raw,
    qualification_steps: Array.isArray(raw.qualification_steps) ? raw.qualification_steps : [],
    hot_lead_signals: Array.isArray(raw.hot_lead_signals) ? raw.hot_lead_signals : [],
    handoff_keywords: Array.isArray(raw.handoff_keywords) ? raw.handoff_keywords : [],
    objections: normalizeSalesObjections(raw.objections),
  };
}

export async function updateSalesConfig(
  payload: Omit<SalesConfig, "organization_slug" | "updated_at">,
  authToken?: string | null,
  pageId?: string | null
): Promise<SalesConfig> {
  const normalizedPayload = {
    ...payload,
    objections: normalizeSalesObjections(payload.objections),
  };
  const url = pageId ? `/api/chatbot/sales-config?page_id=${pageId}` : `/api/chatbot/sales-config`;
  const raw = await apiRequest<SalesConfig & { objections?: unknown }>(
    url,
    { method: "PUT", body: JSON.stringify(normalizedPayload) },
    authToken
  );
  return {
    ...raw,
    qualification_steps: Array.isArray(raw.qualification_steps) ? raw.qualification_steps : [],
    hot_lead_signals: Array.isArray(raw.hot_lead_signals) ? raw.hot_lead_signals : [],
    handoff_keywords: Array.isArray(raw.handoff_keywords) ? raw.handoff_keywords : [],
    objections: normalizeSalesObjections(raw.objections),
  };
}

export interface UserProfileSettings {
  display_name: string;
  full_name: string;
  avatar_url: string;
  workspace_name: string;
}

export interface OrganizationBrandingSettings {
  organization_name: string;
  logo_url: string;
  workspace_name: string;
  workspace_description: string;
}

export interface CurrentWorkspaceBranding {
  scope_type: "personal" | "organization";
  organization_slug?: string | null;
  brand_name: string;
  workspace_name: string;
  workspace_description: string;
  logo_url: string;
}

export interface WorkspaceIdentity {
  user_profile: UserProfileSettings;
  organization_branding: OrganizationBrandingSettings | null;
  current_branding: CurrentWorkspaceBranding;
  can_edit_organization: boolean;
  organization_role?: string | null;
  organization_role_label?: string | null;
}

export async function getWorkspaceIdentity(authToken?: string | null): Promise<WorkspaceIdentity> {
  return apiRequest<WorkspaceIdentity>("/api/settings/workspace-identity", {}, authToken);
}

export async function updateUserProfileSettings(
  payload: Partial<UserProfileSettings>,
  authToken?: string | null
): Promise<WorkspaceIdentity> {
  return apiRequest<WorkspaceIdentity>(
    "/api/settings/user-profile",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    authToken
  );
}

export async function updateOrganizationBrandingSettings(
  payload: Partial<OrganizationBrandingSettings>,
  authToken?: string | null
): Promise<WorkspaceIdentity> {
  return apiRequest<WorkspaceIdentity>(
    "/api/settings/organization-branding",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    authToken
  );
}

export async function uploadIdentityAsset(
  payload: {
    target: "user_avatar" | "organization_logo";
    file_name: string;
    mime_type: string;
    data_url: string;
  },
  authToken?: string | null
): Promise<{ status: string; url: string; path: string }> {
  return apiRequest<{ status: string; url: string; path: string }>(
    "/api/settings/identity-asset",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    authToken
  );
}

// Rétro-compatibilité (alias)
export const getSystemPrompt = getUserPreferences;
export const updateSystemPrompt = updateUserPreferences;
export const resetSystemPrompt = resetUserPreferences;

// ─── Abonnements & Plans ─────────────────────────────────────────────────────

export interface UserPlan {
  plan: string;
  plan_name: string;
  daily_budget_usd: number;
  daily_cost_usd: number;
  usage_percent: number;
  daily_images: number;
  max_images_per_day: number;
  daily_videos: number;
  max_videos_per_day: number;
  allowed_models: string[];
}

/** Appelé après chaque login Firebase. Inscrit le nouvel utilisateur automatiquement. */
export async function syncUser(authToken?: string | null): Promise<{ status: string; plan: string }> {
  return apiRequest<{ status: string; plan: string }>("/api/auth/sync", {
    method: "POST",
  }, authToken);
}

export interface OrganizationScope {
  type: "personal" | "organization";
  scope_id: string;
  label: string;
  description: string;
  offer_name: string;
  plan_id: string;
  security_label: string;
  organization_slug?: string;
  workspace_name?: string;
  organization_name?: string;
  logo_url?: string;
  enabled_modules?: string[];
  current_user_role?: string | null;
  current_user_role_label?: string | null;
  can_edit_branding?: boolean;
  connected_at?: string | null;
  expires_at?: string | null;
  session_ttl_hours?: number | null;
  remaining_minutes?: number | null;
}

export interface OrganizationMemberSummary {
  email: string;
  display_name: string;
  role: string;
  role_label: string;
}

export interface OrganizationSummary {
  slug: string;
  name: string;
  offer_name: string;
  plan_id: string;
  security_label: string;
  description: string;
  enabled_modules: string[];
  member_count: number;
  workspace_name?: string;
  workspace_description?: string;
  logo_url?: string;
  members?: OrganizationMemberSummary[];
  current_user_role?: string | null;
  current_user_role_label?: string | null;
  can_edit_branding?: boolean;
}

export interface OrganizationAccessResponse {
  user_email: string;
  current_scope: OrganizationScope;
  organizations: OrganizationSummary[];
  has_shared_access: boolean;
  requires_connection_flow: boolean;
  session_ttl_hours?: number;
}

export async function getOrganizationAccess(authToken?: string | null): Promise<OrganizationAccessResponse> {
  return apiRequest<OrganizationAccessResponse>("/api/organizations/access", {}, authToken);
}

export async function connectToOrganization(
  organizationSlug: string,
  authToken?: string | null
): Promise<{ status: string; current_scope: OrganizationScope; organization: OrganizationSummary }> {
  return apiRequest<{ status: string; current_scope: OrganizationScope; organization: OrganizationSummary }>(
    "/api/organizations/connect",
    {
      method: "POST",
      body: JSON.stringify({ organization_slug: organizationSlug }),
    },
    authToken
  );
}

export async function returnToPersonalScope(
  authToken?: string | null
): Promise<{ status: string; current_scope: OrganizationScope }> {
  return apiRequest<{ status: string; current_scope: OrganizationScope }>(
    "/api/organizations/personal",
    { method: "POST" },
    authToken
  );
}

/** Retourne le plan actuel et l'usage mensuel de l'utilisateur. */
export async function getUserPlan(authToken?: string | null): Promise<UserPlan> {
  return apiRequest<UserPlan>("/api/auth/plan", {}, authToken);
}

/** Crée une session de checkout Stripe et retourne l'URL de redirection. */
export async function createCheckoutSession(planId: string, authToken?: string | null): Promise<{ url: string }> {
  const returnUrl = typeof window !== "undefined" ? window.location.href : "https://flareai.ramsflare.com";
  return apiRequest<{ url: string }>("/api/billing/create-checkout-session", {
    method: "POST",
    body: JSON.stringify({ 
      plan_id: planId,
      return_url: returnUrl,
      success_url: returnUrl,
      cancel_url: returnUrl
    }),
  }, authToken);
}

/** Crée une session pour le portail client Stripe et retourne l'URL. */
export async function createCustomerPortalSession(authToken?: string | null): Promise<{ url: string }> {
  const returnUrl = typeof window !== "undefined" ? window.location.href : "https://flareai.ramsflare.com";
  return apiRequest<{ url: string }>("/api/billing/create-portal-session", {
    method: "POST",
    body: JSON.stringify({ 
      return_url: returnUrl
    }),
  }, authToken);
}

/** ─── Memory API ─── */
export async function saveFact(key: string, value: string, category: string = "general", authToken?: string | null): Promise<void> {
  await apiRequest("/memory/facts", {
    method: "POST",
    body: JSON.stringify({ key, value, category }),
  }, authToken);
}

// ─── Prospecting (Sub-Agent) API ───────────────────────────────────────────

export interface ProspectingChatResponse {
  response: string;
  campaign_id: string;
  brief: any;
}

export async function prospectingChat(
  message: string,
  campaignId?: string,
  authToken?: string | null
): Promise<ProspectingChatResponse> {
  return apiRequest<ProspectingChatResponse>("/agents/prospecting/chat", {
    method: "POST",
    body: JSON.stringify({ message, campaign_id: campaignId }),
  }, authToken);
}

export async function launchSourcing(
  campaignId: string,
  authToken?: string | null
): Promise<{ status: string; next_step: string }> {
  return apiRequest(`/agents/prospecting/${campaignId}/source`, {
    method: "POST",
  }, authToken);
}

export async function reviewLeads(
  campaignId: string,
  authToken?: string | null
): Promise<{ campaign_id: string; leads: any[] }> {
  return apiRequest(`/agents/prospecting/${campaignId}/review`, {}, authToken);
}

export async function approveCampaign(
  campaignId: string,
  authToken?: string | null
): Promise<{ status: string; tasks_queued: number; message: string }> {
  return apiRequest(`/agents/prospecting/${campaignId}/approve`, {
    method: "POST",
  }, authToken);
}

// ─── Admin API ────────────────────────────────────────────────────────────────

export interface AdminUsageSummary {
  total_users: number;
  total_cost: number;
  users: any[];
}

export interface AdminUsageLedgerEntry {
  id?: number;
  user_email: string;
  model_name?: string;
  model?: string;
  action_kind?: string;
  action?: string;
  tokens?: number;
  cost: number;
  timestamp: string;
}

export async function getAdminUsageSummary(token: string, days: number = 0): Promise<AdminUsageSummary> {
  return apiRequest<AdminUsageSummary>(`/api/admin/usage/summary?days=${days}`, {}, token);
}

export async function getAdminUsageLedger(token: string): Promise<AdminUsageLedgerEntry[]> {
  return apiRequest<AdminUsageLedgerEntry[]>("/api/admin/usage/ledger", {}, token);
}

export async function syncAdminUsers(token: string): Promise<{ status: string }> {
  return apiRequest<{ status: string }>("/api/admin/sync-users", { method: "POST" }, token);
}

export async function backfillAdminUsage(token: string): Promise<{ status: string; created: Record<string, number>; total: number; message: string }> {
  return apiRequest<{ status: string; created: Record<string, number>; total: number; message: string }>("/api/admin/backfill-usage", { method: "POST" }, token);
}

export interface ConnectedUser {
  user_id: string;
  email: string;
  status: "online" | "recent" | "away";
  last_seen: string;
  actions_today: number;
  tokens_today: number;
  cost_today: number;
  last_action: string | null;
  last_model: string | null;
}

export interface ConnectedUsersResponse {
  online_count: number;
  recent_count: number;
  total_active_24h: number;
  users: ConnectedUser[];
}

export async function getAdminConnectedUsers(token: string): Promise<ConnectedUsersResponse> {
  return apiRequest<ConnectedUsersResponse>("/api/admin/connected-users", {}, token);
}

export interface NewAccount {
  user_id: string;
  email: string;
  plan: string;
  created_at: string | null;
  total_actions: number;
  total_tokens: number;
  total_cost: number;
  is_active: boolean;
}

export interface NewAccountsResponse {
  total: number;
  new_today: number;
  new_this_week: number;
  accounts: NewAccount[];
}

export async function getAdminNewAccounts(token: string, days: number = 30): Promise<NewAccountsResponse> {
  return apiRequest<NewAccountsResponse>(`/api/admin/new-accounts?days=${days}`, {}, token);
}

// ─── Email Verification (inscription sécurisée PIN 6 chiffres) ───────────────

export async function sendVerificationPin(email: string): Promise<{ status: string; message: string; dev_pin?: string }> {
  const res = await fetch(`${getApiBaseUrl()}/api/auth/send-pin`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || "Erreur lors de l'envoi du code");
  return data;
}

export async function verifyEmailPin(email: string, pin: string): Promise<void> {
  const res = await fetch(`${getApiBaseUrl()}/api/auth/verify-pin`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, pin }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || "Code incorrect");
}

// ─── Dashboard Stats ──────────────────────────────────────────────────────────

export interface DashboardStats {
  system: {
    version: string;
    llm_provider: string;
    llm_model: string;
    status: string;
    google_workspace: boolean;
    meta_facebook: boolean;
    smtp: boolean;
  };
  conversations: { total: number; active: number; messenger: number; this_week: number };
  messages: { total: number; today: number; this_week: number };
  memory: { total_facts: number; by_category: Record<string, number> };
  prospecting: {
    total_campaigns: number;
    running: number;
    completed: number;
    total_leads: number;
    emails_sent: number;
  };
  skills: { total: number; active: number };
  agents: Record<string, unknown>;
  period: {
    messages: number;
    conversations: number;
    leads: number;
    from_date: string;
    to_date: string;
  };
}

export async function getDashboardStats(
  authToken?: string | null,
  from_date?: string,
  to_date?: string,
): Promise<DashboardStats> {
  const params = new URLSearchParams();
  if (from_date) params.set("from_date", from_date);
  if (to_date) params.set("to_date", to_date);
  const qs = params.toString() ? `?${params.toString()}` : "";
  // Note: dashboard router is mounted at /dashboard (no /api prefix)
  return apiRequest<DashboardStats>(`/dashboard/stats${qs}`, {}, authToken);
}

// ─── Prompt Templates (slash commands) ───────────────────────────────────────

export interface PromptTemplate {
  id: number;
  title: string;
  content: string;
  category: string;
  is_default: boolean;
}

export async function getPrompts(authToken?: string | null): Promise<PromptTemplate[]> {
  return apiRequest<PromptTemplate[]>("/api/prompts", {}, authToken);
}

// ─── Contact Bot Status ────────────────────────────────────────────────────────
/**
 * Active ou désactive le bot pour un contact donné (Messenger).
 */
export async function setContactBotStatus(psid: string, botEnabled: boolean, token?: string | null, pageId?: string | null): Promise<void> {
  const mode = botEnabled ? "agent" : "human";
  const params: Record<string, string> = { psid, mode };
  if (pageId) params.page_id = pageId;
  const body = new URLSearchParams(params);
  const response = await fetch(`${getApiBaseUrl()}/dashboard/messenger/contact-mode`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body,
  });

  if (!response.ok) {
    throw new Error("Impossible de modifier le mode du bot.");
  }
}

