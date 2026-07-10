import type { ReactNode } from 'react';

/**
 * Shared scaffolding for the /design-system style guide. Every section is
 * an eyebrow + Lora headline (sentence case, italic-accent second clause)
 * over a run of white specimen cards — the guide dogfoods the system it
 * documents.
 */

export function DsSection({
  id,
  eyebrow,
  title,
  accent,
  intro,
  children,
}: {
  id: string;
  eyebrow: string;
  title: string;
  accent?: string;
  intro?: string;
  children: ReactNode;
}) {
  return (
    <section className="scroll-mt-10" id={id}>
      <p className="eyebrow">{eyebrow}</p>
      <h2 className="mt-2 font-serif text-h2">
        {title}
        {accent ? (
          <>
            {' '}
            <span className="italic-accent">{accent}</span>
          </>
        ) : null}
      </h2>
      {intro ? (
        <p className="mt-3 max-w-2xl text-nham-text-muted text-sm leading-relaxed">
          {intro}
        </p>
      ) : null}
      <div className="mt-6 space-y-4">{children}</div>
    </section>
  );
}

export function DsCard({
  title,
  children,
  className = '',
}: {
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-nham-border/60 bg-white p-card shadow-xs ${className}`}
    >
      {title ? (
        <p className="mb-4 font-medium text-nham-text-muted text-xs">{title}</p>
      ) : null}
      {children}
    </div>
  );
}

export function DsMeta({ children }: { children: ReactNode }) {
  return (
    <p className="font-mono text-2xs text-nham-stone tabular-nums">
      {children}
    </p>
  );
}
