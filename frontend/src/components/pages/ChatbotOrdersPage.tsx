"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ShoppingBag,
  Plus,
  Phone,
  Mail,
  MapPin,
  Package,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Filter,
  Loader2,
  ChevronDown,
  RefreshCcw,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import type { NavLevel } from "@/components/NavBreadcrumb";
import {
  getChatbotOrders,
  updateChatbotOrder,
  createChatbotOrder,
  type ChatbotOrder,
} from "@/lib/api";

/* ────────────────────────────────────────────── Types ── */

interface ChatbotOrdersPageProps {
  token?: string | null;
  getFreshToken?: (forceRefresh?: boolean) => Promise<string | null>;
  onPush: (level: NavLevel) => void;
  selectedPageId?: string | null;
}

type FilterId = "all" | "new" | "confirmed" | "needs_followup" | "delivered" | "cancelled";

/* ────────────────────────────────────────────── Helpers ── */

function formatDate(iso: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60000) return "A l'instant";
  if (diff < 3600000) return `Il y a ${Math.floor(diff / 60000)} min`;
  if (diff < 86400000) return `Il y a ${Math.floor(diff / 3600000)}h`;
  return d.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusLabel(s: string): string {
  const map: Record<string, string> = {
    new: "Nouvelle",
    confirmed: "Confirmee",
    delivered: "Livree",
    cancelled: "Annulee",
    needs_followup: "A suivre",
  };
  return map[s] || s;
}

function statusColor(s: string): string {
  const map: Record<string, string> = {
    new: "border border-navy-500/35 bg-navy-500/18 text-[rgb(220,232,255)]",
    confirmed: "border border-emerald-500/40 bg-emerald-500/20 text-emerald-100",
    delivered: "border border-emerald-500/40 bg-emerald-500/20 text-emerald-100",
    cancelled: "border border-red-500/40 bg-red-500/18 text-red-100",
    needs_followup: "border border-orange-500/45 bg-orange-500/20 text-orange-50",
  };
  return map[s] || "border border-zinc-400/35 bg-zinc-500/20 text-zinc-100";
}

function statusIcon(s: string) {
  switch (s) {
    case "new":
      return <Clock size={14} />;
    case "confirmed":
      return <CheckCircle2 size={14} />;
    case "delivered":
      return <Package size={14} />;
    case "cancelled":
      return <XCircle size={14} />;
    case "needs_followup":
      return <AlertTriangle size={14} />;
    default:
      return <Filter size={14} />;
  }
}

/* ────────────────────────────────────── Filter config ── */

const FILTERS: { id: FilterId; label: string }[] = [
  { id: "all", label: "Toutes" },
  { id: "new", label: "Nouvelles" },
  { id: "confirmed", label: "Confirmees" },
  { id: "needs_followup", label: "A suivre" },
  { id: "delivered", label: "Livrees" },
  { id: "cancelled", label: "Annulees" },
];

const STATUS_ACTIONS: { label: string; value: string }[] = [
  { label: "Confirmer", value: "confirmed" },
  { label: "Livree", value: "delivered" },
  { label: "A suivre", value: "needs_followup" },
  { label: "Annuler", value: "cancelled" },
];

/* ────────────────────────────────────── Skeleton card ── */

function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-2xl border border-fg/[0.08] bg-fg/[0.02] p-5">
      <div className="flex items-center gap-3">
        <div className="h-5 w-20 rounded-full bg-fg/[0.08]" />
        <div className="h-5 w-16 rounded-full bg-fg/[0.08]" />
      </div>
      <div className="mt-3 h-4 w-48 rounded bg-fg/[0.06]" />
      <div className="mt-2 h-4 w-64 rounded bg-fg/[0.06]" />
      <div className="mt-3 flex gap-4">
        <div className="h-4 w-24 rounded bg-fg/[0.06]" />
        <div className="h-4 w-24 rounded bg-fg/[0.06]" />
      </div>
    </div>
  );
}

/* ────────────────────────────────── Main component ── */

export default function ChatbotOrdersPage({
  token,
  getFreshToken,
  onPush,
  selectedPageId,
}: ChatbotOrdersPageProps) {
  const [orders, setOrders] = useState<ChatbotOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterId>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [actionMenuId, setActionMenuId] = useState<string | null>(null);
  const [updatingIds, setUpdatingIds] = useState<Set<string>>(new Set());
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [creating, setCreating] = useState(false);

  /* ── Form state ── */
  const [formContactName, setFormContactName] = useState("");
  const [formContactPhone, setFormContactPhone] = useState("");
  const [formProductSummary, setFormProductSummary] = useState("");
  const [formQuantity, setFormQuantity] = useState("");
  const [formAmount, setFormAmount] = useState("");
  const [formAddress, setFormAddress] = useState("");
  const [formRequest, setFormRequest] = useState("");

  const resolveToken = useCallback(async () => {
    if (getFreshToken) return await getFreshToken();
    return token ?? null;
  }, [getFreshToken, token]);

  /* ── Load orders ── */
  const loadOrders = useCallback(
    async (silent = false) => {
      const t = await resolveToken();
      if (!t) {
        if (!silent) {
          setError("Session expiree. Rechargez la page.");
          setLoading(false);
        }
        return;
      }
      if (!silent) setLoading(true);
      setError(null);
      try {
        const data = await getChatbotOrders(t);
        let list = data.orders || [];
        if (selectedPageId) {
          list = list.filter(
            (o) => !o.facebook_page_id || o.facebook_page_id === selectedPageId,
          );
        }
        setOrders(list);
      } catch {
        if (!silent) setError("Impossible de charger les commandes.");
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [resolveToken, selectedPageId],
  );

  useEffect(() => {
    void loadOrders();
    const interval = setInterval(() => void loadOrders(true), 20000);
    return () => clearInterval(interval);
  }, [loadOrders]);

  /* ── Update order status ── */
  const handleStatusChange = async (orderId: string, newStatus: string) => {
    setActionMenuId(null);
    const t = await resolveToken();
    if (!t) return;
    setUpdatingIds((prev) => new Set(prev).add(orderId));
    try {
      const { order: updated } = await updateChatbotOrder(orderId, { status: newStatus }, t);
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, ...updated } : o)),
      );
    } catch {
      setError("Erreur lors de la mise a jour du statut.");
    } finally {
      setUpdatingIds((prev) => {
        const next = new Set(prev);
        next.delete(orderId);
        return next;
      });
    }
  };

  /* ── Create order ── */
  const handleCreate = async () => {
    if (!formContactName.trim() || !formProductSummary.trim()) return;
    const t = await resolveToken();
    if (!t) return;
    setCreating(true);
    try {
      const { order: created } = await createChatbotOrder(
        {
          contact_name: formContactName.trim(),
          contact_phone: formContactPhone.trim(),
          product_summary: formProductSummary.trim(),
          quantity_text: formQuantity.trim(),
          amount_text: formAmount.trim(),
          delivery_address: formAddress.trim(),
          customer_request_text: formRequest.trim(),
          source: "manual",
          status: "new",
          facebook_page_id: selectedPageId || null,
        },
        t,
      );
      setOrders((prev) => [created, ...prev]);
      resetForm();
      setShowCreateForm(false);
    } catch {
      setError("Erreur lors de la creation de la commande.");
    } finally {
      setCreating(false);
    }
  };

  const resetForm = () => {
    setFormContactName("");
    setFormContactPhone("");
    setFormProductSummary("");
    setFormQuantity("");
    setFormAmount("");
    setFormAddress("");
    setFormRequest("");
  };

  /* ── Filtered list ── */
  const filteredOrders = filter === "all" ? orders : orders.filter((o) => o.status === filter);

  /* ── Close menus on outside click ── */
  useEffect(() => {
    if (!actionMenuId) return;
    const handler = () => setActionMenuId(null);
    window.addEventListener("click", handler);
    return () => window.removeEventListener("click", handler);
  }, [actionMenuId]);

  /* ─────────────────────────────────────────── Render ── */

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-6 px-4 py-8 md:px-8">
        {/* ── Header ── */}
        <motion.header
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"
        >
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <ShoppingBag size={28} className="text-orange-400" />
              <h1 className="text-3xl font-bold tracking-tight text-fg/90">Commandes</h1>
            </div>
            <p className="text-lg text-[var(--text-muted)]">
              Commandes captees par votre chatbot via Messenger
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void loadOrders()}
              className="flex items-center gap-2 rounded-xl border border-fg/[0.12] bg-fg/[0.04] px-4 py-2 text-sm font-medium text-fg/70 transition-colors hover:bg-fg/[0.08]"
            >
              <RefreshCcw size={15} />
              Actualiser
            </button>
            <button
              type="button"
              onClick={() => setShowCreateForm((v) => !v)}
              className="flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-[#140b02] transition-colors hover:bg-orange-400"
            >
              <Plus size={15} />
              Ajouter manuellement
            </button>
          </div>
        </motion.header>

        {/* ── Error ── */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                {error}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Manual creation form ── */}
        <AnimatePresence>
          {showCreateForm && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="rounded-2xl border border-fg/[0.08] bg-fg/[0.02] p-5 shadow-[var(--shadow-card)] backdrop-blur-md">
                <h3 className="mb-4 text-lg font-semibold text-fg/80">
                  Nouvelle commande manuelle
                </h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium uppercase tracking-wide text-fg/40">
                      Nom du contact <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={formContactName}
                      onChange={(e) => setFormContactName(e.target.value)}
                      placeholder="Ex: Jean Dupont"
                      className="rounded-lg border border-fg/[0.08] bg-fg/[0.03] px-3 py-2 text-sm text-fg/80 placeholder:text-fg/30 focus:border-orange-500/50 focus:outline-none"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium uppercase tracking-wide text-fg/40">
                      Telephone
                    </label>
                    <input
                      type="text"
                      value={formContactPhone}
                      onChange={(e) => setFormContactPhone(e.target.value)}
                      placeholder="Ex: +33 6 12 34 56 78"
                      className="rounded-lg border border-fg/[0.08] bg-fg/[0.03] px-3 py-2 text-sm text-fg/80 placeholder:text-fg/30 focus:border-orange-500/50 focus:outline-none"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5 sm:col-span-2">
                    <label className="text-xs font-medium uppercase tracking-wide text-fg/40">
                      Produit / service <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={formProductSummary}
                      onChange={(e) => setFormProductSummary(e.target.value)}
                      placeholder="Ex: 2x T-shirt noir taille M"
                      className="rounded-lg border border-fg/[0.08] bg-fg/[0.03] px-3 py-2 text-sm text-fg/80 placeholder:text-fg/30 focus:border-orange-500/50 focus:outline-none"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium uppercase tracking-wide text-fg/40">
                      Quantite
                    </label>
                    <input
                      type="text"
                      value={formQuantity}
                      onChange={(e) => setFormQuantity(e.target.value)}
                      placeholder="Ex: 2"
                      className="rounded-lg border border-fg/[0.08] bg-fg/[0.03] px-3 py-2 text-sm text-fg/80 placeholder:text-fg/30 focus:border-orange-500/50 focus:outline-none"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium uppercase tracking-wide text-fg/40">
                      Montant
                    </label>
                    <input
                      type="text"
                      value={formAmount}
                      onChange={(e) => setFormAmount(e.target.value)}
                      placeholder="Ex: 49.90 EUR"
                      className="rounded-lg border border-fg/[0.08] bg-fg/[0.03] px-3 py-2 text-sm text-fg/80 placeholder:text-fg/30 focus:border-orange-500/50 focus:outline-none"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5 sm:col-span-2">
                    <label className="text-xs font-medium uppercase tracking-wide text-fg/40">
                      Adresse de livraison
                    </label>
                    <input
                      type="text"
                      value={formAddress}
                      onChange={(e) => setFormAddress(e.target.value)}
                      placeholder="Ex: 12 rue de la Paix, 75002 Paris"
                      className="rounded-lg border border-fg/[0.08] bg-fg/[0.03] px-3 py-2 text-sm text-fg/80 placeholder:text-fg/30 focus:border-orange-500/50 focus:outline-none"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5 sm:col-span-2">
                    <label className="text-xs font-medium uppercase tracking-wide text-fg/40">
                      Notes / demande du client
                    </label>
                    <textarea
                      value={formRequest}
                      onChange={(e) => setFormRequest(e.target.value)}
                      rows={2}
                      placeholder="Ex: Livraison avant vendredi si possible"
                      className="rounded-lg border border-fg/[0.08] bg-fg/[0.03] px-3 py-2 text-sm text-fg/80 placeholder:text-fg/30 focus:border-orange-500/50 focus:outline-none"
                    />
                  </div>
                </div>
                <div className="mt-5 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateForm(false);
                      resetForm();
                    }}
                    className="rounded-lg px-4 py-2 text-sm font-medium text-fg/50 transition-colors hover:text-fg/70"
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    disabled={creating || !formContactName.trim() || !formProductSummary.trim()}
                    onClick={() => void handleCreate()}
                    className="flex items-center gap-2 rounded-lg bg-orange-500 px-5 py-2 text-sm font-semibold text-[#140b02] transition-colors hover:bg-orange-400 disabled:opacity-40"
                  >
                    {creating && <Loader2 size={14} className="animate-spin" />}
                    Creer la commande
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Filter bar ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.05, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-wrap items-center gap-2"
        >
          {FILTERS.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setFilter(id)}
              className={`rounded-full px-4 py-1.5 text-sm transition-colors ${
                filter === id
                  ? "bg-orange-500 font-semibold text-[#140b02]"
                  : "bg-fg/[0.05] text-fg/50 hover:bg-fg/[0.08]"
              }`}
            >
              {label}
            </button>
          ))}
        </motion.div>

        {/* ── Loading state ── */}
        {loading && (
          <div className="flex flex-col gap-4">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        )}

        {/* ── Empty state ── */}
        {!loading && filteredOrders.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col items-center justify-center rounded-2xl border border-fg/[0.08] bg-fg/[0.02] px-6 py-20 text-center shadow-[var(--shadow-card)] backdrop-blur-md"
          >
            <ShoppingBag size={56} className="mb-4 text-fg/15" />
            <p className="text-lg font-semibold text-fg/50">
              Aucune commande pour le moment
            </p>
            <p className="mt-1 max-w-sm text-sm text-fg/30">
              Les commandes detectees par votre chatbot apparaitront ici.
            </p>
          </motion.div>
        )}

        {/* ── Orders list ── */}
        {!loading && filteredOrders.length > 0 && (
          <div className="flex flex-col gap-4">
            {filteredOrders.map((order, idx) => {
              const isExpanded = expandedId === order.id;
              const isUpdating = updatingIds.has(order.id);

              return (
                <motion.div
                  key={order.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.3,
                    delay: Math.min(idx * 0.04, 0.3),
                    ease: [0.16, 1, 0.3, 1],
                  }}
                  className="rounded-2xl border border-fg/[0.08] bg-fg/[0.02] shadow-[var(--shadow-card)] backdrop-blur-md transition-colors hover:bg-fg/[0.03]"
                >
                  {/* ── Card header ── */}
                  <div className="flex flex-col gap-3 p-5">
                    {/* Badges row */}
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${statusColor(order.status)}`}
                      >
                        {statusIcon(order.status)}
                        {statusLabel(order.status)}
                      </span>
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
                          order.source === "signal"
                            ? "border border-navy-500/35 bg-navy-500/18 text-[rgb(220,232,255)]"
                            : "border border-zinc-500/35 bg-zinc-500/18 text-zinc-100"
                        }`}
                      >
                        {order.source === "signal" ? "Signal IA" : "Manuel"}
                      </span>
                      {order.source === "signal" && order.confidence > 0 && (
                        <span className="text-xs text-fg/40">
                          Confiance : {Math.round(order.confidence * 100)}%
                        </span>
                      )}
                      <span className="ml-auto text-xs text-fg/30">
                        {formatDate(order.created_at)}
                      </span>
                    </div>

                    {/* Contact + product */}
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-fg/90">{order.contact_name || "Inconnu"}</p>
                        {order.contact_phone && (
                          <span className="flex items-center gap-1 text-xs text-fg/40">
                            <Phone size={12} />
                            {order.contact_phone}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-fg/70">{order.product_summary}</p>
                    </div>

                    {/* Quantity & amount */}
                    <div className="flex flex-wrap items-center gap-4 text-sm">
                      {order.quantity_text && (
                        <span className="flex items-center gap-1.5 text-fg/50">
                          <Package size={14} className="text-fg/30" />
                          {order.quantity_text}
                        </span>
                      )}
                      {order.amount_text && (
                        <span className="font-medium text-fg/70">{order.amount_text}</span>
                      )}
                      {order.delivery_address && (
                        <span className="flex items-center gap-1.5 text-fg/50">
                          <MapPin size={14} className="text-fg/30" />
                          <span className="max-w-[220px] truncate">{order.delivery_address}</span>
                        </span>
                      )}
                    </div>

                    {/* Actions row */}
                    <div className="flex items-center justify-between border-t border-fg/[0.06] pt-3">
                      <button
                        type="button"
                        onClick={() => setExpandedId(isExpanded ? null : order.id)}
                        className="flex items-center gap-1.5 text-xs font-medium text-fg/40 transition-colors hover:text-fg/60"
                      >
                        <ChevronDown
                          size={14}
                          className={`transition-transform ${isExpanded ? "rotate-180" : ""}`}
                        />
                        {isExpanded ? "Reduire" : "Voir plus"}
                      </button>

                      <div className="relative">
                        <button
                          type="button"
                          disabled={isUpdating}
                          onClick={(e) => {
                            e.stopPropagation();
                            setActionMenuId(actionMenuId === order.id ? null : order.id);
                          }}
                          className="flex items-center gap-2 rounded-lg border border-fg/[0.08] bg-fg/[0.03] px-3 py-1.5 text-xs font-medium text-fg/50 transition-colors hover:bg-fg/[0.06]"
                        >
                          {isUpdating ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : (
                            "Action"
                          )}
                          <ChevronDown size={12} />
                        </button>

                        <AnimatePresence>
                          {actionMenuId === order.id && (
                            <motion.div
                              initial={{ opacity: 0, scale: 0.95, y: -4 }}
                              animate={{ opacity: 1, scale: 1, y: 0 }}
                              exit={{ opacity: 0, scale: 0.95, y: -4 }}
                              transition={{ duration: 0.12 }}
                              className="absolute right-0 top-full z-20 mt-1 min-w-[160px] overflow-hidden rounded-xl border border-fg/[0.1] bg-[var(--bg-primary)] shadow-xl backdrop-blur-xl"
                            >
                              {STATUS_ACTIONS.filter((a) => a.value !== order.status).map(
                                (action) => (
                                  <button
                                    key={action.value}
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      void handleStatusChange(order.id, action.value);
                                    }}
                                    className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-fg/70 transition-colors hover:bg-fg/[0.05]"
                                  >
                                    {statusIcon(action.value)}
                                    {action.label}
                                  </button>
                                ),
                              )}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                  </div>

                  {/* ── Expanded details ── */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="border-t border-fg/[0.06] px-5 py-4">
                          <div className="grid gap-3 text-sm sm:grid-cols-2">
                            {order.contact_email && (
                              <div className="flex items-center gap-2 text-fg/50">
                                <Mail size={14} className="text-fg/30" />
                                {order.contact_email}
                              </div>
                            )}
                            {order.contact_phone && (
                              <div className="flex items-center gap-2 text-fg/50">
                                <Phone size={14} className="text-fg/30" />
                                {order.contact_phone}
                              </div>
                            )}
                            {order.delivery_address && (
                              <div className="flex items-start gap-2 text-fg/50 sm:col-span-2">
                                <MapPin size={14} className="mt-0.5 shrink-0 text-fg/30" />
                                {order.delivery_address}
                              </div>
                            )}
                            {order.customer_request_text && (
                              <div className="rounded-lg bg-fg/[0.03] px-3 py-2 text-fg/60 sm:col-span-2">
                                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-fg/30">
                                  Demande du client
                                </p>
                                {order.customer_request_text}
                              </div>
                            )}
                            {order.needs_human_followup && (
                              <div className="flex items-center gap-2 text-orange-100 sm:col-span-2">
                                <AlertTriangle size={14} />
                                <span className="text-xs font-medium">
                                  Suivi humain requis
                                </span>
                              </div>
                            )}
                            <div className="flex flex-wrap gap-4 text-xs text-fg/30 sm:col-span-2">
                              {order.page_name && (
                                <span>Page : {order.page_name}</span>
                              )}
                              {order.assigned_to && (
                                <span>Assigne a : {order.assigned_to}</span>
                              )}
                              {order.updated_at && (
                                <span>Mis a jour : {formatDate(order.updated_at)}</span>
                              )}
                              <span>ID : {order.id}</span>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
