# CODE REVIEW REQUEST: TKT-004
**Auteur**: DELTA
**Date**: 2026-03-21T09:54:17.425Z

## Changements

### DIFF POUR frontend/src/components/SettingsModal.tsx
```diff
diff --git a/frontend/src/components/SettingsModal.tsx b/frontend/src/components/SettingsModal.tsx
index 40346f6..200963e 100644
--- a/frontend/src/components/SettingsModal.tsx
+++ b/frontend/src/components/SettingsModal.tsx
@@ -12,8 +12,56 @@ interface SettingsModalProps {
   onStartTour?: () => void;
 }
 
+const parsePreferences = (text: string) => {
+  const result = { profile: '', tone: '', format: '', other: '' };
+  if (!text) return result;
+
+  const extractSection = (marker: string, nextMarkers: string[]) => {
+    if (!text.includes(marker)) return null;
+    const startIndex = text.indexOf(marker) + marker.length;
+    let endIndex = text.length;
+    for (const next of nextMarkers) {
+      const idx = text.indexOf(next, startIndex);
+      if (idx !== -1 && idx < endIndex) {
+        endIndex = idx;
+      }
+    }
+    return text.substring(startIndex, endIndex).trim();
+  };
+
+  const hasMarkers = ['🎯 Profil :', '🎭 Ton :', '📝 Format :', '💡 Autre :'].some(m => text.includes(m));
+
+  if (!hasMarkers) {
+    result.other = text;
+    return result;
+  }
+
+  const profile = extractSection('🎯 Profil :', ['🎭 Ton :', '📝 Format :', '💡 Autre :']);
+  const tone = extractSection('🎭 Ton :', ['🎯 Profil :', '📝 Format :', '💡 Autre :']);
+  const format = extractSection('📝 Format :', ['🎯 Profil :', '🎭 Ton :', '💡 Autre :']);
+  const other = extractSection('💡 Autre :', ['🎯 Profil :', '🎭 Ton :', '📝 Format :']);
+
+  if (profile) result.profile = profile;
+  if (tone) result.tone = tone;
+  if (format) result.format = format;
+  if (other) result.other = other;
+
+  return result;
+};
+
+const formatPreferences = (prefs: { profile: string, tone: string, format: string, other: string }) => {
+  let result = '';
+  if (prefs.profile) result += `🎯 Profil :\n${prefs.profile}\n\n`;
+  if (prefs.tone) result += `🎭 Ton :\n${prefs.tone}\n\n`;
+  if (prefs.format) result += `📝 Format :\n${prefs.format}\n\n`;
+  if (prefs.other) result += `💡 Autre :\n${prefs.other}\n\n`;
+  return result.trim();
+};
+
 export default function SettingsModal({ isOpen, onClose, token, onStartTour }: SettingsModalProps) {
   const [userPreferences, setUserPreferences] = useState("");
+  const [prefMode, setPrefMode] = useState<"guided" | "raw">("guided");
+  const [guidedPrefs, setGuidedPrefs] = useState({ profile: "", tone: "", format: "", other: "" });
   const [loading, setLoading] = useState(false);
   const [saving, setSaving] = useState(false);
   const [saved, setSaved] = useState(false);
@@ -40,7 +88,10 @@ export default function SettingsModal({ isOpen, onClose, token, onStartTour }: S
       setLoading(true);
       setSaved(false);
       getUserPreferences(token)
-        .then((prefs) => setUserPreferences(prefs))
+        .then((prefs) => {
+          setUserPreferences(prefs);
+          setGuidedPrefs(parsePreferences(prefs)); // Parse on load
+        })
         .catch((err) => console.error("Erreur chargement préférences:", err))
         .finally(() => setLoading(false));
       // Charger le plan de l'utilisateur
@@ -52,6 +103,21 @@ export default function SettingsModal({ isOpen, onClose, token, onStartTour }: S
     }
   }, [isOpen, token]);
 
+  // Sync guided inputs to the master userPreferences string
+  useEffect(() => {
+    if (prefMode === 'guided') {
+      setUserPreferences(formatPreferences(guidedPrefs));
+    }
+  }, [guidedPrefs, prefMode]);
+
+  // Sync modes when switching
+  useEffect(() => {
+    if (prefMode === 'guided') {
+      setGuidedPrefs(parsePreferences(userPreferences));
+    } 
+    // No need for an else, as the other useEffect handles guided -> raw sync
+  }, [prefMode, userPreferences]);
+
   useEffect(() => {
     if (!isOpen) return;
     const handleEsc = (e: KeyboardEvent) => { if (e.key === "Escape") { setConfirmDialog(null); onClose(); } };
@@ -218,17 +284,34 @@ export default function SettingsModal({ isOpen, onClose, token, onStartTour }: S
           {activeSection === "agent" && (
             <div className="animate-fade-in-up">
               <div className="flex items-center justify-between mb-4">
-                <h3 className="text-[14px] font-bold text-[var(--text-primary)] tracking-[0.05em] uppercase flex items-center gap-2 font-[family-name:var(--font-outfit)]">
-                  <Sparkles size={16} className="text-orange-400" />
-                  Préférences de l&apos;Agent
-                </h3>
+                 <h3 className="text-[14px] font-bold text-[var(--text-primary)] tracking-[0.05em] uppercase flex items-center gap-2 font-[family-name:var(--font-outfit)]">
+                   <Sparkles size={16} className="text-orange-400" />
+                   Préférences de l&apos;Agent
+                 </h3>
+
+                {/* Mode Toggle */}
+                <div className="flex items-center gap-1 bg-[var(--bg-sidebar)] p-1 rounded-xl border border-[var(--border-glass)]">
+                   <button 
+                     onClick={() => setPrefMode("guided")}
+                     className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${prefMode === 'guided' ? 'bg-orange-500/20 text-orange-300' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
+                   >
+                     Guidé
+                   </button>
+                   <button 
+                     onClick={() => setPrefMode("raw")}
+                     className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${prefMode === 'raw' ? 'bg-orange-500/20 text-orange-300' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
+                   >
+                     Brut
+                   </button>
+                 </div>
               </div>
+
               <div className="mb-5 p-4 rounded-2xl bg-orange-500/5 border border-orange-500/10">
                 <p className="text-[13px] text-[var(--text-muted)] font-light leading-relaxed">
-                  Parlez à l&apos;IA de vous : votre activité, vos habitudes, votre façon de travailler, vos préférences de communication. Elle s&apos;adaptera automatiquement à chaque conversation.
-                </p>
-                <p className="text-[13px] text-orange-400 font-medium mt-2">
-                  Ces informations personnelles enrichissent chaque échange pour des réponses sur mesure.
+                  {prefMode === 'guided'
+                    ? "Remplissez les champs pour définir le comportement de l'IA. Elle s'adaptera à chaque conversation."
+                    : "Décrivez directement votre profil, ton, et format de réponse souhaité. L'IA interprétera le texte."
+                  }
                 </p>
               </div>
               
@@ -237,18 +320,68 @@ export default function SettingsModal({ isOpen, onClose, token, onStartTour }: S
                   <div className="w-full h-80 bg-[var(--bg-card)] rounded-2xl border border-[var(--border-glass)] animate-pulse flex items-center justify-center text-[var(--text-muted)]">
                     Chargement...
                   </div>
+                ) : prefMode === 'guided' ? (
+                  <div className="space-y-4">
+                    
+                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
+                      {/* Profil Input */}
+                      <div>
+                        <label className="text-xs font-bold text-[var(--text-muted)] ml-2">🎯 Profil</label>
+                        <textarea
+                          value={guidedPrefs.profile}
+                          onChange={(e) => setGuidedPrefs(p => ({...p, profile: e.target.value}))}
+                          className="mt-1 w-full h-24 bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-xl p-3 text-[var(--text-primary)] text-sm outline-none focus:border-orange-500/30 transition-all resize-y custom-scrollbar"
+                          placeholder="Ex: Développeur front-end, passionné de design system..."
+                        />
+                      </div>
+
+                      {/* Ton Input */}
+                      <div>
+                        <label className="text-xs font-bold text-[var(--text-muted)] ml-2">🎭 Ton</label>
+                        <textarea
+                          value={guidedPrefs.tone}
+                          onChange={(e) => setGuidedPrefs(p => ({...p, tone: e.target.value}))}
+                          className="mt-1 w-full h-24 bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-xl p-3 text-[var(--text-primary)] text-sm outline-none focus:border-orange-500/30 transition-all resize-y custom-scrollbar"
+                          placeholder="Ex: Clair, concis, technique mais accessible..."
+                        />
+                      </div>
+                    </div>
+
+                    {/* Format Input */}
+                    <div>
+                      <label className="text-xs font-bold text-[var(--text-muted)] ml-2">📝 Format</label>
+                      <textarea
+                        value={guidedPrefs.format}
+                        onChange={(e) => setGuidedPrefs(p => ({...p, format: e.target.value}))}
+                        className="mt-1 w-full h-24 bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-xl p-3 text-[var(--text-primary)] text-sm outline-none focus:border-orange-500/30 transition-all resize-y custom-scrollbar"
+                        placeholder="Ex: Listes à puces, code en blocs, résumé en fin de message..."
+                      />
+                    </div>
+                    
+                    {/* Détails/Autre Input */}
+                    <div>
+                      <label className="text-xs font-bold text-[var(--text-muted)] ml-2">💡 Détails (Autre)</label>
+                      <textarea
+                        value={guidedPrefs.other}
+                        onChange={(e) => setGuidedPrefs(p => ({...p, other: e.target.value}))}
+                        className="mt-1 w-full h-32 bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-xl p-3 text-[var(--text-primary)] text-sm outline-none focus:border-orange-500/30 transition-all resize-y custom-scrollbar"
+                        placeholder="Toute autre information pertinente..."
+                      />
+                    </div>
+
+                  </div>
                 ) : (
                   <textarea
                     value={userPreferences}
                     onChange={(e) => setUserPreferences(e.target.value)}
-                    className="w-full h-40 bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-2xl p-6 text-[var(--text-primary)] text-[14px] font-sans leading-relaxed outline-none focus:border-orange-500/30 transition-all resize-none custom-scrollbar mb-8"
+                    className="w-full h-96 bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-2xl p-6 text-[var(--text-primary)] text-[14px] font-sans leading-relaxed outline-none focus:border-orange-500/30 transition-all resize-y custom-scrollbar mb-8"
                     placeholder="Ex: Je m'appelle Marie, je suis graphiste freelance. Je préfère des réponses courtes et directes..."
                     spellCheck={false}
                   />
                 )}
               </div>
 
-              <div className="pt-4 border-t border-[var(--border-glass)]">
+              <div className="pt-8 mt-8 border-t border-[var(--border-glass)]">
                 <h3 className="text-[14px] font-bold text-[var(--text-primary)] tracking-[0.05em] uppercase flex items-center gap-2 font-[family-name:var(--font-outfit)] mb-5">
                    <BookOpen size={16} className="text-orange-400" />
                    Base de Connaissances
@@ -281,10 +414,10 @@ export default function SettingsModal({ isOpen, onClose, token, onStartTour }: S
                       Plan {userPlan.plan_name}
                     </div>
                     <p className="text-[12px] text-[var(--text-muted)] mt-1">
-                      Modèle IA : <span className="text-[var(--text-primary)] font-medium">FLARE AI 2.5</span>
+                      Modèle IA : <span className="text-[var(--text-primary)] font-medium">FLARE AI 3.6</span>
                     </p>
                     <p className="text-[11px] text-[var(--text-muted)] mt-1">
-                      Clé API dédiée : {userPlan.has_api_key ? <span className="text-green-400">✅ Active</span> : <span className="text-yellow-400">⏳ En cours de génération...</span>}
+                      Budget quotidien : <span className="text-[var(--text-primary)] font-medium">${userPlan.daily_budget_usd}/jour</span>
                     </p>
                   </>
                 ) : (
@@ -295,14 +428,14 @@ export default function SettingsModal({ isOpen, onClose, token, onStartTour }: S
               {/* Usage Progress */}
               {userPlan && (
                 <div className="p-6 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-glass)] space-y-5">
-                  <h4 className="text-[10px] font-bold tracking-[0.2em] uppercase text-orange-500/50 font-[family-name:var(--font-outfit)]">Consommation du Mois</h4>
-                  
-                  {/* Messages */}
+                  <h4 className="text-[10px] font-bold tracking-[0.2em] uppercase text-orange-500/50 font-[family-name:var(--font-outfit)]">Consommation du Jour</h4>
+
+                  {/* Budget quotidien */}
                   <div className="space-y-2">
                     <div className="flex justify-between text-[13px]">
-                      <span className="text-[var(--text-muted)] flex items-center gap-1.5"><Zap size={14} /> Messages</span>
+                      <span className="text-[var(--text-muted)] flex items-center gap-1.5"><Zap size={14} /> Budget</span>
                       <span className="text-[var(--text-primary)] font-medium">
-                        {userPlan.usage_messages} / {userPlan.monthly_messages === -1 ? "∞" : userPlan.monthly_messages}
+                        ${userPlan.daily_cost_usd.toFixed(4)} / {userPlan.daily_budget_usd === -1 ? "∞" : `$${userPlan.daily_budget_usd}`}
                       </span>
                     </div>
                     <div className="h-2 bg-[var(--bg-hover)] rounded-full overflow-hidden">
@@ -315,8 +448,7 @@ export default function SettingsModal({ isOpen, onClose, token, onStartTour }: S
                       />
                     </div>
                     <p className="text-[11px] text-[var(--text-muted)]">
-                      {userPlan.usage_percent}% utilisé
-                      {userPlan.reset_at && ` — Reset le ${new Date(userPlan.reset_at).toLocaleDateString("fr-FR")}`}
+                      {userPlan.usage_percent.toFixed(1)}% utilisé — Reset à minuit UTC
                     </p>
                   </div>
                 </div>
@@ -372,7 +504,7 @@ export default function SettingsModal({ isOpen, onClose, token, onStartTour }: S
                     { label: "Auth", value: "Firebase Auth" },
                     { label: "Database", value: "Google Cloud" },
                     { label: "Backend", value: "Python FastAPI" },
-                    { label: "IA Engine", value: "FLARE Core 2.5" },
+                    { label: "IA Engine", value: "FLARE Core 3.6" },
                   ].map((item) => (
                     <div key={item.label} className="flex items-center justify-between py-2 border-b border-[var(--border-glass)] last:border-b-0">
                       <span className="text-[13px] text-[var(--text-muted)] font-light">{item.label}</span>
@@ -386,7 +518,7 @@ export default function SettingsModal({ isOpen, onClose, token, onStartTour }: S
                 <p className="text-[12px] text-[var(--text-muted)] font-light leading-relaxed">
                   Développé avec ❤️ par l&apos;équipe RAM&apos;S FLARE<br/>
                   Intelligence Artificielle au service de la performance<br/>
-                  <span className="text-[10px] opacity-30 mt-1 block">v2.5.3 — Stable</span>
+                  <span className="text-[10px] opacity-30 mt-1 block">v3.6.0 — Stable</span>
                 </p>
               </div>
             </div>
@@ -474,7 +606,7 @@ export default function SettingsModal({ isOpen, onClose, token, onStartTour }: S
               <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center">
                 <BookOpen className="text-orange-400" size={20} />
               </div>
-              <h2 className="text-[20px] font-bold text-[var(--text-primary)] tracking-tight font-[family-name:var(--font-outfit)]">Guide Complet FLARE AI 2.5</h2>
+              <h2 className="text-[20px] font-bold text-[var(--text-primary)] tracking-tight font-[family-name:var(--font-outfit)]">Guide Complet FLARE AI 3.6</h2>
             </div>
             <button 
               onClick={() => setViewingFullGuide(false)}
@@ -491,7 +623,7 @@ export default function SettingsModal({ isOpen, onClose, token, onStartTour }: S
               <section>
                 <h3 className="text-[22px] font-bold text-orange-400 mb-4 font-[family-name:var(--font-outfit)]">Introduction</h3>
                 <p className="text-[15px] text-[var(--text-primary)] font-light leading-relaxed">
-                  Bienvenue dans l&apos;écosystème **FLARE AI**. Cette version 2.5 est conçue pour être votre centre de commande intelligent. Que vous soyez un créateur, un chercheur ou un professionnel, nos outils sont là pour amplifier vos capacités.
+                  Bienvenue dans l&apos;écosystème **FLARE AI**. Cette version 3.6 est conçue pour être votre centre de commande intelligent. Que vous soyez un créateur, un chercheur ou un professionnel, nos outils sont là pour amplifier vos capacités.
                 </p>
               </section>
 

```


**INSTRUCTIONS POUR GAMMA :**
1. Lis attentivement ce diff.
2. Si c'est parfait, tape: `node flare_review.js approve TKT-004`
3. S'il y a des erreurs, tape: `node flare_review.js reject TKT-004 "Tes explications..."`
