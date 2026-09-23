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

/** Every PostHog property that holds a URL or a path. */
const URL_PROPERTIES = [
  '$current_url',
  '$referrer',
  '$initial_current_url',
  '$initial_referrer',
  '$prev_pageview_url',
  '$pathname',
  '$prev_pageview_pathname',
] as const;

type Props = Record<string, unknown> | undefined;

function sanitizeProps(props: Props): void {
  if (!props) return;
  for (const key of URL_PROPERTIES) {
    const value = props[key];
    if (typeof value === 'string') props[key] = telemetryUrl(value);
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
    // App Router navigations are client-side; this hooks `history` so each
    // one is a `$pageview`, then `before_send` reduces its URL.
    capture_pageview: 'history_change',
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
    person_profiles: 'identified_only',
    persistence: 'localStorage',
    before_send: sanitizeCapture,
  });
  posthog.register({ app_version: process.env.NEXT_PUBLIC_APP_VERSION });
}
