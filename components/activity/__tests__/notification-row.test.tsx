import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NotificationItem } from '@/lib/domain/notifications/contracts';
import type { PublicIdentity } from '@/lib/domain/social/identity/public-identity';
import { messageValues } from '../notification-copy';
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
    ['friend.joined', 'row.friendJoined.one'],
    ['group.added', 'row.groupAdded.one'],
    ['share.invite_accepted', 'row.shareInviteAccepted.one'],
    ['share.reaction', 'row.shareReaction.one'],
    ['share.reply', 'row.shareReply.one'],
    ['share.logged', 'row.shareLogged.one'],
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

    expect(screen.getByText('row.shareReaction.other')).toBeInTheDocument();
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

  it('links share activity to the circle and group adds to the group', () => {
    const { rerender } = render(
      <NotificationRow item={item()} isNew={false} />
    );
    expect(screen.getByRole('link')).toHaveAttribute('href', '/circle');

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
