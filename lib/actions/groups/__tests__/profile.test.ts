import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — the profile actions read and write through the `db` singleton only.
// ---------------------------------------------------------------------------

const { mockDbSelect, mockDbInsert, mockDbUpdate } = vi.hoisted(() => ({
  mockDbSelect: vi.fn(),
  mockDbInsert: vi.fn(),
  mockDbUpdate: vi.fn(),
}));

vi.mock('@/lib/infra/db/client', () => ({
  db: {
    select: mockDbSelect,
    insert: mockDbInsert,
    update: mockDbUpdate,
  },
}));

vi.mock(
  '@/lib/infra/db/schema',
  async () => (await import('./circle-doubles')).schema
);

// ---------------------------------------------------------------------------
// Module under test — imported AFTER mocks
// ---------------------------------------------------------------------------

import {
  getMyPublicProfile,
  getOrCreateMyProfile,
  getProfileBySlug,
  renameMyProfile,
  upsertPublicProfile,
} from '@/lib/actions/groups/profile';
import {
  ACTOR,
  INVITER,
  inviterProfile,
  inviterRow,
  SLUG,
  selectRows,
} from './circle-doubles';

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
    expect(await getProfileBySlug(SLUG)).toEqual(inviterProfile);
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

// ---------------------------------------------------------------------------
// upsertPublicProfile — tri-state displayName (omitted=keep, null=clear)
// ---------------------------------------------------------------------------

describe('upsertPublicProfile', () => {
  // Capture the insert values and the ON CONFLICT update set.
  function captureUpsert() {
    const captured: {
      values?: Record<string, unknown>;
      set?: Record<string, unknown>;
    } = {};
    mockDbInsert.mockImplementation(() => ({
      values: vi.fn().mockImplementation((vals: Record<string, unknown>) => {
        captured.values = vals;
        return {
          onConflictDoUpdate: vi
            .fn()
            .mockImplementation((cfg: { set: Record<string, unknown> }) => {
              captured.set = cfg.set;
              return {
                returning: vi.fn().mockResolvedValue([
                  {
                    userId: ACTOR,
                    handle: SLUG,
                    displayName: 'Phở Fan',
                    avatarSeed: SLUG,
                  },
                ]),
              };
            }),
        };
      }),
    }));
    return captured;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    // Handle-taken pre-check: not taken.
    mockDbSelect.mockReturnValue(selectRows([]));
  });

  it('a slug-only save preserves the stored display name and avatar seed', async () => {
    const captured = captureUpsert();

    await upsertPublicProfile(ACTOR, { handle: SLUG });

    // The update set must NOT touch displayName/avatarSeed when omitted —
    // this is the regression where renaming your link wiped your name.
    expect(captured.set).not.toHaveProperty('displayName');
    expect(captured.set).not.toHaveProperty('avatarSeed');
    expect(captured.set).toHaveProperty('handle', SLUG);
  });

  it('an explicit null clears the display name', async () => {
    const captured = captureUpsert();

    await upsertPublicProfile(ACTOR, { handle: SLUG, displayName: null });

    expect(captured.set).toHaveProperty('displayName', null);
  });

  it('a provided display name is set on both insert and update', async () => {
    const captured = captureUpsert();

    await upsertPublicProfile(ACTOR, { handle: SLUG, displayName: 'Bún Chả' });

    expect(captured.values).toHaveProperty('displayName', 'Bún Chả');
    expect(captured.set).toHaveProperty('displayName', 'Bún Chả');
  });

  it('rejects an empty-string display name (clear is null, not "")', async () => {
    captureUpsert();

    await expect(
      upsertPublicProfile(ACTOR, { handle: SLUG, displayName: '' })
    ).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// renameMyProfile — display name + handle cascade
// ---------------------------------------------------------------------------

describe('renameMyProfile', () => {
  // Capture every db.update(...).set(...) and script per-call outcomes:
  // an entry in `fails` at index i makes the i-th update throw 23505.
  function captureUpdates(fails: number[] = []) {
    const sets: Record<string, unknown>[] = [];
    let call = 0;
    mockDbUpdate.mockImplementation(() => ({
      set: vi.fn().mockImplementation((vals: Record<string, unknown>) => {
        sets.push(vals);
        const failing = fails.includes(call);
        call += 1;
        return {
          where: vi.fn().mockReturnValue({
            returning: failing
              ? vi
                  .fn()
                  .mockRejectedValue(
                    Object.assign(new Error('dup'), { code: '23505' })
                  )
              : vi.fn().mockImplementation(() =>
                  Promise.resolve([
                    {
                      userId: ACTOR,
                      handle: (vals.handle as string) ?? 'mine4821',
                      displayName: vals.displayName ?? null,
                      avatarSeed: 'mine4821',
                      avatarUrl: null,
                      avatarPath: null,
                    },
                  ])
                ),
          }),
        };
      }),
    }));
    return sets;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    // getOrCreateMyProfile: the actor already has a provisioned profile.
    mockDbSelect.mockReturnValue(
      selectRows([
        {
          userId: ACTOR,
          handle: 'mine4821',
          displayName: null,
          avatarSeed: 'mine4821',
          avatarUrl: null,
          avatarPath: null,
        },
      ])
    );
  });

  it('sets the name and re-derives the handle from it (diacritics stripped)', async () => {
    const sets = captureUpdates();

    const result = await renameMyProfile(ACTOR, 'Đặng Thu Hà');

    expect(sets).toHaveLength(1);
    expect(sets[0]).toMatchObject({
      displayName: 'Đặng Thu Hà',
      handle: 'dangthuha',
    });
    expect(result.handle).toBe('dangthuha');
    expect(result.displayName).toBe('Đặng Thu Hà');
  });

  it('keeps the current handle when the derived slug already matches it', async () => {
    mockDbSelect.mockReturnValue(
      selectRows([
        {
          userId: ACTOR,
          handle: 'dangthuha42', // earlier collision suffix on the same base
          displayName: 'Đặng Thu Hà',
          avatarSeed: 'x',
          avatarUrl: null,
          avatarPath: null,
        },
      ])
    );
    const sets = captureUpdates();

    await renameMyProfile(ACTOR, 'Đặng Thu Hà!');

    expect(sets).toHaveLength(1);
    expect(sets[0]).not.toHaveProperty('handle');
  });

  it('suffixes digits and retries on a handle collision', async () => {
    const sets = captureUpdates([0]); // first update hits 23505

    const result = await renameMyProfile(ACTOR, 'Thu Ha');

    expect(sets).toHaveLength(2);
    expect(sets[0]).toMatchObject({ handle: 'thuha' });
    expect(sets[1].handle).toMatch(/^thuha\d{2,4}$/u);
    expect(result.handle).toMatch(/^thuha\d{2,4}$/u);
  });

  it('suffixes a reserved base instead of using it bare', async () => {
    const sets = captureUpdates();

    await renameMyProfile(ACTOR, 'Admin');

    expect(sets).toHaveLength(1);
    expect(sets[0].handle).toMatch(/^admin\d{2,4}$/u);
  });

  it('rejects an empty name', async () => {
    captureUpdates();
    await expect(renameMyProfile(ACTOR, '   ')).rejects.toThrow();
    expect(mockDbUpdate).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// getMyPublicProfile — uploaded avatar_path wins over the OAuth avatar_url
// ---------------------------------------------------------------------------

describe('getMyPublicProfile avatar URL', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('maps a stored avatar path to the public bucket URL over the OAuth one', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://proj.supabase.co');
    mockDbSelect.mockReturnValueOnce(
      selectRows([
        {
          userId: ACTOR,
          handle: 'mine4821',
          displayName: 'Khoi',
          avatarSeed: 'mine4821',
          avatarUrl: 'https://lh3.googleusercontent.com/x',
          avatarPath: `${ACTOR}/abc.jpg`,
        },
      ])
    );

    const result = await getMyPublicProfile(ACTOR);

    expect(result?.avatarUrl).toBe(
      `https://proj.supabase.co/storage/v1/object/public/avatars/${ACTOR}/abc.jpg`
    );
    vi.unstubAllEnvs();
  });

  it('falls back to the OAuth picture when no photo is uploaded', async () => {
    mockDbSelect.mockReturnValueOnce(
      selectRows([
        {
          ...inviterRow,
          avatarUrl: 'https://lh3.googleusercontent.com/x',
          avatarPath: null,
        },
      ])
    );
    const result = await getMyPublicProfile(INVITER);
    expect(result?.avatarUrl).toBe('https://lh3.googleusercontent.com/x');
  });
});
