/**
 * Every product event the web app sends, and the properties each may carry.
 *
 * One place, typed, so an event can't be misspelled at a callsite and so a
 * reviewer can see at a glance that no event carries meal text, body metrics
 * or anything else the privacy policy calls sensitive. Names match the Flutter
 * app (`apps/mobile-flutter/lib/services/analytics/analytics_events.dart`) so
 * one PostHog funnel covers both clients.
 */
export interface AnalyticsEvents {
  /** A meal was saved to the log. */
  meal_logged: { method: 'ai' | 'manual'; is_cheat?: boolean };
  /** The paywall was shown. */
  paywall_viewed: Record<string, never>;
  /** The user picked a package and checkout opened. */
  checkout_started: { package_id: string };
  /** Checkout finished and money moved (or is pending with the provider). */
  purchase_completed: {
    package_id: string;
    status: 'paid' | 'payment_pending';
  };
  /** Checkout threw (not a user cancel). */
  purchase_failed: { package_id: string };
}

export type AnalyticsEventName = keyof AnalyticsEvents;
