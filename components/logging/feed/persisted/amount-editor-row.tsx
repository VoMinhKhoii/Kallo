import { Minus, Plus, X } from 'lucide-react';
import { MIN_DISH_GRAMS } from '@/lib/meal-utils';
import { cn } from '@/lib/utils';

export interface EditableRow {
  id: string;
  name: string;
  grams: number | null;
  removed: boolean;
}

interface AmountEditorRowProps {
  row: EditableRow;
  onStep: (id: string, delta: number) => void;
  onToggleRemove: (id: string) => void;
  t: (key: 'removeRow', values: { name: string }) => string;
}

export function AmountEditorRow({
  row,
  onStep,
  onToggleRemove,
  t,
}: AmountEditorRowProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-between py-2 text-[13px]',
        row.removed && 'opacity-40',
        'font-sans-display'
      )}
    >
      <span
        className={cn(
          'min-w-0 truncate font-medium text-nham-text',
          row.removed && 'line-through'
        )}
      >
        {row.name}
      </span>
      <div className="flex shrink-0 items-center gap-2">
        {row.grams != null && !row.removed && (
          <div className="flex shrink-0 items-center gap-0.5">
            <button
              type="button"
              aria-label={t('removeRow', { name: row.name })}
              disabled={row.grams <= MIN_DISH_GRAMS}
              onClick={() => onStep(row.id, -10)}
              className="flex h-7 w-7 items-center justify-center rounded-md border border-nham-border bg-white text-nham-text transition-colors hover:bg-nham-hover disabled:opacity-40"
            >
              <Minus className="h-2.5 w-2.5" />
            </button>
            <span className="w-9 text-center font-semibold text-[11px] text-nham-text tabular-nums">
              {Math.round(row.grams)}g
            </span>
            <button
              type="button"
              onClick={() => onStep(row.id, 10)}
              className="flex h-7 w-7 items-center justify-center rounded-md border border-nham-border bg-white text-nham-text transition-colors hover:bg-nham-hover"
            >
              <Plus className="h-2.5 w-2.5" />
            </button>
          </div>
        )}
        <button
          type="button"
          aria-label={t('removeRow', { name: row.name })}
          aria-pressed={row.removed}
          onClick={() => onToggleRemove(row.id)}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-nham-text-muted/70 transition-colors hover:bg-nham-danger/10 hover:text-nham-danger"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
