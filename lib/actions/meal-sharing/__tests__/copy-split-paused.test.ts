import { describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// The copy/split feature is paused (lib/domain/social/copy-split-live.ts). The
// REAL constant is used here — no vi.mock of it — so this suite fails the day
// someone flips it back on without revisiting these expectations.
//
// db is mocked as a hard trap: every action must refuse before it reads or
// writes anything, so touching the database at all is a failure.
// ---------------------------------------------------------------------------

const dbTrap = vi.hoisted(
  () => () =>
    Promise.reject(new Error('database was touched while copy/split is paused'))
);

vi.mock('@/lib/infra/db/client', () => ({
  db: {
    transaction: dbTrap,
    select: dbTrap,
    update: dbTrap,
    insert: dbTrap,
  },
}));

const assertFeatureAccess = vi.hoisted(() => vi.fn());
vi.mock('@/lib/domain/billing/feature-gate', () => ({ assertFeatureAccess }));

vi.mock('@/lib/infra/auth/session', () => ({
  requireAuthAndProfile: vi.fn().mockResolvedValue({
    user: { id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' },
    profile: { createdAt: new Date('2026-01-01T00:00:00.000Z') },
  }),
}));

import {
  acceptMealShareInviteAction,
  dismissMealShareInviteAction,
} from '@/lib/actions/meal-sharing/invite-response';
import { listMealShareInvitesAction } from '@/lib/actions/meal-sharing/invites-list';
import { logSharedMealAction } from '@/lib/actions/meal-sharing/log-shared';
import { shareMealWithFriendsAction } from '@/lib/actions/meal-sharing/share-with-friends';
import { AppError } from '@/lib/core/errors/app-error';

const UUID_MEAL = 'c2aade11-be2d-4aa0-8d8f-8ddbdf502c33';
const UUID_FRIEND = 'b1ffcd00-ad1c-4ff9-8c7e-7ccace491b22';
const UUID_INVITE = 'e4ccff33-d04f-4cc2-af01-affdf0724e55';
const UUID_SHARE = 'd3bbef22-cf3e-4bb1-9e90-9eecef613d44';

/** 409, never 402 — this is a paused feature, not a locked purchase. */
async function expectConflict(run: () => Promise<unknown>): Promise<void> {
  const error = await run().then(
    () => null,
    (e: unknown) => e
  );
  expect(error).toBeInstanceOf(AppError);
  const appError = error as AppError;
  expect(appError.status).toBe(409);
  expect(appError.code).toBe('CONFLICT');
  expect(appError.message).toMatch(/tạm dừng/i);
}

describe('copy/split paused', () => {
  it('shareMealWithFriendsAction refuses with a 409', async () => {
    await expectConflict(() =>
      shareMealWithFriendsAction({
        mealId: UUID_MEAL,
        friendUserIds: [UUID_FRIEND],
        mode: 'split',
      })
    );
  });

  it('acceptMealShareInviteAction refuses with a 409', async () => {
    await expectConflict(() =>
      acceptMealShareInviteAction({
        inviteId: UUID_INVITE,
        loggedDate: '2026-04-05',
        timezoneOffset: -420,
      })
    );
  });

  it('dismissMealShareInviteAction refuses with a 409', async () => {
    await expectConflict(() =>
      dismissMealShareInviteAction({ inviteId: UUID_INVITE })
    );
  });

  it('logSharedMealAction refuses with a 409', async () => {
    await expectConflict(() =>
      logSharedMealAction({
        shareId: UUID_SHARE,
        factor: 1,
        loggedDate: '2026-04-05',
        timezoneOffset: -420,
      })
    );
  });

  it('never reaches the premium gate — no paywall for a paused feature', () => {
    expect(assertFeatureAccess).not.toHaveBeenCalled();
  });

  it('listMealShareInvitesAction returns an empty list (silences the badge)', async () => {
    await expect(listMealShareInvitesAction()).resolves.toEqual([]);
  });
});
