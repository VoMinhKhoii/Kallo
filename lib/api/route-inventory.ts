import type { RateLimitPolicyName } from '@/lib/infra/rate-limit/limiter/limiter';

/**
 * Anti-erosion coverage map: every route handler in the app, declaring how it is
 * protected. `route-inventory.test.ts` walks the route tree and fails CI when a
 * route is missing here (or listed here but gone from disk), so a new endpoint
 * cannot ship without a maintainer stating -- in one reviewed place -- its auth
 * posture, whether it bounds its request body, and what rate-limits it.
 *
 * It is a DECLARATION first: nothing here can prove a route is *correctly*
 * guarded, and its main value is the review gate -- a reviewer sees `none-cheap`
 * on a new expensive route and pushes back. Two claims ARE machine-checked
 * against the route source, because both were wrong somewhere before the check
 * existed: `bodyBound` must agree with whether the file bounds the body it
 * reads, and a named policy must actually be applied by the route or by the
 * `guardedIn` file it delegates to. See `route-inventory.test.ts`.
 *
 * Keyed by the route file's path relative to `app/` -- the whole `app/` tree,
 * not just `app/api/`: `/auth/verify`, `/auth/callback`, `/llms.txt`,
 * `/openapi.json`, `/.well-known/*` and `/md/*` are route handlers too, and
 * keying on `app/api/` was what let the two anonymous auth-link endpoints sit
 * outside the map (and outside any limit) unnoticed. Each value is the tuple
 * `[auth, bodyBound, rateLimit]`, optionally followed by `guardedIn`:
 *  - `auth`: `none` (anonymous), `session` (authenticated -- at the route or in
 *    the action/service it delegates to), `admin` (404s everyone else), or
 *    `webhook-sig` (signature-verified provider callback).
 *  - `bodyBound`: `true` when the body is read through a byte-capped reader
 *    (`readBoundedJson` / `readBoundedWebhookBody`) or an explicit
 *    content-length guard, rather than an unbounded `req.json()` / `formData()`
 *    / `readJsonBody()`.
 *  - `rateLimit`: a `RateLimitPolicyName` (the generic-limiter policy the
 *    mutating method carries), `analysis-guard` (the legacy per-user
 *    concurrency guard), `ocr-guard` (`withOcrGuard`), `auth-proxy` (the
 *    Supabase proxy's per-path policies), `webhook-sig` (guarded by signature,
 *    not a limit), or `none-cheap` (deliberately unlimited -- a cheap read or
 *    mutation; a new EXPENSIVE route here is what the review gate must catch).
 *  - `guardedIn`: the repo-relative file that carries the `assertRateLimit`
 *    call, for the routes that delegate to an action rather than limiting at
 *    the edge.
 */
export type RouteAuth = 'none' | 'session' | 'admin' | 'webhook-sig';

export type RouteRateLimit =
  | RateLimitPolicyName
  | 'analysis-guard'
  | 'ocr-guard'
  | 'auth-proxy'
  | 'webhook-sig'
  | 'none-cheap';

/** `[auth, bodyBound, rateLimit]`, plus `guardedIn` when the guard is not in
 *  the route file itself. */
export type RouteInventoryEntry =
  | readonly [RouteAuth, boolean, RouteRateLimit]
  | readonly [RouteAuth, boolean, RouteRateLimit, string];

export const routeInventory = {
  'api/[...unmatched]/route.ts': ['none', false, 'none-cheap'],
  'api/analyze-meal/debug/route.ts': ['admin', false, 'adminDebugAnalysis'],
  'api/analyze-meal/route.ts': ['session', false, 'analysis-guard'],
  'api/auth/send-email/route.ts': ['webhook-sig', true, 'webhook-sig'],
  'api/healthz/route.ts': ['none', false, 'healthzIp'],
  'api/og/macro-card/[shareId]/route.tsx': ['session', false, 'analysis-guard'],
  'api/supabase-proxy/[...path]/route.ts': ['none', true, 'auth-proxy'],
  'api/v1/account/billing-config/route.ts': ['session', false, 'none-cheap'],
  'api/v1/account/entitlements/reconcile/route.ts': [
    'session',
    false,
    'analysis-guard',
  ],
  'api/v1/account/entitlements/route.ts': ['session', false, 'none-cheap'],
  'api/v1/account/route.ts': ['session', false, 'none-cheap'],
  'api/v1/barcode/log/route.ts': ['session', false, 'none-cheap'],
  'api/v1/barcode/search/route.ts': ['session', false, 'barcodeSearch'],
  'api/v1/chat-groups/[groupId]/feed/route.ts': [
    'session',
    false,
    'none-cheap',
  ],
  'api/v1/chat-groups/[groupId]/leave/route.ts': [
    'session',
    false,
    'none-cheap',
  ],
  'api/v1/chat-groups/[groupId]/members/[userId]/route.ts': [
    'session',
    false,
    'none-cheap',
  ],
  'api/v1/chat-groups/[groupId]/members/route.ts': [
    'session',
    false,
    'none-cheap',
  ],
  'api/v1/chat-groups/[groupId]/messages/route.ts': [
    'session',
    false,
    'chatMessageSend',
    'lib/actions/chat-groups/messages.ts',
  ],
  'api/v1/chat-groups/[groupId]/route.ts': ['session', false, 'none-cheap'],
  'api/v1/chat-groups/route.ts': ['session', false, 'none-cheap'],
  'api/v1/dashboard/heatmap/route.ts': ['session', false, 'none-cheap'],
  'api/v1/dashboard/route.ts': ['session', false, 'none-cheap'],
  'api/v1/feedback/route.ts': ['session', false, 'none-cheap'],
  'api/v1/feedback/screenshot/route.ts': [
    'session',
    true,
    'feedbackScreenshot',
  ],
  'api/v1/groups/feed/route.ts': ['session', false, 'none-cheap'],
  'api/v1/groups/friends/block/route.ts': ['session', false, 'none-cheap'],
  'api/v1/groups/friends/feed/route.ts': ['session', false, 'none-cheap'],
  'api/v1/groups/friends/read-marker/route.ts': [
    'session',
    false,
    'none-cheap',
  ],
  'api/v1/groups/friends/remove/route.ts': ['session', false, 'none-cheap'],
  'api/v1/groups/friends/route.ts': ['session', false, 'none-cheap'],
  'api/v1/groups/invite/[slug]/route.ts': ['none', false, 'inviteLookupIp'],
  'api/v1/groups/invite/accept/route.ts': ['session', false, 'none-cheap'],
  'api/v1/groups/invites/accept/route.ts': ['session', false, 'none-cheap'],
  'api/v1/groups/invites/dismiss/route.ts': ['session', false, 'none-cheap'],
  'api/v1/groups/invites/route.ts': ['session', false, 'none-cheap'],
  'api/v1/groups/meal-share/route.ts': ['session', false, 'none-cheap'],
  'api/v1/groups/profile/avatar/route.ts': ['session', true, 'avatarUpload'],
  'api/v1/groups/profile/name/route.ts': ['session', false, 'none-cheap'],
  'api/v1/groups/profile/route.ts': ['session', false, 'none-cheap'],
  'api/v1/groups/shares/log/route.ts': ['session', false, 'none-cheap'],
  'api/v1/groups/shares/reaction/route.ts': [
    'session',
    false,
    'shareReaction',
    'lib/actions/meal-sharing/reactions.ts',
  ],
  'api/v1/groups/shares/reply/route.ts': [
    'session',
    false,
    'shareReply',
    'lib/actions/meal-sharing/replies.ts',
  ],
  'api/v1/groups/shares/route.ts': ['session', false, 'none-cheap'],
  'api/v1/ingredients/search/route.ts': ['session', false, 'none-cheap'],
  'api/v1/logging/day/route.ts': ['session', false, 'none-cheap'],
  'api/v1/meals/[mealId]/duplicate/route.ts': ['session', false, 'none-cheap'],
  'api/v1/meals/[mealId]/route.ts': ['session', false, 'none-cheap'],
  'api/v1/meals/cheat-occasions/route.ts': ['session', false, 'none-cheap'],
  'api/v1/meals/cheat-repeat/route.ts': ['session', false, 'none-cheap'],
  'api/v1/meals/confirm/route.ts': ['session', false, 'none-cheap'],
  'api/v1/meals/dates/route.ts': ['session', false, 'none-cheap'],
  'api/v1/meals/manual/route.ts': ['session', false, 'none-cheap'],
  'api/v1/meals/pending/[analysisId]/route.ts': [
    'session',
    false,
    'none-cheap',
  ],
  'api/v1/meals/pending/route.ts': ['session', false, 'none-cheap'],
  'api/v1/meals/relog/candidates/route.ts': [
    'session',
    false,
    'analysis-guard',
  ],
  'api/v1/meals/relog/route.ts': ['session', false, 'analysis-guard'],
  'api/v1/meals/relog/stage/route.ts': ['session', false, 'analysis-guard'],
  'api/v1/meals/route.ts': ['session', false, 'none-cheap'],
  'api/v1/notifications/badge/route.ts': ['session', false, 'none-cheap'],
  'api/v1/notifications/push-tokens/route.ts': ['session', false, 'none-cheap'],
  'api/v1/notifications/read/route.ts': ['session', false, 'none-cheap'],
  'api/v1/notifications/route.ts': ['session', false, 'none-cheap'],
  'api/v1/notifications/seen/route.ts': ['session', false, 'none-cheap'],
  'api/v1/nutrition-label/log/route.ts': ['session', false, 'none-cheap'],
  'api/v1/nutrition-label/scan/route.ts': ['session', true, 'ocr-guard'],
  'api/v1/nutrition/candidates/route.ts': [
    'session',
    false,
    'nutritionCandidates',
    'lib/domain/nutrition/actions/candidates.ts',
  ],
  'api/v1/nutrition/overview/route.ts': ['session', false, 'none-cheap'],
  'api/v1/onboarding/nudge/minimize/route.ts': ['session', false, 'none-cheap'],
  'api/v1/onboarding/nudge/restore/route.ts': ['session', false, 'none-cheap'],
  'api/v1/onboarding/profile/route.ts': ['session', false, 'none-cheap'],
  'api/v1/onboarding/screen/route.ts': ['session', false, 'none-cheap'],
  'api/v1/profile/route.ts': ['session', false, 'none-cheap'],
  'api/v1/profile/sharing/route.ts': ['session', false, 'none-cheap'],
  'api/v1/waitlist/confirm/route.ts': ['none', false, 'waitlistConfirmIp'],
  'api/v1/waitlist/route.ts': ['none', true, 'waitlistSignupIp'],
  'api/v1/weight/[loggedDate]/route.ts': ['session', false, 'none-cheap'],
  'api/v1/weight/route.ts': ['session', false, 'none-cheap'],
  'api/v1/weight/summary/route.ts': ['session', false, 'none-cheap'],
  'api/webhooks/revenuecat/route.ts': ['webhook-sig', true, 'webhook-sig'],
  // Route handlers outside `app/api` -- the ones the old `app/api`-only walk
  // could not see. The four static ones are rendered at build time and serve
  // bytes; the two auth-link endpoints are anonymous and call GoTrue.
  '.well-known/oauth-protected-resource/route.ts': [
    'none',
    false,
    'none-cheap',
  ],
  'auth/callback/route.ts': ['none', false, 'authLinkIp'],
  'auth/verify/route.ts': ['none', false, 'authLinkIp'],
  'llms.txt/route.ts': ['none', false, 'none-cheap'],
  'md/[locale]/[...slug]/route.ts': ['none', false, 'none-cheap'],
  'openapi.json/route.ts': ['none', false, 'none-cheap'],
} as const satisfies Record<string, RouteInventoryEntry>;
