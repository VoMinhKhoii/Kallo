import 'package:flutter/widgets.dart';

import '../../../theme/kallo_theme.dart';

/// The dashboard's ONE vertical rhythm. Every gap on the tab resolves to one of
/// these steps, so greeting → week strip → section → section reads as a single
/// stack instead of a pile of blocks each with its own margin.
///
/// The native pass (2026-08-31) brought [block] back to the design system's
/// flat 12. The 20 it ran at was compensation for a canvas one step off white,
/// where unenclosed dials had nothing to separate them; on `#F8F7F4` a white
/// card reads as its own object and the extra 8 only made the tab scroll
/// longer. The one deliberate exception is [sectionBreak].
///
/// The logging feed's tighter 8px block is a separate documented exception for
/// a dense scrolling list and does not apply here.
abstract final class DashboardSpacing {
  /// A label to the thing it labels: a macro title over its dial. Deliberately
  /// the smallest step between two separate elements, because a heading that
  /// floats reads as its own block.
  static const double label = KalloSpacing.sp2; // 8

  /// Between the tab's stacked components: week strip ↔ section ↔ section, and
  /// the calorie dial ↔ the macro dials that qualify it.
  static const double block = KalloSpacing.sp3; // 12

  /// The gap ABOVE a [SectionHeaderRow] — twice [block], and deliberately
  /// asymmetric with the [block] that follows it.
  ///
  /// A header at the same 12 above and below is equidistant between the card
  /// it labels and the card it does not, so the eye has nothing to group it
  /// with and the page reads as an undifferentiated stack. Doubling only the
  /// gap ABOVE binds the header to the content BELOW it, which is the one
  /// relationship a section header exists to state. Scaling both would just
  /// make the same flat stack taller.
  ///
  /// Absorbs the old `majorBreak` (20), whose single use — today's numbers
  /// from the meals behind them — was this same break under another name.
  static const double sectionBreak = KalloSpacing.sp6; // 24

  /// Inside a card: the space above/below the hairline and between the card's
  /// zones, and the vertical padding on one meal row.
  static const double section = KalloSpacing.sp3; // 12

  /// Vertical padding on one item row. Neighbouring rows therefore sit
  /// `row * 2` apart, so a list breathes without doubling to [block]; `row * 2`
  /// is also the gap where a row list is spaced by an explicit `SizedBox`
  /// instead of per-row padding.
  static const double row = KalloSpacing.sp1; // 4

  /// A card's own inset. Vertical is 12, not the horizontal 16, so the padding
  /// reads EQUAL on all four sides: the first and last lines each carry ~4px of
  /// line-height slack above/below their glyphs, which a flat 16 would stack on
  /// top of. Optical balance, not geometric.
  static const EdgeInsets card = EdgeInsets.fromLTRB(
    KalloSpacing.sp4, // 16
    KalloSpacing.sp3, // 12
    KalloSpacing.sp4,
    KalloSpacing.sp3,
  );

  /// A card whose ROWS carry their own vertical padding — the meal list, where
  /// each row pays [section] top and bottom and the card only insets the sides.
  static const EdgeInsets rowCard = EdgeInsets.symmetric(
    horizontal: KalloSpacing.sp4, // 16
  );
}
