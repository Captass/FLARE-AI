"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, CreditCard, Rocket, ShoppingBag, ShieldCheck, Users, Wifi } from "lucide-react";
import {
  getAdminActivations,
  getAdminConnectedUsers,
  getAdminNewAccounts,
  getAdminOrders,
  getAdminPayments,
  getAdminReports,
  getAdminUsageSummary,
  type ActivationRequest,
  type AdminPaymentRecord,
  type ChatbotOrder,
  type UserReport,
} from "@/lib/api";
import AdminShell from "./AdminShell";

type OperationsTab =
  | "activations"
  | "payments"
  | "orders"
  | "reports"
  | "costs"
  | "connected"
  | "accounts";

type Dossier = {
  key: string;
  title: string;
  subtitle: string;
  activation?: ActivationRequest;
  payment?: AdminPaymentRecord;
  reports: UserReport[];
  orders: ChatbotOrder[];
};

function statusChip(label: string, tone: "orange" | "navy" | "red" | "neutral" = "neutral") {
  const className =
    tone === "orange"
      ? "bg-orange-500/10 text-orange-500"
      : tone === "navy"
      ? "bg-[var(--accent-navy)]/8 text-[var(--accent-navy)]"
      : tone === "red"
      ? "bg-red-500/10 text-red-500"
      : "bg-[var(--surface-subtle)] text-[var(--text-secondary)]";

  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${className}`}>
      {label}
    </span>
  );
}

function describeActivation(ar?: ActivationRequest): string | null {
  if (!ar) return null;
  const map: Record<string, string> = {
    payment_submitted: "Preuve soumise",
    awaiting_flare_page_admin_access: "Attente acces page",
    queued_for_activation: "Pret a activer",
    activation_in_progress: "Activation en cours",
    testing: "Test Messenger",
    active: "Chatbot actif",
    blocked: "Bloque",
    rejected: "Refuse",
  };
  return map[ar.status] ?? ar.status;
}

function describePayment(pay?: AdminPaymentRecord): string | null {
  if (!pay) return null;
  const map: Record<string, string> = {
    submitted: "Paiement a verifier",
    verified: "Paiement verifie",
    rejected: "Paiement refuse",
  };
  return map[pay.status] ?? pay.status;
}

function buildDossiers(
  activations: ActivationRequest[],
  payments: AdminPaymentRecord[],
  reports: UserReport[],
  orders: ChatbotOrder[],
): Dossier[] {
  const byKey = new Map<string, Dossier>();
  const userToKey = new Map<string, string>();

  const ensure = (key: string, seed?: Partial<Dossier>) => {
    if (!byKey.has(key)) {
      byKey.set(key, {
        key,
        title: seed?.title || "Client",
        subtitle: seed?.subtitle || "",
        activation: seed?.activation,
        payment: seed?.payment,
        reports: seed?.reports || [],
        orders: seed?.orders || [],
      });
    }
    const dossier = byKey.get(key)!;
    if (seed?.title && dossier.title === "Client") dossier.title = seed.title;
    if (seed?.subtitle && !dossier.subtitle) dossier.subtitle = seed.subtitle;
    return dossier;
  };

  for (const activation of activations) {
    const key = `activation:${activation.id}`;
    const title = activation.business_name || activation.contact_full_name || activation.contact_email || "Client";
    const subtitle =
      activation.contact_email ||
      activation.contact_phone ||
      activation.contact_whatsapp ||
      activation.user_id ||
      "";
    ensure(key, { title, subtitle, activation });
    if (activation.user_id) userToKey.set(activation.user_id, key);
  }

  for (const payment of payments) {
    const key =
      (payment.activation_request_id && `activation:${payment.activation_request_id}`) ||
      (payment.user_id && userToKey.get(payment.user_id)) ||
      (payment.user_id && `user:${payment.user_id}`) ||
      `payment:${payment.id}`;
    const title =
      payment.activation_summary?.business_name as string ||
      payment.payer_full_name ||
      "Paiement client";
    const subtitle =
      (payment.activation_summary?.contact_email as string) ||
      payment.payer_phone ||
      payment.user_id ||
      "";
    const dossier = ensure(key, { title, subtitle });
    dossier.payment = payment;
    if (payment.user_id && !userToKey.has(payment.user_id)) userToKey.set(payment.user_id, key);
  }

  for (const report of reports) {
    const userId = report.user_id || report.reporter_user_id || "";
    const key = (userId && userToKey.get(userId)) || (userId && `user:${userId}`) || `report:${report.id}`;
    const dossier = ensure(key, {
      title: report.user_email || "Signalement client",
      subtitle: report.page_context || report.category || "",
    });
    dossier.reports.push(report);
    if (userId && !userToKey.has(userId)) userToKey.set(userId, key);
  }

  for (const order of orders) {
    const userId = order.user_id || "";
    const key = (userId && userToKey.get(userId)) || (userId && `user:${userId}`) || `order:${order.id}`;
    const dossier = ensure(key, {
      title: order.contact_name || "Commande",
      subtitle: order.contact_phone || order.contact_email || order.page_name || "",
    });
    dossier.orders.push(order);
    if (userId && !userToKey.has(userId)) userToKey.set(userId, key);
  }

  const priority = (dossier: Dossier) => {
    if (dossier.payment?.status === "submitted") return 0;
    if (dossier.activation?.status === "blocked") return 1;
    if (dossier.reports.some((report) => report.status === "new")) return 2;
    if (["queued_for_activation", "activation_in_progress", "testing"].includes(dossier.activation?.status || "")) return 3;
    if (dossier.orders.some((order) => ["new", "needs_followup"].includes(order.status))) return 4;
    return 5;
  };

  return Array.from(byKey.values()).sort((left, right) => {
    const p = priority(left) - priority(right);
    if (p !== 0) return p;
    const leftDate = left.payment?.submitted_at || left.activation?.updated_at || left.reports[0]?.created_at || left.orders[0]?.created_at || "";
    const rightDate = right.payment?.submitted_at || right.activation?.updated_at || right.reports[0]?.created_at || right.orders[0]?.created_at || "";
    return String(rightDate).localeCompare(String(leftDate));
  });
}

export default function AdminOperationsTab({
  token,
  onNavigate,
}: {
  token: string;
  onNavigate: (tab: OperationsTab) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activations, setActivations] = useState<ActivationRequest[]>([]);
  const [payments, setPayments] = useState<AdminPaymentRecord[]>([]);
  const [reports, setReports] = useState<UserReport[]>([]);
  const [orders, setOrders] = useState<ChatbotOrder[]>([]);
  const [summary, setSummary] = useState({ totalUsers: 0, totalCost: 0, onlineCount: 0, newToday: 0 });

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const [activationRes, paymentRes, orderRes, reportRes, usageRes, connectedRes, accountRes] = await Promise.allSettled([
      getAdminActivations(token),
      getAdminPayments(token),
      getAdminOrders(token),
      getAdminReports(token),
      getAdminUsageSummary(token, 0),
      getAdminConnectedUsers(token),
      getAdminNewAccounts(token, 1),
    ]);

    const failedDatasets: string[] = [];

    if (activationRes.status === "fulfilled") setActivations(activationRes.value.activations ?? []);
    else failedDatasets.push("activations");
    if (paymentRes.status === "fulfilled") setPayments(paymentRes.value.payments ?? []);
    else failedDatasets.push("paiements");
    if (orderRes.status === "fulfilled") setOrders(orderRes.value.orders ?? []);
    else failedDatasets.push("commandes");
    if (reportRes.status === "fulfilled") setReports(reportRes.value.reports ?? []);
    else failedDatasets.push("signalements");
    if (usageRes.status !== "fulfilled") failedDatasets.push("stats usage");
    if (connectedRes.status !== "fulfilled") failedDatasets.push("utilisateurs connectes");
    if (accountRes.status !== "fulfilled") failedDatasets.push("nouveaux comptes");
    setSummary((previous) => ({
      totalUsers: usageRes.status === "fulfilled" ? usageRes.value.total_users ?? 0 : previous.totalUsers,
      totalCost: usageRes.status === "fulfilled" ? usageRes.value.total_cost ?? 0 : previous.totalCost,
      onlineCount: connectedRes.status === "fulfilled" ? connectedRes.value.online_count ?? 0 : previous.onlineCount,
      newToday: accountRes.status === "fulfilled" ? accountRes.value.new_today ?? 0 : previous.newToday,
    }));
    if (failedDatasets.length > 0) {
      setLoadError(`Certaines donnees admin n'ont pas pu etre chargees: ${failedDatasets.join(", ")}.`);
    }
    setLoading(false);
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const dossiers = useMemo(
    () => buildDossiers(activations, payments, reports, orders).slice(0, 8),
    [activations, payments, reports, orders],
  );

  const urgentCounts = {
    payments: payments.filter((payment) => payment.status === "submitted").length,
    activations: activations.filter((activation) => ["queued_for_activation", "activation_in_progress", "testing", "blocked"].includes(activation.status)).length,
    reports: reports.filter((report) => report.status === "new").length,
    orders: orders.filter((order) => ["new", "needs_followup"].includes(order.status)).length,
  };
  const hasCriticalLoadIssue =
    Boolean(loadError) &&
    (loadError?.includes("activations") || loadError?.includes("paiements"));

  return (
    <AdminShell
      title="Operations aujourd'hui"
      description="Validez les paiements, appliquez les plans et reprenez les activations depuis un meme hub."
      icon={ShieldCheck}
      iconBg="border-orange-500/20 bg-orange-500/10"
      onRefresh={() => void load()}
      loading={loading}
    >
      {loadError && (
        <div className="mb-4 rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-[var(--text-primary)]">
          {loadError}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: "Paiements a verifier", value: urgentCounts.payments, icon: CreditCard, action: () => onNavigate("payments") },
          { label: "Activations a reprendre", value: urgentCounts.activations, icon: Rocket, action: () => onNavigate("activations") },
          { label: "Signalements ouverts", value: urgentCounts.reports, icon: AlertCircle, action: () => onNavigate("reports") },
          { label: "Commandes a suivre", value: urgentCounts.orders, icon: ShoppingBag, action: () => onNavigate("orders") },
        ].map((item) => (
          <button
            key={item.label}
            type="button"
            onClick={item.action}
            className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-5 text-left transition-colors hover:bg-[var(--surface-subtle)]"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-[0.08em] text-[var(--text-secondary)]">{item.label}</span>
              <item.icon size={16} className="text-orange-500" />
            </div>
            <p className="mt-3 text-3xl font-black tracking-tight text-[var(--text-primary)]">{item.value}</p>
          </button>
        ))}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1.7fr)_minmax(320px,0.9fr)]">
        <section className="rounded-3xl border border-[var(--border-default)] bg-[var(--bg-card)] p-5">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.12em] text-[var(--text-secondary)]">Dossiers clients</p>
              <h2 className="mt-1 text-xl font-bold text-[var(--text-primary)]">Contextes reunis par client</h2>
            </div>
            <button
              type="button"
              onClick={() => onNavigate("activations")}
              className="rounded-xl border border-[var(--border-default)] px-3 py-2 text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--surface-subtle)]"
            >
              Ouvrir la file activations
            </button>
          </div>

          <div className="space-y-3">
            {dossiers.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[var(--border-default)] px-4 py-8 text-sm text-[var(--text-secondary)]">
                {hasCriticalLoadIssue
                  ? "Chargement incomplet des paiements/activations. Rafraichissez avant de conclure qu'il n'y a aucun dossier."
                  : "Aucun dossier a afficher."}
              </div>
            ) : (
              dossiers.map((dossier) => (
                <div key={dossier.key} className="rounded-2xl border border-[var(--border-default)] bg-[var(--surface-subtle)] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[var(--text-primary)]">{dossier.title}</p>
                      <p className="mt-1 text-xs text-[var(--text-secondary)]">{dossier.subtitle || "Sans contact explicite"}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {dossier.payment && statusChip(describePayment(dossier.payment) || "Paiement", dossier.payment.status === "submitted" ? "orange" : dossier.payment.status === "verified" ? "navy" : "red")}
                      {dossier.activation && statusChip(describeActivation(dossier.activation) || "Activation", dossier.activation.status === "blocked" ? "red" : ["queued_for_activation", "activation_in_progress", "testing"].includes(dossier.activation.status) ? "orange" : "navy")}
                      {dossier.payment?.selected_plan_id && statusChip(`Demande: ${dossier.payment.selected_plan_id}`)}
                      {dossier.payment?.applied_plan_id && statusChip(`Applique: ${dossier.payment.applied_plan_id}`, dossier.payment.applied_plan_id === dossier.payment.selected_plan_id ? "navy" : "red")}
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-[var(--text-secondary)]">
                    {dossier.reports.length > 0 && <span>{dossier.reports.length} signalement(s)</span>}
                    {dossier.orders.length > 0 && <span>{dossier.orders.length} commande(s)</span>}
                    {dossier.activation?.assigned_operator_email && <span>Assigne: {dossier.activation.assigned_operator_email}</span>}
                    {dossier.payment?.subscription_status && <span>Abonnement: {dossier.payment.subscription_status}</span>}
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {dossier.payment?.status === "submitted" && (
                      <button
                        type="button"
                        onClick={() => onNavigate("payments")}
                        className="rounded-xl bg-orange-500 px-3 py-2 text-xs font-semibold text-white hover:bg-orange-600"
                      >
                        Verifier le paiement
                      </button>
                    )}
                    {dossier.activation && (
                      <button
                        type="button"
                        onClick={() => onNavigate("activations")}
                        className="rounded-xl border border-[var(--border-default)] px-3 py-2 text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--surface-raised)]"
                      >
                        Reprendre l&apos;activation
                      </button>
                    )}
                    {dossier.reports.length > 0 && (
                      <button
                        type="button"
                        onClick={() => onNavigate("reports")}
                        className="rounded-xl border border-[var(--border-default)] px-3 py-2 text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--surface-raised)]"
                      >
                        Voir les signalements
                      </button>
                    )}
                    {dossier.orders.length > 0 && (
                      <button
                        type="button"
                        onClick={() => onNavigate("orders")}
                        className="rounded-xl border border-[var(--border-default)] px-3 py-2 text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--surface-raised)]"
                      >
                        Suivre les commandes
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <div className="space-y-6">
          <section className="rounded-3xl border border-[var(--border-default)] bg-[var(--bg-card)] p-5">
            <p className="text-[11px] uppercase tracking-[0.12em] text-[var(--text-secondary)]">Pilotage</p>
            <h2 className="mt-1 text-xl font-bold text-[var(--text-primary)]">Metriques de fond</h2>
            <div className="mt-4 space-y-3">
              <div className="rounded-2xl bg-[var(--surface-subtle)] p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[var(--text-secondary)]">Utilisateurs</span>
                  <Users size={15} className="text-[var(--accent-navy)]" />
                </div>
                <p className="mt-2 text-2xl font-black text-[var(--text-primary)]">{summary.totalUsers}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-[var(--surface-subtle)] p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[var(--text-secondary)]">En ligne</span>
                    <Wifi size={15} className="text-[var(--accent-navy)]" />
                  </div>
                  <p className="mt-2 text-xl font-black text-[var(--text-primary)]">{summary.onlineCount}</p>
                </div>
                <div className="rounded-2xl bg-[var(--surface-subtle)] p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[var(--text-secondary)]">Nouveaux</span>
                    <Users size={15} className="text-orange-500" />
                  </div>
                  <p className="mt-2 text-xl font-black text-[var(--text-primary)]">{summary.newToday}</p>
                </div>
              </div>
              <div className="rounded-2xl bg-[var(--surface-subtle)] p-4">
                <p className="text-xs text-[var(--text-secondary)]">Cout total observe</p>
                <p className="mt-2 text-xl font-black text-[var(--text-primary)]">${summary.totalCost.toFixed(2)}</p>
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-[var(--border-default)] bg-[var(--bg-card)] p-5">
            <p className="text-[11px] uppercase tracking-[0.12em] text-[var(--text-secondary)]">Raccourcis</p>
            <div className="mt-4 grid gap-2">
              {[
                { label: "Comptes", tab: "accounts" as OperationsTab },
                { label: "Utilisateurs connectes", tab: "connected" as OperationsTab },
                { label: "Couts IA", tab: "costs" as OperationsTab },
              ].map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => onNavigate(item.tab)}
                  className="rounded-2xl border border-[var(--border-default)] px-4 py-3 text-left text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--surface-subtle)]"
                >
                  {item.label}
                </button>
              ))}
            </div>
          </section>
        </div>
      </div>
    </AdminShell>
  );
}
