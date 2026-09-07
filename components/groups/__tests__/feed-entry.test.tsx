import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { CircleFeedEntry } from '@/lib/actions/groups/types';

vi.mock('@/components/shared/profile-avatar', () => ({
  ProfileAvatar: () => null,
}));
vi.mock('@/hooks/social/sharing/use-toggle-reaction', () => ({
  useToggleReaction: () => ({ isPending: false, mutate: vi.fn() }),
}));
vi.mock('@/hooks/social/sharing/use-log-shared-meal', () => ({
  useLogSharedMeal: () => ({ isPending: false, mutate: vi.fn() }),
}));
vi.mock('@/components/billing/premium-guard-provider', () => ({
  usePremiumGuard: () => ({ requirePremium: () => true, locked: () => false }),
}));
// The bar animates its segments in; the layout assertions below are about
// where the bar sits, not how it arrives.
vi.mock('motion/react', () => ({
  motion: {
    span: ({
      children,
      ...props
    }: React.PropsWithChildren<Record<string, unknown>>) => (
      <span {...props}>{children}</span>
    ),
  },
}));

import { FeedEntry } from '@/components/groups/feed-entry';

const FRIEND = {
  userId: 'user-2',
  handle: 'mai',
  displayName: 'Mai',
  avatarSeed: null,
  avatarUrl: null,
  hasCustomAvatar: false,
};

function entryFixture(overrides: Partial<CircleFeedEntry> = {}) {
  return {
    friend: FRIEND,
    isSelf: false,
    meal: {
      mealId: 'meal-1',
      shareId: 'share-1',
      rawInput: 'bún bò huế',
      caloriesKcal: 420,
      proteinG: 38,
      carbohydrateG: 64,
      fatG: 12,
      portionFactor: 1,
      sharedAt: new Date().toISOString(),
      isBackfilled: false,
    },
    reactions: { count: 2, mine: false },
    replies: [
      {
        id: 'reply-1',
        author: FRIEND,
        isSelf: false,
        body: 'That looks unreasonably good',
        createdAt: new Date().toISOString(),
      },
    ],
    repliesTotal: 3,
    ...overrides,
  } satisfies CircleFeedEntry;
}

describe('FeedEntry', () => {
  it('reads the kcal figure as the legend row leads it — under the bar', () => {
    const { container } = render(<FeedEntry entry={entryFixture()} />);

    const kcal = screen.getByText('420 kcal');
    const protein = screen.getByText(/P:\s*38g/);
    // One row, kcal first: mobile's spaceBetween legend over four items.
    expect(kcal.parentElement).toBe(protein.parentElement);

    const bar = container.querySelector('div[aria-hidden="true"]');
    if (!bar) throw new Error('the composition bar should be drawn');
    expect(
      bar.compareDocumentPosition(kcal) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it('says the kcal is unmeasured without dropping the unit', () => {
    render(
      <FeedEntry
        entry={entryFixture({
          meal: { ...entryFixture().meal, caloriesKcal: null },
        })}
      />
    );

    expect(screen.getByText('— kcal')).toBeInTheDocument();
  });

  it('keeps the thread off the card — the post is the post', () => {
    render(<FeedEntry entry={entryFixture()} />);

    expect(
      screen.queryByText('That looks unreasonably good')
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('sends the reply glyph to the post, carrying its count', () => {
    render(<FeedEntry entry={entryFixture()} />);

    const link = screen.getByRole('link', { name: 'reply' });
    expect(link).toHaveAttribute(
      'href',
      expect.stringContaining('/circle/share-1')
    );
    expect(link).toHaveTextContent('3');
  });

  it('leaves the reply count off an unanswered post', () => {
    render(
      <FeedEntry entry={entryFixture({ replies: [], repliesTotal: 0 })} />
    );

    expect(screen.getByRole('link', { name: 'reply' })).not.toHaveTextContent(
      /\d/
    );
  });
});
