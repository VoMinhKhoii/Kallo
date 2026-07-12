import { count, desc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';

import type { AppDb } from '@/lib/db';
import {
  pipelineLlmCalls,
  pipelineRequests,
  promptVersions,
} from '@/lib/db/schema';

// ─── Filters schema ───────────────────────────────────────────────────────────

const uuidSchema = z.string().uuid();

export async function listPrompts(db: AppDb) {
  const rows = await db
    .select({
      name: promptVersions.name,
      versionCount: count(promptVersions.id),
      latestSeenAt: sql<Date>`max(${promptVersions.firstSeenAt})`,
    })
    .from(promptVersions)
    .groupBy(promptVersions.name)
    .orderBy(desc(sql`max(${promptVersions.firstSeenAt})`));

  return rows;
}

export async function getPromptVersions(db: AppDb, name: string) {
  return db
    .select()
    .from(promptVersions)
    .where(eq(promptVersions.name, name))
    .orderBy(desc(promptVersions.firstSeenAt));
}

export async function getRequestsForVersion(
  db: AppDb,
  versionId: string,
  page = 1,
  pageSize = 50
) {
  if (!uuidSchema.safeParse(versionId).success) return { rows: [], total: 0 };

  // pipeline_requests.prompt_versions_used is jsonb; we use a text search
  // via the LLM calls join instead, which has a proper FK.
  const subquery = db
    .selectDistinct({ requestId: pipelineLlmCalls.requestId })
    .from(pipelineLlmCalls)
    .where(eq(pipelineLlmCalls.promptVersionId, versionId))
    .as('sub');

  const [rows, [{ value: total }]] = await Promise.all([
    db
      .select({
        id: pipelineRequests.id,
        userId: pipelineRequests.userId,
        status: pipelineRequests.status,
        durationMs: pipelineRequests.durationMs,
        createdAt: pipelineRequests.createdAt,
        rawInput: pipelineRequests.rawInput,
        error: pipelineRequests.error,
      })
      .from(pipelineRequests)
      .innerJoin(subquery, eq(pipelineRequests.id, subquery.requestId))
      .orderBy(desc(pipelineRequests.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db
      .select({ value: count() })
      .from(pipelineRequests)
      .innerJoin(subquery, eq(pipelineRequests.id, subquery.requestId)),
  ]);

  return { rows, total: Number(total) };
}

// ─── Health aggregates ────────────────────────────────────────────────────────
