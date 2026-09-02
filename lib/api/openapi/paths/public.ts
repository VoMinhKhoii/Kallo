import { waitlistSignupSchema } from '@/lib/api/contracts/waitlist';
import {
  fromZod,
  open,
  PAYLOAD_TOO_LARGE_ERROR,
  type PathItem,
  pathParam,
  ref,
} from '@/lib/api/openapi/components';

/**
 * The endpoints an agent can call with no credentials at all.
 *
 * These are the only operations in this spec that a third party can use today.
 * Everything else needs a Supabase user JWT, which only a Kallo account holder
 * can obtain — see `/en/docs/developers/api`.
 */
export const PUBLIC_PATHS: Record<string, PathItem> = {
  '/api/healthz': {
    get: open({
      operationId: 'getHealth',
      summary: 'Service health',
      description:
        'Liveness probe. Returns 200 when the service is up and the database invariants it depends on hold, 503 otherwise. The body is `{ok, service}` only — which invariant failed is logged server-side, not published. Safe to poll: the probe is cached for 30 seconds per instance and rate limited per IP.',
      tags: ['Public'],
      ok: ref('HealthCheck'),
      okDescription: 'All checks passed.',
    }),
  },

  '/api/v1/waitlist': {
    post: open({
      operationId: 'joinWaitlist',
      summary: 'Join the launch waitlist',
      description:
        'Registers an email address for the mobile launch announcement and sends a confirmation link. Rate limited per IP address, and per address by a resend cooldown. The request body is capped at 8 KB.',
      tags: ['Public'],
      extraErrors: PAYLOAD_TOO_LARGE_ERROR,
      body: fromZod(waitlistSignupSchema),
      bodyDescription:
        'The address to add, and optionally where the signup came from.',
      ok: ref('WaitlistSignupResponse'),
      okDescription:
        'Accepted. The response is identical for a new, pending, or already-confirmed address.',
    }),
  },

  '/api/v1/waitlist/confirm': {
    get: open({
      operationId: 'confirmWaitlist',
      summary: 'Confirm a waitlist signup',
      description:
        'The target of the emailed confirmation link. Always redirects to the landing page with `?waitlist=<confirmed|already|expired|invalid>`; it never returns a body. Rate limited per IP address, so an identical-looking response cannot be used to guess tokens cheaply.',
      tags: ['Public'],
      parameters: [
        {
          name: 'token',
          in: 'query',
          required: true,
          description: 'The single-use token from the confirmation email.',
          schema: { type: 'string' },
        },
      ],
      ok: {},
      okStatus: '307',
      okDescription: 'Redirect to `/{locale}/?waitlist=<status>`.',
    }),
  },

  '/api/v1/groups/invite/{slug}': {
    get: open({
      operationId: 'getInvitePreview',
      summary: 'Preview a friend-invite link',
      description:
        'Resolves an invite slug to the person who owns it. Callable signed out, in which case `signedOut` is true and `status` is `none`. A blocked relationship returns the same 404 as an invalid slug, so the response can never be used to detect a block.',
      tags: ['Public', 'Circle'],
      parameters: [pathParam('slug', 'The invite slug from the shared link.')],
      ok: ref('InvitePreview'),
      okDescription: 'The inviter, and the viewer’s relationship to them.',
    }),
  },
};
