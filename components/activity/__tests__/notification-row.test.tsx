import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NotificationItem } from '@/lib/domain/notifications/contracts';
import type { PublicIdentity } from '@/lib/domain/social/identity/public-identity';
import { messageValues, notificationHref } from '../notification-copy';
import { NotificationRow } from '../notification-row';

const { markReadMock } = vi.hoisted(() => ({ markReadMock: vi.fn() }));

vi.mock('@/hooks/notifications/use-notification-state', () => ({
  useMarkNotificationRead: () => ({ mutate: markReadMock, isPending: false }),
}));

function actor(name: string, id: string): PublicIdentity {
  return {
    userId: id,
    handle: name.toLowerCase(),
    displayName: name,
    avatarSeed: null,
    avatarUrl: null,
    hasCustomAvatar: false,
  };
}

function item(overrides: Partial<NotificationItem> = {}): NotificationItem {
  return {
    id: 'n1',
    type: 'share.reaction',
    actors: [actor('Minh', 'u1')],
    actorCount: 1,
    objectType: 'share',
    objectId: 's1',
    targetType: null,
    targetId: null,
    data: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    seenAt: null,
    readAt: null,
    invite: null,
    ...overrides,
  };
}

describe('NotificationRow', () => {
  beforeEach(() => markReadMock.mockReset());

  it.each([
    ['friend.joined', 'row.friend.joined.one'],
    ['group.added', 'row.group.added.one'],
    ['share.invite_accepted', 'row.share.invite_accepted.one'],
    ['share.reaction', 'row.share.reaction.one'],
    ['share.reply', 'row.share.reply.one'],
    ['share.logged', 'row.share.logged.one'],
  ] as const)('renders the %s template', (type, key) => {
    render(<NotificationRow item={item({ type })} isNew={false} />);

    // The global next-intl mock renders the key it was handed, so the key IS
    // the assertion: it proves template selection per type.
    expect(screen.getByText(key)).toBeInTheDocument();
  });

  it('switches to the aggregate template and counts the OTHER actors', () => {
    render(
      <NotificationRow
        item={item({
          actors: [actor('Minh', 'u1'), actor('Lan', 'u2')],
          actorCount: 4,
        })}
        isNew={false}
      />
    );

    expect(screen.getByText('row.share.reaction.other')).toBeInTheDocument();
  });

  it('interpolates the name and the count of the OTHER actors', () => {
    const values = messageValues(
      item({ actors: [actor('Minh', 'u1')], actorCount: 4 }),
      'Minh'
    );

    expect(values).toMatchObject({ name: 'Minh', count: 3 });
  });

  it('interpolates the group name for a group add', () => {
    const values = messageValues(
      item({ type: 'group.added', data: { groupName: 'Bún chả club' } }),
      'Minh'
    );

    expect(values.group).toBe('Bún chả club');
  });

  it('links each share notification to that share own page', () => {
    // The row names one post; landing on the feed would make the reader hunt
    // for it. objectId IS the share id the /circle/<shareId> page reads.
    const { rerender } = render(
      <NotificationRow item={item()} isNew={false} />
    );
    expect(screen.getByRole('link')).toHaveAttribute('href', '/circle/s1');

    for (const type of ['share.reply', 'share.logged'] as const) {
      rerender(<NotificationRow item={item({ type })} isNew={false} />);
      expect(screen.getByRole('link')).toHaveAttribute('href', '/circle/s1');
    }
  });

  it('falls back to the Circle when the row names no share', () => {
    const { rerender } = render(
      <NotificationRow
        item={item({ objectType: null, objectId: null })}
        isNew={false}
      />
    );
    expect(screen.getByRole('link')).toHaveAttribute('href', '/circle');

    rerender(
      <NotificationRow
        item={item({ type: 'friend.joined', objectType: 'friendship' })}
        isNew={false}
      />
    );
    expect(screen.getByRole('link')).toHaveAttribute('href', '/circle');
  });

  it('links a group add to the group', () => {
    const { rerender } = render(
      <NotificationRow item={item({ type: 'friend.joined' })} isNew={false} />
    );

    rerender(
      <NotificationRow
        item={item({
          type: 'group.added',
          targetType: 'chat_group',
          targetId: 'g7',
        })}
        isNew={false}
      />
    );
    expect(screen.getByRole('link')).toHaveAttribute('href', '/circle/g/g7');
  });

  it('routes on the object the payload names, not on the type', () => {
    // "Is this row's object a share?" is answered by the row itself:
    // `objectType` is written by the three share producers and by nobody else.
    // An invite row carries `'invite'` and stays on the Circle even though its
    // type starts with `share.`.
    expect(
      notificationHref(
        item({ type: 'share.invite_accepted', objectType: 'invite' })
      )
    ).toBe('/circle');
    expect(
      notificationHref(
        item({ type: 'friend.joined', objectType: 'friendship' })
      )
    ).toBe('/circle');
    // A share type with no share object falls back to the Circle too.
    expect(
      notificationHref(
        item({ type: 'share.reply', objectType: null, objectId: null })
      )
    ).toBe('/circle');
    expect(notificationHref(item({ type: 'share.reply' }))).toBe('/circle/s1');
  });

  it('marks the row read on tap, once, and never for an already-read row', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<NotificationRow item={item()} isNew={true} />);

    await user.click(screen.getByRole('link'));
    expect(markReadMock).toHaveBeenCalledWith(['n1']);

    markReadMock.mockReset();
    rerender(
      <NotificationRow
        item={item({ readAt: new Date().toISOString() })}
        isNew={false}
      />
    );
    await user.click(screen.getByRole('link'));
    expect(markReadMock).not.toHaveBeenCalled();
  });
});
