import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';
import {
  findEntryInFeeds,
  isFeedQuery,
  mapFeedEntries,
} from '@/lib/domain/social/feed/feed-cache';
import {
  chatGroupsKeys,
  circleFeedKeys,
  friendsThreadFeedKeys,
  shareThreadKeys,
} from '@/lib/domain/social/query-keys';

const entry = (shareId: string, count: number) => ({
  meal: { shareId },
  reactions: { count, mine: false },
});

/** The transform the mutation hooks supply: bump one entry's reaction count. */
const bump = (value: unknown) => {
  const record = value as { reactions: { count: number; mine: boolean } };
  return {
    ...record,
    reactions: { ...record.reactions, count: record.reactions.count + 1 },
  };
};

describe('isFeedQuery', () => {
  it('admits every shape a share entry is cached in', () => {
    expect(isFeedQuery(circleFeedKeys.all)).toBe(true);
    expect(isFeedQuery(friendsThreadFeedKeys.all)).toBe(true);
    expect(isFeedQuery(chatGroupsKeys.feed('g1'))).toBe(true);
    // A share's own page: without this, a reaction made on /circle/<id> would
    // update the feeds behind it and leave the page you are looking at stale.
    expect(isFeedQuery(shareThreadKeys.detail('s1'))).toBe(true);
    expect(isFeedQuery(shareThreadKeys.all)).toBe(true);
  });

  it('leaves unrelated caches alone', () => {
    expect(isFeedQuery(['my-profile'])).toBe(false);
    expect(isFeedQuery(chatGroupsKeys.detail('g1'))).toBe(false);
  });
});

describe('mapFeedEntries', () => {
  it('maps a flat entry array', () => {
    const mapped = mapFeedEntries([entry('s1', 1)], bump) as Array<
      ReturnType<typeof entry>
    >;

    expect(mapped[0]?.reactions.count).toBe(2);
  });

  it('maps every page of an infinite-query bag', () => {
    const bag = { pages: [{ entries: [entry('s1', 1)] }], pageParams: [] };

    const mapped = mapFeedEntries(bag, bump) as {
      pages: Array<{ entries: Array<ReturnType<typeof entry>> }>;
    };

    expect(mapped.pages[0]?.entries[0]?.reactions.count).toBe(2);
  });

  it('maps the single entry a share page holds', () => {
    const page = { entry: entry('s1', 1) };

    const mapped = mapFeedEntries(page, bump) as {
      entry: ReturnType<typeof entry>;
    };

    expect(mapped.entry.reactions.count).toBe(2);
    expect(mapped.entry.meal.shareId).toBe('s1');
    // A new object, so React Query sees the change and the page re-renders.
    expect(mapped).not.toBe(page);
  });

  it('passes a gone share (null data) straight through', () => {
    expect(mapFeedEntries(null, bump)).toBeNull();
    expect(mapFeedEntries(undefined, bump)).toBeUndefined();
  });
});

describe('findEntryInFeeds', () => {
  const seed = (queryKey: readonly unknown[], data: unknown) => {
    const client = new QueryClient();
    client.setQueryData(queryKey, data);
    return client;
  };

  it('finds the post in a flat circle feed', () => {
    const client = seed(
      [...circleFeedKeys.all, -420],
      [entry('s0', 0), entry('s1', 1)]
    );

    expect(findEntryInFeeds(client, 's1')?.entry).toMatchObject({
      meal: { shareId: 's1' },
    });
  });

  it('finds the post inside an infinite-query page bag', () => {
    const client = seed(friendsThreadFeedKeys.all, {
      pages: [{ entries: [entry('s0', 0)] }, { entries: [entry('s1', 1)] }],
      pageParams: [undefined, 'c1'],
    });

    expect(findEntryInFeeds(client, 's1')?.entry).toMatchObject({
      meal: { shareId: 's1' },
    });
  });

  it('finds the post in another share page envelope', () => {
    const client = seed(shareThreadKeys.detail('s1'), {
      entry: entry('s1', 1),
    });

    expect(findEntryInFeeds(client, 's1')?.entry).toMatchObject({
      meal: { shareId: 's1' },
    });
  });

  it('carries the source feed freshness, not now', () => {
    // The seed must be judged as old as the feed it came from, or a thread
    // opened off a stale feed would look fresh and never refetch.
    const client = seed(friendsThreadFeedKeys.all, {
      pages: [{ entries: [entry('s1', 1)] }],
      pageParams: [undefined],
    });
    const feed = client
      .getQueryCache()
      .find({ queryKey: friendsThreadFeedKeys.all });

    expect(findEntryInFeeds(client, 's1')?.dataUpdatedAt).toBe(
      feed?.state.dataUpdatedAt
    );
  });

  it('answers undefined for a post no feed holds', () => {
    const client = seed([...circleFeedKeys.all, -420], [entry('s0', 0)]);

    expect(findEntryInFeeds(client, 's1')).toBeUndefined();
    expect(findEntryInFeeds(new QueryClient(), 's1')).toBeUndefined();
  });

  it('ignores caches that are not feeds', () => {
    // A profile or group-detail cache can hold anything; the finder must not
    // go fishing for a `meal.shareId` outside the feed net.
    const client = seed(chatGroupsKeys.detail('g1'), {
      entry: entry('s1', 1),
    });

    expect(findEntryInFeeds(client, 's1')).toBeUndefined();
  });
});
