import { beforeEach, describe, expect, it, vi } from 'vitest';

const { storageReadsAllowed } = vi.hoisted(() => ({
  storageReadsAllowed: vi.fn(),
}));
vi.mock('@/lib/infra/storage/object-storage', () => ({ storageReadsAllowed }));

import { toPublicIdentity } from '@/lib/domain/social/identity/public-identity';

const ROW = {
  userId: 'u1',
  handle: 'kim',
  displayName: 'Kim',
  avatarSeed: 'seed',
  avatarUrl: 'https://lh3.googleusercontent.com/oauth.jpg',
  avatarPath: 'u1/photo.webp',
};

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_AVATAR_BASE_URL', 'https://media.example.com');
  storageReadsAllowed.mockReturnValue(true);
});

describe('toPublicIdentity', () => {
  it('prefers the uploaded photo over the OAuth picture', () => {
    expect(toPublicIdentity(ROW)).toMatchObject({
      avatarUrl: 'https://media.example.com/u1/photo.webp',
      hasCustomAvatar: true,
    });
  });

  it('falls back to the OAuth picture past the read cap, and the photo stays removable', () => {
    storageReadsAllowed.mockReturnValue(false);

    expect(toPublicIdentity(ROW)).toMatchObject({
      avatarUrl: 'https://lh3.googleusercontent.com/oauth.jpg',
      hasCustomAvatar: true,
    });
  });

  it('has no custom avatar without a stored path', () => {
    expect(toPublicIdentity({ ...ROW, avatarPath: null })).toMatchObject({
      avatarUrl: 'https://lh3.googleusercontent.com/oauth.jpg',
      hasCustomAvatar: false,
    });
  });
});
