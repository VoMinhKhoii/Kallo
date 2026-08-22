import type { MatchCandidateRow } from '@/lib/admin/diagnostics/types';

/**
 * The top-K pool retrieval actually considered for one ingredient.
 *
 * The distinction this component exists to make: `undefined` means the trace
 * predates candidate logging (v1 recorded only the winner), while an EMPTY
 * array is the finding itself — the cascade ran and nothing cleared the
 * per-source acceptance floors. Those two used to look identical, which is
 * how a genuine zero-candidate ingredient read as a rendering gap.
 */
export function CandidatePool({
  candidates,
}: {
  candidates: MatchCandidateRow[] | undefined;
}) {
  if (candidates === undefined) return null;

  if (candidates.length === 0) {
    return (
      <p className="col-start-1 col-end-5 mt-1 text-[11px] text-red-700 dark:text-red-400">
        0 candidates — nothing cleared the retrieval thresholds
      </p>
    );
  }

  return (
    <ul className="col-start-1 col-end-5 mt-1 space-y-0.5">
      {candidates.map((candidate, index) => (
        <li
          key={candidate.foodCompositionId}
          className="flex flex-wrap items-baseline gap-x-2 text-[11px] text-muted-foreground"
        >
          <span className="tabular-nums">c{index + 1}</span>
          <span className="text-foreground/80">{candidate.matchedName}</span>
          <span className="tabular-nums">
            {candidate.similarity.toFixed(3)}
          </span>
          {candidate.source && (
            <span className="uppercase">{candidate.source}</span>
          )}
          {candidate.matchType && <span>{candidate.matchType}</span>}
          {candidate.state && <span>{candidate.state}</span>}
        </li>
      ))}
    </ul>
  );
}
