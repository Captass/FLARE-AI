"use client";

import { useRef, useState, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Plus, MessageSquare } from "lucide-react";
import ChatWindow from "@/components/ChatWindow";
import MessageInput from "@/components/MessageInput";
import ArtifactViewer, { Artifact } from "@/components/ArtifactViewer";
import FilesPanel from "@/components/FilesPanel";
import { FileAttachment } from "@/lib/api";
import { saveTrackedFile } from "@/lib/api";

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
  chatMode: "raisonnement" | "rapide" | "creative" | "pro";
  setChatMode: (mode: "raisonnement" | "rapide" | "creative" | "pro") => void;
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
  folders,
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
        const kind = att.type?.startsWith("image/") ? "image"
          : att.type?.startsWith("audio/") ? "audio"
          : att.name?.match(/\.(pdf|docx)$/i) ? "document"
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
    [send, sessionId, activeConvTitle, chatMode]
  );

  const handleStop = useCallback(() => {
    const lastUserMsg = messages.filter((m) => m.role === "user").at(-1);
    if (lastUserMsg?.content) setPendingRestore(lastUserMsg.content);
    if (lastSentAttachmentRef.current) setPendingRestoreAttachment(lastSentAttachmentRef.current);
    stop();
  }, [messages, stop]);

  const buildInlineArtifactAttachment = useCallback((artifact: Artifact | null): FileAttachment | undefined => {
    const inlineUrl = artifact?.url?.startsWith("data:")
      ? artifact.url
      : artifact?.data?.startsWith("data:")
      ? artifact.data
      : undefined;
    if (!inlineUrl) return undefined;
    const match = inlineUrl.match(/^data:(.*?);base64,(.*)$/);
    if (!match) return undefined;
    return {
      content: match[2],
      type: match[1] || "application/octet-stream",
      name: artifact?.name || "artifact",
      dataUrl: inlineUrl,
    };
  }, []);

  return (
    <div className="flex flex-1 overflow-hidden relative">
      {/* ── Sidebar Historique (Gauche - 280px) ── */}
      <div className="hidden md:flex w-[280px] shrink-0 flex-col border-r border-[var(--border-glass)] bg-[var(--bg-glass)]/20 backdrop-blur-md z-10 transition-all duration-300">
        <div className="p-4">
          <button
            onClick={onNewChat}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-orange-500/10 text-orange-400 font-medium py-2.5 hover:bg-orange-500/20 transition-all border border-orange-500/20 shadow-[0_0_15px_rgba(249,115,22,0.1)] hover:shadow-[0_0_20px_rgba(249,115,22,0.2)]"
          >
            <Plus size={16} /> Nouvelle discussion
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-2 pb-4 space-y-1">
          {conversations?.map((conv) => (
             <button
               key={conv.id}
               onClick={() => onSelectConversation?.(conv.id)}
               className={`w-full flex flex-col items-start gap-1 px-3 py-2.5 rounded-xl text-left transition-all duration-200 border ${
                 conv.id === sessionId 
                  ? 'bg-white/10 text-white border-white/10 shadow-[var(--shadow-card)]' 
                  : 'text-white/50 border-transparent hover:bg-white/[0.04] hover:text-white/80'
               }`}
             >
               <div className="flex items-center gap-2 w-full">
                 <MessageSquare size={14} className={conv.id === sessionId ? "text-orange-400" : "text-white/30"} />
                 <span className="text-sm font-medium truncate flex-1 leading-tight">{conv.title || "Nouvelle discussion"}</span>
               </div>
               <span className={`text-[10px] pl-6 font-medium ${conv.id === sessionId ? 'text-white/40' : 'text-white/20'}`}>
                 {new Date(conv.updated_at || conv.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
               </span>
             </button>
          ))}
        </div>
      </div>

      {/* Colonne de Chat */}
      <div
        className={`flex flex-col flex-1 min-w-0 transition-all duration-300 ${
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
        <div className="w-full max-w-3xl mx-auto px-2 md:px-4 pb-4 md:pb-6 mt-auto chat-input-mobile safe-bottom shrink-0 bg-[var(--background)]">
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

      {/* Artifact Viewer (Side-by-side) */}
      <AnimatePresence>
        {activeArtifact && (
          <ArtifactViewer
            key="artifact-viewer"
            artifact={activeArtifact}
            versions={activeArtifactVersions}
            onSelectVersion={(art) => setActiveArtifact(art)}
            onClose={() => setActiveArtifact(null)}
            onEdit={(prompt) => {
              handleSend(prompt, buildInlineArtifactAttachment(activeArtifact));
            }}
            onRemoveBackground={() => {
              handleSend(
                JSON.stringify({
                  prompt:
                    "Supprime totalement le fond de cette image et retourne directement un PNG transparent prêt à utiliser.",
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
                  prompt: `Remplace le fond de cette image par: ${background}. Garde le sujet principal intact et réaliste.`,
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
                    "Retouche uniquement la zone masquée de cette image. Utilise le masque joint comme masque utilisateur et conserve le reste intact.",
                  selection: {
                    type: "image_refinement",
                    action: "inpaint",
                    image_url: activeArtifact.url,
                    image_name: activeArtifact.name,
                    extra: "Le masque joint doit servir de zone blanche à modifier.",
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
              handleSend(`Étends l'image ${activeArtifact.name} au format ${ratio} (Outpainting).`);
              setActiveArtifact(null);
            }}
          />
        )}
      </AnimatePresence>

      {/* Panneau de fichiers (coulissant à droite) */}
      <div
        className={`absolute top-0 right-0 h-full w-full md:w-[320px] md:border-l md:border-[var(--border-glass)] bg-[var(--bg-sidebar)] backdrop-blur-[40px] transition-transform duration-300 z-30 flex flex-col ${
          showFilesPanel ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <FilesPanel
          conversationId={sessionId}
          token={token}
          compact={true}
          onClose={() => setShowFilesPanel(false)}
          onOpenArtifact={(artifact) => setActiveArtifact(artifact)}
        />
      </div>
    </div>
  );
}
