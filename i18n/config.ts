export const locales = ['en', 'vi'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'en';

/**
 * The message namespaces, in the order they merge into one message object.
 *
 * One file per namespace under `messages/<locale>/`, because a single
 * 1800-line `messages/<locale>.json` is invisible to the structure gate (it
 * does not scan JSON) and unreviewable in a diff — en and vi had already
 * drifted apart by a line before this list existed.
 *
 * This list is the loader's contract, not a directory listing: `request.ts`
 * imports exactly these names, so a namespace file nobody added here is dead
 * weight and a name here with no file is a build error. `i18n/__tests__/
 * messages.test.ts` holds the two honest to each other, in both locales.
 *
 * Order is the order the original single file used. It has no runtime effect
 * — namespaces do not overlap — but it keeps the merged object's key order
 * byte-identical to what shipped before the split.
 */
export const namespaces = [
  'common',
  'nav',
  'metadata',
  'shared',
  'app',
  'nutrition',
  'onboarding',
  'auth',
  'landing',
  'dashboard',
  'logging',
  'groups',
  'settings',
  'errors',
  'validation',
  'billing',
  'docs',
] as const;

export type Namespace = (typeof namespaces)[number];
