"use client";

import { useEffect, useState, useRef, ChangeEvent, useCallback } from "react";
import { Brain, Plus, X, Trash2, RefreshCw, Upload, FileText, Sparkles, ChevronDown, ChevronRight, List, Square, CheckSquare, Zap, Check } from "lucide-react";
import { getFacts, addFact, deleteFact, MemoryFact } from "@/lib/api";

const CATEGORIES = ["general", "client", "agence", "preference", "projet"] as const;
type Category = (typeof CATEGORIES)[number];

const CATEGORY_META: Record<Category, { label: string; badgeBg: string; badgeText: string; dotColor: string }> = {
  general:    { label: "Général",       badgeBg: "bg-zinc-800/50",    badgeText: "text-zinc-300",   dotColor: "bg-zinc-400" },
  client:     { label: "Clients",       badgeBg: "bg-orange-950/20",   badgeText: "text-orange-300",  dotColor: "bg-orange-400" },
  agence:     { label: "Agence",        badgeBg: "bg-zinc-800/50",    badgeText: "text-zinc-300",   dotColor: "bg-zinc-400" },
  preference: { label: "Préférences",   badgeBg: "bg-zinc-800/50",    badgeText: "text-zinc-300",   dotColor: "bg-zinc-400" },
  projet:     { label: "Projets",       badgeBg: "bg-zinc-800/50",    badgeText: "text-zinc-300",   dotColor: "bg-zinc-400" },
};

const CARD_BORDER: Record<Category, string> = {
  general:    "border-white/5 bg-zinc-900/20",
  client:     "border-orange-500/10 bg-orange-500/[0.02]",
  agence:     "border-white/5 bg-zinc-900/20",
  preference: "border-white/5 bg-zinc-900/20",
  projet:     "border-white/5 bg-zinc-900/20",
};

function formatKey(key: string): string {
  return key
    .split(/[_-]/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

function parseUtcDate(dateStr?: string | null): Date | null {
  if (!dateStr) return null;
  const normalized = /(?:Z|[+-]\d{2}:\d{2})$/.test(dateStr) ? dateStr : `${dateStr}Z`;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

function timeAgo(dateStr: string): string {
  const date = parseUtcDate(dateStr);
  if (!date) return "date inconnue";
  const diff = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diff < 60) return "à l'instant";
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)} h`;
  if (diff < 604800) return `il y a ${Math.floor(diff / 86400)} j`;
  return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

function formatExactDate(dateStr: string): string {
  const date = parseUtcDate(dateStr);
  if (!date) return "Date inconnue";
  const now = new Date();
  if (date.toDateString() === now.toDateString()) {
    return `Aujourd'hui à ${date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`;
  }
  return date.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type TabType = "facts" | "add" | "import";

export default function MemoryPanel({ token }: { token?: string | null }) {
  const [facts, setFacts] = useState<MemoryFact[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>("facts");
  const [form, setForm] = useState({ key: "", value: "", category: "general" as Category });
  const [saving, setSaving] = useState(false);
  const [deletingKey, setDeletingKey] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [importFile, setImportFile] = useState<{ name: string; content: string } | null>(null);
  const [importSummary, setImportSummary] = useState("");
  const [importCategory, setImportCategory] = useState<Category>("general");
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Bulk selection
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [isDeletingBulk, setIsDeletingBulk] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await getFacts(undefined, token);
      setFacts(data);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 60000);
    return () => clearInterval(interval);
  }, [load]);

  const handleAdd = async () => {
    if (!form.key.trim() || !form.value.trim()) return;
    setSaving(true);
    try {
      await addFact(form.key.trim(), form.value.trim(), form.category, token);
      setForm({ key: "", value: "", category: "general" });
      setActiveTab("facts");
      await load();
    } finally { setSaving(false); }
  };

  const handleDelete = async (key: string) => {
    setDeletingKey(key);
    try {
      await deleteFact(key, token);
      setFacts((prev) => prev.filter((f) => f.key !== key));
    } finally { setDeletingKey(null); }
  };

  const toggleSelection = (key: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedKeys.size === facts.length) {
      setSelectedKeys(new Set());
    } else {
      setSelectedKeys(new Set(facts.map(f => f.key)));
    }
  };

  const handleBulkCategoryMove = async (newCategory: Category) => {
    if (selectedKeys.size === 0) return;
    setIsDeletingBulk(true);
    try {
      // Pour la mémoire, on fait des addFact (upsert) pour chaque clé avec la nouvelle catégorie
      const selectedFacts = facts.filter(f => selectedKeys.has(f.key));
      for (const f of selectedFacts) {
        await addFact(f.key, f.value, newCategory, token);
      }
      await load();
      setSelectedKeys(new Set());
      setSelectionMode(false);
    } catch (error) {
      console.error("Erreur changement catégorie groupé:", error);
    } finally {
      setIsDeletingBulk(false);
    }
  };

  const handleBulkDeleteAction = async () => {
    if (selectedKeys.size === 0) return;
    if (!confirm(`Supprimer ces ${selectedKeys.size} souvenirs ?`)) return;
    
    setIsDeletingBulk(true);
    try {
      await Promise.all(Array.from(selectedKeys).map(key => deleteFact(key, token)));
      setFacts(prev => prev.filter(f => !selectedKeys.has(f.key)));
      setSelectedKeys(new Set());
      setSelectionMode(false);
    } catch (error) {
      console.error("Erreur suppression groupée:", error);
    } finally {
      setIsDeletingBulk(false);
    }
  };

  const handleFileImport = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result as string;
      setImportFile({ name: file.name, content: content.slice(0, 4000) });
    };
    reader.readAsText(file, "UTF-8");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSaveImport = async () => {
    if (!importFile || !importSummary.trim()) return;
    setSaving(true);
    try {
      const safeName = importFile.name.replace(/[^a-z0-9]/gi, "_").toLowerCase();
      await addFact(`fichier_${safeName}`, importSummary.trim(), importCategory, token);
      if (importFile.content.trim()) {
        await addFact(`contenu_${safeName}`, importFile.content.slice(0, 500), importCategory, token);
      }
      setImportFile(null);
      setImportSummary("");
      setActiveTab("facts");
      await load();
    } finally { setSaving(false); }
  };

  const grouped = CATEGORIES.reduce<Record<Category, MemoryFact[]>>((acc, cat) => {
    acc[cat] = facts
      .filter((f) => f.category === cat)
      .sort((a, b) => (parseUtcDate(b.updated_at)?.getTime() ?? 0) - (parseUtcDate(a.updated_at)?.getTime() ?? 0));
    return acc;
  }, {} as Record<Category, MemoryFact[]>);

  const toggleCollapse = (cat: string) =>
    setCollapsed((prev) => ({ ...prev, [cat]: !prev[cat] }));

  const TABS = [
    { id: "facts" as TabType, label: "Souvenirs" },
    { id: "add" as TabType, label: "Ajouter" },
    { id: "import" as TabType, label: "Importer" },
  ];

  return (
    <div className="flex-1 overflow-y-auto bg-[var(--background)] custom-scrollbar transition-colors">
      <div className="max-w-2xl mx-auto px-4 py-12">

        {/* Header */}
        <div className="flex items-center justify-between mb-10 animate-fade-in-up">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-[24px] bg-[var(--bg-hover)] border border-[var(--border-glass)] flex items-center justify-center shadow-[0_0_20px_rgba(255,255,255,0.05)] animate-pulse-glow">
              <Brain size={26} className="text-[var(--text-primary)]" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-[var(--text-primary)] tracking-widest uppercase">Mémoire Système</h2>
              <p className="text-[13px] text-[var(--text-muted)] font-normal tracking-wide mt-2">
                {loading ? "Chargement des vecteurs..." : `${facts.length} enregistrement${facts.length !== 1 ? "s" : ""} actifs`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setSelectionMode(!selectionMode);
                if (selectionMode) setSelectedKeys(new Set());
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-2xl border transition-all duration-300 ${
                selectionMode 
                  ? 'bg-[var(--text-primary)] text-[rgb(var(--background))] border-[var(--border-subtle)] shadow-lg scale-105' 
                  : 'bg-[var(--bg-hover)] border-[var(--border-glass)] text-[var(--text-muted)] hover:text-[var(--text-primary)] shadow-sm'
              }`}
              title="Mode sélection"
            >
              {selectionMode ? <Check size={14} strokeWidth={3} /> : <List size={14} strokeWidth={2.5} />}
              <span className="text-[11px] font-bold uppercase tracking-wider">{selectionMode ? 'Terminer' : 'Sélectionner'}</span>
            </button>

            {selectionMode && (
              <button
                onClick={handleSelectAll}
                className="flex items-center gap-2 px-3 py-2 rounded-2xl bg-white/5 border border-white/10 text-white/70 hover:text-white hover:bg-white/20 transition-all font-bold text-[10px] uppercase tracking-widest shadow-sm"
              >
                {selectedKeys.size === facts.length ? <CheckSquare size={14} /> : <Square size={14} />}
                <span>Tout</span>
              </button>
            )}

            <button
              onClick={load}
              disabled={loading}
              className="p-2.5 rounded-xl text-zinc-600 hover:text-white hover:bg-zinc-900 transition-all disabled:opacity-40"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 p-1.5 bg-[var(--bg-sidebar)]/50 rounded-[28px] border border-[var(--border-glass)] mb-14 animate-fade-in-up" style={{ animationDelay: '100ms' }}>
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 px-4 py-4 rounded-[22px] text-[13px] font-bold tracking-[0.1em] uppercase transition-all duration-300 ${
                activeTab === tab.id
                  ? "bg-[var(--text-primary)] text-[rgb(var(--background))] shadow-[0_8px_20px_rgba(255,255,255,0.1)] scale-[1.02]"
                  : "text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* TAB : Souvenirs */}
        {activeTab === "facts" && (
          <div className="space-y-6">
            {!loading && facts.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="w-16 h-16 rounded-3xl bg-zinc-900 border border-white/5 flex items-center justify-center mb-6">
                  <Sparkles size={24} className="text-zinc-700" />
                </div>
                <p className="text-zinc-300 font-medium text-lg mb-3">Aucun enregistrement contextuel</p>
                <p className="text-zinc-500 text-sm font-normal max-w-sm leading-relaxed">
                  L&apos;intelligence artificielle mémorisera automatiquement les faits pertinents au fil des échanges pour enrichir sa compréhension.
                </p>
              </div>
            )}

            {CATEGORIES.map((cat) => {
              const items = grouped[cat];
              if (!items.length) return null;
              const meta = CATEGORY_META[cat];
              const isOpen = !collapsed[cat];
              return (
                <div key={cat} className="animate-msg-pop">
                  <button
                    onClick={() => toggleCollapse(cat)}
                    className="flex items-center gap-3 w-full mb-4 group"
                  >
                    <div className={`w-1.5 h-1.5 rounded-full ${meta.dotColor} shadow-[0_0_8px_currentColor]`} />
                    <span className="text-[12px] font-bold tracking-[0.2em] uppercase text-[var(--text-primary)]">
                      {meta.label}
                    </span>
                    <span className="text-[12px] text-[var(--text-muted)] font-bold ml-2">({items.length})</span>
                    <div className="flex-1 h-px bg-[var(--border-glass)] ml-2"></div>
                    <span className="text-[var(--text-muted)] group-hover:text-[var(--text-primary)] transition-colors">
                      {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </span>
                  </button>

                  {isOpen && (
                    <div className="grid grid-cols-1 gap-3">
                      {items.map((fact) => (
                        <div
                          key={fact.key}
                          onClick={() => selectionMode && toggleSelection(fact.key)}
                          className={`card-premium group flex items-start justify-between gap-4 p-6 animate-slide-up ${selectionMode ? 'cursor-pointer' : ''} ${selectedKeys.has(fact.key) ? 'border-[var(--border-subtle)] bg-[var(--bg-hover)]' : ''}`}
                        >
                          <div className="flex items-start gap-4 flex-1 min-w-0">
                            {selectionMode && (
                              <button 
                                onClick={(e) => toggleSelection(fact.key, e)}
                                className={`mt-1 transition-colors ${selectedKeys.has(fact.key) ? "text-[var(--text-primary)]" : "text-zinc-600 hover:text-[var(--text-primary)]"}`}
                              >
                                {selectedKeys.has(fact.key) ? <CheckSquare size={18} /> : <Square size={18} />}
                              </button>
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-3">
                                <Sparkles size={10} className="text-[var(--text-primary)]/50" />
                                <p className="text-[10px] font-bold text-[var(--text-primary)]/70 truncate uppercase tracking-widest">{formatKey(fact.key)}</p>
                              </div>
                              <p className="text-[15px] text-[var(--text-primary)] font-normal leading-relaxed">{fact.value}</p>
                              <p
                                className="text-[10px] text-[var(--text-muted)] mt-5 font-medium tracking-[0.08em] uppercase opacity-50"
                                title={formatExactDate(fact.updated_at)}
                              >
                                {formatExactDate(fact.updated_at)} · {timeAgo(fact.updated_at)}
                              </p>
                            </div>
                          </div>
                          {!selectionMode && (
                            <button
                              onClick={() => handleDelete(fact.key)}
                              disabled={deletingKey === fact.key}
                              className="p-2.5 rounded-xl text-[var(--text-muted)] hover:text-red-500 hover:bg-red-500/5 transition-all opacity-0 group-hover:opacity-100 shrink-0"
                            >
                              {deletingKey === fact.key
                                ? <RefreshCw size={14} className="animate-spin" />
                                : <Trash2 size={16} />}
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            
            {/* Bulk Action Bar for Memory */}
            {selectionMode && selectedKeys.size > 0 && (
              <div className="sticky bottom-8 left-0 right-0 z-50 animate-slide-up">
                <div className="bg-[var(--bg-modal)] border border-[var(--border-subtle)] rounded-3xl p-4 shadow-2xl backdrop-blur-2xl flex items-center justify-between gap-6 max-w-lg mx-auto">
                  <div className="flex items-center gap-3 pl-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-[var(--text-primary)] animate-pulse" />
                    <span className="text-[13px] font-bold text-[var(--text-primary)] uppercase tracking-wider">{selectedKeys.size} sélectionnés</span>
                  </div>
                    <div className="flex items-center gap-3">
                      <select
                        onChange={(e) => handleBulkCategoryMove(e.target.value as Category)}
                        className="bg-zinc-900/50 border border-white/10 rounded-xl px-3 py-2 text-[11px] font-bold text-white outline-none hover:bg-zinc-800 transition-colors cursor-pointer uppercase tracking-widest"
                        value=""
                      >
                        <option value="" disabled>Déplacer...</option>
                        {CATEGORIES.map(c => (
                          <option key={c} value={c}>{CATEGORY_META[c].label}</option>
                        ))}
                      </select>
                      <button
                        onClick={() => setSelectedKeys(new Set())}
                        className="px-4 py-2 rounded-xl text-[12px] font-bold text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors uppercase tracking-widest"
                      >
                        Annuler
                      </button>
                      <button
                        onClick={handleBulkDeleteAction}
                        disabled={isDeletingBulk}
                        className="px-6 py-3 rounded-2xl bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white border border-red-500/20 transition-all text-[12px] font-bold uppercase tracking-widest flex items-center gap-2"
                      >
                        {isDeletingBulk ? <Zap size={14} className="animate-spin" /> : <Trash2 size={14} />}
                        Supprimer
                      </button>
                    </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB : Ajouter */}
        {activeTab === "add" && (
          <div className="bg-[var(--bg-card)] backdrop-blur-3xl rounded-[32px] border border-[var(--border-glass)] p-8 space-y-8 shadow-2xl animate-scale-in">
            <h3 className="text-2xl font-bold text-[var(--text-primary)] tracking-widest uppercase mb-4">Nouveau Vecteur</h3>
            <p className="text-[15px] text-[var(--text-muted)] font-normal leading-relaxed mb-6">Ajoutez une information stable que l&apos;agent pourra utiliser dans ses futurs raisonnements.</p>
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="block text-[11px] font-bold tracking-widest uppercase text-zinc-400 pl-1 mb-2">Identifiant (Clé)</label>
                <input
                  type="text"
                  value={form.key}
                  onChange={(e) => setForm((f) => ({ ...f, key: e.target.value }))}
                  placeholder="ex: preference_couleur, nom_societe..."
                  className="w-full bg-[var(--bg-input)] border border-[var(--border-glass)] focus:border-[var(--border-subtle)] rounded-2xl px-6 py-5 text-[15px] text-[var(--text-primary)] placeholder-[var(--text-muted)]/50 outline-none transition-all font-normal shadow-inner"
                />
              </div>
              <div className="space-y-2">
                <label className="block text-[11px] font-bold tracking-widest uppercase text-[var(--text-muted)] pl-1 mb-2">Valeur / Donnée</label>
                <textarea
                  value={form.value}
                  onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))}
                  placeholder="Saisissez l'information à mémoriser..."
                  rows={6}
                  className="w-full bg-[var(--bg-input)] border border-[var(--border-glass)] focus:border-[var(--border-subtle)] rounded-2xl px-6 py-5 text-[15px] text-[var(--text-primary)] placeholder-[var(--text-muted)]/50 outline-none transition-all resize-none font-normal leading-relaxed shadow-inner"
                />
              </div>
              <div className="space-y-2">
                <label className="block text-[10px] font-light tracking-widest uppercase text-zinc-500 pl-1">Catégorie</label>
                <select
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as Category }))}
                  className="w-full bg-zinc-900/40 border border-white/5 focus:border-[var(--border-subtle)] rounded-2xl px-5 py-4 text-sm text-white outline-none transition-all font-light appearance-none"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c} className="bg-zinc-900">{CATEGORY_META[c].label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-4 pt-6">
              <button
                onClick={() => setActiveTab("facts")}
                className="flex-[0.4] py-5 rounded-2xl bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] border border-[var(--border-glass)] transition-all text-[15px] font-bold uppercase tracking-widest"
              >
                Annuler
              </button>
              <button
                onClick={handleAdd}
                disabled={saving || !form.key.trim() || !form.value.trim()}
                className="flex-1 py-5 rounded-2xl bg-[var(--text-primary)] text-[rgb(var(--background))] hover:bg-[var(--text-primary)]/90 disabled:opacity-40 disabled:cursor-not-allowed text-[15px] font-bold uppercase tracking-widest transition-all shadow-xl shadow-[var(--text-primary)]/20 active:scale-95"
              >
                {saving ? "Enregistrement..." : "Confirmer"}
              </button>
            </div>
          </div>
        )}

        {/* TAB : Import */}
        {activeTab === "import" && (
          <div className="bg-zinc-950/40 backdrop-blur-3xl rounded-[32px] border border-white/5 p-8 space-y-8 animate-msg-pop shadow-2xl">
            <div className="space-y-2">
              <h3 className="text-lg font-light text-white tracking-widest uppercase">Importation Directe</h3>
              <p className="text-[12px] text-zinc-500 font-light leading-relaxed tracking-wide">
                Importez des structures de données brutes pour initialiser la mémoire contextuelle.
              </p>
            </div>

            {!importFile ? (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-16 rounded-[32px] border-2 border-dashed border-zinc-800 hover:border-[var(--border-subtle)] text-zinc-600 hover:text-[var(--text-primary)] transition-all flex flex-col items-center gap-4 group bg-zinc-950/20"
              >
                <Upload size={24} className="group-hover:scale-110 transition-transform duration-500" />
                <span className="text-[13px] font-light uppercase tracking-widest">Choisir un fichier</span>
                <span className="text-[10px] text-zinc-700 tracking-wide uppercase">Txt, Md, Csv, Json</span>
              </button>
            ) : (
              <div className="space-y-6">
                <div className="flex items-center gap-4 p-5 rounded-2xl bg-zinc-900/40 border border-white/5">
                  <div className="w-10 h-10 rounded-xl bg-[var(--bg-hover)] border border-[var(--border-glass)] flex items-center justify-center shrink-0">
                    <FileText size={16} className="text-[var(--text-primary)]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white font-light truncate">{importFile.name}</p>
                    <p className="text-[10px] text-zinc-600 mt-1 uppercase tracking-tighter">{(importFile.content.length / 1024).toFixed(1)} Ko</p>
                  </div>
                  <button onClick={() => setImportFile(null)} className="p-2 rounded-xl text-zinc-600 hover:text-white transition-colors">
                    <X size={14} />
                  </button>
                </div>

                <div className="space-y-2">
                  <label className="block text-[10px] font-light tracking-widest uppercase text-zinc-500 pl-1">Description contextuelle</label>
                  <textarea
                    value={importSummary}
                    onChange={(e) => setImportSummary(e.target.value)}
                    placeholder="Synthèse du contenu..."
                    rows={3}
                    className="w-full bg-zinc-900/40 border border-white/5 focus:border-orange-500/30 rounded-2xl px-5 py-4 text-sm text-white placeholder-zinc-700 outline-none transition-all resize-none font-light"
                  />
                </div>

                <div className="flex gap-4 pt-4">
                  <button
                    onClick={() => { setImportFile(null); setImportSummary(""); }}
                    className="flex-1 py-4 rounded-2xl bg-zinc-900 text-zinc-400 hover:text-white border border-white/5 transition-all text-xs font-light uppercase tracking-widest"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={handleSaveImport}
                    disabled={saving || !importSummary.trim()}
                    className="flex-1 py-4 rounded-2xl bg-white text-black hover:bg-zinc-200 disabled:opacity-40 text-xs font-light uppercase tracking-widest transition-all shadow-xl shadow-white/5"
                  >
                    {saving ? "Mémorisation..." : "Mémoriser"}
                  </button>
                </div>
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.md,.csv,.json,.js,.ts,.tsx,.py,.html,.css,.xml,.yaml,.yml"
              onChange={handleFileImport}
              className="hidden"
            />
          </div>
        )}

      </div>
    </div>
  );
}
