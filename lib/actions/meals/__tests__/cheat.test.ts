import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — both cheat actions run straight off the db singleton (no transaction).
// ---------------------------------------------------------------------------

const { mockDbSelect, mockDbInsert, assertFeatureAccess } = vi.hoisted(() => ({
  mockDbSelect: vi.fn(),
  mockDbInsert: vi.fn(),
  assertFeatureAccess: vi.fn(),
}));

vi.mock('@/lib/domain/billing/feature-gate', () => ({ assertFeatureAccess }));

vi.mock('@/lib/infra/auth/session', async () => {
  const { MOCK_USER, MOCK_PROFILE } = await import('./meal-doubles');
  return {
    requireAuthAndProfile: vi
      .fn()
      .mockResolvedValue({ user: MOCK_USER, profile: MOCK_PROFILE }),
  };
});

vi.mock('@/lib/infra/db/client', () => ({
  db: { select: mockDbSelect, insert: mockDbInsert },
}));

vi.mock(
  '@/lib/infra/db/schema',
  async () => (await import('./meal-doubles')).schema
);

// ---------------------------------------------------------------------------
// Modules under test — imported AFTER mocks
// ---------------------------------------------------------------------------

import {
  loadRecentCheatOccasionsAction,
  stageCheatRepeatAction,
} from '@/lib/actions/meals/cheat';
import { FeatureLockedError } from '@/lib/core/errors/app-error';
import { LOGGED_AT, MOCK_PROFILE, MOCK_USER, UUID_MEAL } from './meal-doubles';

/** select ... where ... orderBy ... limit — the occasions history read. */
function queueHistorySelect(rows: unknown[]) {
  mockDbSelect.mockReturnValueOnce({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        orderBy: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue(rows),
        }),
      }),
    }),
  });
}

/** select ... where ... limit — the source-meal lookup in stage-repeat. */
function queueSourceSelect(rows: unknown[]) {
  mockDbSelect.mockReturnValueOnce({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue(rows),
      }),
    }),
  });
}

const repeatInput = {
  sourceMealId: UUID_MEAL,
  loggedDate: '2026-06-24',
  timezoneOffset: -420,
};

beforeEach(() => {
  vi.clearAllMocks();
  assertFeatureAccess.mockResolvedValue(undefined);
});

describe('loadRecentCheatOccasionsAction', () => {
  // Reads stay FREE. The chips are what sells the upgrade — hiding a free
  // user's own cheat history behind the paywall would gate the advertisement,
  // not the feature.
  it('never consults the premium gate', async () => {
    queueHistorySelect([
      { id: UUID_MEAL, rawInput: 'Korean BBQ', loggedAt: LOGGED_AT },
    ]);

    const result = await loadRecentCheatOccasionsAction({ limit: 3 });

    expect(result).toHaveLength(1);
    expect(assertFeatureAccess).not.toHaveBeenCalled();
  });
});

describe('stageCheatRepeatAction', () => {
  it('refuses a locked user before reading or staging anything', async () => {
    assertFeatureAccess.mockRejectedValueOnce(
      new FeatureLockedError('cheat_meal', 'not_entitled', 'locked')
    );

    await expect(stageCheatRepeatAction(repeatInput)).rejects.toBeInstanceOf(
      FeatureLockedError
    );

    expect(assertFeatureAccess).toHaveBeenCalledWith(
      { userId: MOCK_USER.id, profileCreatedAt: MOCK_PROFILE.createdAt },
      'cheat_meal'
    );
    expect(mockDbSelect).not.toHaveBeenCalled();
    expect(mockDbInsert).not.toHaveBeenCalled();
  });

  it('stages the repeat unchanged for an entitled user', async () => {
    const spec = {
      confidence: 'medium',
      sliders: [
        {
          id: 'beer',
          label: 'Bia',
          levels: [{ id: 'l1', label: '1 lon', caloriesKcal: 150 }],
          defaultLevelId: 'l1',
        },
      ],
    };
    queueSourceSelect([
      {
        rawInput: 'Korean BBQ',
        entryMode: 'cheat',
        cheatSliders: { spec, levels: { beer: 'l1' } },
      },
    ]);
    mockDbInsert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: 'pending-1' }]),
      }),
    });

    const result = await stageCheatRepeatAction(repeatInput);

    expect(result.analysisId).toBe('pending-1');
    expect(result.rawInput).toBe('Korean BBQ');
    expect(mockDbInsert).toHaveBeenCalledOnce();
  });
});
