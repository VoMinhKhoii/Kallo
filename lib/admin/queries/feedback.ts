import { and, count, desc, eq } from 'drizzle-orm';
import { z } from 'zod';

import {
  FEEDBACK_PLATFORMS,
  FEEDBACK_TYPES,
} from '@/lib/api/contracts/feedback';
import { uuidSchema } from '@/lib/core/validation/primitives';
import type { AppDb } from '@/lib/infra/db';
import { userFeedback } from '@/lib/infra/db/schema';

export const FEEDBACK_STATUSES = [
  'open',
  'triaged',
  'resolved',
  'wontfix',
] as const;
export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number];

/** Human labels for the raw enum values (admin display only). */
export const FEEDBACK_STATUS_LABELS: Record<string, string> = {
  open: 'Open',
  triaged: 'Triaged',
  resolved: 'Resolved',
  wontfix: "Won't fix",
};

export const FEEDBACK_TYPE_LABELS: Record<string, string> = {
  bug: 'Bug',
  ingredient: 'Ingredient request',
  idea: 'Idea',
};

// URLSearchParams sends strings; `all` collapses a filter to "no constraint".
const allOr = <T extends readonly [string, ...string[]]>(values: T) =>
  z
    .union([z.enum(values), z.literal('all').transform(() => undefined)])
    .optional();

export const feedbackFiltersSchema = z.object({
  type: allOr(FEEDBACK_TYPES),
  status: allOr(FEEDBACK_STATUSES),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(50),
});

export type FeedbackFilters = z.output<typeof feedbackFiltersSchema>;

export type FeedbackListRow = Pick<
  typeof userFeedback.$inferSelect,
  | 'id'
  | 'type'
  | 'status'
  | 'message'
  | 'platform'
  | 'locale'
  | 'screenshotPath'
  | 'createdAt'
>;

export type FeedbackDetail = typeof userFeedback.$inferSelect;

export function buildFeedbackWhere(
  filter: Pick<FeedbackFilters, 'type' | 'status'>
) {
  const conditions = [];
  if (filter.type) conditions.push(eq(userFeedback.type, filter.type));
  if (filter.status) conditions.push(eq(userFeedback.status, filter.status));
  return conditions;
}

export async function listFeedback(
  db: AppDb,
  opts: {
    filter?: Partial<Pick<FeedbackFilters, 'type' | 'status'>>;
    page?: number;
    pageSize?: number;
  } = {}
) {
  const { filter = {}, page = 1, pageSize = 50 } = opts;
  const where = buildFeedbackWhere({
    type: filter.type,
    status: filter.status,
  });
  const whereClause = where.length > 0 ? and(...where) : undefined;

  const [rows, [{ value: total }]] = await Promise.all([
    db
      .select({
        id: userFeedback.id,
        type: userFeedback.type,
        status: userFeedback.status,
        message: userFeedback.message,
        platform: userFeedback.platform,
        locale: userFeedback.locale,
        screenshotPath: userFeedback.screenshotPath,
        createdAt: userFeedback.createdAt,
      })
      .from(userFeedback)
      .where(whereClause)
      .orderBy(desc(userFeedback.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ value: count() }).from(userFeedback).where(whereClause),
  ]);

  return { rows: rows satisfies FeedbackListRow[], total: Number(total) };
}

export async function getFeedbackDetail(
  db: AppDb,
  id: string
): Promise<FeedbackDetail | null> {
  if (!uuidSchema.safeParse(id).success) return null;
  const [row] = await db
    .select()
    .from(userFeedback)
    .where(eq(userFeedback.id, id))
    .limit(1);
  return row ?? null;
}

export { FEEDBACK_TYPES, FEEDBACK_PLATFORMS };
