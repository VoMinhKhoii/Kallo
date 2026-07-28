import 'package:flutter/widgets.dart';

import '../../../theme/nham_theme.dart';

/// Settings' ONE vertical rhythm. Settings is a presentational surface, so it
/// keeps the design system's 12px default between stacked components
/// (`.agents/skills/nham-design/mobile.md`, "Spacing — one 12px rhythm").
///
/// Rows are flat and unbordered, so **whitespace is the only grouping device**
/// on the screen: a group's label sits [label] above its first row, and one
/// group clears the next by [group] — double the default step, because rows
/// inside a group touch each other and a 12px gap between groups would read as
/// just another row gap.
abstract final class SettingsSpacing {
  /// A group's label ↔ its first row.
  static const double label = NhamSpacing.sp2; // 8

  /// One group ↔ the next — the only thing separating them.
  static const double group = NhamSpacing.sp6; // 24

  /// The scroll padding of a settings page. Horizontal 12 matches the app-wide
  /// root inset (dashboard, logging, circle, the drawer) so settings doesn't
  /// sit narrower than every other tab; the tall bottom inset lets the last row
  /// clear the home indicator.
  static const EdgeInsets page = EdgeInsets.fromLTRB(
    NhamSpacing.sp3, // 12
    NhamSpacing.sp2, // 8 — the first group starts right under the header
    NhamSpacing.sp3,
    NhamSpacing.sp8, // 32
  );
}
