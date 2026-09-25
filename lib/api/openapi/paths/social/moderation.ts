import {
  createReportBodySchema,
  unblockUserBodySchema,
} from '@/lib/api/contracts/social/moderation';
import {
  authed,
  fromZod,
  PAYLOAD_TOO_LARGE_ERROR,
  type PathItem,
  ref,
} from '@/lib/api/openapi/components';

const TAGS = ['Circle'];

/** Unblocking, the blocked list, and content reports (App Store 1.2). Blocking
 * itself is `blockFriend` in friends.ts. */
export const MODERATION_PATHS: Record<string, PathItem> = {
  '/api/v1/groups/friends/unblock': {
    post: authed({
      operationId: 'unblockUser',
      summary: 'Lift a block',
      description:
        'Removes the block the caller placed on this person. Blocks are per person: if the other side also blocked the caller, that block stays in force. The connection ended when the block was placed and is not restored — the pair must re-invite each other to reconnect. 404 when the caller has not blocked this person, including when the caller is the one blocked, so the endpoint never reveals a block from the other side. Shares the `friendBlock` rate limit with blocking.',
      tags: TAGS,
      body: fromZod(unblockUserBodySchema),
      ok: {
        type: 'object',
        required: ['unblocked'],
        properties: { unblocked: { type: 'boolean', const: true } },
      },
      extraErrors: PAYLOAD_TOO_LARGE_ERROR,
    }),
  },

  '/api/v1/groups/friends/blocked': {
    get: authed({
      operationId: 'listBlockedUsers',
      summary: 'People the caller has blocked',
      description:
        'Newest block first. Only blocks the caller placed; someone who blocked the caller is never listed.',
      tags: TAGS,
      ok: {
        type: 'object',
        required: ['blocked'],
        properties: {
          blocked: {
            type: 'array',
            items: {
              type: 'object',
              required: ['profile', 'blockedAt'],
              properties: {
                profile: ref('PublicProfile'),
                blockedAt: { type: 'string', format: 'date-time' },
              },
            },
          },
        },
      },
    }),
  },

  '/api/v1/reports': {
    post: authed({
      operationId: 'reportContent',
      summary: 'Report objectionable content',
      description:
        'Flags a share, reply, chat message, chat group or profile for review; the team is alerted by email. The target must exist and be visible to the caller (else 404, the same answer as a missing id). The reported person is derived from the target, never sent. Reporting your own content is a 400. Reporting the same target again returns the existing report id and sends no new alert.',
      tags: TAGS,
      body: fromZod(createReportBodySchema),
      ok: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string', format: 'uuid' } },
      },
      okStatus: '201',
      okDescription: 'The report’s id.',
      extraErrors: PAYLOAD_TOO_LARGE_ERROR,
    }),
  },
};
