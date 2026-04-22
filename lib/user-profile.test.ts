import { describe, expect, it, vi } from 'vitest';
import { getOrCreateUserProfile } from '@/lib/user-profile';

type ProfileRow = {
  userId: string;
  onboardingStep: number;
};

function createDbMock({
  selectResults,
  insertResults = [],
}: {
  selectResults: ProfileRow[][];
  insertResults?: ProfileRow[];
}) {
  const limit = vi.fn();
  for (const result of selectResults) {
    limit.mockResolvedValueOnce(result);
  }

  const selectChain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit,
  };
  const insertChain = {
    values: vi.fn().mockReturnThis(),
    onConflictDoNothing: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue(insertResults),
  };

  return {
    select: vi.fn().mockReturnValue(selectChain),
    insert: vi.fn().mockReturnValue(insertChain),
    selectChain,
    insertChain,
  };
}

describe('getOrCreateUserProfile', () => {
  it('returns the existing profile without inserting', async () => {
    const profile = { userId: 'u1', onboardingStep: 2 };
    const database = createDbMock({ selectResults: [[profile]] });

    await expect(
      getOrCreateUserProfile('u1', database as never)
    ).resolves.toEqual(profile);

    expect(database.insert).not.toHaveBeenCalled();
  });

  it('creates a profile row when one is missing', async () => {
    const created = { userId: 'u1', onboardingStep: 0 };
    const database = createDbMock({
      selectResults: [[]],
      insertResults: [created],
    });

    await expect(
      getOrCreateUserProfile('u1', database as never)
    ).resolves.toEqual(created);

    expect(database.insert).toHaveBeenCalledTimes(1);
    expect(database.insertChain.values).toHaveBeenCalledWith({ userId: 'u1' });
  });

  it('reloads the profile after a conflict-safe insert returns nothing', async () => {
    const existing = { userId: 'u1', onboardingStep: 1 };
    const database = createDbMock({
      selectResults: [[], [existing]],
      insertResults: [],
    });

    await expect(
      getOrCreateUserProfile('u1', database as never)
    ).resolves.toEqual(existing);

    expect(database.select).toHaveBeenCalledTimes(2);
  });
});
