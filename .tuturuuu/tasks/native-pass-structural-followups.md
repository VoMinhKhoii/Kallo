# Structural follow-ups from the iOS-native pass audit

Deferred refactors surfaced by a three-part thermo-nuclear code-quality audit of
the native redesign (branch `claude/ios-native-design-system-wizyvk`, diff
`310b28bb..HEAD`, 262 files). The blockers from that audit were fixed and shipped
with the pass; these are the structural items held back because they are large,
behaviour-preserving refactors that were not worth destabilising the release.

All findings were measured (usage censuses, not impressions). None is a bug.

## Items

1. **Delete the legacy `KalloText` type system** — 238 lines, 29 variants of which 17 have zero uses, only 20 call sites (11 in logging barcode sheets, 5 in circle invite); it is the sole size-gate-frozen file in the shared layer and the app now has three parallel type ramps.
2. **Extract one `Pressable`** — the press-state machine (`_pressed` + tap-down/up/cancel + wash) is duplicated 6× inside `shared/` and 41× app-wide, in four divergent press languages.
3. **Collapse the gauge clamp machinery** — constrain the readout as a unit instead of per-line; deletes `gauge_clear_area.dart`, most of `gauge_readout_line.dart` and the `clampReadout` flag, and repairs the figure:denominator ratio the per-line clamp distorts at 1.3× text scale.
4. **Merge the three per-feature spacing files** — `dashboard_spacing` / `settings_spacing` / `logging_spacing` plus a private `_gap` give eight distinct names to the value 12; nutrition already imports dashboard's tokens for one of them.
5. **Weight subsystem: 7 files → 4** — `weight_submit_button` is a fifth copy of the primary pill (and the only one missing `Semantics`), `weight_amount_field` forks `KalloTextField` over three parameters it lacks (`fillColor`, `hasError`, `suffixText`), and `showWeightLogSheetWithData` is public with no external callers.
6. **Break the new `lib/shell` ↔ `lib/features` import cycle** — move `profile_avatar_button` into dashboard chrome and `nav_actions` out of `shell/` (12 feature files import shell today).
7. **Delete dead shared API** — `KalloButton.cta`/`danger` (0 uses, and they carry the button's entire per-variant geometry switch), `showNhamSheet(isScrollControlled:)`, `KalloSheetSurface(maxHeightFraction:)`, `KalloSheetHeader(onClose:)`, `ListRow`'s null-`onTap` branch.
8. **Reconcile the eyebrow** — two disagreeing implementations (11pt/0.3 tracking vs 10pt/2.0), `.toUpperCase()` leaked to five call sites when the shared widget was deleted, and the token's doc claims dial-only while 8 of 9 uses are elsewhere.
9. **`MealBlock`'s enum + slots API** — three call sites, three configurations, zero overlap; it is a union of three widgets wearing one constructor.
10. **Icon tiers are unadopted** — `KalloIcons.action` has 0 direct uses and `primary` has 1, while the legacy `size` alias still carries 29; either adopt or retire the ramp.
11. **`DashboardSkeleton` has no refresh control** — a stuck dashboard load cannot be pulled to refresh, and the scroll physics visibly change when the bundle resolves. *(Fixed with the blockers if the shared refreshable-scroll widget landed; verify before picking this up.)*
12. **`nutrition_screen`'s body is one `SliverToBoxAdapter`** — the `CustomScrollView` conversion bought the refresh control and zero laziness; every vitamin row rebuilds on each of three `setState` paths.

## Notes

- Items 1, 2 and 3 are the highest-leverage: 1 removes the size-gate exemption and most of items 8/10's tail; 2 is the largest single deletion available; 3 fixes a live 1.3×-scale collision as a side effect.
- Folders at the 10-entry cap and therefore one file from a forced split: `logging/logic/feed`, `logging/data`, `logging/widgets/composer`, `logging/sheets/label/review`.
- Pre-existing, not from this pass: `body_metrics.dart` is 646 lines against a 400 limit (frozen in the baseline).
