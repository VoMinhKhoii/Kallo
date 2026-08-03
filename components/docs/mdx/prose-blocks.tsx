import type { ComponentPropsWithoutRef } from 'react';

/**
 * Code and table primitives for docs MDX.
 *
 * These are product docs, not API docs — there is no syntax highlighting and
 * no copy button, because the only "code" here is literal meal text a reader
 * types into the composer. A hairline card in Geist Mono is the whole idea.
 */

export function DocsInlineCode(props: ComponentPropsWithoutRef<'code'>) {
  return (
    <code
      className="rounded-md border border-nham-border bg-nham-track px-1.5 py-0.5 font-mono text-[13px] text-nham-text"
      {...props}
    />
  );
}

export function DocsPre(props: ComponentPropsWithoutRef<'pre'>) {
  return (
    <pre
      className="mt-6 overflow-x-auto rounded-xl border border-nham-border bg-white p-4 font-mono text-[13px] text-nham-text leading-relaxed [&_code]:border-0 [&_code]:bg-transparent [&_code]:p-0"
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
    <div className="mt-6 overflow-x-auto rounded-xl border border-nham-border">
      <table className="w-full border-collapse text-left" {...props} />
    </div>
  );
}

export function DocsTh(props: ComponentPropsWithoutRef<'th'>) {
  return (
    <th
      className="border-nham-border border-b bg-nham-track px-4 py-3 font-semibold text-[13px] text-nham-text"
      {...props}
    />
  );
}

export function DocsTd(props: ComponentPropsWithoutRef<'td'>) {
  return (
    <td
      className="border-nham-border/60 border-b px-4 py-3 align-top text-[14px] text-nham-text-soft tabular-nums leading-relaxed last:border-0"
      {...props}
    />
  );
}
