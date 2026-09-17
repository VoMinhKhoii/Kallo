# Meal sharing — redesign and uneven splits

**Status:** design approved, pending spec review
**Renders:** `docs/design/meal-share-2026-09/render/` — the shipped widget, at every party size.
The eleven exploration boards that produced this design were deliberately not merged: they were
throwaway scaffolding and this spec is what they were for.

## Problem

Two problems, one surface.

**The flow does not look native.** On mobile the mode picker is a two-card web grid, the CTA sits inside the
scroll view so it drifts off-screen with a long friend list, selection is a hover-style beige wash, and nothing
in the sheet says which meal is being shared. On web it is a stock shadcn dialog with no subject, no scale, no
result, a literal `"Đang tải…"` where mobile ships a skeleton, and no footer — so the one primary floats with
no cancel and no statement of consequence.

**Splits are always even.** `shareMealWithFriendsAction` computes `1/(N+1)` and scales the sender's meal to
that share. People do not eat equal halves. The feature the user asked for is an adjustable portion.

A third problem surfaced during design and is now in scope: a split **permanently rescales the sender's already
logged meal** and the server then refuses to ever split it again (`source.portionFactor < 1`). Nothing in
either UI says so, and there is no way back.

## What we are building

A redesigned share sheet on both platforms, built around one new control — **the portion battery** — plus the
server changes an uneven split requires, and an undo.

### The portion battery

The dish is 20 parts of 5% each. Every participant owns a contiguous run of parts, wears an inverted
water-drop pin above their run with their kcal above that, and owns a draggable pill notch on the boundary to
their right. Dragging a notch trades parts between the two people it sits between; everyone else is untouched
and the total is always 20.

- **Seats are positional.** Seat 1 is always you (black), then green, amber, salmon, red, blue. Removing
  someone shifts later seats up a colour, tweened over 200 ms.
- **Two clauses keep it legible.** (1) A notch clamps between its neighbours, so notches never cross.
  (2) A notch stops **two parts** short of each neighbour, so no run is ever narrower than the pin sitting on
  it. Together, overlap is impossible by construction.
- **Six people is the cap.** The palette holds six and the two-part floor holds ten; six is binding. A seventh
  selection is refused with `heavyImpact` and the row greys.
- **Twenty parts cannot express thirds.** An even three-way split is 7/7/6 → 35/35/30. Accepted, and visible.
- **Labels are percentage plus kcal**, e.g. `40% · 416 kcal`. At 20 parts every percentage is a round
  multiple of 5, so there is no fraction-versus-percent question to settle.

### The two tabs

`Nguyên phần` (everyone gets a full serving) and `Chia phần` (one dish, divided). The shipped label for the
first is `Cùng một món`; we are renaming it so both tabs turn on the same noun and differ by one word.

The battery survives the tab switch: on `Nguyên phần` it becomes **one full battery per person**, each at the
same unit size (`floor(20 / n)` units apiece, so a cell never changes width). Switching tabs is a 320 ms morph
of one object, never a cross-fade — see *Motion*.

### The sheet

Mobile uses `KalloSheetHeader` unchanged: grabber, X on the **left** at a 44 pt target on the content-inset
line, centred 16/600 title, muted subtitle carrying the dish name. Then the segmented control, the battery,
a `Thêm bạn bè` lane, and a pinned footer with the primary and `Huỷ` beneath it.

- **Nobody appears twice.** People at the table are pins above the battery; the lane below holds only friends
  who are not. Add = tap a row. Remove = the × on a pin.
- **The lane is a fixed height** so the footer never moves — not when the list is long, not when the tab
  changes.
- **The button carries the consequence:** `Chia sẻ với 3 người · còn 416 kcal`. **Both tabs use the same
  verb** — on `Nguyên phần` it reads `còn 1.040 kcal`, because your own meal is untouched. One string, and
  the number does the distinguishing.

Web is the same architecture at 472 px, on one squircle family (dialog 16, controls 12, close tile 10, meter
14 to match mobile exactly), with a real footer that has a cancel. Under 640 px it becomes a bottom sheet with
the full-width button.

### The receiving end

Circle invites and the web activity feed both become Threads-shaped notification rows: avatar with a state
badge, name and time, message, and **one action as a black pill on the right**, with dismiss in the `···`
overflow. No status chips — a resolved invite loses its pill and the message line carries the outcome.

`invite_card.dart`'s `_portionLabel` is `1/(1/factor).round()`, which prints "1/3" for a 0.35 factor. It is
replaced by a percentage plus the read-only battery (`interactive: false`).

### Empty, error, offline

The share flow is the only part of the app that never adopted `KalloSurfaceState` — 13 mobile call sites and a
web twin use it; `share_meal_sheet.dart`, `meal_invites.dart`, `friend_list_skeleton.dart` and
`share-meal-dialog.tsx` hand-roll bare `Text`. All four adopt it:

| State | Call |
|---|---|
| No circle yet | `KalloSurfaceState(area: circle, kind: empty, compact: true)` → capybara-telescope, black `cta` → "Thêm bạn bè" |
| Fetch failed | `kind: error` → capybara-stuck-jar, black `cta` → "Thử lại" |
| Offline | `kind: offline` — the member already exists and is unused here today |

**No red.** Per `circle_error.dart`: "a retry is not a destruction". `danger` stays for delete, sign-out and
error copy.

## Server changes

### Wire format

`shareMealWithFriendsSchema` gains `splits`, optional and only valid when `mode = 'split'`:

```ts
splits: z.array(z.object({ userId: uuidSchema, parts: z.number().int().min(2).max(18) })).optional()
myParts: z.number().int().min(2).max(18).optional()
```

Integers, not floats. The server asserts `myParts + sum(splits.parts) === 20` — one equality check, no
floating-point drift, no "shares sum to 0.9999". Absent → today's `1/(N+1)` path, untouched.

### Applying a split

1. `scaleOwnMealInPlace(tx, source, items, myParts / 20)` — already takes an arbitrary factor.
2. Each invite row stores its recipient's own factor.

### Accepting

Today accept copies verbatim, which is only correct because an even split leaves both shares equal. Uneven
breaks it. Add `meal_share_invites.copy_factor numeric NOT NULL DEFAULT 1` = the recipient's share ÷ the
sender's remaining share at offer time. Accept passes it to `copyMealVerbatim`, whose `factor: 1 | 0.5` widens
to `factor: number` (the body already multiplies generically).

**Default 1 means every existing row and every even split keeps byte-identical behaviour, and no backfill is
needed.**

### Undo

The share is **held on the client, not sent**, for the five seconds its toast is up — the same shape as
removing a meal (`meal_actions.dart`, `use-meal-card-actions.ts`). "Hoàn tác" drops the held request; the
toast closing without it posts the request. There is no undo endpoint.

A compensating write was considered and rejected: by the time the toast shows, the recipients' pushes have
already gone out (post-commit), so undoing on the server leaves them tapping a notification for an invite
that no longer exists — and a friend who accepts inside the window makes the undo refusable. Deferring means
nobody hears about a share that was taken back, and undo costs no request.

The trade: a share is lost if the app is killed or the tab closed inside the window, and a server refusal
(including the premium 402, which routes to the paywall) surfaces after the toast rather than inside the sheet.

## Motion and haptics

Haptics follow the app's existing vocabulary (73 call sites), not a new one.

| Moment | Haptic | Motion |
|---|---|---|
| Sheet opens | `lightImpact` (matches `weight_log_sheet.dart`) | standard `showNhamSheet` |
| Friend added or removed | `selectionClick` (already in `friend_pick_row.dart`) | pin scales in 180 ms; seat colours tween 200 ms |
| Tab switch | `selectionClick` | the 320 ms morph, below |
| Grip touch down | `lightImpact` | grip grows 56→68 pt tall and 12→14 pt wide over 120 ms, shadow deepens |
| Each part crossed while dragging | `selectionClick` | pins and their kcal track live; kcal counts rather than jumps |
| Notch hits the floor | `heavyImpact`, once — not repeated | grip holds, no movement |
| Seventh person refused | `heavyImpact` (matches `compact_weight_log.dart`'s "rejected input") | row greys |
| Grip released | none | settles to rest over 140 ms |
| Share succeeds | `mediumImpact` (matches `persisted_meal_mutations.dart`) | sheet dismisses, toast with `Hoàn tác` |
| Share fails | none | sheet **stays open with the draft intact**; error toast |

**The tab morph, 320 ms, four properties on one curve:** run width (parts fraction → equal), gap (0 → 14 pt),
outer shell border alpha (1 → 0) against inner shell border alpha (0 → 1), and cell count at each run's
trailing edge. Cells are keyed by `(userId, cellIndex)`, **not by index** — that is what makes the seventh
black cell in the split state *be* the fourth black cell in the whole state. `AnimatedList` in a
`LayoutBuilder`; never `AnimatedCrossFade`. The pins do not move; only their kcal tweens. Reverse is the same
timeline played backwards.

## Accessibility

- Each notch is its own `Semantics(slider:)` — four notches is four sliders sharing a track, not one slider.
  Value reads "Mai Ngọc, 4 phần, 20 phần trăm"; `onIncrease`/`onDecrease` step one part.
- Pins carry `excludeSemantics` so a run is not announced twice.
- Web: `role="slider"` per notch, ← → one part, ⇧← ⇧→ five, Home/End clamp to the floor, `aria-valuetext` in
  the same words as mobile.
- Colour is never the only channel: the pin is the identifier and the kcal figure is the text fallback.
- Dynamic Type is clamped at 1.3× app-wide; the lane absorbs the growth while meter and button hold size.

## Deliberate exceptions

Both need to be written down so the next person does not "fix" them back.

1. **Bright seat colours.** `mobile.md` says no pure red and no pure green; the seats are `#F04438` and
   `#12B76A`. Scoped to this control only.
2. **A black `cta` in a notification row.** `kallo_primitives.dart` scopes that tier to auth, the paywall, and
   surface states. A live notification action is a fourth use.

## Out of scope

- **Squircle buttons app-wide.** `KalloRadii.button = pill` is deliberate — shape separates what you touch
  from what holds content. Moving primaries to a squircle is its own pass over every button at once. (The
  toast moved to a squircle already: it is a surface, not a button.)
- The broadcast "share to Circle" toggle. Different concept; merging the two sharing surfaces is a product
  question, not this one.
- Per-person portions beyond six people.

## Verification

- Server: `myParts + sum(parts) === 20`; accept applies `copy_factor`; even splits produce `copy_factor = 1`
  and byte-identical rows to today; undo sends nothing.
- Widget: notch clamping at both neighbours and at the two-part floor; seat reassignment on removal; the lane
  keeping the footer fixed across list length and tab; `KalloSurfaceState` rendered for empty/error/offline.
- Golden: the meter at 2, 3, 6 people, at rest and clamped, at 1.0× and 1.3×.
- Simulator: the full flow at six people, plus the morph captured on video to confirm it reads as one object.
