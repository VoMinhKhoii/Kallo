/**
 * Reduce a URL path from a CSP report to a route template before it is
 * logged.
 *
 * Stripping the query string is not enough: some Kallo URLs carry a
 * capability IN THE PATH. `/en/invite/<slug>` is the credential that resolves
 * and accepts a friend invite, `/en/circle/<shareId>` names a private share,
 * and other routes embed ids (`/circle/g/<groupId>`, `/admin/feedback/<id>`,
 * `/api/v1/meals/<mealId>`, …). A violation on any of those pages would copy
 * the value into the logs.
 *
 * So the rule is an allowlist, not a blocklist: a segment survives only if it
 * is a known static route word (below) or a build asset filename; everything
 * else becomes `:param`. A dynamic route added later is redacted by default;
 * a static route missing from the list merely logs as `:param` too, which is
 * the safe direction to be wrong in.
 */

/**
 * Static path segments of the app's own routes (the non-dynamic folder names
 * under `app/`), the locales, the Next asset prefix, and the handful of
 * third-party path words the policy allowlists (Supabase's REST/auth/realtime
 * prefixes, Google Identity's `gsi/client|style`). Words only — no ids.
 */
const STATIC_SEGMENTS = new Set([
  // Locales and Next assets.
  'en',
  'vi',
  '_next',
  'static',
  'chunks',
  'media',
  'css',
  'image',
  // app/ route folders.
  '.well-known',
  'oauth-protected-resource',
  'about',
  'accept',
  'accept-cheat',
  'account',
  'activity',
  'admin',
  'analyze-meal',
  'api',
  'app',
  'auth',
  'avatar',
  'badge',
  'barcode',
  'billing-config',
  'block',
  'callback',
  'candidates',
  'chat-groups',
  'cheat-occasions',
  'cheat-repeat',
  'circle',
  'complete',
  'confirm',
  'contact',
  'csp-report',
  'dashboard',
  'dates',
  'day',
  'debug',
  'design-system',
  'dismiss',
  'docs',
  'duplicate',
  'entitlements',
  'feed',
  'feedback',
  'friends',
  'g',
  'groups',
  'health',
  'healthz',
  'heatmap',
  'ingredients',
  'invite',
  'invites',
  'leave',
  'llms.txt',
  'log',
  'logging',
  'macro-card',
  'manual',
  'md',
  'meal-share',
  'meals',
  'members',
  'messages',
  'minimize',
  'name',
  'notifications',
  'nudge',
  'nutrition',
  'nutrition-label',
  'og',
  'onboarding',
  'openapi.json',
  'overview',
  'pending',
  'pricing',
  'privacy',
  'profile',
  'prompts',
  'push-tokens',
  'reaction',
  'read',
  'read-marker',
  'reconcile',
  'relog',
  'remove',
  'reply',
  'requests',
  'reset-password',
  'restore',
  'revenuecat',
  'scan',
  'screen',
  'screenshot',
  'search',
  'seen',
  'send-email',
  'settings',
  'shares',
  'sharing',
  'stage',
  'summary',
  'supabase-proxy',
  'terms',
  'v1',
  'verify',
  'waitlist',
  'webhooks',
  'weight',
  // Allowlisted third-party path words.
  'rest',
  'realtime',
  'storage',
  'object',
  'public',
  'token',
  'user',
  'gsi',
  'client',
  'style',
]);

/**
 * A build asset: a content-hashed chunk, stylesheet or font. Its name is a
 * hash of public code, never a credential, and it is what makes a script-src
 * report actionable.
 */
const ASSET_FILE = /^[\w.-]+\.(?:js|mjs|css|map|woff2?)$/;

function templateSegment(segment: string): string {
  if (segment === '') return segment;
  let decoded: string;
  try {
    decoded = decodeURIComponent(segment);
  } catch {
    return ':param';
  }
  const word = decoded.toLowerCase();
  if (STATIC_SEGMENTS.has(word)) return word;
  if (ASSET_FILE.test(decoded)) return decoded;
  return ':param';
}

/** `/en/invite/Ab3xYz` → `/en/invite/:param`. Query and fragment dropped. */
export function routeTemplate(pathname: string): string {
  return pathname.split(/[?#]/, 1)[0].split('/').map(templateSegment).join('/');
}
