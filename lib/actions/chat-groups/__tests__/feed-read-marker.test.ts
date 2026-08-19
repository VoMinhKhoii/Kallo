import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
// Drives the default `db` singleton (owner role) so the real requireGroupAccess
// gate runs — the companion feed.test.ts stubs that gate and injects a db
// instead, to isolate the post-join visibility window.

const { mockDbSelect, mockDbUpdate } = vi.hoisted(() => ({
  mockDbSelect: vi.fn(),
  mockDbUpdate: vi.fn(),
}));

vi.mock('@/lib/infra/db/client', () => ({
  db: {
    select: mockDbSelect,
    update: mockDbUpdate,
  },
}));

vi.mock('drizzle-orm/pg-core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm/pg-core')>();
  return { ...actual, alias: (table: unknown) => table };
});

vi.mock('@/lib/infra/db/schema', async () => await import('./schema-doubles'));

vi.mock('@/lib/domain/social/shares/reactions', () => ({
  reactionsForShares: vi.fn(
    async (_actorId: string, shareIds: string[]) =>
      new Map(shareIds.map((id) => [id, { count: 0, mine: false }]))
  ),
}));
vi.mock('@/lib/domain/social/shares/replies', () => ({
  repliesForShares: vi.fn(
    async (_actorId: string, shareIds: string[]) =>
      new Map(shareIds.map((id) => [id, { replies: [], total: 0 }]))
  ),
}));

// ---------------------------------------------------------------------------
// Module under test — imported AFTER mocks
// ---------------------------------------------------------------------------

import { listGroupMealFeed } from '@/lib/actions/chat-groups/feed';
import { reactionsForShares } from '@/lib/domain/social/shares/reactions';

const USER_A = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const USER_B = 'b1ffcd00-ad1c-4ff9-8c7e-7ccace491b22';
const GROUP_ID = 'd3bbde22-cf3e-4bb1-9e9f-9eecef613d44';

// A `.from()[.innerJoin()...].where().limit()` chain resolving to the given
// rows (db.select). innerJoin returns the same level so chains with zero or
// more joins (requireMembership joins chat_groups) all land on where().limit().
function selectRows(rows: unknown[]) {
  const level: Record<string, ReturnType<typeof vi.fn>> = {
    where: vi.fn().mockReturnValue({
      limit: vi.fn().mockResolvedValue(rows),
    }),
    innerJoin: vi.fn(),
  };
  level.innerJoin.mockReturnValue(level);
  return { from: vi.fn().mockReturnValue(level) };
}

function accessRow(
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    kind: 'group',
    role: 'member',
    joinedAt: new Date('2020-01-01T00:00:00.000Z'),
    directUserLow: null,
    directUserHigh: null,
    directFriendAccepted: true,
    ...overrides,
  };
}

// A stub update chain: db.update(table).set(vals).where(cond) -> resolves.
function stubUpdate(capture?: { set?: unknown }) {
  mockDbUpdate.mockReturnValue({
    set: vi.fn((values: unknown) => {
      if (capture) capture.set = values;
      return { where: vi.fn().mockResolvedValue(undefined) };
    }),
  });
}

describe('listGroupMealFeed', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // requireMembership: db.select().from().where().limit().
  function membershipQuery(rows: unknown[]) {
    mockDbSelect.mockReturnValueOnce(
      selectRows(
        rows.length > 0 ? [accessRow(rows[0] as Record<string, unknown>)] : []
      )
    );
  }

  // sharedGroupMealsBefore: four joins, then seek/order/limit.
  function sharedMealsBeforeQuery(rows: unknown[]) {
    const boundedRows = rows.map((row) => ({
      ...(row as Record<string, unknown>),
      ownerJoinedAt: new Date('2020-01-01T00:00:00.000Z'),
      visibilitySharedAt: (row as { sharedAt?: Date }).sharedAt,
    }));
    const query = {
      innerJoin: vi.fn(),
      where: vi.fn(),
      orderBy: vi.fn(),
      limit: vi.fn().mockResolvedValue(boundedRows),
    };
    query.innerJoin.mockReturnValue(query);
    query.where.mockReturnValue(query);
    query.orderBy.mockReturnValue(query);
    mockDbSelect.mockReturnValueOnce({
      from: vi.fn().mockReturnValue(query),
    });
  }

  function sharedMeal(index: number, sharedAt: Date) {
    return {
      friendUserId: USER_B,
      mealId: `meal-${index}`,
      shareId: `00000000-0000-4000-8000-${index
        .toString(16)
        .padStart(12, '0')}`,
      rawInput: `meal ${index}`,
      caloriesKcal: 500,
      proteinG: 20,
      carbohydrateG: 50,
      fatG: 15,
      portionFactor: 1,
      sharedAt,
      loggedAt: sharedAt,
      sharedAtText: sharedAt.toISOString(),
      handle: 'phofan',
      displayName: null,
      avatarSeed: 'phofan',
      avatarUrl: null,
    };
  }

  it('rejects a non-member', async () => {
    membershipQuery([]);

    await expect(
      listGroupMealFeed(USER_A, { groupId: GROUP_ID })
    ).rejects.toThrow('Không tìm thấy nhóm chat.');
  });

  it('returns every shared meal among members, not collapsed per person', async () => {
    const marker: { set?: unknown } = {};
    membershipQuery([{ id: 'member-row' }]);
    sharedMealsBeforeQuery([
      sharedMeal(2, new Date('2026-01-01T18:00:00Z')),
      sharedMeal(1, new Date('2026-01-01T08:00:00Z')),
    ]);
    stubUpdate(marker);

    const page = await listGroupMealFeed(USER_A, { groupId: GROUP_ID });

    expect(page.entries).toHaveLength(2);
    expect(page.nextCursor).toBeNull();
    expect(mockDbUpdate).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(marker.set)).toContain('2026-01-01T18:00:00.000Z');
    expect(JSON.stringify(marker.set)).toContain('GREATEST');
  });

  it('reports a nextCursor when more history remains', async () => {
    membershipQuery([{ id: 'member-row' }]);
    const rows = Array.from({ length: 21 }, (_, i) =>
      sharedMeal(i, new Date(Date.UTC(2026, 0, 21 - i)))
    );
    sharedMealsBeforeQuery(rows);
    stubUpdate(); // page 1 bumps lastReadAt

    const page = await listGroupMealFeed(USER_A, { groupId: GROUP_ID });

    expect(page.entries).toHaveLength(20);
    expect(page.nextCursor).not.toBeNull();
  });

  it('does not bump lastReadAt for an empty first page', async () => {
    membershipQuery([{ id: 'member-row' }]);
    sharedMealsBeforeQuery([]);
    stubUpdate();

    await listGroupMealFeed(USER_A, { groupId: GROUP_ID });

    expect(mockDbUpdate).not.toHaveBeenCalled();
  });

  it('does not bump lastReadAt when paginating with a `before` cursor', async () => {
    membershipQuery([{ id: 'member-row' }]);
    sharedMealsBeforeQuery([]);

    await listGroupMealFeed(USER_A, {
      groupId: GROUP_ID,
      before: '2026-01-01T00:00:00.000Z',
    });

    expect(mockDbUpdate).not.toHaveBeenCalled();
  });

  it('does not advance lastReadAt when reaction enrichment fails', async () => {
    membershipQuery([{ id: 'member-row' }]);
    sharedMealsBeforeQuery([
      sharedMeal(1, new Date('2026-01-01T18:00:00.000Z')),
    ]);
    vi.mocked(reactionsForShares).mockRejectedValueOnce(
      new Error('reaction read failed')
    );

    await expect(
      listGroupMealFeed(USER_A, { groupId: GROUP_ID })
    ).rejects.toThrow('reaction read failed');
    expect(mockDbUpdate).not.toHaveBeenCalled();
  });
});
