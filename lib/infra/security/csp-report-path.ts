import {
  APP_METADATA_PATHS,
  APP_ROUTE_PATTERNS,
} from '@/lib/infra/security/app-route-patterns';

/**
 * Reduce a URL path from a CSP report to a route template before it is
 * logged.
 *
 * Stripping the query string is not enough: some Kallo URLs carry a
 * capability IN THE PATH. `/en/invite/<slug>` is the credential that resolves
 * and accepts a friend invite, `/en/circle/<shareId>` names a private share,
 * and other routes embed ids. A violation on any of those pages would copy
 * the value into the logs.
 *
 * Redaction is by POSITION in the real route tree, never by spelling. The
 * path is matched against `APP_ROUTE_PATTERNS` (every page and route handler
 * under `app/`, checked against the filesystem by a test), and whatever sits
 * in a `[param]` or `[...catchAll]` position becomes `:param` — so an invite
 * handle that happens to be `settings` is still redacted. Static positions
 * keep their literal word. An unknown or third-party path falls into the
 * `[locale]` / `[locale]/[...rest]` patterns, where every segment is dynamic,
 * so only its shape survives; the origin in front of it is the useful part.
 * A path matching no pattern at all is redacted whole to `/:redacted`.
 *
 * Two exceptions, both public by construction: a `[locale]` value that is one
 * of our locales, and a Next build asset under `/_next/static/`, whose
 * filename is a content hash of public code and is what makes a `script-src`
 * report actionable.
 */

const LOCALES = new Set(['en', 'vi']);
const REDACTED = '/:redacted';
const NEXT_ASSET =
  /^\/_next\/static\/(?:[\w.-]+\/)*[\w.-]+\.(?:js|mjs|css|map|woff2?)$/;
const METADATA = new Set<string>(APP_METADATA_PATHS);

type PatternSegment =
  | { kind: 'static'; value: string }
  | { kind: 'param'; name: string }
  | { kind: 'catchAll' };

function compile(pattern: string): PatternSegment[] {
  return pattern
    .split('/')
    .filter(Boolean)
    .map((segment): PatternSegment => {
      if (segment.startsWith('[...')) return { kind: 'catchAll' };
      if (segment.startsWith('[')) {
        return { kind: 'param', name: segment.slice(1, -1) };
      }
      return { kind: 'static', value: segment };
    });
}

const ROUTES = APP_ROUTE_PATTERNS.map(compile);

interface Match {
  template: string[];
  /** Literal segments matched: the most specific route wins, as in Next. */
  statics: number;
}

function matchRoute(route: PatternSegment[], path: string[]): Match | null {
  const template: string[] = [];
  let statics = 0;
  for (let i = 0; i < route.length; i++) {
    const segment = route[i];
    if (segment.kind === 'catchAll') {
      // `[...x]` needs at least one segment and swallows the rest.
      if (i >= path.length) return null;
      template.push(...path.slice(i).map(() => ':param'));
      return { template, statics };
    }
    if (i >= path.length) return null;
    if (segment.kind === 'static') {
      if (path[i] !== segment.value) return null;
      template.push(segment.value);
      statics++;
    } else {
      template.push(
        segment.name === 'locale' && LOCALES.has(path[i]) ? path[i] : ':param'
      );
    }
  }
  return route.length === path.length ? { template, statics } : null;
}

/** `/en/invite/settings?x=1` → `/en/invite/:param`. */
export function routeTemplate(pathname: string): string {
  const path = pathname.split(/[?#]/, 1)[0];
  if (NEXT_ASSET.test(path) || METADATA.has(path)) return path;

  const segments = path.split('/').filter(Boolean);
  let best: Match | null = null;
  for (const route of ROUTES) {
    const match = matchRoute(route, segments);
    if (match && (!best || match.statics > best.statics)) best = match;
  }
  return best ? `/${best.template.join('/')}` : REDACTED;
}
