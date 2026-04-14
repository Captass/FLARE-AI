"use client";

import { useState, useRef, useEffect, FormEvent, KeyboardEvent, ClipboardEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Loader2, Mail, Lock, Eye, EyeOff, ArrowRight, ArrowLeft,
  Shield, KeyRound, RefreshCw, Chrome, Sparkles,
} from "lucide-react";
import FlareMark from "./FlareMark";

interface LoginScreenProps {
  onLogin: (email: string) => Promise<void>;
  onLoginWithPassword: (email: string, password: string) => Promise<void>;
  onSignUpWithPassword: (email: string, password: string) => Promise<void>;
  onLoginWithGoogle: () => Promise<void>;
  onResetPassword: (email: string) => Promise<void>;
  /** Appelé par le composant pour envoyer le PIN AVANT la création Firebase */
  onSendPin?: (email: string) => Promise<{ dev_pin?: string }>;
  /** Appelé pour vérifier le PIN ; résout si OK, rejette avec message si KO */
  onVerifyPin?: (email: string, pin: string) => Promise<void>;
  loading: boolean;
  error: string | null;
  initialMode?: "login" | "signup" | "magic";
  onBack?: () => void;
}

type Mode = "login" | "signup" | "magic" | "reset" | "pin";

const VARIANTS = {
  enter: { opacity: 0, y: 14 },
  center: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -14 },
};

export default function LoginScreen({
  onLogin,
  onLoginWithPassword,
  onSignUpWithPassword,
  onLoginWithGoogle,
  onResetPassword,
  onSendPin,
  onVerifyPin,
  loading,
  error,
  initialMode = "login",
  onBack,
}: LoginScreenProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [mode, setMode] = useState<Mode>(initialMode);
  const [localError, setLocalError] = useState<string | null>(null);
  const [localLoading, setLocalLoading] = useState(false);

  // État PIN
  const [pinDigits, setPinDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const [pinError, setPinError] = useState<string | null>(null);
  const [pinLoading, setPinLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [devPin, setDevPin] = useState<string | null>(null);
  // Mot de passe stocké temporairement pendant la vérification du PIN
  const pendingPasswordRef = useRef<string>("");

  const pinRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const pendingVerificationEmail = window.sessionStorage.getItem("flare_signup_verification_email");
    if (!pendingVerificationEmail) return;

    window.sessionStorage.removeItem("flare_signup_verification_email");
    setEmail(pendingVerificationEmail);
    setMode("signup");
    setEmailSent(true);
  }, []);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;
    if (resendCooldown > 0) {
      timer = setInterval(() => setResendCooldown((c) => c - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const displayError = localError || error || pinError;
  const isLoading = loading || localLoading || pinLoading;

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    if (!email.trim()) return;

    if (mode === "magic") {
      setLocalLoading(true);
      try {
        await onLogin(email.trim());
        setEmailSent(true);
      } catch {
        // error géré par le parent via prop error
      } finally {
        setLocalLoading(false);
      }
    } else if (mode === "login") {
      await onLoginWithPassword(email.trim(), password);
    } else if (mode === "signup") {
      if (!password || password.length < 6) {
        setLocalError("Le mot de passe doit contenir au moins 6 caractères.");
        return;
      }
      setLocalLoading(true);
      try {
        await onSignUpWithPassword(email.trim(), password);
        setEmailSent(true);
      } catch {
        // erreur gérée par le parent
      } finally {
        setLocalLoading(false);
      }
    } else if (mode === "reset") {
      setLocalLoading(true);
      try {
        await onResetPassword(email.trim());
        alert("Si un compte est associé à cet e-mail, un lien de réinitialisation a été envoyé.");
        setEmailSent(true);
      } catch {
        // géré par le parent
      } finally {
        setLocalLoading(false);
      }
    }
  };

  // ── Gestion des inputs PIN ─────────────────────────────────────────────────

  const handlePinChange = (index: number, value: string) => {
    // Accepter uniquement les chiffres
    const digit = value.replace(/\D/g, "").slice(-1);
    const newDigits = [...pinDigits];
    newDigits[index] = digit;
    setPinDigits(newDigits);
    setPinError(null);
    if (digit && index < 5) {
      pinRefs.current[index + 1]?.focus();
    }
  };

  const handlePinKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !pinDigits[index] && index > 0) {
      pinRefs.current[index - 1]?.focus();
    }
    if (e.key === "ArrowLeft" && index > 0) pinRefs.current[index - 1]?.focus();
    if (e.key === "ArrowRight" && index < 5) pinRefs.current[index + 1]?.focus();
  };

  const handlePinPaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;
    const newDigits = ["", "", "", "", "", ""];
    for (let i = 0; i < pasted.length; i++) newDigits[i] = pasted[i];
    setPinDigits(newDigits);
    const lastFilledIndex = Math.min(pasted.length, 5);
    pinRefs.current[lastFilledIndex]?.focus();
  };

  const handleVerifyPin = async () => {
    const pin = pinDigits.join("");
    if (pin.length !== 6) {
      setPinError("Entrez les 6 chiffres du code.");
      return;
    }
    if (!onVerifyPin) return;
    setPinLoading(true);
    setPinError(null);
    try {
      await onVerifyPin(email.trim(), pin);
      // PIN valide → créer le compte Firebase
      await onSignUpWithPassword(email.trim(), pendingPasswordRef.current);
    } catch (err: any) {
      setPinError(err.message || "Code incorrect");
    } finally {
      setPinLoading(false);
    }
  };

  const handleResendPin = async () => {
    if (!onSendPin || resendCooldown > 0) return;
    setLocalLoading(true);
    setPinError(null);
    try {
      const result = await onSendPin(email.trim());
      if (result?.dev_pin) setDevPin(result.dev_pin);
      setPinDigits(["", "", "", "", "", ""]);
      setResendCooldown(60);
      pinRefs.current[0]?.focus();
    } catch (err: any) {
      setPinError(err.message || "Erreur lors du renvoi");
    } finally {
      setLocalLoading(false);
    }
  };

  // ── Transitions ────────────────────────────────────────────────────────────

  const switchMode = (newMode: Mode) => {
    setLocalError(null);
    setPinError(null);
    setEmailSent(false);
    setMode(newMode);
  };

  // ── Rendu ──────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F9F7F2] p-4 font-sans selection:bg-orange-500 selection:text-white">
      {/* Fond animé — tons neutres */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-orange-500/10 blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full bg-white/80 blur-[100px]" />
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={mode + String(emailSent)}
          variants={VARIANTS}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="relative w-full max-w-sm"
        >
          {/* Card */}
          <div className="bg-white border border-black/5 rounded-[32px] shadow-2xl shadow-orange-500/10 overflow-hidden">

            {/* Header */}
            <div className="px-8 pt-8 pb-6 text-center border-b border-black/5">
              <div className="relative mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-black/5 bg-black/[0.02] shadow-sm">
                <FlareMark tone="auto" className="w-8" priority />
              </div>
              <h1 className="text-xl font-black text-black font-[family-name:var(--font-outfit)] tracking-tight">
                {mode === "login" && "Connexion"}
                {mode === "signup" && "Créer un compte"}
                {mode === "magic" && (emailSent ? "Email envoyé !" : "Lien magique")}
                {mode === "reset" && (emailSent ? "Email envoyé !" : "Mot de passe oublié")}
                {mode === "pin" && "Vérification email"}
              </h1>
              <p className="text-sm text-[var(--text-muted)] mt-1">
                {mode === "login" && "Accédez à votre compte FLARE AI"}
                {mode === "signup" && "Rejoignez FLARE AI gratuitement"}
                {mode === "magic" && !emailSent && "Connectez-vous sans mot de passe"}
                {mode === "magic" && emailSent && `Cliquez sur le lien envoyé à ${email}`}
                {mode === "reset" && !emailSent && "Réinitialisez votre mot de passe"}
                {mode === "reset" && emailSent && `Consultez votre boîte mail : ${email}`}
                {mode === "pin" && `Code envoyé à ${email}`}
              </p>
            </div>

            {/* Corps */}
            <div className="px-8 py-6 space-y-4">

              {/* Erreur globale */}
              {displayError && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.97 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex items-start gap-2.5 p-3 rounded-xl bg-red-500/10 border border-red-500/20"
                >
                  <span className="text-red-400 mt-0.5">⚠</span>
                  <p className="text-sm text-red-300">{displayError}</p>
                </motion.div>
              )}

              {/* ── Mode PIN ── */}
              {mode === "pin" && (
                <div className="space-y-5">
                  <p className="text-sm text-center text-[var(--text-muted)]">
                    Entrez le code à 6 chiffres reçu par email
                  </p>

                  {/* Dev mode PIN hint */}
                  {devPin && (
                    <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                      <span className="text-amber-400 text-xs font-mono">DEV</span>
                      <p className="text-sm text-amber-300">
                        Mode dev — Code : <strong className="tracking-widest">{devPin}</strong>
                      </p>
                    </div>
                  )}

                  {/* Inputs PIN */}
                  <div className="flex justify-center gap-2">
                    {pinDigits.map((digit, i) => (
                      <input
                        key={i}
                        ref={(el) => { pinRefs.current[i] = el; }}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={digit}
                        onChange={(e) => handlePinChange(i, e.target.value)}
                        onKeyDown={(e) => handlePinKeyDown(i, e)}
                        onPaste={i === 0 ? handlePinPaste : undefined}
                        onFocus={(e) => e.target.select()}
                        className="w-11 h-13 text-center text-xl font-bold rounded-xl border transition-all outline-none
                          bg-[var(--bg-input)] text-[var(--text-primary)]
                          border-[var(--border-glass)] focus:border-white/30 focus:ring-2 focus:ring-white/10
                          disabled:opacity-50"
                        style={{ height: "52px" }}
                        disabled={pinLoading}
                        autoFocus={i === 0}
                      />
                    ))}
                  </div>

                  {/* Bouton vérifier */}
                  <button
                    onClick={handleVerifyPin}
                    disabled={pinLoading || pinDigits.join("").length !== 6}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm
                      bg-white text-black hover:bg-white/90 transition-colors
                      disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {pinLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Shield className="w-4 h-4" />
                        Vérifier le code
                      </>
                    )}
                  </button>

                  {/* Renvoi du code */}
                  <div className="text-center">
                    {resendCooldown > 0 ? (
                      <p className="text-xs text-[var(--text-muted)]">
                        Renvoyer dans {resendCooldown}s
                      </p>
                    ) : (
                      <button
                        onClick={handleResendPin}
                        disabled={isLoading}
                        className="inline-flex items-center gap-1.5 text-xs text-white/70 hover:text-white transition-colors disabled:opacity-50"
                      >
                        <RefreshCw className="w-3 h-3" />
                        Renvoyer le code
                      </button>
                    )}
                  </div>

                  {/* Retour */}
                  <button
                    onClick={() => switchMode("signup")}
                    className="w-full flex items-center justify-center gap-2 text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Modifier l&apos;email
                  </button>
                </div>
              )}

              {/* ── Formulaire principal (login / signup / magic / reset) ── */}
              {mode !== "pin" && !emailSent && (
                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Email */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide">
                      Email
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--icon-muted)]" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="vous@exemple.com"
                        required
                        autoFocus
                          className="w-full pl-9 pr-4 py-3 rounded-xl text-sm font-medium
                          bg-black/[0.03] border border-black/5
                          text-black placeholder:text-black/40
                          focus:outline-none focus:border-orange-500/50 focus:ring-4 focus:ring-orange-500/10
                          transition-all"
                      />
                    </div>
                  </div>

                  {/* Mot de passe (login + signup) */}
                  {(mode === "login" || mode === "signup") && (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide">
                          Mot de passe
                        </label>
                        {mode === "login" && (
                          <button
                            type="button"
                            onClick={() => switchMode("reset")}
                            className="text-xs text-white/70 hover:text-white transition-colors"
                          >
                            Oublié ?
                          </button>
                        )}
                      </div>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--icon-muted)]" />
                        <input
                          type={showPassword ? "text" : "password"}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder={mode === "signup" ? "Minimum 6 caractères" : "Votre mot de passe"}
                          required
                          className="w-full pl-9 pr-10 py-3 rounded-xl text-sm font-medium
                            bg-black/[0.03] border border-black/5
                            text-black placeholder:text-black/40
                            focus:outline-none focus:border-orange-500/50 focus:ring-4 focus:ring-orange-500/10
                            transition-all"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-black/40 hover:text-black transition-colors"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Bouton principal */}
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold uppercase tracking-widest text-[11px]
                      bg-orange-500 text-white hover:bg-orange-600 shadow-xl shadow-orange-500/20 transition-all
                      disabled:opacity-50 disabled:cursor-not-allowed border border-orange-400"
                  >
                    {isLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        {mode === "login" && <><ArrowRight className="w-4 h-4" /> Se connecter</>}
                        {mode === "signup" && <><Shield className="w-4 h-4" /> Créer le compte</>}
                        {mode === "magic" && <><Sparkles className="w-4 h-4" /> Envoyer le lien</>}
                        {mode === "reset" && <><ArrowRight className="w-4 h-4" /> Réinitialiser</>}
                      </>
                    )}
                  </button>

                  {/* Séparateur + Google */}
                  {(mode === "login" || mode === "signup") && (
                    <>
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-px bg-[var(--border-glass)]" />
                        <span className="text-xs text-[var(--text-muted)]">ou</span>
                        <div className="flex-1 h-px bg-[var(--border-glass)]" />
                      </div>
                      <button
                        type="button"
                        onClick={onLoginWithGoogle}
                        disabled={isLoading}
                        className="w-full flex items-center justify-center gap-2.5 py-3 rounded-xl text-sm font-bold
                          bg-white border border-black/10 shadow-sm
                          text-black hover:bg-black/5
                          transition-colors disabled:opacity-50"
                      >
                        <Chrome className="w-4 h-4" />
                        Continuer avec Google
                      </button>
                    </>
                  )}
                </form>
              )}

              {/* ── Confirmation email envoyé ── */}
              {emailSent && mode !== "pin" && (
                <div className="text-center py-2 space-y-3">
                  <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-green-500/10 mb-2">
                    <Mail className="w-7 h-7 text-green-400" />
                  </div>
                  <p className="text-sm text-[var(--text-muted)]">
                    {mode === "magic"
                      ? "Vérifiez votre boîte mail et cliquez sur le lien de connexion."
                      : mode === "signup"
                        ? "Votre compte a été créé. Vérifiez votre boîte mail puis confirmez votre adresse avant de vous connecter."
                        : "Un email de réinitialisation vous a été envoyé."}
                  </p>
                  <button
                    onClick={() => { setEmailSent(false); switchMode("login"); }}
                    className="text-sm text-white/70 hover:text-white transition-colors"
                  >
                    Retour à la connexion
                  </button>
                </div>
              )}
            </div>

            {/* Footer liens */}
            {mode !== "pin" && !emailSent && (
              <div className="px-8 pb-6 flex flex-col items-center gap-3">
                {mode === "login" && (
                  <>
                    <button
                      onClick={() => switchMode("reset")}
                      className="text-xs text-black/60 hover:text-black font-medium transition-colors"
                    >
                      Mot de passe oublié ?
                    </button>
                    <div className="flex items-center gap-1.5 text-xs text-black/50">
                      <span>Pas encore de compte ?</span>
                      <button
                        onClick={() => switchMode("signup")}
                        className="text-orange-500 hover:text-orange-600 font-bold transition-colors"
                      >
                        S&apos;inscrire
                      </button>
                    </div>
                  </>
                )}
                {mode === "signup" && (
                  <div className="flex items-center gap-1.5 text-xs text-black/50">
                    <span>Déjà un compte ?</span>
                    <button
                      onClick={() => switchMode("login")}
                      className="text-orange-500 hover:text-orange-600 font-bold transition-colors"
                    >
                      Se connecter
                    </button>
                  </div>
                )}
                {(mode === "magic" || mode === "reset") && (
                  <button
                    onClick={() => switchMode("login")}
                    className="inline-flex items-center gap-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                  >
                    <ArrowLeft className="w-3 h-3" />
                    Retour à la connexion
                  </button>
                )}
                {onBack && (
                  <button
                    onClick={onBack}
                    className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors mt-1"
                  >
                    ← Retour
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Badge sécurité */}
          {mode === "signup" && (
            <p className="text-center text-xs text-[var(--text-muted)] mt-4 flex items-center justify-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-green-500" />
              Un email de vérification sera envoyé pour activer votre compte
            </p>
          )}
          {mode === "pin" && (
            <p className="text-center text-xs text-[var(--text-muted)] mt-4 flex items-center justify-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-green-500" />
              Code valable 10 minutes · 5 tentatives max
            </p>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
