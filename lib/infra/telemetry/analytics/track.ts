import posthog from 'posthog-js';
import type { AnalyticsEventName, AnalyticsEvents } from './events';
import { analyticsEnabled } from './init';

/**
 * The only way app code talks to PostHog. Every function is a no-op when
 * analytics is off (no key), so callsites never branch on it.
 */
export function track<E extends AnalyticsEventName>(
  event: E,
  properties: AnalyticsEvents[E]
): void {
  if (!analyticsEnabled()) return;
  posthog.capture(event, properties);
}

/** A `$pageview` for the current URL (`before_send` reduces it). */
export function trackPageview(): void {
  if (!analyticsEnabled()) return;
  posthog.capture('$pageview');
}

/** Tie this browser to the signed-in account (opaque Supabase user id only). */
export function identifyUser(userId: string): void {
  if (!analyticsEnabled()) return;
  if (posthog.get_distinct_id() === userId) return;
  posthog.identify(userId);
}

/**
 * No session: forget any account this browser was identified as, so the next
 * person on it starts anonymous. Checked rather than unconditional because it
 * runs on every signed-out page load, and resetting an ANONYMOUS visitor would
 * mint a fresh id each time and count one person as many. Covers both a
 * sign-out in this tab and one that happened elsewhere (account deletion's
 * server-side sign-out, another tab).
 */
export function resetUser(): void {
  if (!analyticsEnabled()) return;
  if (posthog._isIdentified()) posthog.reset();
}
