import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../theme/calm_tokens.dart';
import '../../../../theme/kallo_colors.dart';
import '../../../../theme/kallo_theme.dart';
import '../../logic/compare_rows.dart';

/// The Free ↔ Pro table: the thing the screen is actually for.
///
/// The subtitle it replaces ("Everything in Free, plus:") ASSERTED the delta;
/// this shows it, which is the one paywall change the 2026 teardowns agree
/// moves anything. Two fixed columns so every tick sits on the same two
/// verticals however long a label runs, and the label column takes whatever
/// is left rather than the columns flexing under it.
class PlanComparison extends StatelessWidget {
  const PlanComparison({super.key});

  /// The Free column is narrow because it only ever holds a glyph or "2 / 10";
  /// Pro is wide enough for the longest cell in either language — Vietnamese
  /// "Không giới hạn", which needs 87.
  static const double _freeColumn = 50;
  static const double _proColumn = 88;

  @override
  Widget build(BuildContext context) {
    final rows = compareRows();
    return DecoratedBox(
      decoration: BoxDecoration(
        color: kCardSurface,
        borderRadius: BorderRadius.circular(kCardRadius),
      ),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(
          KalloSpacing.sp4,
          KalloSpacing.sp1_5,
          KalloSpacing.sp4,
          KalloSpacing.sp4,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            _header(),
            for (var i = 0; i < rows.length; i++)
              _PlanComparisonRow(row: rows[i], ruled: i > 0),
          ],
        ),
      ),
    );
  }

  /// The two column names. Pro is ink and semibold, Free is muted — the
  /// column heads carry the ranking so the rows below them do not have to.
  Widget _header() => SizedBox(
    height: 26,
    child: Row(
      children: [
        const Spacer(),
        _head(tr('paywall.columnFree'), _freeColumn, dashCaption()),
        _head(
          tr('paywall.columnPro'),
          _proColumn,
          dashCaption(color: kInk, weight: FontWeight.w600),
        ),
      ],
    ),
  );

  static Widget _head(String label, double width, TextStyle style) => SizedBox(
    width: width,
    child: Text(label, style: style, textAlign: TextAlign.center),
  );
}

/// One row of the table. Its own widget so the row's height is set by its own
/// content — a label that wraps in Vietnamese grows only its own line.
class _PlanComparisonRow extends StatelessWidget {
  const _PlanComparisonRow({required this.row, required this.ruled});

  final CompareRow row;

  /// Every row but the first carries the hairline ABOVE it, so the table has
  /// no rule under its last line and none between the heads and row one.
  final bool ruled;

  @override
  Widget build(BuildContext context) {
    return Container(
      constraints: const BoxConstraints(minHeight: 30),
      padding: const EdgeInsets.symmetric(vertical: KalloSpacing.sp1),
      decoration: ruled
          ? const BoxDecoration(
              border: Border(
                top: BorderSide(color: KalloColors.borderSoft),
              ),
            )
          : null,
      child: Row(
        children: [
          Expanded(
            child: Padding(
              padding: const EdgeInsets.only(right: KalloSpacing.sp2),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(row.label, style: dashMeta(color: kInk)),
                  if (row.note != null) Text(row.note!, style: dashCaption()),
                ],
              ),
            ),
          ),
          _cell(row.free, pro: false, width: PlanComparison._freeColumn),
          _cell(row.pro, pro: true, width: PlanComparison._proColumn),
        ],
      ),
    );
  }

  /// The Pro tick is the app's success emerald and the Free tick is muted ink:
  /// both mean "included", and the colour is what says which column is the
  /// offer. Exhaustive over [Cell] — a new kind fails to compile here.
  static Widget _cell(Cell value, {required bool pro, required double width}) {
    final Widget child = switch (value) {
      Included() => Icon(
        LucideIcons.check300,
        size: KalloIcons.tertiary,
        color: pro ? KalloColors.successAccent : kInkMuted,
      ),
      Excluded() => const Icon(
        LucideIcons.minus300,
        size: KalloIcons.tertiary,
        color: KalloColors.textMuted50,
      ),
      Quantity(:final text) => Text(
        text,
        style: dashCaption(color: pro ? kInk : kInkMuted),
        textAlign: TextAlign.center,
      ),
    };
    return SizedBox(width: width, child: Center(child: child));
  }
}
