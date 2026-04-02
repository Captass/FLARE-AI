"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Message, FileAttachment, SourceInfo, ChatMode, sendMessage, sendMessageStream, getMessages, saveTrackedFile, toRenderableMediaUrl, trackClientEvent } from "@/lib/api";

function buildInlineMediaUrl(mimeType: string, base64Data?: string, preferBlob: boolean = false): string | undefined {
  if (!base64Data) return undefined;
  if (preferBlob && typeof window !== "undefined") {
    try {
      const binary = atob(base64Data);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.charCodeAt(i);
      }
      return URL.createObjectURL(new Blob([bytes], { type: mimeType || "application/octet-stream" }));
    } catch {
      // Fallback data URL below
    }
  }
  return `data:${mimeType || "application/octet-stream"};base64,${base64Data}`;
}

function detectTaskLabel(text: string, attachment?: FileAttachment): string | null {
  const lower = text.toLowerCase();
  if (attachment?.type?.startsWith("video/")) return "Analyse des rushs video...";
  if (attachment?.type?.startsWith("audio/")) return "Transcription du message vocal...";
  if (attachment?.type?.startsWith("image/") && /(anime|animer|animation|video)/.test(lower)) return "Preparation de l'animation de l'image...";
  if (attachment?.type?.startsWith("image/")) return "Analyse de l'image...";
  if (/(video|veo|clip|animation)/.test(lower)) return "Generation video en cours...";
  if (/(image|visuel|illustration|affiche|poster|fond|background)/.test(lower)) return "Generation de l'image en cours...";
  if (/(excel|xlsx|tableau|sheet|feuille de calcul|budget|planning)/.test(lower)) return "Preparation du fichier Excel...";
  if (/(word|docx|document|rapport|cours|proposition)/.test(lower)) return "Preparation du document...";
  if (/(recherche|cherche|analyse|compare|resume|résume)/.test(lower)) return "Analyse de la demande...";
  return null;
}

function normalizeChatError(rawMsg: string): string {
  const msg = rawMsg || "";
  const lower = msg.toLowerCase();

  if (lower.includes("daily limit") || lower.includes("limite quotidienne") || lower.includes("quota") || lower.includes("budget")) {
    return "La limite de votre plan a ete atteinte pour aujourd'hui. Essayez plus tard ou passez a une offre plus elevee.";
  }
  if (lower.includes("401") || lower.includes("unauthorized") || lower.includes("session a expir")) {
    return "Votre session a expire. Reconnectez-vous puis relancez votre demande.";
  }
  if (lower.includes("403")) {
    return "Cette action est bloquee pour votre compte ou votre offre actuelle.";
  }
  if (lower.includes("413") || lower.includes("payload too large") || lower.includes("too large")) {
    return "Le fichier envoye est trop volumineux. Essayez un fichier plus leger.";
  }
  if (lower.includes("unsupported") || lower.includes("invalid file") || lower.includes("mime") || lower.includes("format")) {
    return "Le fichier ou le format envoye n'est pas pris en charge pour cette action.";
  }
  if (lower.includes("vertex") || lower.includes("veo") || lower.includes("model") || lower.includes("service unavailable") || lower.includes("temporarily unavailable")) {
    return "Le service IA necessaire est temporairement indisponible. Reessayez dans un instant.";
  }
  if (lower.includes("failed to fetch") || lower.includes("networkerror") || lower.includes("net::") || lower.includes("timeout") || lower.includes("timed out")) {
    return "La connexion au serveur a echoue ou a pris trop de temps. Verifiez votre connexion puis reessayez.";
  }
  if (lower.includes("500") || lower.includes("internal server error")) {
    return "Une erreur interne est survenue cote serveur. Reessayez dans un instant.";
  }
  if (!msg) {
    return "Une erreur inattendue s'est produite. Veuillez reessayer.";
  }
  return `Une erreur est survenue : ${msg.length > 220 ? msg.slice(0, 220) + "..." : msg}`;
}

export function useChat(
  onNewConversation?: () => void,
  authToken?: string | null,
  onKnowledgeSaved?: (titles: string[]) => void,
) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessionId, setSessionId] = useState<string | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingHistory, setIsFetchingHistory] = useState(false);
  const [thought, setThought] = useState<string | null>(null);
  const [thoughts, setThoughts] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const thoughtsRef = useRef<string[]>([]);

  const generateId = useCallback(() => {
    try {
      return crypto.randomUUID();
    } catch {
      return `id-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    }
  }, []);

  const stop = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setIsLoading(false);
    setThought(null);
    setMessages((prev) => {
      const last = prev[prev.length - 1];
      if (last?.role === "assistant" && String(last.id || "").startsWith("streaming-")) {
        return prev.slice(0, -1);
      }
      return prev;
    });
  }, []);

  const syncConversationMessages = useCallback(
    async (conversationId?: string) => {
      if (!conversationId || !authToken) return false;
      try {
        const canonicalMessages = await getMessages(conversationId, authToken);
        if (canonicalMessages.length === 0) return false;
        setMessages(canonicalMessages);
        setSessionId(conversationId);
        return true;
      } catch (syncError) {
        trackClientEvent("conversation_sync_failed", {
          conversation_id: conversationId,
          message: syncError instanceof Error ? syncError.message : String(syncError),
        });
        return false;
      }
    },
    [authToken]
  );

  const send = useCallback(
    async (text: string, attachment?: FileAttachment, deepResearch: boolean = false, quality: string = "HD", chatMode: ChatMode = "raisonnement") => {
      if ((!text.trim() && !attachment) || isLoading) return;

      setError(null);
      setThought(detectTaskLabel(text, attachment));
      setThoughts([]);
      thoughtsRef.current = [];

      let attachKind: "image" | "file" | "audio" | "video" = "file";
      if (attachment) {
        if (attachment.type.startsWith("image/")) attachKind = "image";
        else if (attachment.type.startsWith("video/")) attachKind = "video";
        else if (attachment.type.startsWith("audio/")) attachKind = "audio";
      }

      const userMsg: Message = {
        id: generateId(),
        role: "user",
        content: text,
        timestamp: new Date().toISOString(),
        attachment: attachment
          ? { kind: attachKind, name: attachment.name, dataUrl: attachment.dataUrl }
          : undefined,
      };
      setMessages((prev) => [...prev, userMsg]);
      setIsLoading(true);

      const controller = new AbortController();
      abortControllerRef.current = controller;
      const startTime = Date.now();
      const streamingId = `streaming-${Date.now()}`;
      let receivedAssistantOutput = false;
      let resolvedSessionId = sessionId;

      const buildAssistantAttachment = (media: any) => {
        if (!media) return undefined;
        const isVideo = media.type?.startsWith("video/");
        const isDoc = media.type?.includes("wordprocessingml") || media.type?.includes("document");
        const isSheet = media.type?.includes("spreadsheetml") || media.type?.includes("excel");
        const isImage = !isVideo && !isDoc && !isSheet;
        const mediaName = media.name || (isSheet ? "tableur.xlsx" : (isDoc ? "document.docx" : (isVideo ? "video-generee.mp4" : "image-generee.jpg")));
        const mediaKind = isSheet ? "sheet" : (isDoc ? "document" : (isVideo ? "video" : "image"));
        const gcsUrl = media.url || undefined;
        const inlineUrl = buildInlineMediaUrl(media.type || "application/octet-stream", media.data, isVideo);
        const previewUrl = inlineUrl || toRenderableMediaUrl(gcsUrl);
        const displayUrl = gcsUrl || inlineUrl;
        saveTrackedFile({
          id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          name: mediaName,
          kind: mediaKind,
          conversationId: sessionId || "new",
          conversationTitle: "Conversation",
          timestamp: new Date().toISOString(),
          remoteUrl: gcsUrl,
          dataUrl:
            isVideo && !gcsUrl && inlineUrl && inlineUrl.startsWith("data:") && inlineUrl.length > 1_500_000
              ? undefined
              : (isImage ? previewUrl : (gcsUrl || displayUrl)),
        });
        return {
          kind: mediaKind,
          name: mediaName,
          dataUrl: isImage ? previewUrl : displayUrl,
          url: gcsUrl,
          type: media.type || undefined,
        } as { kind: "image" | "file" | "audio" | "video" | "document" | "sheet"; name: string; dataUrl?: string; url?: string; type?: string };
      };

      try {
        const stream = sendMessageStream(text, sessionId, attachment, controller.signal, authToken, deepResearch, quality, chatMode);

        for await (const event of stream) {
          if (event.type === "thought") {
            setThought(event.content);
            thoughtsRef.current = [...thoughtsRef.current, event.content];
            setThoughts([...thoughtsRef.current]);
          } else if (event.type === "delta") {
              receivedAssistantOutput = true;
              setMessages((prev) => {
                const last = prev[prev.length - 1];
                if (last && last.role === "assistant" && last.id === streamingId) {
                // Mettre Ã  jour le dernier message si c'est dÃ©jÃ  notre assistant message temporaire
                return [
                  ...prev.slice(0, -1),
                  { ...last, content: last.content + event.content }
                ];
              } else {
                // CrÃ©er un nouveau message assistant temporaire UNIQUE
                return [
                  ...prev,
                  {
                    id: streamingId,
                    role: "assistant",
                    content: event.content,
                    timestamp: new Date().toISOString()
                  }
                ];
              }
            });
          } else if (event.type === "final") {
            receivedAssistantOutput = true;
            resolvedSessionId = event.session_id || resolvedSessionId;
            if (!sessionId) {
              setSessionId(event.session_id);
              onNewConversation?.();
            }

            if (event.knowledge_saved && event.knowledge_saved.length > 0) {
              onKnowledgeSaved?.(event.knowledge_saved);
            }

            let assistantAttachment: { kind: "image" | "file" | "audio" | "video" | "document" | "sheet"; name: string; dataUrl?: string; url?: string; type?: string } | undefined;
            if (event.images && event.images.length > 0) {
              assistantAttachment = buildAssistantAttachment(event.images[0]);
            }

            // Use ref (always fresh) instead of state (stale closure)
            const collectedThoughts = thoughtsRef.current.length > 0 ? [...thoughtsRef.current] : undefined;

            const assistantMsg: Message = {
              id: generateId() + "-final",
              role: "assistant",
              content: event.response,
              timestamp: new Date().toISOString(),
              attachment: assistantAttachment,
              knowledgeSaved: event.knowledge_saved ?? undefined,
              sources: event.sources ?? undefined,
              thoughts: collectedThoughts,
              responseTime: event.response_time ?? ((Date.now() - startTime) / 1000),
              suggestions: event.suggestions ?? undefined,
            };
            setMessages((prev) => {
              const filtered = prev.filter(m => m.id !== streamingId);
              return [...filtered, assistantMsg];
            });
            setThought(null);
            setThoughts([]);
            thoughtsRef.current = [];
            if (resolvedSessionId && authToken) {
              void syncConversationMessages(resolvedSessionId);
            }
          } else if (event.type === "error") {
            throw new Error(event.content);
          }
        }

        if (!receivedAssistantOutput && resolvedSessionId && authToken) {
          const synced = await syncConversationMessages(resolvedSessionId);
          if (synced) {
            setThought(null);
            setThoughts([]);
            thoughtsRef.current = [];
            return;
          }
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") return;
        let rawMsg = err instanceof Error ? err.message : "";
        setThought(null);
        setMessages((prev) => prev.filter((msg) => msg.id !== streamingId));

        const shouldTryFallback =
          !receivedAssistantOutput &&
          !rawMsg.includes("401") &&
          !rawMsg.includes("403") &&
          !!authToken;

        if (shouldTryFallback) {
          try {
            trackClientEvent("chat_stream_fallback_started", {
              has_attachment: !!attachment,
              deep_research: deepResearch,
              chat_mode: chatMode,
            });
            const fallback = await sendMessage(text, sessionId, attachment, undefined, authToken, deepResearch, quality, chatMode);
            const assistantAttachment = fallback.images?.[0] ? buildAssistantAttachment(fallback.images[0]) : undefined;
            const assistantMsg: Message = {
              id: generateId() + "-fallback",
              role: "assistant",
              content: fallback.response,
              timestamp: new Date().toISOString(),
              attachment: assistantAttachment,
              knowledgeSaved: fallback.knowledge_saved ?? undefined,
              responseTime: (Date.now() - startTime) / 1000,
              suggestions: fallback.suggestions ?? undefined,
            };
            if (!sessionId && fallback.session_id) {
              setSessionId(fallback.session_id);
              onNewConversation?.();
            }
            resolvedSessionId = fallback.session_id || resolvedSessionId;
            if (fallback.knowledge_saved && fallback.knowledge_saved.length > 0) {
              onKnowledgeSaved?.(fallback.knowledge_saved);
            }
            setMessages((prev) => [...prev, assistantMsg]);
            setThoughts([]);
            thoughtsRef.current = [];
            if (resolvedSessionId && authToken) {
              void syncConversationMessages(resolvedSessionId);
            }
            trackClientEvent("chat_stream_fallback_succeeded", {
              session_id: fallback.session_id,
            });
            return;
          } catch (fallbackErr: unknown) {
            rawMsg = fallbackErr instanceof Error ? fallbackErr.message : rawMsg;
            trackClientEvent("chat_stream_fallback_failed", {
              message: rawMsg,
            });
          }
        }

        const displayMsg = normalizeChatError(rawMsg);
        setError(displayMsg);
        trackClientEvent("chat_request_failed", {
          message: rawMsg || displayMsg,
          has_attachment: !!attachment,
          deep_research: deepResearch,
          chat_mode: chatMode,
        });

        const errorMsg: Message = {
          id: generateId(),
          role: "assistant",
          content: displayMsg,
          timestamp: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, errorMsg]);
      } finally {
        abortControllerRef.current = null;
        setIsLoading(false);
        if (typeof window !== "undefined") {
          window.dispatchEvent(new Event('refresh-files'));
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sessionId, isLoading, onNewConversation, authToken, onKnowledgeSaved, syncConversationMessages]
  );

  // Reset current operation on session change
  useEffect(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsLoading(false);
    setThought(null);
    setThoughts([]);
    thoughtsRef.current = [];
  }, [sessionId]);

  const loadConversation = useCallback(async (convId: string) => {
    setIsLoading(false);
    setIsFetchingHistory(true);
    setError(null);
    setThought(null);
    setThoughts([]);
    thoughtsRef.current = [];
    try {
      const msgs = await getMessages(convId, authToken);
      setMessages(msgs);
      setSessionId(convId);
    } catch {
      setError("Impossible de charger la conversation.");
      trackClientEvent("conversation_load_failed", { conversation_id: convId });
    } finally {
      setIsFetchingHistory(false);
    }
  }, [authToken]);

  const deleteMessagesAfterPoint = useCallback(async (timestamp: string) => {
    if (!sessionId || !authToken) return;
    try {
      const { deleteMessagesAfter } = await import('@/lib/api');
      await deleteMessagesAfter(sessionId, timestamp, authToken);
      setMessages(prev => {
        const idx = prev.findIndex(m => m.timestamp === timestamp);
        if (idx !== -1) return prev.slice(0, idx);
        return prev;
      });
    } catch (e) {
      console.error("Failed to delete messages", e);
      trackClientEvent("conversation_trim_failed", { session_id: sessionId, timestamp });
    }
  }, [sessionId, authToken]);

  const newConversation = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setMessages([]);
    setSessionId(undefined);
    setError(null);
    setIsLoading(false);
    setThought(null);
    setThoughts([]);
    thoughtsRef.current = [];
  }, []);

  return {
    messages,
    sessionId,
    isLoading,
    isFetchingHistory,
    thought,
    thoughts,
    error,
    send,
    stop,
    loadConversation,
    newConversation,
    deleteMessagesAfterPoint,
  };
}

