import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
// `db.*` is the app singleton (owner role); `tx.*` is the transaction handle
// acceptInvite opens. They are distinct mocks so the profile lookup (db.select)
// never collides with the in-transaction friendship lookup (tx.select).

const {
  mockDbSelect,
  mockDbInsert,
  mockDbDelete,
  mockTxSelect,
  mockTxInsert,
  mockTxUpdate,
  mockTx,
} = vi.hoisted(() => {
  const mockTxSelect = vi.fn();
  const mockTxInsert = vi.fn();
  const mockTxUpdate = vi.fn();
  return {
    mockDbSelect: vi.fn(),
    mockDbInsert: vi.fn(),
    mockDbDelete: vi.fn(),
    mockTxSelect,
    mockTxInsert,
    mockTxUpdate,
    mockTx: {
      select: mockTxSelect,
      insert: mockTxInsert,
      update: mockTxUpdate,
    },
  };
});

vi.mock('@/lib/db', () => ({
  db: {
    select: mockDbSelect,
    insert: mockDbInsert,
    delete: mockDbDelete,
    transaction: vi.fn((fn: (tx: typeof mockTx) => Promise<unknown>) =>
      fn(mockTx)
    ),
  },
}));

// Export EVERY table groups.ts imports — a missing one makes the module-level
// import `undefined` and breaks unrelated queries (the meals.test.ts trap).
vi.mock('@/lib/db/schema', () => ({
  publicProfiles: {
    userId: 'pp.userId',
    handle: 'pp.handle',
    displayName: 'pp.displayName',
    avatarSeed: 'pp.avatarSeed',
  },
  friendships: {
    id: 'f.id',
    status: 'f.status',
    userLow: 'f.userLow',
    userHigh: 'f.userHigh',
    requestedBy: 'f.requestedBy',
    updatedAt: 'f.updatedAt',
  },
  circleEvents: { actorId: 'ce.actorId', type: 'ce.type', refId: 'ce.refId' },
  mealShares: { id: 'ms.id', mealId: 'ms.mealId', visibility: 'ms.visibility' },
  meals: { id: 'm.id', userId: 'm.userId' },
}));

// ---------------------------------------------------------------------------
// Module under test — imported AFTER mocks
// ---------------------------------------------------------------------------

import {
  acceptInvite,
  getOrCreateMyProfile,
  getProfileBySlug,
  removeFriend,
} from '@/lib/actions/groups';

// Valid v4 UUIDs (the remove/uuid schemas validate version+variant bits).
const ACTOR = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const INVITER = 'b1ffcd00-ad1c-4ff9-8c7e-7ccace491b22';
const FRIENDSHIP_ID = 'c2aade11-be2d-4aa0-8d8f-8ddbdf502c33';
const SLUG = 'pho4821';

const inviterRow = {
  userId: INVITER,
  handle: SLUG,
  displayName: 'Phở Fan',
  avatarSeed: SLUG,
};

// A `.from().where().limit()` chain resolving to the given rows.
function selectRows(rows: unknown[]) {
  return {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue(rows),
      }),
    }),
  };
}

// Capture every tx.insert(table).values(vals); `.returning()` yields the friendship row.
function captureInserts() {
  const calls: Record<string, unknown>[] = [];
  mockTxInsert.mockImplementation(() => ({
    values: vi.fn().mockImplementation((vals: Record<string, unknown>) => {
      calls.push(vals);
      return { returning: vi.fn().mockResolvedValue([{ id: FRIENDSHIP_ID }]) };
    }),
  }));
  return calls;
}

// ---------------------------------------------------------------------------
// acceptInvite
// ---------------------------------------------------------------------------

describe('acceptInvite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects a malformed slug before touching the db', async () => {
    await expect(acceptInvite(ACTOR, { slug: 'no' })).rejects.toThrow();
    expect(mockDbSelect).not.toHaveBeenCalled();
  });

  it('rejects an unknown inviter slug', async () => {
    mockDbSelect.mockReturnValueOnce(selectRows([]));
    await expect(acceptInvite(ACTOR, { slug: SLUG })).rejects.toThrow(
      'Liên kết mời không hợp lệ.'
    );
  });

  it('rejects connecting to your own link', async () => {
    mockDbSelect.mockReturnValueOnce(
      selectRows([{ ...inviterRow, userId: ACTOR }])
    );
    await expect(acceptInvite(ACTOR, { slug: SLUG })).rejects.toThrow(
      'Không thể kết nối với chính mình.'
    );
  });

  it('creates an accepted edge crediting the inviter, plus an event', async () => {
    mockDbSelect.mockReturnValueOnce(selectRows([inviterRow]));
    mockTxSelect.mockReturnValueOnce(selectRows([])); // no existing edge
    const inserts = captureInserts();

    const result = await acceptInvite(ACTOR, { slug: SLUG });

    expect(result).toEqual({ status: 'accepted', inviter: inviterRow });
    expect(mockTxUpdate).not.toHaveBeenCalled();
    expect(mockTxInsert).toHaveBeenCalledTimes(2); // friendship + event

    const friendship = inserts.find((v) => 'status' in v);
    expect(friendship?.status).toBe('accepted');
    expect(friendship?.requestedBy).toBe(INVITER); // inviter initiated the link

    const event = inserts.find((v) => v.type === 'friend_accepted');
    expect(event?.refId).toBe(FRIENDSHIP_ID);
  });

  it('promotes a pending edge to accepted', async () => {
    mockDbSelect.mockReturnValueOnce(selectRows([inviterRow]));
    mockTxSelect.mockReturnValueOnce(
      selectRows([{ id: FRIENDSHIP_ID, status: 'pending' }])
    );
    mockTxUpdate.mockReturnValue({
      set: vi
        .fn()
        .mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
    });
    const inserts = captureInserts();

    const result = await acceptInvite(ACTOR, { slug: SLUG });

    expect(result.status).toBe('accepted');
    expect(mockTxUpdate).toHaveBeenCalledTimes(1);
    expect(mockTxInsert).toHaveBeenCalledTimes(1); // only the event
    expect(inserts[0]?.type).toBe('friend_accepted');
    expect(inserts[0]?.refId).toBe(FRIENDSHIP_ID);
  });

  it('is a no-op when already connected', async () => {
    mockDbSelect.mockReturnValueOnce(selectRows([inviterRow]));
    mockTxSelect.mockReturnValueOnce(
      selectRows([{ id: FRIENDSHIP_ID, status: 'accepted' }])
    );

    const result = await acceptInvite(ACTOR, { slug: SLUG });

    expect(result.status).toBe('accepted');
    expect(mockTxUpdate).not.toHaveBeenCalled();
    expect(mockTxInsert).not.toHaveBeenCalled();
  });

  it('refuses to connect over a blocked edge', async () => {
    mockDbSelect.mockReturnValueOnce(selectRows([inviterRow]));
    mockTxSelect.mockReturnValueOnce(
      selectRows([{ id: FRIENDSHIP_ID, status: 'blocked' }])
    );

    await expect(acceptInvite(ACTOR, { slug: SLUG })).rejects.toThrow(
      'Không thể kết nối.'
    );
    expect(mockTxUpdate).not.toHaveBeenCalled();
    expect(mockTxInsert).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// removeFriend
// ---------------------------------------------------------------------------

describe('removeFriend', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects removing yourself', async () => {
    await expect(removeFriend(ACTOR, { targetUserId: ACTOR })).rejects.toThrow(
      'Không thể xoá chính mình.'
    );
    expect(mockDbDelete).not.toHaveBeenCalled();
  });

  it('rejects a non-uuid target', async () => {
    await expect(
      removeFriend(ACTOR, { targetUserId: 'not-a-uuid' })
    ).rejects.toThrow();
    expect(mockDbDelete).not.toHaveBeenCalled();
  });

  it('deletes the canonical edge', async () => {
    mockDbDelete.mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    });

    const result = await removeFriend(ACTOR, { targetUserId: INVITER });

    expect(result).toEqual({ removed: true });
    expect(mockDbDelete).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// getProfileBySlug
// ---------------------------------------------------------------------------

describe('getProfileBySlug', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null for a malformed slug without querying', async () => {
    expect(await getProfileBySlug('!!')).toBeNull();
    expect(mockDbSelect).not.toHaveBeenCalled();
  });

  it('returns the matching profile', async () => {
    mockDbSelect.mockReturnValueOnce(selectRows([inviterRow]));
    expect(await getProfileBySlug(SLUG)).toEqual(inviterRow);
  });

  it('returns null when no profile matches', async () => {
    mockDbSelect.mockReturnValueOnce(selectRows([]));
    expect(await getProfileBySlug(SLUG)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// getOrCreateMyProfile
// ---------------------------------------------------------------------------

describe('getOrCreateMyProfile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the existing profile without provisioning', async () => {
    mockDbSelect.mockReturnValueOnce(
      selectRows([{ ...inviterRow, userId: ACTOR }])
    );

    const result = await getOrCreateMyProfile(ACTOR);

    expect(result.userId).toBe(ACTOR);
    expect(mockDbInsert).not.toHaveBeenCalled();
  });

  it('provisions a generated link on first use', async () => {
    mockDbSelect.mockReturnValueOnce(selectRows([])); // none yet
    mockDbInsert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([
          {
            userId: ACTOR,
            handle: 'cafe1234',
            displayName: null,
            avatarSeed: 'cafe1234',
          },
        ]),
      }),
    });

    const result = await getOrCreateMyProfile(ACTOR);

    expect(result.userId).toBe(ACTOR);
    expect(result.handle).toBe('cafe1234');
    expect(mockDbInsert).toHaveBeenCalledTimes(1);
  });
});
