import {
  cleanup,
  render,
  screen,
  waitForElementToBeRemoved,
} from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { MealShareInvite } from '@/lib/actions/meal-sharing/types';

// The deck's whole job is that N offers occupy the height of ONE. What has to
// hold no matter how many arrive: exactly one card is interactive, the layers
// behind it are invisible to assistive tech, and the stack of layers stops at
// two so a busy inbox does not grow a fringe.

vi.mock('@/hooks/social/sharing/use-meal-share-invites', () => ({
  useAcceptMealShareInvite: () => ({ isPending: false, mutate: vi.fn() }),
  useStageCheatMealShareInvite: () => ({ isPending: false, mutate: vi.fn() }),
  useDismissMealShareInvite: () => ({ isPending: false, mutate: vi.fn() }),
}));
vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock('@/components/shared/profile-avatar', () => ({
  ProfileAvatar: () => null,
}));
vi.mock('@/components/billing/premium-guard-provider', () => ({
  usePremiumGuard: () => ({ locked: () => false, requirePremium: () => true }),
}));
vi.mock('@/components/billing/premium-chip', () => ({
  PremiumChip: () => null,
}));

import { InviteDeck } from '@/components/groups/meal-invites/invite-deck';

function inviteFixture(id: string, rawInput: string): MealShareInvite {
  return {
    id,
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
      rawInput,
      caloriesKcal: 600,
      proteinG: 30,
      carbohydrateG: 70,
      fatG: 20,
      entryMode: 'precise',
    },
  };
}

const deck = (n: number) =>
  Array.from({ length: n }, (_, i) =>
    inviteFixture(`invite-${i}`, `Meal ${i}`)
  );

describe('InviteDeck', () => {
  it('draws no layers for a single offer', () => {
    render(<InviteDeck invites={deck(1)} />);

    // A lone card with a shadow behind it would promise a second offer that
    // acting on this one does not produce.
    expect(screen.queryAllByTestId('invite-deck-layer')).toHaveLength(0);
    expect(screen.getByText('Meal 0')).toBeInTheDocument();
  });

  it('shows only the front offer, whatever is behind it', () => {
    render(<InviteDeck invites={deck(4)} />);

    expect(screen.getByText('Meal 0')).toBeInTheDocument();
    expect(screen.queryByText('Meal 1')).not.toBeInTheDocument();
    expect(screen.queryByText('Meal 3')).not.toBeInTheDocument();
  });

  it('keeps every control on the front card and none behind it', () => {
    render(<InviteDeck invites={deck(4)} />);

    // Counted against a ONE-offer deck rather than against a literal, so this
    // keeps meaning what it says the day InviteCard gains or loses a button:
    // what must hold is that three extra offers add no extra controls.
    const four = screen.getAllByRole('button').length;
    cleanup();
    render(<InviteDeck invites={deck(1)} />);
    expect(four).toBe(screen.getAllByRole('button').length);
  });

  it('reveals the next offer when the front one is acted on', async () => {
    // The feature's own name. The deck does not mutate anything itself — the
    // caller's query cache drops the resolved offer and re-renders — so the
    // behaviour under test is that a shorter list fronts the NEXT invite and
    // sheds one layer with it.
    const { rerender } = render(<InviteDeck invites={deck(3)} />);
    expect(screen.getByText('Meal 0')).toBeInTheDocument();
    expect(screen.getAllByTestId('invite-deck-layer')).toHaveLength(2);

    rerender(<InviteDeck invites={deck(3).slice(1)} />);

    expect(screen.getByText('Meal 1')).toBeInTheDocument();
    expect(screen.getAllByTestId('invite-deck-layer')).toHaveLength(1);
    // The resolved offer is still mounted for the length of its exit — that is
    // AnimatePresence doing its job — but it must actually leave. A card that
    // never unmounts would keep a second set of accept/dismiss buttons in the
    // tree pointing at an invite the server has already resolved.
    await waitForElementToBeRemoved(() => screen.queryByText('Meal 0'));
  });

  it('caps the peek at two layers', () => {
    // Ten pending offers must look the same as three. Past two the layers stop
    // reading as depth and start reading as a fringe on the card.
    render(<InviteDeck invites={deck(10)} />);

    expect(screen.getAllByTestId('invite-deck-layer')).toHaveLength(2);
  });

  it('grows the peek one layer at a time up to the cap', () => {
    const { rerender } = render(<InviteDeck invites={deck(2)} />);
    expect(screen.getAllByTestId('invite-deck-layer')).toHaveLength(1);

    rerender(<InviteDeck invites={deck(3)} />);
    expect(screen.getAllByTestId('invite-deck-layer')).toHaveLength(2);
  });

  it('hides the layers from assistive tech', () => {
    render(<InviteDeck invites={deck(3)} />);

    for (const layer of screen.getAllByTestId('invite-deck-layer')) {
      expect(layer).toHaveAttribute('aria-hidden', 'true');
      expect(layer).toBeEmptyDOMElement();
    }
  });

  it('renders nothing for an empty inbox', () => {
    const { container } = render(<InviteDeck invites={[]} />);

    expect(container).toBeEmptyDOMElement();
  });
});
