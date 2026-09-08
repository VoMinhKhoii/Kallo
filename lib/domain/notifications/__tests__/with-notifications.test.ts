// `toPushPayload` is the one place the row and the lock-screen notice are
// derived from the same instruction, so what it forwards decides where a tap
// can land. These pin the crossing itself: the object identity a share push
// needs to open `/circle/<shareId>`, and the fields that must NOT leak into a
// payload that has no object.

import { describe, expect, it, vi } from 'vitest';

// `after()` is only reached by withNotifications, never by the pure derivation
// under test — but the module imports it at load time.
vi.mock('next/server', () => ({ after: vi.fn() }));
// Loading the real push module would pull the Drizzle client (and its env) in
// for a function that is never called here.
vi.mock('@/lib/domain/notifications/push', () => ({
  sendNotificationPush: vi.fn(),
}));

import type { NotifyInput } from '@/lib/domain/notifications/types';
import { toPushPayload } from '@/lib/domain/notifications/with-notifications';

const OWNER = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const FRIEND = 'b1ffcd00-ad1c-4ff9-8c7e-7ccace491b22';

const reply: NotifyInput = {
  recipientId: OWNER,
  type: 'share.reply',
  actorId: FRIEND,
  objectType: 'share',
  objectId: 'share-1',
  groupKey: 'share.reply:share-1',
};

describe('toPushPayload', () => {
  it('forwards the object identity a share push is tapped through', () => {
    expect(toPushPayload(reply)).toEqual({
      type: 'share.reply',
      actor: { id: FRIEND },
      objectType: 'share',
      objectId: 'share-1',
      groupKey: 'share.reply:share-1',
    });
  });

  it('omits both object keys when the event has no object', () => {
    const payload = toPushPayload({
      recipientId: OWNER,
      type: 'friend.joined',
      actorId: FRIEND,
      groupKey: 'friend.joined:new',
    });

    expect(payload).not.toHaveProperty('objectType');
    expect(payload).not.toHaveProperty('objectId');
  });

  it('keeps carrying the target, the actor name and the group copy key', () => {
    expect(
      toPushPayload(
        {
          recipientId: OWNER,
          type: 'group.added',
          actorId: FRIEND,
          targetType: 'chat_group',
          targetId: 'group-1',
          data: { groupName: 'Trip', secret: 'not for the wire' },
          groupKey: 'group.added:group-1',
        },
        { actorName: 'Mai' }
      )
    ).toEqual({
      type: 'group.added',
      actor: { id: FRIEND, name: 'Mai' },
      data: { groupName: 'Trip' },
      targetType: 'chat_group',
      targetId: 'group-1',
      groupKey: 'group.added:group-1',
    });
  });
});
