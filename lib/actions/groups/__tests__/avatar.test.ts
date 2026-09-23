import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// KALLO-05: users hold no write policy on the `avatars` bucket, so these
// actions are the only way bytes land there. They must write through the
// service-role client, only AFTER the checks + sharp re-encode, at a path the
// server builds from the actor id, and never delete outside that prefix.
// ---------------------------------------------------------------------------

const { upload, remove, from, createAdminClient, processAvatarImage } =
  vi.hoisted(() => {
    const upload = vi.fn();
    const remove = vi.fn();
    const from = vi.fn(() => ({ upload, remove }));
    return {
      upload,
      remove,
      from,
      createAdminClient: vi.fn(() => ({ storage: { from } })),
      processAvatarImage: vi.fn(),
    };
  });

vi.mock('@/lib/infra/db/client', () => ({ db: {} }));
vi.mock('@/lib/infra/supabase/admin', () => ({ createAdminClient }));
vi.mock('@/lib/infra/uploads/avatar-image', () => ({ processAvatarImage }));
vi.mock('@/lib/actions/groups/profile', () => ({
  getMyPublicProfile: vi.fn(async () => ({ avatarUrl: 'x' })),
  getOrCreateMyProfile: vi.fn(async () => ({ avatarUrl: null })),
}));

import {
  AVATAR_CACHE_CONTROL_SECONDS,
  isOwnAvatarPath,
  removeMyAvatar,
  uploadMyAvatar,
} from '@/lib/actions/groups/avatar';
import type { Db } from '@/lib/actions/groups/types';
import { ACTOR, INVITER } from './circle-doubles';

const PROCESSED = Buffer.from('sharp-output');
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1]);

/** Db double: `select…limit` yields the stored avatar path; `update` records
 * the new one. */
function fakeDb(storedPath: string | null) {
  const set = vi.fn(() => ({ where: vi.fn(async () => undefined) }));
  const db = {
    select: () => ({
      from: () => ({
        where: () => ({ limit: async () => [{ avatarPath: storedPath }] }),
      }),
    }),
    update: vi.fn(() => ({ set })),
  };
  return { db: db as unknown as Db, set };
}

function pngFile(bytes: Uint8Array = PNG, type = 'image/png') {
  return new File([bytes as BlobPart], 'me.png', { type });
}

beforeEach(() => {
  vi.clearAllMocks();
  upload.mockResolvedValue({ data: {}, error: null });
  remove.mockResolvedValue({ data: [], error: null });
  processAvatarImage.mockResolvedValue(PROCESSED);
});

describe('uploadMyAvatar', () => {
  it('uploads the sharp output via the admin client at {actor}/{uuid}.webp', async () => {
    const { db, set } = fakeDb(null);

    await uploadMyAvatar(ACTOR, pngFile(), db);

    expect(createAdminClient).toHaveBeenCalled();
    expect(from).toHaveBeenCalledWith('avatars');
    expect(processAvatarImage).toHaveBeenCalledWith(PNG);
    const [path, body, options] = upload.mock.calls[0];
    expect(path).toMatch(new RegExp(`^${ACTOR}/[0-9a-f-]{36}\\.webp$`, 'i'));
    // The stored bytes are the re-encode, never the caller's upload.
    expect(body).toBe(PROCESSED);
    expect(options).toEqual({
      contentType: 'image/webp',
      cacheControl: AVATAR_CACHE_CONTROL_SECONDS,
      upsert: false,
    });
    expect(AVATAR_CACHE_CONTROL_SECONDS).toBe('300');
    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({ avatarPath: path })
    );
  });

  it('ignores the client filename when building the path', async () => {
    const { db } = fakeDb(null);
    const evil = new File([PNG as BlobPart], `../${INVITER}/x.html`, {
      type: 'image/png',
    });

    await uploadMyAvatar(ACTOR, evil, db);

    expect(upload.mock.calls[0][0].startsWith(`${ACTOR}/`)).toBe(true);
  });

  it('never touches storage when the bytes fail the checks', async () => {
    const { db } = fakeDb(null);
    // AVIF-ish bytes labelled as webp: the magic-byte check rejects them.
    const avif = new Uint8Array([0, 0, 0, 0x1c, 0x66, 0x74, 0x79, 0x70, 0x61]);

    await expect(
      uploadMyAvatar(ACTOR, pngFile(avif, 'image/webp'), db)
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
    expect(processAvatarImage).not.toHaveBeenCalled();
    expect(createAdminClient).not.toHaveBeenCalled();
    expect(upload).not.toHaveBeenCalled();
  });

  it('never uploads when the sharp decode fails', async () => {
    const { db } = fakeDb(null);
    processAvatarImage.mockRejectedValueOnce(new Error('bad image'));

    await expect(uploadMyAvatar(ACTOR, pngFile(), db)).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
    });
    expect(upload).not.toHaveBeenCalled();
  });

  it('removes the replaced object via admin when it is under the prefix', async () => {
    const { db } = fakeDb(`${ACTOR}/old.webp`);

    await uploadMyAvatar(ACTOR, pngFile(), db);

    expect(remove).toHaveBeenCalledWith([`${ACTOR}/old.webp`]);
  });

  it('refuses to remove a replaced object outside the prefix', async () => {
    const { db } = fakeDb(`${INVITER}/theirs.webp`);
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});

    await uploadMyAvatar(ACTOR, pngFile(), db);

    expect(remove).not.toHaveBeenCalled();
    log.mockRestore();
  });
});

describe('removeMyAvatar', () => {
  it('clears the row and removes the object via the admin client', async () => {
    const { db, set } = fakeDb(`${ACTOR}/current.webp`);

    await removeMyAvatar(ACTOR, db);

    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({ avatarPath: null })
    );
    expect(createAdminClient).toHaveBeenCalled();
    expect(remove).toHaveBeenCalledWith([`${ACTOR}/current.webp`]);
  });

  it('refuses a stored path outside the actor prefix', async () => {
    const { db } = fakeDb(`${ACTOR}/../${INVITER}/x.webp`);
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});

    await removeMyAvatar(ACTOR, db);

    expect(remove).not.toHaveBeenCalled();
    log.mockRestore();
  });
});

describe('isOwnAvatarPath', () => {
  it.each([
    [`${ACTOR}/a.webp`, true],
    [`${INVITER}/a.webp`, false],
    [`${ACTOR}/nested/a.webp`, false],
    [`${ACTOR}/../${INVITER}/a.webp`, false],
    [`${ACTOR}/`, false],
    [`${ACTOR}a.webp`, false],
    ['a.webp', false],
  ])('%s → %s', (path, expected) => {
    expect(isOwnAvatarPath(ACTOR, path)).toBe(expected);
  });

  it('rejects an empty actor id', () => {
    expect(isOwnAvatarPath('', '/a.webp')).toBe(false);
  });
});
