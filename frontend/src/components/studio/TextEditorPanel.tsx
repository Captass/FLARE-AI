"use client";

import React, { useState } from "react";
import { Send, Type, Loader2, Copy, Check, FileText } from "lucide-react";
import { motion } from "framer-motion";

export default function TextEditorPanel() {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState("");
  const [copied, setCopied] = useState(false);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    setResult("");

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/content-studio/generate/text`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: "demo",
          type: "post",
          platform: "linkedin",
          tone: "pro",
          brief: prompt,
          language: "fr"
        }),
      });

      if (!response.body) throw new Error("No response body");

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ") && line !== "data: [DONE]") {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.content) {
                setResult(prev => prev + data.content);
              }
            } catch (e) {
              console.error("Error parsing chunk", e);
            }
          }
        }
      }
    } catch (error) {
      console.error("Error generating text:", error);
      setResult("Une erreur est survenue lors de la génération.");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="h-full flex flex-col md:flex-row bg-[#0B0C10] text-gray-200 font-sans">
      <div className="w-full md:w-[420px] shrink-0 border-r border-white/10 flex flex-col bg-[#14151A] shadow-2xl z-10">
        
        <div className="h-14 px-6 border-b border-white/10 flex items-center gap-3 shrink-0 bg-[#1A1C23]">
          <div className="w-8 h-8 rounded-md bg-gradient-to-br from-purple-500/20 to-blue-500/20 border border-purple-500/30 flex items-center justify-center">
            <Type size={16} className="text-purple-400" />
          </div>
          <h2 className="text-xs font-semibold text-white uppercase tracking-widest">Éditeur de Texte</h2>
        </div>
        
        <div className="flex-1 p-6 flex flex-col gap-6 overflow-y-auto custom-scrollbar">
          
          <div className="space-y-3">
             <div className="flex items-center gap-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
               <FileText size={12} />
               <label>Sujet & Instructions</label>
             </div>
             <textarea 
               value={prompt}
               onChange={e => setPrompt(e.target.value)}
               placeholder="Ex: Rédige un post LinkedIn pour annoncer le lancement de notre nouveau produit, ton professionnel mais enthousiaste..."
               className="w-full h-48 bg-[#1E1F26] border border-white/10 rounded-xl p-4 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/50 resize-none custom-scrollbar transition-all"
             />
          </div>
          
        </div>

        <div className="p-5 border-t border-white/10 bg-[#1A1C23] shrink-0">
          <button 
            onClick={handleGenerate}
            disabled={loading || !prompt.trim()}
            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 text-white font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 hover:from-purple-500 hover:to-blue-500 transition-all disabled:opacity-50 disabled:grayscale active:scale-[0.98] shadow-lg shadow-purple-500/20"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            Générer le contenu
          </button>
        </div>
      </div>
      
      <div className="flex-1 bg-[#0A0A0C] p-4 md:p-12 flex flex-col items-center justify-center relative overflow-y-auto custom-scrollbar" style={{ backgroundImage: 'radial-gradient(circle at 50% 50%, rgba(255,255,255,0.02) 1px, transparent 1px)', backgroundSize: '24px 24px' }}>
        {loading ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full max-w-3xl bg-[#14151A] border border-white/10 rounded-2xl p-8 relative shadow-2xl flex flex-col gap-4">
             <div className="w-3/4 h-6 bg-white/5 rounded animate-pulse" />
             <div className="w-full h-4 bg-white/5 rounded animate-pulse delay-75 mt-4" />
             <div className="w-5/6 h-4 bg-white/5 rounded animate-pulse delay-100" />
             <div className="w-full h-4 bg-white/5 rounded animate-pulse delay-150" />
             <div className="w-2/3 h-4 bg-white/5 rounded animate-pulse delay-200" />
          </motion.div>
        ) : result ? (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-3xl bg-[#14151A] border border-white/10 rounded-2xl p-8 relative shadow-2xl my-auto">
            <button onClick={handleCopy} className="absolute top-4 right-4 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-all flex items-center gap-2 text-xs font-medium">
              {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
              {copied ? "Copié" : "Copier"}
            </button>
            <div className="whitespace-pre-wrap text-sm text-gray-300 leading-relaxed mt-4 font-light">
              {result}
            </div>
          </motion.div>
        ) : (
          <div className="opacity-40 text-center flex flex-col items-center p-8 rounded-2xl border-2 border-dashed border-white/10">
            <div className="w-20 h-20 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-6">
              <FileText size={32} className="text-gray-500" />
            </div>
            <p className="text-sm font-semibold text-gray-300 uppercase tracking-widest mb-2">Générateur IA</p>
            <p className="text-xs text-gray-500 max-w-xs text-center">Le texte généré apparaîtra ici avec une mise en forme lisible.</p>
          </div>
        )}
      </div>
    </div>
  );
}
