import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/infra/db/client', () => ({ db: {} }));

import { repliesForShares } from '@/lib/domain/social/shares/replies';

const ACTOR_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const SHARE_ID = 'b1ffcd00-ad1c-4ff9-8c7e-7ccace491b22';

function fakeDb(rows: unknown[]) {
  const ranked = {
    id: 'ranked.id',
    shareId: 'ranked.shareId',
    userId: 'ranked.userId',
    body: 'ranked.body',
    createdAt: 'ranked.createdAt',
    rank: 'ranked.rank',
    total: 'ranked.total',
  };
  const select = vi
    .fn()
    .mockReturnValueOnce({
      from: vi.fn(() => ({
        where: vi.fn(() => ({ as: vi.fn(() => ranked) })),
      })),
    })
    .mockReturnValueOnce({
      from: vi.fn(() => ({
        innerJoin: vi.fn(() => ({
          where: vi.fn(() => ({
            orderBy: vi.fn().mockResolvedValue(rows),
          })),
        })),
      })),
    });
  return { select };
}

describe('repliesForShares', () => {
  it('returns the bounded chronological slice and full total', async () => {
    const createdAt = new Date('2026-07-18T12:00:00.000Z');
    const db = fakeDb([
      {
        id: 'c2aade11-be2d-4aa0-8d8f-8ddbdf502c33',
        shareId: SHARE_ID,
        userId: ACTOR_ID,
        body: 'Ngon quá',
        createdAt,
        total: 17,
        handle: 'pho-fan',
        displayName: 'Phở Fan',
        avatarSeed: 'pho-fan',
        avatarUrl: null,
      },
    ]);

    const result = await repliesForShares(ACTOR_ID, [SHARE_ID], db as never);

    expect(result.get(SHARE_ID)).toEqual({
      replies: [
        expect.objectContaining({
          body: 'Ngon quá',
          isSelf: true,
          createdAt: createdAt.toISOString(),
        }),
      ],
      total: 17,
    });
    expect(db.select).toHaveBeenCalledTimes(2);
  });

  it('materializes empty summaries without querying', async () => {
    const db = fakeDb([]);

    const result = await repliesForShares(ACTOR_ID, [], db as never);

    expect(result.size).toBe(0);
    expect(db.select).not.toHaveBeenCalled();
  });
});
