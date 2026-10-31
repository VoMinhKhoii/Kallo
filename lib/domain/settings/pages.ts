/**
 * The settings dialog's pages and the URL contract that opens it. Settings is
 * a dialog over whatever app page is showing, not a route: `?settings=<page>`
 * opens it on that page, and `?settings=` (no page) opens it on the default
 * page on desktop and on the page list on phones.
 *
 * In `lib/` because three layers agree on these ids — the dialog renders them,
 * the URL hook parses them, and `useProfileForm` jumps to the page holding the
 * first invalid field.
 */
export const SETTINGS_PARAM = 'settings';

export const SETTINGS_PAGES = [
  'profile',
  'body',
  'preferences',
  'cooking',
  'privacy',
  'plan',
  'account',
  'feedback',
] as const;

export type SettingsPageId = (typeof SETTINGS_PAGES)[number];

/** The page desktop opens on when the URL names none. */
export const DEFAULT_SETTINGS_PAGE: SettingsPageId = 'profile';

/**
 * The rail's groups, top to bottom. Groups are told apart by space alone, no
 * labels; the pinned page sits at the rail's foot, away from Delete account.
 */
export const SETTINGS_GROUPS: readonly (readonly SettingsPageId[])[] = [
  ['profile', 'body'],
  ['preferences', 'cooking', 'privacy'],
  ['plan', 'account'],
];
export const PINNED_SETTINGS_PAGE: SettingsPageId = 'feedback';

/** Pages that edit the profile row, hidden until onboarding creates it. */
const PROFILE_ONLY_PAGES: ReadonlySet<SettingsPageId> = new Set([
  'body',
  'cooking',
]);

export function isSettingsPageVisible(
  page: SettingsPageId,
  hasProfile: boolean
): boolean {
  return hasProfile || !PROFILE_ONLY_PAGES.has(page);
}

export function parseSettingsPage(raw: string | null): SettingsPageId | null {
  return SETTINGS_PAGES.find((page) => page === raw) ?? null;
}
