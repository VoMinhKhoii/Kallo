// ---------------------------------------------------------------------------
// Notifications — push copy (server-side templates)
// ---------------------------------------------------------------------------
// Push text is rendered on the SERVER, at send time, in the recipient's
// preferred locale — the device has no next-intl bundle and, for iOS, no
// chance to run code before the shade paints. So these strings live here
// rather than in messages/*/activity.json: same voice, different consumer.
// (activity.json keeps the rich in-app rows, with their <b> markup and ICU
// plurals, and must not be restructured to feed this.)
//
// The lock-screen line is deliberately the SINGULAR sentence even when an
// aggregate is behind it: a push says "someone did a thing", the badge and the
// Activity row carry "and 4 others". Collapse keys mean the later notice
// replaces the earlier one anyway.

export type PushLocale = 'en' | 'vi';

/** Every event that can reach a device — the in-app catalog plus the
 *  push-only chat message (Gate 3: push, never a row). */
export type PushCopyType =
  | 'friend.joined'
  | 'group.added'
  | 'share.invite'
  | 'share.invite_accepted'
  | 'share.reaction'
  | 'share.reply'
  | 'share.logged'
  | 'chat.message';

export interface PushCopyValues {
  /** Display name of whoever acted; falls back to the anonymous label. */
  actorName?: string;
  /** `group.added` deep-link context. */
  groupName?: string;
  /** `chat.message` body — already truncated by the caller. */
  preview?: string;
}

const APP_NAME = 'Kallo';

const SOMEONE: Record<PushLocale, string> = {
  en: 'Someone',
  vi: 'Một người bạn',
};

const A_GROUP: Record<PushLocale, string> = {
  en: 'a group',
  vi: 'một nhóm',
};

type Template = (name: string, values: PushCopyValues) => string;

const BODIES: Record<PushCopyType, Record<PushLocale, Template>> = {
  'friend.joined': {
    en: (name) => `${name} joined your circle`,
    vi: (name) => `${name} đã tham gia vòng kết nối của bạn`,
  },
  'group.added': {
    en: (name, v) => `${name} added you to ${v.groupName ?? A_GROUP.en}`,
    vi: (name, v) => `${name} đã thêm bạn vào ${v.groupName ?? A_GROUP.vi}`,
  },
  'share.invite': {
    en: (name) => `${name} sent you a meal`,
    vi: (name) => `${name} đã gửi cho bạn một bữa ăn`,
  },
  'share.invite_accepted': {
    en: (name) => `${name} added your meal to their diary`,
    vi: (name) => `${name} đã thêm bữa ăn của bạn vào nhật ký`,
  },
  'share.reaction': {
    en: (name) => `${name} reacted to your meal`,
    vi: (name) => `${name} đã thích bữa ăn của bạn`,
  },
  'share.reply': {
    en: (name) => `${name} replied to your meal`,
    vi: (name) => `${name} đã phản hồi bữa ăn của bạn`,
  },
  'share.logged': {
    en: (name) => `${name} logged your meal`,
    vi: (name) => `${name} đã ghi lại bữa ăn của bạn`,
  },
  // A chat push is the message itself: the sender is the title, exactly as
  // every messaging app renders it. The body template is unused (see below).
  'chat.message': {
    en: (_name, v) => v.preview ?? '',
    vi: (_name, v) => v.preview ?? '',
  },
};

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
  const name = values.actorName?.trim() || SOMEONE[locale];
  if (type === 'chat.message') {
    return { title: name, body: values.preview ?? '' };
  }
  return { title: APP_NAME, body: BODIES[type][locale](name, values) };
}
