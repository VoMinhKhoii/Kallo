import { describe, expect, it } from 'vitest';
import {
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
