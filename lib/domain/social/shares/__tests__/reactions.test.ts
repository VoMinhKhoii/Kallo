import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/infra/db', () => ({ db: {} }));

import { reactionsForShares } from '@/lib/domain/social/shares/reactions';

const ACTOR_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const SHARE_A = 'b1ffcd00-ad1c-4ff9-8c7e-7ccace491b22';
const SHARE_B = 'c2aade11-be2d-4aa0-8d8f-8ddbdf502c33';

function fakeDb(rows: unknown[]) {
  const groupBy = vi.fn().mockResolvedValue(rows);
  const where = vi.fn(() => ({ groupBy }));
  const from = vi.fn(() => ({ where }));
  return { db: { select: vi.fn(() => ({ from })) }, groupBy };
}

describe('reactionsForShares', () => {
  it('deduplicates ids and fills missing summaries with zero state', async () => {
    const { db } = fakeDb([{ shareId: SHARE_A, count: 2, mine: true }]);

    const result = await reactionsForShares(
      ACTOR_ID,
      [SHARE_A, SHARE_A, SHARE_B],
      db as never
    );

    expect(result.get(SHARE_A)).toEqual({ count: 2, mine: true });
    expect(result.get(SHARE_B)).toEqual({ count: 0, mine: false });
    expect(result.size).toBe(2);
  });

  it('does not query for an empty authorized batch', async () => {
    const { db } = fakeDb([]);

    const result = await reactionsForShares(ACTOR_ID, [], db as never);

    expect(result.size).toBe(0);
    expect(db.select).not.toHaveBeenCalled();
  });
});
