"use client";

/**
 * AdminPanel — Orchestrateur léger (~60 lignes)
 *
 * Ce fichier gère uniquement la navigation entre les onglets admin.
 * Toute la logique de chaque onglet est dans src/components/admin/
 */

import { useEffect, useState } from "react";
import {
  getAdminUsageSummary, getAdminConnectedUsers, getAdminNewAccounts,
} from "@/lib/api";

import AdminMenu from "@/components/admin/AdminMenu";
import AdminCostsTab from "@/components/admin/AdminCostsTab";
import AdminConnectedTab from "@/components/admin/AdminConnectedTab";
import AdminAccountsTab from "@/components/admin/AdminAccountsTab";
import AdminActivationsTab from "@/components/admin/AdminActivationsTab";
import AdminPaymentsTab from "@/components/admin/AdminPaymentsTab";
import AdminOrdersTab from "@/components/admin/AdminOrdersTab";
import AdminReportsTab from "@/components/admin/AdminReportsTab";

type AdminTab = "menu" | "costs" | "connected" | "accounts" | "activations" | "payments" | "orders" | "reports";

interface AdminPanelProps {
  token?: string | null;
}

export default function AdminPanel({ token }: AdminPanelProps) {
  const [activeTab, setActiveTab] = useState<AdminTab>("menu");
  const [menuStats, setMenuStats] = useState({ totalUsers: 0, onlineCount: 0, newToday: 0, totalCost: 0 });

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const [summary, connected, accounts] = await Promise.all([
          getAdminUsageSummary(token, 0).catch(() => null),
          getAdminConnectedUsers(token).catch(() => null),
          getAdminNewAccounts(token, 1).catch(() => null),
        ]);
        setMenuStats({
          totalUsers: summary?.total_users ?? 0,
          onlineCount: connected?.online_count ?? 0,
          newToday: accounts?.new_today ?? 0,
          totalCost: summary?.total_cost ?? 0,
        });
      } catch { /* silencieux */ }
    })();
  }, [token]);

  if (!token) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[rgb(var(--background))]">
        <p className="text-[var(--text-secondary)]">Authentification requise.</p>
      </div>
    );
  }

  const back = () => setActiveTab("menu");

  switch (activeTab) {
    case "costs":        return <AdminCostsTab       token={token} onBack={back} />;
    case "connected":    return <AdminConnectedTab   token={token} onBack={back} />;
    case "accounts":     return <AdminAccountsTab    token={token} onBack={back} />;
    case "activations":  return <AdminActivationsTab token={token} onBack={back} />;
    case "payments":     return <AdminPaymentsTab    token={token} onBack={back} />;
    case "orders":       return <AdminOrdersTab      token={token} onBack={back} />;
    case "reports":      return <AdminReportsTab     token={token} onBack={back} />;
    default:             return <AdminMenu           onNavigate={setActiveTab} stats={menuStats} />;
  }
}
