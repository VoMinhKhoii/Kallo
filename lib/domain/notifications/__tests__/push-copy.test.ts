// Push copy is rendered from the SAME `messages/{en,vi}/activity.json` rows the
// in-app feed uses, so there is deliberately no second copy of these sentences
// to assert against. What this suite pins is that the render is faithful: the
// expectations below are built by naively stripping the `<b>` markup out of the
// shipped catalogue string and substituting its placeholders, which is an
// independent path to the same answer. A wording change in the catalogue moves
// both sides at once — that is the point. What it CANNOT change silently is the
// shape: the singular row, the anonymous fallbacks, the chat exception.

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

/** The raw `row.<type>.one` template, straight out of the shipped file. */
function template(locale: PushLocale, type: string): string {
  const [head, tail] = type.split('.');
  const row = CATALOGUE[locale].row as Record<
    string,
    Record<string, { one: string }>
  >;
  return row[head][tail].one;
}

/** Render it the dumb way: drop the rich tag, substitute the placeholders. */
function render(
  locale: PushLocale,
  type: string,
  values: { name: string; group?: string }
): string {
  return template(locale, type)
    .replaceAll(/<\/?b>/g, '')
    .replaceAll('{name}', values.name)
    .replaceAll('{group}', values.group ?? '');
}

describe('pushCopy', () => {
  it.each([
    'en',
    'vi',
  ] as const)('renders every catalogue row verbatim in %s', (locale) => {
    for (const type of NOTIFICATION_TYPES) {
      const { title, body } = pushCopy(type, locale, {
        actorName: 'Mai',
        groupName: 'Trip',
      });
      // The app is the title for an activity notice — the body names the
      // actor, so the title must not repeat them.
      expect(title).toBe('Kallo');
      expect(body).toBe(render(locale, type, { name: 'Mai', group: 'Trip' }));
      // The markup belongs to the feed, never to a lock screen.
      expect(body).not.toContain('<b>');
    }
  });

  it('always sends the SINGULAR row, even for an aggregating type', () => {
    // A push says "someone did a thing"; "and 4 others" is the badge's and the
    // Activity row's job, and the collapse key means the later notice replaces
    // the earlier one anyway. There is no way to ask pushCopy for `.other`.
    const { body } = pushCopy('share.reaction', 'en', { actorName: 'Mai' });
    expect(body).toBe(render('en', 'share.reaction', { name: 'Mai' }));
    expect(body).not.toContain('other');
  });

  it.each([
    'en',
    'vi',
  ] as const)('falls back to the catalogue’s own anonymous label in %s', (locale) => {
    const someone = CATALOGUE[locale].someone;
    expect(pushCopy('friend.joined', locale, {}).body).toBe(
      render(locale, 'friend.joined', { name: someone })
    );
    // A blank or whitespace name is as good as no name.
    expect(pushCopy('friend.joined', locale, { actorName: '  ' }).body).toBe(
      render(locale, 'friend.joined', { name: someone })
    );
  });

  it.each([
    ['en', 'a group'],
    ['vi', 'một nhóm'],
  ] as const)('names a nameless group in %s rather than leaving a hole', (locale, aGroup) => {
    // Not in the catalogue: the feed always has a real group name to
    // interpolate, so this fallback exists only for push.
    expect(pushCopy('group.added', locale, { actorName: 'Mai' }).body).toBe(
      render(locale, 'group.added', { name: 'Mai', group: aGroup })
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
