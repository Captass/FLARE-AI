"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Building2, Camera, ImagePlus, Save, Upload, UserRound } from "lucide-react";
import {
  OrganizationBrandingSettings,
  WorkspaceIdentity,
  toRenderableMediaUrl,
  updateOrganizationBrandingSettings,
  updateUserProfileSettings,
  uploadIdentityAsset,
} from "@/lib/api";

interface IdentitySettingsSectionProps {
  token?: string | null;
  data: WorkspaceIdentity | null;
  userEmail?: string | null;
  fallbackDisplayName?: string;
  fallbackPhotoUrl?: string | null;
  hasSharedOrganizations?: boolean;
  onOpenOrganizationAccess?: () => void;
  onSaved?: (next: WorkspaceIdentity) => void;
}

const EMPTY_ORG: OrganizationBrandingSettings = {
  organization_name: "",
  logo_url: "",
  workspace_name: "",
  workspace_description: "",
};

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
  hasSharedOrganizations = false,
  onOpenOrganizationAccess,
  onSaved,
}: IdentitySettingsSectionProps) {
  const userAvatarInputRef = useRef<HTMLInputElement | null>(null);
  const orgLogoInputRef = useRef<HTMLInputElement | null>(null);

  const [profileSaving, setProfileSaving] = useState(false);
  const [organizationSaving, setOrganizationSaving] = useState(false);
  const [feedback, setFeedback] = useState("");

  const [userProfile, setUserProfile] = useState({
    display_name: "",
    avatar_url: "",
    workspace_name: "",
  });
  const [organizationBranding, setOrganizationBranding] = useState<OrganizationBrandingSettings>(EMPTY_ORG);
  const [userAvatarUpload, setUserAvatarUpload] = useState<{ file: File; preview: string } | null>(null);
  const [orgLogoUpload, setOrgLogoUpload] = useState<{ file: File; preview: string } | null>(null);

  useEffect(() => {
    if (!data) return;

    setUserProfile({
      display_name: data.user_profile.display_name || fallbackDisplayName || "",
      avatar_url: data.user_profile.avatar_url || fallbackPhotoUrl || "",
      workspace_name: data.user_profile.workspace_name || "Mon espace",
    });
    setOrganizationBranding(data.organization_branding || EMPTY_ORG);
    setUserAvatarUpload(null);
    setOrgLogoUpload(null);
    setFeedback("");
  }, [data, fallbackDisplayName, fallbackPhotoUrl]);

  const userAvatarPreview = userAvatarUpload?.preview || toRenderableMediaUrl(userProfile.avatar_url || fallbackPhotoUrl || undefined);
  const orgLogoPreview = orgLogoUpload?.preview || toRenderableMediaUrl(organizationBranding.logo_url || undefined);
  const isOrganizationActive = data?.current_branding.scope_type === "organization";

  const previewBrandName = useMemo(() => {
    if (data?.current_branding.scope_type === "organization") {
      return organizationBranding.organization_name || data.current_branding.brand_name;
    }
    return "FLARE AI";
  }, [data, organizationBranding.organization_name]);

  const previewWorkspaceName = useMemo(() => {
    if (data?.current_branding.scope_type === "organization") {
      return organizationBranding.workspace_name || data.current_branding.workspace_name;
    }
    return userProfile.workspace_name || data?.current_branding.workspace_name || "Mon espace";
  }, [data, organizationBranding.workspace_name, userProfile.workspace_name]);

  const handleUserAvatarChange = async (file?: File | null) => {
    if (!file) return;
    const preview = await readFileAsDataUrl(file);
    setUserAvatarUpload({ file, preview });
  };

  const handleOrgLogoChange = async (file?: File | null) => {
    if (!file) return;
    const preview = await readFileAsDataUrl(file);
    setOrgLogoUpload({ file, preview });
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

  const saveOrganizationBranding = async () => {
    if (!token || !data?.can_edit_organization) return;

    setOrganizationSaving(true);
    setFeedback("");
    try {
      let logoUrl = organizationBranding.logo_url;
      if (orgLogoUpload) {
        const upload = await uploadIdentityAsset(
          {
            target: "organization_logo",
            file_name: orgLogoUpload.file.name,
            mime_type: orgLogoUpload.file.type,
            data_url: orgLogoUpload.preview,
          },
          token
        );
        logoUrl = upload.url;
      }

      const next = await updateOrganizationBrandingSettings(
        {
          organization_name: organizationBranding.organization_name,
          workspace_name: organizationBranding.workspace_name,
          workspace_description: organizationBranding.workspace_description,
          logo_url: logoUrl,
        },
        token
      );
      setOrgLogoUpload(null);
      setFeedback("Organisation mise a jour.");
      onSaved?.(next);
    } catch (error) {
      console.error("Erreur sauvegarde organisation:", error);
      setFeedback("Impossible de sauvegarder l'organisation.");
    } finally {
      setOrganizationSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in-up">
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.8fr)]">
        <div className="rounded-[28px] border border-[var(--border-glass)] bg-[var(--bg-card)] p-5 md:p-6">
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-orange-500/60">Apercu</p>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div className="rounded-[24px] border border-white/8 bg-black/20 p-4">
              <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--text-muted)]">Espace actif</p>
              <div className="mt-4 flex items-center gap-3">
                <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-[18px] border border-white/10 bg-white/[0.04]">
                  {orgLogoPreview ? (
                    <img src={orgLogoPreview} alt="Logo organisation" className="h-full w-full object-cover" />
                  ) : (
                    <Building2 size={20} className="text-white/70" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-base font-semibold text-white">{previewBrandName}</p>
                  <p className="mt-1 truncate text-sm text-[var(--text-muted)]">{previewWorkspaceName}</p>
                  {isOrganizationActive && data?.organization_role_label ? (
                    <p className="mt-2 text-xs uppercase tracking-[0.16em] text-[var(--text-muted)]">
                      Role : {data.organization_role_label}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="rounded-[24px] border border-white/8 bg-black/20 p-4">
              <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--text-muted)]">Profil utilisateur</p>
              <div className="mt-4 flex items-center gap-3">
                <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-white/[0.06]">
                  {userAvatarPreview ? (
                    <img src={userAvatarPreview} alt="Photo de profil" className="h-full w-full object-cover" />
                  ) : (
                    <UserRound size={20} className="text-white/70" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-base font-semibold text-white">
                    {userProfile.display_name || fallbackDisplayName || "Utilisateur"}
                  </p>
                  <p className="mt-1 truncate text-sm text-[var(--text-muted)]">{userEmail || "Compte FLARE"}</p>
                </div>
              </div>
            </div>
          </div>
          {feedback ? <p className="mt-4 text-sm text-[var(--text-muted)]">{feedback}</p> : null}
        </div>

        <div className="rounded-[28px] border border-[var(--border-glass)] bg-[var(--bg-card)] p-5 md:p-6">
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-orange-500/60">Utilisation</p>
          <div className="mt-5 space-y-4 text-sm leading-6 text-[var(--text-muted)]">
            <p>Le nom, la photo et l&apos;espace personnel suivent votre compte.</p>
            <p>Le logo et le nom de l&apos;organisation s&apos;appliquent a tous les membres connectes a cet espace.</p>
            <p>Chaque changement est sauvegarde dans le backend et repris au prochain chargement.</p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-[28px] border border-[var(--border-glass)] bg-[var(--bg-card)] p-5 md:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-orange-500/60">Vous</p>
              <h3 className="mt-3 text-xl font-semibold text-[var(--text-primary)]">Profil utilisateur</h3>
              <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
                Modifiez votre nom, votre photo et le nom de votre espace personnel.
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
            <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-white/[0.04]">
              {userAvatarPreview ? (
                <img src={userAvatarPreview} alt="Photo utilisateur" className="h-full w-full object-cover" />
              ) : (
                <Camera size={24} className="text-white/65" />
              )}
            </div>
            <div className="text-sm text-[var(--text-muted)]">
              <p>Image carrée recommandée.</p>
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
                className="w-full rounded-2xl border border-white/8 bg-black/20 px-4 py-3 text-sm text-white outline-none transition-colors focus:border-orange-500/30"
                placeholder="Votre nom dans l'app"
              />
            </div>

            <div>
              <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                Espace personnel
              </label>
              <input
                value={userProfile.workspace_name}
                onChange={(event) => setUserProfile((current) => ({ ...current, workspace_name: event.target.value }))}
                className="w-full rounded-2xl border border-white/8 bg-black/20 px-4 py-3 text-sm text-white outline-none transition-colors focus:border-orange-500/30"
                placeholder="Mon espace"
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

        <div className="rounded-[28px] border border-[var(--border-glass)] bg-[var(--bg-card)] p-5 md:p-6">
          {data?.can_edit_organization ? (
            <>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-orange-500/60">Organisation</p>
                  <h3 className="mt-3 text-xl font-semibold text-[var(--text-primary)]">Identite de l&apos;espace</h3>
                  <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
                    Le logo, le nom et le libelle d&apos;espace s&apos;appliquent a tous les membres.
                  </p>
                </div>
                <button
                  onClick={() => orgLogoInputRef.current?.click()}
                  className="ui-btn ui-btn-secondary !min-h-0 !px-3 !py-2"
                >
                  <ImagePlus size={16} />
                  Logo
                </button>
              </div>

              <div className="mt-5 flex items-center gap-4">
                <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-[24px] border border-white/10 bg-white/[0.04]">
                  {orgLogoPreview ? (
                    <img src={orgLogoPreview} alt="Logo organisation" className="h-full w-full object-cover" />
                  ) : (
                    <Building2 size={24} className="text-white/65" />
                  )}
                </div>
                <div className="text-sm text-[var(--text-muted)]">
                  <p>Logo principal de l&apos;organisation.</p>
                  <p>Il remonte dans l&apos;app quand cet espace est actif.</p>
                </div>
              </div>

              <input
                ref={orgLogoInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                className="hidden"
                onChange={(event) => void handleOrgLogoChange(event.target.files?.[0] || null)}
              />

              <div className="mt-6 space-y-4">
                <div>
                  <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                    Nom de l&apos;organisation
                  </label>
                  <input
                    value={organizationBranding.organization_name}
                    onChange={(event) =>
                      setOrganizationBranding((current) => ({ ...current, organization_name: event.target.value }))
                    }
                    className="w-full rounded-2xl border border-white/8 bg-black/20 px-4 py-3 text-sm text-white outline-none transition-colors focus:border-orange-500/30"
                    placeholder="FLARE AI"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                    Nom de l&apos;espace
                  </label>
                  <input
                    value={organizationBranding.workspace_name}
                    onChange={(event) =>
                      setOrganizationBranding((current) => ({ ...current, workspace_name: event.target.value }))
                    }
                    className="w-full rounded-2xl border border-white/8 bg-black/20 px-4 py-3 text-sm text-white outline-none transition-colors focus:border-orange-500/30"
                    placeholder="Pilotage FLARE AI"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                    Description courte
                  </label>
                  <textarea
                    value={organizationBranding.workspace_description}
                    onChange={(event) =>
                      setOrganizationBranding((current) => ({
                        ...current,
                        workspace_description: event.target.value,
                      }))
                    }
                    className="min-h-[108px] w-full resize-none rounded-2xl border border-white/8 bg-black/20 px-4 py-3 text-sm text-white outline-none transition-colors focus:border-orange-500/30"
                    placeholder="Espace partage pour l'equipe."
                  />
                </div>
              </div>

              <button
                onClick={() => void saveOrganizationBranding()}
                disabled={organizationSaving}
                className="ui-btn ui-btn-primary mt-6"
              >
                {organizationSaving ? <Upload size={16} className="animate-pulse" /> : <Save size={16} />}
                Enregistrer l&apos;organisation
              </button>
            </>
          ) : isOrganizationActive ? (
            <div className="flex h-full flex-col justify-between rounded-[24px] border border-white/8 bg-black/20 p-5">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-orange-500/60">Organisation</p>
                <h3 className="mt-3 text-xl font-semibold text-white">Espace actif en lecture</h3>
                <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">
                  Vous etes bien connecte a cette organisation, mais seul un proprietaire ou un admin peut changer le logo, le nom et l&apos;espace partage.
                </p>
              </div>

              <div className="mt-6 rounded-[20px] border border-white/8 bg-white/[0.03] p-4">
                <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--text-muted)]">Votre role</p>
                <p className="mt-3 text-base font-semibold text-white">{data.organization_role_label || "Membre"}</p>
                <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
                  Vous utilisez cet espace et ses modules, mais l&apos;identite visuelle est geree par l&apos;equipe responsable.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex h-full flex-col justify-between rounded-[24px] border border-white/8 bg-black/20 p-5">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-orange-500/60">Organisation</p>
                <h3 className="mt-3 text-xl font-semibold text-white">Espace non actif</h3>
                <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">
                  Connectez une organisation pour modifier son logo, son nom et son espace de travail partage.
                </p>
              </div>

              <div className="mt-6 space-y-3">
                {hasSharedOrganizations ? (
                  <button onClick={onOpenOrganizationAccess} className="ui-btn ui-btn-secondary">
                    <Building2 size={16} />
                    Choisir l&apos;organisation
                  </button>
                ) : null}
                <p className="text-xs leading-6 text-[var(--text-muted)]">
                  Le profil utilisateur reste modifiable a tout moment, meme sans organisation active.
                </p>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
