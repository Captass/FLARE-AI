"use client";

import { useState, useMemo } from "react";
import { X, Plus, Folder as FolderIcon, MessageSquare, Check, Trash2 } from "lucide-react";
import { Conversation, Folder } from "@/lib/api";

interface SpaceManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  folders: Folder[];
  conversations: Conversation[];
  onAddFolder: (name: string) => Promise<void>;
  onRemoveFolder: (id: string) => Promise<void>;
  onMoveConversation: (convId: string, folderId: string | null) => Promise<void>;
}

export default function SpaceManagerModal({
  isOpen,
  onClose,
  folders,
  conversations,
  onAddFolder,
  onRemoveFolder,
  onMoveConversation,
}: SpaceManagerModalProps) {
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [newFolderName, setNewFolderName] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const folderConversations = useMemo(() => {
    if (!selectedFolderId) return [];
    return conversations.filter((c) => c.folder_id === selectedFolderId);
  }, [conversations, selectedFolderId]);

  const availableConversations = useMemo(() => {
    if (!selectedFolderId) return [];
    return conversations.filter((c) => c.folder_id !== selectedFolderId);
  }, [conversations, selectedFolderId]);

  if (!isOpen) return null;

  const handleCreateSpace = async () => {
    if (newFolderName.trim()) {
      await onAddFolder(newFolderName.trim());
      setNewFolderName("");
      setIsCreating(false);
    }
  };

  const handleToggle = async (conv: Conversation) => {
    if (!selectedFolderId) return;
    if (conv.folder_id === selectedFolderId) {
      await onMoveConversation(conv.id, null);
    } else {
      await onMoveConversation(conv.id, selectedFolderId);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-[640px] max-h-[80vh] flex flex-col rounded-2xl bg-[rgba(10,12,18,0.97)] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 shrink-0">
          <div>
            <p className="text-[10px] uppercase tracking-[0.16em] text-white/30">Organisation</p>
            <h2 className="mt-1 text-[20px] font-semibold tracking-tight text-white">
              Gestion des espaces
            </h2>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-white/30 hover:text-white/60 hover:bg-white/[0.04] transition-all"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="flex flex-1 overflow-hidden min-h-0">
          {/* Left — Folders */}
          <div className="w-[200px] shrink-0 border-r border-white/[0.04] flex flex-col">
            <div className="flex items-center justify-between px-4 py-3">
              <p className="text-[10px] uppercase tracking-[0.14em] text-white/25 font-medium">Espaces</p>
              <button
                onClick={() => setIsCreating(true)}
                className="flex h-6 w-6 items-center justify-center rounded-md text-white/30 hover:text-white/60 hover:bg-white/[0.04] transition-all"
              >
                <Plus size={12} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-2 pb-4 space-y-0.5">
              {isCreating && (
                <div className="flex items-center gap-1.5 px-2 py-1.5 mb-1">
                  <input
                    autoFocus
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleCreateSpace();
                      if (e.key === "Escape") { setIsCreating(false); setNewFolderName(""); }
                    }}
                    placeholder="Nom..."
                    className="flex-1 min-w-0 bg-white/[0.04] rounded-lg px-2 py-1.5 text-[12px] text-white outline-none placeholder:text-white/20"
                  />
                  <button onClick={handleCreateSpace} className="p-1 text-green-400/60 hover:text-green-400">
                    <Check size={12} />
                  </button>
                  <button onClick={() => { setIsCreating(false); setNewFolderName(""); }} className="p-1 text-white/20 hover:text-white/40">
                    <X size={12} />
                  </button>
                </div>
              )}

              {folders.length === 0 && !isCreating && (
                <p className="px-3 py-6 text-center text-[11px] text-white/20">Aucun espace</p>
              )}

              {folders.map((folder) => {
                const count = conversations.filter((c) => c.folder_id === folder.id).length;
                const isSelected = selectedFolderId === folder.id;

                return (
                  <button
                    key={folder.id}
                    onClick={() => setSelectedFolderId(folder.id)}
                    className={`group w-full flex items-center gap-2 rounded-lg px-3 py-2 text-left transition-all ${
                      isSelected
                        ? "bg-white/[0.06] text-white"
                        : "text-white/30 hover:bg-white/[0.03] hover:text-white/50"
                    }`}
                  >
                    <FolderIcon size={13} className="shrink-0" />
                    <span className="flex-1 text-[12px] font-medium truncate">{folder.name}</span>
                    <span className="text-[10px] text-white/20">{count}</span>
                    {isSelected && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemoveFolder(folder.id);
                          if (selectedFolderId === folder.id) setSelectedFolderId(null);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-0.5 text-white/20 hover:text-red-400 transition-all"
                      >
                        <Trash2 size={11} />
                      </button>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right — Conversations */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {!selectedFolderId ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
                <FolderIcon size={24} className="text-white/15 mb-3" />
                <p className="text-[13px] text-white/30">Selectionnez un espace</p>
                <p className="text-[11px] text-white/15 mt-1">pour organiser vos discussions</p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {/* In folder */}
                <div>
                  <p className="text-[10px] uppercase tracking-[0.14em] text-white/25 font-medium mb-2 px-1">
                    Dans cet espace ({folderConversations.length})
                  </p>
                  {folderConversations.length === 0 ? (
                    <p className="text-[11px] text-white/15 px-1">Aucune discussion</p>
                  ) : (
                    <div className="space-y-1">
                      {folderConversations.map((conv) => (
                        <div
                          key={conv.id}
                          className="group flex items-center gap-2 rounded-lg px-3 py-2 bg-white/[0.03] hover:bg-white/[0.05] transition-all"
                        >
                          <MessageSquare size={12} className="text-white/30 shrink-0" />
                          <span className="flex-1 text-[12px] text-white/60 truncate">{conv.title}</span>
                          <button
                            onClick={() => handleToggle(conv)}
                            className="opacity-0 group-hover:opacity-100 text-[10px] text-red-400/60 hover:text-red-400 transition-all"
                          >
                            Retirer
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Available */}
                {availableConversations.length > 0 && (
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.14em] text-white/20 font-medium mb-2 px-1">
                      Disponibles ({availableConversations.length})
                    </p>
                    <div className="space-y-1">
                      {availableConversations.map((conv) => {
                        const hostFolder = folders.find((f) => f.id === conv.folder_id);
                        return (
                          <button
                            key={conv.id}
                            onClick={() => handleToggle(conv)}
                            className="group w-full flex items-center gap-2 rounded-lg px-3 py-2 text-left hover:bg-white/[0.03] transition-all"
                          >
                            <MessageSquare size={12} className="text-white/15 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <span className="block text-[12px] text-white/40 group-hover:text-white/60 truncate transition-colors">
                                {conv.title}
                              </span>
                              {hostFolder && (
                                <span className="block text-[10px] text-white/15 truncate">
                                  Dans {hostFolder.name}
                                </span>
                              )}
                            </div>
                            <span className="opacity-0 group-hover:opacity-100 text-[10px] text-green-400/60 transition-all">
                              Ajouter
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
