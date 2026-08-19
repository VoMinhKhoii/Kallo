import type { InferSelectModel } from 'drizzle-orm';
import { z } from 'zod';
import type {
  getRequestDetail,
  RequestDetailLlmCall,
} from '@/lib/admin/queries/requests';
import type {
  pipelineLlmCalls,
  pipelineStageLogs,
} from '@/lib/infra/db/schema';

/**
 * Shaping one `pipeline_requests` row's raw trace into what the request-detail
 * page renders: the stage/LLM-call join, the two-trace compare alignment, and
 * the prompt-versions blob guard.
 */

type StageLog = InferSelectModel<typeof pipelineStageLogs>;
type BaseLlmCall = InferSelectModel<typeof pipelineLlmCalls>;

/**
 * A detail-page call row is either the plain table row or the query's
 * metadata-joined variant, depending on which loader produced it.
 */
export type TimelineLlmCall = BaseLlmCall | RequestDetailLlmCall;

export type CompareLabel = 'unchanged' | 'changed' | 'only-here';

export interface StageWithCalls {
  stage: StageLog;
  calls: TimelineLlmCall[];
  compareLabel?: CompareLabel;
}

/**
 * Validate the `pipeline_requests.prompt_versions_used` JSONB blob before
 * passing it to the version badge. The DB column is typed `unknown` after
 * Drizzle's `$type<>()`; an unexpected shape (legacy rows, manual SQL
 * edits, or a future schema change) must not crash the admin page.
 *
 * Per repo guidelines: validate all external inputs with Zod schemas.
 */
const promptVersionsUsedSchema = z.record(z.string(), z.string()).nullable();

export function parsePromptVersionsUsed(
  raw: unknown
): Record<string, string> | null {
  const result = promptVersionsUsedSchema.safeParse(raw ?? null);
  return result.success ? result.data : null;
}

function sortJsonKeys(value: unknown): unknown {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(sortJsonKeys);

  const record = value as Record<string, unknown>;
  return Object.keys(record)
    .sort()
    .reduce<Record<string, unknown>>((sorted, key) => {
      sorted[key] = sortJsonKeys(record[key]);
      return sorted;
    }, {});
}

const stableJsonString = (value: unknown): string =>
  JSON.stringify(sortJsonKeys(value));

/** Align two stage arrays by stageIndex and compute compare labels. */
export function computeCompareDiff(
  leftStages: StageWithCalls[],
  rightStages: StageWithCalls[]
): {
  left: StageWithCalls[];
  right: StageWithCalls[];
} {
  const rightByIndex = new Map(rightStages.map((s) => [s.stage.stageIndex, s]));
  const leftByIndex = new Map(leftStages.map((s) => [s.stage.stageIndex, s]));

  const allIndexes = new Set([
    ...leftStages.map((s) => s.stage.stageIndex),
    ...rightStages.map((s) => s.stage.stageIndex),
  ]);

  const newLeft: StageWithCalls[] = [];
  const newRight: StageWithCalls[] = [];

  for (const idx of [...allIndexes].sort((a, b) => a - b)) {
    const l = leftByIndex.get(idx);
    const r = rightByIndex.get(idx);

    let label: CompareLabel;
    if (!l) {
      label = 'only-here';
    } else if (!r) {
      label = 'only-here';
    } else {
      label =
        stableJsonString(l.stage.outputJson) ===
        stableJsonString(r.stage.outputJson)
          ? 'unchanged'
          : 'changed';
    }

    if (l) newLeft.push({ ...l, compareLabel: label });
    if (r) newRight.push({ ...r, compareLabel: label });
  }

  return { left: newLeft, right: newRight };
}

/** Join llmCalls into stages in-memory (stageLogId is not a DB FK). */
export function buildStagesWithCalls(
  detail: NonNullable<Awaited<ReturnType<typeof getRequestDetail>>>
): StageWithCalls[] {
  return detail.stageLogs.map((stage) => ({
    stage,
    calls: detail.llmCalls.filter((c) => c.stageLogId === stage.id),
  }));
}
