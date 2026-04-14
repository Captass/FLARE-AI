"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, ImagePlus, Save, Upload, UserRound } from "lucide-react";
import { WorkspaceIdentity, toRenderableMediaUrl, updateUserProfileSettings, uploadIdentityAsset } from "@/lib/api";

interface IdentitySettingsSectionProps {
  token?: string | null;
  data: WorkspaceIdentity | null;
  userEmail?: string | null;
  fallbackDisplayName?: string;
  fallbackPhotoUrl?: string | null;
  onSaved?: (next: WorkspaceIdentity) => void;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Lecture image impossible."));
    reader.readAsDataURL(file);
  });
}

export default function IdentitySettingsSection({
  token,
  data,
  userEmail,
  fallbackDisplayName,
  fallbackPhotoUrl,
  onSaved,
}: IdentitySettingsSectionProps) {
  const userAvatarInputRef = useRef<HTMLInputElement | null>(null);
  const [profileSaving, setProfileSaving] = useState(false);
  const [feedback, setFeedback] = useState("");

  const [userProfile, setUserProfile] = useState({
    display_name: "",
    avatar_url: "",
    workspace_name: "",
  });
  const [userAvatarUpload, setUserAvatarUpload] = useState<{ file: File; preview: string } | null>(null);

  useEffect(() => {
    if (!data) return;
    setUserProfile({
      display_name: data.user_profile.display_name || fallbackDisplayName || "",
      avatar_url: data.user_profile.avatar_url || fallbackPhotoUrl || "",
      workspace_name: data.user_profile.workspace_name || "Mon compte",
    });
    setUserAvatarUpload(null);
    setFeedback("");
  }, [data, fallbackDisplayName, fallbackPhotoUrl]);

  const userAvatarPreview = userAvatarUpload?.preview || toRenderableMediaUrl(userProfile.avatar_url || fallbackPhotoUrl || undefined);

  const handleUserAvatarChange = async (file?: File | null) => {
    if (!file) return;
    const preview = await readFileAsDataUrl(file);
    setUserAvatarUpload({ file, preview });
  };

  const saveUserProfile = async () => {
    if (!token) return;
    setProfileSaving(true);
    setFeedback("");
    try {
      let avatarUrl = userProfile.avatar_url;
      if (userAvatarUpload) {
        const upload = await uploadIdentityAsset(
          {
            target: "user_avatar",
            file_name: userAvatarUpload.file.name,
            mime_type: userAvatarUpload.file.type,
            data_url: userAvatarUpload.preview,
          },
          token
        );
        avatarUrl = upload.url;
      }

      const next = await updateUserProfileSettings(
        {
          display_name: userProfile.display_name,
          workspace_name: userProfile.workspace_name,
          avatar_url: avatarUrl,
        },
        token
      );
      setUserAvatarUpload(null);
      setFeedback("Profil mis a jour.");
      onSaved?.(next);
    } catch (error) {
      console.error("Erreur sauvegarde profil:", error);
      setFeedback("Impossible de sauvegarder le profil.");
    } finally {
      setProfileSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in-up">
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.8fr)]">
        <div className="rounded-[28px] border border-[var(--border-glass)] bg-[var(--bg-card)] p-5 md:p-6">
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-orange-500/60">Apercu</p>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div className="rounded-[24px] border border-[var(--border-default)] bg-[var(--surface-subtle)] p-4 shadow-sm">
              <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--text-muted)]">Compte</p>
              <div className="mt-4 flex items-center gap-3">
                <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full border border-[var(--border-default)] bg-[var(--surface-raised)]">
                  {userAvatarPreview ? (
                    <img src={userAvatarPreview} alt="Photo de profil" className="h-full w-full object-cover" />
                  ) : (
                    <UserRound size={20} className="text-[var(--icon-muted)] opacity-60" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-base font-semibold text-[var(--text-primary)]">
                    {userProfile.display_name || fallbackDisplayName || "Utilisateur"}
                  </p>
                  <p className="mt-1 truncate text-sm text-[var(--text-muted)]">{userEmail || "Compte FLARE"}</p>
                </div>
              </div>
            </div>

            <div className="rounded-[24px] border border-[var(--border-default)] bg-[var(--surface-subtle)] p-4 shadow-sm">
              <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--text-muted)]">Nom de compte</p>
              <div className="mt-4">
                <p className="truncate text-base font-semibold text-[var(--text-primary)]">{userProfile.workspace_name || "Mon compte"}</p>
                <p className="mt-1 text-sm text-[var(--text-muted)]">Visible dans l&apos;app et les emails.</p>
              </div>
            </div>
          </div>
          {feedback ? <p className="mt-4 text-sm text-[var(--text-muted)]">{feedback}</p> : null}
        </div>

        <div className="rounded-[28px] border border-[var(--border-glass)] bg-[var(--bg-card)] p-5 md:p-6">
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-orange-500/60">Utilisation</p>
          <div className="mt-5 space-y-4 text-sm leading-6 text-[var(--text-muted)]">
            <p>Le nom, la photo et le nom de compte sont lies a ton profil.</p>
            <p>Chaque changement est sauvegarde dans le backend et repris au prochain chargement.</p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-[28px] border border-[var(--border-glass)] bg-[var(--bg-card)] p-5 md:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-orange-500/60">Profil</p>
              <h3 className="mt-3 text-xl font-semibold text-[var(--text-primary)]">Profil utilisateur</h3>
              <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
                Modifie ton nom, ta photo et le nom de ton compte.
              </p>
            </div>
            <button
              onClick={() => userAvatarInputRef.current?.click()}
              className="ui-btn ui-btn-secondary !min-h-0 !px-3 !py-2"
            >
              <ImagePlus size={16} />
              Photo
            </button>
          </div>

          <div className="mt-5 flex items-center gap-4">
            <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border border-[var(--border-default)] bg-[var(--surface-subtle)] shadow-sm">
              {userAvatarPreview ? (
                <img src={userAvatarPreview} alt="Photo utilisateur" className="h-full w-full object-cover" />
              ) : (
                <Camera size={24} className="text-[var(--icon-muted)] opacity-60" />
              )}
            </div>
            <div className="text-sm text-[var(--text-muted)]">
              <p>Image carree recommandee.</p>
              <p>PNG, JPG ou WebP, jusqu&apos;a 3 MB.</p>
            </div>
          </div>

          <input
            ref={userAvatarInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            className="hidden"
            onChange={(event) => void handleUserAvatarChange(event.target.files?.[0] || null)}
          />

          <div className="mt-6 space-y-4">
            <div>
              <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                Nom affiche
              </label>
              <input
                value={userProfile.display_name}
                onChange={(event) => setUserProfile((current) => ({ ...current, display_name: event.target.value }))}
                className="w-full rounded-2xl border border-[var(--border-default)] bg-[var(--surface-subtle)] px-4 py-3 text-sm text-[var(--text-primary)] outline-none transition-colors focus:border-orange-500/30 focus:shadow-sm"
                placeholder="Ton nom dans l'app"
              />
            </div>

            <div>
              <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                Nom du compte
              </label>
              <input
                value={userProfile.workspace_name}
                onChange={(event) => setUserProfile((current) => ({ ...current, workspace_name: event.target.value }))}
                className="w-full rounded-2xl border border-[var(--border-default)] bg-[var(--surface-subtle)] px-4 py-3 text-sm text-[var(--text-primary)] outline-none transition-colors focus:border-orange-500/30 focus:shadow-sm"
                placeholder="Mon compte"
              />
            </div>
          </div>

          <button
            onClick={() => void saveUserProfile()}
            disabled={profileSaving}
            className="ui-btn ui-btn-primary mt-6"
          >
            {profileSaving ? <Upload size={16} className="animate-pulse" /> : <Save size={16} />}
            Enregistrer le profil
          </button>
        </div>
      </section>
    </div>
  );
}
