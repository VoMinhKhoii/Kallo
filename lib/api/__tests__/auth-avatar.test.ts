import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGetRequestUser } = vi.hoisted(() => ({
  mockGetRequestUser: vi.fn(),
}));
vi.mock('@/lib/infra/auth/session', () => ({
  getRequestUser: mockGetRequestUser,
}));
vi.mock('@/lib/infra/supabase/server', () => ({ createClient: vi.fn() }));

import { requireUserWithAvatar } from '@/lib/api/auth';
import {
  GOOGLE_PICTURE,
  HOSTILE_AVATAR_URLS,
} from '@/lib/domain/social/identity/__tests__/hostile-avatar-urls';

const USER = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

function signedInWith(userMetadata: Record<string, unknown>) {
  mockGetRequestUser.mockResolvedValue({ id: USER, userMetadata });
}

// The account owner can write their own auth metadata, so this is where the
// URL that public_profiles.avatar_url is synced from gets its host gate.
describe('requireUserWithAvatar', () => {
  beforeEach(() => vi.clearAllMocks());

  it('passes a Google sign-in picture from avatar_url or picture', async () => {
    signedInWith({ avatar_url: GOOGLE_PICTURE });
    await expect(requireUserWithAvatar()).resolves.toEqual({
      id: USER,
      avatarUrl: GOOGLE_PICTURE,
    });

    signedInWith({ picture: GOOGLE_PICTURE });
    await expect(requireUserWithAvatar()).resolves.toEqual({
      id: USER,
      avatarUrl: GOOGLE_PICTURE,
    });
  });

  it.each(
    Object.entries(HOSTILE_AVATAR_URLS)
  )('stores no picture for metadata with %s', async (_, url) => {
    signedInWith({ avatar_url: url, picture: url });
    await expect(requireUserWithAvatar()).resolves.toEqual({
      id: USER,
      avatarUrl: null,
    });
  });

  it('stores no picture when the metadata has none (e.g. Apple sign-in)', async () => {
    signedInWith({ full_name: 'Mai' });
    await expect(requireUserWithAvatar()).resolves.toEqual({
      id: USER,
      avatarUrl: null,
    });
  });
});
