"use client";

import { useEffect } from "react";

export default function ExecutivePlanningRedirectPage() {
  useEffect(() => {
    window.location.replace("/app?view=executive-planning");
  }, []);

  return <div className="p-6 text-sm text-[var(--text-secondary)]">Redirection vers Planning...</div>;
}
