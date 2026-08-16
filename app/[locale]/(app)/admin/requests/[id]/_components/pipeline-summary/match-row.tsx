import { ArrowRight, CheckCircle2, CircleSlash, XCircle } from 'lucide-react';
import { cn } from '@/lib/ui/cn';
import { CandidatePool } from './matching/candidate-pool';
import { pickConfidenceTone } from './stage-primitives';
import type { MatchDiagnosticRow } from './types';

// ---------------------------------------------------------------------------
// Lenient schemas — the pipeline writes typed JSON, but we never want this
// component to crash if a stage's output drifts. On parse failure we fall
// through to a small notice and the StageTimeline below still renders raw.
// ---------------------------------------------------------------------------

export function MatchRow({ row }: { row: MatchDiagnosticRow }) {
  const isUnmatched = row.confidence === 'unmatched';
  const tone =
    row.confidence === 'high'
      ? pickConfidenceTone('high')
      : row.confidence === 'medium'
        ? pickConfidenceTone('medium')
        : pickConfidenceTone('low');
  const sim = row.similarity ?? 0;
  const simPct = Math.max(0, Math.min(1, sim)) * 100;

  return (
    <li className="grid grid-cols-[1fr_auto_1.2fr_auto] items-center gap-x-3 gap-y-1 px-3 py-2 text-sm">
      {/* Source ingredient + grams */}
      <div className="flex min-w-0 items-center gap-2">
        <span
          className={cn('inline-block h-2 w-2 shrink-0 rounded-full', tone.dot)}
          aria-hidden
        />
        <span className="truncate">{row.ingredientName}</span>
        {row.grams !== null && (
          <span className="shrink-0 text-muted-foreground text-xs tabular-nums">
            {row.grams}g
          </span>
        )}
      </div>

      {/* Arrow */}
      <ArrowRight
        className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
        aria-hidden
      />

      {/* Match target + similarity bar */}
      {isUnmatched ? (
        <span className="flex items-center gap-1.5 text-red-700 text-xs dark:text-red-400">
          <CircleSlash className="h-3.5 w-3.5" aria-hidden />
          no match
        </span>
      ) : (
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate">{row.matchedName}</span>
          <span
            className="hidden h-1.5 w-16 shrink-0 overflow-hidden rounded-full bg-muted sm:inline-block"
            aria-hidden
          >
            <span
              className={cn('block h-full', tone.bar)}
              style={{ width: `${simPct}%` }}
            />
          </span>
          <span className="shrink-0 text-muted-foreground text-xs tabular-nums">
            {sim.toFixed(2)}
          </span>
        </div>
      )}

      {/* Confidence badge */}
      {isUnmatched ? (
        <span
          className={cn(
            'inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-medium text-[11px]',
            tone.badgeBg,
            tone.text
          )}
        >
          unmatched
        </span>
      ) : (
        <span
          className={cn(
            'inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-medium text-[11px] capitalize',
            tone.badgeBg,
            tone.text
          )}
        >
          <CheckCircle2 className="h-3 w-3" aria-hidden />
          {row.confidence}
        </span>
      )}

      {/* Diagnostic line: matchType / source / latency / alias.
          Spans columns 3–4 so it sits under the matched name and confidence,
          aligned with the arrow column for compact reading. */}
      {!isUnmatched &&
        (row.matchType !== null ||
          row.source !== null ||
          row.latencyMs !== null ||
          row.viaAlias) && (
          <div className="col-start-3 col-end-5 -mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
            {row.matchType !== null && (
              <span className="inline-flex items-center rounded bg-muted px-1.5 py-0.5 font-medium tabular-nums">
                {row.matchType}
              </span>
            )}
            {row.source !== null && (
              <span className="inline-flex items-center rounded bg-muted px-1.5 py-0.5 font-medium uppercase tabular-nums">
                {row.source}
              </span>
            )}
            {row.viaAlias && (
              <span className="inline-flex items-center rounded bg-amber-100 px-1.5 py-0.5 font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                via alias
              </span>
            )}
            {row.latencyMs !== null && (
              <span className="tabular-nums">{row.latencyMs} ms</span>
            )}
          </div>
        )}

      <CandidatePool candidates={row.candidates} />
    </li>
  );
}

/** The matching stage's diagnostic core: per-meal match rows + unmatched output. */
export function MatchingStageBody({
  rowsByMeal,
  unmatchedOutputRows,
}: {
  rowsByMeal: Map<string, MatchDiagnosticRow[]>;
  unmatchedOutputRows: {
    ingredientName: string;
    mealContext?: string | null;
  }[];
}) {
  return (
    <div className="space-y-3">
      {[...rowsByMeal.entries()].map(([mealName, rows]) => (
        <div key={mealName} className="space-y-1.5">
          <p className="text-muted-foreground text-xs uppercase tracking-wide">
            {mealName}
          </p>
          <ul className="divide-y rounded-md border bg-muted/20">
            {rows.map((row) => (
              <MatchRow key={`${mealName}:${row.ingredientName}`} row={row} />
            ))}
          </ul>
        </div>
      ))}
      {unmatchedOutputRows.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-red-700 text-xs uppercase tracking-wide dark:text-red-400">
            Unmatched output ({unmatchedOutputRows.length})
          </p>
          <ul className="divide-y rounded-md border border-red-200 bg-red-50/40 dark:border-red-900/40 dark:bg-red-950/20">
            {unmatchedOutputRows.map((u) => (
              <li
                key={u.ingredientName}
                className="flex items-center gap-2 px-3 py-2 text-sm"
              >
                <XCircle className="h-3.5 w-3.5 text-red-500" aria-hidden />
                <span>{u.ingredientName}</span>
                {u.mealContext && (
                  <span className="text-muted-foreground text-xs">
                    · {u.mealContext}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
