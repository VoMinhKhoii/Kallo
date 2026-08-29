// ---------------------------------------------------------------------------
// Notifications — push copy (server-rendered, from the shipped catalogue)
// ---------------------------------------------------------------------------
// Push text is rendered on the SERVER, at send time, in the recipient's
// preferred locale — the device has no next-intl bundle and, for iOS, no
// chance to run code before the shade paints. It is rendered from the SAME
// `messages/{en,vi}/activity.json` rows the in-app feed uses, so a wording fix
// lands on the lock screen and in the Activity list together; there is no
// second copy of these sentences to drift.
//
// The lock-screen line is deliberately the SINGULAR row (`.one`) even when an
// aggregate is behind it: a push says "someone did a thing", the badge and the
// Activity row carry "and 4 others". Collapse keys mean the later notice
// replaces the earlier one anyway. The `<b>` around the actor name is markup
// for the feed, so it is rendered away here (`b: (chunks) => chunks`).

import { createTranslator } from 'next-intl';
import enActivity from '@/messages/en/activity.json';
import viActivity from '@/messages/vi/activity.json';
import type { NotificationType } from './types';

export type PushLocale = 'en' | 'vi';

/** Every event that can reach a device — the in-app catalogue plus the
 *  push-only chat message (Gate 3: push, never a row). */
export type PushCopyType = NotificationType | 'chat.message';

export interface PushCopyValues {
  /** Display name of whoever acted; falls back to the anonymous label. */
  actorName?: string;
  /** `group.added` deep-link context. */
  groupName?: string;
  /** `chat.message` body — already truncated by the caller. */
  preview?: string;
}

const APP_NAME = 'Kallo';

/** Not in the catalogue: the feed always has a real group name to interpolate,
 *  a push fired for a nameless group still has to say something. */
const A_GROUP: Record<PushLocale, string> = {
  en: 'a group',
  vi: 'một nhóm',
};

/** Both catalogues are typed off the English one, which the en/vi parity suite
 *  keeps honest. */
const CATALOGUE: Record<PushLocale, typeof enActivity> = {
  en: enActivity,
  vi: viActivity as typeof enActivity,
};

const translators = new Map<
  PushLocale,
  ReturnType<typeof createActivityTranslator>
>();

function createActivityTranslator(locale: PushLocale) {
  return createTranslator({
    locale,
    messages: { activity: CATALOGUE[locale] },
    namespace: 'activity',
  });
}

/** One translator per locale, built on first use and kept — `markup` (not
 *  `rich`) because the result must be a plain string for FCM, not a React tree.
 *  Lazy rather than module-scope so importing this module costs nothing: most
 *  of what reaches for `push.ts` never renders a line of copy. */
function translatorFor(locale: PushLocale) {
  const existing = translators.get(locale);
  if (existing) return existing;
  const created = createActivityTranslator(locale);
  translators.set(locale, created);
  return created;
}

/** Anything not 'vi' renders in English — preferred_locale is CHECKed to the
 *  two we ship, but a null column or a future third locale must still send. */
export function toPushLocale(preferred: string | null | undefined): PushLocale {
  return preferred === 'vi' ? 'vi' : 'en';
}

/**
 * The two strings that reach the lock screen. `title` is the app for activity
 * notices (the body already names the actor) and the SENDER for a chat message
 * (the body is their words), which is what makes a chat push read like a chat.
 */
export function pushCopy(
  type: PushCopyType,
  locale: PushLocale,
  values: PushCopyValues = {}
): { title: string; body: string } {
  const t = translatorFor(locale);
  const name = values.actorName?.trim() || t('someone');
  // A chat push is the message itself: the sender is the title, exactly as
  // every messaging app renders it. It has no catalogue row — chat lives in
  // its own surface and never becomes an Activity line.
  if (type === 'chat.message') {
    return { title: name, body: values.preview ?? '' };
  }
  const body = t.markup(`row.${type}.one`, {
    name,
    group: values.groupName ?? A_GROUP[locale],
    b: (chunks) => chunks,
  });
  return { title: APP_NAME, body };
}
