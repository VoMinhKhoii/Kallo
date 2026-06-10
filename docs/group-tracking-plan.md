# Group Tracking — Build Plan

## Decision (winner + why)
**Winner: the Locket-style "Capture = Share" circle, anchored by an auto-generated 9:16 Macro Card.** Logging a meal is already the core habit; one post-save tap broadcasts that meal's text-rendered card to a ~20-person mutual circle, with a DB trigger handling fanout server-side. This wins because it adds zero friction to the text-first logging moat (sharing never precedes or blocks the parse), the Macro Card is the brand-distinct viral artifact that needs no camera, and pairwise RLS makes the disordered-eating harm vectors (leaderboards, calorie comparison, friends-of-friends) structurally impossible rather than merely disabled.

## MVP scope (in / explicitly out)
**In:** `public_profiles` (the handle/display-name leak fix) + RLS; `friendships` (symmetric, canonical-ordered) + RLS + add-by-@handle / request / accept / block / copy-link invite; `meal_shares` + additive `meals`/`meal_items` SELECT policies + `is_accepted_friend` / `is_active_coach_of` SECURITY DEFINER helpers; share toggle on `persisted-meal-card.tsx` (post-save only); ambient non-scrollable Circle home + nav entry + empty state; Macro Card OG route (`@vercel/og`, cached + rate-limited) + `navigator.share`; `circle_events` table + insert trigger consumed via TanStack `refetchInterval`; pure async business logic exposed as `/api/v1/groups/*`; both-directions RLS test suite as a merge gate.

**Schema-only / UI dark:** `coach_assignments` table + RLS + the dormant coach OR-branch in the meals policy; `circle_events.audience` + `coach_assignments.audience_id` reserved cohort seams.

**Explicitly OUT (do not build):** Weekly Wrapped recap card; coach console UI; named cohort/org container; Supabase Realtime subscriptions (poll only); real photos / Storage buckets (stay disabled); reactions table; soft-reciprocity blur; mobile (later parity follow-up against the same REST contract).

---

## Phase A — Data model & RLS

> Two-domain flow per migration: Domain A = additive Drizzle DDL in `lib/db/schema.ts` then `bun run db:generate`; Domain B = hand-authored RLS/triggers/functions via `supabase migration new`. Append-only invariant (no DROP/RENAME/ALTER TYPE): all new columns NULLABLE with safe defaults, CHECK lists pre-widened with reserved values. uuid PKs `default gen_random_uuid()`, reuse `handle_updated_at()`.

**A1. Install `citext` extension (Domain B).**
`supabase migration new enable_citext` → `CREATE EXTENSION IF NOT EXISTS citext WITH SCHEMA extensions;` (mirrors the `vector`/`pg_trgm`/`unaccent` pattern — extensions live in the `extensions` schema, not `public`).
*Verify:* migration applies cleanly under `bun run dbr:reset:nobackfill`; `SELECT 'A'::extensions.citext = 'a'::extensions.citext;` returns `t`.

**A2. Add `public_profiles` to `lib/db/schema.ts` (Domain A).**
`userId` uuid PK → `authUsers.id` cascade; `handle` `extensions.citext` UNIQUE; `displayName` text; `avatarSeed` text; `createdAt`/`updatedAt`. Do NOT touch `userProfiles` (it co-locates `weightKg`/`tdeeKcal`/`calorieTarget` under owner-only SELECT — the leak we are avoiding).
*Verify:* `bun run db:generate` emits one additive `CREATE TABLE public_profiles` migration, no ALTER on `user_profiles`.

**A3. Add `friendships` to schema (Domain A).**
`id` uuid PK; `userLow` uuid, `userHigh` uuid (both → authUsers cascade); `status` text default `'pending'`; `requestedBy` uuid; `createdAt`/`updatedAt`. Table constraints: `check(user_low < user_high)`, `unique(user_low, user_high)`, `check(status IN ('pending','accepted','blocked'))`.
*Verify:* generated DDL contains the `<` check + composite unique; `bun run db:generate` adds only a new table.

**A4. Add `meal_shares` to schema (Domain A).**
`id` uuid PK; `mealId` uuid → `meals.id` cascade; `actorId` uuid → authUsers; `visibility` text default `'private'` (`check IN ('private','circle','public')`); `sharedAt` timestamptz default now. Partial UNIQUE on `(meal_id)`.
*Verify:* generated migration; `meals` table itself is untouched (still private-by-default).

**A5. Add `coach_assignments` to schema (Domain A, schema-only).**
`id` uuid PK; `coachId`/`clientId` uuid → authUsers; `rank` text default `'primary'` (`check IN ('primary','secondary')`); `status` text default `'pending'` (`check IN ('pending','active','revoked')`); `audienceId` uuid NULL (reserved cohort seam); `createdAt`. Partial UNIQUE `(client_id) WHERE rank='primary' AND status='active'`.
*Verify:* generated migration includes the partial unique index.

**A6. Add `circle_events` to schema (Domain A).**
`id` uuid PK; `actorId` uuid; `audience` uuid NULL (the reserved group_id slot); `type` text (`check IN ('meal_shared','friend_request','friend_accepted','coach_nudge','streak_milestone','recap_ready')`); `refId` uuid; `createdAt`. Indexes `(audience, created_at desc)` and `(actor_id, created_at desc)`.
*Verify:* generated migration includes both indexes and the widened type CHECK.

**A7. SECURITY DEFINER RLS helpers (Domain B).**
`supabase migration new group_rls_helpers` — `public.is_accepted_friend(viewer uuid, owner uuid)` (EXISTS on friendships with `status='accepted'` and `user_low=least(...)`/`user_high=greatest(...)`) and `public.is_active_coach_of(coach uuid, client uuid)`. Both `LANGUAGE sql SECURITY DEFINER SET search_path = public` (the safe pattern from `handle_new_user` in migration `20260224100032`, avoids RLS recursion).
*Verify:* migration applies; manual `SELECT public.is_accepted_friend('00000000-...'::uuid, '00000000-...'::uuid)` returns `f` (no rows yet, no error).

**A8. RLS for `public_profiles` (Domain B).**
`supabase migration new public_profiles_rls` — enable RLS; SELECT to any authenticated user; INSERT/UPDATE only `WHERE user_id = auth.uid()`; attach `handle_updated_at` trigger.
*Verify:* applies cleanly; policies listed via `\d+ public_profiles` (4 incl. updated_at trigger).

**A9. RLS for `friendships` (Domain B).**
Enable RLS; SELECT/INSERT/UPDATE scoped to `auth.uid() IN (user_low, user_high)`; accept = UPDATE `status→'accepted'` only when `auth.uid() <> requested_by`; block path sets `status='blocked'`. Attach `handle_updated_at`.
*Verify:* applies; the accept policy USING/WITH CHECK references `requested_by`.

**A10. RLS for `meal_shares` (Domain B).**
Enable RLS; INSERT/UPDATE/DELETE only where `actor_id = auth.uid()` AND (WITH CHECK) the meal belongs to actor; SELECT where you are the actor OR `is_accepted_friend(auth.uid(), <owner>)` OR `is_active_coach_of(auth.uid(), <owner>)`.
*Verify:* applies; insert with a non-owned `meal_id` is rejected.

**A11. RLS for `coach_assignments` + `circle_events` (Domain B).**
`coach_assignments`: SELECT visible to the two parties only (no writes wired in MVP). `circle_events`: SELECT where `auth.uid()` is actor OR `is_accepted_friend(auth.uid(), actor_id)` OR `is_active_coach_of(auth.uid(), actor_id)`.
*Verify:* applies cleanly.

**A12. Additive `meals` + `meal_items` SELECT policies (Domain B).**
`supabase migration new circle_meal_visibility` — add (never modify the untouched `USING (auth.uid()=user_id)` from `20260228155945`):
- `"Circle friends can view shared meals"` on `meals` FOR SELECT USING `(EXISTS (SELECT 1 FROM meal_shares ms WHERE ms.meal_id=meals.id AND ms.visibility='circle' AND public.is_accepted_friend(auth.uid(), meals.user_id)) OR public.is_active_coach_of(auth.uid(), meals.user_id))`.
- Mirror on `meal_items` FOR SELECT USING `EXISTS (SELECT 1 FROM meals m WHERE m.id=meal_items.meal_id AND (<same predicate>))` — the visibility gate lives INSIDE the EXISTS so items never leak ahead of their parent.
- **No new policy on `body_weight_log`** — stays `auth.uid()=user_id` forever.
*Verify:* `\d meals` shows the original own-data policy plus the new one (policies OR'd, original unchanged).

**A13. `circle_events` insert trigger (Domain B).**
`supabase migration new circle_events_fanout` — AFTER INSERT trigger on `meal_shares`: when `visibility <> 'private'`, insert a `circle_events` row `{actor_id, audience=NULL, type='meal_shared', ref_id=<meal_shares.id>, created_at=now()}`. SECURITY DEFINER, pinned `search_path`. Fanout stays server-side.
*Verify:* manual insert of a `circle` meal_shares row produces exactly one `circle_events` row; a `private` row produces zero.

**A14. Run append-only + apply gate.**
`bun run dbr:reset:nobackfill` (or `dbr:push`) and `node scripts/check-append-only-migrations.mjs`.
*Verify:* migration check passes (no DROP/RENAME/ALTER TYPE); full reset applies all new migrations without error.

---

## Phase B — Backend (pure async fns + REST contract)

> Parity rule: all group business logic = **pure, dependency-light async functions** (no runtime VALUE imports Metro can't resolve), exposed as REST under `app/api/v1/groups/*` (greenfield — no `app/api/v1` exists). Web UI calls REST where practical. Route auth via `createClient()` + `supabase.auth.getUser()` (Bearer for mobile, cookie for web — already unified in `lib/supabase/server.ts`); errors via `serializeError()` from `lib/errors.ts`.

**B1. Reserved-handle blocklist + `orderedPair()` helper.**
`lib/groups/handles.ts` — const blocklist (`admin`, `nham`, `support`, `coach`, `system`, …) + handle validator (lowercase, regex, length). `lib/groups/friendship.ts` — pure `orderedPair(a, b) → { userLow, userHigh }` (the brief's vendor-copyable helper). No DB imports.
*Verify:* unit test `lib/groups/friendship.test.ts` asserts `orderedPair` is commutative and `userLow < userHigh`; reserved handles rejected.

**B2. Pure profile/friendship service functions.**
`lib/actions/groups.ts` — pure async fns taking a `db`/`supabase` handle: `upsertPublicProfile`, `searchByHandle(handle)`, `requestFriend(actorId, targetUserId)` (computes `orderedPair`, inserts `pending`, writes `friend_request` event), `acceptFriend(actorId, friendshipId)`, `blockFriend`, `listCircle(actorId)`. Zod-parse inputs (`lib/validation.ts` schemas); throw structured `AppError` from `lib/errors.ts`.
*Verify:* `bun test` for happy-path + invalid-input on each (mock db).

**B3. Friends REST routes.**
`app/api/v1/groups/friends/search/route.ts` (GET `?handle=`), `friends/request/route.ts` (POST), `friends/accept/route.ts` (POST), `friends/block/route.ts` (POST), `friends/route.ts` (GET list). Each: auth-guard → call B2 fn → `serializeError()` on failure. `export const runtime = 'nodejs'`.
*Verify:* `curl`/integration test hits `GET /api/v1/groups/friends/search?handle=x` returns 401 unauthenticated, 200 with array when authed.

**B4. meal_shares toggle service + REST.**
`lib/actions/group-members.ts` — pure `setMealShareVisibility(actorId, mealId, 'circle'|'private')` (upsert on the partial-unique `meal_id`; the DB trigger handles the event). REST `app/api/v1/groups/shares/route.ts` (POST `{mealId, visibility}`).
*Verify:* test: toggling to `circle` inserts/updates one `meal_shares` row; toggling to `private` flips it back; RLS rejects a non-owned `mealId`.

**B5. Circle feed service + REST.**
`listCircleFeed(actorId)` in `lib/actions/groups.ts` — returns **most-recent-shared meal per friend for today**, joined to `public_profiles` (handle/display_name/avatar_seed) and the meal's macro fields, ordered, deduped per friend. REST `app/api/v1/groups/feed/route.ts` (GET). Returns only what RLS already permits (no body weight, no joins to `user_profiles`).
*Verify:* test asserts the shape `{ friend: {handle, displayName, avatarSeed}, meal: {rawInput, caloriesKcal, proteinG, carbohydrateG, fatG, sharedAt} }[]`, one row per friend max.

**B6. Client hooks (TanStack).**
`hooks/use-circle-feed.ts` (`useQuery` + `refetchInterval` for the polling event spine; `staleTime 60s` already global in `components/providers/query-provider.tsx`), `hooks/use-friends.ts`, `hooks/use-share-meal.ts` (`useMutation`, invalidates feed). No websocket — Realtime is deferred, contract unchanged when it upgrades.
*Verify:* `bun run lint` + `bunx tsc --noEmit` clean; hooks call the REST routes from B3–B5.

---

## Phase C — Web UI surfaces

**C1. Nav entry.**
`components/app/nav-items.ts` — add `{ id: 'groups', href: '/groups', labelKey: 'groups', icon: Users2 }` (import `Users2` from lucide-react) **before** the `admin` entry. Add `"groups": "Groups"` / `"groups": "Nhóm"` under `app.mainSidebar` in `messages/en.json` and `messages/vi.json`.
*Verify:* "Groups" renders in `desktop-sidebar.tsx` and `mobile-nav.tsx` (both already map `visibleNavItems`); no missing-i18n console warning.

**C2. Circle home route + empty state.**
`app/[locale]/(app)/groups/page.tsx` + `components/groups/circle-wall.tsx`. Ambient, **non-scrollable**, most-recent-per-friend wall of today's shared Macro Cards. **Read-only, badge-free** clone of the `persisted-meal-card.tsx` aesthetic (timeline dot, Lora dish quote, collapsible macros) — no likes, no counts. Calm empty state (`components/groups/circle-empty.tsx`) so the solo tracker stays fully usable pre-invite.
*Verify:* `/groups` loads with the empty state when no friends; renders one card per friend when seeded; Lora/DM Sans + `--nham-surface`/`--nham-accent` tokens applied; no scroll container.

**C3. Add-friend sheet.**
`components/groups/add-friend-dialog.tsx` (shadcn `dialog`) — add-by-@handle search, incoming/outgoing request lists, block action, and a **copy-link invite** that fires a `sonner` toast. No email/push. Reserved-handle blocklist enforced via B1.
*Verify:* searching a handle hits `/friends/search`; request → accept round-trips and the friend appears in the wall on next poll; copy-link shows the toast.

**C4. Share affordance on the persisted card.**
`components/logging/feed/persisted-meal-card.tsx` — add a subtle "Share to circle" control that appears **ONLY on an already-saved entry** (this file renders persisted meals, never the text input), toggling `meal_shares.visibility` circle↔private via `use-share-meal`. The text parse is never preceded or blocked by it.
*Verify:* the control is absent at the logging text input; on a saved card, toggling on then off updates state and (after poll) the circle wall; no regression to existing card collapse behavior.

---

## Phase D — Image / shareable Macro Card

> Net-new: no `@vercel/og`/`next/og`/`satori` exists today. Fonts come from `next/font/google` only — **no font binaries are in the repo**, so the OG route must vendor Lora + DM Sans TTF/woff with the Vietnamese subset. ZERO Supabase Storage (buckets stay disabled).

**D1. Add `@vercel/og` + vendor fonts.**
`bun add @vercel/og`. Download Lora + DM Sans (Vietnamese subset) into `app/api/og/macro-card/_fonts/` (or `lib/og/fonts/`) and load via `fs.readFile` / import as ArrayBuffer.
*Verify:* `bun install` succeeds; **glyph-coverage smoke test** renders "bún chả" and confirms diacritics (`ú`, `ả`) are not tofu boxes.

**D2. Macro Card OG route.**
`app/api/og/macro-card/[shareId]/route.tsx` — `export const runtime = 'nodejs'` (Node, since it reads the DB), 9:16 render **from the saved TEXT meal** resolved via `shareId` (the `meal_shares.id`), RLS-gated read. Compose: dish name in **Lora** (diacritics preserved), bounded calorie number in **DM Sans** (`"760–845 kcal"`, never fake-precise), one **Flame calorie ring** (reuse `components/shared/calorie-ring.tsx` geometry — `VIEWBOX 100 / RADIUS 46`), three thin **macro bars** (reuse `components/shared/macro-bars.tsx` geometry) with units **written out** (`"P: 38g"`, never `"P 22%"`), `--nham-surface` cream bg, espresso text, tan accent, small nhẩm wordmark. Per-card warm dish-color swatch seeded from the same `avatar_seed` feeding the initials avatar.
*Verify:* `GET /api/og/macro-card/<shareId>` returns a 1080×1920 PNG; visual check shows ring + 3 written-out macro bars + Lora dish name; an unauthorized/unshared `shareId` returns 403/404 (RLS denies the read).

**D3. Cache + rate-limit.**
Set `Cache-Control: public, immutable, max-age=…` keyed per `shareId` (text is fixed once saved); add a lightweight per-user rate-limit on the route (it's CPU-heavy) reusing the existing analysis-rate-limit table/util pattern where practical.
*Verify:* second request for the same `shareId` is served from cache (immutable header present); burst requests get throttled.

**D4. OS-native share affordance.**
On the persisted card / Macro Card surface, a "Share" button calling `navigator.share` (net-new) with the card PNG URL; fallback to copy-link `sonner` toast where `navigator.share` is unavailable.
*Verify:* on a supporting browser the native share sheet opens; on an unsupporting one the copy-link toast fires.

---

## Phase E — Verification (merge gate)

**E1. Both-directions RLS test suite (mandatory gate).**
Introduce pgTAP (none exists yet): add `supabase/tests/groups_rls.sql` asserting — (a) accepted friend WITH a `circle` `meal_shares` row sees the meal; (b) accepted friend with NO share row sees ZERO (opt-in proven); (c) unrelated user sees ZERO across `meals` + `meal_items`; (d) active coach sees assigned client's shared meals, non-assigned coach sees ZERO, client→client sees ZERO; (e) any peer/coach query touching `body_weight_log` returns ZERO; (f) cross-user `public_profiles` SELECT returns handle/display_name but cross-user `user_profiles` SELECT of `weight_kg`/`tdee_kcal` returns ZERO.
*Verify:* `supabase test db` passes all assertions in both positive and negative directions.

**E2. Static gates.**
`bunx tsc --noEmit` (typecheck), `bun run lint`, `node scripts/check-append-only-migrations.mjs`, `bun run test` (vitest — unit tests from B1/B2/B4/B5 + the D1 glyph smoke test), `bun run build`.
*Verify:* all green.

**E3. Manual dogfood (`/browse`).**
Two seeded accounts: A logs a meal → shares to circle → B sees exactly one card on `/groups` after a poll cycle; B has not shared and (with blur deferred) still sees A's card; unshare removes it; Macro Card PNG renders with diacritics; no likes/counts/leaderboard anywhere.
*Verify:* screenshots confirm the flow and the absence of vanity metrics.

---

## Mobile parity follow-ups (NOT in this build)
- Flutter screens (Circle wall, add-friend sheet, share toggle) in `apps/mobile-flutter/` calling the **same** `/api/v1/groups/*` contract via `Authorization: Bearer <access_token>`.
- Re-implement the pure helpers (`orderedPair`, handle blocklist) in Dart in the Flutter app (it can't import the web `lib/` TS helpers).
- Native share sheet on the Macro Card; design tokens already transcribed in `apps/mobile-flutter/lib/theme/nham_colors.dart` keep the card identical.
- Realtime upgrade: swap the `refetchInterval` poll for a Supabase Realtime subscription on `circle_events` — **no REST contract change** (the `{actor_id, audience, type, ref_id, created_at}` shape is fixed now).

## Open questions
1. **"Today's" window for the wall** — server timezone, or each viewer's local day (the codebase already has `lib/date/local-day.ts` + a `timezoneOffset` validation pattern). Recommend per-viewer local day for consistency with logging.
2. **Macro Card calorie band** — the brief wants a bounded `"760–845 kcal"`, but `meals.caloriesKcal` is a single persisted number. Confirm the band derivation (e.g. ±a fixed % of the stored value) or render the single value styled as a band.
3. **Rate-limit reuse vs. new** — reuse `analysis_rate_limit_windows` infra for the OG route, or add a dedicated lightweight limiter? Recommend reuse to avoid a new table under the append-only constraint.
4. **`navigator.share` with a generated PNG file** — share the card *URL* (simplest, always works) vs. fetching the PNG into a `File` for true image-share (richer, but needs the blob client-side). Recommend URL-share for MVP.
5. **pgTAP availability** — `supabase test db` requires the pgTAP harness; confirm it's installable in CI, otherwise fall back to a service-role integration test in vitest that asserts the same six properties.

Key real paths referenced: `/Users/khoivo/Documents/nham/lib/db/schema.ts`, `/Users/khoivo/Documents/nham/supabase/migrations/20260228155945*` (untouched own-data meals policy), `/Users/khoivo/Documents/nham/supabase/migrations/20260224100032*` (SECURITY DEFINER pattern), `/Users/khoivo/Documents/nham/components/logging/feed/persisted-meal-card.tsx`, `/Users/khoivo/Documents/nham/components/shared/calorie-ring.tsx`, `/Users/khoivo/Documents/nham/components/shared/macro-bars.tsx`, `/Users/khoivo/Documents/nham/components/app/nav-items.ts`, `/Users/khoivo/Documents/nham/lib/auth.ts`, `/Users/khoivo/Documents/nham/lib/supabase/server.ts`, `/Users/khoivo/Documents/nham/messages/{en,vi}.json`, `/Users/khoivo/Documents/nham/scripts/check-append-only-migrations.mjs`.