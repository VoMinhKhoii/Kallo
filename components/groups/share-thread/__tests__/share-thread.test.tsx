import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SharedMealEntry } from '@/lib/domain/social/feed/meal-feed';

const { useShareThread } = vi.hoisted(() => ({ useShareThread: vi.fn() }));

vi.mock('@/hooks/social/circle/use-share-thread', () => ({ useShareThread }));
// The post, the thread and the composer are covered by their own suites; here
// they stand in so this one is about the page's three states, its way back,
// and who the composer is addressed to.
vi.mock('@/components/groups/feed-entry', () => ({
  FeedEntry: ({ entry }: { entry: SharedMealEntry }) => (
    <div data-testid="feed-entry">{entry.meal.rawInput}</div>
  ),
}));
vi.mock('@/components/groups/share-thread/share-replies', () => ({
  ShareReplies: ({ replies }: { replies: SharedMealEntry['replies'] }) => (
    <div data-testid="share-replies">{replies.length}</div>
  ),
}));
vi.mock('@/components/groups/share-thread/reply-composer', () => ({
  ReplyComposer: ({ authorName }: { authorName?: string }) => (
    <div data-testid="reply-composer">{authorName ?? 'no-author-name'}</div>
  ),
}));

import {
  SHARE_ID,
  sharedMealEntryFixture,
  shareReplyFixture,
} from '@/components/groups/__tests__/fixtures';
import { ShareThread } from '@/components/groups/share-thread/share-thread';

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
    state({
      data: {
        entry: sharedMealEntryFixture({ replies: [shareReplyFixture()] }),
      },
    });

    render(<ShareThread shareId={SHARE_ID} />);

    expect(screen.getByTestId('feed-entry')).toHaveTextContent('bún chả');
    expect(screen.getByTestId('share-replies')).toHaveTextContent('1');
    expect(screen.getByTestId('reply-composer')).toHaveTextContent('Phở Fan');
  });

  it('keeps the thread and the composer in one spaced column', () => {
    // The list and the field are siblings, so the gap between them and the
    // post above belongs to their container — not to either component.
    state({ data: { entry: sharedMealEntryFixture() } });

    const { container } = render(<ShareThread shareId={SHARE_ID} />);

    const column = container.querySelector('.mt-3.space-y-3');
    expect(column).not.toBeNull();
    expect(column).toContainElement(screen.getByTestId('share-replies'));
    expect(column).toContainElement(screen.getByTestId('reply-composer'));
  });

  it('names nobody on your own post — the composer must not address you', () => {
    state({ data: { entry: sharedMealEntryFixture({ isSelf: true }) } });

    render(<ShareThread shareId={SHARE_ID} />);

    expect(screen.getByTestId('reply-composer')).toHaveTextContent(
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
