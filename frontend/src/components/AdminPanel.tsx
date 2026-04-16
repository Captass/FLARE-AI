"use client";

import { useState } from "react";
import AdminCostsTab from "@/components/admin/AdminCostsTab";
import AdminConnectedTab from "@/components/admin/AdminConnectedTab";
import AdminAccountsTab from "@/components/admin/AdminAccountsTab";
import AdminActivationsTab from "@/components/admin/AdminActivationsTab";
import AdminPaymentsTab from "@/components/admin/AdminPaymentsTab";
import AdminOrdersTab from "@/components/admin/AdminOrdersTab";
import AdminReportsTab from "@/components/admin/AdminReportsTab";
import AdminOperationsTab from "@/components/admin/AdminOperationsTab";

type AdminTab =
  | "operations"
  | "costs"
  | "connected"
  | "accounts"
  | "activations"
  | "payments"
  | "orders"
  | "reports";

interface AdminPanelProps {
  token?: string | null;
}

export default function AdminPanel({ token }: AdminPanelProps) {
  const [activeTab, setActiveTab] = useState<AdminTab>("operations");

  if (!token) {
    return (
      <div className="flex flex-1 items-center justify-center bg-[rgb(var(--background))]">
        <p className="text-[var(--text-secondary)]">Authentification requise.</p>
      </div>
    );
  }

  const back = () => setActiveTab("operations");

  switch (activeTab) {
    case "operations":
      return <AdminOperationsTab token={token} onNavigate={setActiveTab} />;
    case "costs":
      return <AdminCostsTab token={token} onBack={back} />;
    case "connected":
      return <AdminConnectedTab token={token} onBack={back} />;
    case "accounts":
      return <AdminAccountsTab token={token} onBack={back} />;
    case "activations":
      return <AdminActivationsTab token={token} onBack={back} />;
    case "payments":
      return <AdminPaymentsTab token={token} onBack={back} />;
    case "orders":
      return <AdminOrdersTab token={token} onBack={back} />;
    case "reports":
      return <AdminReportsTab token={token} onBack={back} />;
    default:
      return <AdminOperationsTab token={token} onNavigate={setActiveTab} />;
  }
}
