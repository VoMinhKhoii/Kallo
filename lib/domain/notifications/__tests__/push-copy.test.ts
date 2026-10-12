// Push copy is rendered from the SAME `messages/{en,vi}/activity.json` file the
// in-app feed uses, so there is deliberately no second copy of these sentences
// to assert against. What this suite pins is that the render is faithful: the
// expectations below are built by naively substituting the placeholders of the
// shipped `push.<type>` strings, which is an independent path to the same
// answer. A wording change in the catalogue moves both sides at once — that is
// the point. What it CANNOT change silently is the shape: the actor as title,
// the name-less body, the anonymous fallbacks, the chat exception.

import { describe, expect, it, vi } from 'vitest';

// The real ICU renderer, not the global key-echoing double: this suite exists
// to prove the catalogue actually FORMATS into lock-screen text.
vi.unmock('next-intl');

import {
  type PushLocale,
  pushCopy,
  toPushLocale,
} from '@/lib/domain/notifications/push-copy';
import { NOTIFICATION_TYPES } from '@/lib/domain/notifications/types';
import enActivity from '@/messages/en/activity.json';
import viActivity from '@/messages/vi/activity.json';

const CATALOGUE: Record<PushLocale, typeof enActivity> = {
  en: enActivity,
  vi: viActivity as typeof enActivity,
};

/** The raw `push.<type>` template, straight out of the shipped file. */
function template(locale: PushLocale, type: string): string {
  const [head, tail] = type.split('.');
  const push = CATALOGUE[locale].push as Record<string, Record<string, string>>;
  return push[head][tail];
}

/** Render it the dumb way: substitute the one placeholder. */
function render(locale: PushLocale, type: string, group = ''): string {
  return template(locale, type).replaceAll('{group}', group);
}

describe('pushCopy', () => {
  it.each([
    'en',
    'vi',
  ] as const)('titles every catalogue row by the actor in %s', (locale) => {
    for (const type of NOTIFICATION_TYPES) {
      const { title, body } = pushCopy(type, locale, {
        actorName: 'Mai',
        groupName: 'Trip',
      });
      // The actor is the title — iOS draws their avatar beside it — so the
      // body must not name them a second time.
      expect(title).toBe('Mai');
      expect(body).toBe(render(locale, type, 'Trip'));
      expect(body).not.toContain('Mai');
      expect(body).not.toContain('{');
    }
  });

  it.each([
    'en',
    'vi',
  ] as const)('has a push row for every catalogue type in %s', (locale) => {
    // A type with a feed row and no push row would render the raw key onto a
    // lock screen.
    for (const type of NOTIFICATION_TYPES) {
      expect(typeof template(locale, type)).toBe('string');
    }
  });

  it.each([
    'en',
    'vi',
  ] as const)('falls back to the catalogue’s own anonymous label in %s', (locale) => {
    const someone = CATALOGUE[locale].someone;
    expect(pushCopy('friend.joined', locale, {}).title).toBe(someone);
    // A blank or whitespace name is as good as no name.
    expect(pushCopy('friend.joined', locale, { actorName: '  ' }).title).toBe(
      someone
    );
  });

  it.each([
    ['en', 'a group'],
    ['vi', 'một nhóm'],
  ] as const)('names a nameless group in %s rather than leaving a hole', (locale, aGroup) => {
    // Not in the catalogue: the feed always has a real group name to
    // interpolate, so this fallback exists only for push.
    expect(pushCopy('group.added', locale, { actorName: 'Mai' }).body).toBe(
      render(locale, 'group.added', aGroup)
    );
  });

  it('gives a chat message the sender as its title and their words as body', () => {
    // The one type with no catalogue row: chat lives in its own surface and
    // never becomes an Activity line (Gate 3).
    expect(
      pushCopy('chat.message', 'vi', {
        actorName: 'Mai',
        preview: 'Ăn cơm chưa',
      })
    ).toEqual({ title: 'Mai', body: 'Ăn cơm chưa' });
  });

  it('routes an unknown or missing locale to English', () => {
    expect(toPushLocale('vi')).toBe('vi');
    expect(toPushLocale('en')).toBe('en');
    // preferred_locale is CHECKed to the two we ship, but a null column or a
    // future third locale must still send something.
    expect(toPushLocale(null)).toBe('en');
    expect(toPushLocale(undefined)).toBe('en');
    expect(toPushLocale('fr')).toBe('en');
  });
});
