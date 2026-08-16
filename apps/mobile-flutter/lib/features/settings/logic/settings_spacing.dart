import 'package:flutter/widgets.dart';

import '../../../theme/kallo_theme.dart';

/// Settings' ONE vertical rhythm. Settings is a presentational surface, so it
/// keeps the design system's 12px default between stacked components
/// (`.agents/skills/kallo-design/mobile.md`, "Spacing — one 12px rhythm").
///
/// Rows are flat and unbordered, so **whitespace is the only grouping device**
/// on the screen: a group's label sits [label] above its first row, and one
/// group clears the next by [group] — double the default step, because rows
/// inside a group touch each other and a 12px gap between groups would read as
/// just another row gap.
abstract final class SettingsSpacing {
  /// A group's label ↔ its first row.
  static const double label = KalloSpacing.sp2; // 8

  /// One group ↔ the next — the only thing separating them.
  static const double group = KalloSpacing.sp6; // 24

  /// The scroll padding of a settings page whose content sits directly on the
  /// page (the sub-page editors). Horizontal 12 matches the app-wide root inset
  /// (dashboard, logging, circle, the drawer) so settings doesn't sit narrower
  /// than every other tab; the tall bottom inset lets the last item clear the
  /// home indicator.
  static const EdgeInsets page = EdgeInsets.fromLTRB(
    KalloSpacing.sp3, // 12
    KalloSpacing.sp2, // 8 — the first group starts right under the header
    KalloSpacing.sp3,
    KalloSpacing.sp8, // 32
  );

  /// The scroll padding of the root list of rows.
  ///
  /// A row is not a card: its label column has to land where a dashboard
  /// card's EDGE lands — 12 from the screen edge — not 12 plus the row's own
  /// padding. A row still needs interior padding for its press fill, so the 12
  /// is split: 4 here + [rowPadH] (8) inside the row. Net content inset is the
  /// same 12 as everywhere else, and the pressed fill floats 4px inside the
  /// screen edge instead of bleeding off it.
  static const EdgeInsets rowList = EdgeInsets.fromLTRB(
    _rowListPad, // 4
    KalloSpacing.sp2, // 8 — the first group starts right under the header
    _rowListPad,
    KalloSpacing.sp8, // 32
  );

  static const double _rowListPad = KalloSpacing.sp1; // 4

  /// A row's own horizontal padding — the second half of the 12 above. Group
  /// labels use it too, so they align with the row icon gutter.
  static const double rowPadH = KalloSpacing.sp2; // 8
}
