import 'package:flutter/widgets.dart';
import '../../../../theme/calm_tokens.dart';

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

  /// The narrowest table that sets labels in the regular reading size
  /// (16, dashBody). Wide phones fit every label on one line in both languages;
  /// narrower tables wrap enough Vietnamese rows to outgrow the screen, so
  /// they keep one step down (14, dashMeta). The threshold is the table's own
  /// 388pt width, not the whole window, so a narrow pane makes the same choice.
  static const double roomyWidth = 388;

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
}
