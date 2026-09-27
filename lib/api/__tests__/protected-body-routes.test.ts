import type { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Errors } from '@/lib/core/errors/catalog';

/**
 * KALLO-08: the protected `/api/v1` JSON routes used to parse the body before
 * authenticating, so malformed JSON from an anonymous caller surfaced as a
 * retryable 500 instead of a 401. Every route here must now:
 *  - answer an anonymous caller 401 WITHOUT reading the body (malformed or
 *    not), so a stranger cannot make the server buffer or parse anything;
 *  - answer malformed JSON from a signed-in caller with a non-retryable 400;
 *  - refuse an oversized body with a 413 before the action runs.
 */

const requireAuthAndProfile = vi.fn();
const requireUserId = vi.fn();
const action = vi.fn();

vi.mock('@/lib/infra/auth/session', () => ({ requireAuthAndProfile }));
vi.mock('@/lib/api/auth', async (importActual) => ({
  ...(await importActual<typeof import('@/lib/api/auth')>()),
  requireUserId,
}));

// Every delegate the routes call resolves to the same spy: the assertions are
// only ever "the action did not run".
const stub = (...names: string[]) =>
  Object.fromEntries(names.map((name) => [name, action]));
vi.mock('@/lib/actions/support/feedback', () => stub('submitFeedbackAction'));
vi.mock('@/lib/actions/logging/manual-meals', () =>
  stub('saveManualMealAction')
);
vi.mock('@/lib/actions/meals/duplicate-meal', () =>
  stub('duplicateMealAction')
);
vi.mock('@/lib/actions/meals/mutate-meal', () =>
  stub('updateMealAction', 'deleteMealAction')
);
vi.mock('@/lib/actions/meals/cheat/occasions', () =>
  stub('stageCheatRepeatAction')
);
vi.mock('@/lib/actions/meals/confirm-and-save', () =>
  stub('confirmAndSaveMealAction')
);
vi.mock('@/lib/actions/meals/relog/relog-items', () =>
  stub('relogMealItemsAction')
);
vi.mock('@/lib/actions/meals/day/mark-day-complete', () =>
  stub('markDayCompleteAction')
);
vi.mock('@/lib/actions/tracking/weight', () => stub('logWeightAction'));
vi.mock('@/lib/domain/nutrition/actions/candidates', () =>
  stub('getFoodSourceCandidates')
);
vi.mock('@/lib/domain/onboarding/actions', () =>
  stub('saveOnboardingScreen', 'saveProfileSettings')
);
vi.mock('@/lib/actions/visibility/sharing-preferences', () =>
  stub('setAutoShareToCircle')
);
vi.mock('@/lib/actions/privacy/ai-consent', () =>
  stub('setAiProcessingConsent')
);
vi.mock('@/lib/actions/meal-sharing/share-with-friends', () =>
  stub('shareMealWithFriendsAction')
);
vi.mock('@/lib/actions/meal-sharing/invite-response', () =>
  stub('acceptMealShareInviteAction', 'dismissMealShareInviteAction')
);
vi.mock('@/lib/actions/meal-sharing/stage-cheat-copy', () =>
  stub('stageCheatInviteAction')
);
vi.mock('@/lib/actions/meal-sharing/log-shared', () =>
  stub('logSharedMealAction')
);
vi.mock('@/lib/actions/meal-sharing/reactions', () =>
  stub('toggleShareReactionAction')
);
vi.mock('@/lib/actions/meal-sharing/replies', () =>
  stub('createShareReplyAction')
);

type Handler = (
  req: NextRequest,
  ctx: { params: Promise<Record<string, string>> }
) => Promise<Response>;

const MEAL_ID = '2b8e2f6a-4f9f-4d38-9f6e-1a2b3c4d5e6f';

/** `[route, method, which auth guard runs first, loader]` */
const routes: [
  string,
  'POST' | 'PUT' | 'PATCH',
  'profile' | 'user',
  () => Promise<unknown>,
][] = [
  ['feedback', 'POST', 'user', () => import('@/app/api/v1/feedback/route')],
  ['profile', 'PUT', 'user', () => import('@/app/api/v1/profile/route')],
  [
    'profile/sharing',
    'PUT',
    'user',
    () => import('@/app/api/v1/profile/sharing/route'),
  ],
  [
    'profile/ai-consent',
    'PUT',
    'user',
    () => import('@/app/api/v1/profile/ai-consent/route'),
  ],
  [
    'onboarding/screen',
    'POST',
    'user',
    () => import('@/app/api/v1/onboarding/screen/route'),
  ],
  [
    'meals/manual',
    'POST',
    'profile',
    () => import('@/app/api/v1/meals/manual/route'),
  ],
  [
    'meals/[mealId]',
    'PATCH',
    'profile',
    () => import('@/app/api/v1/meals/[mealId]/route'),
  ],
  [
    'meals/[mealId]/duplicate',
    'POST',
    'profile',
    () => import('@/app/api/v1/meals/[mealId]/duplicate/route'),
  ],
  [
    'meals/cheat-repeat',
    'POST',
    'profile',
    () => import('@/app/api/v1/meals/cheat-repeat/route'),
  ],
  [
    'meals/confirm',
    'POST',
    'profile',
    () => import('@/app/api/v1/meals/confirm/route'),
  ],
  [
    'meals/relog',
    'POST',
    'profile',
    () => import('@/app/api/v1/meals/relog/route'),
  ],
  [
    'logging/day/complete',
    'POST',
    'profile',
    () => import('@/app/api/v1/logging/day/complete/route'),
  ],
  ['weight', 'POST', 'profile', () => import('@/app/api/v1/weight/route')],
  [
    'nutrition/candidates',
    'POST',
    'profile',
    () => import('@/app/api/v1/nutrition/candidates/route'),
  ],
  [
    'groups/meal-share',
    'POST',
    'profile',
    () => import('@/app/api/v1/groups/meal-share/route'),
  ],
  [
    'groups/invites/accept',
    'POST',
    'profile',
    () => import('@/app/api/v1/groups/invites/accept/route'),
  ],
  [
    'groups/invites/accept-cheat',
    'POST',
    'profile',
    () => import('@/app/api/v1/groups/invites/accept-cheat/route'),
  ],
  [
    'groups/invites/dismiss',
    'POST',
    'profile',
    () => import('@/app/api/v1/groups/invites/dismiss/route'),
  ],
  [
    'groups/shares/log',
    'POST',
    'profile',
    () => import('@/app/api/v1/groups/shares/log/route'),
  ],
  [
    'groups/shares/reaction',
    'POST',
    'profile',
    () => import('@/app/api/v1/groups/shares/reaction/route'),
  ],
  [
    'groups/shares/reply',
    'POST',
    'profile',
    () => import('@/app/api/v1/groups/shares/reply/route'),
  ],
];

function makeRequest(method: string, body: string): Request {
  return new Request('http://localhost/api/v1/x', {
    method,
    headers: { 'content-type': 'application/json' },
    body,
  });
}

async function call(
  load: () => Promise<unknown>,
  method: string,
  req: Request
) {
  const mod = (await load()) as Record<string, Handler>;
  return mod[method](req as unknown as NextRequest, {
    params: Promise.resolve({ mealId: MEAL_ID }),
  });
}

beforeEach(() => {
  action.mockReset();
  requireAuthAndProfile.mockReset();
  requireUserId.mockReset();
  requireAuthAndProfile.mockResolvedValue({ user: { id: 'u1' }, profile: {} });
  requireUserId.mockResolvedValue('u1');
});

describe.each(routes)('%s (%s)', (_route, method, guard, load) => {
  const rejectAuth = () =>
    (guard === 'user'
      ? requireUserId
      : requireAuthAndProfile
    ).mockRejectedValue(Errors.notAuthenticated());

  it.each([
    ['malformed', '{"broken'],
    ['valid', '{}'],
  ])('answers an anonymous caller 401 without reading a %s body', async (_kind, body) => {
    rejectAuth();
    const req = makeRequest(method, body);

    const res = await call(load, method, req);

    expect(res.status).toBe(401);
    expect(req.bodyUsed).toBe(false);
    expect(action).not.toHaveBeenCalled();
  });

  it('answers malformed JSON from a signed-in caller with a 400', async () => {
    const res = await call(load, method, makeRequest(method, '{"broken'));

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({
      error: { code: 'VALIDATION_FAILED', retryable: false },
    });
    expect(action).not.toHaveBeenCalled();
  });

  it('refuses an oversized body with a 413', async () => {
    const huge = JSON.stringify({ pad: 'x'.repeat(70 * 1024) });

    const res = await call(load, method, makeRequest(method, huge));

    expect(res.status).toBe(413);
    await expect(res.json()).resolves.toMatchObject({
      error: { code: 'PAYLOAD_TOO_LARGE', retryable: false },
    });
    expect(action).not.toHaveBeenCalled();
  });
});
