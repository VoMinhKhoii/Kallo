import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { SharedMealEntry } from '@/lib/domain/social/feed/meal-feed';

// The real useShareThread, so the seeding this suite is about is the hook's
// own. Only the network and the leaf components are stood in for.
const { fetchShareThread } = vi.hoisted(() => ({
  fetchShareThread: vi.fn(async () => null),
}));
vi.mock('@/lib/domain/social/circle-client', () => ({ fetchShareThread }));
vi.mock('@/components/groups/feed-entry', () => ({
  FeedEntry: ({ entry }: { entry: SharedMealEntry }) => (
    <div data-testid="feed-entry">{entry.meal.rawInput}</div>
  ),
}));
vi.mock('@/components/groups/share-thread/share-replies', () => ({
  ShareReplies: () => null,
}));
vi.mock('@/components/groups/share-thread/reply-composer', () => ({
  ReplyComposer: () => null,
}));

import {
  SHARE_ID,
  sharedMealEntryFixture,
} from '@/components/groups/__tests__/fixtures';
import { ShareThread } from '@/components/groups/share-thread/share-thread';
import { friendsThreadFeedKeys } from '@/lib/domain/social/query-keys';

function renderSeeded(seed?: (client: QueryClient) => void) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  seed?.(client);
  return render(
    <QueryClientProvider client={client}>
      <ShareThread shareId={SHARE_ID} />
    </QueryClientProvider>
  );
}

describe('ShareThread on a warm feed cache', () => {
  it('opens on the post the feed already holds, with no skeleton', () => {
    // Reaching this page means a feed row was tapped, so the post is on screen
    // when the navigation starts. Refetching it behind a skeleton would blank
    // out a meal the reader is looking at.
    renderSeeded((client) =>
      client.setQueryData(friendsThreadFeedKeys.all, {
        pages: [{ entries: [sharedMealEntryFixture()], nextCursor: null }],
        pageParams: [undefined],
      })
    );

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getByTestId('feed-entry')).toHaveTextContent('bún chả');
  });

  it('still draws the skeleton when no feed holds the post', () => {
    // Opened cold — from a notification or a pasted link — there is nothing to
    // show yet, and the skeleton is the honest answer.
    renderSeeded();

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByTestId('feed-entry')).not.toBeInTheDocument();
  });
});
