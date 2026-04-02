# CODE REVIEW REQUEST: TKT-005
**Auteur**: DELTA
**Date**: 2026-03-21T09:58:04.803Z

## Changements

### DIFF POUR frontend/src/components/LoginScreen.tsx
```diff
diff --git a/frontend/src/components/LoginScreen.tsx b/frontend/src/components/LoginScreen.tsx
index 7bf935f..03b3feb 100644
--- a/frontend/src/components/LoginScreen.tsx
+++ b/frontend/src/components/LoginScreen.tsx
@@ -1,5 +1,11 @@
-import { useState, FormEvent, useMemo } from "react";
-import { Zap, Loader2, Sparkles, Mail, Lock, Chrome, Eye, EyeOff, ArrowRight, Shield } from "lucide-react";
+"use client";
+
+import { useState, useRef, useEffect, FormEvent, KeyboardEvent, ClipboardEvent } from "react";
+import { motion, AnimatePresence } from "framer-motion";
+import {
+  Loader2, Mail, Lock, Eye, EyeOff, ArrowRight, ArrowLeft,
+  Shield, Sparkles, KeyRound, RefreshCw, Chrome,
+} from "lucide-react";
 
 interface LoginScreenProps {
   onLogin: (email: string) => Promise<void>;
@@ -7,44 +13,23 @@ interface LoginScreenProps {
   onSignUpWithPassword: (email: string, password: string) => Promise<void>;
   onLoginWithGoogle: () => Promise<void>;
   onResetPassword: (email: string) => Promise<void>;
+  /** Appelé par le composant pour envoyer le PIN AVANT la création Firebase */
+  onSendPin?: (email: string) => Promise<{ dev_pin?: string }>;
+  /** Appelé pour vérifier le PIN ; résout si OK, rejette avec message si KO */
+  onVerifyPin?: (email: string, pin: string) => Promise<void>;
   loading: boolean;
   error: string | null;
   initialMode?: "login" | "signup" | "magic";
   onBack?: () => void;
 }
 
-function FloatingParticles() {
-  const particles = useMemo(() =>
-    Array.from({ length: 20 }, (_, i) => ({
-      id: i,
-      left: `${Math.random() * 100}%`,
-      size: Math.random() * 3 + 1,
-      duration: `${Math.random() * 10 + 8}s`,
-      delay: `${Math.random() * 8}s`,
-      opacity: Math.random() * 0.5 + 0.2,
-    })),
-  []);
+type Mode = "login" | "signup" | "magic" | "reset" | "pin";
 
-  return (
-    <div className="absolute inset-0 overflow-hidden pointer-events-none">
-      {particles.map((p) => (
-        <div
-          key={p.id}
-          className="particle"
-          style={{
-            left: p.left,
-            bottom: '-5%',
-            width: `${p.size}px`,
-            height: `${p.size}px`,
-            opacity: p.opacity,
-            ['--duration' as string]: p.duration,
-            ['--delay' as string]: p.delay,
-          }}
-        />
-      ))}
-    </div>
-  );
-}
+const VARIANTS = {
+  enter: { opacity: 0, y: 14 },
+  center: { opacity: 1, y: 0 },
+  exit: { opacity: 0, y: -14 },
+};
 
 export default function LoginScreen({
   onLogin,
@@ -52,244 +37,541 @@ export default function LoginScreen({
   onSignUpWithPassword,
   onLoginWithGoogle,
   onResetPassword,
+  onSendPin,
+  onVerifyPin,
   loading,
   error,
   initialMode = "login",
-  onBack
+  onBack,
 }: LoginScreenProps) {
   const [email, setEmail] = useState("");
   const [password, setPassword] = useState("");
   const [showPassword, setShowPassword] = useState(false);
   const [emailSent, setEmailSent] = useState(false);
-  const [mode, setMode] = useState<"magic" | "login" | "signup" | "reset">(initialMode);
+  const [mode, setMode] = useState<Mode>(initialMode);
+  const [localError, setLocalError] = useState<string | null>(null);
+  const [localLoading, setLocalLoading] = useState(false);
+
+  // État PIN
+  const [pinDigits, setPinDigits] = useState<string[]>(["", "", "", "", "", ""]);
+  const [pinError, setPinError] = useState<string | null>(null);
+  const [pinLoading, setPinLoading] = useState(false);
+  const [resendCooldown, setResendCooldown] = useState(0);
+  const [devPin, setDevPin] = useState<string | null>(null);
+  // Mot de passe stocké temporairement pendant la vérification du PIN
+  const pendingPasswordRef = useRef<string>("");
+
+  const pinRefs = useRef<(HTMLInputElement | null)[]>([]);
+
+  useEffect(() => {
+    let timer: ReturnType<typeof setInterval>;
+    if (resendCooldown > 0) {
+      timer = setInterval(() => setResendCooldown((c) => c - 1), 1000);
+    }
+    return () => clearInterval(timer);
+  }, [resendCooldown]);
+
+  const displayError = localError || error || pinError;
+  const isLoading = loading || localLoading || pinLoading;
+
+  // ── Handlers ───────────────────────────────────────────────────────────────
 
   const handleSubmit = async (e: FormEvent) => {
     e.preventDefault();
+    setLocalError(null);
     if (!email.trim()) return;
 
     if (mode === "magic") {
-      await onLogin(email.trim());
-      setEmailSent(true);
+      setLocalLoading(true);
+      try {
+        await onLogin(email.trim());
+        setEmailSent(true);
+      } catch {
+        // error géré par le parent via prop error
+      } finally {
+        setLocalLoading(false);
+      }
     } else if (mode === "login") {
       await onLoginWithPassword(email.trim(), password);
     } else if (mode === "signup") {
-      await onSignUpWithPassword(email.trim(), password);
+      if (!password || password.length < 6) {
+        setLocalError("Le mot de passe doit contenir au moins 6 caractères.");
+        return;
+      }
+      // Flow sécurisé : envoyer le PIN d'abord
+      if (onSendPin) {
+        setLocalLoading(true);
+        try {
+          const result = await onSendPin(email.trim());
+          pendingPasswordRef.current = password;
+          if (result?.dev_pin) setDevPin(result.dev_pin);
+          setMode("pin");
+          setResendCooldown(60);
+          setPinDigits(["", "", "", "", "", ""]);
+          setPinError(null);
+        } catch (err: any) {
+          setLocalError(err.message || "Erreur lors de l'envoi du code");
+        } finally {
+          setLocalLoading(false);
+        }
+      } else {
+        // Fallback sans vérification PIN
+        await onSignUpWithPassword(email.trim(), password);
+      }
     } else if (mode === "reset") {
-      await onResetPassword(email.trim());
-      setEmailSent(true);
+      setLocalLoading(true);
+      try {
+        await onResetPassword(email.trim());
+        alert("Si un compte est associé à cet e-mail, un lien de réinitialisation a été envoyé.");
+        setEmailSent(true);
+      } catch {
+        // géré par le parent
+      } finally {
+        setLocalLoading(false);
+      }
     }
   };
 
+  // ── Gestion des inputs PIN ─────────────────────────────────────────────────
+
+  const handlePinChange = (index: number, value: string) => {
+    // Accepter uniquement les chiffres
+    const digit = value.replace(/\D/g, "").slice(-1);
+    const newDigits = [...pinDigits];
+    newDigits[index] = digit;
+    setPinDigits(newDigits);
+    setPinError(null);
+    if (digit && index < 5) {
+      pinRefs.current[index + 1]?.focus();
+    }
+  };
+
+  const handlePinKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
+    if (e.key === "Backspace" && !pinDigits[index] && index > 0) {
+      pinRefs.current[index - 1]?.focus();
+    }
+    if (e.key === "ArrowLeft" && index > 0) pinRefs.current[index - 1]?.focus();
+    if (e.key === "ArrowRight" && index < 5) pinRefs.current[index + 1]?.focus();
+  };
+
+  const handlePinPaste = (e: ClipboardEvent<HTMLInputElement>) => {
+    e.preventDefault();
+    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
+    if (!pasted) return;
+    const newDigits = ["", "", "", "", "", ""];
+    for (let i = 0; i < pasted.length; i++) newDigits[i] = pasted[i];
+    setPinDigits(newDigits);
+    const lastFilledIndex = Math.min(pasted.length, 5);
+    pinRefs.current[lastFilledIndex]?.focus();
+  };
+
+  const handleVerifyPin = async () => {
+    const pin = pinDigits.join("");
+    if (pin.length !== 6) {
+      setPinError("Entrez les 6 chiffres du code.");
+      return;
+    }
+    if (!onVerifyPin) return;
+    setPinLoading(true);
+    setPinError(null);
+    try {
+      await onVerifyPin(email.trim(), pin);
+      // PIN valide → créer le compte Firebase
+      await onSignUpWithPassword(email.trim(), pendingPasswordRef.current);
+    } catch (err: any) {
+      setPinError(err.message || "Code incorrect");
+    } finally {
+      setPinLoading(false);
+    }
+  };
+
+  const handleResendPin = async () => {
+    if (!onSendPin || resendCooldown > 0) return;
+    setLocalLoading(true);
+    setPinError(null);
+    try {
+      const result = await onSendPin(email.trim());
+      if (result?.dev_pin) setDevPin(result.dev_pin);
+      setPinDigits(["", "", "", "", "", ""]);
+      setResendCooldown(60);
+      pinRefs.current[0]?.focus();
+    } catch (err: any) {
+      setPinError(err.message || "Erreur lors du renvoi");
+    } finally {
+      setLocalLoading(false);
+    }
+  };
+
+  // ── Transitions ────────────────────────────────────────────────────────────
+
+  const switchMode = (newMode: Mode) => {
+    setLocalError(null);
+    setPinError(null);
+    setEmailSent(false);
+    setMode(newMode);
+  };
+
+  // ── Rendu ──────────────────────────────────────────────────────────────────
+
   return (
-    <div className="min-h-screen bg-[#020305] flex items-center justify-center p-4 relative overflow-hidden font-sans">
-      {/* Subtle Grid */}
-      <div className="absolute inset-0 opacity-[0.02] pointer-events-none"
-        style={{
-          backgroundImage: `radial-gradient(circle, white 1px, transparent 1px)`,
-          backgroundSize: '40px 40px',
-        }}
-      />
-
-      <div className="w-full max-w-[420px] relative z-10">
-        <div className="bg-white/[0.01] backdrop-blur-3xl border border-white/[0.05] rounded-[32px] p-8 md:p-10 shadow-2xl transition-all duration-500">
-          
-          {/* Logo Section */}
-          <div className="flex flex-col items-center mb-10 relative">
-            {onBack && (
-              <button 
-                onClick={onBack}
-                className="absolute top-0 left-0 p-3 rounded-2xl bg-white/[0.03] border border-white/10 text-white/40 hover:text-white hover:border-white/20 hover:bg-white/[0.06] transition-all group active-press"
-                title="Retour"
-              >
-                <ArrowRight size={18} className="rotate-180 group-hover:-translate-x-1 transition-transform" />
-              </button>
-            )}
-            
-            <div className="w-20 h-20 rounded-[24px] bg-gradient-to-br from-white/10 to-white/[0.01] flex items-center justify-center mb-6 border border-white/10 relative z-10 shadow-2xl group animate-sheen">
-              <img src="/logo.png" alt="Logo" className="w-12 h-12 object-contain opacity-90 group-hover:scale-110 transition-transform duration-500" />
-            </div>
-            <h1 className="text-2xl font-light text-white tracking-[0.4em] uppercase opacity-90">FLARE AI</h1>
-            <div className="mt-3 flex flex-col items-center gap-1.5 opacity-40">
-              <p className="text-[10px] font-bold tracking-[0.4em] uppercase text-orange-400">Intelligence Artificielle</p>
-              <span className="text-[9px] font-light tracking-[0.2em] uppercase">by RAM&apos;S FLARE</span>
-            </div>
-          </div>
+    <div className="min-h-screen flex items-center justify-center bg-[rgb(var(--background))] p-4">
+      {/* Fond animé */}
+      <div className="fixed inset-0 overflow-hidden pointer-events-none">
+        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-orange-600/10 blur-[120px]" />
+        <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full bg-orange-600/8 blur-[100px]" />
+      </div>
 
-          <div className="stagger-children">
-
-          {!emailSent ? (
-            <div className="space-y-6">
-              <button
-                onClick={onLoginWithGoogle}
-                disabled={loading}
-                className="w-full py-4 rounded-xl bg-white/[0.03] border border-white/10 text-white/80 hover:bg-white/[0.06] hover:border-white/20 active:scale-[0.98] transition-all duration-300 text-[13px] font-light flex items-center justify-center gap-3 group"
-              >
-                <Chrome size={18} className="text-white/60 group-hover:text-white transition-colors" />
-                <span>Continuer avec Google</span>
-              </button>
-
-              <div className="flex items-center gap-4 py-1">
-                <div className="h-px flex-1 bg-white/[0.05]" />
-                <span className="text-[9px] text-white/20 uppercase tracking-[0.2em]">ou</span>
-                <div className="h-px flex-1 bg-white/[0.05]" />
+      <AnimatePresence mode="wait">
+        <motion.div
+          key={mode + String(emailSent)}
+          variants={VARIANTS}
+          initial="enter"
+          animate="center"
+          exit="exit"
+          transition={{ duration: 0.2, ease: "easeOut" }}
+          className="relative w-full max-w-sm"
+        >
+          {/* Card */}
+          <div className="bg-[var(--bg-glass-dark)] border border-[var(--border-glass)] rounded-2xl shadow-[var(--shadow-card)] overflow-hidden">
+
+            {/* Header */}
+            <div className="px-8 pt-8 pb-6 text-center border-b border-[var(--border-glass)]">
+              <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-orange-500/10 mb-4">
+                {mode === "pin" ? (
+                  <Shield className="w-6 h-6 text-orange-400" />
+                ) : mode === "magic" ? (
+                  <Sparkles className="w-6 h-6 text-orange-400" />
+                ) : mode === "reset" ? (
+                  <KeyRound className="w-6 h-6 text-orange-400" />
+                ) : (
+                  <Sparkles className="w-6 h-6 text-orange-400" />
+                )}
               </div>
+              <h1 className="text-lg font-semibold text-[var(--text-primary)]">
+                {mode === "login" && "Connexion"}
+                {mode === "signup" && "Créer un compte"}
+                {mode === "magic" && (emailSent ? "Email envoyé !" : "Lien magique")}
+                {mode === "reset" && (emailSent ? "Email envoyé !" : "Mot de passe oublié")}
+                {mode === "pin" && "Vérification email"}
+              </h1>
+              <p className="text-sm text-[var(--text-muted)] mt-1">
+                {mode === "login" && "Accédez à votre espace FLARE AI"}
+                {mode === "signup" && "Rejoignez FLARE AI gratuitement"}
+                {mode === "magic" && !emailSent && "Connectez-vous sans mot de passe"}
+                {mode === "magic" && emailSent && `Cliquez sur le lien envoyé à ${email}`}
+                {mode === "reset" && !emailSent && "Réinitialisez votre mot de passe"}
+                {mode === "reset" && emailSent && `Consultez votre boîte mail : ${email}`}
+                {mode === "pin" && `Code envoyé à ${email}`}
+              </p>
+            </div>
+
+            {/* Corps */}
+            <div className="px-8 py-6 space-y-4">
+
+              {/* Erreur globale */}
+              {displayError && (
+                <motion.div
+                  initial={{ opacity: 0, scale: 0.97 }}
+                  animate={{ opacity: 1, scale: 1 }}
+                  className="flex items-start gap-2.5 p-3 rounded-xl bg-red-500/10 border border-red-500/20"
+                >
+                  <span className="text-red-400 mt-0.5">⚠</span>
+                  <p className="text-sm text-red-300">{displayError}</p>
+                </motion.div>
+              )}
+
+              {/* ── Mode PIN ── */}
+              {mode === "pin" && (
+                <div className="space-y-5">
+                  <p className="text-sm text-center text-[var(--text-muted)]">
+                    Entrez le code à 6 chiffres reçu par email
+                  </p>
+
+                  {/* Dev mode PIN hint */}
+                  {devPin && (
+                    <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
+                      <span className="text-amber-400 text-xs font-mono">DEV</span>
+                      <p className="text-sm text-amber-300">
+                        Mode dev — Code : <strong className="tracking-widest">{devPin}</strong>
+                      </p>
+                    </div>
+                  )}
+
+                  {/* Inputs PIN */}
+                  <div className="flex justify-center gap-2">
+                    {pinDigits.map((digit, i) => (
+                      <input
+                        key={i}
+                        ref={(el) => { pinRefs.current[i] = el; }}
+                        type="text"
+                        inputMode="numeric"
+                        maxLength={1}
+                        value={digit}
+                        onChange={(e) => handlePinChange(i, e.target.value)}
+                        onKeyDown={(e) => handlePinKeyDown(i, e)}
+                        onPaste={i === 0 ? handlePinPaste : undefined}
+                        onFocus={(e) => e.target.select()}
+                        className="w-11 h-13 text-center text-xl font-bold rounded-xl border transition-all outline-none
+                          bg-[var(--bg-input)] text-[var(--text-primary)]
+                          border-[var(--border-glass)] focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20
+                          disabled:opacity-50"
+                        style={{ height: "52px" }}
+                        disabled={pinLoading}
+                        autoFocus={i === 0}
+                      />
+                    ))}
+                  </div>
+
+                  {/* Bouton vérifier */}
+                  <button
+                    onClick={handleVerifyPin}
+                    disabled={pinLoading || pinDigits.join("").length !== 6}
+                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm
+                      bg-orange-600 hover:bg-orange-500 text-white transition-colors
+                      disabled:opacity-50 disabled:cursor-not-allowed"
+                  >
+                    {pinLoading ? (
+                      <Loader2 className="w-4 h-4 animate-spin" />
+                    ) : (
+                      <>
+                        <Shield className="w-4 h-4" />
+                        Vérifier le code
+                      </>
+                    )}
+                  </button>
+
+                  {/* Renvoi du code */}
+                  <div className="text-center">
+                    {resendCooldown > 0 ? (
+                      <p className="text-xs text-[var(--text-muted)]">
+                        Renvoyer dans {resendCooldown}s
+                      </p>
+                    ) : (
+                      <button
+                        onClick={handleResendPin}
+                        disabled={isLoading}
+                        className="inline-flex items-center gap-1.5 text-xs text-orange-400 hover:text-orange-300 transition-colors disabled:opacity-50"
+                      >
+                        <RefreshCw className="w-3 h-3" />
+                        Renvoyer le code
+                      </button>
+                    )}
+                  </div>
 
-              <form onSubmit={handleSubmit} className="space-y-4">
-                <div className="space-y-4">
+                  {/* Retour */}
+                  <button
+                    onClick={() => switchMode("signup")}
+                    className="w-full flex items-center justify-center gap-2 text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
+                  >
+                    <ArrowLeft className="w-4 h-4" />
+                    Modifier l'email
+                  </button>
+                </div>
+              )}
+
+              {/* ── Formulaire principal (login / signup / magic / reset) ── */}
+              {mode !== "pin" && !emailSent && (
+                <form onSubmit={handleSubmit} className="space-y-4">
+                  {/* Email */}
                   <div className="space-y-1.5">
-                    <label className="block text-[9px] font-bold tracking-[0.2em] uppercase text-white/30 pl-1">
-                      Adresse Email
+                    <label className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide">
+                      Email
                     </label>
-                    <div className="relative group">
-                      <Mail size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-white/60 transition-colors" />
+                    <div className="relative">
+                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--icon-muted)]" />
                       <input
                         type="email"
                         value={email}
                         onChange={(e) => setEmail(e.target.value)}
-                        placeholder="votre@email.com"
-                        className="w-full pl-11 pr-5 py-3.5 rounded-xl bg-white/[0.02] border border-white/10 text-white placeholder-white/20 text-[14px] font-light focus:outline-none focus:border-white/30 focus:bg-white/[0.04] transition-all"
-                        disabled={loading}
+                        placeholder="vous@exemple.com"
                         required
                         autoFocus
+                        className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm
+                          bg-[var(--bg-input)] border border-[var(--border-glass)]
+                          text-[var(--text-primary)] placeholder:text-[var(--text-muted)]
+                          focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20
+                          transition-all"
                       />
                     </div>
                   </div>
 
+                  {/* Mot de passe (login + signup) */}
                   {(mode === "login" || mode === "signup") && (
-                    <div className="space-y-1.5 animate-fade-in">
-                      <label className="block text-[9px] font-bold tracking-[0.2em] uppercase text-white/30 pl-1">
-                        Mot de passe
-                      </label>
-                      <div className="relative group">
-                        <Lock size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-white/60 transition-colors" />
+                    <div className="space-y-1.5">
+                      <div className="flex items-center justify-between">
+                        <label className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide">
+                          Mot de passe
+                        </label>
+                        {mode === "login" && (
+                          <button
+                            type="button"
+                            onClick={() => switchMode("reset")}
+                            className="text-xs text-orange-400 hover:text-orange-300 transition-colors"
+                          >
+                            Oublié ?
+                          </button>
+                        )}
+                      </div>
+                      <div className="relative">
+                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--icon-muted)]" />
                         <input
                           type={showPassword ? "text" : "password"}
                           value={password}
                           onChange={(e) => setPassword(e.target.value)}
-                          placeholder="••••••••"
-                          className="w-full pl-11 pr-11 py-3.5 rounded-xl bg-white/[0.02] border border-white/10 text-white placeholder-white/20 text-[14px] font-light focus:outline-none focus:border-white/30 focus:bg-white/[0.04] transition-all"
-                          disabled={loading}
+                          placeholder={mode === "signup" ? "Minimum 6 caractères" : "Votre mot de passe"}
                           required
-                          minLength={6}
+                          className="w-full pl-9 pr-10 py-2.5 rounded-xl text-sm
+                            bg-[var(--bg-input)] border border-[var(--border-glass)]
+                            text-[var(--text-primary)] placeholder:text-[var(--text-muted)]
+                            focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20
+                            transition-all"
                         />
                         <button
                           type="button"
                           onClick={() => setShowPassword(!showPassword)}
-                          className="absolute right-4 top-1/2 -translate-y-1/2 text-white/20 hover:text-white transition-colors"
+                          className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--icon-muted)] hover:text-[var(--icon-active)] transition-colors"
                         >
-                          {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
+                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                         </button>
                       </div>
                     </div>
                   )}
-                </div>
 
-                {error && (
-                  <div className="px-4 py-2.5 rounded-xl bg-red-500/5 border border-red-500/20 text-red-400 text-[11px] font-medium animate-fade-in">
-                    {error}
-                  </div>
-                )}
+                  {/* Bouton principal */}
+                  <button
+                    type="submit"
+                    disabled={isLoading}
+                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm
+                      bg-orange-600 hover:bg-orange-500 text-white transition-colors
+                      disabled:opacity-50 disabled:cursor-not-allowed"
+                  >
+                    {isLoading ? (
+                      <Loader2 className="w-4 h-4 animate-spin" />
+                    ) : (
+                      <>
+                        {mode === "login" && <><ArrowRight className="w-4 h-4" /> Se connecter</>}
+                        {mode === "signup" && <><Shield className="w-4 h-4" /> Continuer (vérification email)</>}
+                        {mode === "magic" && <><Sparkles className="w-4 h-4" /> Envoyer le lien</>}
+                        {mode === "reset" && <><ArrowRight className="w-4 h-4" /> Réinitialiser</>}
+                      </>
+                    )}
+                  </button>
 
-                <button
-                  type="submit"
-                  disabled={loading || !email || ((mode === "login" || mode === "signup") && !password) || (mode === "reset" && !email)}
-                  className="w-full py-4 mt-2 rounded-xl bg-gradient-to-r from-orange-600 to-orange-500 text-white disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] transition-all duration-300 text-[14px] font-bold tracking-widest flex items-center justify-center gap-2 group shadow-[0_10px_30px_rgba(249,115,22,0.2)] hover:shadow-[0_15px_40px_rgba(249,115,22,0.4)] hover:brightness-110 active-press animate-sheen"
-                >
-                  {loading ? (
-                    <Loader2 size={18} className="animate-spin" />
-                  ) : (
-                    <>
-                      {mode === "magic" ? "Recevoir un Lien Magique" :
-                      mode === "reset" ? "Réinitialiser le mot de passe" :
-                      mode === "login" ? "Se connecter" : "Créer mon compte"}
-                      <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
-                    </>
-                  )}
-                </button>
-
-                <div className="flex flex-col gap-2 pt-4">
-                  {mode === "login" && (
+                  {/* Séparateur + Google */}
+                  {(mode === "login" || mode === "signup") && (
                     <>
+                      <div className="flex items-center gap-3">
+                        <div className="flex-1 h-px bg-[var(--border-glass)]" />
+                        <span className="text-xs text-[var(--text-muted)]">ou</span>
+                        <div className="flex-1 h-px bg-[var(--border-glass)]" />
+                      </div>
                       <button
                         type="button"
-                        onClick={() => { setMode("reset"); setEmailSent(false); }}
-                        className="text-[10px] text-white/30 hover:text-white/60 uppercase tracking-widest transition-colors py-1"
-                      >
-                        <span className="text-white/50 hover:text-white/80 transition-colors">Mot de passe oublié ?</span>
-                      </button>
-                      <button
-                        type="button"
-                        onClick={() => { setMode("signup"); setEmailSent(false); }}
-                        className="text-[10px] text-white/30 hover:text-white/60 uppercase tracking-widest transition-colors py-1"
-                      >
-                        Pas encore de compte ? <span className="text-white/80 font-bold underline underline-offset-4 decoration-white/20">Créer un compte</span>
-                      </button>
-                      <button
-                        type="button"
-                        onClick={() => { setMode("magic"); setEmailSent(false); }}
-                        className="text-[10px] text-white/20 hover:text-white/40 uppercase tracking-widest transition-colors py-1"
+                        onClick={onLoginWithGoogle}
+                        disabled={isLoading}
+                        className="w-full flex items-center justify-center gap-2.5 py-2.5 rounded-xl text-sm font-medium
+                          bg-[var(--bg-input)] border border-[var(--border-glass)]
+                          text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)]
+                          transition-colors disabled:opacity-50"
                       >
-                        Lien magique
+                        <Chrome className="w-4 h-4" />
+                        Continuer avec Google
                       </button>
                     </>
                   )}
-                  {mode === "signup" && (
+                </form>
+              )}
+
+              {/* ── Confirmation email envoyé ── */}
+              {emailSent && mode !== "pin" && (
+                <div className="text-center py-2 space-y-3">
+                  <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-green-500/10 mb-2">
+                    <Mail className="w-7 h-7 text-green-400" />
+                  </div>
+                  <p className="text-sm text-[var(--text-muted)]">
+                    {mode === "magic"
+                      ? "Vérifiez votre boîte mail et cliquez sur le lien de connexion."
+                      : "Un email de réinitialisation vous a été envoyé."}
+                  </p>
+                  <button
+                    onClick={() => { setEmailSent(false); switchMode("login"); }}
+                    className="text-sm text-orange-400 hover:text-orange-300 transition-colors"
+                  >
+                    Retour à la connexion
+                  </button>
+                </div>
+              )}
+            </div>
+
+            {/* Footer liens */}
+            {mode !== "pin" && !emailSent && (
+              <div className="px-8 pb-6 flex flex-col items-center gap-2.5">
+                {mode === "login" && (
+                  <>
                     <button
-                      type="button"
-                      onClick={() => { setMode("login"); setEmailSent(false); }}
-                      className="text-[10px] text-white/30 hover:text-white/60 uppercase tracking-widest transition-colors py-1"
+                      onClick={() => switchMode("reset")}
+                      className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                     >
-                      Déjà un compte ? <span className="text-white/80 font-bold underline underline-offset-4 decoration-white/20">Se connecter</span>
+                      Mot de passe oublié ?
                     </button>
-                  )}
-                  {mode === "reset" && (
+                    <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
+                      <span>Pas encore de compte ?</span>
+                      <button
+                        onClick={() => switchMode("signup")}
+                        className="text-orange-400 hover:text-orange-300 font-medium transition-colors"
+                      >
+                        S'inscrire
+                      </button>
+                    </div>
+                  </>
+                )}
+                {mode === "signup" && (
+                  <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
+                    <span>Déjà un compte ?</span>
                     <button
-                      type="button"
-                      onClick={() => { setMode("login"); setEmailSent(false); }}
-                      className="text-[10px] text-white/30 hover:text-white/60 uppercase tracking-widest transition-colors py-1"
+                      onClick={() => switchMode("login")}
+                      className="text-orange-400 hover:text-orange-300 font-medium transition-colors"
                     >
-                      <span className="text-white/80 font-bold underline underline-offset-4 decoration-white/20">Retour à la connexion</span>
+                      Se connecter
                     </button>
-                  )}
-                </div>
-              </form>
-            </div>
-          ) : (
-            <div className="text-center space-y-6 py-4">
-              <div className="w-16 h-16 mx-auto bg-green-500/10 rounded-full flex items-center justify-center border border-green-500/20 shadow-lg">
-                <Sparkles className="text-green-500" size={24} />
-              </div>
-              <div className="space-y-2">
-                <h2 className="text-white text-lg font-light tracking-wide">
-                  {mode === "reset" ? "Email envoyé !" : "Lien envoyé !"}
-                </h2>
-                <p className="text-white/40 text-[12px] font-light leading-relaxed px-4">
-                  Un mail a été envoyé à <span className="text-white/80">{email}</span>.
-                </p>
-              </div>
-              <button
-                onClick={() => setEmailSent(false)}
-                className="mt-6 w-full py-3.5 rounded-xl bg-white/[0.03] text-white/60 border border-white/10 hover:bg-white/[0.06] hover:text-white text-[10px] font-bold tracking-[0.2em] uppercase transition-all"
-              >
-                Retour
-              </button>
-            </div>
-          )}
-        </div>
-
-          {/* Footer */}
-          <div className="mt-8 pt-6 border-t border-white/[0.05]">
-            <div className="flex justify-center items-center gap-4 opacity-20">
-              <div className="flex items-center gap-2">
-                <Shield size={10} />
-                <span className="text-[8px] font-light tracking-widest uppercase">Secured</span>
+                  </div>
+                )}
+                {(mode === "magic" || mode === "reset") && (
+                  <button
+                    onClick={() => switchMode("login")}
+                    className="inline-flex items-center gap-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
+                  >
+                    <ArrowLeft className="w-3 h-3" />
+                    Retour à la connexion
+                  </button>
+                )}
+                {onBack && (
+                  <button
+                    onClick={onBack}
+                    className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors mt-1"
+                  >
+                    ← Retour
+                  </button>
+                )}
               </div>
-              <div className="w-1 h-1 rounded-full bg-white" />
-              <span className="text-[8px] font-light tracking-widest uppercase">v2.0</span>
-            </div>
+            )}
           </div>
-        </div>
-      </div>
+
+          {/* Badge sécurité */}
+          {mode === "signup" && (
+            <p className="text-center text-xs text-[var(--text-muted)] mt-4 flex items-center justify-center gap-1.5">
+              <Shield className="w-3.5 h-3.5 text-green-500" />
+              Vérification email obligatoire pour protéger votre compte
+            </p>
+          )}
+          {mode === "pin" && (
+            <p className="text-center text-xs text-[var(--text-muted)] mt-4 flex items-center justify-center gap-1.5">
+              <Shield className="w-3.5 h-3.5 text-green-500" />
+              Code valable 10 minutes · 5 tentatives max
+            </p>
+          )}
+        </motion.div>
+      </AnimatePresence>
     </div>
   );
 }

```


**INSTRUCTIONS POUR GAMMA :**
1. Lis attentivement ce diff.
2. Si c'est parfait, tape: `node flare_review.js approve TKT-005`
3. S'il y a des erreurs, tape: `node flare_review.js reject TKT-005 "Tes explications..."`
