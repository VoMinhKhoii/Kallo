import { describe, expect, it, vi } from 'vitest';

import { insertDefaultCircleShare } from '@/lib/actions/meals/insert-default-share';

// KALLO-03: Circle auto-share is opt-in. Only an explicit `true` on the
// profile writes a 'circle' row; a missing profile, or one still on the column
// default, keeps the meal private.

const MEAL_ID = 'f5dd0044-e150-4dd3-b012-b00e01835f66';
const ACTOR_ID = '9d1f2c44-7b3e-4a55-9c22-1aa2bb334455';

function fakeTx(profileRows: Array<{ autoShareToCircle: boolean }>) {
  const lockedRead = vi.fn().mockResolvedValue(profileRows);
  const select = vi.fn(() => ({
    from: () => ({ where: () => ({ for: lockedRead }) }),
  }));
  const values = vi.fn(() => ({
    onConflictDoNothing: () => ({
      returning: vi
        .fn()
        .mockResolvedValue([{ id: 'share-1', visibility: 'circle' }]),
    }),
  }));
  const insert = vi.fn(() => ({ values }));
  return { tx: { select, insert } as never, insert, values, lockedRead };
}

describe('insertDefaultCircleShare', () => {
  it('keeps the meal private when the profile row is missing', async () => {
    const { tx, insert } = fakeTx([]);

    await expect(
      insertDefaultCircleShare(tx, { mealId: MEAL_ID, actorId: ACTOR_ID })
    ).resolves.toBeNull();
    expect(insert).not.toHaveBeenCalled();
  });

  it('keeps the meal private on the default (auto-share off)', async () => {
    const { tx, insert, lockedRead } = fakeTx([{ autoShareToCircle: false }]);

    await expect(
      insertDefaultCircleShare(tx, { mealId: MEAL_ID, actorId: ACTOR_ID })
    ).resolves.toBeNull();
    expect(insert).not.toHaveBeenCalled();
    // The preference is read under a row lock inside the save transaction.
    expect(lockedRead).toHaveBeenCalledWith('update');
  });

  it('writes a circle share only after an explicit opt-in', async () => {
    const { tx, values } = fakeTx([{ autoShareToCircle: true }]);

    await expect(
      insertDefaultCircleShare(tx, { mealId: MEAL_ID, actorId: ACTOR_ID })
    ).resolves.toEqual({ shareId: 'share-1', visibility: 'circle' });
    expect(values).toHaveBeenCalledWith({
      mealId: MEAL_ID,
      actorId: ACTOR_ID,
      visibility: 'circle',
    });
  });
});
