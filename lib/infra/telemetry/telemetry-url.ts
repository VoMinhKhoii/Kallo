import { routeTemplate } from '@/lib/infra/route-template/route-template';

/**
 * The one rule for what a URL may look like once it leaves the app in a
 * telemetry payload — a PostHog event or a Sentry report / breadcrumb.
 *
 * Analytics needs "how many people opened an invite", not WHICH invite: an
 * invite slug, a shared-meal id or a group id is a capability or an
 * identifier, and query strings and hashes carry waitlist tokens and auth
 * codes. So a URL keeps its origin and its route TEMPLATE — the same
 * position-based redaction CSP reports use (`routeTemplate`), checked against
 * the route tree on disk, so a new `[param]` route is covered the day it is
 * added. A third-party path matches no route of ours and keeps only its shape.
 *
 *   • a relative path (`/vi/invite/abc?x=1`) → `/vi/invite/:param`;
 *   • an absolute http(s) URL → origin + template, no query or hash;
 *   • anything unparseable or not http(s) (`about:blank`, `data:`) → ''.
 */
export function telemetryUrl(value: string): string {
  if (value.startsWith('/')) return routeTemplate(value);
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return '';
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return '';
  return url.origin + routeTemplate(url.pathname);
}
