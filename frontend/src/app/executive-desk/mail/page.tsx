"use client";

import { useEffect } from "react";

export default function ExecutiveMailRedirectPage() {
  useEffect(() => {
    window.location.replace("/app?view=executive-mail");
  }, []);

  return <div className="p-6 text-sm text-[var(--text-secondary)]">Redirection vers Assistant Mail...</div>;
}
