"use client";

import { useState, useCallback, useEffect } from "react";
import {
  Conversation,
  listConversations,
  renameConversation,
  deleteConversation,
  archiveConversation,
} from "@/lib/api";

export function useConversations(token?: string | null) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await listConversations(token);
      setConversations(data);
    } catch (error) {
      console.error("Erreur chargement conversations:", error);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const rename = useCallback(
    async (id: string, newTitle: string, folder_id?: string | null) => {
      await renameConversation(id, newTitle, folder_id, token);
      setConversations((prev) =>
        prev.map((c) => (c.id === id ? { ...c, title: newTitle, folder_id: folder_id === null ? undefined : folder_id } : c))
      );
    },
    [token]
  );

  const remove = useCallback(
    async (id: string) => {
      // Optimistic update
      const backup = [...conversations];
      setConversations((prev) => prev.filter((c) => c.id !== id));
      try {
        await deleteConversation(id, token);
      } catch (error) {
        console.error("Delete failed:", error);
        setConversations(backup);
      }
    },
    [token, conversations]
  );

  const archive = useCallback(
    async (id: string) => {
      // Optimistic update
      const backup = [...conversations];
      setConversations((prev) => prev.filter((c) => c.id !== id));
      try {
        await archiveConversation(id, token);
      } catch (error) {
        console.error("Archive failed:", error);
        setConversations(backup);
      }
    },
    [token, conversations]
  );

  return { conversations, loading, refresh, rename, remove, archive };
}
