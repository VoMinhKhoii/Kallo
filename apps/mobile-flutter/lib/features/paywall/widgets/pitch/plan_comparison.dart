import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../../theme/calm_tokens.dart';
import '../../../../theme/kallo_colors.dart';
import '../../../../theme/kallo_theme.dart';
import '../../logic/compare_rows.dart';
import 'comparison_columns.dart';
import 'plan_comparison_row.dart';

/// The Free ↔ Pro table: the thing the screen is actually for.
///
/// The subtitle it replaces ("Everything in Free, plus:") ASSERTED the delta;
/// this shows it, which is the one paywall change the 2026 teardowns agree
/// moves anything. Two fixed columns so every tick sits on the same two
/// verticals however long a label runs, and the label column takes whatever
/// is left rather than the columns flexing under it.
class PlanComparison extends StatelessWidget {
  const PlanComparison({this.availableWidth, this.dense = false, super.key});

  /// The pitch host supplies its constrained table width because its sliver
  /// queries intrinsic height, which LayoutBuilder cannot answer.
  final double? availableWidth;

  /// Set when the host is too short for all eight rows at their regular
  /// height: the rows and the card's own padding close up, the type does not
  /// change.
  final bool dense;

  @override
  Widget build(BuildContext context) =>
      availableWidth != null
          ? _table(context, availableWidth!)
          : LayoutBuilder(
            builder:
                (context, constraints) => _table(context, constraints.maxWidth),
          );

  Widget _table(BuildContext context, double width) {
    final rows = compareRows();
    final roomy = width >= ComparisonColumns.roomyWidth;
    // Too narrow for every label on one line: the label column gets what
    // the two narrow columns do not need, and the card's sides close up.
    final narrow = width < ComparisonColumns.unwrappedWidth;
    final columns =
        narrow
            ? ComparisonColumns.fitted(context, rows, roomy: roomy)
            : ComparisonColumns.fixed;
    final side = narrow ? KalloSpacing.sp3 : KalloSpacing.sp4;
    return DecoratedBox(
      decoration: BoxDecoration(
        color: kCardSurface,
        borderRadius: BorderRadius.circular(kCardRadius),
      ),
      child: Padding(
        padding: EdgeInsets.fromLTRB(
          side,
          dense ? KalloSpacing.sp0_5 : KalloSpacing.sp1_5,
          side,
          dense ? KalloSpacing.sp2 : KalloSpacing.sp4,
        ),
        // Given more height than it needs (the paywall hands it the rest of
        // the screen), the table spreads its rows rather than leaving a void
        // under the last one. The rules are their own children so the spare
        // height lands evenly on both sides of each, not just above it.
        child: Column(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            _header(roomy, columns),
            for (var i = 0; i < rows.length; i++) ...[
              if (i > 0) _rule,
              PlanComparisonRow(
                row: rows[i],
                roomy: roomy,
                dense: dense,
                columns: columns,
              ),
            ],
          ],
        ),
      ),
    );
  }

  /// The hairline between rows: none under the last line and none between
  /// the heads and row one.
  static Widget get _rule => SizedBox(
    width: double.infinity,
    height: 1,
    child: ColoredBox(color: KalloColors.borderSoft),
  );

  /// The two column names. Pro is ink and semibold, Free is muted — the
  /// column heads carry the ranking so the rows below them do not have to.
  Widget _header(bool roomy, ColumnWidths columns) => Container(
    // A MINIMUM, never a fixed height: at 26 exactly, a heading that wrapped
    // had its second line clipped instead of pushing the row open.
    constraints: BoxConstraints(minHeight: dense ? 20 : 26),
    alignment: Alignment.bottomCenter,
    child: Row(
      children: [
        const Spacer(),
        _head(
          tr('paywall.columnFree'),
          columns.free,
          ComparisonColumns.small(roomy),
        ),
        _head(
          tr('paywall.columnPro'),
          columns.pro,
          ComparisonColumns.small(roomy, color: kInk, weight: FontWeight.w600),
        ),
      ],
    ),
  );

  static Widget _head(String label, double width, TextStyle style) =>
      SizedBox(width: width, child: ComparisonColumns.columnText(label, style));
}
