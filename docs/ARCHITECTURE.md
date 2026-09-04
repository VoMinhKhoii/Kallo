# Architecture — the module map

One line per folder, stating **the single concern it owns**. If you cannot state a folder's
concern in one line, it has more than one and needs splitting (AGENTS.md §5).

Read this before exploring the tree. It exists so an agent can locate the right folder without
grepping, and so a reviewer can tell at a glance when a change lands logic in the wrong layer.

**Status column:** `ok` = one concern, within limits · `split` = pending consolidation, more than
one concern or over the 10-entry cap · `exempt` = shape fixed by an external tool contract.

---

## Layers, top down

Dependencies point **downward only**. A violation of this ordering is an architecture bug, not a
style preference.

```
app/          routes and pages — orchestration only, no domain rules
components/   presentation — no data fetching, no domain math
hooks/        client state and queries — never imports from components/
lib/          domain, data, and infrastructure — imports from neither of the above
```

`lib/` honours this: it imports nothing from `components/` or `hooks/`. `hooks/` now honours it
too, with one deliberate exception: `hooks/auth/use-google-identity.ts` reads `useAuthDialog`
from `components/auth/auth-provider`. That import is a hook consuming the React context whose
provider owns it — state depending on state, not on presentation — and the context cannot move
to `hooks/` without `hooks/` exporting a non-hook value.

---

## `lib/` — domain, data, infrastructure

Twelve top-level entries, grouped by what a thing *is* rather than what feature it serves.
Dependencies run `core` <- `infra` <- `domain` <- `actions`/`api`; a domain module importing
another domain module is a smell worth a second look.

### `lib/core/` — primitives with zero domain knowledge

| Folder | Concern |
|---|---|
| `async/` | bounding a slow operation: deadline, timeout, bounded concurrency |
| `date/` | local-day and timezone math — the only place it may live, including `time-of-day.ts`, the morning→late-night buckets the empty-day prompt and the surface-state illustrations both read |
| `errors/` | the error taxonomy and its two edges: HTTP response, browser parse |
| `text/` | string shaping for display and input parsing |
| `types/` | cross-cutting DTOs |
| `ui/` | the Tailwind class-merge helper plus `loaders/` (the loader pool's SMIL sampling math, painters and registry) — the only `lib/` folder that knows about drawing |
| `validation/` | Zod request schemas: primitives plus one file per domain |

### `lib/infra/` — edges to the outside world

| Folder | Concern |
|---|---|
| `auth/` | session/profile guard, redirect and next-param safety |
| `db/` | Drizzle schema and client |
| `email/` | transactional send + templates |
| `platform/` | runtime environment detection from the user agent |
| `push/` | the native-push transport: the `PushSender` seam, the dependency-free FCM HTTP v1 sender, and the no-op used when `FCM_SERVICE_ACCOUNT_JSON` is unset |
| `rate-limit/` | the generic API limiter (`limiter/`: policies, keys, Postgres consume, failMode) plus the older concurrency-modelling analysis guards and the guard wrappers over them (`ocr-guard.ts`, `relog-guard.ts`) |
| `security/` | webhook signatures, CSP, request IP |
| `supabase/` | client factories (browser, server, admin, middleware) |
| `uploads/` | image and avatar file handling |

### `lib/domain/` — the product's nouns

| Folder | Concern |
|---|---|
| `account-deletion/` | queued deletion jobs and their retry |
| `barcode/` | Open Food Facts lookup and decode, plus `amount.ts` — the gram clamp, per-100g scaling and mode→grams resolution the quantity picker runs on |
| `billing/` | `revenuecat/` (the purchase side, incl. its `webhook/` intake), `entitlement/` (the grant side) and `activation/` (the browser's bounded recovery loops for a purchase the server has not projected); `entitlements-client.ts` is the browser's read of the contract |
| `cheat/` | cheat-meal slider math |
| `dashboard/` | dashboard aggregations |
| `docs/` | in-app docs loader, toc, nav, search |
| `ingredients/` | `search/` — the food-composition picker: recents, lexical + semantic arms, rank fusion |
| `logging/` | meal logging and relog, plus the contracts its UI and hooks share: `types.ts`, `meal-input-handle.ts`, `stream-ticker.ts` |
| `meals/` | dish quantity edits and the macro rescaling they imply, plus `save/` (the optimistic-meal builders and the cache choreography a save runs through) and `query-keys.ts`, the cache addresses that write side shares with `hooks/meals/` |
| `notifications/` | the activity layer's shared vocabulary: `types.ts`, `group-keys.ts` (the aggregation identities), `notify.ts` (the single write path producers call inside their tx), the isomorphic `contracts.ts`, the after-commit push fan-out (`push.ts` + its server-side `push-copy.ts` templates), plus `client.ts` and `query-keys.ts` |
| `nutrition/` | nutrition overview, catalog, pattern analysis, plus the OCR label contracts (`ocr-schema.ts`, `ocr-camera-types.ts`) its UI and hooks share |
| `onboarding/` | onboarding steps, schemas, TDEE, country data |
| `settings/` | the contracts the settings page's route, panels and hooks share: `anchors.ts` (scroll-target ids), `profile-form.ts` (the profile form's data model) |
| `social/` | `identity/` `feed/` `shares/` `chat/` — the circle and its group chats, plus `query-keys.ts`, the cache addresses its write side shares with `hooks/social/` |
| `waitlist/` | signup, confirm, token |

### `lib/` root

| Folder | Concern |
|---|---|
| `ai/` | everything that talks to an LLM — see its own section below |
| `actions/` | Server Actions, grouped by the surface they serve |
| `api/` | route-handler plumbing: auth guard, respond, query parse, client fetch |
| `admin/` | the admin plane's logic — see its own section below |
| `brand/` · `i18n/` | small single-concern modules |
| `sidebar/` | the rail's cookie persistence, its vocabulary, and `state-machine.ts` — the pure 3-state FSM `useSidebarState` binds to |
| `seo/` | metadata and structured data, plus `og/` (the Satori share card's palette, geometry and fonts) |

### `lib/ai/`

| Folder | Concern | Status |
|---|---|---|
| `provider/` | the only folder allowed to touch an LLM SDK | ok |
| `types/` | the shared vocabulary, split by stage | ok |
| `cache/` | every pipeline cache in one place | ok |
| `prompts/` | `text/` (the strings) vs `build/` (the builders) | ok |
| `portion/` | `data/` (the tables) vs the resolver logic | ok |
| `matching/` | `retrieve/` `rank/` `alias/` | ok |
| `streaming/` | SSE event encoding and parsing | ok |
| `language/` | language detect + guard | ok |
| `pipeline/` | `contracts/ config/ grounded/ estimator/ resolve/ assemble/ stream/ telemetry/ legacy/` | ok |
| `pipeline/estimator/` | provider-agnostic Call-2 seam | **reference shape** |
| `pipeline/stream/` | the analyze-meal SSE state machine: cheat vs precise outcome, gates, staging | ok |

### `lib/admin/`

| Folder | Concern | Status |
|---|---|---|
| `authz/` | who counts as an admin, and the guard that enforces it | ok |
| `queries/` | the admin read side: requests, feedback, prompts, health | ok |
| `diagnostics/` | reading a pipeline trace — stage schemas, derived diagnostics, compare | ok |
| `replay/` | re-running a captured request, live or against captured responses | ok |
| `triage/` | moving a feedback row through its statuses | ok |

## `components/` — presentation

| Folder | Concern | Status |
|---|---|---|
| `ui/` | shadcn primitives — CLI-managed, never hand-edited | exempt |
| `activity/` | the Activity page — the notification feed, its sections, rows and the mobile heart entry point | ok |
| `admin/` | the admin surface — `requests/` `pipeline-summary/` `feedback/` `health/` `prompts/` | ok |
| `brand/` | logo marks | ok |
| `app/` | application chrome present on every page | split |
| `auth/` | auth dialog, forms, OAuth edge cases | split |
| `billing/` | `paywall/` (the offer surface), `subscription/` (manage the plan) and `activation/` (what shows while a purchase lands) | ok |
| `dashboard/` | dashboard sections and charts | split |
| `design-system/` | style-guide showcase — a dev tool, not product UI | split |
| `docs/` | MDX docs chrome | ok |
| `groups/` | circle shell, feeds, sharing, friends | split |
| `landing-page/` | marketing page | split |
| `logging/` | meal logging surface | split |
| `logging/input/` | every way to start a meal — `composer/` (the text composer, its mode switcher and send button), `manual/` (DB-backed ingredient rows), `barcode/` (the scanner dialog: camera, lookup, quantity), `ocr/` (`scan/` the label, `review/` what was read), `relog/` | ok |
| `nutrition/` | nutrition page — primitives/rows/sections/states | **reference shape** |
| `onboarding/` | onboarding wizard and screens | split |
| `providers/` | TanStack provider (single file) | split |
| `settings/` | `chrome/` (the page shell every panel renders into) plus one folder per panel — `account/` `feedback/` `identity/` `profile/` `sharing/` | ok |
| `shared/` | cross-feature UI atoms | split |
| `shared/surface-state/` | the one shape every empty, error, 404 and offline surface takes — illustration → title → subtitle → one action, plus its retry button | ok |

## `hooks/` — client state

| Folder | Concern | Status |
|---|---|---|
| `auth/` · `billing/` · `dashboard/` · `profile/` · `weight/` | one feature's client state each | ok |
| `meals/` | meal lifecycle, one folder per stage — a directory index, no direct files | ok |
| `meals/queries/` | the read-only TanStack wrappers: a day's meals, ingredient search, cheat chips, adjacent-date prefetch | ok |
| `meals/mutations/` | one file per write: confirm, manual save, update, duplicate, delete | ok |
| `meals/analysis/` | the SSE stream lifecycle and the two effects that ride it | ok |
| `meals/feed/` | the day-feed controller and its handler hooks | ok |
| `meals/entry/` | the non-streaming ways into the composer: manual rows, label OCR, dashboard prefill | ok |
| `meals/relog/` | relog composer state | **reference shape** |
| `notifications/` | the activity feed, its badge poll and the seen/read mutations | ok |
| `social/circle/` | friends, thread feed, circle wall, invites, group chats | ok |
| `social/sharing/` | sharing a meal, logging a shared one, invites, replies, reactions | ok |
| `ui/` | device and browser-surface hooks, plus the nav chrome's cross-surface state (sidebar open/collapse, badge counts); `use-is-late-night.ts` is the hydration-safe read of the viewer's clock the surface states pose from | ok |

`hooks/auth/` also owns the landing page's waitlist signup — the pre-account end
of the same "getting into the product" concern, folded in when `hooks/landing/`
proved to be one hook.

## `app/` — routes

| Folder | Concern | Status |
|---|---|---|
| `[locale]/(app)/` | authenticated pages, thin compositions | ok |
| `[locale]/(app)/admin/` | admin pages — thin compositions over `components/admin/` and `lib/admin/` | ok |
| `api/v1/` | public REST surface — thin delegators to `lib/` | ok |
| `api/analyze-meal/` | SSE meal-analysis stream — the machine is `lib/ai/pipeline/stream/`; `_lib/` holds the pre-stream guards | ok |
| `api/webhooks/` | inbound provider webhooks — thin delegators to `lib/` | ok |
| `api/og/` | Satori-rendered share cards — card in `_components/`, tokens in `lib/seo/og/` | ok |
| `auth/` | OAuth callback and verify routes | ok |

## `apps/mobile-flutter/lib/` — Flutter

| Folder | Concern | Status |
|---|---|---|
| `theme/` | design tokens | **reference shape** |
| `models/` | DTOs mirrored from the web contracts, grouped by domain: `nutrition/` `logging/` `social/` `profile/` | ok |
| `services/` | infrastructure edges: `http/` (API client, uploads, cache policy) · `auth/` (Supabase client, session) · `billing/` · `analytics/` · `env/` | ok |
| `shared/widgets/` | cross-feature widget primitives, one folder per primitive: `avatar/` `brand/` `calorie_ring/` `feedback/` (skeleton, empty, refresh, progress) `form/` `motion/` `sheet/` `surface/` (the screen frame, the card/button, the scroll hairline) `toast/` `typography/` | ok |
| `shared/logic/` | pure functions more than one feature reads — `tdee.dart`, `display_format.dart` | ok |
| `shared/data/` | static tables more than one feature reads — `countries.dart` | ok |
| `shell/` | app scaffold and navigation: `header/` `sidebar/`, plus the two routed surfaces the shell itself owns (`tab_scaffold.dart`, `placeholder_screen.dart`) | ok |
| `features/circle/widgets/` | `invite/` `groups/` `feed/` `share/` `states/` | ok |
| `features/dashboard/widgets/` | `today/` `weight/` `heatmap/` `chrome/` `states/` | ok |
| `features/nutrition/widgets/` | `summary/` `charts/` `nutrients/` `scope/` `states/` | ok |
| `features/settings/widgets/` | `profile/` `list/` `account/` `inputs/` `chrome/` | ok |
| `features/<f>/` | one product surface each — auth, circle, dashboard, feedback, logging, nutrition, onboarding, paywall, settings | split |

There is no `lib/data/`. Everything that folder held was infrastructure, so it merged into
`services/`; no genuinely static table was left to justify keeping it.

`onboarding/` and `settings/` were a copy-paste fork of six files. The three where the copies
carried the same **data** — the TDEE maths, the constant tables it reads, and the country list —
are now single copies in `shared/`, with `test/shared/logic/tdee_test.dart` reading the web
TypeScript to keep the third copy honest. `option_strip` is one component with two skins. The
remaining three (`custom_select`, `country_select`, `aggression_slider`) are genuinely different
controls that happen to share a filename, not duplicates.

Within a feature: `screens/` (routed pages) · `widgets/` (presentation) · `logic/` (pure
functions and context helpers) · `data/` (providers and static tables) · `providers/` (Riverpod
wiring). Widget subfolders group by sub-concern — e.g. `settings/widgets/inputs/` (form
controls) and `settings/widgets/profile/` (the profile-form module). There is no `controls/` or
`panels/`: both held widgets, and naming them otherwise hid them from the 200-line widget
budget.

Two sub-concern names are shared vocabulary rather than per-feature invention. `states/` is a
surface's loading / error / empty views — circle, dashboard and nutrition all use it, matching
the web's `components/nutrition/states/`. `chrome/` is a surface's own furniture: the settings
tab's one top bar and its nested navigator, the dashboard's week strip, section labels and meal
FAB.

The Flutter tree has no barrels. `shared/widgets/widgets.dart` re-exported seven modules and hid
who depended on what — three of the seven had no direct importer left anywhere. A module may
re-export a file **in its own folder** (its public entry speaking for its internals); it may not
re-export another folder's module, which is what `card_skeletons.dart` and
`friend_list_skeleton.dart` were doing with `shared/widgets/feedback/skeleton.dart`.

## Supporting trees

| Folder | Concern | Status |
|---|---|---|
| `scripts/_lib/` | helpers shared by the scripts themselves | ok |
| `scripts/assets/` | brand and PWA asset generation | ok |
| `scripts/bench/` | latency harness plus KPI and baseline SQL rollups | ok |
| `scripts/ci/` | CI gates, including `check-structure/` — the structure gate itself | ok |
| `scripts/cloud-run/` | Cloud Run deploy and smoke checks | ok |
| `scripts/data/` | one-off data pipelines: `usda/`, `vtn_fct/`, `translate-usda-vietnamese/` | ok |
| `scripts/db/` | backfills and coverage probes run against a live database | ok |
| `scripts/dev/` | local developer conveniences | ok |
| `scripts/enrich/` | NIN food enrichment ingestion | ok |
| `scripts/eval/` | pipeline eval harness; `eval/local/` holds throwaway probes and the gitignored `*.local.ts` experiments | ok |
| `scripts/ops/` | scheduled and manual production operations | ok |
| `supabase/migrations/` | append-only SQL ledger — flat by CLI contract (§7) | exempt |
| `i18n/` + `messages/` | next-intl config and message catalogues | ok |
| `content/docs/{en,vi}/` | user-facing MDX documentation | ok |
| `docs/` | engineering runbooks | ok |
| `apps/docs/mobile/` | mobile-specific runbooks | ok |

---

## Enforcement

`bun check:structure` checks four rules: file size (400 hard / 200 component, 100–200 target),
folder size (≤10 direct entries), test placement (`__tests__/`), and barrel files. Size and
folder rules are ratcheted against `file-size-baseline.json`. Test-placement and barrel rules are
advisory until the consolidation stack lands, then `--strict` becomes the CI default.

Every `split` above is tracked work. When a folder reaches one concern, change its row here in
the same commit.
