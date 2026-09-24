import { render, screen, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FeatureKey } from '@/lib/domain/billing/entitlement/features';

const mocks = vi.hoisted(() => ({
  locked: vi.fn<(feature: FeatureKey) => boolean>(),
  requirePremium: vi.fn<(feature: FeatureKey) => boolean>(),
}));

vi.mock('@/components/billing/premium-guard-provider', () => ({
  usePremiumGuard: () => ({
    locked: mocks.locked,
    requirePremium: mocks.requirePremium,
    openPaywall: vi.fn(),
  }),
}));

// Radix menus need pointer plumbing jsdom lacks; this suite is about which
// rows are marked and what a pick does, so the menu renders flat.
vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuLabel: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuSeparator: () => <hr />,
  DropdownMenuItem: ({
    children,
    onSelect,
  }: {
    children: React.ReactNode;
    onSelect?: (event: Event) => void;
  }) => (
    <button
      type="button"
      role="menuitem"
      onClick={() => onSelect?.(new Event('select'))}
    >
      {children}
    </button>
  ),
}));

import { CheatModePicker } from '../cheat-mode-picker';

function renderPicker(onChangeMode = vi.fn()) {
  render(
    <CheatModePicker
      mode="manual"
      intensity="medium"
      onChangeMode={onChangeMode}
      onChangeIntensity={vi.fn()}
    />
  );
  return onChangeMode;
}

const row = (name: string) =>
  screen
    .getAllByRole('menuitem')
    .find((item) => item.textContent?.startsWith(name)) as HTMLElement;

describe('CheatModePicker — Premium markers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePremium.mockImplementation((f) => !mocks.locked(f));
  });

  it('marks nothing for a user who has every feature', () => {
    mocks.locked.mockReturnValue(false);
    renderPicker();

    expect(screen.queryByText('premium.chip')).toBeNull();
  });

  it('chips Instant and Cheat meal, never Manual, when both are locked', () => {
    mocks.locked.mockImplementation(
      (f) => f === 'ai_analysis' || f === 'cheat_meal'
    );
    renderPicker();

    expect(within(row('mode.normal')).getByText('premium.chip')).toBeTruthy();
    expect(within(row('mode.cheat')).getByText('premium.chip')).toBeTruthy();
    expect(within(row('mode.manual')).queryByText('premium.chip')).toBeNull();
  });

  it('sends a locked Instant pick to pricing instead of switching mode', async () => {
    const user = userEvent.setup();
    mocks.locked.mockImplementation((f) => f === 'ai_analysis');
    const onChangeMode = renderPicker();

    await user.click(row('mode.normal'));

    expect(mocks.requirePremium).toHaveBeenCalledWith('ai_analysis');
    expect(onChangeMode).not.toHaveBeenCalled();
  });

  it('switches to an unlocked mode without touching the paywall', async () => {
    const user = userEvent.setup();
    mocks.locked.mockReturnValue(false);
    const onChangeMode = renderPicker();

    await user.click(row('mode.normal'));
    await user.click(row('mode.manual'));

    expect(onChangeMode.mock.calls).toEqual([['normal'], ['manual']]);
  });
});
