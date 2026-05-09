'use client';

import { ChevronDown, ChevronRight } from 'lucide-react';
import { useId, useState } from 'react';
import { cn } from '@/lib/utils';

interface JsonViewerProps {
  label: string;
  value: unknown;
  defaultOpen?: boolean;
}

export function JsonViewer({
  label,
  value,
  defaultOpen = false,
}: JsonViewerProps) {
  const [open, setOpen] = useState(defaultOpen);
  const contentId = useId();

  if (value === null || value === undefined) {
    return (
      <div className="text-muted-foreground text-xs">
        <span className="font-medium">{label}:</span> <em>empty</em>
      </div>
    );
  }

  const formatted = JSON.stringify(value, null, 2);

  return (
    <div className="rounded border text-xs">
      <button
        type="button"
        aria-controls={open ? contentId : undefined}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'flex w-full items-center gap-1 px-2 py-1 text-left',
          'bg-muted/40 transition-colors hover:bg-muted/70',
          open && 'border-b'
        )}
      >
        {open ? (
          <ChevronDown
            aria-hidden="true"
            className="h-3 w-3 shrink-0 text-muted-foreground"
          />
        ) : (
          <ChevronRight
            aria-hidden="true"
            className="h-3 w-3 shrink-0 text-muted-foreground"
          />
        )}
        <span className="font-medium">{label}</span>
        {!open && (
          <span className="ml-1 truncate text-muted-foreground">
            {formatted.slice(0, 60)}
            {formatted.length > 60 ? '…' : ''}
          </span>
        )}
      </button>

      {open && (
        <pre
          id={contentId}
          className="max-h-64 overflow-auto p-2 font-mono text-xs leading-relaxed"
        >
          {formatted}
        </pre>
      )}
    </div>
  );
}
