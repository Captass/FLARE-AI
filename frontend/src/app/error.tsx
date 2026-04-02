"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCcw } from "lucide-react";
import { trackClientEvent } from "@/lib/api";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[FLARE ErrorBoundary]", error.message, error.stack);
    trackClientEvent("app_error_boundary", {
      message: error.message,
      digest: error.digest,
    });
  }, [error]);

  return (
    <div className="min-h-screen bg-[rgb(var(--background))] text-[var(--text-primary)] flex items-center justify-center px-6">
      <div className="surface-floating w-full max-w-lg rounded-[28px] p-8 md:p-10 text-center">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-red-500/20 bg-red-500/10">
          <AlertTriangle size={24} className="text-red-400" />
        </div>
        <h1 className="mb-3 text-2xl font-semibold tracking-tight">Un problème est survenu</h1>
        <p className="mb-4 text-sm leading-relaxed text-[var(--text-muted)] md:text-base">
          L’interface a rencontré une erreur inattendue. Vous pouvez réessayer
          immédiatement sans perdre toute votre session.
        </p>
        {process.env.NODE_ENV !== "production" && (
          <pre className="mb-4 max-h-32 overflow-auto rounded-lg bg-red-500/10 p-3 text-left text-xs text-red-300/80">
            {error.message}
          </pre>
        )}
        <button onClick={reset} className="ui-btn ui-btn-primary mx-auto">
          <RefreshCcw size={16} />
          Réessayer
        </button>
      </div>
    </div>
  );
}
