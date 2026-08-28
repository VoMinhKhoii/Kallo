// What this pins is the contract between the notification domain and a device:
// which tokens get loaded, whose locale decides the words, what the data
// payload the Flutter client parses actually contains, which registrations get
// deleted afterwards — and, above all, that none of it can ever throw. Push
// runs in an `after()` callback on the back of a committed transaction; a
// rejection there is an unhandled error on a request that already succeeded.

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const { mockSelect, mockDelete } = vi.hoisted(() => ({
  mockSelect: vi.fn(),
  mockDelete: vi.fn(),
}));
vi.mock('@/lib/infra/db/client', () => ({
  db: { select: mockSelect, delete: mockDelete },
}));

import {
  sendChatMessagePush,
  sendNotificationPush,
} from '@/lib/domain/notifications/push';
import type {
  PushMessage,
  PushSender,
  PushSendResult,
} from '@/lib/infra/push/types';

const OWNER = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const FRIEND = 'b1ffcd00-ad1c-4ff9-8c7e-7ccace491b22';
const GROUP = 'c2aade11-be2d-4aa0-8d8f-8ddbdf502c33';

/** Every select in this module is `.select().from().where()`, except the actor
 *  name lookup which adds `.limit()`; one queue serves both. */
function queueSelects(...rowSets: unknown[][]) {
  const queue = [...rowSets];
  mockSelect.mockImplementation(() => {
    const rows = queue.shift() ?? [];
    const query = {
      from: vi.fn(() => query),
      where: vi.fn(() => Object.assign(Promise.resolve(rows), query)),
      limit: vi.fn(() => Promise.resolve(rows)),
    };
    return query;
  });
}

function capturingDelete() {
  const wheres: unknown[] = [];
  mockDelete.mockImplementation(() => ({
    where: vi.fn((clause: unknown) => {
      wheres.push(clause);
      return Promise.resolve(undefined);
    }),
  }));
  return wheres;
}

function fakeSender(results: (messages: PushMessage[]) => PushSendResult[]) {
  const sent: PushMessage[][] = [];
  const sender: PushSender = {
    send: vi.fn(async (messages: PushMessage[]) => {
      sent.push(messages);
      return results(messages);
    }),
  };
  return { sender, sent };
}

const allOk = (messages: PushMessage[]) =>
  messages.map((message) => ({
    token: message.token,
    ok: true,
    shouldPrune: false,
  }));

describe('sendNotificationPush', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDelete.mockImplementation(() => ({
      where: vi.fn().mockResolvedValue(undefined),
    }));
  });

  it('does nothing at all without recipients', async () => {
    const { sender } = fakeSender(allOk);

    await sendNotificationPush([], { type: 'share.reaction' }, sender);

    expect(mockSelect).not.toHaveBeenCalled();
    expect(sender.send).not.toHaveBeenCalled();
  });

  it('stops before the sender when nobody has a registered device', async () => {
    queueSelects([]);
    const { sender } = fakeSender(allOk);

    await sendNotificationPush([OWNER], { type: 'share.reaction' }, sender);

    expect(sender.send).not.toHaveBeenCalled();
  });

  it('builds one message per device in that device owner’s locale', async () => {
    queueSelects(
      [
        { userId: OWNER, token: 'owner-phone' },
        { userId: OWNER, token: 'owner-tablet' },
        { userId: FRIEND, token: 'friend-phone' },
      ],
      [
        { userId: OWNER, preferredLocale: 'vi' },
        { userId: FRIEND, preferredLocale: 'en' },
      ]
    );
    const { sender, sent } = fakeSender(allOk);

    await sendNotificationPush(
      [OWNER, FRIEND],
      { type: 'share.reaction', actorName: 'Mai' },
      sender
    );

    expect(sent[0].map((message) => message.body)).toEqual([
      'Mai đã thích bữa ăn của bạn',
      'Mai đã thích bữa ăn của bạn',
      'Mai reacted to your meal',
    ]);
    expect(sent[0].every((message) => message.title === 'Kallo')).toBe(true);
  });

  it('falls back to English when the profile carries no locale', async () => {
    queueSelects(
      [{ userId: OWNER, token: 'owner-phone' }],
      [{ userId: OWNER, preferredLocale: null }]
    );
    const { sender, sent } = fakeSender(allOk);

    await sendNotificationPush(
      [OWNER],
      { type: 'friend.joined', actorName: 'Mai' },
      sender
    );

    expect(sent[0][0].body).toBe('Mai joined your circle');
  });

  it('resolves the actor name from the profile when none was passed', async () => {
    queueSelects(
      [{ userId: OWNER, token: 'owner-phone' }],
      [{ userId: OWNER, preferredLocale: 'en' }],
      [{ displayName: null, handle: 'mai' }]
    );
    const { sender, sent } = fakeSender(allOk);

    await sendNotificationPush(
      [OWNER],
      { type: 'share.logged', actorId: FRIEND },
      sender
    );

    expect(sent[0][0].body).toBe('mai logged your meal');
  });

  it('sends the flat string data payload and the group key as collapse key', async () => {
    queueSelects(
      [{ userId: OWNER, token: 'owner-phone' }],
      [{ userId: OWNER, preferredLocale: 'en' }]
    );
    const { sender, sent } = fakeSender(allOk);

    await sendNotificationPush(
      [OWNER],
      {
        type: 'group.added',
        actorName: 'Mai',
        data: { groupName: 'Trip' },
        targetType: 'chat_group',
        targetId: GROUP,
        notificationId: 'notif-1',
        groupKey: `group.added:${GROUP}`,
      },
      sender
    );

    expect(sent[0][0]).toEqual({
      token: 'owner-phone',
      title: 'Kallo',
      body: 'Mai added you to Trip',
      data: {
        type: 'group.added',
        targetType: 'chat_group',
        targetId: GROUP,
        notificationId: 'notif-1',
      },
      collapseKey: `group.added:${GROUP}`,
    });
  });

  it('deletes exactly the registrations the sender says are dead', async () => {
    queueSelects(
      [
        { userId: OWNER, token: 'live' },
        { userId: OWNER, token: 'dead' },
      ],
      [{ userId: OWNER, preferredLocale: 'en' }]
    );
    const wheres = capturingDelete();
    const { sender } = fakeSender((messages) =>
      messages.map((message) => ({
        token: message.token,
        ok: message.token === 'live',
        shouldPrune: message.token === 'dead',
      }))
    );

    await sendNotificationPush([OWNER], { type: 'share.reply' }, sender);

    expect(mockDelete).toHaveBeenCalledTimes(1);
    expect(wheres).toHaveLength(1);
  });

  it('does not touch the table when every token survived', async () => {
    queueSelects(
      [{ userId: OWNER, token: 'live' }],
      [{ userId: OWNER, preferredLocale: 'en' }]
    );
    const { sender } = fakeSender(allOk);

    await sendNotificationPush([OWNER], { type: 'share.reply' }, sender);

    expect(mockDelete).not.toHaveBeenCalled();
  });

  it('swallows a sender failure — push must never fail the request', async () => {
    queueSelects(
      [{ userId: OWNER, token: 'owner-phone' }],
      [{ userId: OWNER, preferredLocale: 'en' }]
    );
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    const sender: PushSender = {
      send: vi.fn().mockRejectedValue(new Error('FCM is down')),
    };

    await expect(
      sendNotificationPush([OWNER], { type: 'share.reaction' }, sender)
    ).resolves.toBeUndefined();
    expect(errors).toHaveBeenCalled();
    errors.mockRestore();
  });

  // The sender is resolved inside the try, not as a default argument: default
  // arguments evaluate BEFORE the body, so a JSON.parse of a malformed service
  // account would reject the after() task instead of being swallowed here.
  it('survives a malformed FCM service account with no sender passed', async () => {
    queueSelects(
      [{ userId: OWNER, token: 'owner-phone' }],
      [{ userId: OWNER, preferredLocale: 'en' }]
    );
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubEnv('FCM_SERVICE_ACCOUNT_JSON', '{ not json');

    await expect(
      sendNotificationPush([OWNER], { type: 'share.reaction' })
    ).resolves.toBeUndefined();

    vi.unstubAllEnvs();
    errors.mockRestore();
  });

  it('swallows a database failure the same way', async () => {
    mockSelect.mockImplementation(() => {
      throw new Error('connection lost');
    });
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(
      sendNotificationPush([OWNER], { type: 'share.reaction' })
    ).resolves.toBeUndefined();
    expect(errors).toHaveBeenCalled();
    errors.mockRestore();
  });
});

describe('sendChatMessagePush', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDelete.mockImplementation(() => ({
      where: vi.fn().mockResolvedValue(undefined),
    }));
  });

  it('fans out to the audience the producer captured, titled by the sender', async () => {
    queueSelects(
      [
        { userId: OWNER, token: 'owner-phone' },
        { userId: FRIEND, token: 'friend-phone' },
      ],
      [
        { userId: OWNER, preferredLocale: 'vi' },
        { userId: FRIEND, preferredLocale: 'en' },
      ],
      [{ displayName: 'Mai', handle: 'mai' }]
    );
    const { sender, sent } = fakeSender(allOk);

    await sendChatMessagePush(
      {
        groupId: GROUP,
        senderId: 'd3bbde22-cf3e-4bb1-9e9f-9eecef613d44',
        preview: 'Ăn cơm chưa',
        recipientIds: [OWNER, FRIEND],
      },
      sender
    );

    expect(sent[0]).toHaveLength(2);
    // A chat push reads like a chat: the sender is the title in EVERY locale.
    expect(sent[0].every((message) => message.title === 'Mai')).toBe(true);
    expect(sent[0].every((message) => message.body === 'Ăn cơm chưa')).toBe(
      true
    );
    expect(sent[0][0].collapseKey).toBe(`chat:${GROUP}`);
    expect(sent[0][0].data).toEqual({
      type: 'chat.message',
      targetType: 'chat_group',
      targetId: GROUP,
    });
  });

  it('truncates a long message to a lock-screen-sized preview', async () => {
    queueSelects(
      [{ userId: OWNER, token: 'owner-phone' }],
      [{ userId: OWNER, preferredLocale: 'en' }],
      [{ displayName: 'Mai', handle: 'mai' }]
    );
    const { sender, sent } = fakeSender(allOk);

    await sendChatMessagePush(
      {
        groupId: GROUP,
        senderId: FRIEND,
        preview: 'a'.repeat(500),
        recipientIds: [OWNER],
      },
      sender
    );

    expect(sent[0][0].body).toHaveLength(140);
  });

  // The audience is fixed at write time, so an empty list means the sender was
  // alone in the room WHEN THEY SENT — this module must not go look again and
  // find whoever has joined since.
  it('sends nothing, and reads nothing, for an empty audience', async () => {
    const { sender } = fakeSender(allOk);

    await sendChatMessagePush(
      { groupId: GROUP, senderId: OWNER, preview: 'hi', recipientIds: [] },
      sender
    );

    expect(mockSelect).not.toHaveBeenCalled();
    expect(sender.send).not.toHaveBeenCalled();
  });
});
