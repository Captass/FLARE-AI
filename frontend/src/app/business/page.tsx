"use client";

import { useEffect } from "react";

export default function BusinessRedirectPage() {
  useEffect(() => {
    window.location.replace("/app?view=business-desk");
  }, []);

  return <div className="p-6 text-sm text-[var(--text-secondary)]">Redirection vers Business Desk...</div>;
}
