"use client";

import { useEffect, useState } from "react";
import { MessageCircle, Users, Wifi, WifiOff, Activity } from "lucide-react";
import { getCMStatus, listCampaigns, Campaign } from "@/lib/api";

interface CMStatus {
  statut: string;
  conversations_actives: number;
  meta_configured: boolean;
}

export default function AgentStatusPanel() {
  const [cmStatus, setCmStatus] = useState<CMStatus | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [backendOnline, setBackendOnline] = useState(false);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const [cm, camp] = await Promise.all([
          getCMStatus(),
          listCampaigns(),
        ]);
        setCmStatus(cm as unknown as CMStatus);
        setCampaigns(camp);
        setBackendOnline(true);
      } catch {
        setBackendOnline(false);
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 30000); // Refresh toutes les 30s
    return () => clearInterval(interval);
  }, []);

  const activeCampaigns = campaigns.filter((c) => c.status === "running");

  return (
    <div className="w-56 bg-gray-900 border-l border-gray-700 p-3 hidden xl:flex flex-col gap-3">
      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
        Statut Système
      </h3>

      {/* Backend */}
      <div className="bg-gray-800 rounded-xl p-3">
        <div className="flex items-center gap-2 mb-1">
          <Activity size={13} className="text-gray-400" />
          <span className="text-xs text-gray-400">Backend</span>
        </div>
        <div className="flex items-center gap-2">
          <div
            className={`w-2 h-2 rounded-full ${
              backendOnline ? "bg-green-400 animate-pulse" : "bg-red-400"
            }`}
          />
          <span className={`text-xs font-medium ${backendOnline ? "text-green-400" : "text-red-400"}`}>
            {backendOnline ? "En ligne" : "Hors ligne"}
          </span>
        </div>
        <p className="text-[10px] text-gray-600 mt-1">Cloud Run</p>
      </div>

      {/* Agent CM Facebook */}
      <div className="bg-gray-800 rounded-xl p-3">
        <div className="flex items-center gap-2 mb-2">
          <MessageCircle size={13} className="text-zinc-400" />
          <span className="text-xs text-gray-300 font-medium">CM Facebook</span>
        </div>
        {cmStatus ? (
          <>
            <div className="flex items-center gap-2">
              {cmStatus.meta_configured ? (
                <Wifi size={12} className="text-green-400" />
              ) : (
                <WifiOff size={12} className="text-[var(--text-primary)]" />
              )}
              <span
                className={`text-xs ${
                  cmStatus.meta_configured ? "text-green-400" : "text-[var(--text-primary)]"
                }`}
              >
                {cmStatus.meta_configured ? "Connecté" : "Non configuré"}
              </span>
            </div>
            <p className="text-[10px] text-gray-500 mt-1">
              {cmStatus.conversations_actives} conversation(s) active(s)
            </p>
          </>
        ) : (
          <div className="text-[10px] text-gray-600">Chargement...</div>
        )}
      </div>

      {/* Groupe de Prosp */}
      <div className="bg-gray-800 rounded-xl p-3">
        <div className="flex items-center gap-2 mb-2">
          <Users size={13} className="text-[var(--text-primary)]" />
          <span className="text-xs text-gray-300 font-medium">Groupe de Prosp</span>
        </div>
        <div className="flex items-center gap-2">
          <div
            className={`w-2 h-2 rounded-full ${
              activeCampaigns.length > 0 ? "bg-[var(--text-primary)] animate-pulse" : "bg-gray-600"
            }`}
          />
          <span
            className={`text-xs ${
              activeCampaigns.length > 0 ? "text-[var(--text-primary)]" : "text-gray-500"
            }`}
          >
            {activeCampaigns.length > 0
              ? `${activeCampaigns.length} campagne(s) active(s)`
              : "Inactif"}
          </span>
        </div>
        {campaigns.length > 0 && (
          <div className="mt-2 space-y-1">
            {campaigns.slice(0, 2).map((c) => (
              <div key={c.id} className="text-[10px] text-gray-600">
                <span className="text-gray-500">{c.sector}</span>
                {" — "}
                <span
                  className={
                    c.status === "running"
                      ? "text-[var(--text-primary)]"
                      : c.status === "completed"
                      ? "text-green-500"
                      : "text-gray-500"
                  }
                >
                  {c.status === "running"
                    ? "En cours"
                    : c.status === "completed"
                    ? "Terminé"
                    : c.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 9 Agents */}
      <div className="bg-gray-800 rounded-xl p-3">
        <p className="text-xs text-gray-400 mb-2">9 Agents du Swarm</p>
        <div className="space-y-0.5">
          {[
            "Chercheur",
            "Analyste Web",
            "Qualificateur",
            "Rédacteur",
            "Compliance",
            "Gestionnaire Envoi",
            "Gestionnaire Suivi",
            "Gestionnaire Réponses",
            "Reporting",
          ].map((agent, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <div
                className={`w-1.5 h-1.5 rounded-full ${
                  activeCampaigns.length > 0 ? "bg-[var(--text-primary)]" : "bg-gray-600"
                }`}
              />
              <span className="text-[10px] text-gray-600">{agent}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
