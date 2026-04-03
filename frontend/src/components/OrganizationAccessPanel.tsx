"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Building2, Check, Loader2, Plus, ShieldCheck, Trash2, X } from "lucide-react";
import { toRenderableMediaUrl, type OrganizationAccessResponse, type OrganizationSummary } from "@/lib/api";
import FlareMark from "./FlareMark";

interface OrganizationAccessPanelProps {
  open: boolean;
  data: OrganizationAccessResponse | null;
  loading?: boolean;
  onClose: () => void;
  onUsePersonal: () => void;
  onConnectOrganization: (slug: string) => void;
  onCreateOrganization: (name: string) => void;
  onDeleteOrganization: (slug: string) => void;
}

function formatRemainingTime(minutes?: number | null): string {
  if (typeof minutes !== "number") return "Session temporaire";
  if (minutes <= 0) return "A renouveler";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h ${rest}min` : `${hours}h`;
}

function renderModuleLabel(key: string): string {
  switch (key) {
    case "assistant": return "Assistant IA";
    case "chatbot": return "Chatbot";
    case "automations": return "Automatisations";
    default: return key;
  }
}

export default function OrganizationAccessPanel({
  open,
  data,
  loading = false,
  onClose,
  onUsePersonal,
  onConnectOrganization,
  onCreateOrganization,
  onDeleteOrganization,
}: OrganizationAccessPanelProps) {
  const [selectedSlug, setSelectedSlug] = useState<string>("personal");
  const [newOrganizationName, setNewOrganizationName] = useState("");

  useEffect(() => {
    if (!data) return;
    setSelectedSlug(data.current_scope.organization_slug || data.organizations[0]?.slug || "personal");
  }, [data]);

  const selectedOrg = useMemo<OrganizationSummary | null>(() => {
    if (!data || selectedSlug === "personal") return null;
    return data.organizations.find((o) => o.slug === selectedSlug) || null;
  }, [data, selectedSlug]);

  if (!open || !data) return null;

  const scope = data.current_scope;
  const isPersonalActive = scope.type === "personal";
  const canCreateOrganization = scope.type === "personal" || scope.current_user_role === "owner" || scope.current_user_role === "admin";

  return (
    <div className="fixed inset-0 z-[150]">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      <div className="absolute inset-0 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-[540px] max-h-[85vh] flex flex-col rounded-2xl bg-[rgba(10,12,18,0.97)] shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 pt-6 pb-4 shrink-0">
            <div>
              <p className="text-[10px] uppercase tracking-[0.16em] text-white/30">Espace de travail</p>
              <h2 className="mt-1 text-[20px] font-semibold tracking-tight text-white">
                Choisissez votre espace
              </h2>
            </div>
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-white/30 hover:text-white/60 hover:bg-white/[0.04] transition-all"
            >
              <X size={16} />
            </button>
          </div>

          {/* Scope info */}
          <div className="mx-6 mb-4 flex items-center gap-3 rounded-xl bg-white/[0.03] px-4 py-3 shrink-0">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.04]">
              <ShieldCheck size={14} className="text-white/40" />
            </div>
            <p className="text-[12px] text-white/35 leading-relaxed">
              Actif : <span className="text-white/60 font-medium">{scope.label}</span>
              {scope.current_user_role_label && (
                <span className="ml-1.5 text-white/25">({scope.current_user_role_label})</span>
              )}
            </p>
          </div>

          {/* Scrollable list */}
          <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-2 min-h-0">
            {/* Personal space */}
            <button
              onClick={() => { setSelectedSlug("personal"); onUsePersonal(); }}
              className={`w-full flex items-center gap-3.5 rounded-xl px-4 py-3.5 text-left transition-all ${
                isPersonalActive
                  ? "bg-white/[0.06] ring-1 ring-white/[0.08]"
                  : "bg-white/[0.02] hover:bg-white/[0.04]"
              }`}
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.04]">
                <FlareMark tone="dark" className="w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-[14px] font-medium text-white truncate">Espace personnel</p>
                  {isPersonalActive && (
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/10">
                      <Check size={10} className="text-white" />
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-white/30 mt-0.5">Assistant et reglages personnels</p>
              </div>
              {!isPersonalActive && (
                <span className="text-[11px] text-white/30 hover:text-white/50">
                  <ArrowRight size={14} />
                </span>
              )}
            </button>

            {/* Organizations */}
            {data.organizations.length === 0 && (
              <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] px-4 py-4">
                <p className="text-[13px] font-medium text-white/70">Aucun espace de travail</p>
                <p className="mt-1 text-[11px] leading-relaxed text-white/35">
                  Creez votre premier espace pour connecter Facebook et activer votre chatbot.
                </p>
              </div>
            )}
            {data.organizations.map((org) => {
              const isActive = scope.organization_slug === org.slug;
              const isSelected = selectedSlug === org.slug;
              const logoUrl = toRenderableMediaUrl(org.logo_url);

              return (
                <div
                  key={org.slug}
                  className={`w-full flex items-center gap-3.5 rounded-xl px-4 py-3.5 text-left transition-all ${
                    isActive
                      ? "bg-white/[0.06] ring-1 ring-white/[0.08]"
                      : "bg-white/[0.02] hover:bg-white/[0.04]"
                  }`}
                >
                  <button
                    onClick={() => { setSelectedSlug(org.slug); onConnectOrganization(org.slug); }}
                    onMouseEnter={() => setSelectedSlug(org.slug)}
                    className="contents"
                  >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.04] overflow-hidden">
                    {logoUrl ? (
                      <img src={logoUrl} alt={org.name} className="h-full w-full object-cover" />
                    ) : (
                      <Building2 size={16} className="text-white/40" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-[14px] font-medium text-white truncate">
                        {org.workspace_name || org.name}
                      </p>
                      {isActive && (
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/10">
                          <Check size={10} className="text-white" />
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-[11px] text-white/30 truncate">{org.offer_name}</p>
                      {org.current_user_role_label && (
                        <span className="text-[10px] text-white/20">{org.current_user_role_label}</span>
                      )}
                    </div>
                    {org.enabled_modules && org.enabled_modules.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {org.enabled_modules.map((m) => (
                          <span key={m} className="rounded-md bg-white/[0.04] px-2 py-0.5 text-[10px] text-white/30">
                            {renderModuleLabel(m)}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    {isActive ? (
                      <span className="text-[10px] text-white/30">
                        {scope.type === "organization" && formatRemainingTime(scope.remaining_minutes)}
                      </span>
                    ) : (
                      <ArrowRight size={14} className="text-white/20" />
                    )}
                  </div>
                  </button>
                  {org.can_delete && (
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onDeleteOrganization(org.slug);
                      }}
                      disabled={loading}
                      className="ml-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-red-500/20 bg-red-500/[0.06] text-red-300/70 hover:bg-red-500/[0.12] hover:text-red-200 disabled:cursor-not-allowed disabled:opacity-50"
                      aria-label={`Supprimer ${org.workspace_name || org.name}`}
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Selected org details (compact) */}
          <div className="border-t border-white/[0.04] px-6 py-4 shrink-0 space-y-4">
            {selectedOrg && (
              <div className="flex items-center justify-between">
                <p className="text-[11px] text-white/30">
                  {selectedOrg.member_count} membre{selectedOrg.member_count > 1 ? "s" : ""}
                </p>
                <p className="text-[11px] text-white/20">
                  {selectedOrg.can_edit_branding ? "Vous pouvez modifier l'identite" : "Identite geree par un admin"}
                </p>
              </div>
            )}

            {canCreateOrganization && (
              <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-3">
                <p className="text-[11px] uppercase tracking-[0.14em] text-white/25">Nouveau workspace</p>
                <div className="mt-3 flex items-center gap-2">
                  <input
                    value={newOrganizationName}
                    onChange={(event) => setNewOrganizationName(event.target.value)}
                    placeholder="Nom de votre espace"
                    className="h-10 flex-1 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 text-[13px] text-white outline-none placeholder:text-white/20 focus:border-white/[0.14]"
                  />
                  <button
                    type="button"
                    disabled={loading || newOrganizationName.trim().length < 2}
                    onClick={() => {
                      const value = newOrganizationName.trim();
                      if (value.length < 2) return;
                      onCreateOrganization(value);
                      setNewOrganizationName("");
                    }}
                    className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#ff7a1a] px-3 text-[12px] font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {loading ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                    Creer
                  </button>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
