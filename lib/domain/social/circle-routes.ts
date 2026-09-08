/**
 * The Circle's URL shapes, spelled once. Every hand-built `/circle/...`
 * string — feed rows, notification rows, the view switcher — went through its
 * own template literal, so a route change had to be found in four files.
 *
 * Ids are UUIDs on both sides (`shareThreadSchema` in
 * `lib/core/validation/social.ts` and every `groupId` in
 * `lib/core/validation/chat.ts` parse `uuidSchema`), so nothing here needs
 * `encodeURIComponent`: a UUID has no character a path segment reserves.
 *
 * These are locale-less internal paths — hand them to `Link` from
 * `@/i18n/navigation`, which prefixes the active locale.
 */

/** One post's own page: the meal, its whole thread, and the composer. */
export function circleThreadHref(shareId: string): string {
  return `/circle/${shareId}`;
}

/** One named group's feed. */
export function circleGroupHref(groupId: string): string {
  return `/circle/g/${groupId}`;
}
