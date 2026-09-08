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

  it('localises the kcal figure the way the grams beside it are', () => {
    // The legend is one row of figures; a raw `1234` next to a formatted
    // `1.234 g` would be two number systems in one line.
    render(
      <FeedEntry
        entry={entryFixture({
          meal: { ...entryFixture().meal, caloriesKcal: 1234 },
        })}
      />
    );

    expect(screen.getByText('1,234 kcal')).toBeInTheDocument();
    expect(screen.queryByText('1234 kcal')).not.toBeInTheDocument();
  });

  it('sends the reply glyph to the post, carrying its count', () => {
    render(<FeedEntry entry={entryFixture()} />);

    // The count is IN the label: a screen reader hears "Reply 3", not a bare
    // "Reply" with the figure stranded in a sighted-only span.
    const link = screen.getByRole('link', { name: 'reply 3' });
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

    // Nothing to count — the label says just "Reply", and no 0 is drawn.
    expect(screen.getByRole('link', { name: 'reply' })).not.toHaveTextContent(
      /\d/
    );
  });

  it('carries the reaction count in the heart label', () => {
    render(<FeedEntry entry={entryFixture()} />);

    const heart = screen.getByRole('button', { name: 'heart 2' });
    expect(heart).toHaveTextContent('2');
  });

  it('hides the heart count on an unreacted post, like the reply glyph', () => {
    render(
      <FeedEntry
        entry={entryFixture({ reactions: { count: 0, mine: false } })}
      />
    );

    const heart = screen.getByRole('button', { name: 'heart' });
    expect(heart).not.toHaveTextContent(/\d/);
  });
});
