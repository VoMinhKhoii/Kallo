import type { InferSelectModel } from 'drizzle-orm';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  CircleSlash,
  XCircle,
} from 'lucide-react';
import { z } from 'zod';
import type {
  pipelineLlmCalls,
  pipelineRequests,
  pipelineStageLogs,
} from '@/lib/db/schema';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Lenient schemas — the pipeline writes typed JSON, but we never want this
// component to crash if a stage's output drifts. On parse failure we fall
// through to a small notice and the StageTimeline below still renders raw.
// ---------------------------------------------------------------------------

const decompositionSchema = z.object({
  isFood: z.boolean().optional(),
  mealSlot: z.string().nullable().optional(),
  languageMetadata: z
    .object({
      inputLanguage: z.enum(['en', 'vi', 'mixed', 'unknown']).nullable(),
      outputLanguage: z.enum(['en', 'vi']).nullable(),
      guardReason: z.string(),
      guardSeverity: z.enum(['info', 'warning', 'error']),
      guardPassed: z.boolean(),
      retryCount: z.number().int().min(0),
    })
    .optional(),
  mealItems: z
    .array(
      z.object({
        name: z.string(),
        ingredients: z
          .array(
            z.object({
              name: z.string(),
              estimatedGrams: z.number().nullable().optional(),
              cookingMethod: z.string().nullable().optional(),
              userFacingUnit: z.string().nullable().optional(),
            })
          )
          .default([]),
      })
    )
    .default([]),
});

const matchedSchema = z.object({
  ingredientName: z.string(),
  foodCompositionId: z.string().nullable().optional(),
  matchedName: z.string(),
  similarity: z.number(),
  confidence: z.enum(['high', 'medium', 'low']),
  matchType: z.enum(['vector', 'fuzzy']).optional(),
  source: z.enum(['fao', 'usda']).optional(),
  latencyMs: z.number().optional(),
  viaAlias: z.boolean().optional(),
});
const unmatchedSchema = z.object({
  ingredientName: z.string(),
  mealContext: z.string().nullable().optional(),
});
const matchingSchema = z.object({
  matched: z.array(matchedSchema).default([]),
  unmatched: z.array(unmatchedSchema).default([]),
});

const assemblyMacroSchema = z
  .object({
    mid: z.number().nullable().optional(),
  })
  .nullable()
  .optional();

const assemblyMealItemSchema = z.object({
  name: z.string(),
  displayedNutrition: z
    .object({
      caloriesKcal: z.number().nullable().optional(),
      proteinG: z.number().nullable().optional(),
      carbohydrateG: z.number().nullable().optional(),
      fatG: z.number().nullable().optional(),
    })
    .partial()
    .optional(),
  boundedNutrition: z
    .object({
      caloriesKcal: assemblyMacroSchema,
      proteinG: assemblyMacroSchema,
      carbohydrateG: assemblyMacroSchema,
      fatG: assemblyMacroSchema,
    })
    .partial()
    .optional(),
});
const assemblySchema = z.object({
  mealItems: z.array(assemblyMealItemSchema).default([]),
  displayedNutrition: z
    .object({
      caloriesKcal: z.number().nullable().optional(),
      proteinG: z.number().nullable().optional(),
      carbohydrateG: z.number().nullable().optional(),
      fatG: z.number().nullable().optional(),
    })
    .partial()
    .optional(),
});

// ---------------------------------------------------------------------------

type StageLog = InferSelectModel<typeof pipelineStageLogs>;
type LlmCall = InferSelectModel<typeof pipelineLlmCalls>;
type RequestRow = InferSelectModel<typeof pipelineRequests>;

interface PipelineSummaryProps {
  request: RequestRow;
  stageLogs: StageLog[];
  llmCalls: LlmCall[];
}

type DiagnosticStageStatus = 'success' | 'error' | 'skipped' | 'pending';

type MatchDiagnosticRow = {
  ingredientName: string;
  grams: number | null;
  matchedName: string | null;
  similarity: number | null;
  confidence: 'high' | 'medium' | 'low' | 'unmatched';
  matchType: 'vector' | 'fuzzy' | null;
  source: 'fao' | 'usda' | null;
  latencyMs: number | null;
  viaAlias: boolean;
};

function findStage(stages: StageLog[], name: string): StageLog | undefined {
  return stages.find((s) => s.stage === name);
}

function normalizeStageStatus(
  status: string | undefined
): DiagnosticStageStatus {
  if (status === 'success' || status === 'error' || status === 'skipped') {
    return status;
  }
  return 'pending';
}

function pickConfidenceTone(c: 'high' | 'medium' | 'low'): {
  dot: string;
  bar: string;
  text: string;
  badgeBg: string;
} {
  if (c === 'high')
    return {
      dot: 'bg-green-500',
      bar: 'bg-green-500',
      text: 'text-green-700 dark:text-green-400',
      badgeBg: 'bg-green-100 dark:bg-green-900/30',
    };
  if (c === 'medium')
    return {
      dot: 'bg-amber-500',
      bar: 'bg-amber-500',
      text: 'text-amber-700 dark:text-amber-400',
      badgeBg: 'bg-amber-100 dark:bg-amber-900/30',
    };
  return {
    dot: 'bg-red-500',
    bar: 'bg-red-500',
    text: 'text-red-700 dark:text-red-400',
    badgeBg: 'bg-red-100 dark:bg-red-900/30',
  };
}

function StageDot({ status }: { status: DiagnosticStageStatus }) {
  if (status === 'success') {
    return (
      <span
        className="relative z-10 inline-flex h-3 w-3 items-center justify-center rounded-full bg-green-500 ring-4 ring-background"
        aria-hidden
      />
    );
  }
  if (status === 'error') {
    return (
      <span
        className="relative z-10 inline-flex h-3 w-3 items-center justify-center rounded-full bg-red-500 ring-4 ring-background"
        aria-hidden
      />
    );
  }
  if (status === 'skipped') {
    return (
      <span
        className="relative z-10 inline-flex h-3 w-3 items-center justify-center rounded-full bg-muted-foreground/40 ring-4 ring-background"
        aria-hidden
      />
    );
  }
  return (
    <span
      className="relative z-10 inline-flex h-3 w-3 items-center justify-center rounded-full bg-muted-foreground/30 ring-4 ring-background"
      aria-hidden
    />
  );
}

// ---------------------------------------------------------------------------

export function PipelineSummary({
  request,
  stageLogs,
  llmCalls,
}: PipelineSummaryProps) {
  if (stageLogs.length === 0) {
    return (
      <div className="rounded-lg border border-dashed bg-muted/20 p-4 text-muted-foreground text-sm">
        No pipeline trace recorded for this request. Enable{' '}
        <code className="rounded bg-muted px-1 py-0.5 text-xs">
          PIPELINE_TRACE_ENABLED
        </code>{' '}
        to capture stage logs.
      </div>
    );
  }

  const stagesByName = Object.fromEntries(
    stageLogs.map((s) => [s.stage, s])
  ) as Record<string, StageLog | undefined>;

  const decomp = decompositionSchema.safeParse(
    findStage(stageLogs, 'decomposition')?.outputJson
  );
  const matching = matchingSchema.safeParse(
    findStage(stageLogs, 'matching')?.outputJson
  );
  const assembly = assemblySchema.safeParse(
    findStage(stageLogs, 'assembly')?.outputJson
  );

  const mealItems = decomp.success ? decomp.data.mealItems : [];
  const languageMetadata = decomp.success
    ? (decomp.data.languageMetadata ?? null)
    : null;

  const matched = matching.success ? matching.data.matched : [];
  const unmatched = matching.success ? matching.data.unmatched : [];

  const totalIngredients = mealItems.reduce(
    (n, m) => n + m.ingredients.length,
    0
  );
  const matchedCount = matched.length;
  const matchRate =
    totalIngredients > 0 ? matchedCount / totalIngredients : null;

  const rowsByMeal = new Map<string, MatchDiagnosticRow[]>();
  for (const item of mealItems) rowsByMeal.set(item.name, []);

  const matchedByName = new Map(
    matched.map((m) => [m.ingredientName.toLowerCase(), m])
  );
  const representedIngredientNames = new Set<string>();
  for (const item of mealItems) {
    const list = rowsByMeal.get(item.name) ?? [];
    for (const ing of item.ingredients) {
      const ingredientKey = ing.name.toLowerCase();
      representedIngredientNames.add(ingredientKey);
      const m = matchedByName.get(ingredientKey);
      list.push({
        ingredientName: ing.name,
        grams: ing.estimatedGrams ?? null,
        matchedName: m?.matchedName ?? null,
        similarity: m?.similarity ?? null,
        confidence: m?.confidence ?? 'unmatched',
        matchType: m?.matchType ?? null,
        source: m?.source ?? null,
        latencyMs: m?.latencyMs ?? null,
        viaAlias: m?.viaAlias ?? false,
      });
    }
    rowsByMeal.set(item.name, list);
  }
  const unmatchedOutputRows = unmatched.filter(
    (u) => !representedIngredientNames.has(u.ingredientName.toLowerCase())
  );

  // Token + LLM totals
  const totalTokens = llmCalls.reduce(
    (n, c) => n + (c.inputTokens ?? 0) + (c.outputTokens ?? 0),
    0
  );

  // Aggregate match-strategy counts for the stage header.
  const matchStrategyCounts = matched.reduce(
    (acc, m) => {
      if (m.matchType === 'vector') acc.vector++;
      else if (m.matchType === 'fuzzy') acc.fuzzy++;
      if (m.viaAlias) acc.alias++;
      return acc;
    },
    { vector: 0, fuzzy: 0, alias: 0 }
  );

  const erroredStage = stageLogs.find((s) => s.status === 'error');
  const nutritionAssemblyStatus = normalizeStageStatus(
    stagesByName.assembly?.status ?? stagesByName.nutrition?.status
  );

  return (
    <section
      aria-label="Pipeline summary"
      className="rounded-lg border bg-card"
    >
      {/* Header strip */}
      <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2 border-b px-5 py-3">
        <div className="flex items-baseline gap-2">
          <span className="font-semibold text-sm">Pipeline</span>
          <span className="text-muted-foreground text-xs">
            {stageLogs.length} stages · {llmCalls.length} LLM calls
          </span>
        </div>
        <Metric label="Duration" value={`${request.durationMs ?? '—'} ms`} />
        <Metric
          label="Tokens"
          value={totalTokens > 0 ? totalTokens.toLocaleString() : '—'}
        />
        <Metric
          label="Matched"
          value={
            totalIngredients > 0
              ? `${matchedCount}/${totalIngredients}`
              : `${matchedCount}`
          }
          tone={
            matchRate === null
              ? 'neutral'
              : matchRate >= 0.9
                ? 'good'
                : matchRate >= 0.6
                  ? 'warn'
                  : 'bad'
          }
        />
        <Metric
          label="Unmatched"
          value={String(unmatched.length)}
          tone={unmatched.length === 0 ? 'good' : 'warn'}
        />
        {languageMetadata ? (
          <Metric
            label="Language"
            value={formatLanguagePair(languageMetadata)}
            tone={
              languageMetadata.guardPassed
                ? languageMetadata.retryCount > 0
                  ? 'warn'
                  : 'neutral'
                : 'bad'
            }
          />
        ) : null}
      </div>

      {/* Error banner — always points to the failing stage */}
      {erroredStage && (
        <div className="flex items-start gap-2 border-b bg-red-50 px-5 py-3 text-red-900 text-sm dark:bg-red-950/30 dark:text-red-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <div className="space-y-0.5">
            <p className="font-medium">
              Failed at <span className="capitalize">{erroredStage.stage}</span>
            </p>
            {erroredStage.error && (
              <p className="font-mono text-xs opacity-80">
                {erroredStage.error}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Pipeline body — 4 stages on a vertical rail */}
      <div className="relative px-5 py-5">
        {/* Vertical rail: 1px neutral; status dots align to it */}
        <div
          className="absolute top-6 bottom-6 left-[27px] w-px bg-border"
          aria-hidden
        />

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
              {request.rawInput}
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
                status={normalizeStageStatus(
                  stagesByName.decomposition?.status
                )}
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
              <p className="text-muted-foreground text-sm">
                No matches recorded.
              </p>
            ) : (
              <div className="space-y-3">
                {[...rowsByMeal.entries()].map(([mealName, rows]) => (
                  <div key={mealName} className="space-y-1.5">
                    <p className="text-muted-foreground text-xs uppercase tracking-wide">
                      {mealName}
                    </p>
                    <ul className="divide-y rounded-md border bg-muted/20">
                      {rows.map((row) => (
                        <MatchRow
                          key={`${mealName}:${row.ingredientName}`}
                          row={row}
                        />
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
                          <XCircle
                            className="h-3.5 w-3.5 text-red-500"
                            aria-hidden
                          />
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
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StageRow({
  dot,
  status,
  title,
  meta,
  children,
}: {
  dot: React.ReactNode;
  status: DiagnosticStageStatus;
  title: string;
  meta?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <li className="relative flex gap-4">
      <div className="flex w-8 shrink-0 justify-center pt-1">{dot}</div>
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <div className="flex min-w-0 items-baseline gap-2">
            <h3 className="font-semibold text-sm">{title}</h3>
            <span className="rounded bg-muted px-1.5 py-0.5 font-medium text-[11px] text-muted-foreground capitalize">
              {status}
            </span>
          </div>
          {meta}
        </div>
        {children}
      </div>
    </li>
  );
}

function Metric({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  tone?: 'neutral' | 'good' | 'warn' | 'bad';
}) {
  const toneClass =
    tone === 'good'
      ? 'text-green-700 dark:text-green-400'
      : tone === 'warn'
        ? 'text-amber-700 dark:text-amber-400'
        : tone === 'bad'
          ? 'text-red-700 dark:text-red-400'
          : '';
  return (
    <div className="flex flex-col">
      <span className="text-[11px] text-muted-foreground uppercase tracking-wide">
        {label}
      </span>
      <span className={cn('font-medium text-sm tabular-nums', toneClass)}>
        {value}
      </span>
    </div>
  );
}

type LanguageMetadata = NonNullable<
  z.infer<typeof decompositionSchema>['languageMetadata']
>;

function formatLanguagePair(metadata: LanguageMetadata): string {
  const input = metadata.inputLanguage ?? 'unknown';
  const output = metadata.outputLanguage ?? 'unknown';
  return `${input} → ${output}`;
}

function LanguageMetadataChips({ metadata }: { metadata: LanguageMetadata }) {
  return (
    <span className="flex min-w-0 flex-wrap items-center gap-1.5">
      <Chip>
        <span translate="no">{formatLanguagePair(metadata)}</span>
      </Chip>
      {metadata.retryCount > 0 ? (
        <Chip>
          <span className="tabular-nums">{metadata.retryCount} lang retry</span>
        </Chip>
      ) : null}
      {!metadata.guardPassed ? <Chip>language mismatch</Chip> : null}
    </span>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 font-medium text-muted-foreground text-xs capitalize">
      {children}
    </span>
  );
}

function MatchRow({ row }: { row: MatchDiagnosticRow }) {
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
    </li>
  );
}

function AssemblyTotals({
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

function ParseFallback({ stage }: { stage: string }) {
  return (
    <p className="rounded-md border border-dashed bg-muted/20 px-3 py-2 text-muted-foreground text-xs">
      Could not parse <code className="font-mono">{stage}</code> output. See raw
      stage below.
    </p>
  );
}
