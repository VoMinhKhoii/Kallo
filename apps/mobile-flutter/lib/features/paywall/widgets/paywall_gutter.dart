import 'package:flutter/widgets.dart';

import '../../../theme/kallo_theme.dart';
import 'pitch/comparison_columns.dart';

/// The side inset of one paywall column, shared by everything in it: the
/// header's close glyph, the title, the toggle, the table and the buy band.
/// The arrangement that lays the column out provides it, so the pieces line
/// up on one left edge and one right edge however narrow the column gets.
class PaywallGutter extends InheritedWidget {
  const PaywallGutter({required this.value, required super.child, super.key});

  final double value;

  /// The design's 20, not the screen's header inset: the table's two columns
  /// are what set this width, and at 24 the Vietnamese labels wrap a row
  /// early. It is also what a piece gets outside any column (the note faces).
  static const double regular = KalloSpacing.sp5;

  /// Beside the table, the decision's own column: its title and buttons are
  /// all it holds, and the table's gutter stands between the two.
  static const double decision = KalloSpacing.sp4;

  /// How far the gutter gives way. Over the buy band the table must keep
  /// every row on one line, or the band hides the rows that wrap. Alone
  /// beside the decision it has the window's height and can afford a wrapped
  /// row, so it keeps a real gutter off the display's edge.
  static const double _min = KalloSpacing.sp1;
  static const double _minAlone = KalloSpacing.sp3;

  /// The gutter for a column [width] wide, its insets already taken out. In
  /// a narrow column it gives way before an English label wraps (see
  /// [ComparisonColumns.unwrappedWidth]): at 20 the closed Duo's 382pt
  /// column wrapped two of them.
  static double forWidth(double width, {bool alone = false}) =>
      ((width - ComparisonColumns.unwrappedWidth) / 2).clamp(
        alone ? _minAlone : _min,
        regular,
      );

  static double of(BuildContext context) =>
      context.dependOnInheritedWidgetOfExactType<PaywallGutter>()?.value ??
      regular;

  @override
  bool updateShouldNotify(PaywallGutter oldWidget) => value != oldWidget.value;
}
