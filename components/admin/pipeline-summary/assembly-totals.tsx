import type { z } from 'zod';
import type {
  assemblyMealItemSchema,
  assemblySchema,
} from '@/lib/admin/diagnostics/stage-schemas';
import { cn } from '@/lib/core/ui/cn';

export function AssemblyTotals({
  items,
  totals,
}: {
  items: z.infer<typeof assemblySchema>['mealItems'];
  totals?: z.infer<typeof assemblySchema>['displayedNutrition'];
}) {
  function pickMacro(
    item: z.infer<typeof assemblyMealItemSchema>,
    key: 'caloriesKcal' | 'proteinG' | 'carbohydrateG' | 'fatG'
  ): number | null {
    const flat = item.displayedNutrition?.[key];
    if (flat != null) return flat;
    const bounded = item.boundedNutrition?.[key];
    return bounded?.mid ?? null;
  }

  return (
    <div className="space-y-3">
      {items.length > 0 && (
        <ul className="divide-y rounded-md border">
          {items.map((item) => {
            const kcal = pickMacro(item, 'caloriesKcal');
            const p = pickMacro(item, 'proteinG');
            const c = pickMacro(item, 'carbohydrateG');
            const f = pickMacro(item, 'fatG');
            return (
              <li
                key={item.name}
                className="grid grid-cols-[1fr_auto_auto_auto_auto] items-baseline gap-x-4 gap-y-1 px-3 py-2 text-sm tabular-nums"
              >
                <span className="truncate font-medium">{item.name}</span>
                <Macro label="kcal" value={kcal} />
                <Macro label="P" value={p} unit="g" />
                <Macro label="C" value={c} unit="g" />
                <Macro label="F" value={f} unit="g" />
              </li>
            );
          })}
        </ul>
      )}
      {totals && (
        <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1 rounded-md bg-muted/40 px-3 py-2 text-sm tabular-nums">
          <span className="font-semibold">Total</span>
          <Macro label="kcal" value={totals.caloriesKcal ?? null} emphasis />
          <Macro label="P" value={totals.proteinG ?? null} unit="g" />
          <Macro label="C" value={totals.carbohydrateG ?? null} unit="g" />
          <Macro label="F" value={totals.fatG ?? null} unit="g" />
        </div>
      )}
    </div>
  );
}

function Macro({
  label,
  value,
  unit,
  emphasis,
}: {
  label: string;
  value: number | null | undefined;
  unit?: string;
  emphasis?: boolean;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-baseline gap-1',
        emphasis && 'font-semibold'
      )}
    >
      <span className="tabular-nums">
        {value == null ? '—' : Math.round(value)}
        {unit ?? ''}
      </span>
      <span className="text-[11px] text-muted-foreground uppercase">
        {label}
      </span>
    </span>
  );
}
