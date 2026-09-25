import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FeatureKey } from '@/lib/domain/billing/entitlement/features';

const mocks = vi.hoisted(() => ({
  locked: vi.fn(),
  requirePremium: vi.fn(),
}));

vi.mock('@/components/billing/premium-guard-provider', () => ({
  usePremiumGuard: () => ({
    locked: mocks.locked,
    requirePremium: mocks.requirePremium,
    openPaywall: vi.fn(),
  }),
}));

// The real dialog fans out a friends query; this suite only needs to know
// whether the bar mounted it at all.
vi.mock('@/components/groups/share-meal-dialog', () => ({
  ShareMealDialog: ({ trigger }: { trigger: React.ReactNode }) => (
    <div data-testid="share-dialog">{trigger}</div>
  ),
}));

vi.mock('@/components/logging/feed/persisted/share-buttons', () => ({
  ShareToCircleButton: () => <div data-testid="share-to-circle" />,
}));

import { MealCardActionBar } from '../meal-card-action-bar';

function renderBar(onLogAgain?: () => void) {
  return render(
    <MealCardActionBar
      onLogAgain={onLogAgain}
      canEdit
      canShare
      isRefineOpen={false}
      mealId="meal-1"
      mealName="Bánh mì thịt nướng"
      onEditAmounts={vi.fn()}
      share={null}
      totalKcal={1040}
    />
  );
}

describe('MealCardActionBar — copy/split entry point', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePremium.mockReturnValue(false);
  });

  it('opens the share dialog with no Premium dot when copy_split is unlocked', () => {
    mocks.locked.mockReturnValue(false);
    const { container } = renderBar();

    expect(screen.getByTestId('share-dialog')).toBeInTheDocument();
    expect(container.querySelector('[data-premium-dot]')).toBeNull();
  });

  it('dots the share button and routes the click to the paywall when locked', async () => {
    const user = userEvent.setup();
    mocks.locked.mockImplementation((feature: FeatureKey) => {
      return feature === 'copy_split';
    });
    renderBar();

    // The icon-only row wears a dot, not a chip: it marks the affordance
    // BEFORE the click, and the dialog is not mounted at all — a locked click
    // must not open a picker that can only end in a 402.
    const share = screen.getByRole('button', { name: 'shareWithFriends' });
    expect(share.querySelector('[data-premium-dot]')).not.toBeNull();
    expect(screen.queryByText('premium.chip')).toBeNull();
    expect(screen.queryByTestId('share-dialog')).toBeNull();

    await user.click(screen.getByRole('button', { name: 'shareWithFriends' }));
    expect(mocks.requirePremium).toHaveBeenCalledWith('copy_split');
  });

  it('dots "log again" only while relog is locked', () => {
    mocks.locked.mockImplementation((feature: FeatureKey) => {
      return feature === 'relog';
    });
    const { unmount } = renderBar(vi.fn());
    const logAgain = screen.getByRole('button', { name: 'logAgain' });
    expect(logAgain.querySelector('[data-premium-dot]')).not.toBeNull();
    unmount();

    mocks.locked.mockReturnValue(false);
    renderBar(vi.fn());
    expect(
      screen
        .getByRole('button', { name: 'logAgain' })
        .querySelector('[data-premium-dot]')
    ).toBeNull();
  });
});
