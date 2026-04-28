"use client";

import { useEffect } from "react";

export default function EnterpriseDeskRedirectPage() {
  useEffect(() => {
    window.location.replace("/app?view=enterprise-desk");
  }, []);

  return <div className="p-6 text-sm text-[var(--text-secondary)]">Redirection vers Enterprise Desk...</div>;
}
