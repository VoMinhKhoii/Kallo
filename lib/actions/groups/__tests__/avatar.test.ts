import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// KALLO-05: no client holds a storage token, so these actions are the only
// way bytes land in the `avatars` bucket. They must write through the
// server-side object store, only AFTER the checks + sharp re-encode, at a path
// the server builds from the actor id, and never delete outside that prefix.
// ---------------------------------------------------------------------------

const { putObject, removeObjects, assertConfigured, processAvatarImage } =
  vi.hoisted(() => ({
    putObject: vi.fn(),
    removeObjects: vi.fn(),
    assertConfigured: vi.fn(),
    processAvatarImage: vi.fn(),
  }));

vi.mock('@/lib/infra/db/client', () => ({ db: {} }));
vi.mock('@/lib/infra/storage/object-storage', () => ({
  putObject,
  removeObjects,
  assertObjectStorageConfigured: assertConfigured,
}));
vi.mock('@/lib/infra/uploads/avatar-image', () => ({ processAvatarImage }));
vi.mock('@/lib/actions/groups/profile', () => ({
  getMyPublicProfile: vi.fn(async () => ({ avatarUrl: 'x' })),
  getOrCreateMyProfile: vi.fn(async () => ({ avatarUrl: null })),
}));

import {
  AVATAR_CACHE_CONTROL,
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
  putObject.mockResolvedValue(undefined);
  removeObjects.mockResolvedValue(undefined);
  processAvatarImage.mockResolvedValue(PROCESSED);
});

describe('uploadMyAvatar', () => {
  it('uploads the sharp output to the avatars bucket at {actor}/{uuid}.webp', async () => {
    const { db, set } = fakeDb(null);

    await uploadMyAvatar(ACTOR, pngFile(), db);

    expect(processAvatarImage).toHaveBeenCalledWith(PNG);
    const [bucket, path, body, options] = putObject.mock.calls[0];
    expect(bucket).toBe('avatars');
    expect(path).toMatch(new RegExp(`^${ACTOR}/[0-9a-f-]{36}\\.webp$`, 'i'));
    // The stored bytes are the re-encode, never the caller's upload.
    expect(body).toBe(PROCESSED);
    expect(options).toEqual({
      contentType: 'image/webp',
      cacheControl: AVATAR_CACHE_CONTROL,
    });
    expect(AVATAR_CACHE_CONTROL).toBe('public, max-age=300');
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

    expect(putObject.mock.calls[0][1].startsWith(`${ACTOR}/`)).toBe(true);
  });

  it('never touches storage when the bytes fail the checks', async () => {
    const { db } = fakeDb(null);
    // AVIF-ish bytes labelled as webp: the magic-byte check rejects them.
    const avif = new Uint8Array([0, 0, 0, 0x1c, 0x66, 0x74, 0x79, 0x70, 0x61]);

    await expect(
      uploadMyAvatar(ACTOR, pngFile(avif, 'image/webp'), db)
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
    expect(processAvatarImage).not.toHaveBeenCalled();
    expect(putObject).not.toHaveBeenCalled();
  });

  it('never uploads when the sharp decode fails', async () => {
    const { db } = fakeDb(null);
    processAvatarImage.mockRejectedValueOnce(new Error('bad image'));

    await expect(uploadMyAvatar(ACTOR, pngFile(), db)).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
    });
    expect(putObject).not.toHaveBeenCalled();
  });

  it('removes the replaced object when it is under the prefix', async () => {
    const { db } = fakeDb(`${ACTOR}/old.webp`);

    await uploadMyAvatar(ACTOR, pngFile(), db);

    expect(removeObjects).toHaveBeenCalledWith('avatars', [
      `${ACTOR}/old.webp`,
    ]);
  });

  it('fails without pointing the profile at an object that never landed', async () => {
    const { db, set } = fakeDb(null);
    putObject.mockRejectedValueOnce(new Error('r2 down'));
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(uploadMyAvatar(ACTOR, pngFile(), db)).rejects.toMatchObject({
      code: 'INTERNAL',
    });
    expect(set).not.toHaveBeenCalled();
    log.mockRestore();
  });

  it('refuses to remove a replaced object outside the prefix', async () => {
    const { db } = fakeDb(`${INVITER}/theirs.webp`);
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});

    await uploadMyAvatar(ACTOR, pngFile(), db);

    expect(removeObjects).not.toHaveBeenCalled();
    log.mockRestore();
  });
});

describe('removeMyAvatar', () => {
  it('clears the row and removes the object', async () => {
    const { db, set } = fakeDb(`${ACTOR}/current.webp`);

    await removeMyAvatar(ACTOR, db);

    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({ avatarPath: null })
    );
    expect(removeObjects).toHaveBeenCalledWith('avatars', [
      `${ACTOR}/current.webp`,
    ]);
  });

  it('keeps the row when storage is not configured', async () => {
    const { db, set } = fakeDb(`${ACTOR}/current.webp`);
    assertConfigured.mockImplementationOnce(() => {
      throw new Error('Object storage requires R2_…');
    });

    await expect(removeMyAvatar(ACTOR, db)).rejects.toThrow();
    expect(set).not.toHaveBeenCalled();
    expect(removeObjects).not.toHaveBeenCalled();
  });

  it('still clears the row when the object delete fails', async () => {
    const { db, set } = fakeDb(`${ACTOR}/current.webp`);
    removeObjects.mockRejectedValueOnce(new Error('r2 down'));
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});

    await removeMyAvatar(ACTOR, db);

    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({ avatarPath: null })
    );
    log.mockRestore();
  });

  it('refuses a stored path outside the actor prefix', async () => {
    const { db } = fakeDb(`${ACTOR}/../${INVITER}/x.webp`);
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});

    await removeMyAvatar(ACTOR, db);

    expect(removeObjects).not.toHaveBeenCalled();
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
