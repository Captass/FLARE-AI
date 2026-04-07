"use client";

import { useCallback, useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { MessageSquare, Plus } from "lucide-react";
import ArtifactViewer, { Artifact } from "@/components/ArtifactViewer";
import ChatWindow from "@/components/ChatWindow";
import FilesPanel from "@/components/FilesPanel";
import MessageInput from "@/components/MessageInput";
import { FileAttachment, saveTrackedFile } from "@/lib/api";

type ChatMode = "raisonnement" | "rapide" | "creative" | "pro";

interface AssistantPageProps {
  token?: string | null;
  sessionId: string | null;
  activeConvTitle: string | null;
  messages: any[];
  isLoading: boolean;
  isFetchingHistory: boolean;
  thought: string | null;
  thoughts: any[];
  error: string | null;
  userName: string;
  chatMode: ChatMode;
  setChatMode: (mode: ChatMode) => void;
  send: (text: string, attachment?: any, deep?: boolean, quality?: string, mode?: ChatMode) => void;
  stop: () => void;
  deleteMessagesAfterPoint: (ts: number) => Promise<void>;
  showFilesPanel: boolean;
  setShowFilesPanel: (show: boolean) => void;
  activeArtifact: Artifact | null;
  setActiveArtifact: (artifact: Artifact | null) => void;
  activeArtifactVersions: Artifact[];
  onKnowledgeSaved: (titles: string[]) => void;
  conversations?: any[];
  folders?: any[];
  onSelectConversation?: (id: string) => void;
  onNewChat?: () => void;
}

export default function AssistantPage({
  token,
  sessionId,
  activeConvTitle,
  messages,
  isLoading,
  isFetchingHistory,
  thought,
  thoughts,
  error,
  userName,
  chatMode,
  setChatMode,
  send,
  stop,
  deleteMessagesAfterPoint,
  showFilesPanel,
  setShowFilesPanel,
  activeArtifact,
  setActiveArtifact,
  activeArtifactVersions,
  onKnowledgeSaved,
  conversations,
  onSelectConversation,
  onNewChat,
}: AssistantPageProps) {
  const [pendingRestore, setPendingRestore] = useState("");
  const [pendingRestoreAttachment, setPendingRestoreAttachment] = useState<FileAttachment | null>(null);
  const lastSentAttachmentRef = useRef<FileAttachment | null>(null);

  const handleSend = useCallback(
    (text: string, attachment?: object, deepResearch?: boolean, quality?: string, mode?: ChatMode) => {
      lastSentAttachmentRef.current = (attachment as FileAttachment) ?? null;

      if (attachment) {
        const att = attachment as FileAttachment;
        const kind = att.type?.startsWith("image/")
          ? "image"
          : att.type?.startsWith("audio/")
            ? "audio"
            : att.name?.match(/\.(pdf|docx)$/i)
              ? "document"
              : "text";

        saveTrackedFile({
          id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          name: att.name,
          kind,
          conversationId: sessionId || "new",
          conversationTitle: activeConvTitle || "Nouvelle conversation",
          timestamp: new Date().toISOString(),
          dataUrl: att.dataUrl,
        });
      }

      send(text, attachment, deepResearch, quality, mode ?? chatMode);
    },
    [activeConvTitle, chatMode, send, sessionId]
  );

  const handleStop = useCallback(() => {
    const lastUserMsg = messages.filter((m) => m.role === "user").at(-1);
    if (lastUserMsg?.content) {
      setPendingRestore(lastUserMsg.content);
    }
    if (lastSentAttachmentRef.current) {
      setPendingRestoreAttachment(lastSentAttachmentRef.current);
    }
    stop();
  }, [messages, stop]);

  const buildInlineArtifactAttachment = useCallback((artifact: Artifact | null): FileAttachment | undefined => {
    const inlineUrl = artifact?.url?.startsWith("data:")
      ? artifact.url
      : artifact?.data?.startsWith("data:")
        ? artifact.data
        : undefined;

    if (!inlineUrl) {
      return undefined;
    }

    const match = inlineUrl.match(/^data:(.*?);base64,(.*)$/);
    if (!match) {
      return undefined;
    }

    return {
      content: match[2],
      type: match[1] || "application/octet-stream",
      name: artifact?.name || "artifact",
      dataUrl: inlineUrl,
    };
  }, []);

  return (
    <div className="relative flex flex-1 overflow-hidden">
      <div className="hidden w-[280px] shrink-0 flex-col border-r border-[var(--border-default)] bg-[var(--surface-base)] md:flex">
        <div className="p-4">
          <button
            onClick={onNewChat}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-orange-500/30 bg-orange-500/12 py-2.5 text-sm font-medium text-[var(--text-primary)] transition-all hover:bg-orange-500/18"
          >
            <Plus size={16} />
            Nouvelle discussion
          </button>
        </div>

        <div className="flex-1 space-y-1 overflow-y-auto px-2 pb-4">
          {conversations?.map((conv) => {
            const isActive = conv.id === sessionId;
            return (
              <button
                key={conv.id}
                onClick={() => onSelectConversation?.(conv.id)}
                className={`flex w-full flex-col items-start gap-1 rounded-xl border px-3 py-2.5 text-left transition-all duration-200 ${
                  isActive
                    ? "border-[var(--border-strong)] bg-[var(--surface-selected)] text-[var(--text-primary)] shadow-[var(--shadow-card)]"
                    : "border-transparent text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)] hover:text-[var(--text-primary)]"
                }`}
              >
                <div className="flex w-full items-center gap-2">
                  <MessageSquare
                    size={14}
                    className={isActive ? "text-orange-500" : "text-[var(--text-muted)]"}
                  />
                  <span className="flex-1 truncate text-sm font-medium leading-tight">
                    {conv.title || "Nouvelle discussion"}
                  </span>
                </div>
                <span
                  className={`pl-6 text-[10px] font-medium ${
                    isActive ? "text-[var(--text-secondary)]" : "text-[var(--text-muted)]"
                  }`}
                >
                  {new Date(conv.updated_at || conv.created_at).toLocaleDateString("fr-FR", {
                    day: "numeric",
                    month: "short",
                  })}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div
        className={`flex min-w-0 flex-1 flex-col transition-all duration-300 ${
          showFilesPanel ? "md:mr-[320px]" : ""
        } ${activeArtifact ? "hidden md:flex md:w-[45%]" : "flex"}`}
      >
        <div className="flex-1 overflow-hidden">
          <ChatWindow
            messages={messages}
            isLoading={isLoading}
            isFetchingHistory={isFetchingHistory}
            thought={thought}
            thoughts={thoughts}
            error={error}
            userName={userName}
            onSuggestion={(text) => setPendingRestore(text)}
            onViewArtifact={(url, type, name, previewUrl) =>
              setActiveArtifact({ url, type, name, data: previewUrl })
            }
            onEditMessage={async (ts, content) => {
              const msgToEdit = messages.find((m) => m.timestamp === ts);
              let attachment: FileAttachment | undefined;

              if (msgToEdit?.attachment) {
                const att = msgToEdit.attachment;
                if (att.dataUrl?.startsWith("data:")) {
                  const parts = att.dataUrl.split(",");
                  const base64Content = parts[1];
                  const mimeType = parts[0].match(/data:(.*?);/)?.[1] || "application/octet-stream";
                  attachment = {
                    content: base64Content,
                    type: mimeType,
                    name: att.name,
                    dataUrl: att.dataUrl,
                  };
                }
              }

              await deleteMessagesAfterPoint(ts);
              send(content, attachment, false);
            }}
          />
        </div>

        <div className="chat-input-mobile safe-bottom mt-auto w-full max-w-3xl shrink-0 bg-[var(--background)] px-2 pb-4 md:px-4 md:pb-6">
          <MessageInput
            onSend={handleSend}
            onStop={handleStop}
            isLoading={isLoading}
            disabled={false}
            authToken={token}
            onKnowledgeSaved={onKnowledgeSaved}
            restoredValue={pendingRestore}
            onRestoredValueConsumed={() => setPendingRestore("")}
            restoredAttachment={pendingRestoreAttachment}
            chatMode={chatMode}
            setChatMode={setChatMode}
          />
        </div>
      </div>

      <AnimatePresence>
        {activeArtifact && (
          <ArtifactViewer
            key="artifact-viewer"
            artifact={activeArtifact}
            versions={activeArtifactVersions}
            onSelectVersion={(artifact) => setActiveArtifact(artifact)}
            onClose={() => setActiveArtifact(null)}
            onEdit={(prompt) => {
              handleSend(prompt, buildInlineArtifactAttachment(activeArtifact));
            }}
            onRemoveBackground={() => {
              handleSend(
                JSON.stringify({
                  prompt:
                    "Supprime totalement le fond de cette image et retourne directement un PNG transparent pret a utiliser.",
                  selection: {
                    type: "image_refinement",
                    action: "remove_background",
                    image_url: activeArtifact.url,
                    image_name: activeArtifact.name,
                    extra: "L'utilisateur veut un detourage propre, simple et directement exploitable.",
                  },
                })
              );
            }}
            onChangeBackground={(background) => {
              handleSend(
                JSON.stringify({
                  prompt: `Remplace le fond de cette image par: ${background}. Garde le sujet principal intact et realiste.`,
                  selection: {
                    type: "image_refinement",
                    action: "change_background",
                    image_url: activeArtifact.url,
                    image_name: activeArtifact.name,
                    extra: background,
                  },
                })
              );
            }}
            onInpaint={(maskBase64) => {
              const base64Content = maskBase64.split(",")[1];
              handleSend(
                JSON.stringify({
                  prompt:
                    "Retouche uniquement la zone masquee de cette image. Utilise le masque joint comme masque utilisateur et conserve le reste intact.",
                  selection: {
                    type: "image_refinement",
                    action: "inpaint",
                    image_url: activeArtifact.url,
                    image_name: activeArtifact.name,
                    extra: "Le masque joint doit servir de zone blanche a modifier.",
                  },
                }),
                {
                  content: base64Content,
                  type: "image/png",
                  name: `mask_${activeArtifact.name}`,
                  dataUrl: maskBase64,
                },
                false
              );
              setActiveArtifact(null);
            }}
            onOutpaint={(ratio) => {
              handleSend(`Etends l'image ${activeArtifact.name} au format ${ratio} (Outpainting).`);
              setActiveArtifact(null);
            }}
          />
        )}
      </AnimatePresence>

      <div
        className={`absolute top-0 right-0 z-30 flex h-full w-full flex-col bg-[var(--surface-base)] transition-transform duration-300 md:w-[320px] md:border-l md:border-[var(--border-default)] ${
          showFilesPanel ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <FilesPanel
          conversationId={sessionId}
          token={token}
          compact
          onClose={() => setShowFilesPanel(false)}
          onOpenArtifact={(artifact) => setActiveArtifact(artifact)}
        />
      </div>
    </div>
  );
}
