"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Zap, Plus, Pencil, Trash2, Play, ChevronDown, ChevronRight,
  Search, Tag, RefreshCw, X, Check, Copy, BookOpen,
} from "lucide-react";
import {
  listSkills, createSkill, deleteSkill, updateSkill,
  Skill, SkillIn,
} from "@/lib/api";

const CATEGORIES = [
  { value: "general", label: "Général", color: "text-[var(--text-muted)] bg-[var(--bg-hover)] border-[var(--border-glass)]" },
  { value: "marketing", label: "Marketing", color: "text-[var(--text-muted)] bg-[var(--bg-hover)] border-[var(--border-glass)]" },
  { value: "google", label: "Google", color: "text-[var(--text-muted)] bg-[var(--bg-hover)] border-[var(--border-glass)]" },
  { value: "analyse", label: "Analyse", color: "text-[var(--text-muted)] bg-[var(--bg-hover)] border-[var(--border-glass)]" },
  { value: "automatisation", label: "Automatisation", color: "text-[var(--text-muted)] bg-[var(--bg-hover)] border-[var(--border-glass)]" },
];

const STARTER_SKILLS: SkillIn[] = [
  {
    name: "rediger_post_instagram",
    title: "Rédiger un post Instagram",
    description: "Génère un post Instagram engageant avec hashtags",
    prompt_template: "Rédige un post Instagram percutant pour {{sujet}} dans le style {{ton}} (ex: professionnel, fun, inspirant). Inclus 5-8 hashtags pertinents. Public cible : {{cible}}.",
    category: "marketing",
  },
  {
    name: "rapport_campagne",
    title: "Rapport de campagne",
    description: "Génère un rapport professionnel pour une campagne",
    prompt_template: "Génère un rapport professionnel pour la campagne '{{nom_campagne}}'. Résultats : {{resultats}}. Période : {{periode}}. Inclus : résumé exécutif, KPIs, points positifs, axes d'amélioration, recommandations.",
    category: "analyse",
  },
  {
    name: "email_prospection",
    title: "Email de prospection",
    description: "Rédige un email de prospection B2B personnalisé",
    prompt_template: "Rédige un email de prospection B2B pour {{entreprise}} dans le secteur {{secteur}} à {{ville}}. Ton : professionnel mais chaleureux. Mets en avant nos services de communication digitale de FLARE AI. Appel à l'action : rendez-vous découverte. 150 mots max.",
    category: "marketing",
  },
  {
    name: "analyse_concurrents",
    title: "Analyse concurrentielle",
    description: "Analyse comparative de concurrents",
    prompt_template: "Réalise une analyse concurrentielle de {{entreprise}} face à ses concurrents {{concurrents}} sur le marché de {{marche}}. Inclus : positionnement, forces/faiblesses, opportunités, recommandations stratégiques.",
    category: "analyse",
  },
  {
    name: "brief_creatif",
    title: "Brief créatif",
    description: "Génère un brief créatif complet",
    prompt_template: "Génère un brief créatif complet pour {{projet}} pour le client {{client}}. Format : objectifs, cible, ton/univers graphique, messages clés, livrables attendus, contraintes, KPIs. Budget : {{budget}}.",
    category: "general",
  },
];

function CategoryBadge({ category }: { category: string }) {
  const cat = CATEGORIES.find((c) => c.value === category) ?? CATEGORIES[0];
  return (
    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${cat.color}`}>
      {cat.label}
    </span>
  );
}

interface SkillFormState {
  name: string;
  title: string;
  description: string;
  prompt_template: string;
  category: string;
}

const EMPTY_FORM: SkillFormState = {
  name: "", title: "", description: "", prompt_template: "", category: "general",
};

export default function SkillsPanel({ token }: { token?: string | null }) {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingSkill, setEditingSkill] = useState<Skill | null>(null);
  const [form, setForm] = useState<SkillFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [installingStarters, setInstallingStarters] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await listSkills(undefined, token);
      setSkills(data);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditingSkill(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

  const openEdit = (skill: Skill) => {
    setEditingSkill(skill);
    setForm({
      name: skill.name,
      title: skill.title,
      description: skill.description,
      prompt_template: skill.prompt_template,
      category: skill.category,
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.title.trim() || !form.prompt_template.trim() || !token) return;
    setSaving(true);
    try {
      if (editingSkill) {
        await updateSkill(editingSkill.name, {
          title: form.title,
          description: form.description,
          prompt_template: form.prompt_template,
          category: form.category,
        }, token);
      } else {
        await createSkill({
          name: form.name.toLowerCase().replace(/\s+/g, "_"),
          title: form.title,
          description: form.description,
          prompt_template: form.prompt_template,
          category: form.category,
        }, token);
      }
      setShowForm(false);
      await load();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (name: string) => {
    if (!confirm(`Supprimer la compétence '${name}' ?`) || !token) return;
    await deleteSkill(name, token);
    await load();
  };

  const handleCopy = (skill: Skill) => {
    navigator.clipboard.writeText(skill.prompt_template);
    setCopiedId(skill.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const installStarters = async () => {
    if (!token) return;
    setInstallingStarters(true);
    try {
      for (const s of STARTER_SKILLS) {
        const exists = skills.find((sk) => sk.name === s.name);
        if (!exists) await createSkill(s, token);
      }
      await load();
    } finally {
      setInstallingStarters(false);
    }
  };

  const filtered = skills.filter((s) => {
    const matchSearch = !search || s.title.toLowerCase().includes(search.toLowerCase()) || s.description.toLowerCase().includes(search.toLowerCase());
    const matchCat = !filterCat || s.category === filterCat;
    return matchSearch && matchCat;
  });

  const grouped = CATEGORIES.reduce<Record<string, Skill[]>>((acc, cat) => {
    const catSkills = filtered.filter((s) => s.category === cat.value);
    if (catSkills.length > 0) acc[cat.value] = catSkills;
    return acc;
  }, {});

  return (
    <div className="flex-1 overflow-y-auto dot-grid">
      <div className="max-w-3xl mx-auto px-6 py-6 space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-2">
            <h2 className="text-3xl font-bold text-white tracking-tight uppercase">Compétences</h2>
            <p className="text-[16px] text-zinc-400 font-normal">{skills.length} compétence{skills.length !== 1 ? "s" : ""} · Templates de prompts réutilisables</p>
          </div>
          <div className="flex items-center gap-2">
            {skills.length === 0 && (
              <button
                onClick={installStarters}
                disabled={installingStarters}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border-glass)] text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-all"
              >
                <BookOpen size={12} />
                {installingStarters ? "Installation..." : "Installer les starters"}
              </button>
            )}
            <button
              onClick={openCreate}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--text-primary)] text-[var(--background)] text-xs font-medium hover:opacity-90 transition-all"
            >
              <Plus size={13} />
              Nouvelle
            </button>
          </div>
        </div>

        {/* Recherche + filtre */}
        <div className="flex items-center gap-2">
          <div className="flex-1 relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher une compétence..."
              className="w-full bg-[var(--bg-input)] border border-[var(--border-glass)] rounded-xl text-sm text-[var(--text-primary)] pl-9 pr-4 py-2 outline-none focus:border-[var(--border-subtle)] placeholder-[var(--text-muted)]/50"
            />
          </div>
          <select
            value={filterCat}
            onChange={(e) => setFilterCat(e.target.value)}
            className="bg-[var(--bg-input)] border border-[var(--border-glass)] rounded-xl text-sm text-[var(--text-muted)] px-3 py-2 outline-none focus:border-[var(--border-subtle)]"
          >
            <option value="">Toutes</option>
            {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>

        {/* Formulaire création/édition */}
        {showForm && (
          <div className="card-premium rounded-2xl p-5 border border-[var(--border-glass)]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-white">
                {editingSkill ? "Modifier la compétence" : "Nouvelle compétence"}
              </h3>
              <button onClick={() => setShowForm(false)} className="text-slate-500 hover:text-white">
                <X size={14} />
              </button>
            </div>
            <div className="space-y-3">
              {!editingSkill && (
                <div>
                  <label className="text-[11px] text-slate-400 mb-1 block">Identifiant (snake_case)</label>
                  <input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="ex: rediger_post_instagram"
                    className="w-full bg-[var(--bg-input)] border border-[var(--border-glass)] rounded-xl text-sm text-[var(--text-primary)] px-3 py-2 outline-none focus:border-[var(--border-subtle)] placeholder-[var(--text-muted)]/50"
                  />
                </div>
              )}
              <div>
                <label className="text-[11px] text-slate-400 mb-1 block">Titre</label>
                  <input
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    placeholder="ex: Rédiger un post Instagram"
                    className="w-full bg-[var(--bg-input)] border border-[var(--border-glass)] rounded-xl text-sm text-[var(--text-primary)] px-3 py-2 outline-none focus:border-[var(--border-subtle)] placeholder-[var(--text-muted)]/50"
                  />
              </div>
              <div>
                <label className="text-[11px] text-slate-400 mb-1 block">Description courte</label>
                  <input
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder="Ce que fait cette compétence..."
                    className="w-full bg-[var(--bg-input)] border border-[var(--border-glass)] rounded-xl text-sm text-[var(--text-primary)] px-3 py-2 outline-none focus:border-[var(--border-subtle)] placeholder-[var(--text-muted)]/50"
                  />
              </div>
              <div>
                <label className="text-[11px] text-[var(--text-muted)] mb-1 block">
                  Template du prompt <span className="text-[var(--text-muted)]">(utilise {"{{variable}}"} pour les variables)</span>
                </label>
                <textarea
                  value={form.prompt_template}
                  onChange={(e) => setForm({ ...form, prompt_template: e.target.value })}
                  placeholder="Rédige un post pour {{sujet}} dans le style {{ton}}..."
                  rows={4}
                  className="w-full bg-[var(--bg-input)] border border-[var(--border-glass)] rounded-xl text-sm text-[var(--text-primary)] px-3 py-2 outline-none focus:border-[var(--border-subtle)] placeholder-[var(--text-muted)]/50 resize-none"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-400 mb-1 block">Catégorie</label>
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="w-full bg-[var(--bg-input)] border border-[var(--border-glass)] rounded-xl text-sm text-[var(--text-primary)] px-3 py-2 outline-none focus:border-[var(--border-subtle)]"
                >
                  {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={handleSave}
                  disabled={saving || !form.name.trim() || !form.title.trim() || !form.prompt_template.trim()}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[var(--text-primary)] text-[var(--background)] hover:opacity-90 disabled:opacity-40 text-sm font-medium transition-all"
                >
                  <Check size={13} />
                  {saving ? "Enregistrement..." : "Enregistrer"}
                </button>
                <button
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 rounded-xl border border-navy-600 text-slate-400 hover:text-white text-sm transition-colors"
                >
                  Annuler
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="text-center py-8 text-slate-500 text-sm">
            <RefreshCw size={20} className="animate-spin mx-auto mb-2" />
            Chargement...
          </div>
        )}

        {/* Empty */}
        {!loading && skills.length === 0 && (
          <div className="text-center py-12">
            <Zap size={32} className="text-slate-600 mx-auto mb-3" />
            <p className="text-white font-medium mb-1">Aucune compétence</p>
            <p className="text-sm text-slate-500 mb-4">Créez des templates de prompts réutilisables ou installez les starters.</p>
            <button
              onClick={installStarters}
              disabled={installingStarters}
              className="px-4 py-2 rounded-xl bg-[var(--text-primary)] text-[var(--background)] text-sm hover:opacity-90 transition-all font-medium"
            >
              {installingStarters ? "Installation..." : "Installer les 5 starters"}
            </button>
          </div>
        )}

        {/* Liste groupée par catégorie */}
        {Object.entries(grouped).map(([cat, catSkills]) => {
          const catMeta = CATEGORIES.find((c) => c.value === cat)!;
          return (
            <div key={cat}>
              <div className="flex items-center gap-2 mb-2">
                <Tag size={11} className="text-slate-500" />
                <p className="text-[10px] uppercase tracking-widest text-slate-500">{catMeta.label}</p>
                <span className="text-[10px] text-slate-600">({catSkills.length})</span>
              </div>
              <div className="space-y-2">
                {catSkills.map((skill) => (
                  <div key={skill.id} className="glass rounded-2xl overflow-hidden">
                    <div
                      className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-navy-700/30 transition-colors"
                      onClick={() => setExpandedId(expandedId === skill.id ? null : skill.id)}
                    >
                      <div className="w-8 h-8 rounded-lg bg-[var(--bg-hover)] border border-[var(--border-glass)] flex items-center justify-center">
                        <Zap size={13} className="text-[var(--text-primary)]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">{skill.title}</p>
                        <p className="text-[11px] text-slate-500 truncate">{skill.description || skill.name}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <CategoryBadge category={skill.category} />
                        {skill.usage_count > 0 && (
                          <span className="text-[10px] text-slate-600">{skill.usage_count}×</span>
                        )}
                        {expandedId === skill.id ? <ChevronDown size={13} className="text-slate-500" /> : <ChevronRight size={13} className="text-slate-500" />}
                      </div>
                    </div>

                    {expandedId === skill.id && (
                      <div className="px-4 pb-4 border-t border-navy-700/50">
                        <div className="mt-3 bg-navy-900/60 rounded-xl px-4 py-3 font-mono text-xs text-slate-300 leading-relaxed">
                          {skill.prompt_template}
                        </div>
                        <div className="flex items-center gap-2 mt-3">
                          <button
                            onClick={() => handleCopy(skill)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border-glass)] text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--border-subtle)] transition-all"
                          >
                            {copiedId === skill.id ? <Check size={11} className="text-green-400" /> : <Copy size={11} />}
                            {copiedId === skill.id ? "Copié !" : "Copier le prompt"}
                          </button>
                          <button
                            onClick={() => openEdit(skill)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-navy-600 text-xs text-slate-400 hover:text-white transition-all"
                          >
                            <Pencil size={11} />
                            Modifier
                          </button>
                          <button
                            onClick={() => handleDelete(skill.name)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-navy-600 text-xs text-red-500/70 hover:text-red-400 hover:border-red-500/40 transition-all ml-auto"
                          >
                            <Trash2 size={11} />
                            Supprimer
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {!loading && filtered.length === 0 && skills.length > 0 && (
          <div className="text-center py-8 text-slate-500 text-sm">
            Aucune compétence ne correspond à la recherche.
          </div>
        )}

      </div>
    </div>
  );
}
