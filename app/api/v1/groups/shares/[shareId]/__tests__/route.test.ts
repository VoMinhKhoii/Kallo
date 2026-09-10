import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The share a viewer may not see and the share that no longer exists must be
 * the same answer on the wire: a 404 that distinguishes them would turn this
 * route into an oracle for "does this person post".
 */

const getSharedMealEntry = vi.fn();
const requireUserId = vi.fn();

vi.mock('@/lib/actions/groups/thread', () => ({ getSharedMealEntry }));
vi.mock('@/lib/api/auth', () => ({ requireUserId }));

const { GET } = await import('@/app/api/v1/groups/shares/[shareId]/route');

const SHARE_ID = '3f1d2c4b-5a6e-4f70-8b91-0c2d3e4f5a6b';
const ACTOR = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

const entry = {
  friend: { userId: 'u2', handle: 'phofan' },
  isSelf: false,
  meal: { shareId: SHARE_ID, rawInput: 'bún chả' },
  reactions: { count: 0, mine: false },
  replies: [],
  repliesTotal: 0,
};

function call(shareId = SHARE_ID) {
  return GET({} as never, { params: Promise.resolve({ shareId }) });
}

beforeEach(() => {
  getSharedMealEntry.mockReset();
  requireUserId.mockReset();
  requireUserId.mockResolvedValue(ACTOR);
  getSharedMealEntry.mockResolvedValue(entry);
});

describe('GET /api/v1/groups/shares/[shareId]', () => {
  it('answers the entry for a share the caller may see', async () => {
    const response = await call();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ entry });
    expect(getSharedMealEntry).toHaveBeenCalledWith(ACTOR, SHARE_ID);
  });

  it('answers 404 when the share is gone or not the caller to see', async () => {
    getSharedMealEntry.mockResolvedValue(null);

    const response = await call();

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'NOT_FOUND', status: 404, retryable: false },
    });
  });

  it('never reads a share for an anonymous caller', async () => {
    const { Errors } = await import('@/lib/core/errors/catalog');
    requireUserId.mockRejectedValue(Errors.notAuthenticated());

    const response = await call();

    expect(response.status).toBe(401);
    expect(getSharedMealEntry).not.toHaveBeenCalled();
  });

  it('answers 404 for a malformed share id, not a retryable 400', async () => {
    // A share id that cannot exist is a share that does not exist. The action
    // answers null for it, so the route gives the reader the same gone state —
    // a 400 would put a "try again" in front of a link that will never work.
    getSharedMealEntry.mockResolvedValue(null);

    const response = await call('not-a-uuid');

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'NOT_FOUND', status: 404, retryable: false },
    });
  });
});
