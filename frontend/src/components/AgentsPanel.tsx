"use client";

import { useState, useEffect, useRef } from "react";
import {
  Bot, Send, Sparkles, Target, Zap,
  MapPin, Megaphone, Type, Rocket, Loader2,
  CheckCircle2, AlertCircle, RefreshCw, Eye, Trash2,
  ChevronLeft, ChevronRight, Palette, Video, Users,
  BarChart3, Mail, Mic, PenTool, Globe
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { prospectingChat, launchSourcing, reviewLeads, approveCampaign, getUserPlan, UserPlan } from "@/lib/api";
import { Lock } from "lucide-react";
import ContentStudioPage from "./studio/ContentStudioPage";

interface AgentsPanelProps {
  token?: string | null;
}

interface Brief {
  sector: string;
  city: string;
  target_type: string;
  offer: string;
  tone: string;
}

interface Message {
  role: "user" | "assistant";
  content: string;
}

type AgentView = "hub" | "prospection" | "content";

// ── Agent definitions ─────────────────────────────────────────────────────

interface AgentDef {
  id: string;
  name: string;
  subtitle: string;
  description: string;
  icon: typeof Bot;
  color: string;
  borderColor: string;
  iconColor: string;
  bgGradient: string;
  status: "active" | "dev" | "soon";
  statusLabel: string;
  features: string[];
}

const AGENTS: AgentDef[] = [
  {
    id: "prospection",
    name: "Agent Prospection",
    subtitle: "Prospection B2B automatisée",
    description: "Génère des leads qualifiés, rédige des emails personnalisés et lance des campagnes de prospection ciblées par secteur et ville.",
    icon: Target,
    color: "from-emerald-500/20 to-green-500/10",
    borderColor: "border-emerald-500/30",
    iconColor: "text-emerald-400",
    bgGradient: "bg-gradient-to-br from-emerald-500/20 to-green-500/10",
    status: "active",
    statusLabel: "Actif",
    features: ["Recherche de prospects", "Emails personnalisés", "Score IA", "Campagnes automatiques"],
  },
  {
    id: "cm",
    name: "Agent CM",
    subtitle: "Community Management",
    description: "Gère les réseaux sociaux, planifie les publications, répond aux commentaires et analyse l'engagement de votre communauté.",
    icon: Users,
    color: "from-blue-500/20 to-indigo-500/10",
    borderColor: "border-blue-500/20",
    iconColor: "text-blue-400",
    bgGradient: "bg-gradient-to-br from-blue-500/20 to-indigo-500/10",
    status: "dev",
    statusLabel: "En développement",
    features: ["Planification", "Réponses auto", "Analytics", "Multi-plateforme"],
  },
  {
    id: "content",
    name: "Agent Création de Contenu",
    subtitle: "Génération multimédia",
    description: "Crée du contenu visuel, rédactionnel et vidéo adapté à votre marque : posts, stories, articles, scripts et visuels.",
    icon: PenTool,
    color: "from-purple-500/20 to-pink-500/10",
    borderColor: "border-purple-500/20",
    iconColor: "text-purple-400",
    bgGradient: "bg-gradient-to-br from-purple-500/20 to-pink-500/10",
    status: "active",
    statusLabel: "Actif",
    features: ["Posts sociaux", "Articles blog", "Scripts vidéo", "Visuels IA"],
  },
  {
    id: "analytics",
    name: "Agent Analytics",
    subtitle: "Intelligence Business",
    description: "Analyse vos données de performance, génère des rapports automatiques et identifie les opportunités de croissance.",
    icon: BarChart3,
    color: "from-amber-500/20 to-orange-500/10",
    borderColor: "border-amber-500/20",
    iconColor: "text-amber-400",
    bgGradient: "bg-gradient-to-br from-amber-500/20 to-orange-500/10",
    status: "soon",
    statusLabel: "Bientôt",
    features: ["Rapports auto", "KPIs temps réel", "Prédictions", "Alertes"],
  },
  {
    id: "email",
    name: "Agent Email Marketing",
    subtitle: "Campagnes email automatisées",
    description: "Conçoit et envoie des campagnes email segmentées, A/B teste les objets et optimise les taux d'ouverture.",
    icon: Mail,
    color: "from-cyan-500/20 to-teal-500/10",
    borderColor: "border-cyan-500/20",
    iconColor: "text-cyan-400",
    bgGradient: "bg-gradient-to-br from-cyan-500/20 to-teal-500/10",
    status: "soon",
    statusLabel: "Bientôt",
    features: ["Segmentation", "Templates IA", "A/B testing", "Automatisation"],
  },
  {
    id: "seo",
    name: "Agent SEO & Web",
    subtitle: "Optimisation référencement",
    description: "Audite votre site, optimise le référencement naturel, surveille vos positions et génère du contenu SEO-friendly.",
    icon: Globe,
    color: "from-rose-500/20 to-red-500/10",
    borderColor: "border-rose-500/20",
    iconColor: "text-rose-400",
    bgGradient: "bg-gradient-to-br from-rose-500/20 to-red-500/10",
    status: "soon",
    statusLabel: "Bientôt",
    features: ["Audit technique", "Mots-clés", "Contenu SEO", "Suivi"],
  },
];

const STATUS_CONFIG = {
  active: { color: "bg-emerald-500", textColor: "text-emerald-400", borderColor: "border-emerald-500/30", bgColor: "bg-emerald-500/10" },
  dev: { color: "bg-amber-500", textColor: "text-amber-400", borderColor: "border-amber-500/30", bgColor: "bg-amber-500/10" },
  soon: { color: "bg-zinc-500", textColor: "text-zinc-400", borderColor: "border-zinc-500/30", bgColor: "bg-zinc-500/10" },
};


// ══════════════════════════════════════════════════════════════════════════════
// AGENTS HUB
// ══════════════════════════════════════════════════════════════════════════════

function AgentsHub({ onOpenAgent, token }: { onOpenAgent: (id: string) => void; token?: string | null }) {
  const [userPlan, setUserPlan] = useState<UserPlan | null>(null);
  const [planLoading, setPlanLoading] = useState(true);
  const [googleAccount, setGoogleAccount] = useState<{ email: string } | null>(null);

  // Mock function to toggle connection state for UI development
  const toggleGoogleConnection = () => {
    setGoogleAccount(prev => prev ?null : { email: "user.email@gmail.com" });
  };

  useEffect(() => {
    if (token) {
      setPlanLoading(true);
      getUserPlan(token)
        .then(setUserPlan)
        .catch(err => console.error("Failed to fetch user plan:", err))
        .finally(() => setPlanLoading(false));
    }
  }, [token]);

  const isAllowed = userPlan?.plan === 'pro' || userPlan?.plan === 'business';
  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-10 bg-[var(--background)]">
      {/* Header */}
      <div className="flex items-center gap-4 mb-10">
        <div className="w-12 h-12 rounded-2xl bg-[var(--bg-hover)] flex items-center justify-center shadow-lg border border-[var(--border-glass)]">
          <Bot size={24} className="text-[var(--text-primary)]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight">Agents IA</h1>
          <p className="text-[11px] text-zinc-500 font-[family-name:var(--font-outfit)] uppercase tracking-widest">Équipe autonome FLARE AI</p>
        </div>
      </div>

      {/* Stats bar */}
      <div className="flex items-center gap-6 mb-8 px-2">
        {[
          { label: "Actifs", count: AGENTS.filter(a => a.status === "active").length, color: "text-emerald-400", dot: "bg-emerald-500" },
          { label: "En développement", count: AGENTS.filter(a => a.status === "dev").length, color: "text-amber-400", dot: "bg-amber-500" },
          { label: "Bientôt", count: AGENTS.filter(a => a.status === "soon").length, color: "text-zinc-400", dot: "bg-zinc-500" },
        ].map((s, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${s.dot}`} />
            <span className="text-[11px] text-zinc-500">{s.count} {s.label}</span>
          </div>
        ))}
      </div>

      {/* Connections Section */}
      <div className="mb-10">
        <h2 className="text-sm font-bold text-zinc-400 tracking-wider uppercase mb-4 px-2">Connexions</h2>
        <div className="p-5 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-glass)] flex items-center justify-between">
            <div className="flex items-center gap-4">
                <div className="w-11 h-11 rounded-xl bg-red-500/10 flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-400"><path d="M15.5 16.5c-2 0-3.5-1.5-3.5-3.5s1.5-3.5 3.5-3.5 3.5 1.5 3.5 3.5-1.5 3.5-3.5 3.5z"/><path d="M22 13c0 4.4-3.6 8-8 8s-8-3.6-8-8 3.6-8 8-8"/><path d="M15.5 13H22"/></svg>
                </div>
                <div>
                    <p className="text-sm font-medium text-[var(--text-primary)]">Connecter un compte Google</p>
                    <p className="text-xs text-zinc-500 mt-1">Pour automatiser Google Drive, Calendar, etc.</p>
                </div>
            </div>
            {planLoading ?(
                <div className="w-32 h-9 bg-zinc-700/50 rounded-lg animate-pulse" />
            ) : !isAllowed ?(
                <div className="flex items-center gap-2 text-xs font-bold text-amber-400 bg-amber-500/10 px-3 py-2 rounded-lg border border-amber-500/20" title="Fonctionnalité réservée aux plans Pro et Business">
                    <Lock size={12}/>
                    <span>Upgrade Requis</span>
                </div>
            ) : googleAccount ?(
                <div className="flex items-center gap-3">
                    <span className="text-sm text-zinc-400 font-medium truncate">{googleAccount.email}</span>
                    <button 
                        onClick={toggleGoogleConnection}
                        className="px-3 py-1.5 text-xs font-bold text-zinc-400 bg-zinc-700/50 rounded-lg hover:bg-zinc-700 transition-colors"
                    >
                        Déconnecter
                    </button>
                </div>
            ) : (
                <button 
                    onClick={toggleGoogleConnection}
                    className="px-4 py-2 text-xs font-bold text-white bg-red-600 rounded-lg hover:bg-red-500 transition-colors flex items-center gap-2"
                >
                    Connecter
                </button>
            )}
        </div>
      </div>

      {/* Agent Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {AGENTS.map((agent, i) => {
          const sc = STATUS_CONFIG[agent.status];
          const isClickable = agent.status === "active";
          return (
            <motion.div
              key={agent.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              onClick={() => isClickable && onOpenAgent(agent.id)}
              className={`p-6 rounded-[28px] ${agent.bgGradient} border ${agent.borderColor} transition-all relative overflow-hidden group ${
                isClickable ?"cursor-pointer hover:scale-[1.02] hover:shadow-lg" : "opacity-70 cursor-default"
              }`}
            >
              {/* Status badge */}
              <div className={`absolute top-4 right-4 px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest border ${sc.borderColor} ${sc.bgColor} ${sc.textColor}`}>
                <div className="flex items-center gap-1.5">
                  <div className={`w-1.5 h-1.5 rounded-full ${sc.color} ${agent.status === "active" ?"animate-pulse" : ""}`} />
                  {agent.statusLabel}
                </div>
              </div>

              {/* Icon */}
              <div className={`w-14 h-14 rounded-2xl bg-black/20 border border-white/10 flex items-center justify-center mb-5 ${agent.iconColor}`}>
                <agent.icon size={28} />
              </div>

              {/* Info */}
              <h3 className="text-[15px] font-bold text-[var(--text-primary)] mb-1">{agent.name}</h3>
              <p className="text-[11px] text-zinc-500 uppercase tracking-wider mb-3">{agent.subtitle}</p>
              <p className="text-[12px] text-zinc-400 leading-relaxed mb-5 line-clamp-2">{agent.description}</p>

              {/* Features */}
              <div className="flex flex-wrap gap-2">
                {agent.features.map((f, j) => (
                  <span key={j} className="px-2.5 py-1 rounded-lg bg-black/20 border border-white/5 text-[10px] text-zinc-400 font-medium">
                    {f}
                  </span>
                ))}
              </div>

              {/* CTA for active agents */}
              {isClickable && (
                <div className="mt-5 flex items-center gap-2 text-[11px] font-bold text-[var(--text-primary)] uppercase tracking-widest group-hover:gap-3 transition-all">
                  Ouvrir l&apos;agent <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
                </div>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}


// ══════════════════════════════════════════════════════════════════════════════
// PROSPECTION AGENT (existing, wrapped)
// ══════════════════════════════════════════════════════════════════════════════

function ProspectionAgent({ token, onBack }: { token?: string | null; onBack: () => void }) {
  const [viewMode, setViewMode] = useState<"chat" | "review">("chat");
  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: "Bonjour ! Je suis l'Agent de Prospection FLARE AI. Quel est le secteur d'activité ou la cible que vous souhaitez prospecter aujourd'hui ?" }
  ]);
  const [input, setInput] = useState("");
  const [brief, setBrief] = useState<Brief>({ sector: "", city: "", target_type: "", offer: "", tone: "" });
  const [leads, setLeads] = useState<any[]>([]);
  const [selectedLeadIndex, setSelectedLeadIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [sourcingLoading, setSourcingLoading] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: userMsg }]);
    setLoading(true);
    try {
      const data = await prospectingChat(userMsg, campaignId || undefined, token);
      if (data.campaign_id) setCampaignId(data.campaign_id);
      setMessages(prev => [...prev, { role: "assistant", content: data.response }]);
      if (data.brief) setBrief(prev => ({ ...prev, ...data.brief }));
      if (data.response.includes("READY:")) setIsReady(true);
    } catch (err) {
      setMessages(prev => [...prev, { role: "assistant", content: "Désolé, j'ai rencontré une erreur technique. Réessayez ?" }]);
    } finally {
      setLoading(false);
    }
  };

  const handleLaunch = async () => {
    if (!campaignId || sourcingLoading) return;
    setSourcingLoading(true);
    try {
      await launchSourcing(campaignId, token);
      const data = await reviewLeads(campaignId, token);
      if (data.leads && data.leads.length > 0) {
        setLeads(data.leads);
        setViewMode("review");
      } else {
        setMessages(prev => [...prev, { role: "assistant", content: "Mission terminée, mais aucun lead n'a passé la qualification. Essayez de revoir votre offre." }]);
      }
      setIsReady(false);
    } catch (err) {
      setMessages(prev => [...prev, { role: "assistant", content: "Erreur lors du sourcing. Vérifiez vos connexions API." }]);
    } finally {
      setSourcingLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!campaignId || !leads.length) return;
    setLoading(true);
    try {
      const res = await approveCampaign(campaignId, token);
      alert(`Succès : ${res.message}`);
      resetCampaign();
    } catch (err) { /* ignore */ }
    finally { setLoading(false); }
  };

  const updateLeadDraft = (subject: string, body: string) => {
    const updated = [...leads];
    updated[selectedLeadIndex].draft_email = { subject, body };
    setLeads(updated);
  };

  const ignoreLead = (index: number) => {
    const updated = leads.filter((_, i) => i !== index);
    setLeads(updated);
    if (selectedLeadIndex >= updated.length) setSelectedLeadIndex(Math.max(0, updated.length - 1));
  };

  const resetCampaign = () => {
    setCampaignId(null);
    setMessages([{ role: "assistant", content: "Nouveau départ ! Quel secteur souhaitez-vous cibler ?" }]);
    setBrief({ sector: "", city: "", target_type: "", offer: "", tone: "" });
    setLeads([]);
    setViewMode("chat");
    setIsReady(false);
  };

  return (
    <div className="flex-1 flex flex-col md:flex-row h-full overflow-hidden bg-[var(--background)]">
      {viewMode === "chat" ?(
        <>
          {/* LEFT: Wizard Chat */}
          <div className="flex-1 flex flex-col border-r border-[var(--border-glass)] relative">
            <div className="p-6 border-b border-[var(--border-glass)] bg-[var(--bg-sidebar)] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button onClick={onBack} className="p-2 rounded-xl hover:bg-[var(--bg-hover)] text-zinc-400 hover:text-[var(--text-primary)] transition-all">
                  <ChevronLeft size={18} />
                </button>
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                  <Target size={20} className="text-emerald-400" />
                </div>
                <div>
                  <h2 className="text-[15px] font-bold tracking-widest uppercase text-[var(--text-primary)]">Wizard Prospection</h2>
                  <p className="text-[11px] text-[var(--text-muted)] uppercase tracking-wider font-light">Dialogue de Configuration</p>
                </div>
              </div>
              <button onClick={resetCampaign} className="p-2 rounded-xl hover:bg-[var(--bg-hover)] text-[var(--text-muted)] transition-all" title="Réinitialiser">
                <RefreshCw size={14} />
              </button>
            </div>

            <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
              <AnimatePresence initial={false}>
                {messages.map((msg, i) => (
                  <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                    className={`flex ${msg.role === "user" ?"justify-end" : "justify-start"}`}>
                    <div className={`max-w-[85%] px-5 py-4 rounded-2xl text-[14px] leading-relaxed shadow-sm ${
                      msg.role === "user"
                        ?"bg-[var(--text-primary)] text-[rgb(var(--background))] font-medium"
                        : "bg-[var(--bg-card)] border border-[var(--border-glass)] text-[var(--text-primary)] font-light"
                    }`}>
                      {msg.content.replace("READY:", "").trim()}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
              {loading && (
                <div className="flex justify-start animate-fade-in">
                  <div className="bg-[var(--bg-card)] border border-[var(--border-glass)] p-4 rounded-2xl">
                    <Loader2 size={16} className="animate-spin text-[var(--text-primary)]" />
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-[var(--border-glass)] bg-[var(--bg-sidebar)]">
              <div className="relative group">
                <input type="text" value={input} onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSend()}
                  placeholder="Répondez à l'agent..."
                  className="w-full pl-6 pr-14 py-4 rounded-2xl bg-[var(--bg-input)] border border-[var(--border-glass)] text-[15px] text-[var(--text-primary)] focus:outline-none focus:border-[var(--border-subtle)] transition-all shadow-inner" />
                <button onClick={handleSend} disabled={loading || !input.trim()}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-xl bg-[var(--text-primary)] text-[rgb(var(--background))] flex items-center justify-center hover:opacity-90 transition-all disabled:opacity-40 active:scale-95">
                  <Send size={16} />
                </button>
              </div>
            </div>
          </div>

          {/* RIGHT: Campaign Brief */}
          <div className="w-full md:w-[380px] lg:w-[450px] bg-[var(--background)] flex flex-col">
            <div className="p-6 border-b border-[var(--border-glass)] h-[84px] flex items-center">
              <h3 className="text-[13px] font-bold tracking-[0.2em] uppercase text-[var(--text-primary)] flex items-center gap-2">
                <Target size={14} /> Stratégie de Campagne
              </h3>
            </div>
            <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar relative">
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { label: "Secteur", icon: Megaphone, val: brief.sector, placeholder: "Non défini" },
                    { label: "Ville", icon: MapPin, val: brief.city, placeholder: "Partout" },
                  ].map((f, i) => (
                    <div key={i} className="space-y-2">
                      <label className="text-[10px] font-bold tracking-widest text-[var(--text-muted)] uppercase flex items-center gap-2">
                        <f.icon size={10} /> {f.label}
                      </label>
                      <div className={`p-4 rounded-2xl border transition-all duration-500 ${f.val ?'bg-[var(--bg-hover)] border-[var(--border-subtle)]' : 'bg-[var(--bg-input)] border-[var(--border-glass)]'}`}>
                        <span className={`text-[14px] ${f.val ?'text-[var(--text-primary)] font-medium' : 'text-[var(--text-muted)]'}`}>
                          {f.val || f.placeholder}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold tracking-widest text-[var(--text-muted)] uppercase flex items-center gap-2">
                    <Target size={10} /> Type de Cible
                  </label>
                  <div className={`p-4 rounded-2xl border transition-all duration-500 ${brief.target_type ?'bg-[var(--bg-hover)] border-[var(--border-subtle)]' : 'bg-[var(--bg-input)] border-[var(--border-glass)]'}`}>
                    <span className={`text-[14px] ${brief.target_type ?'text-[var(--text-primary)] font-medium' : 'text-[var(--text-muted)]'}`}>
                      {brief.target_type || "Ex: Agence immo, PME..."}
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold tracking-widest text-[var(--text-muted)] uppercase flex items-center gap-2">
                    <Sparkles size={10} /> Notre Offre
                  </label>
                  <div className={`p-5 rounded-2xl border transition-all duration-700 min-h-[100px] ${brief.offer ?'bg-[var(--bg-hover)] border-[var(--border-subtle)]' : 'bg-[var(--bg-input)] border-[var(--border-glass)]'}`}>
                    <p className={`text-[14px] leading-relaxed ${brief.offer ?'text-[var(--text-primary)] font-light' : 'text-[var(--text-muted)] italic'}`}>
                      {brief.offer || "L'agent rédige ici la synthèse de votre proposition commerciale..."}
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold tracking-widest text-[var(--text-muted)] uppercase flex items-center gap-2">
                    <Type size={10} /> Ton de la Campagne
                  </label>
                  <div className={`p-4 rounded-2xl border transition-all duration-500 ${brief.tone ?'bg-[var(--bg-hover)] border-[var(--border-subtle)]' : 'bg-[var(--bg-input)] border-[var(--border-glass)]'}`}>
                    <span className={`text-[14px] ${brief.tone ?'text-[var(--text-primary)] font-medium' : 'text-[var(--text-muted)]'}`}>
                      {brief.tone || "Ex. : sérieux, expert, amical..."}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-12 space-y-6">
                <div className="h-px bg-[var(--border-glass)] w-full" />
                <AnimatePresence>
                  {isReady && (
                    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="space-y-4">
                      <div className="p-4 rounded-2xl bg-green-500/5 border border-green-500/20 flex items-center gap-3">
                        <CheckCircle2 size={16} className="text-green-500" />
                        <span className="text-[12px] text-green-400 font-medium">Brief validé. Prêt pour le sourcing.</span>
                      </div>
                      <button onClick={handleLaunch} disabled={sourcingLoading}
                        className="w-full py-6 rounded-[24px] bg-[var(--text-primary)] text-[rgb(var(--background))] font-bold uppercase tracking-[0.2em] shadow-[0_10px_30px_rgba(255,255,255,0.05)] transition-all flex items-center justify-center gap-3 group active:scale-95">
                        {sourcingLoading ?<Loader2 size={20} className="animate-spin" /> : (
                          <><Rocket size={20} className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" /> Lancer la recherche</>
                        )}
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
                {!isReady && (
                  <div className="p-6 rounded-3xl border border-dashed border-[var(--border-glass)] bg-[var(--bg-card)] flex flex-col items-center justify-center text-center opacity-40">
                    <Zap size={24} className="text-[var(--text-muted)] mb-3" />
                    <p className="text-[12px] text-[var(--text-muted)] font-normal max-w-[200px]">
                      Finalisez le dialogue pour débloquer le sourcing automatique.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      ) : (
        /* REVIEW MODE */
        <div className="flex-1 flex flex-col h-full bg-[var(--background)] animate-fade-in w-full">
          <div className="p-6 border-b border-[var(--border-glass)] bg-[var(--bg-sidebar)] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-[var(--bg-hover)] border border-[var(--border-glass)] flex items-center justify-center">
                <Eye size={20} className="text-[var(--text-primary)]" />
              </div>
              <div>
                <h2 className="text-[15px] font-bold tracking-widest uppercase text-[var(--text-primary)]">Revue des Prospects</h2>
                <p className="text-[11px] text-[var(--text-muted)] uppercase tracking-wider font-light">Validation & Personnalisation</p>
              </div>
            </div>
            <button onClick={() => setViewMode("chat")}
              className="px-4 py-2 rounded-xl border border-[var(--border-glass)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all text-xs flex items-center gap-2">
              <RefreshCw size={12} /> Retour au Wizard
            </button>
          </div>

          <div className="flex-1 flex overflow-hidden flex-col md:flex-row">
            <div className="w-full md:w-[320px] lg:w-[400px] border-r border-[var(--border-glass)] flex flex-col bg-[var(--bg-sidebar)] h-1/2 md:h-full">
              <div className="p-4 border-b border-[var(--border-glass)]">
                <span className="text-[10px] font-bold tracking-[0.2em] text-[var(--text-muted)] uppercase">{leads.length} Prospects qualifiés</span>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                {leads.map((lead, idx) => (
                  <div key={idx} onClick={() => setSelectedLeadIndex(idx)}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer group relative ${
                      selectedLeadIndex === idx
                        ?'bg-[var(--bg-active)] border-[var(--border-subtle)] shadow-sm'
                        : 'bg-[var(--bg-card)] border-[var(--border-glass)] hover:border-[var(--border-subtle)]'
                    }`}>
                    <div className="flex justify-between items-start mb-1">
                      <h4 className="text-[14px] font-medium truncate pr-6 text-[var(--text-primary)]">{lead.company}</h4>
                      <span className="text-[10px] font-bold text-[var(--text-primary)]/80">{lead.score}/10</span>
                    </div>
                    <p className="text-[11px] text-[var(--text-muted)] line-clamp-2 leading-relaxed">{lead.valuation_notes}</p>
                    <button onClick={(e) => { e.stopPropagation(); ignoreLead(idx); }}
                      className="absolute right-3 top-3 p-1.5 opacity-0 group-hover:opacity-100 text-[var(--text-muted)] hover:text-red-400 transition-all">
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
              <div className="p-6 border-t border-[var(--border-glass)]">
                <button onClick={handleApprove} disabled={loading || leads.length === 0}
                  className="w-full py-5 rounded-2xl bg-[var(--text-primary)] text-[rgb(var(--background))] font-bold uppercase tracking-widest text-xs flex items-center justify-center gap-2 shadow-lg hover:opacity-90 transition-all active:scale-95 disabled:opacity-50">
                  {loading ?<Loader2 size={16} className="animate-spin" /> : <Rocket size={16} />}
                  Approuver & Envoyer ({leads.length})
                </button>
              </div>
            </div>

            <div className="flex-1 flex flex-col bg-[var(--background)] h-1/2 md:h-full">
              {leads[selectedLeadIndex] ?(
                <div className="flex-1 flex flex-col p-8 lg:p-12 overflow-y-auto custom-scrollbar animate-fade-in-up">
                  <div className="mb-10 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div>
                      <h3 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight">{leads[selectedLeadIndex].company}</h3>
                      <a href={leads[selectedLeadIndex].website} target="_blank" rel="noreferrer"
                        className="text-[var(--text-primary)] text-sm hover:underline mt-1 inline-block">
                        {leads[selectedLeadIndex].website}
                      </a>
                    </div>
                    <div className="p-4 rounded-2xl bg-[var(--bg-hover)] border border-[var(--border-glass)] max-w-full lg:max-w-[300px]">
                      <p className="text-[12px] text-[var(--text-primary)] font-medium mb-1 flex items-center gap-2">
                        <Sparkles size={12} /> Analyse IA
                      </p>
                      <p className="text-[11px] text-[var(--text-muted)] leading-relaxed italic">{leads[selectedLeadIndex].valuation_notes}</p>
                    </div>
                  </div>
                  <div className="space-y-8 max-w-4xl">
                    <div className="space-y-3">
                      <label className="text-[10px] font-bold tracking-[0.2em] text-[var(--text-muted)] uppercase pl-1">Objet de l&apos;email</label>
                      <input type="text" value={leads[selectedLeadIndex].draft_email?.subject || ""}
                        onChange={(e) => updateLeadDraft(e.target.value, leads[selectedLeadIndex].draft_email?.body || "")}
                        className="w-full px-6 py-4 rounded-2xl bg-[var(--bg-input)] border border-[var(--border-glass)] text-[15px] font-medium text-[var(--text-primary)] focus:outline-none focus:border-[var(--border-subtle)] transition-all" />
                    </div>
                    <div className="space-y-3">
                      <label className="text-[10px] font-bold tracking-[0.2em] text-[var(--text-muted)] uppercase pl-1">Corps du message</label>
                      <textarea rows={12} value={leads[selectedLeadIndex].draft_email?.body || ""}
                        onChange={(e) => updateLeadDraft(leads[selectedLeadIndex].draft_email?.subject || "", e.target.value)}
                        className="w-full px-6 py-6 rounded-[32px] bg-[var(--bg-input)] border border-[var(--border-glass)] text-[15px] font-light text-[var(--text-primary)] leading-[1.8] focus:outline-none focus:border-[var(--border-subtle)] transition-all custom-scrollbar resize-none" />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center opacity-50 p-8 text-center">
                  <Bot size={48} className="text-[var(--text-muted)] mb-4" />
                  <p className="text-[var(--text-muted)]">Sélectionnez un prospect pour éditer son email.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


// ══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════════════════════

function FeaturedAgentsHub({ onOpenAgent, token }: { onOpenAgent: (id: string) => void; token?: string | null }) {
  const [userPlan, setUserPlan] = useState<UserPlan | null>(null);
  const [planLoading, setPlanLoading] = useState(true);
  const [googleAccount, setGoogleAccount] = useState<{ email: string } | null>(null);

  useEffect(() => {
    if (token) {
      setPlanLoading(true);
      getUserPlan(token)
        .then(setUserPlan)
        .catch((err) => console.error("Failed to fetch user plan:", err))
        .finally(() => setPlanLoading(false));
    }
  }, [token]);

  const toggleGoogleConnection = () => {
    setGoogleAccount((prev) => (prev ?null : { email: "user.email@gmail.com" }));
  };

  const isAllowed = userPlan?.plan === "pro" || userPlan?.plan === "business";
  const featuredAgent = AGENTS.find((agent) => agent.id === "content");
  const activeAgents = AGENTS.filter((agent) => agent.status === "active" && agent.id !== "content");
  const upcomingAgents = AGENTS.filter((agent) => agent.status !== "active");

  return (
    <div className="flex-1 overflow-y-auto bg-[var(--background)] p-4 md:p-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <div className="rounded-[28px] border border-[var(--border-glass)] bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] p-6 md:p-8">
          <div className="mb-5 flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] shadow-lg">
              <Bot size={24} className="text-[var(--text-primary)]" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">Choisissez un agent</h1>
              <p className="mt-1 text-sm text-[var(--text-muted)]">Chaque agent a un rôle précis. Ouvrez celui dont vous avez besoin.</p>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            {[
              { label: "Prêts maintenant", value: (activeAgents.length + (featuredAgent ?1 : 0)).toString() },
              { label: "En préparation", value: upcomingAgents.length.toString() },
              { label: "But", value: "Gagner du temps" },
            ].map((item) => (
              <div key={item.label} className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-4">
                <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">{item.label}</div>
                <div className="mt-2 text-lg font-semibold text-white">{item.value}</div>
              </div>
            ))}
          </div>
        </div>

        {featuredAgent && (
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-[32px] border border-orange-500/20 bg-[linear-gradient(135deg,rgba(249,115,22,0.16),rgba(168,85,247,0.10)_48%,rgba(12,12,14,0.92)_88%)] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.22)]"
          >
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.22em] text-orange-200">
                  <Sparkles size={12} />
                  Le plus complet
                </div>
                <h2 className="mt-4 text-3xl font-semibold leading-tight text-white">Création de contenu</h2>
                <p className="mt-3 max-w-3xl text-sm leading-7 text-zinc-200/88 md:text-[15px]">
                  Un seul agent pour écrire, créer des images, retoucher des photos et préparer des vidéos.
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
                  {[
                    "Écrire un texte",
                    "Créer une image",
                    "Retoucher une photo",
                    "Préparer une vidéo",
                    "Faire plusieurs formats",
                  ].map((item) => (
                    <span key={item} className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-[11px] font-medium text-zinc-200">
                      {item}
                    </span>
                  ))}
                </div>
                <div className="mt-7 flex flex-wrap items-center gap-3">
                  <button
                    onClick={() => onOpenAgent("content")}
                    className="group inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-bold text-black transition-all hover:scale-[1.01] hover:opacity-95"
                  >
                    Ouvrir
                    <ChevronRight size={16} className="transition-transform group-hover:translate-x-1" />
                  </button>
                  <button
                    onClick={() => onOpenAgent("prospection")}
                    className="inline-flex items-center gap-2 rounded-2xl border border-white/12 bg-white/[0.05] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/[0.08]"
                  >
                    Voir aussi Prospection
                  </button>
                </div>
              </div>

              <div className="grid gap-3">
                {[
                  { icon: Palette, label: "Images", value: "Créer, retoucher, enlever le fond et changer le décor." },
                  { icon: PenTool, label: "Textes", value: "Posts, pubs, idées, titres et contenus prêts à publier." },
                  { icon: Video, label: "Vidéos", value: "Préparer un plan, un script et un rendu vidéo simple." },
                ].map((item) => (
                  <div key={item.label} className="rounded-[24px] border border-white/10 bg-black/20 p-5 backdrop-blur-sm">
                    <div className="flex items-start gap-4">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-white">
                        <item.icon size={19} />
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-white">{item.label}</div>
                        <div className="mt-1 text-sm leading-6 text-zinc-300">{item.value}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-8">
            <section>
              <div className="mb-4">
                <h2 className="text-xl font-semibold text-white">Prêts maintenant</h2>
                <p className="mt-1 text-sm text-[var(--text-muted)]">Des agents simples, chacun avec son rôle.</p>
              </div>
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                {activeAgents.map((agent, i) => {
                  const sc = STATUS_CONFIG[agent.status];
                  return (
                    <motion.div
                      key={agent.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      onClick={() => onOpenAgent(agent.id)}
                      className={`group cursor-pointer rounded-[28px] border ${agent.borderColor} ${agent.bgGradient} p-6 transition-all hover:scale-[1.01] hover:shadow-lg`}
                    >
                      <div className="mb-5 flex items-start justify-between gap-4">
                        <div className={`flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-black/20 ${agent.iconColor}`}>
                          <agent.icon size={28} />
                        </div>
                        <div className={`rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] ${sc.borderColor} ${sc.bgColor} ${sc.textColor}`}>
                          {agent.statusLabel}
                        </div>
                      </div>
                      <h3 className="text-xl font-bold text-white">{agent.name}</h3>
                      <p className="mt-1 text-sm font-medium text-zinc-300">{agent.subtitle}</p>
                      <p className="mt-3 text-sm leading-relaxed text-zinc-400">{agent.description}</p>
                      <div className="mt-5 flex flex-wrap gap-2">
                        {agent.features.map((feature, j) => (
                          <span key={j} className="rounded-xl border border-white/8 bg-black/20 px-3 py-1.5 text-xs text-zinc-300">
                            {feature}
                          </span>
                        ))}
                      </div>
                      <div className="mt-6 flex items-center justify-between">
                        <span className="text-xs uppercase tracking-[0.18em] text-zinc-500">Simple à lancer</span>
                        <div className="flex items-center gap-2 rounded-xl bg-white/[0.08] px-4 py-2 text-sm font-semibold text-white transition-all group-hover:bg-white/[0.12]">
                          Ouvrir
                          <ChevronRight size={16} className="transition-transform group-hover:translate-x-0.5" />
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </section>

            <section>
              <div className="mb-4">
                <h2 className="text-xl font-semibold text-white">Bientôt</h2>
                <p className="mt-1 text-sm text-[var(--text-muted)]">Ils arrivent ensuite. Nous les gardons séparés pour que tout reste clair.</p>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
                {upcomingAgents.map((agent, i) => {
                  const sc = STATUS_CONFIG[agent.status];
                  return (
                    <motion.div
                      key={agent.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04 }}
                      className={`rounded-[24px] border ${agent.borderColor} bg-[var(--bg-card)] p-5 opacity-90`}
                    >
                      <div className={`mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/8 bg-black/20 ${agent.iconColor}`}>
                        <agent.icon size={24} />
                      </div>
                      <h3 className="text-base font-semibold text-white">{agent.name}</h3>
                      <p className="mt-1 text-sm text-zinc-400">{agent.subtitle}</p>
                      <div className={`mt-4 inline-flex rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] ${sc.borderColor} ${sc.bgColor} ${sc.textColor}`}>
                        {agent.statusLabel}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </section>
          </div>

          <div className="space-y-6">
            <div className="rounded-[28px] border border-[var(--border-glass)] bg-[var(--bg-card)] p-5">
              <h2 className="mb-4 text-lg font-semibold text-white">Compte Google</h2>
              <div className="rounded-2xl border border-[var(--border-glass)] bg-[var(--bg-hover)] p-4">
                <div className="mb-4 flex items-center gap-4">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-500/10">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-400"><path d="M15.5 16.5c-2 0-3.5-1.5-3.5-3.5s1.5-3.5 3.5-3.5 3.5 1.5 3.5 3.5-1.5 3.5-3.5 3.5z"/><path d="M22 13c0 4.4-3.6 8-8 8s-8-3.6-8-8 3.6-8 8-8"/><path d="M15.5 13H22"/></svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[var(--text-primary)]">Connexion Google</p>
                    <p className="mt-1 text-xs text-zinc-500">Optionnel. Sert pour Drive, Calendar et d'autres outils Google.</p>
                  </div>
                </div>
                {planLoading ?(
                  <div className="h-9 w-32 animate-pulse rounded-lg bg-zinc-700/50" />
                ) : !isAllowed ?(
                  <div className="flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs font-bold text-amber-400" title="Fonction réservée aux plans Pro et Business">
                    <Lock size={12} />
                    <span>Disponible sur Pro</span>
                  </div>
                ) : googleAccount ?(
                  <div className="flex items-center justify-between gap-3">
                    <span className="truncate text-sm font-medium text-zinc-300">{googleAccount.email}</span>
                    <button
                      onClick={toggleGoogleConnection}
                      className="rounded-lg bg-zinc-700/50 px-3 py-1.5 text-xs font-bold text-zinc-300 transition-colors hover:bg-zinc-700"
                    >
                      Déconnecter
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={toggleGoogleConnection}
                    className="rounded-lg bg-red-600 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-red-500"
                  >
                    Connecter
                  </button>
                )}
              </div>
            </div>

            <div className="rounded-[28px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.01))] p-5">
              <h2 className="text-lg font-semibold text-white">Comment l'utiliser</h2>
              <div className="mt-4 space-y-3 text-sm leading-6 text-zinc-300">
                <p>1. Choisissez un agent.</p>
                <p>2. Expliquez simplement ce que vous voulez.</p>
                <p>3. Laissez l'agent préparer le résultat.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AgentsPanel({ token }: AgentsPanelProps) {
  const [view, setView] = useState<AgentView>("hub");

  switch (view) {
    case "prospection":
      return <ProspectionAgent token={token} onBack={() => setView("hub")} />;
    case "content":
      return <ContentStudioPage token={token} onClose={() => setView("hub")} />;
    default:
      return <FeaturedAgentsHub onOpenAgent={(id) => {
        if (id === "prospection") setView("prospection");
        if (id === "content") setView("content");
      }} token={token} />;
  }
}
