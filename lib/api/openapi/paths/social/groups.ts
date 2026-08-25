import {
  authed,
  type Parameter,
  type PathItem,
  pathParam,
  ref,
} from '@/lib/api/openapi/components';

const TAGS = ['Circle'];

const groupId = pathParam('groupId', 'UUID of the chat group.');

const beforeParam: Parameter = {
  name: 'before',
  in: 'query',
  required: false,
  description:
    'Cursor: return items older than this one. Omit for the newest page.',
  schema: { type: 'string' },
};

const tzQuery: Parameter = {
  name: 'timezoneOffset',
  in: 'query',
  required: false,
  description:
    'Timezone offset in minutes, as `Date.getTimezoneOffset()` reports it. Decides which meals fall on which day in the feed.',
  schema: { type: 'integer', minimum: -840, maximum: 840 },
};

/** Chat groups — the small shared spaces, and who is in them. */
export const GROUP_PATHS: Record<string, PathItem> = {
  '/api/v1/chat-groups': {
    get: authed({
      operationId: 'listChatGroups',
      summary: 'Groups the caller belongs to',
      description: 'Every group the caller is a member of, with unread state.',
      tags: TAGS,
      parameters: [tzQuery],
      ok: { type: 'array', items: ref('ChatGroup') },
    }),
    post: authed({
      operationId: 'createChatGroup',
      summary: 'Create a group',
      description: 'Creates a group with the caller as its first member.',
      tags: TAGS,
      body: {
        type: 'object',
        required: ['name'],
        properties: { name: { type: 'string', description: 'Display name.' } },
      },
      ok: ref('ChatGroup'),
      okStatus: '201',
    }),
  },

  '/api/v1/chat-groups/{groupId}': {
    get: authed({
      operationId: 'getChatGroup',
      summary: 'One group',
      description:
        'The group and its members. 404 if the caller is not a member.',
      tags: TAGS,
      parameters: [groupId],
      ok: ref('ChatGroup'),
    }),
    patch: authed({
      operationId: 'updateChatGroup',
      summary: 'Rename a group',
      description: 'Changes the group’s display name.',
      tags: TAGS,
      parameters: [groupId],
      body: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string', description: 'New display name.' },
        },
      },
      ok: ref('ChatGroup'),
    }),
  },

  '/api/v1/chat-groups/{groupId}/members': {
    post: authed({
      operationId: 'addChatGroupMember',
      summary: 'Add someone to a group',
      description: 'Adds an existing friend to the group.',
      tags: TAGS,
      parameters: [groupId],
      body: {
        type: 'object',
        required: ['userId'],
        properties: {
          userId: {
            type: 'string',
            format: 'uuid',
            description: 'Who to add.',
          },
        },
      },
      ok: ref('Acknowledgement'),
      okStatus: '201',
    }),
  },

  '/api/v1/chat-groups/{groupId}/members/{userId}': {
    delete: authed({
      operationId: 'removeChatGroupMember',
      summary: 'Remove someone from a group',
      description: 'Removes a member. Use `leaveChatGroup` to remove yourself.',
      tags: TAGS,
      parameters: [
        groupId,
        pathParam('userId', 'UUID of the member to remove.'),
      ],
      ok: ref('Acknowledgement'),
    }),
  },

  '/api/v1/chat-groups/{groupId}/messages': {
    get: authed({
      operationId: 'listChatGroupMessages',
      summary: 'Messages in a group',
      description: 'The group’s messages, newest last.',
      tags: TAGS,
      parameters: [groupId],
      ok: {
        type: 'object',
        properties: {
          messages: { type: 'array', items: ref('Acknowledgement') },
        },
      },
    }),
    post: authed({
      operationId: 'sendChatGroupMessage',
      summary: 'Post a message',
      description: 'Sends a text message to the group.',
      tags: TAGS,
      parameters: [groupId],
      body: {
        type: 'object',
        required: ['body'],
        properties: { body: { type: 'string', description: 'Message text.' } },
      },
      ok: ref('Acknowledgement'),
      okStatus: '201',
    }),
  },

  '/api/v1/chat-groups/{groupId}/feed': {
    get: authed({
      operationId: 'getChatGroupFeed',
      summary: 'Meals shared into a group',
      description: 'A page of meals shared into this group, newest first.',
      tags: TAGS,
      parameters: [groupId, beforeParam],
      ok: ref('Feed'),
    }),
  },

  '/api/v1/chat-groups/{groupId}/leave': {
    delete: authed({
      operationId: 'leaveChatGroup',
      summary: 'Leave a group',
      description: 'Removes the caller from the group.',
      tags: TAGS,
      parameters: [groupId],
      ok: ref('Acknowledgement'),
    }),
  },

  '/api/v1/groups/feed': {
    get: authed({
      operationId: 'getCircleFeed',
      summary: 'The whole circle feed',
      description:
        'Meals shared by everyone the caller is connected to, across friends and groups.',
      tags: TAGS,
      parameters: [tzQuery],
      ok: ref('Feed'),
    }),
  },
};
