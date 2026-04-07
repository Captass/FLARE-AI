"use client";

import { useState, type ReactNode } from "react";
import { ArrowUpRight, ChevronDown, Lock, Sparkles, Trash2 } from "lucide-react";

export function InputField({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  disabled?: boolean;
}) {
  return (
    <label className="space-y-2">
      <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full rounded-2xl border border-[var(--border-default)] bg-[var(--surface-subtle)] px-4 py-3 text-[14px] text-[var(--text-primary)] outline-none transition-colors placeholder:text-[var(--text-placeholder)] focus:border-[var(--accent-orange)] focus:ring-2 focus:ring-[var(--focus-ring)] disabled:cursor-not-allowed disabled:opacity-60"
      />
    </label>
  );
}

export function TextareaField({
  label,
  value,
  onChange,
  placeholder,
  rows = 4,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  disabled?: boolean;
}) {
  return (
    <label className="space-y-2">
      <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">{label}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        rows={rows}
        disabled={disabled}
        className="w-full rounded-2xl border border-[var(--border-default)] bg-[var(--surface-subtle)] px-4 py-3 text-[14px] text-[var(--text-primary)] outline-none transition-colors placeholder:text-[var(--text-placeholder)] focus:border-[var(--accent-orange)] focus:ring-2 focus:ring-[var(--focus-ring)] disabled:cursor-not-allowed disabled:opacity-60"
      />
    </label>
  );
}

export function SelectField({
  label,
  value,
  onChange,
  options,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  disabled?: boolean;
}) {
  return (
    <label className="space-y-2">
      <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">{label}</span>
      <div className="relative">
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
          className="w-full appearance-none rounded-2xl border border-[var(--border-default)] bg-[var(--surface-subtle)] px-4 py-3 text-[14px] text-[var(--text-primary)] outline-none transition-colors focus:border-[var(--accent-orange)] focus:ring-2 focus:ring-[var(--focus-ring)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown
          size={16}
          className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
        />
      </div>
    </label>
  );
}

export function KeywordInput({
  label,
  values,
  onChange,
  placeholder,
  disabled = false,
}: {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
  placeholder: string;
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState("");

  const commitDraft = () => {
    const nextValue = String(draft || "").trim();
    if (!nextValue) return;
    if (values.some((item) => item.toLowerCase() === nextValue.toLowerCase())) {
      setDraft("");
      return;
    }
    onChange([...values, nextValue]);
    setDraft("");
  };

  return (
    <label className="space-y-2">
      <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">{label}</span>
      <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--surface-subtle)] px-3 py-3">
        <div className="mb-3 flex flex-wrap gap-2">
          {values.length === 0 ? (
            <span className="text-[13px] text-[var(--text-placeholder)]">Aucun mot-cle ajoute</span>
          ) : (
            values.map((value) => (
              <span
                key={value}
                className="inline-flex items-center gap-2 rounded-full border border-[var(--border-default)] bg-[var(--surface-raised)] px-3 py-1 text-[12px] text-[var(--text-primary)]"
              >
                {value}
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onChange(values.filter((item) => item !== value))}
                  aria-label={`Retirer ${value}`}
                  className="text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]"
                >
                  <Trash2 size={12} />
                </button>
              </span>
            ))
          )}
        </div>
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== "Enter" && event.key !== ",") return;
            event.preventDefault();
            commitDraft();
          }}
          onBlur={commitDraft}
          placeholder={placeholder}
          disabled={disabled}
          className="w-full bg-transparent text-[14px] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-placeholder)] disabled:cursor-not-allowed disabled:opacity-60"
        />
      </div>
    </label>
  );
}

export function SectionCard({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="border-b border-[var(--divide-default)] pb-10 pt-4 last:border-0 last:pb-0">
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="max-w-[42rem]">
          <h2 className="text-[22px] font-semibold tracking-tight text-[var(--text-primary)]">{title}</h2>
          {description ? <p className="mt-2 text-[15px] leading-relaxed text-[var(--text-secondary)]">{description}</p> : null}
        </div>
        <div>
          {action}
        </div>
      </div>
      <div>
        {children}
      </div>
    </section>
  );
}

export function FeatureLockedPanel({
  title,
  body,
  ctaLabel,
  onRequestUpgrade,
}: {
  title: string;
  body: string;
  ctaLabel: string;
  onRequestUpgrade?: () => void;
}) {
  return (
    <div className="rounded-[28px] border border-[color:color-mix(in_srgb,var(--accent-orange)_24%,transparent)] bg-[color:color-mix(in_srgb,var(--accent-orange)_10%,var(--surface-subtle))] p-6">
      <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-[18px] border border-[color:color-mix(in_srgb,var(--accent-orange)_24%,transparent)] bg-[color:color-mix(in_srgb,var(--accent-orange)_18%,transparent)] text-[var(--accent-orange)]">
        <Lock size={20} />
      </div>
      <h3 className="text-[22px] font-semibold tracking-[-0.03em] text-[var(--text-primary)]">{title}</h3>
      <p className="mt-3 max-w-[36rem] text-[14px] leading-7 text-[var(--text-secondary)]">{body}</p>
      <button
        onClick={onRequestUpgrade}
        type="button"
        className="mt-6 inline-flex items-center gap-2 rounded-full bg-[var(--accent-orange)] px-5 py-3 text-[12px] font-semibold uppercase tracking-[0.12em] text-[#140b02] transition-all hover:brightness-95"
      >
        {ctaLabel}
        <ArrowUpRight size={14} />
      </button>
    </div>
  );
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex min-h-[220px] flex-col items-center justify-center rounded-[28px] border border-dashed border-[var(--border-default)] bg-[var(--surface-subtle)] px-8 py-12 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--surface-raised)]">
        <Sparkles size={22} className="text-[var(--accent-navy)]" />
      </div>
      <h3 className="text-[16px] font-medium text-[var(--text-primary)]">{title}</h3>
      <p className="mt-2 max-w-[26rem] text-[13px] leading-6 text-[var(--text-secondary)]">{body}</p>
    </div>
  );
}
