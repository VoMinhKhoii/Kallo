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

`lib/` currently honours this: it imports nothing from `components/` or `hooks/`. `hooks/` does
not yet — see the `logging` row below.

---

## `lib/` — domain, data, infrastructure

| Folder | Concern | Status |
|---|---|---|
| `account-deletion/` | queued account-deletion jobs and their retry | ok |
| `actions/` | Server Actions — orchestration over domain modules | split |
| `admin/` | admin authorization **and** admin read queries | split |
| `ai/` | everything that talks to an LLM provider | split |
| `ai/matching/` | retrieval, ranking and aliasing of food candidates | split |
| `ai/pipeline/` | the meal-analysis pipeline | split |
| `ai/pipeline/estimator/` | provider-agnostic grounded-estimation seam | **reference shape** |
| `ai/portion/` | gram anchors from portion evidence | split |
| `ai/prompts/` | prompt text and its builders | split |
| `ai/streaming/` | SSE event encoding and parsing | ok |
| `api/` | the `/api/v1` wire edge: auth guard, respond, query parse, client fetch | ok |
| `api/contracts/` | Zod wire contracts shared by web and mobile | split |
| `async/` | concurrency primitives — bounding a slow operation, zero domain knowledge | ok |
| `auth/` | session/profile guard, redirect and next-param safety | split |
| `barcode/` | Open Food Facts lookup and decode | ok |
| `billing/` | RevenueCat purchase side | split |
| `brand/` | brand constants | ok |
| `chat-groups/` | chat-group client transport | split |
| `cheat/` | cheat-meal slider math | ok |
| `dashboard/` | dashboard aggregations | ok |
| `date/` | local-day and timezone math — the only place it may live | ok |
| `db/` | Drizzle schema and client | ok |
| `docs/` | in-app docs loader, toc, nav, search | ok |
| `email/` | transactional send + templates | ok |
| `entitlements/` | entitlement grants and reconciliation | split |
| `errors/` | the error taxonomy and its two edges — HTTP response, browser parse | ok |
| `groups/` | social circle: feed, identity, visibility, transport | split |
| `i18n/` | root-locale resolution | ok |
| `logging/` | meal logging domain + relog | ok |
| `meals/` | dish quantity edits and the macro rescaling they imply | ok |
| `nutrition/` | nutrition overview, catalog, pattern analysis | ok |
| `onboarding/` | onboarding steps, schemas, TDEE, country data | split |
| `platform/` | runtime environment detection (webview, OS) from the user agent | ok |
| `rate-limit/` | analysis abuse guards | split |
| `security/` | webhook signatures **and** CSP **and** request IP | split |
| `seo/` | canonical origin, structured data, open-graph | ok |
| `sidebar/` | sidebar cookie state | ok |
| `supabase/` | client factories (browser, server, admin, middleware) | **reference shape** |
| `text/` | string shaping for display and input parsing — no domain knowledge | ok |
| `types/` | cross-cutting DTOs | split |
| `ui/` | the Tailwind class-merge helper — the only `lib/` folder that knows about styling | ok |
| `uploads/` | image and avatar file handling | ok |
| `validation/` | Zod request schemas — primitives plus one file per domain | ok |
| `waitlist/` | waitlist signup, confirm, token | ok |

## `components/` — presentation

| Folder | Concern | Status |
|---|---|---|
| `ui/` | shadcn primitives — CLI-managed, never hand-edited | exempt |
| `brand/` | logo marks | ok |
| `app/` | application chrome present on every page | split |
| `auth/` | auth dialog, forms, OAuth edge cases | split |
| `billing/` | paywall and subscription UI | split |
| `dashboard/` | dashboard sections and charts | split |
| `design-system/` | style-guide showcase — a dev tool, not product UI | split |
| `docs/` | MDX docs chrome | ok |
| `groups/` | circle shell, feeds, sharing, friends | split |
| `landing-page/` | marketing page | split |
| `logging/` | meal logging surface | split |
| `nutrition/` | nutrition page — primitives/rows/sections/states | **reference shape** |
| `onboarding/` | onboarding wizard and screens | split |
| `providers/` | TanStack provider (single file) | split |
| `settings/` | settings page chrome and panels | split |
| `shared/` | cross-feature UI atoms | split |

## `hooks/` — client state

| Folder | Concern | Status |
|---|---|---|
| `auth/` · `billing/` · `dashboard/` · `profile/` · `weight/` | one feature's client state each | ok |
| `landing/` | one hook | split |
| `meals/` | meal lifecycle — six concerns, two non-hooks | split |
| `meals/relog/` | relog composer state | **reference shape** |
| `social/` | circle **and** meal sharing | split |
| `ui/` | device and browser-surface hooks, zero domain knowledge | ok |

## `app/` — routes

| Folder | Concern | Status |
|---|---|---|
| `[locale]/(app)/` | authenticated pages, thin compositions | ok |
| `[locale]/(app)/admin/` | admin surface — holds a full feature module in `_components/` | split |
| `api/v1/` | public REST surface — thin delegators to `lib/` | ok |
| `api/analyze-meal/` | SSE meal-analysis stream | split |
| `api/webhooks/` | inbound provider webhooks | split |
| `api/og/` | Satori-rendered share cards | split |
| `auth/` | OAuth callback and verify routes | ok |

## `apps/mobile-flutter/lib/` — Flutter

| Folder | Concern | Status |
|---|---|---|
| `theme/` | design tokens | **reference shape** |
| `models/` | DTOs mirrored from the web contracts | split |
| `data/` | named "static data", actually HTTP, analytics, env, session, billing | split |
| `services/` | Supabase client (single file) | split |
| `shared/widgets/` | cross-feature widget primitives | split |
| `shell/` | app scaffold: header **and** sidebar | split |
| `features/<f>/` | one product surface each — auth, circle, dashboard, feedback, logging, nutrition, onboarding, paywall, settings | split |

Within a feature: `screens/` (routed pages) · `widgets/` (presentation) · `logic/` (pure
functions) · `data/` (providers and static tables) · `providers/` (Riverpod wiring).

## Supporting trees

| Folder | Concern | Status |
|---|---|---|
| `scripts/ci/check-structure/` | the structure gate itself | ok |
| `scripts/cloud-run/` | Cloud Run deploy and smoke checks | ok |
| `scripts/translate-usda-vietnamese/` | phased vi translation pipeline | ok |
| `scripts/eval/` | pipeline eval harness (+ gitignored `*.local.ts` experiments) | split |
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
