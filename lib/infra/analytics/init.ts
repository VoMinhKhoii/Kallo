import posthog, { type CaptureResult } from 'posthog-js';
import { routePattern, sanitizeUrl } from './route-pattern';

/**
 * PostHog, EU cloud. OFF unless `NEXT_PUBLIC_POSTHOG_KEY` was set at build
 * time; without it `posthog.init` never runs and every `track` call is a no-op.
 *
 * Deliberately narrow:
 *   • no autocapture — only the typed events in `events.ts` are sent, so no
 *     click on a meal row can ship its text;
 *   • no session recording, heatmaps or surveys;
 *   • person profiles only for signed-in users;
 *   • every URL property is reduced to origin + route pattern (`before_send`).
 */
export const POSTHOG_HOST = 'https://eu.i.posthog.com';

const URL_PROPERTIES = [
  '$current_url',
  '$referrer',
  '$initial_current_url',
  '$initial_referrer',
  '$prev_pageview_url',
] as const;
const PATH_PROPERTIES = ['$pathname', '$prev_pageview_pathname'] as const;

type Props = Record<string, unknown> | undefined;

function sanitizeProps(props: Props, origin: string): void {
  if (!props) return;
  for (const key of URL_PROPERTIES) {
    if (typeof props[key] === 'string') {
      props[key] = sanitizeUrl(props[key] as string, origin);
    }
  }
  for (const key of PATH_PROPERTIES) {
    if (typeof props[key] === 'string') {
      props[key] = routePattern(props[key] as string);
    }
  }
}

/** Exported for tests: strips identifiers out of every URL-shaped property. */
export function sanitizeCapture(
  event: CaptureResult | null,
  origin: string
): CaptureResult | null {
  if (!event) return event;
  sanitizeProps(event.properties, origin);
  sanitizeProps(event.$set as Props, origin);
  sanitizeProps(event.$set_once as Props, origin);
  return event;
}

export function analyticsEnabled(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_POSTHOG_KEY);
}

export function initAnalytics(): void {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key || typeof window === 'undefined') return;

  const origin = window.location.origin;
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
    before_send: (event) => sanitizeCapture(event, origin),
  });
  posthog.register({ app_version: process.env.NEXT_PUBLIC_APP_VERSION });
}
