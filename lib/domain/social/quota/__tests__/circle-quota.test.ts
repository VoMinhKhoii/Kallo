import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError, FeatureLockedError } from '@/lib/core/errors/app-error';
import type { CircleQuotaDb } from '@/lib/domain/social/quota/circle-quota';

// ---------------------------------------------------------------------------
// Mocks — the billing barrel is the only seam; the db handle is a parameter.
// ---------------------------------------------------------------------------

const { mockCheckFeatureAccess, mockGetBillingConfig, setEnforcement } =
  vi.hoisted(() => {
    const enforcement = { enabled: true };
    return {
      mockCheckFeatureAccess: vi.fn(),
      mockGetBillingConfig: vi.fn(() => ({
        enforcementEnabled: enforcement.enabled,
      })),
      setEnforcement: (enabled: boolean) => {
        enforcement.enabled = enabled;
      },
    };
  });

vi.mock('@/lib/domain/billing/billing', () => ({
  checkFeatureAccess: mockCheckFeatureAccess,
  getBillingConfig: mockGetBillingConfig,
}));

const {
  assertFriendCapacity,
  assertGroupCapacity,
  assertUnlimitedCircleActor,
} = await import('@/lib/domain/social/quota/circle-quota');

const ACTOR = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const MEMBER = 'b1ffcd00-ad1c-4ff9-8c7e-7ccace491b22';
const INVITER = 'c2aade11-be2d-4aa0-8d8f-8ddbdf502c33';
const CREATED_AT = new Date('2026-01-01T00:00:00.000Z');

// A drizzle-shaped fake: `select()` hands back a real Promise of the next
// queued result set with every builder method attached, so any chain
// (`.from().leftJoin().where()`, `.from().where().limit()`, …) awaits to those
// rows. Results are consumed in select() call order.
function makeDb() {
  const queue: unknown[][] = [];
  const select = vi.fn(() => {
    const rows = queue.shift() ?? [];
    const chain = Object.assign(
      Promise.resolve(rows),
      {} as Record<string, unknown>
    );
    for (const method of [
      'from',
      'innerJoin',
      'leftJoin',
      'where',
      'groupBy',
      'limit',
    ]) {
      chain[method] = vi.fn(() => chain);
    }
    return chain;
  });
  const db = { select } as unknown as CircleQuotaDb;
  return { db, queue, select };
}

function profileRow(userId: string, displayName: string | null) {
  return {
    userId,
    displayName,
    handle: 'handle',
    publicCreatedAt: CREATED_AT,
    profileCreatedAt: CREATED_AT,
  };
}

beforeEach(() => {
  mockCheckFeatureAccess.mockReset();
  setEnforcement(true);
});

describe('kill-switch', () => {
  it('short-circuits every entry point before any query', async () => {
    setEnforcement(false);
    const { db, select } = makeDb();

    await expect(
      assertUnlimitedCircleActor(db, ACTOR)
    ).resolves.toBeUndefined();
    await expect(assertGroupCapacity(db, [MEMBER])).resolves.toBeUndefined();
    await expect(
      assertFriendCapacity(db, {
        accepterId: ACTOR,
        inviterId: INVITER,
        inviterName: 'Phở Fan',
      })
    ).resolves.toBeUndefined();

    expect(select).not.toHaveBeenCalled();
    expect(mockCheckFeatureAccess).not.toHaveBeenCalled();
  });
});

describe('assertUnlimitedCircleActor', () => {
  it('passes an entitled actor', async () => {
    const { db, queue } = makeDb();
    queue.push([{ profileCreatedAt: CREATED_AT }]);
    mockCheckFeatureAccess.mockResolvedValue({ allowed: true });

    await expect(
      assertUnlimitedCircleActor(db, ACTOR)
    ).resolves.toBeUndefined();
    expect(mockCheckFeatureAccess).toHaveBeenCalledWith(
      { userId: ACTOR, profileCreatedAt: CREATED_AT },
      'unlimited_circle',
      { db }
    );
  });

  it('throws a 402 for a free actor', async () => {
    const { db, queue } = makeDb();
    queue.push([{ profileCreatedAt: CREATED_AT }]);
    mockCheckFeatureAccess.mockResolvedValue({
      allowed: false,
      reason: 'trial_expired',
    });

    const error = await assertUnlimitedCircleActor(db, ACTOR).catch(
      (e: unknown) => e
    );
    expect(error).toBeInstanceOf(FeatureLockedError);
    expect((error as FeatureLockedError).status).toBe(402);
    expect((error as FeatureLockedError).reason).toBe('trial_expired');
  });

  it('throws PROFILE_NOT_FOUND when the actor has no profile row', async () => {
    const { db, queue } = makeDb();
    queue.push([]);

    const error = await assertUnlimitedCircleActor(db, ACTOR).catch(
      (e: unknown) => e
    );
    expect((error as AppError).code).toBe('PROFILE_NOT_FOUND');
    expect(mockCheckFeatureAccess).not.toHaveBeenCalled();
  });
});

describe('assertGroupCapacity', () => {
  it('passes an under-cap user without an entitlement read', async () => {
    const { db, queue } = makeDb();
    queue.push([{ userId: MEMBER, groupCount: 1 }]);

    await expect(assertGroupCapacity(db, [MEMBER])).resolves.toBeUndefined();
    expect(mockCheckFeatureAccess).not.toHaveBeenCalled();
  });

  it('does nothing when no users are supplied', async () => {
    const { db, select } = makeDb();
    await expect(assertGroupCapacity(db, [])).resolves.toBeUndefined();
    expect(select).not.toHaveBeenCalled();
  });

  it('throws 409 naming an at-cap free member', async () => {
    const { db, queue } = makeDb();
    queue.push([{ userId: MEMBER, groupCount: 2 }]);
    queue.push([profileRow(MEMBER, ' Phở Fan ')]);
    mockCheckFeatureAccess.mockResolvedValue({
      allowed: false,
      reason: 'not_entitled',
    });

    const error = await assertGroupCapacity(db, [MEMBER]).catch(
      (e: unknown) => e
    );
    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).code).toBe('CIRCLE_LIMIT_REACHED');
    expect((error as AppError).status).toBe(409);
    expect((error as AppError).userMessage).toBe(
      'Phở Fan đã đạt giới hạn 2 nhóm của gói miễn phí.'
    );
  });

  it('passes an at-cap PREMIUM member', async () => {
    const { db, queue } = makeDb();
    queue.push([{ userId: MEMBER, groupCount: 7 }]);
    queue.push([profileRow(MEMBER, 'Phở Fan')]);
    mockCheckFeatureAccess.mockResolvedValue({ allowed: true });

    await expect(assertGroupCapacity(db, [MEMBER])).resolves.toBeUndefined();
    expect(mockCheckFeatureAccess).toHaveBeenCalledTimes(1);
  });
});

describe('assertFriendCapacity', () => {
  const input = {
    accepterId: ACTOR,
    inviterId: INVITER,
    inviterName: 'Phở Fan',
  };

  it('passes when both parties are under the cap', async () => {
    const { db, queue } = makeDb();
    queue.push([{ accepterCount: 3, inviterCount: 9 }]);

    await expect(assertFriendCapacity(db, input)).resolves.toBeUndefined();
    expect(mockCheckFeatureAccess).not.toHaveBeenCalled();
  });

  it('throws 402 when the ACCEPTER is at cap and free', async () => {
    const { db, queue } = makeDb();
    queue.push([{ accepterCount: 10, inviterCount: 10 }]);
    queue.push([profileRow(ACTOR, 'Me'), profileRow(INVITER, 'Phở Fan')]);
    mockCheckFeatureAccess.mockResolvedValue({
      allowed: false,
      reason: 'not_entitled',
    });

    const error = await assertFriendCapacity(db, input).catch(
      (e: unknown) => e
    );
    expect(error).toBeInstanceOf(FeatureLockedError);
    expect((error as FeatureLockedError).status).toBe(402);
    expect((error as FeatureLockedError).feature).toBe('unlimited_circle');
  });

  it('throws 409 naming the INVITER when only they are at cap', async () => {
    const { db, queue } = makeDb();
    queue.push([{ accepterCount: 1, inviterCount: 12 }]);
    queue.push([profileRow(INVITER, 'Phở Fan')]);
    mockCheckFeatureAccess.mockResolvedValue({
      allowed: false,
      reason: 'not_entitled',
    });

    const error = await assertFriendCapacity(db, input).catch(
      (e: unknown) => e
    );
    expect((error as AppError).code).toBe('CIRCLE_LIMIT_REACHED');
    expect((error as AppError).status).toBe(409);
    expect((error as AppError).userMessage).toBe(
      'Phở Fan đã đạt giới hạn 10 bạn bè của gói miễn phí.'
    );
  });

  it('passes when the at-cap inviter is premium', async () => {
    const { db, queue } = makeDb();
    queue.push([{ accepterCount: 1, inviterCount: 12 }]);
    queue.push([profileRow(INVITER, 'Phở Fan')]);
    mockCheckFeatureAccess.mockResolvedValue({ allowed: true });

    await expect(assertFriendCapacity(db, input)).resolves.toBeUndefined();
  });
});
