import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PersistedMeal } from '@/lib/actions/meals/types';

// Cheat meals had no action row at all, which quietly meant two things: no way
// to offer one to a friend, and — because every cheat meal is auto-shared to
// the circle on save — no way to see or undo that share either.

const { mockLocked, mockRequirePremium } = vi.hoisted(() => ({
  mockLocked: vi.fn((_feature: string) => false),
  mockRequirePremium: vi.fn(() => true),
}));

vi.mock('@/components/billing/premium-guard-provider', () => ({
  usePremiumGuard: () => ({
    locked: mockLocked,
    requirePremium: mockRequirePremium,
  }),
}));
vi.mock('@/components/billing/premium-dot', () => ({
  PremiumDot: () => <span data-testid="premium-dot" />,
}));
vi.mock('@/components/groups/share-meal-dialog', () => ({
  ShareMealDialog: ({
    copyOnly,
    trigger,
  }: {
    copyOnly?: boolean;
    trigger: React.ReactNode;
  }) => (
    <div data-copyonly={String(Boolean(copyOnly))} data-testid="share-dialog">
      {trigger}
    </div>
  ),
}));
vi.mock('@/components/logging/feed/persisted/share-buttons', () => ({
  ShareToCircleButton: () => <button type="button">shareToCircle</button>,
}));

import { CheatMealActions } from '@/components/logging/feed/cheat/cheat-meal-actions';

const sliders = {
  spec: { sliders: [], mealSlot: null, confidence: 'medium' },
  levels: { protein: 8 },
};

function cheatMeal(overrides: Partial<PersistedMeal> = {}) {
  return {
    id: 'c2aade11-be2d-4aa0-8d8f-8ddbdf502c33',
    rawInput: 'Buffet nướng',
    entryMode: 'cheat',
    nutrition: { caloriesKcal: 1400 },
    cheatSliders: sliders,
    share: { shareId: 'share-1', visibility: 'circle' },
    ...overrides,
  } as unknown as PersistedMeal;
}

describe('CheatMealActions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLocked.mockReturnValue(false);
  });

  it('offers the circle toggle, which the cheat card never had', () => {
    render(<CheatMealActions meal={cheatMeal()} />);

    expect(
      screen.getByRole('button', { name: 'shareToCircle' })
    ).toBeInTheDocument();
  });

  it('shares with friends as a copy only', () => {
    render(<CheatMealActions meal={cheatMeal()} />);

    // Slider positions are not a dish that halves, so the dialog must not
    // offer the split tab at all.
    expect(screen.getByTestId('share-dialog')).toHaveAttribute(
      'data-copyonly',
      'true'
    );
  });

  it('hides the friend share when the slider data is gone', () => {
    // Reopening those sliders is the whole mechanism — the server refuses
    // without them, so do not offer an action that can only fail.
    render(<CheatMealActions meal={cheatMeal({ cheatSliders: null })} />);

    expect(screen.queryByTestId('share-dialog')).not.toBeInTheDocument();
  });

  it('marks the share behind the paywall instead of opening a doomed picker', () => {
    mockLocked.mockImplementation(
      (feature: string) => feature === 'copy_split'
    );
    render(<CheatMealActions meal={cheatMeal()} />);

    expect(screen.getByTestId('premium-dot')).toBeInTheDocument();
    // No dialog mounted at all: a picker whose only outcome is a 402 is worse
    // than no picker.
    expect(screen.queryByTestId('share-dialog')).not.toBeInTheDocument();
  });
});
