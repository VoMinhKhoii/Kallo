import 'server-only';
import { createHash, randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import type { AppDb } from '@/lib/db';
import {
  pipelineLlmCallMetadata,
  pipelineLlmCalls,
  pipelineStageLogs,
  promptVersions,
} from '@/lib/db/schema';

const enabled = () => process.env.PIPELINE_TRACE_ENABLED === 'true';
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
 * Build the GeminiCallTrace + matching promptVersionId promise for an LLM
 * stage. Records the prompt version (cached on code-hash), tracks it in
 * promptVersionsUsed, and returns the trace shape consumed by
 * gemini.generateStructuredOutputStream.
 *
 * Returns `undefined` when `trace` is undefined OR tracing is disabled —
 * keeping the call site free of conditional trace plumbing.
 */
export async function buildLlmStageTrace(args: {
  trace: BuildLlmStageTraceContext | undefined;
  stageLogId: string;
  name: 'decomposition' | 'nutrition';
  builder: (...a: unknown[]) => string;
  templateSample: string;
  model: string;
}): Promise<
  | {
      db: AppDb;
      requestId: string;
      stageLogId: string;
      promptVersionId: string;
      promptRendered: string;
    }
  | undefined
> {
  if (!args.trace || !enabled()) return undefined;
  const pvId = await recordPromptVersion({
    db: args.trace.db,
    name: args.name,
    builder: args.builder,
    templateSample: args.templateSample,
    model: args.model,
  });
  if (!pvId) return undefined;
  args.trace.promptVersionsUsed.set(args.name, pvId);
  return {
    db: args.trace.db,
    requestId: args.trace.requestId,
    stageLogId: args.stageLogId,
    promptVersionId: pvId,
    promptRendered: args.templateSample,
  };
}
