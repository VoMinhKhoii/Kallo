import { render, screen } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { NotificationItem } from '@/lib/domain/notifications/contracts';
import { ActivitySections, bucketNotifications } from '../activity-sections';

vi.mock('@/hooks/notifications/use-notification-state', () => ({
  useMarkNotificationRead: () => ({ mutate: vi.fn(), isPending: false }),
}));

// The invite row's mutations and query client are out of scope here.
vi.mock('../share-invite-row', () => ({
  ShareInviteRow: ({ item }: { item: NotificationItem }) => (
    <div data-testid={`invite-${item.id}`} />
  ),
}));

const DAY_MS = 24 * 60 * 60 * 1000;

// jsdom has no IntersectionObserver; the sentinel only needs to not explode.
beforeAll(() => {
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  );
});

function item(overrides: Partial<NotificationItem>): NotificationItem {
  return {
    id: 'n1',
    type: 'share.reaction',
    actors: [
      {
        userId: 'u1',
        handle: 'minh',
        displayName: 'Minh',
        avatarSeed: null,
        avatarUrl: null,
        hasCustomAvatar: false,
      },
    ],
    actorCount: 1,
    objectType: 'share',
    objectId: 's1',
    targetType: null,
    targetId: null,
    data: null,
    createdAt: new Date(Date.now() - DAY_MS).toISOString(),
    updatedAt: new Date(Date.now() - DAY_MS).toISOString(),
    seenAt: new Date().toISOString(),
    readAt: null,
    invite: null,
    ...overrides,
  };
}

describe('bucketNotifications', () => {
  it('splits seen rows on the thirty-day boundary', () => {
    const recent = item({ id: 'recent', createdAt: isoDaysAgo(3) });
    const older = item({ id: 'older', createdAt: isoDaysAgo(40) });

    const buckets = bucketNotifications([recent, older], new Set());

    expect(buckets.fresh).toEqual([]);
    expect(buckets.recent.map((row) => row.id)).toEqual(['recent']);
    expect(buckets.older.map((row) => row.id)).toEqual(['older']);
  });

  it('puts every snapshot-new row in New regardless of age', () => {
    const old = item({ id: 'old-unseen', createdAt: isoDaysAgo(120) });

    const buckets = bucketNotifications([old], new Set(['old-unseen']));

    expect(buckets.fresh.map((row) => row.id)).toEqual(['old-unseen']);
    expect(buckets.older).toEqual([]);
  });
});

describe('ActivitySections', () => {
  const feedProps = {
    hasNextPage: false,
    isFetchingNextPage: false,
    fetchNextPage: vi.fn(),
  };

  it('keeps a row in New after the server marks it seen mid-visit', () => {
    const unseen = item({ id: 'fresh', seenAt: null });

    const { rerender } = render(
      <ActivitySections items={[unseen]} {...feedProps} />
    );
    expect(screen.getByText('sections.new')).toBeInTheDocument();

    // What mark-seen does to the refetched payload: seenAt is now set. The
    // snapshot must survive it, or the section empties under the reader.
    rerender(
      <ActivitySections
        items={[{ ...unseen, seenAt: new Date().toISOString() }]}
        {...feedProps}
      />
    );

    expect(screen.getByText('sections.new')).toBeInTheDocument();
    expect(screen.queryByText('sections.recent')).not.toBeInTheDocument();
  });

  it('omits headings for empty buckets and routes invites to the invite row', () => {
    render(
      <ActivitySections
        items={[
          item({ id: 'invite', type: 'share.invite' }),
          item({ id: 'old', createdAt: isoDaysAgo(90) }),
        ]}
        {...feedProps}
      />
    );

    expect(screen.queryByText('sections.new')).not.toBeInTheDocument();
    expect(screen.getByText('sections.recent')).toBeInTheDocument();
    expect(screen.getByText('sections.older')).toBeInTheDocument();
    expect(screen.getByTestId('invite-invite')).toBeInTheDocument();
  });
});

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * DAY_MS).toISOString();
}
