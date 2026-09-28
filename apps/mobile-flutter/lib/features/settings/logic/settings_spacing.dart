import 'dart:math' as math;

import 'package:flutter/widgets.dart';

import '../../../theme/kallo_theme.dart';

/// Settings' ONE vertical rhythm. Settings is a presentational surface, so it
/// keeps the design system's 12px default between stacked components
/// (`.agents/skills/kallo-design/mobile.md`, "Spacing — one 12px rhythm").
///
/// Since the native pass (2026-08-31) the rows live inside white grouped
/// cards, so the CARD is the grouping device and whitespace no longer has to
/// carry it: the whole root list is one uniform 12px stack — label, card,
/// label, card — exactly as the Settings artboard draws it. The old 24px
/// between-group step went with the flat rows it was compensating for.
abstract final class SettingsSpacing {
  /// A group's label ↔ its card.
  static const double label = KalloSpacing.sp3; // 12

  /// One group ↔ the next.
  static const double group = KalloSpacing.sp3; // 12

  /// The scroll padding of every settings page — the root list of grouped
  /// cards and each page one level under it.
  ///
  /// A card's EDGE lands on the app-wide 12 inset, so unlike the flat rows
  /// this replaced there is nothing to split: the full 12 is here, and the
  /// card's own 16 steps its rows in from it.
  ///
  /// Settings is PUSHED (no pill nav), so the bottom only has to clear the
  /// home indicator — content still scrolls under it rather than stopping
  /// short, which is why [Screen] keeps `bottom: false`.
  ///
  /// Or the KEYBOARD, while it is up. `/settings` is a root route with no
  /// `Scaffold`, so nothing shrinks the page for it: without this the name
  /// field's Save and the delete-account button sat under the keys with no
  /// way to scroll them out (2026-09-28). The keyboard covers the home
  /// indicator, so the larger of the two is the whole inset.
  static EdgeInsets rowList(BuildContext context) => EdgeInsets.fromLTRB(
    KalloSpacing.sp3, // 12
    KalloSpacing.sp2, // 8 — with the header's own 4, the artboard's 12 gap
    KalloSpacing.sp3,
    KalloSpacing.sp8 + bottomInset(context), // 32 + inset
  );

  /// The home indicator, or the keyboard while it is up — whichever reaches
  /// higher.
  static double bottomInset(BuildContext context) => math.max(
    MediaQuery.viewPaddingOf(context).bottom,
    MediaQuery.viewInsetsOf(context).bottom,
  );
}
