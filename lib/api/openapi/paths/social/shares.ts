import {
  authed,
  type JsonSchema,
  type PathItem,
  ref,
} from '@/lib/api/openapi/components';
import { fileUploadBody } from '@/lib/api/openapi/paths/support';

const TAGS = ['Circle'];

const shareIdBody = (
  extra: Record<string, JsonSchema> = {},
  required: string[] = []
): JsonSchema => ({
  type: 'object',
  required: ['shareId', ...required],
  properties: {
    shareId: {
      type: 'string',
      format: 'uuid',
      description: 'The shared meal.',
    },
    ...extra,
  },
});

const profileResponse: JsonSchema = {
  type: 'object',
  properties: { profile: ref('PublicProfile') },
};

/** Sharing a meal, reacting to one, and the public profile that carries them. */
export const SHARE_PATHS: Record<string, PathItem> = {
  '/api/v1/groups/shares': {
    post: authed({
      operationId: 'setMealVisibility',
      summary: 'Share or unshare a meal',
      description:
        'Flips one meal between `private` and `circle`. The default for new meals is set separately by `updateSharingPreference`.',
      tags: TAGS,
      body: {
        type: 'object',
        required: ['mealId', 'visibility'],
        properties: {
          mealId: {
            type: 'string',
            format: 'uuid',
            description: 'The meal to change.',
          },
          visibility: { type: 'string', enum: ['private', 'circle'] },
        },
      },
      ok: ref('Acknowledgement'),
    }),
  },

  '/api/v1/groups/shares/log': {
    post: authed({
      operationId: 'logSharedMeal',
      summary: 'Copy or split a friend’s meal',
      description:
        'Logs someone else’s shared meal as your own. `factor` is 1 to copy the whole thing or 0.5 to take half — the case where two people ate one dish.',
      tags: TAGS,
      body: shareIdBody(
        {
          factor: {
            type: 'number',
            enum: [1, 0.5],
            description: '1 copies the meal, 0.5 takes half of it.',
          },
          loggedDate: { type: 'string', format: 'date' },
          timezoneOffset: { type: 'integer' },
          newMealId: {
            type: 'string',
            format: 'uuid',
            description:
              'Client-generated id for the meal that will be created.',
          },
        },
        ['factor', 'loggedDate', 'timezoneOffset']
      ),
      ok: ref('Meal'),
      okStatus: '201',
    }),
  },

  '/api/v1/groups/shares/reaction': {
    post: authed({
      operationId: 'toggleShareReaction',
      summary: 'React to a shared meal',
      description:
        'Toggles the caller’s reaction on or off. There is one reaction type.',
      tags: TAGS,
      body: shareIdBody(),
      ok: ref('Acknowledgement'),
    }),
  },

  '/api/v1/groups/shares/reply': {
    post: authed({
      operationId: 'replyToShare',
      summary: 'Comment on a shared meal',
      description: 'Adds a reply, optionally threaded under an existing one.',
      tags: TAGS,
      body: shareIdBody(
        {
          body: { type: 'string', description: 'Reply text.' },
          replyId: {
            type: 'string',
            format: 'uuid',
            description: 'Reply to thread this one under.',
          },
        },
        ['body']
      ),
      ok: ref('Acknowledgement'),
      okStatus: '201',
    }),
  },

  '/api/v1/groups/meal-share': {
    post: authed({
      operationId: 'shareMealWithFriends',
      summary: 'Send a meal to specific friends',
      description:
        '`copy` sends the meal for them to log as-is. `split` sends an invite for each recipient to log exactly their own portion of it — the shared-dish case.',
      tags: TAGS,
      body: {
        type: 'object',
        required: ['mealId', 'friendUserIds', 'mode'],
        properties: {
          mealId: { type: 'string', format: 'uuid' },
          friendUserIds: {
            type: 'array',
            items: { type: 'string', format: 'uuid' },
            description: 'Recipients. Must be accepted connections.',
          },
          mode: { type: 'string', enum: ['copy', 'split'] },
        },
      },
      ok: ref('Acknowledgement'),
      okStatus: '201',
    }),
  },

  '/api/v1/groups/profile': {
    get: authed({
      operationId: 'getMyPublicProfile',
      summary: 'The caller’s public profile',
      description:
        'Name, avatar and invite link. A shareable link is provisioned on first access, so this always returns a profile — there is no claim step.',
      tags: TAGS,
      ok: profileResponse,
    }),
    post: authed({
      operationId: 'updateMyPublicProfile',
      summary: 'Change the invite handle or display name',
      description:
        'Changing the handle changes the invite link, so links already shared stop resolving.',
      tags: TAGS,
      body: {
        type: 'object',
        required: ['handle'],
        properties: {
          handle: {
            type: 'string',
            description: 'The editable end of the invite link.',
          },
          displayName: { type: 'string' },
          avatarSeed: {
            type: 'string',
            description: 'Seed for the generated avatar.',
          },
        },
      },
      ok: profileResponse,
    }),
  },

  '/api/v1/groups/profile/name': {
    post: authed({
      operationId: 'renameMyPublicProfile',
      summary: 'Rename yourself',
      description:
        'Sets the display name and re-derives the invite handle from it — so outstanding invite links change, exactly as they do when the handle is edited directly.',
      tags: TAGS,
      body: {
        type: 'object',
        required: ['displayName'],
        properties: { displayName: { type: 'string' } },
      },
      ok: profileResponse,
    }),
  },

  '/api/v1/groups/profile/avatar': {
    post: authed({
      operationId: 'uploadAvatar',
      summary: 'Upload an avatar photo',
      description:
        'Multipart upload with a single `file` field, under 5 MB. The upload goes through the caller’s own storage session so row-level security applies to it.',
      tags: TAGS,
      body: fileUploadBody('The avatar image, under 5 MB.'),
      bodyMedia: 'multipart/form-data',
      ok: profileResponse,
    }),
    delete: authed({
      operationId: 'deleteAvatar',
      summary: 'Remove the avatar photo',
      description: 'Falls back to the generated avatar.',
      tags: TAGS,
      ok: profileResponse,
    }),
  },
};
