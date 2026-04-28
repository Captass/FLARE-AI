"use client";

import { useState } from "react";
import { CheckCircle2, FileUp, FolderOpen, UploadCloud } from "lucide-react";
import { executiveFiles, type ExecutiveFile } from "@/data/executiveDeskMock";
import ExecutiveBenefitBadges from "@/components/pages/ExecutiveBenefitBadges";

function categoryClass(category: string) {
  if (category === "Finance") return "border-blue-500/20 bg-blue-500/10 text-blue-700 dark:text-blue-300";
  if (category === "Personnel") return "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  return "border-orange-500/25 bg-orange-500/10 text-orange-600";
}

function statusClass(status: string) {
  if (status === "Tri appliqué") return "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  return "border-orange-500/25 bg-orange-500/10 text-orange-600 dark:text-orange-300";
}

export default function ExecutiveFilesPage() {
  const [files, setFiles] = useState<ExecutiveFile[]>(executiveFiles);
  const [notice, setNotice] = useState<string | null>(null);

  const applySort = (fileId: string) => {
    setFiles((current) => current.map((file) => (file.id === fileId ? { ...file, status: "Tri appliqué" } : file)));
    setNotice("Tri appliqué en simulation. Aucun fichier local n’a été modifié.");
    window.setTimeout(() => setNotice(null), 3000);
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-6 px-4 py-8 md:px-8 md:py-12">
        <header className="rounded-[28px] border border-[var(--border-default)] bg-[var(--bg-card)] p-6 md:p-8">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-orange-500/20 bg-orange-500/10 px-3 py-1 text-xs font-semibold text-orange-600 dark:text-orange-300">
            <FolderOpen size={14} />
            Démo fichiers
          </div>
          <h1 className="text-3xl font-black tracking-tight text-[var(--text-primary)] md:text-4xl">
            Organisation fichiers
          </h1>
          <p className="mt-3 max-w-3xl text-base leading-relaxed text-[var(--text-secondary)]">
            Importez vos fichiers, FLARE AI propose un tri clair, un nouveau nom et un dossier recommandé.
          </p>
          <p className="mt-4 max-w-3xl text-lg font-semibold leading-relaxed text-[var(--text-primary)]">
            Vos fichiers sont triés, renommés et rangés selon une logique claire.
          </p>
          <div className="mt-5">
            <ExecutiveBenefitBadges items={["Organisation automatique", "Moins d’oublis", "Gain de temps"]} />
          </div>
        </header>

        {notice && (
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
            {notice}
          </div>
        )}

        <section className="rounded-[28px] border border-dashed border-orange-500/35 bg-orange-500/10 p-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-500/12 text-orange-500">
            <UploadCloud size={25} />
          </div>
          <h2 className="mt-4 text-xl font-bold text-[var(--text-primary)]">Zone upload visuelle</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-[var(--text-secondary)]">
            Démo uniquement : aucun fichier n’est envoyé et aucun dossier local n’est modifié.
          </p>
        </section>

        <section className="grid gap-4">
          {files.map((file) => (
            <article key={file.id} className="rounded-[24px] border border-[var(--border-default)] bg-[var(--bg-card)] p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap gap-2">
                    <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${categoryClass(file.recommendedCategory)}`}>
                      {file.recommendedCategory}
                    </span>
                    <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClass(file.status)}`}>
                      {file.status}
                    </span>
                  </div>
                  <h2 className="mt-3 truncate text-xl font-bold text-[var(--text-primary)]">{file.currentName}</h2>
                  <div className="mt-3 grid gap-2 text-sm text-[var(--text-secondary)] md:grid-cols-2">
                    <p>
                      <span className="font-semibold text-[var(--text-primary)]">Dossier recommandé :</span>{" "}
                      {file.recommendedFolder}
                    </p>
                    <p>
                      <span className="font-semibold text-[var(--text-primary)]">Nouveau nom :</span>{" "}
                      {file.suggestedName}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => applySort(file.id)}
                  disabled={file.status === "Tri appliqué"}
                  className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-orange-500 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-orange-600 disabled:cursor-not-allowed disabled:bg-emerald-600"
                >
                  {file.status === "Tri appliqué" ? <CheckCircle2 size={15} /> : <FileUp size={15} />}
                  {file.status === "Tri appliqué" ? "Tri appliqué" : "Appliquer le tri"}
                </button>
              </div>
            </article>
          ))}
        </section>
      </div>
    </div>
  );
}
