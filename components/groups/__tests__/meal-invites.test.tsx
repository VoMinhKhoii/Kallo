import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MealShareInvite } from '@/lib/actions/meal-sharing/types';

// The inbox is where the two kinds of offer part ways: a precise invite is
// accepted outright, a cheat one reopens the sender's sliders somewhere else
// entirely. Getting that branch wrong is not a cosmetic bug — accepting a
// cheat invite hits a server refusal, and the offer is spent either way.

const { mockAccept, mockStageCheat, mockDismiss, mockPush } = vi.hoisted(
  () => ({
    mockAccept: vi.fn(),
    mockStageCheat: vi.fn(),
    mockDismiss: vi.fn(),
    mockPush: vi.fn(),
  })
);

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

import { MealInvites } from '@/components/groups/meal-invites';

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
    invites.current = [];
  });

  it('accepts a precise invite in place', async () => {
    invites.current = [inviteFixture()];
    render(<MealInvites />);

    await userEvent.click(screen.getByRole('button', { name: /accept/ }));

    expect(mockAccept).toHaveBeenCalledWith(
      'e4ccff33-d04f-4cc2-af01-affdf0724e55',
      expect.anything()
    );
    expect(mockStageCheat).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('sends a cheat invite to the slider card instead of accepting it', async () => {
    invites.current = [inviteFixture({ entryMode: 'cheat' })];
    render(<MealInvites />);

    // The label changes too: "Add to my diary" would be a lie — nothing is
    // added until I have set my own amounts.
    await userEvent.click(screen.getByRole('button', { name: 'acceptCheat' }));

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
        loggedAt: '2026-04-05T00:30:00.000Z',
      });
    });
    render(<MealInvites />);

    await userEvent.click(screen.getByRole('button', { name: 'acceptCheat' }));

    expect(mockPush).toHaveBeenCalledTimes(1);
    const target = mockPush.mock.lastCall?.[0] as string;
    expect(target).toMatch(/^\/logging\?date=\d{4}-\d{2}-\d{2}$/);
  });

  it('renders nothing when there are no offers', () => {
    const { container } = render(<MealInvites />);
    expect(container).toBeEmptyDOMElement();
  });
});
