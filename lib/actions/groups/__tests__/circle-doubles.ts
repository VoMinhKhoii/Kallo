// Shared doubles for the circle-action suites (friendship, feed, profile).
// All three drive the default `db` singleton through a mock, so the schema
// stand-in, the identity rows and the two select chains live here.

import { vi } from 'vitest';

// Valid v4 UUIDs (the remove/uuid schemas validate version+variant bits).
export const ACTOR = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
export const INVITER = 'b1ffcd00-ad1c-4ff9-8c7e-7ccace491b22';
export const FRIENDSHIP_ID = 'c2aade11-be2d-4aa0-8d8f-8ddbdf502c33';
export const DIRECT_GROUP_ID = 'd3bbde22-cf3e-4bb1-9e9f-9eecef613d44';
export const SLUG = 'pho4821';

// Export EVERY table the circle actions (AND the chat-group modules acceptInvite
// calls into) import — a missing one makes the module-level import `undefined`
// and breaks unrelated queries (the meals.test.ts trap).
export const schema = {
  publicProfiles: {
    userId: 'pp.userId',
    handle: 'pp.handle',
    displayName: 'pp.displayName',
    avatarSeed: 'pp.avatarSeed',
    avatarUrl: 'pp.avatarUrl',
    avatarPath: 'pp.avatarPath',
  },
  friendships: {
    id: 'f.id',
    status: 'f.status',
    userLow: 'f.userLow',
    userHigh: 'f.userHigh',
    requestedBy: 'f.requestedBy',
    updatedAt: 'f.updatedAt',
  },
  friendsFeedReadMarkers: {
    userId: 'ffrm.userId',
    lastReadAt: 'ffrm.lastReadAt',
  },
  circleEvents: { actorId: 'ce.actorId', type: 'ce.type', refId: 'ce.refId' },
  chatGroups: {
    id: 'cg.id',
    kind: 'cg.kind',
    name: 'cg.name',
    createdBy: 'cg.createdBy',
    directUserLow: 'cg.directUserLow',
    directUserHigh: 'cg.directUserHigh',
    avatarSeed: 'cg.avatarSeed',
    updatedAt: 'cg.updatedAt',
  },
  chatGroupMembers: {
    id: 'cgm.id',
    groupId: 'cgm.groupId',
    userId: 'cgm.userId',
    role: 'cgm.role',
    lastReadAt: 'cgm.lastReadAt',
  },
  mealShares: {
    id: 'ms.id',
    mealId: 'ms.mealId',
    actorId: 'ms.actorId',
    visibility: 'ms.visibility',
    sharedAt: 'ms.sharedAt',
  },
  meals: {
    id: 'm.id',
    userId: 'm.userId',
    rawInput: 'm.rawInput',
    caloriesKcal: 'm.caloriesKcal',
    proteinG: 'm.proteinG',
    carbohydrateG: 'm.carbohydrateG',
    fatG: 'm.fatG',
  },
};

export const inviterRow = {
  userId: INVITER,
  handle: SLUG,
  displayName: 'Phở Fan',
  avatarSeed: SLUG,
  avatarUrl: null,
  avatarPath: null,
};

/** inviterRow through the toPublicIdentity projection. */
export const inviterProfile = {
  userId: INVITER,
  handle: SLUG,
  displayName: 'Phở Fan',
  avatarSeed: SLUG,
  avatarUrl: null,
  hasCustomAvatar: false,
};

// A `.from().where().limit()` chain resolving to the given rows (db.select).
export function selectRows(rows: unknown[]) {
  return {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue(rows),
      }),
    }),
  };
}

// The in-transaction read: `.limit(1).for('update')` (locked existing-edge read)
// AND a plain awaited `.limit(1)` (the reconcile read). The limit result is a
// real Promise (so `await` resolves the rows) with `.for()` attached.
export function txSelect(rows: unknown[]) {
  const limitResult = Object.assign(Promise.resolve(rows), {
    for: vi.fn().mockResolvedValue(rows),
  });
  return {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockReturnValue(limitResult),
      }),
    }),
  };
}
