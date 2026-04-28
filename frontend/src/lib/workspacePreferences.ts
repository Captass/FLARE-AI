"use client";

export type FlareWorkspaceId = "business" | "enterprise" | "executive";

export const FLARE_WORKSPACE_STORAGE_KEY = "flare-selected-workspace";
export const FLARE_WORKSPACE_EVENT = "flare-workspace-change";
export const FLARE_MODULE_PREFS_STORAGE_KEY = "flare-visible-modules";

export function emitWorkspaceChange(workspace: FlareWorkspaceId | null) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(FLARE_WORKSPACE_EVENT, { detail: { workspace } }));
}
