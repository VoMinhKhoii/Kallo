import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SharedMealEntry } from '@/lib/domain/social/feed/meal-feed';

const { useShareThread } = vi.hoisted(() => ({ useShareThread: vi.fn() }));

vi.mock('@/hooks/social/circle/use-share-thread', () => ({ useShareThread }));
// The post and the thread are covered by their own suites; here they stand in
// so this one is about the page's three states and its way back.
vi.mock('@/components/groups/feed-entry', () => ({
  FeedEntry: ({ entry }: { entry: SharedMealEntry }) => (
    <div data-testid="feed-entry">{entry.meal.rawInput}</div>
  ),
}));
vi.mock('@/components/groups/thread/share-replies', () => ({
  ShareReplies: ({ authorName }: { authorName?: string }) => (
    <div data-testid="share-replies">{authorName ?? 'no-author-name'}</div>
  ),
}));

import { ShareThread } from '@/components/groups/thread/share-thread';

const SHARE_ID = '3f1d2c4b-5a6e-4f70-8b91-0c2d3e4f5a6b';

function entry(): SharedMealEntry {
  return {
    friend: {
      userId: 'u2',
      handle: 'phofan',
      displayName: 'Phở Fan',
      avatarSeed: null,
      avatarUrl: null,
      hasCustomAvatar: false,
    },
    isSelf: false,
    meal: {
      mealId: 'm1',
      shareId: SHARE_ID,
      rawInput: 'bún chả',
      caloriesKcal: 640,
      proteinG: 30,
      carbohydrateG: 70,
      fatG: 20,
      portionFactor: 1,
      sharedAt: '2026-05-03T08:00:00.000Z',
      isBackfilled: false,
    },
    reactions: { count: 0, mine: false },
    replies: [],
    repliesTotal: 0,
  };
}

function state(overrides: Record<string, unknown>) {
  useShareThread.mockReturnValue({
    data: undefined,
    isPending: false,
    isError: false,
    isFetching: false,
    refetch: vi.fn(),
    ...overrides,
  });
}

describe('ShareThread', () => {
  beforeEach(() => useShareThread.mockReset());

  it('shows the feed skeleton while the post loads', () => {
    state({ isPending: true });

    render(<ShareThread shareId={SHARE_ID} />);

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByTestId('feed-entry')).not.toBeInTheDocument();
  });

  it('offers a retry when the read fails', () => {
    state({ isError: true });

    render(<ShareThread shareId={SHARE_ID} />);

    // CircleError, not the gone state: a failed fetch must never read as
    // "this post is deleted".
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.queryByText('gone')).not.toBeInTheDocument();
  });

  it('renders the post and its thread, addressed to the author', () => {
    state({ data: { entry: entry() } });

    render(<ShareThread shareId={SHARE_ID} />);

    expect(screen.getByTestId('feed-entry')).toHaveTextContent('bún chả');
    expect(screen.getByTestId('share-replies')).toHaveTextContent('Phở Fan');
  });

  it('names nobody on your own post — the composer must not address you', () => {
    state({ data: { entry: { ...entry(), isSelf: true } } });

    render(<ShareThread shareId={SHARE_ID} />);

    expect(screen.getByTestId('share-replies')).toHaveTextContent(
      'no-author-name'
    );
  });

  it('states plainly that a share which is gone is gone', () => {
    // `null` data, not an error: deleted and never-yours-to-see are the same
    // answer, and both are a destination rather than a failure.
    state({ data: null });

    render(<ShareThread shareId={SHARE_ID} />);

    expect(screen.getByText('gone')).toBeInTheDocument();
    expect(screen.getByText('goneBody')).toBeInTheDocument();
    expect(screen.queryByTestId('feed-entry')).not.toBeInTheDocument();
  });

  it('always keeps a labelled way back to the Circle', () => {
    state({ data: null });

    render(<ShareThread shareId={SHARE_ID} />);

    const back = screen.getByRole('link', { name: 'back' });
    expect(back).toHaveAttribute('href', '/circle');
  });
});
