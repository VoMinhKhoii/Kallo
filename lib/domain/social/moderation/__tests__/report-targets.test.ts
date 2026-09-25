import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/infra/db/client', () => ({ db: {} }));

const { mockCanView, mockBlockedUserIds } = vi.hoisted(() => ({
  mockCanView: vi.fn(),
  mockBlockedUserIds: vi.fn(async (): Promise<Set<string>> => new Set()),
}));
vi.mock('@/lib/domain/social/shares/share-visibility', () => ({
  canViewShareOwnedBy: mockCanView,
}));
vi.mock('@/lib/domain/social/moderation/blocks', () => ({
  blockedUserIds: mockBlockedUserIds,
}));

import { resolveReportTarget } from '@/lib/domain/social/moderation/report-targets';

const REPORTER = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const OWNER = 'b1ffcd00-ad1c-4ff9-8c7e-7ccace491b22';
const TARGET = 'c2aade11-be2d-4aa0-8d8f-8ddbdf502c33';
const GROUP = 'd3bbde22-cf3e-4bb1-9e9f-9eecef613d44';
const SHARED_AT = new Date('2026-09-01T00:00:00.000Z');

/** Each select() resolves (at .limit()) to the next queued row set. */
function fakeDb(...results: unknown[][]) {
  const queue = [...results];
  const select = vi.fn(() => {
    const rows = queue.shift() ?? [];
    const chain: Record<string, unknown> = {};
    for (const method of ['from', 'innerJoin', 'where']) {
      chain[method] = vi.fn(() => chain);
    }
    chain.limit = vi.fn().mockResolvedValue(rows);
    return chain;
  });
  return { select };
}

const shareRow = {
  actorId: OWNER,
  sharedAt: SHARED_AT,
  visibility: 'circle',
  rawInput: 'phở bò tái',
};

describe('resolveReportTarget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBlockedUserIds.mockResolvedValue(new Set());
  });

  it('share: a visible share resolves to its owner and meal text', async () => {
    mockCanView.mockResolvedValueOnce(true);
    const db = fakeDb([shareRow]);

    await expect(
      resolveReportTarget(REPORTER, 'share', TARGET, db as never)
    ).resolves.toEqual({ ownerId: OWNER, excerpt: 'phở bò tái' });
  });

  it('share: still reportable after the reporter blocked the owner', async () => {
    mockCanView.mockResolvedValueOnce(false);
    mockBlockedUserIds.mockResolvedValueOnce(new Set([OWNER]));
    const db = fakeDb([shareRow]);

    await expect(
      resolveReportTarget(REPORTER, 'share', TARGET, db as never)
    ).resolves.toMatchObject({ ownerId: OWNER });
  });

  it('share: invisible and unrelated is null (same as missing)', async () => {
    mockCanView.mockResolvedValueOnce(false);

    await expect(
      resolveReportTarget(
        REPORTER,
        'share',
        TARGET,
        fakeDb([shareRow]) as never
      )
    ).resolves.toBeNull();
    await expect(
      resolveReportTarget(REPORTER, 'share', TARGET, fakeDb([]) as never)
    ).resolves.toBeNull();
  });

  it('reply: resolves to the reply author, not the share owner', async () => {
    const AUTHOR = 'e4ccff33-d04f-4cc2-af01-affdf0724e55';
    mockCanView.mockResolvedValueOnce(true);
    const db = fakeDb([
      {
        authorId: AUTHOR,
        body: 'rude words',
        actorId: OWNER,
        sharedAt: SHARED_AT,
        visibility: 'circle',
      },
    ]);

    await expect(
      resolveReportTarget(REPORTER, 'reply', TARGET, db as never)
    ).resolves.toEqual({ ownerId: AUTHOR, excerpt: 'rude words' });
  });

  it('chat_message: only a member of the chat may report it', async () => {
    const message = { senderId: OWNER, groupId: GROUP, body: 'x'.repeat(400) };

    const member = await resolveReportTarget(
      REPORTER,
      'chat_message',
      TARGET,
      fakeDb([message], [{ groupId: GROUP }]) as never
    );
    expect(member?.ownerId).toBe(OWNER);
    expect(member?.excerpt).toHaveLength(280);

    await expect(
      resolveReportTarget(
        REPORTER,
        'chat_message',
        TARGET,
        fakeDb([message], []) as never
      )
    ).resolves.toBeNull();
  });

  it('chat_group: resolves to the creator for a member', async () => {
    const db = fakeDb(
      [{ createdBy: OWNER, name: 'Team phở' }],
      [{ groupId: GROUP }]
    );

    await expect(
      resolveReportTarget(REPORTER, 'chat_group', GROUP, db as never)
    ).resolves.toEqual({ ownerId: OWNER, excerpt: 'Team phở' });
  });

  it('profile: any existing circle profile, by user id', async () => {
    const db = fakeDb([
      { userId: OWNER, handle: 'phofan', displayName: 'Phở Fan' },
    ]);

    await expect(
      resolveReportTarget(REPORTER, 'profile', OWNER, db as never)
    ).resolves.toEqual({ ownerId: OWNER, excerpt: 'Phở Fan (@phofan)' });
    await expect(
      resolveReportTarget(REPORTER, 'profile', OWNER, fakeDb([]) as never)
    ).resolves.toBeNull();
  });
});
