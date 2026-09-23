/**
 * What Sentry may send, enforced at the last hop: every payload passes one of
 * these before it leaves the process, in every runtime (browser, Node, Edge).
 *
 * The privacy policy treats meal text and body metrics as sensitive personal
 * data, and query strings / path segments carry tokens and identifiers, so:
 *   • request bodies, cookies, headers and query strings never leave;
 *   • a user is reduced to the opaque account id;
 *   • every URL — the request, tags, breadcrumbs, span attributes, span and
 *     transaction names — is reduced by `telemetryUrl` (origin + route
 *     template);
 *   • console and ui (click / input) breadcrumbs are dropped outright.
 */
import { telemetryUrl } from '@/lib/infra/telemetry/telemetry-url';

type Data = Record<string, unknown>;

/** Attribute / tag keys that hold a URL or path, by name shape. */
const URL_KEY = /(?:^|[._])(?:url|full|target|path|from|to)$/i;
/** Attribute keys that hold a raw query string or fragment: dropped. */
const QUERY_KEY = /(?:^|[._])(?:query|fragment)$/i;

/** Rewrites URL-shaped values and drops query/fragment keys, in place. */
function scrubUrlData(data: Data | undefined): void {
  if (!data) return;
  for (const [key, value] of Object.entries(data)) {
    if (QUERY_KEY.test(key)) delete data[key];
    else if (URL_KEY.test(key) && typeof value === 'string') {
      data[key] = telemetryUrl(value);
    }
  }
}

/** Every URL or path token inside a free-text name: `GET /en/invite/abc`. */
const URL_TOKEN = /https?:\/\/\S+|\/\S*/g;
const scrubName = (name: string) => name.replace(URL_TOKEN, telemetryUrl);

/** The subset of a Sentry event the scrubbers touch. */
interface ScrubbableEvent {
  request?: {
    url?: string;
    data?: unknown;
    cookies?: unknown;
    headers?: unknown;
    query_string?: unknown;
  };
  user?: { id?: string | number } & Data;
  tags?: Data;
  contexts?: Record<string, Data | undefined>;
}

/** Error events (and the shared part of transactions). */
export function scrubEvent<T extends ScrubbableEvent>(event: T): T {
  if (event.request) {
    if (event.request.url) event.request.url = telemetryUrl(event.request.url);
    delete event.request.data;
    delete event.request.cookies;
    delete event.request.headers;
    delete event.request.query_string;
  }
  if (event.user) {
    event.user = event.user.id == null ? {} : { id: event.user.id };
  }
  scrubUrlData(event.tags);
  // Every context, not a known list: `captureRequestError` stores the raw
  // path as `contexts.nextjs.request_path`, and integrations add more.
  for (const context of Object.values(event.contexts ?? {})) {
    scrubUrlData(context);
  }
  return event;
}

interface ScrubbableSpan {
  op?: string;
  description?: string;
  data?: Data;
}

interface ScrubbableTransaction extends ScrubbableEvent {
  transaction?: string;
  contexts?: Record<string, Data | undefined> & { trace?: ScrubbableSpan };
  spans?: ScrubbableSpan[];
}

/**
 * Only spans whose NAME is a URL get their name rewritten: http client and
 * server spans, navigations, page loads and resource timings. A db span's
 * description is SQL, which a path-token rewrite would only mangle.
 */
const URL_NAMED_OP = /^(?:http|navigation|pageload|resource|next)/;

function scrubSpan(span: ScrubbableSpan): void {
  scrubUrlData(span.data);
  if (span.description && URL_NAMED_OP.test(span.op ?? '')) {
    span.description = scrubName(span.description);
  }
}

/**
 * Sampled transactions carry URLs in places an error event does not: the
 * transaction name (a raw path when Next cannot parameterise it), and span
 * attributes (`url.full`, `http.url`, `http.target`, `url.query`, …) and
 * descriptions (`GET https://…?token=…`).
 */
export function scrubTransaction<T extends ScrubbableTransaction>(event: T): T {
  scrubEvent(event);
  if (event.transaction) event.transaction = scrubName(event.transaction);
  if (event.contexts?.trace) scrubSpan(event.contexts.trace);
  for (const span of event.spans ?? []) scrubSpan(span);
  return event;
}

/** Breadcrumb data keys allowed through besides URLs — all non-free-text. */
const BREADCRUMB_SAFE_KEYS = new Set(['method', 'status_code', 'reason']);

interface ScrubbableBreadcrumb {
  category?: string;
  data?: Data;
}

/**
 * Breadcrumbs are the trail attached to the NEXT error, so they are scrubbed
 * as strictly as the error itself:
 *   • `console` breadcrumbs are dropped — the default Console integration
 *     stores every `console.*` call's raw arguments, and our logs (the
 *     analyze-meal pipeline above all) can carry meal text. The Flutter app
 *     drops its print breadcrumbs for the same reason;
 *   • `ui.*` breadcrumbs (click, input) are dropped — their message is the
 *     target's selector, which includes `aria-label`, and several controls
 *     interpolate meal names into theirs;
 *   • `data` is an allowlist: URLs reduced, a few status fields kept,
 *     anything else removed.
 */
export function scrubBreadcrumb<T extends ScrubbableBreadcrumb>(
  crumb: T
): T | null {
  if (crumb.category === 'console' || crumb.category?.startsWith('ui.')) {
    return null;
  }
  if (!crumb.data) return crumb;
  const data: Data = {};
  for (const [key, value] of Object.entries(crumb.data)) {
    if (URL_KEY.test(key) && typeof value === 'string') {
      data[key] = telemetryUrl(value);
    } else if (BREADCRUMB_SAFE_KEYS.has(key)) {
      data[key] = value;
    }
  }
  crumb.data = data;
  return crumb;
}
