import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Where the send throttle sits in `sendChatGroupMessage`.
 *
 * It used to run AFTER `requireGroupAccess` (and, for groups, after the
 * circle-quota read), which meant it bounded neither of them: a caller feeding
 * it group ids it has no access to paid for a membership lookup per request,
 * on a two-connection pool, with no ceiling at all — the guard it was supposed
 * to be behind never got the chance to refuse. The order is the fix, so the
 * order is what this pins.
 */

const { mockAssertRateLimit, mockRequireGroupAccess, mockTransaction } =
  vi.hoisted(() => ({
    mockAssertRateLimit: vi.fn(),
    mockRequireGroupAccess: vi.fn(),
    mockTransaction: vi.fn(),
  }));

vi.mock('@/lib/infra/rate-limit/limiter/limiter', () => ({
  assertRateLimit: mockAssertRateLimit,
}));
vi.mock('@/lib/actions/chat-groups/membership', () => ({
  requireGroupAccess: mockRequireGroupAccess,
}));
vi.mock('@/lib/infra/db/client', () => ({
  db: { transaction: mockTransaction },
}));
vi.mock('@/lib/domain/social/quota/circle-quota', () => ({
  assertUnlimitedCircleActor: vi.fn(async () => undefined),
}));
vi.mock('@/lib/domain/notifications/push', () => ({
  sendChatMessagePush: vi.fn(async () => undefined),
}));
vi.mock('next/server', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  after: vi.fn(),
}));

import { sendChatGroupMessage } from '@/lib/actions/chat-groups/messages';

const ACTOR = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const GROUP = 'd3bbde22-cf3e-4bb1-9e9f-9eecef613d44';

beforeEach(() => {
  vi.clearAllMocks();
  mockAssertRateLimit.mockResolvedValue(undefined);
  mockRequireGroupAccess.mockResolvedValue({ kind: 'direct' });
});

describe('sendChatGroupMessage throttling', () => {
  it('charges the per-actor limit before any database read', async () => {
    const { Errors } = await import('@/lib/core/errors/catalog');
    mockAssertRateLimit.mockRejectedValueOnce(Errors.rateLimited(undefined, 3));

    await expect(
      sendChatGroupMessage(ACTOR, { groupId: GROUP, body: 'hi' })
    ).rejects.toMatchObject({ code: 'RATE_LIMITED', status: 429 });

    expect(mockAssertRateLimit).toHaveBeenCalledWith('chatMessageSend', {
      kind: 'user',
      value: ACTOR,
    });
    expect(mockRequireGroupAccess).not.toHaveBeenCalled();
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it('still validates the body shape first, so garbage is a 400 and not a charge', async () => {
    await expect(
      sendChatGroupMessage(ACTOR, { groupId: 'not-a-uuid', body: 'hi' })
    ).rejects.toThrow();
    expect(mockAssertRateLimit).not.toHaveBeenCalled();
  });
});
