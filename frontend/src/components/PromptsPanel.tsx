"use client";

import { useState, useEffect, useCallback } from "react";
import {
  MessageSquarePlus, Copy, Check, Search, Plus, Trash2, X, Sparkles,
  ChevronDown, ChevronRight, BookOpen, Send, Star, Terminal
} from "lucide-react";

import { BASE_URL } from "@/lib/api";

interface PromptTemplate {
  id: number;
  title: string;
  content: string;
  category: string;
  is_default: boolean;
  created_at: string;
}

const PROMPT_CATEGORIES = [
  { value: "marketing", label: "Marketing", emoji: "📢" },
  { value: "redaction", label: "Rédaction", emoji: "✍️" },
  { value: "analyse", label: "Analyse", emoji: "📊" },
  { value: "strategie", label: "Stratégie", emoji: "🎯" },
  { value: "creative", label: "Créatif", emoji: "🎨" },
  { value: "productivite", label: "Productivité", emoji: "⚡" },
  { value: "general", label: "Général", emoji: "💬" },
];

const DEFAULT_PROMPTS: Omit<PromptTemplate, "id" | "created_at" | "is_default">[] = [
  {
    title: "Stratégie Réseaux Sociaux",
    content: "Propose-moi une stratégie complète pour les réseaux sociaux de mon entreprise. Inclus : objectifs SMART, choix des plateformes, calendrier éditorial sur 1 mois, types de contenu, fréquence de publication, KPIs à suivre. Mon secteur : [secteur]. Mon public cible : [cible].",
    category: "marketing",
  },
  {
    title: "Rédiger un Email de Prospection B2B",
    content: "Rédige un email de prospection B2B professionnel mais chaleureux pour contacter [entreprise] dans le secteur [secteur]. Mets en avant nos services de [services]. L'email doit faire maximum 150 mots avec un objet accrocheur et un appel à l'action clair pour un rendez-vous découverte.",
    category: "redaction",
  },
  {
    title: "Analyse Concurrentielle",
    content: "Fais une analyse concurrentielle complète de [mon entreprise] face à [concurrent 1], [concurrent 2] et [concurrent 3] sur le marché de [marché]. Pour chaque concurrent, analyse : positionnement, forces, faiblesses, stratégie marketing, pricing. Conclus avec nos opportunités de différenciation.",
    category: "analyse",
  },
  {
    title: "Brief Créatif Vidéo",
    content: "Crée un brief créatif complet pour une vidéo promotionnelle de [produit/service]. Format : [format ex: Reel 30s / YouTube 3min]. Inclus : concept créatif, script structuré (accroche, développement, CTA), direction artistique, musique suggérée, plan de diffusion.",
    category: "creative",
  },
  {
    title: "Plan d'Action Hebdomadaire",
    content: "Aide-moi à organiser ma semaine. Mes priorités cette semaine sont : [liste tes priorités]. Pour chaque priorité, propose : actions concrètes, temps estimé, jour recommandé, indicateur de réussite. Organise le tout dans un planning du lundi au vendredi.",
    category: "productivite",
  },
  {
    title: "Post Instagram Captivant",
    content: "Rédige un post Instagram percutant sur [sujet]. Ton : [professionnel/fun/inspirant]. Inclus : une accroche irrésistible, le corps du message (max 100 mots), un call-to-action engageant, et 8-10 hashtags stratégiques. Public cible : [cible].",
    category: "redaction",
  },
  {
    title: "Proposition Commerciale",
    content: "Génère une proposition commerciale structurée pour le client [nom du client] dans le secteur [secteur]. Le projet concerne [description du projet]. Inclus : résumé exécutif, compréhension du besoin, notre approche, livrables, planning, tarification, conditions.",
    category: "strategie",
  },
  {
    title: "Brainstorming Créatif",
    content: "Lance un brainstorming créatif pour [objectif]. Génère 10 idées originales et innovantes. Pour chaque idée, propose : le concept en une phrase, pourquoi ça marche, comment le mettre en œuvre, le budget estimé (faible/moyen/élevé). Classe-les par impact potentiel.",
    category: "creative",
  },
];

interface PromptsProps {
  token?: string | null;
  onUsePrompt?: (prompt: string) => void;
}

export default function PromptsPanel({ token, onUsePrompt }: PromptsProps) {
  const [prompts, setPrompts] = useState<PromptTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("");
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formTitle, setFormTitle] = useState("");
  const [formContent, setFormContent] = useState("");
  const [formCategory, setFormCategory] = useState("general");
  const [saving, setSaving] = useState(false);

  const loadPrompts = useCallback(async () => {
    setLoading(true);
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch(`${BASE_URL}/prompts`, { headers });
      if (res.ok) {
        const data = await res.json();
        setPrompts(data);
      } else {
        // If endpoint doesn't exist yet, use defaults
        setPrompts(DEFAULT_PROMPTS.map((p, i) => ({
          ...p,
          id: i + 1,
          is_default: true,
          created_at: new Date().toISOString(),
        })));
      }
    } catch {
      // Fallback to defaults
      setPrompts(DEFAULT_PROMPTS.map((p, i) => ({
        ...p,
        id: i + 1,
        is_default: true,
        created_at: new Date().toISOString(),
      })));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { loadPrompts(); }, [loadPrompts]);

  const handleCopy = (prompt: PromptTemplate) => {
    navigator.clipboard.writeText(prompt.content);
    setCopiedId(prompt.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSave = async () => {
    if (!formTitle.trim() || !formContent.trim()) return;
    setSaving(true);
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch(`${BASE_URL}/prompts`, {
        method: "POST",
        headers,
        body: JSON.stringify({ title: formTitle, content: formContent, category: formCategory }),
      });
      if (res.ok) {
        setShowForm(false);
        setFormTitle("");
        setFormContent("");
        setFormCategory("general");
        await loadPrompts();
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Supprimer ce prompt ?")) return;
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      await fetch(`${BASE_URL}/prompts/${id}`, { method: "DELETE", headers });
      await loadPrompts();
    } catch {
      // silent
    }
  };

  const filtered = prompts.filter((p) => {
    const matchSearch = !search || p.title.toLowerCase().includes(search.toLowerCase()) || p.content.toLowerCase().includes(search.toLowerCase());
    const matchCat = !filterCat || p.category === filterCat;
    return matchSearch && matchCat;
  });

  const grouped = PROMPT_CATEGORIES.reduce<Record<string, PromptTemplate[]>>((acc, cat) => {
    const catPrompts = filtered.filter((p) => p.category === cat.value);
    if (catPrompts.length > 0) acc[cat.value] = catPrompts;
    return acc;
  }, {});

  return (
    <div className="flex-1 overflow-y-auto dot-grid">
      <div className="max-w-3xl mx-auto px-6 py-6 space-y-5">
        
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-[var(--bg-hover)] border border-[var(--border-glass)] flex items-center justify-center">
              <Terminal size={16} className="text-[var(--text-primary)]" />
            </div>
            <div>
              <h2 className="text-3xl font-semibold text-[var(--text-primary)] tracking-tight">Prompts</h2>
              <p className="text-[14px] text-[var(--text-muted)] font-normal">{prompts.length} prompt{prompts.length !== 1 ? "s" : ""} prêt{prompts.length !== 1 ? "s" : ""} à l&apos;emploi</p>
            </div>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[var(--bg-hover)] border border-[var(--border-glass)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all shadow-sm active-press"
          >
            <Plus size={14} />
            Nouveau Prompt
          </button>
        </div>

        {/* Search + Filter */}
        <div className="flex items-center gap-2 animate-fade-in-up" style={{ animationDelay: '100ms' }}>
          <div className="flex-1 relative group">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] group-focus-within:text-[var(--text-primary)] transition-colors" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un prompt..."
              className="w-full bg-[var(--bg-card)] border border-[var(--border-glass)] rounded-xl text-sm text-[var(--text-primary)] pl-9 pr-4 py-2.5 outline-none focus:border-[var(--border-subtle)] placeholder-[var(--text-muted)]/60 transition-all"
            />
          </div>
          <select
            value={filterCat}
            onChange={(e) => setFilterCat(e.target.value)}
            className="bg-[var(--bg-card)] border border-[var(--border-glass)] rounded-xl text-sm text-[var(--text-muted)] px-3 py-2.5 outline-none focus:border-[var(--border-subtle)] transition-colors"
          >
            <option value="" className="bg-[var(--bg-sidebar)]">Toutes</option>
            {PROMPT_CATEGORIES.map((c) => <option key={c.value} value={c.value} className="bg-[var(--bg-sidebar)]">{c.emoji} {c.label}</option>)}
          </select>
        </div>

        {/* Create Form */}
        {showForm && (
          <div className="bg-[var(--bg-card)] backdrop-blur-3xl rounded-2xl p-6 border border-[var(--border-glass)] shadow-2xl animate-scale-in">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-sm font-medium text-[var(--text-primary)] flex items-center gap-2 uppercase tracking-wide">
                <Sparkles size={14} className="text-[var(--text-primary)]" />
                Nouveau prompt
              </h3>
              <button onClick={() => setShowForm(false)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-[11px] uppercase tracking-wider text-[var(--text-muted)] mb-2 block font-medium">Titre</label>
                <input value={formTitle} onChange={(e) => setFormTitle(e.target.value)} placeholder="ex: Email de relance client" className="w-full bg-[var(--bg-input)] border border-[var(--border-glass)] rounded-xl text-sm text-[var(--text-primary)] px-4 py-3 outline-none focus:border-[var(--border-subtle)] placeholder-[var(--text-muted)]/50" />
              </div>
              <div>
                <label className="text-[11px] uppercase tracking-wider text-[var(--text-muted)] mb-2 block font-medium">Contenu du prompt <span className="text-[var(--text-muted)]">(utilisez [variable])</span></label>
                <textarea value={formContent} onChange={(e) => setFormContent(e.target.value)} placeholder="Rédige un email pour [client]..." rows={5} className="w-full bg-[var(--bg-input)] border border-[var(--border-glass)] rounded-xl text-sm text-[var(--text-primary)] px-4 py-3 outline-none focus:border-[var(--border-subtle)] placeholder-[var(--text-muted)]/50 resize-none font-sans font-light" />
              </div>
              <div>
                <label className="text-[11px] uppercase tracking-wider text-[var(--text-muted)] mb-2 block font-medium">Catégorie</label>
                <select value={formCategory} onChange={(e) => setFormCategory(e.target.value)} className="w-full bg-[var(--bg-input)] border border-[var(--border-glass)] rounded-xl text-sm text-[var(--text-primary)] px-4 py-3 outline-none focus:border-[var(--border-subtle)]">
                  {PROMPT_CATEGORIES.map((c) => <option key={c.value} value={c.value} className="bg-[var(--bg-sidebar)] text-[var(--text-primary)]">{c.emoji} {c.label}</option>)}
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={handleSave} disabled={saving || !formTitle.trim() || !formContent.trim()} className="flex-1 flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-[var(--text-primary)] text-[rgb(var(--background))] hover:opacity-90 disabled:opacity-50 transition-all text-[14px] font-medium uppercase tracking-wide shadow-lg">
                  <Check size={16} />
                  {saving ? "Enregistrement..." : "Enregistrer"}
                </button>
                <button onClick={() => setShowForm(false)} className="px-6 py-3.5 rounded-xl border border-[var(--border-glass)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] text-sm font-medium uppercase tracking-wide transition-all">
                  Annuler
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="text-center py-8 text-zinc-500 text-sm">
            <BookOpen size={20} className="animate-pulse mx-auto mb-2" />
            Chargement des prompts...
          </div>
        )}

        {/* Empty */}
        {!loading && prompts.length === 0 && (
          <div className="text-center py-12">
            <div className="w-16 h-16 rounded-2xl bg-zinc-800/50 border border-white/5 flex items-center justify-center mx-auto mb-4">
              <MessageSquarePlus size={28} className="text-zinc-500" />
            </div>
            <p className="text-white font-medium mb-1">Aucun prompt</p>
            <p className="text-sm text-zinc-500">Les prompts prédéfinis vous aident à communiquer efficacement avec l&apos;IA.</p>
          </div>
        )}

        {/* Grouped list */}
        {Object.entries(grouped).map(([cat, catPrompts]) => {
          const catMeta = PROMPT_CATEGORIES.find((c) => c.value === cat)!;
          return (
            <div key={cat}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm">{catMeta.emoji}</span>
                <p className="text-[10px] uppercase tracking-widest text-zinc-500">{catMeta.label}</p>
                <span className="text-[10px] text-zinc-600">({catPrompts.length})</span>
              </div>
              <div className="space-y-2">
                {catPrompts.map((prompt, i) => (
                  <div key={prompt.id} className="bg-[var(--bg-card)] backdrop-blur-sm border border-[var(--border-glass)] rounded-2xl overflow-hidden hover:border-[var(--border-subtle)] transition-all animate-slide-up"
                       style={{ animationDelay: `${i * 50}ms` }}>
                    <div
                      className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-[var(--bg-hover)] transition-all group"
                      onClick={() => setExpandedId(expandedId === prompt.id ? null : prompt.id)}
                    >
                      <div className="w-10 h-10 rounded-xl bg-[var(--bg-hover)] border border-[var(--border-glass)] flex items-center justify-center text-sm group-hover:scale-105 transition-transform">
                        {catMeta.emoji}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[15px] font-medium text-[var(--text-primary)] truncate group-hover:text-[var(--text-primary)] transition-colors">{prompt.title}</p>
                        <p className="text-[12px] text-[var(--text-muted)] truncate font-light mt-0.5">{prompt.content.slice(0, 100)}...</p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        {prompt.is_default && (
                          <span className="text-[9px] font-bold tracking-widest uppercase bg-[var(--bg-hover)] text-[var(--text-muted)] border border-[var(--border-glass)] px-2.5 py-1 rounded-full">Défaut</span>
                        )}
                        <div className={`p-1.5 rounded-lg bg-[var(--bg-hover)] transition-transform ${expandedId === prompt.id ? 'rotate-180' : ''}`}>
                          <ChevronDown size={14} className="text-[var(--text-muted)]" />
                        </div>
                      </div>
                    </div>

                    {expandedId === prompt.id && (
                      <div className="px-5 pb-5 border-t border-[var(--border-glass)] bg-[var(--bg-input)]/30 animate-fade-in">
                        <div className="mt-4 bg-[var(--bg-input)] rounded-2xl px-5 py-4 text-[14px] text-[var(--text-primary)] leading-relaxed border border-[var(--border-glass)] shadow-inner whitespace-pre-wrap font-sans font-light">
                          {prompt.content}
                        </div>
                        <div className="flex items-center gap-3 mt-4">
                          <button
                            onClick={() => handleCopy(prompt)}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-[var(--border-glass)] text-[12px] font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-all"
                          >
                            {copiedId === prompt.id ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                            {copiedId === prompt.id ? "Copié !" : "Copier"}
                          </button>
                          {onUsePrompt && (
                            <button
                              onClick={() => onUsePrompt(prompt.content)}
                              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--text-primary)] text-[rgb(var(--background))] hover:opacity-90 disabled:opacity-50 transition-all text-[13px] font-medium uppercase tracking-wide shadow-lg"
                            >
                              <Send size={14} />
                              Utiliser
                            </button>
                          )}
                          {!prompt.is_default && (
                            <button
                              onClick={() => handleDelete(prompt.id)}
                              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-red-500/10 text-[12px] font-medium text-red-500/70 hover:text-red-400 hover:bg-red-500/5 transition-all ml-auto"
                            >
                              <Trash2 size={14} />
                              Supprimer
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}

      </div>
    </div>
  );
}
