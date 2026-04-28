"use client";

import { useEffect } from "react";

export default function ExecutiveDeskRedirectPage() {
  useEffect(() => {
    window.location.replace("/app?view=executive-desk");
  }, []);

  return <div className="p-6 text-sm text-[var(--text-secondary)]">Redirection vers Executive Desk...</div>;
}
