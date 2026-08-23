import {
  authed,
  type JsonSchema,
  type Parameter,
  type PathItem,
  ref,
} from '@/lib/api/openapi/components';

const TAGS = ['Circle'];

const targetUserBody: JsonSchema = {
  type: 'object',
  required: ['targetUserId'],
  properties: {
    targetUserId: {
      type: 'string',
      format: 'uuid',
      description: 'The other person in the connection.',
    },
  },
};

const inviteIdBody = (extra: JsonSchema = {}): JsonSchema => ({
  type: 'object',
  required: ['inviteId'],
  properties: {
    inviteId: {
      type: 'string',
      format: 'uuid',
      description: 'The invite to act on.',
    },
    ...(extra.properties as Record<string, JsonSchema> | undefined),
  },
});

const beforeParam: Parameter = {
  name: 'before',
  in: 'query',
  required: false,
  description:
    'Cursor: return items older than this one. Omit for the newest page.',
  schema: { type: 'string' },
};

/** Friend connections, and the two kinds of invite that create them. */
export const FRIEND_PATHS: Record<string, PathItem> = {
  '/api/v1/groups/friends': {
    get: authed({
      operationId: 'listFriends',
      summary: 'People the caller is connected to',
      description: 'Accepted connections only. Blocked edges are not listed.',
      tags: TAGS,
      ok: { type: 'array', items: ref('PublicProfile') },
    }),
  },

  '/api/v1/groups/friends/feed': {
    get: authed({
      operationId: 'getFriendsFeed',
      summary: 'Meals shared by friends',
      description: 'A page of meals from connected people, newest first.',
      tags: TAGS,
      parameters: [beforeParam],
      ok: ref('Feed'),
    }),
  },

  '/api/v1/groups/friends/read-marker': {
    get: authed({
      operationId: 'getFriendsFeedReadMarker',
      summary: 'How far the caller has read the friends feed',
      description:
        'Backs the unread badge without downloading the feed itself.',
      tags: TAGS,
      ok: ref('Acknowledgement'),
    }),
  },

  '/api/v1/groups/friends/block': {
    post: authed({
      operationId: 'blockFriend',
      summary: 'Block someone',
      description:
        'Blocks a connection. Afterwards their invite link resolves for the caller exactly as an invalid slug does, so the block is never observable from the other side.',
      tags: TAGS,
      body: targetUserBody,
      ok: ref('Acknowledgement'),
    }),
  },

  '/api/v1/groups/friends/remove': {
    delete: authed({
      operationId: 'removeFriend',
      summary: 'Disconnect from someone',
      description:
        'Deletes the connection. Unlike a block, either side can re-invite the other afterwards.',
      tags: TAGS,
      body: targetUserBody,
      ok: ref('Acknowledgement'),
    }),
  },

  '/api/v1/groups/invite/accept': {
    post: authed({
      operationId: 'acceptFriendInvite',
      summary: 'Accept a friend-invite link',
      description: 'Connects the caller to whoever owns the slug.',
      tags: TAGS,
      body: {
        type: 'object',
        required: ['slug'],
        properties: {
          slug: { type: 'string', description: 'The invite slug.' },
        },
      },
      ok: ref('Acknowledgement'),
    }),
  },

  '/api/v1/groups/invites': {
    get: authed({
      operationId: 'listMealShareInvites',
      summary: 'Pending meal-split invites',
      description:
        'Invitations to log your own share of a meal someone else logged — the split flow, not the friend flow.',
      tags: TAGS,
      ok: { type: 'array', items: ref('Acknowledgement') },
    }),
  },

  '/api/v1/groups/invites/accept': {
    post: authed({
      operationId: 'acceptMealShareInvite',
      summary: 'Accept a meal-split invite',
      description:
        'Logs the caller’s share of the shared meal onto the given date, as their own meal.',
      tags: TAGS,
      body: inviteIdBody({
        properties: {
          newMealId: {
            type: 'string',
            format: 'uuid',
            description:
              'Client-generated id for the meal that will be created.',
          },
          loggedDate: {
            type: 'string',
            format: 'date',
            description: 'Which day to log it on.',
          },
          timezoneOffset: {
            type: 'integer',
            description: 'Caller timezone offset in minutes.',
          },
        },
      }),
      ok: ref('Meal'),
      okStatus: '201',
    }),
  },

  '/api/v1/groups/invites/dismiss': {
    post: authed({
      operationId: 'dismissMealShareInvite',
      summary: 'Dismiss a meal-split invite',
      description: 'Declines the invite without logging anything.',
      tags: TAGS,
      body: inviteIdBody(),
      ok: ref('Acknowledgement'),
    }),
  },
};
