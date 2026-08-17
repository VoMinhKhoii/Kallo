import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db', () => ({ db: {} }));

import {
  canViewShare,
  canViewShareOwnedBy,
} from '@/lib/social/shares/share-visibility';

const VIEWER_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const OWNER_ID = 'b1ffcd00-ad1c-4ff9-8c7e-7ccace491b22';
const SHARE_ID = 'c2aade11-be2d-4aa0-8d8f-8ddbdf502c33';

function fakeDb(rows: unknown[]) {
  const limit = vi.fn().mockResolvedValue(rows);
  const where = vi.fn(() => ({ limit }));
  const from = vi.fn(() => ({ where, limit }));
  const select = vi.fn(() => ({ from }));
  return { select };
}

describe('canViewShare', () => {
  it('returns the one-statement authorization result', async () => {
    const db = fakeDb([{ visible: true }]);

    await expect(canViewShare(VIEWER_ID, SHARE_ID, db as never)).resolves.toBe(
      true
    );
    expect(db.select).toHaveBeenCalledTimes(1);
  });

  it('masks a missing or unauthorized share as false', async () => {
    const missingDb = fakeDb([]);
    const hiddenDb = fakeDb([{ visible: false }]);

    await expect(
      canViewShare(VIEWER_ID, SHARE_ID, missingDb as never)
    ).resolves.toBe(false);
    await expect(
      canViewShare(VIEWER_ID, SHARE_ID, hiddenDb as never)
    ).resolves.toBe(false);
  });
});

describe('canViewShareOwnedBy', () => {
  const sharedAt = new Date('2026-07-10T12:00:00.000Z');

  it('allows the owner without another query', async () => {
    const db = fakeDb([]);

    await expect(
      canViewShareOwnedBy(
        VIEWER_ID,
        { actorId: VIEWER_ID, sharedAt, visibility: 'private' },
        db as never
      )
    ).resolves.toBe(true);
    expect(db.select).not.toHaveBeenCalled();
  });

  it('rejects another owner private share without another query', async () => {
    const db = fakeDb([]);

    await expect(
      canViewShareOwnedBy(
        VIEWER_ID,
        { actorId: OWNER_ID, sharedAt, visibility: 'private' },
        db as never
      )
    ).resolves.toBe(false);
    expect(db.select).not.toHaveBeenCalled();
  });

  it('checks live friendship or named-group access in one query', async () => {
    const db = fakeDb([{ visible: true }]);

    await expect(
      canViewShareOwnedBy(
        VIEWER_ID,
        { actorId: OWNER_ID, sharedAt, visibility: 'circle' },
        db as never
      )
    ).resolves.toBe(true);
    expect(db.select).toHaveBeenCalledTimes(1);
  });
});
