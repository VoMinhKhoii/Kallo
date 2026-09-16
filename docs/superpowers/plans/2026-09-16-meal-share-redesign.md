# Meal share redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship uneven meal splits on a portion-battery control, with a redesigned share surface on both platforms and an undo.

**Architecture:** Integers on the wire (20 parts), a per-invite `copy_factor` defaulting to 1 so existing rows and even splits are untouched, one new Flutter widget (`PortionBattery`) with a pure-logic core that both platforms' rules are tested against, and an undo that holds the request client-side until the toast closes (no endpoint).

**Tech Stack:** Next.js 15 / Drizzle / Postgres / zod on the server; Flutter + Riverpod on mobile; React + TanStack Query on web.

**Spec:** `docs/superpowers/specs/2026-09-16-meal-share-redesign-design.md`

## Global Constraints

- The dish is **20 parts**. Every participant holds **≥ 2 parts** (the 10% floor). Max **6 participants** (5 friends + you).
- `myParts + sum(splits[].parts) === 20`, asserted server-side. Integers only — never floats on the wire.
- `meal_share_invites.copy_factor` is `numeric NOT NULL DEFAULT 1`. **No backfill.** An even split must still produce `copy_factor = 1` and rows byte-identical to today's.
- Seat colours, in order: `#141413` you, `#12B76A`, `#FFB020`, `#FF8A6B`, `#F04438`, `#2E90FA`.
- Haptics use the app's existing vocabulary only: `selectionClick` (discrete selection), `lightImpact` (engage), `mediumImpact` (successful write), `heavyImpact` (rejected input).
- Empty / error / offline states are `KalloSurfaceState` (mobile) and `components/shared/surface-state/` (web). **No red on a retry.**
- Copy: tabs are `Nguyên phần` / `Chia phần`. Lane header `Thêm bạn bè`. CTA `Chia sẻ với {n} người · còn {kcal} kcal` on both tabs.
- No status chips on mobile.

---

## Phase 1 — Server

### Task 1: Split maths as pure, shared logic

**Files:**
- Create: `lib/domain/social/splits/parts.ts`
- Test: `lib/domain/social/splits/__tests__/parts.test.ts`

**Interfaces:**
- Produces: `TOTAL_PARTS = 20`, `MIN_PARTS = 2`, `MAX_PARTICIPANTS = 6`,
  `evenParts(participants: number): number[]`,
  `assertPartsValid(myParts: number, splits: {userId: string, parts: number}[]): void`,
  `copyFactorFor(recipientParts: number, myParts: number): number`

- [ ] **Step 1: Write the failing test**

```ts
import { evenParts, assertPartsValid, copyFactorFor, TOTAL_PARTS } from '../parts';

describe('evenParts', () => {
  it('splits 20 evenly and hands the remainder to the earliest seats', () => {
    expect(evenParts(2)).toEqual([10, 10]);
    expect(evenParts(3)).toEqual([7, 7, 6]);
    expect(evenParts(5)).toEqual([4, 4, 4, 4, 4]);
  });
  it('always sums to TOTAL_PARTS', () => {
    for (let p = 2; p <= 6; p++) {
      expect(evenParts(p).reduce((a, b) => a + b, 0)).toBe(TOTAL_PARTS);
    }
  });
});

describe('assertPartsValid', () => {
  const ok = [{ userId: 'a', parts: 10 }];
  it('accepts a sum of exactly 20', () => {
    expect(() => assertPartsValid(10, ok)).not.toThrow();
  });
  it('rejects a sum that is not 20', () => {
    expect(() => assertPartsValid(9, ok)).toThrow();
  });
  it('rejects anyone under the floor', () => {
    expect(() => assertPartsValid(19, [{ userId: 'a', parts: 1 }])).toThrow();
  });
  it('rejects more than six participants', () => {
    const six = Array.from({ length: 6 }, (_, i) => ({ userId: `u${i}`, parts: 3 }));
    expect(() => assertPartsValid(2, six)).toThrow();
  });
});

describe('copyFactorFor', () => {
  it('is 1 for an even two-way split, matching today', () => {
    expect(copyFactorFor(10, 10)).toBe(1);
  });
  it('is the ratio of the recipient run to the sender run', () => {
    expect(copyFactorFor(7, 13)).toBeCloseTo(7 / 13);
  });
});
```

- [ ] **Step 2: Run it and watch it fail** — `bun test lib/domain/social/splits` → module not found.
- [ ] **Step 3: Implement `parts.ts`** with the four exports above and nothing else.
- [ ] **Step 4: Run it and watch it pass.**
- [ ] **Step 5: Commit** — `feat(social): split parts maths`

### Task 2: Migration + schema for `copy_factor`

**Files:**
- Create: `supabase/migrations/<ts>_meal_share_invites_copy_factor.sql`
- Modify: `lib/infra/db/schema.ts` (mealShareInvites)

- [ ] **Step 1: Write the migration** — `ALTER TABLE meal_share_invites ADD COLUMN copy_factor numeric NOT NULL DEFAULT 1;` plus a check `copy_factor > 0`.
- [ ] **Step 2: Add the Drizzle column** with the same default and a comment saying why 1 is compatibility, not a placeholder.
- [ ] **Step 3: Commit** — `feat(db): meal_share_invites.copy_factor`

### Task 3: Widen `copyMealVerbatim`

**Files:**
- Modify: `lib/actions/meals/copy-meal-verbatim.ts` (`factor: 1 | 0.5` → `factor: number`)
- Test: `lib/actions/meals/__tests__/copy-meal-verbatim.test.ts`

- [ ] **Step 1: Test that an arbitrary factor scales grams and nutrition proportionally**, and that `factor === 1` still takes the no-scale branch.
- [ ] **Step 2: Widen the type.** The body already multiplies generically; only the literal union changes.
- [ ] **Step 3: Run the existing meal-copy tests** — they must all still pass.
- [ ] **Step 4: Commit** — `refactor(meals): copyMealVerbatim takes any factor`

### Task 4: Accept applies `copy_factor`

**Files:**
- Modify: `lib/actions/meal-sharing/invite-response.ts`
- Test: `lib/actions/meal-sharing/__tests__/invite-response.test.ts`

- [ ] **Step 1: Test that an even split still copies verbatim** (`copy_factor = 1` → identical rows to today).
- [ ] **Step 2: Test that an uneven invite scales the copy** by `copy_factor` and nothing else.
- [ ] **Step 3: Read `copyFactor` off the invite and pass it through.**
- [ ] **Step 4: Run, commit** — `feat(social): accept honours copy_factor`

### Task 5: Uneven split on the send side

**Files:**
- Modify: `lib/core/validation/social.ts`, `lib/actions/meal-sharing/share-with-friends.ts`
- Test: `lib/actions/meal-sharing/__tests__/share-with-friends.test.ts`

- [ ] **Step 1: Test the absent-`splits` path is byte-identical to today** (the existing suite is the oracle — it must pass untouched).
- [ ] **Step 2: Test an uneven 13/7 split** scales the sender to 0.65 and writes `copy_factor = 7/13`.
- [ ] **Step 3: Test rejection** of a sum ≠ 20, of parts < 2, of `splits` with `mode: 'copy'`, and of > 6 participants.
- [ ] **Step 4: Extend the zod schema and the action.**
- [ ] **Step 5: Run, commit** — `feat(social): uneven meal splits`

### Task 6: Undo (client-side)

No server work. Both clients hold the share request for the 5-second toast and post it only when the toast
closes without "Undo" — mirroring meal removal. See the spec's Undo section for why not a compensating write.

## Phase 2 — Mobile: the control

### Task 7: `SplitParts` pure logic (Dart)

**Files:**
- Create: `apps/mobile-flutter/lib/features/circle/logic/split_parts.dart`
- Test: `apps/mobile-flutter/test/features/circle/split_parts_test.dart`

**Interfaces:**
- Produces: `kTotalParts`, `kMinParts`, `kMaxParticipants`, `evenParts(int)`,
  `clampNotch({required List<int> parts, required int boundary, required int toPart})`,
  `partsAfterRemoval(List<int> parts, int index)`

- [ ] **Step 1: Test `clampNotch`** — a notch cannot pass its neighbour, and stops two parts short on both sides.
- [ ] **Step 2: Test `partsAfterRemoval`** returns the removed person's parts to their neighbours and still sums to 20.
- [ ] **Step 3: Implement, run, commit** — `feat(mobile): split parts logic`

### Task 8: `PortionBattery` widget

**Files:**
- Create: `apps/mobile-flutter/lib/features/circle/widgets/share/portion_battery.dart`
- Test: `apps/mobile-flutter/test/features/circle/portion_battery_test.dart`

- [ ] **Step 1: Test it renders one run per participant** and the right cell count per run.
- [ ] **Step 2: Test the grip is absent when `interactive: false`** (the recipient's read-only instance).
- [ ] **Step 3: Test each notch exposes `Semantics(slider:)`** with increase/decrease stepping one part.
- [ ] **Step 4: Implement** — 56pt shell, 12pt grip growing to 14×68 on drag, pins at 30pt lifted 12pt, `selectionClick` per part, `heavyImpact` at the floor.
- [ ] **Step 5: Run, commit** — `feat(mobile): portion battery`

## Phase 3 — Mobile: the surfaces

### Task 9: Share sheet rewrite
- Sheet header unchanged; segmented tabs; battery; fixed-height lane; pinned footer with `Huỷ` under the primary; `KalloSurfaceState` for empty/error/offline; i18n en + vi.

### Task 10: Invite card + Circle rows
- Threads-shaped rows, black pill action, no status chips, percentage label, read-only battery.

## Phase 4 — Web

### Task 11: Dialog rewrite
- Squircle family 16/12/10, subject line, tabs, the same meter as a React component, add-only list, footer with cancel, `SurfaceState` for empty/error, sub-640px sheet.

### Task 12: Activity row
- Portion and kcal on the meta line, filled pill + text dismiss.

## Phase 5 — Verification

- [ ] `flutter analyze` + full Flutter suite
- [ ] `bun test` for the server + web suites
- [ ] Widget renders committed under `docs/design/meal-share-2026-09/render/` (generated with the
      repo's golden machinery, NOT left as golden tests — goldens here are Linux-only)
- [ ] `/codex` adversarial review, looped until it verifies
- [ ] `/thermo-nuclear-code-quality-review`
- [ ] `/ship` with the frames in the PR body
