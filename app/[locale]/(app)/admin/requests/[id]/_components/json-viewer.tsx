'use client';

import { Check, ChevronDown, ChevronRight, Copy } from 'lucide-react';
import { type ReactNode, useId, useState } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { cn } from '@/lib/utils';

interface JsonViewerProps {
  label: string;
  value: unknown;
  defaultOpen?: boolean;
}

type ViewMode = 'raw' | 'tree';

// ---------------------------------------------------------------------------
// Syntax highlighting for the raw (verbatim) view. We never transform the
// payload — `JSON.stringify(value, null, 2)` stays the source of truth — we
// only wrap tokens in colored spans so it is scannable while debugging.
// ---------------------------------------------------------------------------

const TOKEN_RE =
  /"(?:\\.|[^"\\])*"(?:\s*:)?|\b(?:true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g;

function tokenClass(token: string): string {
  if (token.startsWith('"')) {
    return token.trimEnd().endsWith(':')
      ? 'text-nham-text' // object key
      : 'text-nham-success'; // string value
  }
  if (token === 'true' || token === 'false' || token === 'null') {
    return 'text-nham-danger';
  }
  return 'text-amber-700 dark:text-amber-400'; // number
}

function highlightJson(json: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let key = 0;
  for (const match of json.matchAll(TOKEN_RE)) {
    const start = match.index ?? 0;
    if (start > last) out.push(json.slice(last, start));
    out.push(
      <span className={tokenClass(match[0])} key={key++}>
        {match[0]}
      </span>
    );
    last = start + match[0].length;
  }
  if (last < json.length) out.push(json.slice(last));
  return out;
}

// ---------------------------------------------------------------------------
// Structured tree view — collapsible nodes for fast drill-down.
// ---------------------------------------------------------------------------

function Primitive({ value }: { value: unknown }) {
  if (typeof value === 'string') {
    return <span className="break-all text-nham-success">{`"${value}"`}</span>;
  }
  if (typeof value === 'number') {
    return (
      <span className="text-amber-700 tabular-nums dark:text-amber-400">
        {value}
      </span>
    );
  }
  return <span className="text-nham-danger">{String(value)}</span>;
}

function JsonNode({
  name,
  value,
  depth,
}: {
  name?: string;
  value: unknown;
  depth: number;
}) {
  const isContainer = value !== null && typeof value === 'object';
  // Expand the first two levels by default; deeper stays collapsed.
  const [open, setOpen] = useState(depth < 2);
  const indent = { paddingLeft: depth === 0 ? 0 : 12 } as const;

  if (!isContainer) {
    return (
      <div className="flex gap-1.5" style={indent}>
        {name !== undefined && <span className="text-nham-text">{name}:</span>}
        <Primitive value={value} />
      </div>
    );
  }

  const isArray = Array.isArray(value);
  const entries = isArray
    ? (value as unknown[]).map((v, i) => [String(i), v] as const)
    : Object.entries(value as Record<string, unknown>);
  const [openBracket, closeBracket] = isArray ? ['[', ']'] : ['{', '}'];

  return (
    <div style={indent}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="inline-flex items-center gap-1 rounded hover:text-nham-text"
      >
        {open ? (
          <ChevronDown className="h-3 w-3 shrink-0 text-nham-text-muted" />
        ) : (
          <ChevronRight className="h-3 w-3 shrink-0 text-nham-text-muted" />
        )}
        {name !== undefined && <span className="text-nham-text">{name}:</span>}
        <span className="text-nham-text-muted">
          {openBracket}
          {!open && (
            <>
              {' '}
              <span className="tabular-nums">{entries.length}</span>{' '}
              {closeBracket}
            </>
          )}
        </span>
      </button>
      {open && (
        <div className="border-nham-border/40 border-l">
          {entries.map(([k, v]) => (
            <JsonNode
              depth={depth + 1}
              key={k}
              name={isArray ? undefined : k}
              value={v}
            />
          ))}
          <div className="text-nham-text-muted" style={{ paddingLeft: 12 }}>
            {closeBracket}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

export function JsonViewer({
  label,
  value,
  defaultOpen = false,
}: JsonViewerProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [mode, setMode] = useState<ViewMode>('raw');
  const [copied, setCopied] = useState(false);
  const contentId = useId();

  if (value === null || value === undefined) {
    return (
      <div className="text-nham-text-muted text-xs">
        <span className="font-medium">{label}:</span> <em>empty</em>
      </div>
    );
  }

  const formatted = JSON.stringify(value, null, 2);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(formatted);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard can be unavailable (insecure context / denied permission) —
      // silently no-op rather than crash the trace view.
    }
  }

  return (
    <div className="rounded-md border border-nham-border/60 text-xs">
      <button
        aria-controls={open ? contentId : undefined}
        aria-expanded={open}
        className={cn(
          'flex w-full items-center gap-1 rounded-md px-2 py-1 text-left',
          'bg-nham-track/60 transition-colors hover:bg-nham-hover/70',
          open && 'rounded-b-none border-nham-border/60 border-b'
        )}
        onClick={() => setOpen((o) => !o)}
        type="button"
      >
        {open ? (
          <ChevronDown
            aria-hidden="true"
            className="h-3 w-3 shrink-0 text-nham-text-muted"
          />
        ) : (
          <ChevronRight
            aria-hidden="true"
            className="h-3 w-3 shrink-0 text-nham-text-muted"
          />
        )}
        <span className="font-medium text-nham-text">{label}</span>
        {!open && (
          <span className="ml-1 truncate font-mono text-nham-text-muted">
            {formatted.slice(0, 60)}
            {formatted.length > 60 ? '…' : ''}
          </span>
        )}
      </button>

      {open && (
        <div>
          <div className="flex items-center justify-between gap-2 border-nham-border/40 border-b px-2 py-1.5">
            <ToggleGroup
              type="single"
              value={mode}
              onValueChange={(v) => v && setMode(v as ViewMode)}
              variant="outline"
              size="sm"
              className="h-7"
            >
              <ToggleGroupItem value="raw" className="h-7 px-2 text-[11px]">
                Raw
              </ToggleGroupItem>
              <ToggleGroupItem value="tree" className="h-7 px-2 text-[11px]">
                Tree
              </ToggleGroupItem>
            </ToggleGroup>
            <button
              type="button"
              onClick={handleCopy}
              aria-label={copied ? 'Copied to clipboard' : 'Copy to clipboard'}
              aria-live="polite"
              className="inline-flex items-center gap-1 rounded px-1.5 py-1 font-medium text-[11px] text-nham-text-muted transition-colors hover:bg-nham-hover/70 hover:text-nham-text"
            >
              {copied ? (
                <Check className="h-3 w-3 text-nham-success" aria-hidden />
              ) : (
                <Copy className="h-3 w-3" aria-hidden />
              )}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>

          <ScrollArea className="max-h-96" id={contentId}>
            {mode === 'raw' ? (
              <pre className="p-2 font-mono text-[11.5px] text-nham-text-muted leading-relaxed">
                {highlightJson(formatted)}
              </pre>
            ) : (
              <div className="p-2 font-mono text-[11.5px] leading-relaxed">
                <JsonNode depth={0} value={value} />
              </div>
            )}
          </ScrollArea>
        </div>
      )}
    </div>
  );
}
