# Mobile — Native Components Audit (2026-09-03)

Audit of hand-built Flutter components in `apps/mobile-flutter` that have a native iOS
(Cupertino) equivalent. Each row gets a verdict so the team can pick it up as a follow-up.
Refs are `file:line` at HEAD; spot-checked with grep against the tree on this date.

## 1. Context

The app is iOS-first: `MaterialApp.router` at the root, but each pushed screen (Log,
Settings) rides a `CupertinoPage` so swipe-back and the iOS transition curve come for free.
SDK is Flutter 3.44.1, which ships `showCupertinoSheet` / `CupertinoSheetRoute`,
`CupertinoMenuAnchor`, `CupertinoNavigationBar.large`, and `CupertinoButton.tinted` /
`.filled` — none of these existed when most of the widgets below were written.

**Already native:**

| Component | File | Native API used |
|---|---|---|
| Pull-to-refresh | `shared/widgets/feedback/kallo_refresh.dart:41` | `CupertinoSliverRefreshControl` |
| Message long-press menu | `features/logging/widgets/turn/user_message_bubble.dart:67` | `CupertinoContextMenu` |
| Route transitions | shell + pushed screens | `CupertinoPage` |
| Confirm dialog (this batch) | `shared/widgets/dialog/kallo_confirm.dart` | `CupertinoPopupSurface` + stacked verb pills (done 2026-09-03; `CupertinoAlertDialog`'s side-by-side text actions were rejected so both options stay explicit) |

## 2. Findings, by impact

| Component (file:line) | What it is | Recorded rationale | Call sites | Native candidate | Verdict |
|---|---|---|---|---|---|
| `shared/widgets/surface/kallo_primitives.dart:122` + 16 more | `CircularProgressIndicator` spinners | n/a — just the Material default | 17 | `CupertinoActivityIndicator(radius:)` | **swap** |
| `shared/widgets/sheet/kallo_sheet.dart:66` `showNhamSheet` | Wraps `showModalBottomSheet` (`isScrollControlled`, `useRootNavigator`, transparent barrier, `KalloSheetSurface`) | "Material caps a sheet at 9/16 of the screen and clips the rest"; root navigator needed because the pill nav painted over sheets | 16 | `showCupertinoSheet` / `CupertinoSheetRoute` (no height cap, drag-to-dismiss, root nav by construction) | **hybrid** — swap the route, keep `KalloSheetSurface`/`KalloSheetHeader` as the child |
| `features/settings/widgets/inputs/custom_select.dart:24`, `features/onboarding/widgets/custom_select.dart:22`, `features/settings/widgets/inputs/country_select.dart:17` | Three `OverlayEntry` + `LayerLink` dropdowns, ~700 lines, two near-duplicates | Web parity — exempt from the native pass | 3 `CustomSelect` + 9 `CountrySelect` | `CupertinoMenuAnchor`/`CupertinoMenuItem` (short lists); `CupertinoPicker` in `showCupertinoModalPopup` + `CupertinoSearchTextField` (country list) | **swap** |
| `shared/widgets/toast/top_toast.dart:20` `showTopToast` | Top-anchored toast pill | No native equivalent | 64 (future used by `meal_actions.dart:142`) | — | **keep** |
| `shared/widgets/list/list_row.dart:18` + `grouped_list_card.dart:14` | Row + section-card list primitives | Radius 22, Threads-style regular weight, busy state are deliberate | 23 + 9 | `CupertinoListSection.insetGrouped`/`CupertinoListTile` | **keep** |
| `shell/header/app_header.dart:14` + settings header (moving to `shared/widgets/chrome/page_header.dart` this batch) | In-flow app bar | Collapse + blur explicitly rejected; `ScrollSeparator` owns the hairline | shell-wide | `CupertinoNavigationBar.large` | **keep** page header; **hybrid** for `AppHeader` |
| `shared/widgets/surface/kallo_primitives.dart:58` `KalloButton` | Stadium buttons, 50pt / 44pt | Press = colour shift, not opacity dim | 31 | `CupertinoButton` | **keep** the button, **swap** its spinner at :122 |
| `shared/widgets/form/option_strip.dart:39` + `segmented_strip.dart:21` | Segmented control skins | n/a | 4 | `CupertinoSlidingSegmentedControl` (nullable `groupValue` matches the `-1` semantics; wrap in `SizedBox(height: 44)`) | **hybrid** — segmented case only; keep the two multi-line legacy skins |
| `features/circle/widgets/invite/circle_add_menu.dart:49` | Anchored popover via `showGeneralDialog` | Rejects `CupertinoActionSheet`; predates `CupertinoMenuAnchor` | 1 | `CupertinoMenuAnchor` | **hybrid**, re-evaluate |
| `features/onboarding/widgets/onboarding_dialog.dart:19` | Near-fullscreen card via `showGeneralDialog` + Material shim at :43 | n/a | 1 | `showCupertinoSheet`/`CupertinoSheetRoute` | **swap** |
| 21 raw Material `TextField` sites (`share_replies.dart:134`, `create_group_sheet.dart:90`, `group_add_people.dart:107`, `group_info_sheet.dart:119`, `display_name_row.dart:102`, `invite_link_row.dart:128`, `create_group_member_picker.dart:63`, `country_select.dart:270`, `manual_gram_field.dart:73`, `decimal_input.dart`, …) | Bypass `KalloTextField` | n/a | 21 | `CupertinoTextField`; `CupertinoSearchTextField` for the 4 search fields (`manual_search_field.dart:25`, `country_select.dart:270`, `create_group_member_picker.dart:63`, `group_add_people.dart:107`) | **hybrid** — the real finding is the drift past `KalloTextField` |
| `shared/widgets/form/kallo_switch.dart:21` `KalloSwitch` | `Switch.adaptive` + 20-line theme-adaptation workaround | n/a | 1 (`auto_share_to_circle_toggle.dart:71`) | `CupertinoSwitch(activeTrackColor:)` | **swap** |
| `settings/widgets/inputs/aggression_slider.dart:75`, `onboarding/widgets/aggression_slider.dart:77`, `logging/widgets/cheat/cheat_slider_card.dart:262` | Material `Slider`, two duplicates | n/a | 3 | `CupertinoSlider` | **swap**, and fold the duplicates |
| `barcode_grams_picker.dart:17` | `±` stepper + quick chips | n/a | 1 | none | **keep** |
| `quiet_action_button.dart:44`, `meal_action_icon_button.dart:70`, `feed_action_button.dart:70` | `InkWell`/`InkResponse` ripples (`QuietIconButton` in `sheet_action_buttons.dart` already uses `GestureDetector`) | n/a | 3 | `CupertinoButton`/`GestureDetector` + haptic | **swap** the ink, keep the skin |
| `nutrition/widgets/scope/scope_switch.dart:11` | Text link, not a toggle | n/a | 1 | — | **keep** (rename candidate) |
| `logging/widgets/timeline/timeline_strip.dart` `DateMorph` | In-place morph to a week strip | n/a | 1 | `CupertinoDatePicker` | **keep** |
| `portion_ruler_strip.dart:21` | Horizontal ruler | n/a | 1 | `CupertinoPicker` | **keep** |
| `features/auth/widgets/email_auth_form.dart:182` | `MaterialPageRoute` (Forgot password) | Last one left in the app | 1 | `CupertinoPageRoute` | **swap** — one-word change, restores edge-swipe back |
| `shared/widgets/surface/kallo_screen.dart:47` | `Material(type: transparency)` shim, every screen | n/a | app-wide | `CupertinoPageScaffold` | **keep** until the `TextField`/spinner/ink rows above are retired |
| `shared/widgets/feedback/skeleton.dart:23` `SkeletonPulse` | Loading skeleton | n/a | multiple | none | **keep** |
| `theme/kallo_theme.dart:286` `snackBarTheme` | `SnackBarThemeData` | n/a | 0 `SnackBar(` uses in `lib/` | — | **dead code** |

## 3. Do first

1. **`CircularProgressIndicator` → `CupertinoActivityIndicator`** — 17 sites, mechanical,
   the most-seen non-native widget in the tree.
2. **`showNhamSheet` → `CupertinoSheetRoute`** — 16 call sites, fixes the two documented
   Material sheet defects (height cap, root-nav workaround), and lets
   `onboarding_dialog.dart` retire onto the same route.
3. **The three `OverlayEntry` dropdowns → `CupertinoMenuAnchor` / `CupertinoPicker`** —
   deletes ~700 lines across two near-duplicate implementations.

Honourable mention: `KalloSwitch` → `CupertinoSwitch` (1 call site, removes a 20-line
theme-adaptation workaround).

## 4. Keep list

| Component | Why |
|---|---|
| `showTopToast` | No native equivalent; 64 call sites, one returns a future other code awaits |
| `ListRow` / `GroupedListCard` | Radius 22, Threads-weight text, busy state are deliberate design choices, not gaps |
| Settings/page header | Collapse + blur rejected on purpose; hairline owned elsewhere |
| `KalloButton` skin | Colour-shift press feedback is intentional; only its spinner swaps |
| `barcode_grams_picker` | No native stepper widget exists |
| `scope_switch` | Text link, not a toggle — nothing to swap |
| `DateMorph` timeline strip | Bespoke morph animation, no native match |
| `portion_ruler_strip` | Custom tape-measure control, no native match |
| `KalloSheetSurface`/`KalloSheetHeader` (as children, once the route swaps) | Brand chrome, keeps working under `CupertinoSheetRoute` |
| `kallo_screen.dart` Material shim | Stays until the `TextField`, spinner, and ink rows above are retired — then `CupertinoPageScaffold` becomes viable and the shims in `onboarding_dialog.dart:43`, `circle_add_menu.dart:141`, `top_toast_pill.dart:40`, and the `custom_select` files go too |
| `SkeletonPulse` | No native equivalent |

## 5. Dead code notes

- `theme/kallo_theme.dart:286` `snackBarTheme` — zero `SnackBar(` call sites in `lib/`.
  Delete it.
