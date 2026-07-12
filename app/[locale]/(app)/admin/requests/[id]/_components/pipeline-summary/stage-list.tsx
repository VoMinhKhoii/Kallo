import { AssemblyTotals } from './assembly-totals';
import type { PipelineDiagnostics } from './derive-diagnostics';
import { LanguageMetadataChips } from './language-chips';
import { MatchingStageBody } from './match-row';
import {
  Chip,
  normalizeStageStatus,
  ParseFallback,
  StageDot,
  StageRow,
} from './stage-primitives';

/** The four-stage vertical rail of the pipeline trace. */
export function StageList({
  diagnostics,
  rawInput,
}: {
  diagnostics: PipelineDiagnostics;
  rawInput: string;
}) {
  const {
    stagesByName,
    decomp,
    matching,
    assembly,
    mealItems,
    languageMetadata,
    matched,
    unmatched,
    totalIngredients,
    matchedCount,
    rowsByMeal,
    unmatchedOutputRows,
    matchStrategyCounts,
    nutritionAssemblyStatus,
  } = diagnostics;

  return (
    <ol className="space-y-5">
      {/* Stage 1 — Input */}
      <StageRow
        dot={<StageDot status="success" />}
        status="success"
        title="Input"
        meta={
          decomp.success && decomp.data.mealSlot ? (
            <Chip>{decomp.data.mealSlot}</Chip>
          ) : null
        }
      >
        <p className="rounded-md bg-muted/50 px-3 py-2 font-mono text-sm leading-relaxed">
          {rawInput}
        </p>
        {decomp.success && decomp.data.isFood === false && (
          <p className="mt-2 text-amber-700 text-xs dark:text-amber-400">
            Decomposition flagged this as non-food.
          </p>
        )}
      </StageRow>

      {/* Stage 2 — Decomposition */}
      <StageRow
        dot={
          <StageDot
            status={normalizeStageStatus(stagesByName.decomposition?.status)}
          />
        }
        status={normalizeStageStatus(stagesByName.decomposition?.status)}
        title="Decomposition"
        meta={
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            <span className="text-muted-foreground text-xs tabular-nums">
              {stagesByName.decomposition?.durationMs ?? '—'} ms
              {' · '}
              {mealItems.length} item{mealItems.length === 1 ? '' : 's'}
              {' · '}
              {totalIngredients} ingredient
              {totalIngredients === 1 ? '' : 's'}
            </span>
            {languageMetadata ? (
              <LanguageMetadataChips metadata={languageMetadata} />
            ) : null}
          </div>
        }
      >
        {!decomp.success ? (
          <ParseFallback stage="decomposition" />
        ) : mealItems.length === 0 ? (
          <p className="text-muted-foreground text-sm">No meal items.</p>
        ) : (
          <ul className="space-y-2">
            {mealItems.map((item) => (
              <li
                key={item.name}
                className="flex flex-wrap items-baseline gap-x-3 gap-y-1"
              >
                <span className="font-medium text-sm">{item.name}</span>
                <span className="flex flex-wrap gap-1.5">
                  {item.ingredients.map((ing) => (
                    <span
                      key={`${item.name}:${ing.name}`}
                      className="inline-flex items-baseline gap-1 rounded-full bg-muted/70 px-2 py-0.5 text-xs"
                    >
                      <span>{ing.name}</span>
                      <span className="text-muted-foreground tabular-nums">
                        {ing.estimatedGrams ?? '—'}g
                      </span>
                    </span>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        )}
      </StageRow>

      {/* Stage 3 — Matching (the diagnostic core) */}
      <StageRow
        dot={
          <StageDot
            status={normalizeStageStatus(stagesByName.matching?.status)}
          />
        }
        status={normalizeStageStatus(stagesByName.matching?.status)}
        title="Matching"
        meta={
          <span className="text-muted-foreground text-xs tabular-nums">
            {stagesByName.matching?.durationMs ?? '—'} ms
            {' · '}
            {matchedCount} matched
            {' · '}
            {unmatched.length} unmatched
            {(matchStrategyCounts.vector > 0 ||
              matchStrategyCounts.fuzzy > 0 ||
              matchStrategyCounts.alias > 0) && (
              <>
                {' · '}
                {matchStrategyCounts.vector}v{' / '}
                {matchStrategyCounts.fuzzy}f
                {matchStrategyCounts.alias > 0 && (
                  <>
                    {' / '}
                    {matchStrategyCounts.alias}a
                  </>
                )}
              </>
            )}
          </span>
        }
      >
        {!matching.success ? (
          <ParseFallback stage="matching" />
        ) : matched.length + unmatched.length === 0 ? (
          <p className="text-muted-foreground text-sm">No matches recorded.</p>
        ) : (
          <MatchingStageBody
            rowsByMeal={rowsByMeal}
            unmatchedOutputRows={unmatchedOutputRows}
          />
        )}
      </StageRow>

      {/* Stage 4 — Nutrition + Assembly */}
      <StageRow
        dot={<StageDot status={nutritionAssemblyStatus} />}
        status={nutritionAssemblyStatus}
        title="Nutrition & assembly"
        meta={
          <span className="text-muted-foreground text-xs tabular-nums">
            {stagesByName.nutrition?.durationMs ?? '—'} ms est ·{' '}
            {stagesByName.assembly?.durationMs ?? '—'} ms assemble
          </span>
        }
      >
        {!assembly.success ? (
          <ParseFallback stage="assembly" />
        ) : (
          <AssemblyTotals
            items={assembly.data.mealItems}
            totals={assembly.data.displayedNutrition}
          />
        )}
      </StageRow>
    </ol>
  );
}
