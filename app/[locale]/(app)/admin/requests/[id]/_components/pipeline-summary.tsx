import type { InferSelectModel } from 'drizzle-orm';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  CircleSlash,
  XCircle,
} from 'lucide-react';
import { z } from 'zod';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import type {
  pipelineLlmCalls,
  pipelineRequests,
  pipelineStageLogs,
} from '@/lib/db/schema';
import { cn } from '@/lib/utils';
import {
  confidenceTone,
  type MetricTone,
  metricToneClass,
  statusDotClass,
} from '../../../_components/status-badge';

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

function StageDot({ status }: { status: DiagnosticStageStatus }) {
  return (
    <span
      aria-hidden
      className={cn(
        'inline-flex h-2.5 w-2.5 shrink-0 rounded-full',
        statusDotClass(status)
      )}
    />
  );
}

// Static config driving both the jump-nav and the rendered stage sections so
// the two never drift out of sync.
const STAGE_NAV = [
  { id: 'stage-input', label: 'Input' },
  { id: 'stage-decomposition', label: 'Decomposition' },
  { id: 'stage-matching', label: 'Matching' },
  { id: 'stage-nutrition', label: 'Nutrition' },
] as const;

// ---------------------------------------------------------------------------

export function PipelineSummary({
  request,
  stageLogs,
  llmCalls,
}: PipelineSummaryProps) {
  if (stageLogs.length === 0) {
    return (
      <div className="rounded-lg border border-nham-border/60 border-dashed bg-nham-track/30 p-4 font-sans-display text-nham-text-muted text-sm">
        No pipeline trace recorded for this request. Enable{' '}
        <code className="rounded bg-nham-hover px-1 py-0.5 text-xs">
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
  const decompositionStatus = normalizeStageStatus(
    stagesByName.decomposition?.status
  );
  const matchingStatus = normalizeStageStatus(stagesByName.matching?.status);
  const nutritionAssemblyStatus = normalizeStageStatus(
    stagesByName.assembly?.status ?? stagesByName.nutrition?.status
  );

  const navStatus: Record<string, DiagnosticStageStatus> = {
    'stage-input': 'success',
    'stage-decomposition': decompositionStatus,
    'stage-matching': matchingStatus,
    'stage-nutrition': nutritionAssemblyStatus,
  };

  return (
    <section
      aria-label="Pipeline summary"
      className="rounded-lg border border-nham-border/60 bg-white/50 font-sans-display dark:bg-white/[0.02]"
      id="pipeline-summary"
    >
      {/* Header strip */}
      <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2 border-nham-border/60 border-b px-5 py-3">
        <div className="flex items-baseline gap-2">
          <span className="font-semibold text-nham-text text-sm">Pipeline</span>
          <span className="text-nham-text-muted text-xs">
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

      {/* Sticky stage jump-nav — pin a stage without scrolling the whole page */}
      <nav
        aria-label="Jump to stage"
        className="sticky top-[5.75rem] z-10 -mx-px flex flex-wrap items-center gap-1.5 border-nham-border/60 border-b bg-nham-surface/90 px-5 py-2 backdrop-blur"
      >
        {STAGE_NAV.map((s) => (
          <a
            className="inline-flex items-center gap-1.5 rounded-full border border-nham-border/60 px-2.5 py-1 text-nham-text-muted text-xs transition-colors hover:bg-nham-hover/60 hover:text-nham-text"
            href={`#${s.id}`}
            key={s.id}
          >
            <StageDot status={navStatus[s.id]} />
            {s.label}
          </a>
        ))}
      </nav>

      {/* Error banner — always points to the failing stage */}
      {erroredStage && (
        <div className="flex items-start gap-2 border-nham-border/60 border-b bg-nham-danger/10 px-5 py-3 text-nham-danger text-sm">
          <AlertTriangle aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
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

      {/* Pipeline body — 4 collapsible stage sections */}
      <div className="space-y-3 px-5 py-5">
        {/* Stage 1 — Input */}
        <StageSection
          id="stage-input"
          meta={
            decomp.success && decomp.data.mealSlot ? (
              <Chip>{decomp.data.mealSlot}</Chip>
            ) : null
          }
          status="success"
          title="Input"
        >
          <p className="rounded-md bg-nham-track/60 px-3 py-2 font-mono text-nham-text text-sm leading-relaxed">
            {request.rawInput}
          </p>
          {decomp.success && decomp.data.isFood === false && (
            <p className="mt-2 text-amber-700 text-xs dark:text-amber-400">
              Decomposition flagged this as non-food.
            </p>
          )}
        </StageSection>

        {/* Stage 2 — Decomposition */}
        <StageSection
          id="stage-decomposition"
          meta={
            <div className="flex flex-wrap items-center justify-end gap-1.5">
              <span className="text-nham-text-muted text-xs tabular-nums">
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
          status={decompositionStatus}
          title="Decomposition"
        >
          {!decomp.success ? (
            <ParseFallback stage="decomposition" />
          ) : mealItems.length === 0 ? (
            <p className="text-nham-text-muted text-sm">No meal items.</p>
          ) : (
            <ul className="space-y-2">
              {mealItems.map((item) => (
                <li
                  className="flex flex-wrap items-baseline gap-x-3 gap-y-1"
                  key={item.name}
                >
                  <span className="font-medium text-nham-text text-sm">
                    {item.name}
                  </span>
                  <span className="flex flex-wrap gap-1.5">
                    {item.ingredients.map((ing) => (
                      <span
                        className="inline-flex items-baseline gap-1 rounded-full bg-nham-hover px-2 py-0.5 text-nham-text text-xs"
                        key={`${item.name}:${ing.name}`}
                      >
                        <span>{ing.name}</span>
                        <span className="text-nham-text-muted tabular-nums">
                          {ing.estimatedGrams ?? '—'}g
                        </span>
                      </span>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </StageSection>

        {/* Stage 3 — Matching (the diagnostic core) */}
        <StageSection
          id="stage-matching"
          meta={
            <span className="text-nham-text-muted text-xs tabular-nums">
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
          status={matchingStatus}
          title="Matching"
        >
          {!matching.success ? (
            <ParseFallback stage="matching" />
          ) : matched.length + unmatched.length === 0 ? (
            <p className="text-nham-text-muted text-sm">No matches recorded.</p>
          ) : (
            <div className="space-y-3">
              {[...rowsByMeal.entries()].map(([mealName, rows]) => (
                <div className="space-y-1.5" key={mealName}>
                  <p className="text-nham-text-muted text-xs uppercase tracking-wide">
                    {mealName}
                  </p>
                  <ul className="divide-y divide-nham-border/40 rounded-md border border-nham-border/50 bg-nham-track/20">
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
                  <p className="text-nham-danger text-xs uppercase tracking-wide">
                    Unmatched output ({unmatchedOutputRows.length})
                  </p>
                  <ul className="divide-y divide-nham-danger/20 rounded-md border border-nham-danger/30 bg-nham-danger/[0.06]">
                    {unmatchedOutputRows.map((u) => (
                      <li
                        className="flex items-center gap-2 px-3 py-2 text-nham-text text-sm"
                        key={u.ingredientName}
                      >
                        <XCircle
                          aria-hidden
                          className="h-3.5 w-3.5 text-nham-danger"
                        />
                        <span>{u.ingredientName}</span>
                        {u.mealContext && (
                          <span className="text-nham-text-muted text-xs">
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
        </StageSection>

        {/* Stage 4 — Nutrition + Assembly */}
        <StageSection
          id="stage-nutrition"
          meta={
            <span className="text-nham-text-muted text-xs tabular-nums">
              {stagesByName.nutrition?.durationMs ?? '—'} ms est ·{' '}
              {stagesByName.assembly?.durationMs ?? '—'} ms assemble
            </span>
          }
          status={nutritionAssemblyStatus}
          title="Nutrition & assembly"
        >
          {!assembly.success ? (
            <ParseFallback stage="assembly" />
          ) : (
            <AssemblyTotals
              items={assembly.data.mealItems}
              totals={assembly.data.displayedNutrition}
            />
          )}
        </StageSection>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/**
 * One collapsible stage section. Defaults open (so the whole trace is visible
 * at a glance and server-rendered content stays in the DOM) but can be folded
 * away to focus on a single stage. The `id` is the jump-nav scroll target.
 */
function StageSection({
  id,
  status,
  title,
  meta,
  children,
}: {
  id: string;
  status: DiagnosticStageStatus;
  title: string;
  meta?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Collapsible
      className="scroll-mt-28 rounded-md border border-nham-border/50 bg-nham-track/30"
      defaultOpen
      id={id}
    >
      <CollapsibleTrigger className="group flex w-full items-center gap-3 px-3 py-2.5 text-left">
        <StageDot status={status} />
        <div className="flex min-w-0 flex-1 flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <div className="flex min-w-0 items-baseline gap-2">
            <h3 className="font-semibold text-nham-text text-sm">{title}</h3>
            <span className="rounded bg-nham-hover px-1.5 py-0.5 font-medium text-[11px] text-nham-text-muted capitalize">
              {status}
            </span>
          </div>
          {meta}
        </div>
        <ChevronDown
          aria-hidden
          className="h-4 w-4 shrink-0 text-nham-text-muted transition-transform group-data-[state=open]:rotate-180"
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="border-nham-border/40 border-t px-3 py-3">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}

function Metric({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  tone?: MetricTone;
}) {
  return (
    <div className="flex flex-col">
      <span className="text-[11px] text-nham-text-muted uppercase tracking-wide">
        {label}
      </span>
      <span
        className={cn(
          'font-medium text-sm tabular-nums',
          metricToneClass(tone)
        )}
      >
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
    <span className="inline-flex items-center rounded-full bg-nham-hover px-2 py-0.5 font-medium text-nham-text-muted text-xs capitalize">
      {children}
    </span>
  );
}

function MatchRow({ row }: { row: MatchDiagnosticRow }) {
  const isUnmatched = row.confidence === 'unmatched';
  const tone = confidenceTone(row.confidence);
  const sim = row.similarity ?? 0;
  const simPct = Math.max(0, Math.min(1, sim)) * 100;

  return (
    <li className="grid grid-cols-[1fr_auto_1.2fr_auto] items-center gap-x-3 gap-y-1 px-3 py-2 text-nham-text text-sm">
      {/* Source ingredient + grams */}
      <div className="flex min-w-0 items-center gap-2">
        <span
          aria-hidden
          className={cn('inline-block h-2 w-2 shrink-0 rounded-full', tone.dot)}
        />
        <span className="truncate">{row.ingredientName}</span>
        {row.grams !== null && (
          <span className="shrink-0 text-nham-text-muted text-xs tabular-nums">
            {row.grams}g
          </span>
        )}
      </div>

      {/* Arrow */}
      <ArrowRight
        aria-hidden
        className="h-3.5 w-3.5 shrink-0 text-nham-text-muted"
      />

      {/* Match target + similarity bar */}
      {isUnmatched ? (
        <span className="flex items-center gap-1.5 text-nham-danger text-xs">
          <CircleSlash className="h-3.5 w-3.5" aria-hidden />
          no match
        </span>
      ) : (
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate">{row.matchedName}</span>
          <span
            aria-hidden
            className="hidden h-1.5 w-16 shrink-0 overflow-hidden rounded-full bg-nham-track sm:inline-block"
          >
            <span
              className={cn('block h-full', tone.bar)}
              style={{ width: `${simPct}%` }}
            />
          </span>
          <span className="shrink-0 text-nham-text-muted text-xs tabular-nums">
            {sim.toFixed(2)}
          </span>
        </div>
      )}

      {/* Confidence badge */}
      {isUnmatched ? (
        <span
          className={cn(
            'inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-medium text-[11px]',
            tone.badge
          )}
        >
          unmatched
        </span>
      ) : (
        <span
          className={cn(
            'inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-medium text-[11px] capitalize',
            tone.badge
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
          <div className="col-start-3 col-end-5 -mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-nham-text-muted">
            {row.matchType !== null && (
              <span className="inline-flex items-center rounded bg-nham-hover px-1.5 py-0.5 font-medium tabular-nums">
                {row.matchType}
              </span>
            )}
            {row.source !== null && (
              <span className="inline-flex items-center rounded bg-nham-hover px-1.5 py-0.5 font-medium uppercase tabular-nums">
                {row.source}
              </span>
            )}
            {row.viaAlias && (
              <span className="inline-flex items-center rounded bg-amber-500/15 px-1.5 py-0.5 font-medium text-amber-700 dark:bg-amber-400/15 dark:text-amber-300">
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
        <ul className="divide-y divide-nham-border/40 rounded-md border border-nham-border/50">
          {items.map((item) => {
            const kcal = pickMacro(item, 'caloriesKcal');
            const p = pickMacro(item, 'proteinG');
            const c = pickMacro(item, 'carbohydrateG');
            const f = pickMacro(item, 'fatG');
            return (
              <li
                key={item.name}
                className="grid grid-cols-[1fr_auto_auto_auto_auto] items-baseline gap-x-4 gap-y-1 px-3 py-2 text-nham-text text-sm tabular-nums"
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
        <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1 rounded-md bg-nham-track/50 px-3 py-2 text-nham-text text-sm tabular-nums">
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
      <span className="text-[11px] text-nham-text-muted uppercase">
        {label}
      </span>
    </span>
  );
}

function ParseFallback({ stage }: { stage: string }) {
  return (
    <p className="rounded-md border border-nham-border/60 border-dashed bg-nham-track/30 px-3 py-2 text-nham-text-muted text-xs">
      Could not parse <code className="font-mono">{stage}</code> output. See raw
      stage below.
    </p>
  );
}
