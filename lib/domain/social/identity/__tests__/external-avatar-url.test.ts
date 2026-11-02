import { beforeEach, describe, expect, it, vi } from 'vitest';
import { externalAvatarUrl } from '@/lib/domain/social/identity/external-avatar-url';
import {
  GOOGLE_PICTURE,
  HOSTILE_AVATAR_URLS,
  OWN_AVATAR_BASE,
  OWN_AVATAR_URL,
} from './hostile-avatar-urls';

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_AVATAR_BASE_URL', OWN_AVATAR_BASE);
});

describe('externalAvatarUrl', () => {
  it.each(Object.entries(HOSTILE_AVATAR_URLS))('rejects %s', (_, url) => {
    expect(externalAvatarUrl(url)).toBeNull();
  });

  it('passes a Google sign-in picture and an own-storage URL unchanged', () => {
    expect(externalAvatarUrl(GOOGLE_PICTURE)).toBe(GOOGLE_PICTURE);
    expect(externalAvatarUrl(OWN_AVATAR_URL)).toBe(OWN_AVATAR_URL);
  });

  it('accepts a URL exactly at the length cap', () => {
    const prefix = 'https://lh3.googleusercontent.com/';
    const url = prefix + 'a'.repeat(2048 - prefix.length);
    expect(externalAvatarUrl(url)).toBe(url);
  });

  it('rejects non-strings and empty strings', () => {
    for (const raw of [undefined, null, 42, {}, '']) {
      expect(externalAvatarUrl(raw)).toBeNull();
    }
  });

  it('allows no own-storage host when the avatar base is unset', () => {
    vi.stubEnv('NEXT_PUBLIC_AVATAR_BASE_URL', '');
    expect(externalAvatarUrl(OWN_AVATAR_URL)).toBeNull();
    expect(externalAvatarUrl(GOOGLE_PICTURE)).toBe(GOOGLE_PICTURE);
  });

  it('hands back the parsed form, so the checked host is the one clients read', () => {
    expect(
      externalAvatarUrl(
        'https://lh3.googleusercontent.com\\@images.example.com/x'
      )
    ).toBe('https://lh3.googleusercontent.com/@images.example.com/x');
  });
});
