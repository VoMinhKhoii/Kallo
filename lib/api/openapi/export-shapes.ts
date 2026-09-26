import {
  anyJson,
  columns,
  dateTime,
  list,
  nullable,
  object,
  uuid,
} from '@/lib/api/openapi/column-schemas';
import type { JsonSchema } from '@/lib/api/openapi/components';
import { AUTH_CLAIM_KEYS } from '@/lib/domain/account-export/build-export';
import { NUTRITION_LABEL_BUCKET } from '@/lib/domain/nutrition/label-images/bucket';
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
  nutritionLabelImages,
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
      labelScans: list(
        object(
          columns(nutritionLabelImages, [
            'id',
            'mimeType',
            'byteSize',
            'status',
            'result',
            'errorCode',
            'mealId',
            'reviewedResult',
            'createdAt',
          ])
        ),
        'Nutrition-label scans whose photo was kept: what was read (`result`) or why not (`errorCode`), and the values saved for the linked meal. Each photo is listed under `files`.'
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
          bucket: {
            type: 'string',
            enum: ['avatars', 'feedback-screenshots', NUTRITION_LABEL_BUCKET],
          },
          path: { type: 'string' },
          source: {
            type: 'string',
            enum: ['circleProfile', 'feedback', 'labelScan'],
          },
          sourceId: nullable(uuid),
        }),
        'Storage objects Kallo holds for the caller, as bucket + object path. The bytes are not inlined.'
      ),
    },
    'Everything Kallo stores about the caller. The first six keys are the version-1 document and never change shape; later keys are additive. Tables deliberately left out, and why, are listed in lib/domain/account-export/coverage.ts.'
  ),
};
