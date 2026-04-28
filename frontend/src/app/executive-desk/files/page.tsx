"use client";

import { useEffect } from "react";

export default function ExecutiveFilesRedirectPage() {
  useEffect(() => {
    window.location.replace("/app?view=executive-files");
  }, []);

  return <div className="p-6 text-sm text-[var(--text-secondary)]">Redirection vers Organisation fichiers...</div>;
}
