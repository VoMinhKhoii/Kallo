import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import '../../../../shared/widgets/icons/brush_check.dart';
import '../../../../theme/calm_tokens.dart';
import '../../../../theme/kallo_colors.dart';
import '../../../../theme/kallo_theme.dart';
import '../../logic/compare_rows.dart';
import 'comparison_columns.dart';

/// One row of the table. Its own widget so the row's height is set by its own
/// content — a label that wraps in Vietnamese grows only its own line.
class PlanComparisonRow extends StatelessWidget {
  const PlanComparisonRow({
    super.key,
    required this.row,
    required this.roomy,
    required this.dense,
    required this.columns,
  });

  final CompareRow row;

  /// See [ComparisonColumns.roomyWidth].
  final bool roomy;

  /// The table is short of height: a 24pt floor instead of 30, which still
  /// clears a 14pt line with air above and below.
  final bool dense;

  /// The Free and Premium widths the table chose, shared by every row.
  final ColumnWidths columns;

  @override
  Widget build(BuildContext context) {
    return Container(
      constraints: BoxConstraints(minHeight: dense ? 24 : 30),
      padding: EdgeInsets.symmetric(
        vertical: dense ? KalloSpacing.sp0_5 : KalloSpacing.sp1,
      ),
      child: Row(
        children: [
          Expanded(
            child: Padding(
              padding: const EdgeInsets.only(right: KalloSpacing.sp2),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    row.label,
                    style: roomy ? dashBody() : dashMeta(color: kInk),
                  ),
                  if (row.note != null)
                    Text(row.note!, style: ComparisonColumns.small(roomy)),
                ],
              ),
            ),
          ),
          _cell(row.free, pro: false, width: columns.free),
          _cell(row.pro, pro: true, width: columns.pro),
        ],
      ),
    );
  }

  /// The Pro tick is the app's success emerald and the Free tick is muted ink:
  /// both mean "included", and the colour is what says which column is the
  /// offer. Exhaustive over [Cell] — a new kind fails to compile here.
  Widget _cell(Cell value, {required bool pro, required double width}) {
    final Widget child = switch (value) {
      Included() => BrushCheck(
        size: KalloIcons.tertiary,
        color: pro ? KalloColors.successAccent : kInkMuted,
      ),
      Excluded() => Icon(
        LucideIcons.minus300,
        size: KalloIcons.tertiary,
        color: KalloColors.textMuted50,
      ),
      // Same no-wrap rule as the headings: "Không giới hạn" broke across two
      // lines against a one-glyph cell opposite it and read as a defect.
      Quantity(:final text) => ComparisonColumns.columnText(
        text,
        ComparisonColumns.small(roomy, color: pro ? kInk : kInkMuted),
      ),
    };
    return SizedBox(width: width, child: Center(child: child));
  }
}
