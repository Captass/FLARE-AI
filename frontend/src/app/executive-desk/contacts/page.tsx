"use client";

import { useEffect } from "react";

export default function ExecutiveContactsRedirectPage() {
  useEffect(() => {
    window.location.replace("/app?view=executive-contacts");
  }, []);

  return <div className="p-6 text-sm text-[var(--text-secondary)]">Redirection vers Contacts intelligents...</div>;
}
