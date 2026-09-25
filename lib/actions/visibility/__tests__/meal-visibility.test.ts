import { is, SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import { describe, expect, it, vi } from 'vitest';
import { setMealShareVisibility } from '@/lib/actions/visibility/meal-visibility';

// KALLO-03: a friend sees a share only when shared_at >= friendships.accepted_at,
// and the DB trigger stamps accepted_at with the database clock. A re-share
// must bump shared_at on that same clock — an app-server Date would compare
// across two clocks and could land a pre-connection share after accepted_at.

const USER_ID = '9d1f2c44-7b3e-4a55-9c22-1aa2bb334455';
const MEAL_ID = '1b2c3d4e-5f60-4a71-8b92-a3b4c5d6e7f8';
const SHARE_ID = '7a6b5c4d-3e2f-4a1b-9c8d-7e6f5a4b3c2d';

function fakeDb(rawInput = 'Phở bò tái') {
  const onConflictDoUpdate = vi.fn().mockReturnValue({
    returning: vi.fn().mockResolvedValue([{ id: SHARE_ID }]),
  });
  const insert = vi.fn(() => ({ values: () => ({ onConflictDoUpdate }) }));
  const db = {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: vi.fn().mockResolvedValue([{ id: MEAL_ID, rawInput }]),
        }),
      }),
    }),
    insert,
  };
  return { db, onConflictDoUpdate, insert };
}

describe('setMealShareVisibility', () => {
  it('bumps shared_at with the database clock on a re-share', async () => {
    const { db, onConflictDoUpdate } = fakeDb();

    const result = await setMealShareVisibility(
      USER_ID,
      { mealId: MEAL_ID, visibility: 'circle' },
      db as never
    );

    expect(result).toEqual({
      mealId: MEAL_ID,
      visibility: 'circle',
      shareId: SHARE_ID,
    });
    const { set } = onConflictDoUpdate.mock.calls[0][0] as {
      set: { visibility: string; sharedAt: unknown };
    };
    expect(set.visibility).toBe('circle');
    expect(set.sharedAt).not.toBeInstanceOf(Date);
    expect(is(set.sharedAt, SQL)).toBe(true);
    expect(new PgDialect().sqlToQuery(set.sharedAt as SQL).sql).toBe('now()');
  });

  // Sharing shows the meal's text to friends, so it passes the objectionable-
  // content filter first; a refused share writes nothing.
  it('refuses to share a flagged meal with a 422 and writes nothing', async () => {
    const { db, insert } = fakeDb('ăn với con đĩ đó');

    await expect(
      setMealShareVisibility(
        USER_ID,
        { mealId: MEAL_ID, visibility: 'circle' },
        db as never
      )
    ).rejects.toMatchObject({ code: 'objectionable_content', status: 422 });
    expect(insert).not.toHaveBeenCalled();
  });

  it('still lets a flagged meal be made private', async () => {
    const { db, insert } = fakeDb('ăn với con đĩ đó');

    await expect(
      setMealShareVisibility(
        USER_ID,
        { mealId: MEAL_ID, visibility: 'private' },
        db as never
      )
    ).resolves.toMatchObject({ visibility: 'private' });
    expect(insert).toHaveBeenCalledTimes(1);
  });

  it('shares Vietnamese food text normally', async () => {
    const { db, insert } = fakeDb('Bún bò Huế, chả giò, nửa quả bưởi');

    await setMealShareVisibility(
      USER_ID,
      { mealId: MEAL_ID, visibility: 'circle' },
      db as never
    );
    expect(insert).toHaveBeenCalledTimes(1);
  });
});
