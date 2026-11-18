import 'dart:math' as math;

import 'package:easy_localization/easy_localization.dart' hide TextDirection;
import 'package:flutter/widgets.dart';
import '../../../../theme/calm_tokens.dart';
import '../../../../theme/kallo_theme.dart';
import '../../logic/compare_rows.dart';

/// How wide the Free and the Premium columns are.
typedef ColumnWidths = ({double free, double pro});

/// One set of fixed columns keeps every heading, tick and quantity aligned.
abstract final class ComparisonColumns {
  /// The Free column only ever holds a glyph, "2 / 10" or its own heading;
  /// Pro also carries Vietnamese "Không giới hạn", the longest cell in either
  /// language.
  ///
  /// Both were measured against bundled Be Vietnam Pro metrics and both were
  /// a hair too tight on a real handset — "Miễn phí" (48.5 measured) wrapped
  /// inside 50 and then lost its second line to a fixed-height header row.
  /// They carry a few points of slack now, and [columnText] makes the fit
  /// unconditional rather than a measurement that has to keep being right.
  static const double freeColumn = 56;
  static const double proColumn = 92;
  static const ColumnWidths fixed = (free: freeColumn, pro: proColumn);

  /// The least air between two cells side by side in one row, and between a
  /// column's widest cell and its neighbour's.
  static const double _cellGap = 8;

  /// The narrowest table that sets labels in the regular reading size
  /// (16, dashBody). Wide phones fit every label on one line in both languages;
  /// narrower tables wrap enough Vietnamese rows to outgrow the screen, so
  /// they keep one step down (14, dashMeta). The threshold is the table's own
  /// 388pt width, not the whole window, so a narrow pane makes the same choice.
  static const double roomyWidth = 388;

  /// The narrowest table that sets every label on one line at 14pt. The
  /// longest, "Describe a meal in words", measures 168 with bundled Be
  /// Vietnam Pro; with the 8pt gap, both columns and the card's 32 of
  /// padding that is 356, plus a few points of slack.
  static const double unwrappedWidth = 360;

  /// The type under the row labels: column heads, notes and quantities sit
  /// one step below the label, whichever size the label is.
  static TextStyle small(
    bool roomy, {
    Color? color,
    FontWeight weight = FontWeight.w400,
  }) =>
      roomy
          ? dashMeta(color: color, weight: weight)
          : dashCaption(color: color, weight: weight);

  /// Column text that CANNOT wrap: it shrinks to fit instead.
  ///
  /// These two columns are fixed-width by design — that is what holds every
  /// tick on the same two verticals however long a row label runs — so text
  /// inside them has no room to reflow into. Wrapping was the failure mode,
  /// not the fallback. Same `FittedBox(scaleDown)` the meta row under the buy
  /// button and [SegmentedStrip]'s labels use, and for the same reason.
  static Widget columnText(String label, TextStyle style) => FittedBox(
    fit: BoxFit.scaleDown,
    child: Text(
      label,
      style: style,
      maxLines: 1,
      softWrap: false,
      textAlign: TextAlign.center,
    ),
  );

  /// The columns sized to what they hold, for a table too narrow to set
  /// every label on one line ([unwrappedWidth]). The fixed widths carry room
  /// for the longest cell in either language, which in English is mostly
  /// empty, and in a narrow table that room is what wrapped the labels.
  ///
  /// Each column is its widest cell (heading, quantity or glyph) in the
  /// current locale and text size, and the two grow evenly until no row's
  /// two cells sit closer than [_cellGap]. Measured live in the font that
  /// draws them, so the widest cell fits exactly and [columnText] never has
  /// to scale it down.
  static ColumnWidths fitted(
    BuildContext context,
    List<CompareRow> rows, {
    required bool roomy,
  }) {
    // The style, size and locale a [Text] here is drawn with, so the
    // measure is the width it will have.
    final base = DefaultTextStyle.of(context).style;
    final scaler = MediaQuery.textScalerOf(context);
    final locale = Localizations.maybeLocaleOf(context);
    double width(String label, TextStyle style) {
      final painter = TextPainter(
        text: TextSpan(text: label, style: base.merge(style), locale: locale),
        textDirection: TextDirection.ltr,
        textScaler: scaler,
        maxLines: 1,
      )..layout();
      final result = painter.width;
      painter.dispose();
      return result;
    }

    double cell(Cell value) => switch (value) {
      Included() || Excluded() => KalloIcons.tertiary,
      Quantity(:final text) => width(text, small(roomy)),
    };

    final pairs = [
      (
        width(tr('paywall.columnFree'), small(roomy)),
        width(tr('paywall.columnPro'), small(roomy, weight: FontWeight.w600)),
      ),
      for (final row in rows) (cell(row.free), cell(row.pro)),
    ];
    final free = pairs.map((p) => p.$1).reduce(math.max);
    final pro = pairs.map((p) => p.$2).reduce(math.max);
    final closest = pairs.map((p) => p.$1 + p.$2).reduce(math.max);
    final spare = math.max(0.0, closest + 2 * _cellGap - free - pro) / 2;
    return (free: free + spare, pro: pro + spare);
  }
}
