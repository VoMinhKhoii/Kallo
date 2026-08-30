import 'server-only';
import { createHash, randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { readBooleanEnv } from '@/lib/ai/pipeline/config/feature-flags';
import type { AppDb } from '@/lib/infra/db/client';
import {
  pipelineLlmCallMetadata,
  pipelineLlmCalls,
  pipelineStageLogs,
  promptVersions,
} from '@/lib/infra/db/schema';

const enabled = () => readBooleanEnv('PIPELINE_TRACE_ENABLED', false);
const cache = new Map<string, string>(); // `${name}:${hash}` -> id

export function hashPromptBuilder(
  builder: (...a: unknown[]) => string
): string {
  return createHash('sha256').update(builder.toString()).digest('hex');
}

export async function recordPromptVersion(args: {
  db: AppDb;
  name: string;
  builder: (...a: unknown[]) => string;
  templateSample: string;
  model: string;
}): Promise<string | null> {
  if (!enabled()) return null;
  const codeHash = hashPromptBuilder(args.builder);
  const key = `${args.name}:${codeHash}`;
  const cached = cache.get(key);
  if (cached) return cached;
  try {
    const inserted = await args.db
      .insert(promptVersions)
      .values({
        name: args.name,
        codeHash,
        templateSample: args.templateSample,
        model: args.model,
        gitSha:
          process.env.GIT_COMMIT_SHA ??
          process.env.VERCEL_GIT_COMMIT_SHA ??
          null,
      })
      .onConflictDoNothing({
        target: [promptVersions.name, promptVersions.codeHash],
      })
      .returning({ id: promptVersions.id });
    let id = inserted[0]?.id;
    if (!id) {
      const found = await args.db
        .select({ id: promptVersions.id })
        .from(promptVersions)
        .where(
          and(
            eq(promptVersions.name, args.name),
            eq(promptVersions.codeHash, codeHash)
          )
        )
        .limit(1);
      id = found[0]?.id;
    }
    if (id) cache.set(key, id);
    return id ?? null;
  } catch (e) {
    console.error('[trace] recordPromptVersion failed', e);
    return null;
  }
}

export interface StageLogArgs {
  db: AppDb;
  requestId: string;
  stageLogId: string;
  stage: 'decomposition' | 'matching' | 'nutrition' | 'assembly';
  stageIndex: number;
  inputJson: unknown;
  outputJson: unknown;
  status: 'success' | 'error' | 'skipped';
  error?: string;
  durationMs: number;
}

export function logStage(a: StageLogArgs): void {
  if (!enabled()) return;
  void a.db
    .insert(pipelineStageLogs)
    .values({
      id: a.stageLogId,
      requestId: a.requestId,
      stage: a.stage,
      stageIndex: a.stageIndex,
      inputJson: a.inputJson as object,
      outputJson: a.outputJson as object,
      status: a.status,
      error: a.error ?? null,
      durationMs: a.durationMs,
    })
    .catch((e) => console.error('[trace] logStage failed', e));
}

export interface LlmCallArgs {
  db: AppDb;
  requestId: string;
  stageLogId: string;
  /**
   * Accepts a Promise so the caller can fire recordPromptVersion in parallel
   * with the LLM call; we await it here before inserting (FK requirement).
   */
  promptVersionId: string | Promise<string | null>;
  model: string;
  promptRendered: string;
  responseRaw: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  latencyMs: number;
  attempt: number;
  error?: string;
  metadata?: LlmCallMetadataArgs;
}

export interface LlmCallMetadataArgs {
  provider?: string | null;
  region?: string | null;
  cacheStatus?: string | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
  cachedTokens?: number | null;
  thoughtTokens?: number | null;
  /** Rendered system + user message characters measured before provider call. */
  promptChars?: number | null;
  /** Serialized response JSON schema characters measured before provider call. */
  schemaChars?: number | null;
}

export function logLlmCall(a: LlmCallArgs): void {
  if (!enabled()) return;
  void Promise.resolve(a.promptVersionId)
    .then(async (resolvedId) => {
      // Skip the insert if the prompt-version row never materialized — the
      // FK would reject it anyway.
      if (!resolvedId) return;
      const llmCallId = randomUUID();
      await a.db.insert(pipelineLlmCalls).values({
        id: llmCallId,
        requestId: a.requestId,
        stageLogId: a.stageLogId,
        promptVersionId: resolvedId,
        model: a.model,
        promptRendered: a.promptRendered,
        responseRaw: a.responseRaw,
        inputTokens: a.inputTokens,
        outputTokens: a.outputTokens,
        latencyMs: a.latencyMs,
        attempt: a.attempt,
        error: a.error ?? null,
      });
      await a.db.insert(pipelineLlmCallMetadata).values({
        llmCallId,
        provider: a.metadata?.provider ?? null,
        region: a.metadata?.region ?? null,
        cacheStatus: a.metadata?.cacheStatus ?? null,
        inputTokens: a.metadata?.inputTokens ?? null,
        outputTokens: a.metadata?.outputTokens ?? null,
        cachedTokens: a.metadata?.cachedTokens ?? null,
        thoughtTokens: a.metadata?.thoughtTokens ?? null,
        promptChars: a.metadata?.promptChars ?? null,
        schemaChars: a.metadata?.schemaChars ?? null,
      });
    })
    .catch((e) => console.error('[trace] logLlmCall failed', e));
}

// Test-only escape hatch.
export function _resetPromptVersionCacheForTests() {
  cache.clear();
}

/**
 * Minimal trace context shape consumed by buildLlmStageTrace. Mirrors a
 * subset of orchestrator's AnalyzeMealTraceContext but is declared here to
 * avoid a circular import.
 */
export interface BuildLlmStageTraceContext {
  requestId: string;
  db: AppDb;
  promptVersionsUsed: Map<string, string>;
}

/**
 * Build the GeminiCallTrace for an LLM stage. Returns synchronously with
 * `promptVersionId` as a Promise so the recordPromptVersion DB roundtrip
 * runs in parallel with the Gemini call instead of blocking it
 * (~30-100 ms saved on cold-start before the in-process cache warms up).
 * `logLlmCall` already accepts `string | Promise<string | null>` and awaits
 * internally before its FK-bearing insert.
 *
 * Returns `undefined` when `trace` is undefined OR tracing is disabled —
 * keeping the call site free of conditional trace plumbing.
 */
export function buildLlmStageTrace(args: {
  trace: BuildLlmStageTraceContext | undefined;
  stageLogId: string;
  /**
   * Prompt name as recorded in `prompt_versions` (and surfaced in the admin
   * /prompts catalog). v1 uses `decomposition` / `nutrition`; v2 (the
   * grounded pipeline) uses `decomposition-grounded` / `grounded-estimation`
   * so admin can distinguish which prompt version each request used. The
   * `:global` suffix marks the global locale block-set (`promptTraceName`) —
   * without it, both locales would collapse into one version row because
   * `hashPromptBuilder` hashes builder source, identical across locales.
   */
  name:
    | 'decomposition'
    | 'nutrition'
    | 'decomposition-grounded'
    | 'decomposition-grounded:global'
    | 'grounded-estimation'
    | 'grounded-estimation:global';
  builder: (...a: unknown[]) => string;
  templateSample: string;
  model: string;
}):
  | {
      db: AppDb;
      requestId: string;
      stageLogId: string;
      promptVersionId: Promise<string | null>;
      promptRendered: string;
    }
  | undefined {
  if (!args.trace || !enabled()) return undefined;
  const traceCtx = args.trace;
  const pvIdPromise = recordPromptVersion({
    db: traceCtx.db,
    name: args.name,
    builder: args.builder,
    templateSample: args.templateSample,
    model: args.model,
  }).then((pvId) => {
    if (pvId) {
      traceCtx.promptVersionsUsed.set(args.name, pvId);
    }
    return pvId;
  });
  return {
    db: traceCtx.db,
    requestId: traceCtx.requestId,
    stageLogId: args.stageLogId,
    promptVersionId: pvIdPromise,
    promptRendered: args.templateSample,
  };
}
