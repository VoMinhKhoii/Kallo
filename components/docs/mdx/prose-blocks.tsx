import type { ComponentPropsWithoutRef } from 'react';

/**
 * Code and table primitives for docs MDX.
 *
 * These are product docs, not API docs — there is no syntax highlighting and
 * no copy button, because the only "code" here is literal meal text a reader
 * types into the composer. A hairline card in Geist Mono is the whole idea.
 *
 * Every block fills with WHITE, not `nham-track`. The docs canvas is
 * `nham-surface` (#f9f9f7) and the track wash is #f5f4f0 — a contrast ratio of
 * 1.04:1, which is invisible. The palette has no neutral fill that separates
 * from this canvas on its own, so separation comes from the hairline plus a
 * white card sitting a step lighter, exactly as product cards do.
 */

export function DocsInlineCode(props: ComponentPropsWithoutRef<'code'>) {
  return (
    <code
      className="rounded-md border border-nham-border bg-white px-1.5 py-0.5 font-mono text-caption text-nham-text"
      {...props}
    />
  );
}

export function DocsPre(props: ComponentPropsWithoutRef<'pre'>) {
  return (
    <pre
      className="mt-6 overflow-x-auto rounded-xl border border-nham-border bg-white p-4 font-mono text-caption text-nham-text leading-relaxed [&_code]:border-0 [&_code]:bg-transparent [&_code]:p-0"
      {...props}
    />
  );
}

/**
 * Wide tables scroll inside their own container so the page body never
 * scrolls horizontally on a phone.
 */
export function DocsTable(props: ComponentPropsWithoutRef<'table'>) {
  return (
    <div className="mt-6 overflow-x-auto rounded-xl border border-nham-border bg-white">
      <table className="w-full border-collapse text-left" {...props} />
    </div>
  );
}

/**
 * The header rule is 2px where body rows get 1px. With no usable fill to set
 * the row apart, weight and rule thickness are what mark it as a header.
 */
export function DocsTh(props: ComponentPropsWithoutRef<'th'>) {
  return (
    <th
      className="border-nham-border border-b-2 px-4 py-3 font-semibold text-caption text-nham-text"
      {...props}
    />
  );
}

/**
 * No `tabular-nums`: most docs tables are prose (sub-processors, purposes,
 * text-vs-photo), and figure alignment is the exception. Pages that genuinely
 * tabulate numbers should ask for it rather than every table paying for it.
 */
export function DocsTd(props: ComponentPropsWithoutRef<'td'>) {
  return (
    <td
      className="border-nham-border/60 border-b px-4 py-3 align-top text-base text-nham-text leading-relaxed last:border-0"
      {...props}
    />
  );
}
