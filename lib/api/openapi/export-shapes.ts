import { type Column, getTableColumns, type Table } from 'drizzle-orm';
import type { JsonSchema } from '@/lib/api/openapi/components';
import { AUTH_CLAIM_KEYS } from '@/lib/domain/account-export/build-export';
import {
  billingProviderSyncs,
  bodyWeightLog,
  chatGroupMessages,
  chatGroups,
  circleEvents,
  coachAssignments,
  dayCompletionMarks,
  entitlementGrants,
  friendships,
  mealItems,
  mealShareInvites,
  mealShareReactions,
  mealShareReplies,
  mealShares,
  meals,
  notifications,
  pendingAnalyses,
  pipelineRequests,
  productTelemetryEvents,
  publicProfiles,
  pushTokens,
  unmatchedIngredients,
  userFeedback,
  userProfiles,
} from '@/lib/infra/db/schema';

/**
 * The `DataExport` response schema for `GET /api/v1/account`.
 *
 * Most sections are rows (or column picks) of a table, so their property
 * schemas are derived from the Drizzle columns rather than transcribed: a
 * column's type and nullability cannot drift from the spec, and
 * `__tests__/export-shapes.test.ts` checks a built export against the whole
 * schema. Derived fields (a friend's id, a direction, a redacted token) are
 * spelled out by hand.
 */

const nullable = (schema: JsonSchema): JsonSchema => ({
  ...schema,
  type: [schema.type, 'null'],
});
const uuid: JsonSchema = { type: 'string', format: 'uuid' };
const dateTime: JsonSchema = { type: 'string', format: 'date-time' };
const anyJson: JsonSchema = { description: 'Free-form JSON.' };

function columnSchema(column: Column): JsonSchema {
  const base = ((): JsonSchema => {
    switch (column.columnType) {
      case 'PgUUID':
        return uuid;
      case 'PgDateString':
        return { type: 'string', format: 'date' };
      case 'PgNumeric':
        return { type: 'string', description: 'Decimal, as a string.' };
      case 'PgInteger':
      case 'PgSmallInt':
      case 'PgSerial':
        return { type: 'integer' };
      case 'PgArray':
        return { type: 'array', items: uuid };
      default:
        break;
    }
    switch (column.dataType) {
      case 'number':
        return { type: 'number' };
      case 'boolean':
        return { type: 'boolean' };
      case 'date':
        return dateTime;
      case 'json':
        return anyJson;
      default:
        return { type: 'string' };
    }
  })();
  if (column.notNull || !('type' in base)) return base;
  return nullable(base);
}

/** Property schemas for `keys` of `table` (every column when omitted). */
function columns(table: Table, keys?: string[]): Record<string, JsonSchema> {
  const all = getTableColumns(table) as Record<string, Column>;
  return Object.fromEntries(
    (keys ?? Object.keys(all)).map((key) => [key, columnSchema(all[key])])
  );
}

function object(
  properties: Record<string, JsonSchema>,
  description?: string
): JsonSchema {
  return {
    type: 'object',
    additionalProperties: false,
    required: Object.keys(properties),
    properties,
    ...(description ? { description } : {}),
  };
}

const list = (items: JsonSchema, description?: string): JsonSchema => ({
  type: 'array',
  items,
  ...(description ? { description } : {}),
});

/** Allowlisted Supabase Auth profile claims; each appears only when stored. */
const authClaims: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: Object.fromEntries(
    AUTH_CLAIM_KEYS.map((key) => [key, { type: ['string', 'boolean'] }])
  ),
  description:
    'Profile claims from Supabase Auth (sign-up form, Google, Apple), limited to an allowlist. Tokens and app_metadata are never included.',
};

export const EXPORT_SCHEMAS: Record<string, JsonSchema> = {
  DataExport: object(
    {
      exportedAt: dateTime,
      account: object({
        id: uuid,
        email: nullable({ type: 'string' }),
        createdAt: nullable(dateTime),
        lastSignInAt: nullable(dateTime),
        signInProviders: list({ type: 'string' }),
        profileClaims: authClaims,
        identities: list(
          object({
            provider: nullable({ type: 'string' }),
            identityId: nullable(uuid),
            providerUserId: nullable({ type: 'string' }),
            createdAt: nullable(dateTime),
            lastSignInAt: nullable(dateTime),
            updatedAt: nullable(dateTime),
            claims: authClaims,
          }),
          'Linked sign-in identities (email, Google, Apple).'
        ),
      }),
      profile: nullable(object(columns(userProfiles))),
      meals: list(
        object({
          ...columns(meals),
          items: list(object(columns(mealItems))),
        })
      ),
      weights: list(object(columns(bodyWeightLog))),
      billingGrants: list(object(columns(entitlementGrants))),
      formatVersion: {
        type: 'integer',
        description:
          'Bumped only when a key is renamed or removed; adding keys keeps the version.',
      },
      circleProfile: nullable(
        object(
          columns(publicProfiles, [
            'handle',
            'displayName',
            'avatarSeed',
            'avatarUrl',
            'avatarPath',
            'createdAt',
            'updatedAt',
          ]),
          'The Circle identity friends see. `avatarPath` is a Storage object path; the photo itself is listed under `files`.'
        )
      ),
      dayCompletionMarks: list(
        object(columns(dayCompletionMarks, ['id', 'localDate', 'createdAt']))
      ),
      social: object({
        friendships: list(
          object({
            id: uuid,
            friendUserId: uuid,
            friendHandle: nullable({ type: 'string' }),
            ...columns(friendships, [
              'status',
              'acceptedAt',
              'createdAt',
              'updatedAt',
            ]),
            requestedByMe: { type: 'boolean' },
          }),
          'Pending and accepted connections. Blocked edges are not exported.'
        ),
        mealShares: list(
          object(
            columns(mealShares, ['id', 'mealId', 'visibility', 'sharedAt'])
          )
        ),
        reactions: list(
          object(
            columns(mealShareReactions, ['id', 'shareId', 'kind', 'createdAt'])
          ),
          'Reactions the caller left.'
        ),
        replies: list(
          object(
            columns(mealShareReplies, ['id', 'shareId', 'body', 'createdAt'])
          ),
          'Replies the caller wrote.'
        ),
        mealShareInvites: list(
          object({
            id: uuid,
            direction: { type: 'string', enum: ['sent', 'received'] },
            counterpartUserId: uuid,
            ...columns(mealShareInvites, [
              'sourceMealId',
              'mode',
              'portionFactor',
              'copyFactor',
              'status',
            ]),
            acceptedMealId: nullable(uuid),
            ...columns(mealShareInvites, ['createdAt', 'respondedAt']),
          })
        ),
        circleEvents: list(
          object(
            columns(circleEvents, [
              'id',
              'type',
              'refId',
              'audience',
              'createdAt',
            ])
          )
        ),
        feedLastReadAt: nullable(dateTime),
        coachAssignments: list(
          object({
            id: uuid,
            role: { type: 'string', enum: ['coach', 'client'] },
            counterpartUserId: uuid,
            ...columns(coachAssignments, ['rank', 'status', 'createdAt']),
          })
        ),
      }),
      chat: object({
        groups: list(
          object({
            ...columns(chatGroups, ['id', 'kind', 'name', 'avatarSeed']),
            createdByMe: { type: 'boolean' },
            myRole: nullable({ type: 'string' }),
            joinedAt: nullable(dateTime),
            lastReadAt: nullable(dateTime),
            memberUserIds: list(uuid),
            ...columns(chatGroups, ['createdAt', 'updatedAt']),
          }),
          'Chats the caller belongs to or created. Other members appear as ids only.'
        ),
        messagesSent: list(
          object(
            columns(chatGroupMessages, ['id', 'groupId', 'body', 'createdAt'])
          ),
          'Messages the caller sent. Other members’ messages are theirs and are not exported.'
        ),
      }),
      notifications: list(
        object(
          columns(notifications, [
            'id',
            'type',
            'actorIds',
            'actorCount',
            'objectType',
            'objectId',
            'targetType',
            'targetId',
            'data',
            'createdAt',
            'updatedAt',
            'seenAt',
            'readAt',
            'dismissedAt',
          ])
        )
      ),
      pushDevices: list(
        object({
          ...columns(pushTokens, ['id', 'platform', 'lastSeenAt', 'createdAt']),
          tokenHint: {
            type: 'string',
            description:
              'The last characters of the device token only; the full token is never exported.',
          },
        })
      ),
      support: object({
        feedback: list(
          object(
            columns(userFeedback, [
              'id',
              'type',
              'message',
              'screenshotPath',
              'appVersion',
              'platform',
              'locale',
              'route',
              'metadata',
              'status',
              'createdAt',
              'updatedAt',
            ])
          )
        ),
      }),
      billingSyncs: list(
        object(
          columns(billingProviderSyncs, [
            'id',
            'source',
            'environment',
            'providerSyncedAt',
            'ownershipEventAt',
            'ownershipRevoked',
            'customerMissingSince',
            'updatedAt',
          ])
        )
      ),
      analysis: object({
        requests: list(
          object({
            ...columns(pipelineRequests, ['id', 'rawInput']),
            userContext: anyJson,
            ...columns(pipelineRequests, ['status', 'durationMs', 'createdAt']),
          }),
          'Meal-analysis requests still held (they are kept for a short window).'
        ),
        pending: list(
          object(
            columns(pendingAnalyses, [
              'id',
              'rawInput',
              'pipelineResult',
              'entryMode',
              'pipelineRequestId',
              'sourceInviteId',
              'loggedAt',
              'expiresAt',
              'createdAt',
            ])
          )
        ),
        unmatchedIngredients: list(
          object(
            columns(unmatchedIngredients, [
              'id',
              'mealId',
              'queryText',
              'mealContext',
              'createdAt',
            ])
          )
        ),
      }),
      telemetry: list(
        object(
          columns(productTelemetryEvents, [
            'eventId',
            'eventName',
            'occurredAt',
            'platform',
            'appVersion',
            'locale',
            'sessionId',
            'anonymousId',
            'consent',
            'pipelineRequestId',
            'mealId',
            'properties',
            'receivedAt',
          ])
        )
      ),
      files: list(
        object({
          bucket: { type: 'string', enum: ['avatars', 'feedback-screenshots'] },
          path: { type: 'string' },
          source: { type: 'string', enum: ['circleProfile', 'feedback'] },
          sourceId: nullable(uuid),
        }),
        'Storage objects Kallo holds for the caller, as bucket + object path. The bytes are not inlined.'
      ),
    },
    'Everything Kallo stores about the caller. The first six keys are the version-1 document and never change shape; later keys are additive. Tables deliberately left out, and why, are listed in lib/domain/account-export/coverage.ts.'
  ),
};
