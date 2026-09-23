import posthog, { type CaptureResult } from 'posthog-js';
import { telemetryUrl } from '@/lib/infra/telemetry/telemetry-url';

/**
 * PostHog, EU cloud. OFF unless `NEXT_PUBLIC_POSTHOG_KEY` was set at build
 * time; without it `posthog.init` never runs and every `track` call is a no-op.
 *
 * Deliberately narrow:
 *   • no autocapture — only the typed events in `events.ts` are sent, so no
 *     click on a meal row can ship its text;
 *   • no session recording, heatmaps or surveys;
 *   • person profiles only for signed-in users;
 *   • every URL property is reduced to origin + route template (`before_send`).
 */
export const POSTHOG_HOST = 'https://eu.i.posthog.com';

/**
 * A property holding a URL or a path, matched by NAME SHAPE rather than a
 * fixed list: PostHog derives new keys from existing ones (`$initial_*`,
 * `$prev_pageview_*`, and `$session_entry_url` / `_referrer` / `_pathname`,
 * built at runtime from the first pageview), so an allowlist of names goes
 * stale silently while this does not.
 */
const URL_PROPERTY = /(?:url|referrer|pathname)$/i;

type Props = Record<string, unknown> | undefined;

function sanitizeProps(props: Props): void {
  if (!props) return;
  for (const [key, value] of Object.entries(props)) {
    if (URL_PROPERTY.test(key) && typeof value === 'string') {
      props[key] = telemetryUrl(value);
    }
  }
}

/** Exported for tests: strips identifiers out of every URL-shaped property. */
export function sanitizeCapture(
  event: CaptureResult | null
): CaptureResult | null {
  if (!event) return event;
  sanitizeProps(event.properties);
  sanitizeProps(event.$set);
  sanitizeProps(event.$set_once);
  return event;
}

export function analyticsEnabled(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_POSTHOG_KEY);
}

export function initAnalytics(): void {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key || typeof window === 'undefined') return;

  posthog.init(key, {
    api_host: POSTHOG_HOST,
    autocapture: false,
    // Off: PostHog's own first `$pageview` fires at init, under whatever
    // identity it persisted — before the auth session is known. Pageviews are
    // sent by `TelemetryIdentity` once identity is reconciled.
    capture_pageview: false,
    capture_pageleave: true,
    disable_session_recording: true,
    capture_heatmaps: false,
    capture_dead_clicks: false,
    disable_surveys: true,
    // Errors belong to Sentry; web vitals would spend event quota on
    // numbers Sentry's tracing already has. Both are also toggleable from the
    // PostHog dashboard, so pin them off here.
    capture_exceptions: false,
    capture_performance: false,
    // Never inject a PostHog-hosted <script> (recorder, surveys, toolbar):
    // everything we use is in the bundle.
    disable_external_dependency_loading: true,
    // No `/flags` requests. We use no feature flags, and that request carries
    // the stored initial person properties — the RAW first URL — straight to
    // PostHog without passing through `before_send`.
    advanced_disable_flags: true,
    person_profiles: 'identified_only',
    persistence: 'localStorage',
    before_send: sanitizeCapture,
  });
  posthog.register({ app_version: process.env.NEXT_PUBLIC_APP_VERSION });
}
