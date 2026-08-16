import type { ComponentPropsWithoutRef } from 'react';
import { cn } from '@/lib/utils';

/**
 * Code and table primitives for docs MDX.
 *
 * These are product docs, not API docs — there is no syntax highlighting and
 * no copy button, because the only "code" here is literal meal text a reader
 * types into the composer. A hairline card in Geist Mono is the whole idea.
 *
 * Every block fills with WHITE, not `kallo-track`. The docs canvas is
 * `kallo-surface` (#fcfcfc) and the track wash is #f5f4f0 — a contrast ratio of
 * 1.04:1, which is invisible. The palette has no neutral fill that separates
 * from this canvas on its own, so separation comes from the hairline plus a
 * white card sitting a step lighter, exactly as product cards do.
 */

export function DocsInlineCode({
  className,
  ...props
}: ComponentPropsWithoutRef<'code'>) {
  return (
    <code
      className={cn(
        'rounded-md border border-kallo-border bg-white px-1.5 py-0.5 font-mono text-caption text-kallo-text',
        className
      )}
      {...props}
    />
  );
}

export function DocsPre({
  className,
  ...props
}: ComponentPropsWithoutRef<'pre'>) {
  return (
    <pre
      className={cn(
        'mt-6 overflow-x-auto rounded-xl border border-kallo-border bg-white p-4 font-mono text-caption text-kallo-text leading-relaxed [&_code]:border-0 [&_code]:bg-transparent [&_code]:p-0',
        className
      )}
      {...props}
    />
  );
}

/**
 * Wide tables scroll inside their own container so the page body never
 * scrolls horizontally on a phone.
 */
export function DocsTable({
  className,
  ...props
}: ComponentPropsWithoutRef<'table'>) {
  return (
    <div className="mt-6 overflow-x-auto rounded-xl border border-kallo-border bg-white">
      <table
        className={cn('w-full border-collapse text-left', className)}
        {...props}
      />
    </div>
  );
}

/**
 * The header rule is 2px where body rows get 1px. With no usable fill to set
 * the row apart, weight and rule thickness are what mark it as a header.
 */
export function DocsTh({
  className,
  ...props
}: ComponentPropsWithoutRef<'th'>) {
  return (
    <th
      className={cn(
        'border-kallo-border border-b-2 px-4 py-3 font-semibold text-caption text-kallo-text',
        className
      )}
      {...props}
    />
  );
}

/**
 * No `tabular-nums`: most docs tables are prose (sub-processors, purposes,
 * text-vs-photo), and figure alignment is the exception. Pages that genuinely
 * tabulate numbers should ask for it rather than every table paying for it.
 */
export function DocsTd({
  className,
  ...props
}: ComponentPropsWithoutRef<'td'>) {
  return (
    <td
      className={cn(
        'border-kallo-border/60 border-b px-4 py-3 align-top text-base text-kallo-text leading-relaxed last:border-0',
        className
      )}
      {...props}
    />
  );
}
