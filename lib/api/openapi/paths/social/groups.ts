import {
  addChatGroupMembersBodySchema,
  createChatGroupBodySchema,
  renameChatGroupBodySchema,
} from '@/lib/api/contracts/social/chat-groups';
import {
  authed,
  fromZod,
  type JsonSchema,
  OBJECTIONABLE_CONTENT_ERROR,
  PAYLOAD_TOO_LARGE_ERROR,
  type Parameter,
  type PathItem,
  pathParam,
  ref,
} from '@/lib/api/openapi/components';
import { timezoneOffsetSchema } from '@/lib/core/validation/primitives';

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

/**
 * Unlike `tz` elsewhere, this one is genuinely optional: these two routes
 * `safeParse` it and fall back to UTC (0) on a missing or out-of-range value.
 */
const tzQuery: Parameter = {
  name: 'timezoneOffset',
  in: 'query',
  required: false,
  description:
    'Timezone offset in minutes, as `Date.getTimezoneOffset()` reports it (UTC+7 is `-420`). Decides which meals fall on "today". Missing or out of range falls back to UTC.',
  schema: fromZod(timezoneOffsetSchema),
};

/** `{ key: schema }`, all keys required — the wrapper objects these routes return. */
const wrap = (properties: Record<string, JsonSchema>): JsonSchema => ({
  type: 'object',
  required: Object.keys(properties),
  properties,
});

const chatGroupMessage: JsonSchema = wrap({
  id: { type: 'string', format: 'uuid' },
  groupId: { type: 'string', format: 'uuid' },
  senderId: { type: 'string', format: 'uuid' },
  body: { type: 'string' },
  createdAt: { type: 'string', format: 'date-time' },
});

/** Chat groups — the small shared spaces, and who is in them. */
export const GROUP_PATHS: Record<string, PathItem> = {
  '/api/v1/chat-groups': {
    get: authed({
      operationId: 'listChatGroups',
      summary: 'Groups the caller belongs to',
      description: 'Every group the caller is a member of, with unread state.',
      tags: TAGS,
      parameters: [tzQuery],
      ok: wrap({ groups: { type: 'array', items: ref('ChatGroupIdentity') } }),
    }),
    post: authed({
      operationId: 'createChatGroup',
      summary: 'Create a group',
      description:
        'Creates a named group with the caller as owner and the listed friends as members. Every id must be an accepted connection of the caller; repeated ids are collapsed and the caller’s own id is ignored. Creating a group is a premium feature (402 otherwise), and each member must have room for another group (409).',
      tags: TAGS,
      body: fromZod(createChatGroupBodySchema),
      ok: wrap({ group: wrap({ id: { type: 'string', format: 'uuid' } }) }),
      okDescription: 'The new group’s id.',
      extraErrors: {
        ...PAYLOAD_TOO_LARGE_ERROR,
        ...OBJECTIONABLE_CONTENT_ERROR,
      },
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
      ok: wrap({ group: ref('ChatGroupDetail') }),
    }),
    patch: authed({
      operationId: 'updateChatGroup',
      summary: 'Rename a group',
      description:
        'Changes the group’s display name (owner only). A name that hits the objectionable-term filter answers 422.',
      tags: TAGS,
      parameters: [groupId],
      body: fromZod(renameChatGroupBodySchema),
      ok: wrap({ name: { type: 'string' } }),
      okDescription: 'The name as stored.',
      extraErrors: {
        ...PAYLOAD_TOO_LARGE_ERROR,
        ...OBJECTIONABLE_CONTENT_ERROR,
      },
    }),
  },

  '/api/v1/chat-groups/{groupId}/members': {
    post: authed({
      operationId: 'addChatGroupMember',
      summary: 'Add someone to a group',
      description:
        'Adds one or more of the caller’s accepted friends to the group. Repeated ids are collapsed; people already in the group are skipped, and `added` counts only the new members.',
      tags: TAGS,
      parameters: [groupId],
      body: fromZod(addChatGroupMembersBodySchema),
      ok: wrap({ added: { type: 'integer', minimum: 0 } }),
      extraErrors: PAYLOAD_TOO_LARGE_ERROR,
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
      ok: wrap({ removed: { type: 'boolean', enum: [true] } }),
    }),
  },

  '/api/v1/chat-groups/{groupId}/messages': {
    get: authed({
      operationId: 'listChatGroupMessages',
      summary: 'Messages in a group',
      description: 'The group’s messages, newest last.',
      tags: TAGS,
      parameters: [groupId],
      ok: wrap({ messages: { type: 'array', items: chatGroupMessage } }),
    }),
    post: authed({
      operationId: 'sendChatGroupMessage',
      summary: 'Post a message',
      description:
        'Sends a text message to the group. Members in a blocked relation with the sender neither see it nor get its push. Text that hits the objectionable-term filter answers 422.',
      tags: TAGS,
      parameters: [groupId],
      body: {
        type: 'object',
        required: ['body'],
        properties: {
          body: {
            type: 'string',
            minLength: 1,
            maxLength: 2000,
            description: 'Message text, trimmed.',
          },
        },
      },
      ok: wrap({ message: chatGroupMessage }),
      extraErrors: {
        ...PAYLOAD_TOO_LARGE_ERROR,
        ...OBJECTIONABLE_CONTENT_ERROR,
      },
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
      ok: wrap({ left: { type: 'boolean', enum: [true] } }),
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
      ok: wrap({ feed: { type: 'array', items: ref('SharedMealEntry') } }),
    }),
  },
};
