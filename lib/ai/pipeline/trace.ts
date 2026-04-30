import 'server-only';
import { createHash } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import type { AppDb } from '@/lib/db';
import {
  pipelineLlmCalls,
  pipelineStageLogs,
  promptVersions,
} from '@/lib/db/schema';

const enabled = () => process.env.PIPELINE_TRACE_ENABLED !== 'false';
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
  promptVersionId: string;
  model: string;
  promptRendered: string;
  responseRaw: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  latencyMs: number;
  attempt: number;
  error?: string;
}

export function logLlmCall(a: LlmCallArgs): void {
  if (!enabled()) return;
  void a.db
    .insert(pipelineLlmCalls)
    .values({
      requestId: a.requestId,
      stageLogId: a.stageLogId,
      promptVersionId: a.promptVersionId,
      model: a.model,
      promptRendered: a.promptRendered,
      responseRaw: a.responseRaw,
      inputTokens: a.inputTokens,
      outputTokens: a.outputTokens,
      latencyMs: a.latencyMs,
      attempt: a.attempt,
      error: a.error ?? null,
    })
    .catch((e) => console.error('[trace] logLlmCall failed', e));
}

// Test-only escape hatch.
export function _resetPromptVersionCacheForTests() {
  cache.clear();
}
