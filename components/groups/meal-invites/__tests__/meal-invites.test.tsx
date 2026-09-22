import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MealShareInvite } from '@/lib/actions/meal-sharing/types';
import { toLocalDayKey } from '@/lib/core/date/day-key';

/** A source meal eaten well before "now", so landing on today is detectable. */
const SOURCE_INSTANT = '2026-04-05T00:30:00.000Z';

/** The local day SOURCE_INSTANT falls on, in whatever zone the suite runs in. */
const expectedDay = () =>
  toLocalDayKey(Date.parse(SOURCE_INSTANT), new Date().getTimezoneOffset());

// The inbox is where the two kinds of offer part ways: a precise invite is
// accepted outright, a cheat one reopens the sender's sliders somewhere else
// entirely. Getting that branch wrong is not a cosmetic bug — accepting a
// cheat invite hits a server refusal, and the offer is spent either way.

const { mockAccept, mockStageCheat, mockDismiss, mockPush, mockLocked } =
  vi.hoisted(() => ({
    mockAccept: vi.fn(),
    mockStageCheat: vi.fn(),
    mockDismiss: vi.fn(),
    mockPush: vi.fn(),
    mockLocked: vi.fn((_feature: string) => false),
  }));

const invites: { current: MealShareInvite[] } = { current: [] };

vi.mock('@/hooks/social/sharing/use-meal-share-invites', () => ({
  useMealShareInvites: () => ({
    data: invites.current,
    isError: false,
    isFetching: false,
    refetch: vi.fn(),
  }),
  useAcceptMealShareInvite: () => ({ isPending: false, mutate: mockAccept }),
  useStageCheatMealShareInvite: () => ({
    isPending: false,
    mutate: mockStageCheat,
  }),
  useDismissMealShareInvite: () => ({ isPending: false, mutate: mockDismiss }),
}));

vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock('@/components/shared/profile-avatar', () => ({
  ProfileAvatar: () => null,
}));

vi.mock('@/components/billing/premium-guard-provider', () => ({
  usePremiumGuard: () => ({
    locked: mockLocked,
    // Mirrors the real guard: false means it opened the paywall and the
    // caller must NOT proceed.
    requirePremium: (feature: string) => !mockLocked(feature),
  }),
}));
vi.mock('@/components/billing/premium-chip', () => ({
  PremiumChip: () => <span data-testid="premium-chip" />,
}));

import { MealInvites } from '@/components/groups/meal-invites/meal-invites';

function inviteFixture(
  overrides: Partial<MealShareInvite['meal']> = {}
): MealShareInvite {
  return {
    id: 'e4ccff33-d04f-4cc2-af01-affdf0724e55',
    mode: 'copy',
    portionFactor: 1,
    createdAt: '2026-04-05T00:30:00.000Z',
    from: {
      userId: 'b1ffcd00-ad1c-4ff9-8c7e-7ccace491b22',
      handle: 'mai',
      displayName: 'Mai',
      avatarSeed: 'mai',
      avatarUrl: null,
    },
    meal: {
      rawInput: 'Bún chả',
      caloriesKcal: 600,
      proteinG: 30,
      carbohydrateG: 70,
      fatG: 20,
      entryMode: 'precise',
      ...overrides,
    },
  };
}

describe('MealInvites', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLocked.mockReturnValue(false);
    invites.current = [];
  });

  it('accepts a precise invite, then shows the day it landed on', async () => {
    // The copy is stamped at the SOURCE meal's instant, so "Added to your
    // diary" alone used to point at a day the user was not on and would never
    // think to open.
    invites.current = [inviteFixture()];
    mockAccept.mockImplementation((_id, opts) => {
      opts.onSuccess({
        mealId: 'new-meal',
        meal: { loggedAt: SOURCE_INSTANT },
      });
    });
    render(<MealInvites />);

    await userEvent.click(screen.getByRole('button', { name: /accept/ }));
    await userEvent.click(screen.getByRole('button', { name: 'acceptAction' }));

    expect(mockAccept).toHaveBeenCalledWith(
      'e4ccff33-d04f-4cc2-af01-affdf0724e55',
      expect.anything()
    );
    expect(mockStageCheat).not.toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith(`/logging?date=${expectedDay()}`);
  });

  it('sends a free user to the paywall instead of a doomed request', async () => {
    // Taking a cheat offer is a gated cheat write. Without the pre-tap guard
    // the server 402s and the card says "that didn't work — try again", which
    // is advice for something that can never succeed.
    mockLocked.mockImplementation(
      (feature: string) => feature === 'cheat_meal'
    );
    invites.current = [inviteFixture({ entryMode: 'cheat' })];
    render(<MealInvites />);

    expect(screen.getByTestId('premium-chip')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'acceptCheat' }));

    expect(mockStageCheat).not.toHaveBeenCalled();
    // The paywall answers instead of the confirm — never both.
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('sends a cheat invite to the slider card instead of accepting it', async () => {
    invites.current = [inviteFixture({ entryMode: 'cheat' })];
    render(<MealInvites />);

    // The label changes too: "Add to my diary" would be a lie — nothing is
    // added until I have set my own amounts.
    await userEvent.click(screen.getByRole('button', { name: 'acceptCheat' }));
    await userEvent.click(
      screen.getByRole('button', { name: 'acceptCheatAction' })
    );

    expect(mockStageCheat).toHaveBeenCalledTimes(1);
    expect(mockAccept).not.toHaveBeenCalled();
  });

  it('routes to the day the meal was eaten, not to today', async () => {
    invites.current = [inviteFixture({ entryMode: 'cheat' })];
    // The staged card is stamped at the source meal's instant, so landing on
    // today would show the recipient an empty feed and a card they cannot find.
    mockStageCheat.mockImplementation((_id, opts) => {
      opts.onSuccess({
        analysisId: 'aa11bb22-cc33-4dd4-8ee5-ff6677889900',
        spec: { sliders: [], mealSlot: null, confidence: 'medium' },
        rawInput: 'Buffet nướng',
        loggedAt: SOURCE_INSTANT,
      });
    });
    render(<MealInvites />);

    await userEvent.click(screen.getByRole('button', { name: 'acceptCheat' }));
    await userEvent.click(
      screen.getByRole('button', { name: 'acceptCheatAction' })
    );

    // The EXACT day, computed independently of the component: a regression
    // that pushed today's date would satisfy a date-shaped pattern.
    expect(mockPush).toHaveBeenCalledWith(`/logging?date=${expectedDay()}`);
    expect(expectedDay()).not.toBe(
      toLocalDayKey(Date.now(), new Date().getTimezoneOffset())
    );
  });

  it('asks before acting, and backing out sends nothing', async () => {
    invites.current = [inviteFixture()];
    render(<MealInvites />);

    await userEvent.click(screen.getByRole('button', { name: /accept/ }));
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'cancel' }));

    await userEvent.click(screen.getByRole('button', { name: 'dismiss' }));
    expect(screen.getByText('dismissTitle')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'cancel' }));

    expect(mockAccept).not.toHaveBeenCalled();
    expect(mockDismiss).not.toHaveBeenCalled();
  });

  it('dismisses only once the confirm says so', async () => {
    invites.current = [inviteFixture()];
    render(<MealInvites />);

    await userEvent.click(screen.getByRole('button', { name: 'dismiss' }));
    await userEvent.click(
      screen.getByRole('button', { name: 'dismissAction' })
    );

    expect(mockDismiss).toHaveBeenCalledWith(
      'e4ccff33-d04f-4cc2-af01-affdf0724e55',
      expect.anything()
    );
    expect(mockAccept).not.toHaveBeenCalled();
  });

  it('renders nothing when there are no offers', () => {
    const { container } = render(<MealInvites />);
    expect(container).toBeEmptyDOMElement();
  });
});
