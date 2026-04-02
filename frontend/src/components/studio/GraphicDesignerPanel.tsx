"use client";

import React, { useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Download,
  Eraser,
  FileImage,
  Image as ImageIcon,
  LayoutTemplate,
  Loader2,
  Megaphone,
  Palette,
  RefreshCcw,
  ShoppingBag,
  Sparkles,
  Upload,
  Wand2,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { FileAttachment, generateContentStudioVisual, sendMessage } from "@/lib/api";

type Workflow = "poster" | "campaign" | "packshot" | "remove-bg" | "replace-bg";
type OutputFormat = "1080x1350" | "1080x1920" | "1080x1080" | "1920x1080";
type VisualStyle = "premium" | "clean" | "bold" | "cinematic";

interface GraphicDesignerPanelProps {
  token?: string | null;
}

interface ResultAsset {
  url: string;
  name: string;
  type: string;
  note?: string;
}

const WORKFLOWS: Array<{
  id: Workflow;
  label: string;
  subtitle: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  requiresImage?: boolean;
}> = [
  { id: "poster", label: "Affiche", subtitle: "Affiche propre et prête à publier", icon: LayoutTemplate },
  { id: "campaign", label: "Pub réseau social", subtitle: "Post pub, story, cover ou bannière", icon: Megaphone },
  { id: "packshot", label: "Produit", subtitle: "Visuel produit propre et vendeur", icon: ShoppingBag },
  { id: "remove-bg", label: "Supprimer fond", subtitle: "Enlever le fond d'une image", icon: Eraser, requiresImage: true },
  { id: "replace-bg", label: "Changer fond", subtitle: "Mettre un nouveau décor", icon: Palette, requiresImage: true },
];

const FORMAT_PRESETS: Array<{ id: OutputFormat; label: string; subtitle: string }> = [
  { id: "1080x1350", label: "Affiche", subtitle: "Portrait" },
  { id: "1080x1920", label: "Story", subtitle: "Plein écran mobile" },
  { id: "1080x1080", label: "Carré", subtitle: "Post simple" },
  { id: "1920x1080", label: "Bannière", subtitle: "Paysage" },
];

const STYLE_PRESETS: Array<{ id: VisualStyle; label: string; hint: string }> = [
  { id: "premium", label: "Premium", hint: "Net, haut de gamme, crédible" },
  { id: "clean", label: "Simple", hint: "Clair, propre, lisible" },
  { id: "bold", label: "Impact", hint: "Plus visible, plus fort" },
  { id: "cinematic", label: "Cinéma", hint: "Lumière et ambiance fortes" },
];

const QUICK_BRIEFS = [
  "Affiche premium pour annoncer une masterclass marketing à Antananarivo",
  "Affiche événement pour le lancement de FLARE AI à Madagascar",
  "Visuel promo fort pour une offre limitée avec titre très lisible",
  "Post pub élégant pour un service premium avec ambiance haut de gamme",
];

function fileToAttachment(file: File): Promise<FileAttachment> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || "");
      const base64 = dataUrl.split(",")[1];
      if (!base64) {
        reject(new Error("Impossible de lire le fichier."));
        return;
      }
      resolve({
        content: base64,
        type: file.type,
        name: file.name,
        dataUrl,
      });
    };
    reader.onerror = () => reject(new Error("Lecture du fichier impossible."));
    reader.readAsDataURL(file);
  });
}

function buildStudioBrief(params: {
  workflow: Workflow;
  brief: string;
  brandContext: string;
  headline: string;
  subheadline: string;
  style: VisualStyle;
  format: OutputFormat;
}) {
  const { workflow, brief, brandContext, headline, subheadline, style, format } = params;
  const styleLine =
    style === "premium"
      ? "Style premium, moderne, crédible, propre."
      : style === "clean"
        ? "Style simple, net, très lisible."
        : style === "bold"
          ? "Style fort, visible, publicitaire, contrasté."
          : "Style cinématographique, lumière travaillée, ambiance forte.";

  const titleLine = headline.trim() ? `Titre principal à intégrer: ${headline.trim()}.` : "";
  const subtitleLine = subheadline.trim() ? `Sous-titre à intégrer: ${subheadline.trim()}.` : "";
  const brandLine = brandContext.trim() ? `Contexte marque: ${brandContext.trim()}.` : "";
  const formatLine = `Format demandé: ${format}.`;
  const layoutLine =
    workflow === "poster"
      ? "Le rendu doit ressembler à une vraie affiche bien composée, avec une hiérarchie visuelle claire et du texte facile à lire."
      : workflow === "campaign"
        ? "Le rendu doit être prêt pour une publicité ou un post social très lisible."
        : "Le rendu doit être propre, vendeur et directement exploitable.";

  return [
    workflow === "poster"
      ? `Crée une affiche professionnelle à partir de ce brief: ${brief.trim()}.`
      : workflow === "campaign"
        ? `Crée un visuel publicitaire prêt à publier à partir de ce brief: ${brief.trim()}.`
        : `Crée un visuel produit premium à partir de ce brief: ${brief.trim()}.`,
    formatLine,
    styleLine,
    brandLine,
    titleLine,
    subtitleLine,
    layoutLine,
    workflow === "packshot" ? "Le produit doit être très net, bien cadré, haut de gamme et sans surcharge." : "",
    workflow === "campaign" ? "Le message principal doit être visible en quelques secondes." : "",
    workflow === "poster" ? "La composition doit être proche d'un bon design d'affiche type studio créatif." : "",
  ]
    .filter(Boolean)
    .join(" ");
}

function buildEditPrompt(workflow: Workflow, backgroundPrompt: string) {
  if (workflow === "remove-bg") {
    return "Supprime totalement le fond de cette image et retourne un résultat propre, net et utilisable immédiatement.";
  }
  return `Remplace le fond de cette image par: ${backgroundPrompt.trim()}. Garde le sujet principal intact, réaliste et professionnel.`;
}

export default function GraphicDesignerPanel({ token }: GraphicDesignerPanelProps) {
  const [workflow, setWorkflow] = useState<Workflow>("poster");
  const [format, setFormat] = useState<OutputFormat>("1080x1350");
  const [style, setStyle] = useState<VisualStyle>("premium");
  const [brief, setBrief] = useState("");
  const [brandContext, setBrandContext] = useState("");
  const [headline, setHeadline] = useState("");
  const [subheadline, setSubheadline] = useState("");
  const [backgroundPrompt, setBackgroundPrompt] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ResultAsset | null>(null);
  const [lastPrompt, setLastPrompt] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeConfig = useMemo(() => WORKFLOWS.find((item) => item.id === workflow) || WORKFLOWS[0], [workflow]);
  const selectedFormat = useMemo(() => FORMAT_PRESETS.find((item) => item.id === format) || FORMAT_PRESETS[0], [format]);
  const selectedStyle = useMemo(() => STYLE_PRESETS.find((item) => item.id === style) || STYLE_PRESETS[0], [style]);

  const handleUpload = (incoming?: File | null) => {
    if (!incoming) return;
    if (!incoming.type.startsWith("image/")) {
      setError("Importez une image JPG, PNG ou WebP.");
      return;
    }
    setFile(incoming);
    setFilePreview(URL.createObjectURL(incoming));
    setError(null);
  };

  const resetAll = () => {
    setWorkflow("poster");
    setFormat("1080x1350");
    setStyle("premium");
    setBrief("");
    setBrandContext("");
    setHeadline("");
    setSubheadline("");
    setBackgroundPrompt("");
    setFile(null);
    setFilePreview(null);
    setLoading(false);
    setError(null);
    setResult(null);
    setLastPrompt("");
  };

  const runAgent = async () => {
    if (!token) {
      setError("Connectez-vous pour utiliser l'agent visuel.");
      return;
    }

    if (activeConfig.requiresImage && !file) {
      setError("Ajoutez d'abord une image.");
      return;
    }

    if ((workflow === "poster" || workflow === "campaign" || workflow === "packshot") && !brief.trim()) {
      setError("Écrivez d'abord ce que vous voulez créer.");
      return;
    }

    if (workflow === "replace-bg" && !backgroundPrompt.trim()) {
      setError("Décrivez le nouveau fond souhaité.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (workflow === "poster" || workflow === "campaign" || workflow === "packshot") {
        const finalBrief = buildStudioBrief({
          workflow,
          brief,
          brandContext,
          headline,
          subheadline,
          style,
          format,
        });

        const response = await generateContentStudioVisual({
          project_id: `studio-${Date.now()}`,
          format,
          brief: finalBrief,
        });

        if (!response.image_url) {
          throw new Error("Aucun visuel n'a été retourné.");
        }

        setLastPrompt(finalBrief);
        setResult({
          url: response.image_url,
          name: workflow === "poster" ? "affiche-flare.png" : workflow === "campaign" ? "visuel-campagne.png" : "packshot-flare.png",
          type: "image/png",
          note: `${selectedFormat.label} • ${selectedStyle.label}`,
        });
      } else {
        const attachment = file ? await fileToAttachment(file) : undefined;
        const prompt = buildEditPrompt(workflow, backgroundPrompt);
        const response = await sendMessage(prompt, undefined, attachment, undefined, token, false, "HD", "raisonnement");
        const media = response.images?.[0];
        if (!media) {
          throw new Error("Aucun visuel n'a été retourné.");
        }

        const url = media.url || `data:${media.type || "image/png"};base64,${media.data}`;
        setLastPrompt(prompt);
        setResult({
          url,
          name: workflow === "remove-bg" ? "visuel-detoure.png" : "visuel-fond-remplace.png",
          type: media.type || "image/png",
          note: workflow === "remove-bg" ? "Fond supprimé" : "Fond remplacé",
        });
      }
    } catch (err: any) {
      setError(err?.message || "La génération a échoué.");
    } finally {
      setLoading(false);
    }
  };

  const downloadResult = () => {
    if (!result) return;
    const link = document.createElement("a");
    link.href = result.url;
    link.download = result.name;
    link.click();
  };

  return (
    <div className="h-full w-full overflow-hidden bg-[#0a0a0c] text-zinc-200">
      <div className="grid h-full grid-cols-1 xl:grid-cols-[380px_minmax(0,1fr)]">
        <aside className="overflow-y-auto border-r border-white/8 bg-[#101116]">
          <div className="border-b border-white/8 px-6 pb-5 pt-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-orange-500/20 bg-orange-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.24em] text-orange-300">
              <Wand2 size={12} />
              Studio affiche
            </div>
            <h2 className="mt-4 text-2xl font-semibold leading-tight text-white">
              Crée une affiche
              <br />
              simplement
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-zinc-400">
              Choisissez un type de visuel, écrivez votre idée, puis laissez FLARE préparer le rendu.
            </p>
          </div>

          <div className="space-y-6 p-6">
            <section>
              <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.22em] text-zinc-500">Type</p>
              <div className="space-y-2">
                {WORKFLOWS.map((item) => {
                  const Icon = item.icon;
                  const active = item.id === workflow;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setWorkflow(item.id)}
                      className={`w-full rounded-2xl border px-4 py-3 text-left transition-all ${
                        active
                          ? "border-orange-500/30 bg-gradient-to-br from-orange-500/12 to-transparent"
                          : "border-white/8 bg-white/[0.02] hover:border-white/14 hover:bg-white/[0.04]"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`mt-0.5 flex h-10 w-10 items-center justify-center rounded-xl ${active ? "bg-orange-500/18 text-orange-300" : "bg-white/5 text-zinc-400"}`}>
                          <Icon size={18} />
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-white">{item.label}</div>
                          <div className="mt-1 text-xs leading-relaxed text-zinc-500">{item.subtitle}</div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="rounded-3xl border border-white/8 bg-white/[0.03] p-4">
              <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.22em] text-zinc-500">Bon à savoir</p>
              <div className="space-y-3 text-sm text-zinc-300">
                {[
                  "Affiche et pub passent par le vrai moteur visuel du studio.",
                  "Supprimer fond et changer fond marchent avec une image source.",
                  "Plus votre brief est clair, meilleur sera le rendu.",
                ].map((item) => (
                  <div key={item} className="flex items-start gap-3">
                    <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-400" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </aside>

        <main className="grid min-w-0 h-full grid-rows-[auto_1fr]">
          <div className="border-b border-white/8 bg-[#0f1115] px-6 py-5">
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_340px]">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.22em] text-zinc-500">Votre idée</label>
                  <textarea
                    value={brief}
                    onChange={(e) => setBrief(e.target.value)}
                    placeholder="Ex: affiche premium pour annoncer une conférence IA à Antananarivo, très lisible, moderne, haut de gamme."
                    className="min-h-[116px] w-full resize-none rounded-2xl border border-white/8 bg-[#171920] px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-orange-500/30"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.22em] text-zinc-500">Marque</label>
                  <input
                    value={brandContext}
                    onChange={(e) => setBrandContext(e.target.value)}
                    placeholder="Nom, ton, secteur"
                    className="w-full rounded-2xl border border-white/8 bg-[#171920] px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-orange-500/30"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.22em] text-zinc-500">Titre</label>
                  <input
                    value={headline}
                    onChange={(e) => setHeadline(e.target.value)}
                    placeholder="Ex: MASTERCLASS IA 2026"
                    className="w-full rounded-2xl border border-white/8 bg-[#171920] px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-orange-500/30"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.22em] text-zinc-500">Sous-titre</label>
                  <input
                    value={subheadline}
                    onChange={(e) => setSubheadline(e.target.value)}
                    placeholder="Ex: Apprendre à créer du contenu viral avec l'IA"
                    className="w-full rounded-2xl border border-white/8 bg-[#171920] px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-orange-500/30"
                  />
                </div>
              </div>

              <div className="grid gap-4">
                {(workflow === "poster" || workflow === "campaign" || workflow === "packshot") && (
                  <>
                    <div className="rounded-3xl border border-white/8 bg-[#14161c] p-4">
                      <label className="mb-3 block text-[11px] font-bold uppercase tracking-[0.22em] text-zinc-500">Format</label>
                      <div className="grid grid-cols-2 gap-2">
                        {FORMAT_PRESETS.map((preset) => (
                          <button
                            key={preset.id}
                            onClick={() => setFormat(preset.id)}
                            className={`rounded-2xl border px-3 py-3 text-left transition-colors ${
                              format === preset.id
                                ? "border-orange-500/30 bg-orange-500/10"
                                : "border-white/8 bg-white/[0.03] hover:border-white/14"
                            }`}
                          >
                            <div className="text-sm font-semibold text-white">{preset.label}</div>
                            <div className="mt-1 text-xs text-zinc-500">{preset.subtitle}</div>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-3xl border border-white/8 bg-[#14161c] p-4">
                      <label className="mb-3 block text-[11px] font-bold uppercase tracking-[0.22em] text-zinc-500">Style</label>
                      <div className="grid grid-cols-2 gap-2">
                        {STYLE_PRESETS.map((preset) => (
                          <button
                            key={preset.id}
                            onClick={() => setStyle(preset.id)}
                            className={`rounded-2xl border px-3 py-3 text-left transition-colors ${
                              style === preset.id
                                ? "border-orange-500/30 bg-orange-500/10"
                                : "border-white/8 bg-white/[0.03] hover:border-white/14"
                            }`}
                          >
                            <div className="text-sm font-semibold text-white">{preset.label}</div>
                            <div className="mt-1 text-xs text-zinc-500">{preset.hint}</div>
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {activeConfig.requiresImage && (
                  <div className="rounded-3xl border border-white/8 bg-[#14161c] p-4">
                    <label className="mb-3 block text-[11px] font-bold uppercase tracking-[0.22em] text-zinc-500">Image source</label>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-5 text-left transition-colors hover:border-orange-500/20 hover:bg-orange-500/[0.04]"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/5 text-zinc-400">
                          <Upload size={18} />
                        </div>
                        <div>
                          <div className="text-sm font-medium text-white">Importer une image</div>
                          <div className="mt-1 text-xs text-zinc-500">JPG, PNG ou WebP</div>
                        </div>
                      </div>
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="hidden"
                      onChange={(e) => handleUpload(e.target.files?.[0] || null)}
                    />

                    {filePreview && (
                      <div className="mt-4 overflow-hidden rounded-2xl border border-white/8">
                        <img src={filePreview} alt="Aperçu source" className="h-40 w-full object-cover" />
                      </div>
                    )}
                  </div>
                )}

                {workflow === "replace-bg" && (
                  <div className="rounded-3xl border border-white/8 bg-[#14161c] p-4">
                    <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.22em] text-zinc-500">Nouveau fond</label>
                    <textarea
                      value={backgroundPrompt}
                      onChange={(e) => setBackgroundPrompt(e.target.value)}
                      placeholder="Ex: restaurant japonais chaleureux, lumière cinéma, bois sombre"
                      className="min-h-[98px] w-full resize-none rounded-2xl border border-white/8 bg-[#171920] px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-orange-500/30"
                    />
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={runAgent}
                    disabled={loading}
                    className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-[#f97316] px-5 py-4 text-sm font-semibold text-white transition-colors hover:bg-[#fb923c] disabled:opacity-50"
                  >
                    {loading ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
                    {loading ? "Création..." : "Créer"}
                  </button>
                  <button
                    onClick={resetAll}
                    className="rounded-2xl border border-white/8 px-4 py-4 text-zinc-400 transition-colors hover:border-white/16 hover:text-white"
                  >
                    <RefreshCcw size={18} />
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="min-h-0 overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(249,115,22,0.08),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.08),transparent_24%),#0b0c10]">
            <div className="grid h-full grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px]">
              <div className="min-w-0 h-full overflow-auto p-6">
                {loading ? (
                  <div className="flex h-full flex-col items-center justify-center rounded-[32px] border border-white/8 bg-black/30 text-center">
                    <div className="h-20 w-20 animate-spin rounded-full border-4 border-orange-500/15 border-t-orange-400" />
                    <p className="mt-6 text-lg font-semibold text-white">FLARE prépare votre visuel</p>
                    <p className="mt-2 text-sm text-zinc-500">Composition, style et rendu en cours.</p>
                  </div>
                ) : result ? (
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="h-full rounded-[32px] border border-white/8 bg-black/30 p-4"
                  >
                    <div className="flex h-full flex-col gap-4">
                      <div className="flex items-center justify-between rounded-2xl border border-white/8 bg-[#121317] px-4 py-3">
                        <div>
                          <div className="text-sm font-semibold text-white">{result.name}</div>
                          <div className="mt-1 text-xs text-zinc-500">{result.note || "Visuel prêt"}</div>
                        </div>
                        <button
                          onClick={downloadResult}
                          className="flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black transition-opacity hover:opacity-90"
                        >
                          <Download size={16} />
                          Télécharger
                        </button>
                      </div>
                      <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-[28px] border border-white/8 bg-[#121317]">
                        <img src={result.url} alt={result.name} className="max-h-full max-w-full object-contain" />
                      </div>
                    </div>
                  </motion.div>
                ) : (
                  <div className="flex h-full flex-col items-center justify-center rounded-[32px] border border-dashed border-white/10 bg-black/20 px-8 text-center">
                    <div className="flex h-20 w-20 items-center justify-center rounded-3xl border border-white/8 bg-white/[0.04] text-zinc-500">
                      <FileImage size={34} />
                    </div>
                    <h3 className="mt-6 text-xl font-semibold text-white">Votre aperçu apparaîtra ici</h3>
                    <p className="mt-3 max-w-xl text-sm leading-relaxed text-zinc-500">
                      Commencez par choisir un type de visuel, écrivez votre idée, puis cliquez sur créer.
                    </p>
                  </div>
                )}
              </div>

              <aside className="overflow-auto border-l border-white/8 bg-[#0f1115] p-6">
                <div className="rounded-3xl border border-white/8 bg-white/[0.03] p-4">
                  <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.22em] text-zinc-500">Mode actuel</p>
                  <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-500/15 text-orange-300">
                      <activeConfig.icon size={18} />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-white">{activeConfig.label}</div>
                      <div className="mt-1 text-xs leading-relaxed text-zinc-500">{activeConfig.subtitle}</div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 rounded-3xl border border-white/8 bg-white/[0.03] p-4">
                  <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.22em] text-zinc-500">Exemples rapides</p>
                  <div className="space-y-2">
                    {QUICK_BRIEFS.map((item) => (
                      <button
                        key={item}
                        onClick={() => setBrief(item)}
                        className="w-full rounded-2xl border border-white/8 px-3 py-3 text-left text-sm text-zinc-300 transition-colors hover:border-white/14 hover:bg-white/[0.04]"
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-4 rounded-3xl border border-white/8 bg-white/[0.03] p-4">
                  <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.22em] text-zinc-500">Résumé</p>
                  <div className="space-y-3 text-sm text-zinc-300">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-zinc-500">Type</span>
                      <span>{activeConfig.label}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-zinc-500">Format</span>
                      <span>{selectedFormat.label}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-zinc-500">Style</span>
                      <span>{selectedStyle.label}</span>
                    </div>
                  </div>
                </div>

                {lastPrompt && (
                  <div className="mt-4 rounded-3xl border border-white/8 bg-white/[0.03] p-4">
                    <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.22em] text-zinc-500">Prompt utilisé</p>
                    <p className="text-sm leading-relaxed text-zinc-400">{lastPrompt}</p>
                  </div>
                )}

                <AnimatePresence>
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 8 }}
                      className="mt-4 rounded-3xl border border-red-500/20 bg-red-500/10 p-4"
                    >
                      <div className="flex items-start gap-3">
                        <AlertCircle size={18} className="mt-0.5 shrink-0 text-red-300" />
                        <p className="text-sm leading-relaxed text-red-100">{error}</p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </aside>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
