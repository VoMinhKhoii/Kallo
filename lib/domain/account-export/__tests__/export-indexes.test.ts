import { getTableName } from 'drizzle-orm';
import {
  getTableConfig,
  IndexedColumn,
  type PgTable,
} from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';
import * as schema from '@/lib/infra/db/schema';

// ---------------------------------------------------------------------------
// Every "Export my data" query filters a table by a user column. Postgres does
// not index foreign keys on its own, so without an index leading with that
// column each export is a sequential scan of the whole table — and the same
// columns drive the ON DELETE CASCADE when an account is deleted. This holds
// each lookup in lib/domain/account-export/ against the Drizzle schema.
// ---------------------------------------------------------------------------

/** [table, user column] pairs the export filters by (SQL names). */
const EXPORT_LOOKUPS: ReadonlyArray<readonly [PgTable, string]> = [
  [schema.pipelineRequests, 'user_id'],
  [schema.pendingAnalyses, 'user_id'],
  [schema.unmatchedIngredients, 'user_id'],
  [schema.productTelemetryEvents, 'user_id'],
  [schema.entitlementGrants, 'user_id'],
  [schema.billingProviderSyncs, 'user_id'],
  [schema.chatGroupMembers, 'user_id'],
  [schema.chatGroups, 'created_by'],
  [schema.chatGroupMessages, 'sender_id'],
  [schema.meals, 'user_id'],
  [schema.bodyWeightLog, 'user_id'],
  [schema.dayCompletionMarks, 'user_id'],
  [schema.notifications, 'recipient_id'],
  [schema.pushTokens, 'user_id'],
  [schema.userProfiles, 'user_id'],
  [schema.publicProfiles, 'user_id'],
  [schema.friendships, 'user_low'],
  [schema.friendships, 'user_high'],
  [schema.mealShares, 'actor_id'],
  [schema.mealShareReactions, 'user_id'],
  [schema.mealShareReplies, 'user_id'],
  [schema.mealShareInvites, 'from_user_id'],
  [schema.mealShareInvites, 'to_user_id'],
  [schema.circleEvents, 'actor_id'],
  [schema.friendsFeedReadMarkers, 'user_id'],
  [schema.userFeedback, 'user_id'],
  [schema.coachAssignments, 'coach_id'],
  [schema.coachAssignments, 'client_id'],
];

/** First column of every usable (non-partial) index, unique or primary key. */
function leadingColumns(table: PgTable): Set<string> {
  const config = getTableConfig(table);
  const leads = new Set<string>();
  for (const column of config.columns) {
    if (column.primary || column.isUnique) leads.add(column.name);
  }
  for (const pk of config.primaryKeys) leads.add(pk.columns[0].name);
  for (const uq of config.uniqueConstraints) leads.add(uq.columns[0].name);
  for (const idx of config.indexes) {
    const first = idx.config.columns[0];
    // A partial index only serves queries that repeat its predicate.
    if (!idx.config.where && first instanceof IndexedColumn && first.name) {
      leads.add(first.name);
    }
  }
  return leads;
}

describe('account export lookups', () => {
  it.each(
    EXPORT_LOOKUPS.map(
      ([table, column]) => [getTableName(table), column, table] as const
    )
  )('%s is indexed by %s', (_name, column, table) => {
    expect(leadingColumns(table)).toContain(column);
  });
});
