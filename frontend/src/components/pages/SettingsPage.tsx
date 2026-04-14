"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Sun,
  Moon,
  Globe,
  LogOut,
  Camera,
  Check,
  Loader2,
  ChevronRight,
  Send,
  KeyRound,
  UserCircle,
  Palette,
  AlertCircle,
  Bot,
} from "lucide-react";
import {
  WorkspaceIdentity,
  updateUserProfileSettings,
  uploadIdentityAsset,
} from "@/lib/api";
import type { User as FirebaseUser } from "firebase/auth";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "@/lib/firebase";

// ─── Types ────────────────────────────────────────────────────────────────────

type Lang = "fr" | "en";

interface SettingsPageProps {
  user?: FirebaseUser | null;
  token?: string | null;
  getFreshToken?: (forceRefresh?: boolean) => Promise<string | null>;
  workspaceIdentity?: WorkspaceIdentity | null;
  displayName: string;
  avatarUrl?: string;
  theme?: "dark" | "light";
  onLogout?: () => void;
  onIdentitySaved?: (next: WorkspaceIdentity) => void;
  lang?: Lang;
  onLangChange?: (l: Lang) => void;
}

// ─── i18n minimal ─────────────────────────────────────────────────────────────

const T = {
  fr: {
    title: "Paramètres",
    appearance: "Apparence",
    dark: "Sombre",
    light: "Clair",
    darkDesc: "Interface optimisée pour les environnements peu éclairés",
    lightDesc: "Interface plus lumineuse, idéale en plein jour",
    language: "Langue",
    langFr: "Français",
    langEn: "Anglais",
    langHint: "Sélectionnez la langue de l'interface",
    account: "Compte",
    logout: "Se déconnecter",
    avatarHint: "PNG, JPG ou WebP · max 3 MB",
    avatarChange: "Cliquer sur la photo pour modifier",
    errorSave: "Erreur lors de la sauvegarde. Réessayez.",
    errorAuth: "Vous devez être connecté pour sauvegarder.",
    errorPwd: "Impossible d'envoyer l'email. Vérifiez votre connexion.",
    errorPwdEmail: "Aucun email associé à ce compte.",
    accountRoleHint: "Pour modifier le compte, contactez un admin.",
    guideAssistant: "Assistant d'aide",
    guideAssistantDesc:
      "Affiche un petit assistant en bas a droite pour t'expliquer chaque page et te dire quoi faire ensuite.",
    guideAssistantSaving: "Mise a jour...",
  },
  en: {
    title: "Settings",
    subtitle: "Manage your account and preferences",
    profile: "My Profile",
    displayName: "Display name",
    displayNameHint: "Visible across the whole application",
    fullName: "Full name",
    fullNameHint: "Your first and last name",
    email: "Email",
    save: "Save",
    saving: "Saving…",
    saved: "Saved!",
    security: "Security",
    passwordLabel: "Password",
    sendReset: "Send a reset link",
    sending: "Sending…",
    resetSent: "Link sent to",
    compte: "Compte",
    appearance: "Appearance",
    dark: "Dark",
    light: "Light",
    darkDesc: "Optimised for low-light environments",
    lightDesc: "Brighter interface, ideal in daylight",
    language: "Language",
    langFr: "French",
    langEn: "English",
    langHint: "Select the interface language",
    account: "Account",
    logout: "Log out",
    avatarHint: "PNG, JPG or WebP · max 3 MB",
    avatarChange: "Click the photo to change it",
    errorSave: "Error saving. Please try again.",
    errorAuth: "You must be logged in to save.",
    errorPwd: "Unable to send the email. Check your connection.",
    errorPwdEmail: "No email associated with this account.",
    accountRoleHint: "Contact an administrator to modify the compte.",
    guideAssistant: "Help assistant",
    guideAssistantDesc:
      "Show a small helper in the bottom-right corner to explain each page and what to do next.",
    guideAssistantSaving: "Updating...",
  },
} as const;

// ─── UI components ─────────────────────────────────────────────────────────────

function SectionCard({
  icon: Icon,
  title,
  children,
  delay = 0,
}: {
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
  delay?: number;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, ease: [0.16, 1, 0.3, 1], duration: 0.35 }}
      className="rounded-2xl bg-[var(--surface-base)] border border-[var(--border-default)]
                 shadow-[var(--shadow-card)] overflow-hidden"
    >
      <div className="flex items-center gap-3 px-6 py-4 border-b border-[var(--border-default)]">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-500/10">
          <Icon size={15} className="text-orange-400" />
        </div>
        <h2 className="text-sm font-semibold uppercase tracking-[0.1em] text-[var(--text-secondary)]">{title}</h2>
      </div>
      <div className="px-6 py-5 space-y-5">{children}</div>
    </motion.section>
  );
}

function FieldRow({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-4">
      <div className="sm:w-40 shrink-0 pt-0.5">
        <span className="text-sm font-medium text-[var(--text-primary)]">{label}</span>
        {hint && <p className="mt-0.5 text-xs leading-tight text-[var(--text-secondary)]">{hint}</p>}
      </div>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

function TextInput({
  id,
  value,
  onChange,
  placeholder,
  disabled = false,
}: {
  id: string;
  value: string;
  onChange?: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <input
      id={id}
      type="text"
      value={value}
      disabled={disabled}
      onChange={(e) => onChange?.(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-xl border border-[var(--border-default)] bg-[var(--surface-subtle)]
                 px-4 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)]
                 focus:outline-none focus:border-orange-500/40 focus:bg-[var(--surface-raised)]
                 disabled:opacity-40 disabled:cursor-not-allowed
                 transition-all duration-150"
    />
  );
}

function SaveBtn({
  saving,
  saved,
  onClick,
  label,
}: {
  saving: boolean;
  saved: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={saving}
      className="flex items-center gap-2 rounded-xl px-5 py-2.5
                 bg-orange-500/15 border border-orange-500/25 text-orange-400
                 hover:bg-orange-500/20 hover:border-orange-500/35
                 disabled:opacity-50 disabled:cursor-not-allowed
                 text-sm font-semibold transition-all duration-150"
    >
      {saving ? (
        <Loader2 size={14} className="animate-spin" />
      ) : saved ? (
        <Check size={14} />
      ) : null}
      {saving ? "…" : saved ? label : label}
    </button>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-2.5 text-sm text-red-400">
      <AlertCircle size={14} className="shrink-0" />
      {message}
    </div>
  );
}

function Toggle({
  enabled,
  disabled = false,
  onToggle,
  label,
}: {
  enabled: boolean;
  disabled?: boolean;
  onToggle: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onToggle}
      disabled={disabled}
      role="switch"
      aria-checked={enabled}
      aria-label={label}
      className={`relative h-6 w-11 rounded-full border transition-all duration-200
        ${enabled
          ? "bg-orange-500/30 border-orange-500/40"
          : "bg-[var(--surface-subtle)] border-[var(--border-default)]"}
        ${disabled ? "opacity-60 cursor-not-allowed" : ""}`}
    >
      <span
        className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-[var(--icon-active)] shadow transition-transform duration-200
          ${enabled ? "translate-x-5" : "translate-x-0"}`}
      />
    </button>
  );
}

// ─── Avatar Uploader ──────────────────────────────────────────────────────────

function AvatarUploader({
  preview,
  displayName,
  hint,
  changeLabel,
  onFileSelected,
}: {
  preview?: string;
  displayName: string;
  hint: string;
  changeLabel: string;
  onFileSelected: (file: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const initial = (displayName || "U")[0].toUpperCase();

  return (
    <div className="flex items-center gap-5">
      <div
        className="relative group cursor-pointer shrink-0"
        onClick={() => inputRef.current?.click()}
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={preview}
            alt="Photo de profil"
            className="h-20 w-20 rounded-2xl object-cover ring-2 ring-orange-500/20"
          />
        ) : (
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl
                          bg-orange-500/15 text-orange-400 text-2xl font-bold
                          ring-2 ring-orange-500/20">
            {initial}
          </div>
        )}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 rounded-2xl border border-[var(--border-default)] bg-[var(--surface-base)]/92 opacity-0 transition-opacity group-hover:opacity-100">
          <Camera size={18} className="text-[var(--text-primary)]" />
          <span className="text-[10px] font-medium text-[var(--text-primary)]">Modifier</span>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              onFileSelected(file);
              e.target.value = "";
            }
          }}
        />
      </div>
      <div>
        <p className="text-sm font-semibold text-[var(--text-primary)]">{displayName || "—"}</p>
        <p className="mt-1 text-xs text-[var(--text-secondary)]">{hint}</p>
        <p className="text-xs text-orange-400/80 mt-1">{changeLabel}</p>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function SettingsPage({
  user,
  token,
  getFreshToken,
  workspaceIdentity,
  displayName: initialDisplayName,
  avatarUrl: initialAvatarUrl,
  theme = "light",
  onLogout,
  onIdentitySaved,
  lang: langProp,
  onLangChange,
}: SettingsPageProps) {
  // Language — controlled from parent if prop provided, else internal fallback
  const [langInternal, setLangInternal] = useState<Lang>("fr");
  useEffect(() => {
    const saved = localStorage.getItem("flare-lang") as Lang | null;
    if (saved === "fr" || saved === "en") setLangInternal(saved);
  }, []);
  const lang = langProp ?? langInternal;
  const tx = T[lang];

  const handleLangChange = (l: Lang) => {
    setLangInternal(l);
    localStorage.setItem("flare-lang", l);
    onLangChange?.(l);
  };

  // Profile state
  const [displayName, setDisplayName] = useState(initialDisplayName || "");
  const [fullName, setFullName] = useState(
    workspaceIdentity?.user_profile?.full_name || ""
  );
  const [avatarPreview, setAvatarPreview] = useState<string | undefined>(initialAvatarUrl);
  const [pendingAvatarFile, setPendingAvatarFile] = useState<File | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savedProfile, setSavedProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [guideAssistantEnabled, setGuideAssistantEnabled] = useState(
    workspaceIdentity?.user_profile?.guide_assistant_enabled ?? true
  );
  const [guideAssistantSaving, setGuideAssistantSaving] = useState(false);
  const [guideAssistantError, setGuideAssistantError] = useState<string | null>(null);

  // Password
  const [resettingPwd, setResettingPwd] = useState(false);
  const [pwdResetSent, setPwdResetSent] = useState(false);
  const [pwdError, setPwdError] = useState<string | null>(null);

  // Sync when parent props change
  useEffect(() => { setDisplayName(initialDisplayName || ""); }, [initialDisplayName]);
  useEffect(() => { setAvatarPreview(initialAvatarUrl); }, [initialAvatarUrl]);
  useEffect(() => {
    if (workspaceIdentity) {
      setFullName(workspaceIdentity.user_profile?.full_name || "");
      setGuideAssistantEnabled(
        workspaceIdentity.user_profile?.guide_assistant_enabled ?? true
      );
    }
  }, [workspaceIdentity]);

  // Resolve a fresh token
  const getToken = useCallback(async (): Promise<string | null> => {
    if (getFreshToken) {
      try { return await getFreshToken(true); } catch { return null; }
    }
    return token ?? null;
  }, [getFreshToken, token]);

  // ── Handle profile file ──
  const handleAvatarFileSelected = (file: File) => {
    setPendingAvatarFile(file);
    const reader = new FileReader();
    reader.onload = () => setAvatarPreview(String(reader.result));
    reader.readAsDataURL(file);
  };

  // ── Save profile ──
  const handleSaveProfile = async () => {
    const t = await getToken();
    if (!t) { setProfileError(tx.errorAuth); return; }
    setSavingProfile(true);
    setProfileError(null);
    try {
      let finalAvatarUrl =
        workspaceIdentity?.user_profile?.avatar_url || initialAvatarUrl || "";

      if (pendingAvatarFile && avatarPreview) {
        const uploadResult = await uploadIdentityAsset(
          {
            target: "user_avatar",
            file_name: pendingAvatarFile.name,
            mime_type: pendingAvatarFile.type,
            data_url: avatarPreview,
          },
          t
        );
        finalAvatarUrl = uploadResult.url;
      }

      const nextIdentity = await updateUserProfileSettings(
        {
          display_name: displayName.trim() || initialDisplayName,
          full_name: fullName.trim(),
          avatar_url: finalAvatarUrl,
          workspace_name:
            workspaceIdentity?.user_profile?.workspace_name || "Mon compte",
        },
        t
      );

      setPendingAvatarFile(null);
      setSavedProfile(true);
      onIdentitySaved?.(nextIdentity);
      setTimeout(() => setSavedProfile(false), 3000);
    } catch {
      setProfileError(tx.errorSave);
    } finally {
      setSavingProfile(false);
    }
  };

  // ── Password reset ──
  const handlePasswordReset = async () => {
    const email = user?.email;
    if (!email) { setPwdError(tx.errorPwdEmail); return; }
    setResettingPwd(true);
    setPwdError(null);
    try {
      await sendPasswordResetEmail(auth, email);
      setPwdResetSent(true);
      setTimeout(() => setPwdResetSent(false), 6000);
    } catch (e: any) {
      const code = e?.code || "";
      setPwdError(
        code === "auth/too-many-requests"
          ? "Trop de tentatives. Réessayez dans quelques minutes."
          : tx.errorPwd
      );
    } finally {
      setResettingPwd(false);
    }
  };

  const handleGuideAssistantToggle = async () => {
    const nextEnabled = !guideAssistantEnabled;
    setGuideAssistantEnabled(nextEnabled);
    setGuideAssistantError(null);

    const t = await getToken();
    if (!t) {
      setGuideAssistantEnabled(!nextEnabled);
      setGuideAssistantError(tx.errorAuth);
      return;
    }

    setGuideAssistantSaving(true);
    try {
      const nextIdentity = await updateUserProfileSettings(
        { guide_assistant_enabled: nextEnabled },
        t
      );
      onIdentitySaved?.(nextIdentity);
    } catch {
      setGuideAssistantEnabled(!nextEnabled);
      setGuideAssistantError(tx.errorSave);
    } finally {
      setGuideAssistantSaving(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-[720px] px-4 py-8 md:px-8 md:py-12 flex flex-col gap-6">

        {/* Header */}
        <motion.header
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        >
          <h1 className="text-3xl font-bold tracking-tight text-[var(--text-primary)]">{tx.title}</h1>
          <p className="mt-1 text-base text-[var(--text-secondary)]">{tx.subtitle}</p>
        </motion.header>

        {/* ── Profil ── */}
        <SectionCard icon={UserCircle} title={tx.profile} delay={0.05}>
          <AvatarUploader
            preview={avatarPreview}
            displayName={displayName || initialDisplayName}
            hint={tx.avatarHint}
            changeLabel={tx.avatarChange}
            onFileSelected={handleAvatarFileSelected}
          />

          <div className="h-px bg-[var(--divider)]" />

          <FieldRow label={tx.displayName} hint={tx.displayNameHint}>
            <TextInput
              id="settings-display-name"
              value={displayName}
              onChange={setDisplayName}
              placeholder="Votre nom ou pseudo"
            />
          </FieldRow>

          <FieldRow label={tx.fullName} hint={tx.fullNameHint}>
            <TextInput
              id="settings-full-name"
              value={fullName}
              onChange={setFullName}
              placeholder="Prénom Nom de famille"
            />
          </FieldRow>

          <FieldRow label={tx.email}>
            <TextInput
              id="settings-email"
              value={user?.email || ""}
              disabled
              placeholder="email@exemple.com"
            />
          </FieldRow>

          {profileError && <ErrorBanner message={profileError} />}

          <div className="flex justify-end pt-1">
            <SaveBtn
              saving={savingProfile}
              saved={savedProfile}
              onClick={handleSaveProfile}
              label={savedProfile ? tx.saved : tx.save}
            />
          </div>
        </SectionCard>

        {/* ── Sécurité ── */}
        <SectionCard icon={KeyRound} title={tx.security} delay={0.1}>
          <FieldRow label={tx.passwordLabel} hint="Un lien de réinitialisation sera envoyé par email">
            <div className="flex flex-col gap-2">
              <button
                id="settings-reset-password-btn"
                onClick={handlePasswordReset}
                disabled={resettingPwd || pwdResetSent}
                className={`flex items-center gap-2.5 rounded-xl px-4 py-2.5 text-sm font-medium
                            border transition-all duration-200 w-fit
                            ${pwdResetSent
                              ? "bg-navy-500/10 border-navy-500/30 text-navy-400"
                              : "bg-[var(--surface-subtle)] border-[var(--border-default)] text-[var(--text-primary)] hover:text-orange-500 hover:border-orange-500/30 hover:bg-orange-500/10"
                            }
                            disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {resettingPwd ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : pwdResetSent ? (
                  <Check size={14} />
                ) : (
                  <Send size={14} />
                )}
                {resettingPwd
                  ? tx.sending
                  : pwdResetSent
                  ? `${tx.resetSent} ${user?.email}`
                  : tx.sendReset}
                {!resettingPwd && !pwdResetSent && (
                  <ChevronRight size={14} className="ml-1 opacity-40" />
                )}
              </button>
              {pwdError && <p className="text-xs text-red-400">{pwdError}</p>}
            </div>
          </FieldRow>
        </SectionCard>

        {/* ── Apparence (Dark/Light) ── */}
        {/* Appearance (info only) */}
        <SectionCard icon={Palette} title={tx.appearance} delay={0.2}>
          <div className="flex items-start gap-3 rounded-xl border border-[var(--border-default)] bg-[var(--surface-subtle)] px-4 py-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-500/10">
              {theme === "dark" ? (
                <Moon size={18} className="text-orange-400" />
              ) : (
                <Sun size={18} className="text-orange-400" />
              )}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-[var(--text-primary)]">
                {theme === "dark" ? tx.dark : tx.light}
              </p>
              <p className="mt-1 text-xs text-[var(--text-secondary)]">
                {theme === "dark" ? tx.darkDesc : tx.lightDesc}
              </p>
              <p className="mt-3 text-xs leading-relaxed text-[var(--text-secondary)]">
                Le changement de theme se fait maintenant depuis le header principal, en haut a droite, pour rester accessible sur tout le produit.
              </p>
            </div>
          </div>
          <div className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-subtle)] px-4 py-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Bot size={15} className="text-orange-400" />
                  <p className="text-sm font-medium text-[var(--text-primary)]">
                    {tx.guideAssistant}
                  </p>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-[var(--text-secondary)]">
                  {tx.guideAssistantDesc}
                </p>
                {guideAssistantSaving && (
                  <p className="mt-2 text-[11px] text-[var(--text-muted)]">
                    {tx.guideAssistantSaving}
                  </p>
                )}
              </div>
              <Toggle
                enabled={guideAssistantEnabled}
                disabled={guideAssistantSaving}
                onToggle={handleGuideAssistantToggle}
                label={tx.guideAssistant}
              />
            </div>
            {guideAssistantError && (
              <p className="mt-2 text-xs text-red-500">{guideAssistantError}</p>
            )}
          </div>
        </SectionCard>
        {/* ── Langue ── */}
        <SectionCard icon={Globe} title={tx.language} delay={0.25}>
          <p className="text-xs text-[var(--text-secondary)] -mt-1 mb-1">{tx.langHint}</p>
          <div className="flex gap-3">
            <button
              id="settings-lang-fr"
              onClick={() => handleLangChange("fr")}
              className={`flex-1 flex items-center gap-3 rounded-xl border px-4 py-3 transition-all
                ${lang === "fr"
                  ? "border-orange-500/40 bg-orange-500/10"
                  : "border-[var(--border-default)] bg-[var(--surface-subtle)] hover:border-[var(--border-strong)]"}`}
            >
              <span className="text-xl">🇫🇷</span>
              <span className={`text-sm font-medium ${lang === "fr" ? "text-orange-400" : "text-[var(--text-secondary)]"}`}>
                {tx.langFr}
              </span>
              {lang === "fr" && <Check size={14} className="ml-auto text-orange-400" />}
            </button>
            <button
              id="settings-lang-en"
              onClick={() => handleLangChange("en")}
              className={`flex-1 flex items-center gap-3 rounded-xl border px-4 py-3 transition-all
                ${lang === "en"
                  ? "border-orange-500/40 bg-orange-500/10"
                  : "border-[var(--border-default)] bg-[var(--surface-subtle)] hover:border-[var(--border-strong)]"}`}
            >
              <span className="text-xl">🇬🇧</span>
              <span className={`text-sm font-medium ${lang === "en" ? "text-orange-400" : "text-[var(--text-secondary)]"}`}>
                {tx.langEn}
              </span>
              {lang === "en" && <Check size={14} className="ml-auto text-orange-400" />}
            </button>
          </div>
        </SectionCard>

        {/* ── Compte ── */}
        <SectionCard icon={LogOut} title={tx.account} delay={0.3}>
          <button
            id="settings-logout-btn"
            onClick={onLogout}
            className="flex w-full items-center justify-between rounded-xl
                       border border-red-500/15 bg-red-500/[0.04] px-5 py-3.5
                       hover:bg-red-500/10 hover:border-red-500/25
                       transition-all duration-150 group"
          >
            <div className="flex items-center gap-3">
              <LogOut size={16} className="text-red-400/60 group-hover:text-red-400 transition-colors" />
              <span className="text-sm font-medium text-red-400/60 group-hover:text-red-400 transition-colors">
                {tx.logout}
              </span>
            </div>
            <ChevronRight size={14} className="text-red-400/25 group-hover:text-red-400/60 transition-colors" />
          </button>
        </SectionCard>

      </div>
    </div>
  );
}



