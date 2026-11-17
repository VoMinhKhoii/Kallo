/**
 * The public calculator pages, by slug, and where they live. Kept apart from
 * their copy so the proxy can tell a real tool page from a mistyped one
 * without loading any of it. Same slugs in every locale, so the English and
 * Vietnamese page for one tool pair as language alternates.
 */
export const TOOL_SLUGS = [
  'tdee-calculator',
  'calorie-deficit-calculator',
  'macro-calculator',
  'protein-calculator',
  'bmi-calculator',
] as const;

export type ToolSlug = (typeof TOOL_SLUGS)[number];

/**
 * The day the calculator pages' copy or links last changed in a way a reader
 * sees, for their sitemap date. Bump it with such a change, never on a deploy
 * alone.
 */
export const TOOL_PAGES_REVISED = '2026-11-05';

/** The locale-relative folder every tool page sits under. */
export const TOOLS_PREFIX = '/tools';

export function isToolSlug(slug: string): slug is ToolSlug {
  return (TOOL_SLUGS as readonly string[]).includes(slug);
}

/** A tool page's path without the locale: `/tools/<slug>`. */
export function toolPath(slug: ToolSlug): string {
  return `${TOOLS_PREFIX}/${slug}`;
}
