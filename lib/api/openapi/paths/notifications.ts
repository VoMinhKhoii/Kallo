import {
  authed,
  fromZod,
  type JsonSchema,
  type Parameter,
  type PathItem,
  ref,
} from '@/lib/api/openapi/components';
import {
  markReadBodySchema,
  markSeenBodySchema,
} from '@/lib/domain/notifications/contracts';

const TAGS = ['Activity'];

const beforeParam: Parameter = {
  name: 'before',
  in: 'query',
  required: false,
  description:
    'Cursor: return notifications older than this one. Omit for the newest page.',
  schema: { type: 'string' },
};

const limitParam: Parameter = {
  name: 'limit',
  in: 'query',
  required: false,
  description: 'Page size, 1–50. Defaults to 25.',
  schema: { type: 'integer', minimum: 1, maximum: 50, default: 25 },
};

const notificationItem: JsonSchema = {
  type: 'object',
  description:
    'One activity row. Several people acting on the same object collapse into a single row while it is unread: `actors` holds the three most recent, `actorCount` the true total.',
  properties: {
    id: { type: 'string', format: 'uuid' },
    type: {
      type: 'string',
      enum: [
        'friend.joined',
        'group.added',
        'share.invite',
        'share.invite_accepted',
        'share.reaction',
        'share.reply',
        'share.logged',
      ],
    },
    actors: { type: 'array', items: ref('PublicProfile') },
    actorCount: { type: 'integer' },
    objectType: { type: ['string', 'null'] },
    objectId: { type: ['string', 'null'], format: 'uuid' },
    targetType: { type: ['string', 'null'] },
    targetId: { type: ['string', 'null'], format: 'uuid' },
    data: { type: ['object', 'null'], additionalProperties: true },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
    seenAt: { type: ['string', 'null'], format: 'date-time' },
    readAt: { type: ['string', 'null'], format: 'date-time' },
    invite: {
      type: ['object', 'null'],
      description:
        'Live status of the copy/split offer a `share.invite` row points at, joined at read time so acting from anywhere stays consistent.',
      properties: {
        status: { type: 'string', enum: ['pending', 'accepted', 'dismissed'] },
      },
    },
  },
};

/** The activity feed and its two read-state writes. */
export const NOTIFICATION_PATHS: Record<string, PathItem> = {
  '/api/v1/notifications': {
    get: authed({
      operationId: 'listNotifications',
      summary: 'The caller’s activity feed',
      description:
        'A page of activity addressed to the caller, newest first, plus the current unseen count so opening the page costs one round trip.',
      tags: TAGS,
      parameters: [beforeParam, limitParam],
      ok: {
        type: 'object',
        properties: {
          items: { type: 'array', items: notificationItem },
          nextCursor: { type: ['string', 'null'] },
          unseenCount: { type: 'integer' },
        },
      },
    }),
  },

  '/api/v1/notifications/badge': {
    get: authed({
      operationId: 'getNotificationBadge',
      summary: 'Unseen activity count',
      description: 'Backs the nav badge without downloading the feed.',
      tags: TAGS,
      ok: {
        type: 'object',
        properties: { unseen: { type: 'integer' } },
      },
    }),
  },

  '/api/v1/notifications/seen': {
    post: authed({
      operationId: 'markNotificationsSeen',
      summary: 'Clear the activity badge',
      description:
        'Marks everything created at or before `before` as seen. Pass the newest item the caller actually saw, so activity arriving mid-visit still badges.',
      tags: TAGS,
      body: fromZod(markSeenBodySchema),
      ok: {
        type: 'object',
        properties: { seen: { type: 'integer' } },
      },
    }),
  },

  '/api/v1/notifications/read': {
    post: authed({
      operationId: 'markNotificationsRead',
      summary: 'Mark activity rows read',
      description:
        'Dims the named rows (and marks them seen). Ids belonging to someone else are ignored.',
      tags: TAGS,
      body: fromZod(markReadBodySchema),
      ok: {
        type: 'object',
        properties: { read: { type: 'integer' } },
      },
    }),
  },
};
