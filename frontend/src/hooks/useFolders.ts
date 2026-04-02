import { useState, useCallback, useEffect } from "react";
import { Folder, getFolders, createFolder, updateFolder, deleteFolder } from "@/lib/api";

export function useFolders(authToken?: string | null) {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchFolders = useCallback(async () => {
    if (!authToken) return;
    setLoading(true);
    try {
      const data = await getFolders(authToken);
      setFolders(data);
      setError(null);
    } catch (err: any) {
      console.error("Failed to fetch folders:", err);
      setError("Erreur lors du chargement des dossiers.");
    } finally {
      setLoading(false);
    }
  }, [authToken]);

  useEffect(() => {
    fetchFolders();
  }, [fetchFolders]);

  const addFolder = async (name: string, color?: string) => {
    if (!authToken) return null;
    try {
      const newFolder = await createFolder(name, color, authToken);
      setFolders((prev) => [...prev, newFolder]);
      return newFolder;
    } catch (err) {
      console.error("Failed to create folder:", err);
      throw err;
    }
  };

  const editFolder = async (id: string, name?: string, color?: string) => {
    if (!authToken) return null;
    try {
      const updated = await updateFolder(id, name, color, authToken);
      setFolders((prev) => prev.map((f) => (f.id === id ? updated : f)));
      return updated;
    } catch (err) {
      console.error("Failed to update folder:", err);
      throw err;
    }
  };

  const removeFolder = async (id: string) => {
    if (!authToken) return;
    try {
      await deleteFolder(id, authToken);
      setFolders((prev) => prev.filter((f) => f.id !== id));
    } catch (err) {
      console.error("Failed to delete folder:", err);
      throw err;
    }
  };

  return { folders, loading, error, fetchFolders, addFolder, editFolder, removeFolder };
}
