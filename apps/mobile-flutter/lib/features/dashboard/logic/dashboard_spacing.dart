import 'package:flutter/widgets.dart';

import '../../../theme/nham_theme.dart';

/// The dashboard's ONE vertical rhythm. Every gap on the tab resolves to one of
/// these steps, so greeting → week strip → section header → card → section reads
/// as a single stack instead of a pile of blocks each with its own margin.
///
/// The dashboard is a PRESENTATIONAL surface, so it keeps the design system's
/// 12px default (see `.agents/skills/kallo-design/mobile.md`, "Spacing — one 12px
/// rhythm"). The logging feed's tighter 8px `block` is the documented exception
/// for a dense scrolling list — it is NOT the new default and does not apply
/// here; a dashboard at 8 loses the separation between its three sections.
abstract final class DashboardSpacing {
  /// Between the tab's stacked components: week strip ↔ section header ↔ card,
  /// and one section ↔ the next.
  static const double block = NhamSpacing.sp3; // 12

  /// Inside a card: the space above/below the hairline and between the card's
  /// zones (hero · macros · meals).
  static const double section = NhamSpacing.sp3; // 12

  /// Vertical padding on one item row (a macro bar, a meal line). Neighbouring
  /// rows therefore sit `row * 2` apart, so a list breathes without doubling to
  /// [block]; `row * 2` is also the gap where a row list is spaced by an
  /// explicit `SizedBox` instead of per-row padding.
  static const double row = NhamSpacing.sp1; // 4

  /// A card's own inset. Vertical is 12, not the horizontal 16, so the padding
  /// reads EQUAL on all four sides: the first and last lines each carry ~4px of
  /// line-height slack above/below their glyphs, which a flat 16 would stack on
  /// top of. Optical balance, not geometric.
  static const EdgeInsets card = EdgeInsets.fromLTRB(
    NhamSpacing.sp4, // 16
    NhamSpacing.sp3, // 12
    NhamSpacing.sp4,
    NhamSpacing.sp3,
  );
}

/// Shared right-hand column width in the Today dock: the macro `x/yg` values
/// and the meal-row kcal sit in this fixed column so both align to one right
/// edge. Wide enough for `1024/350g` and `9999 kcal` at Meta 12.
///
/// Lives here rather than in either widget file because both need it and they
/// are now separate libraries — and because a shared alignment constant is a
/// layout decision, not a widget's private business.
const double dashboardValueColumnWidth = 72;
