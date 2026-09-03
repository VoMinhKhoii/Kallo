/// HeatmapMonthStrip — the month headers that sit above the adherence grid.
///
/// Split out of `adherence_heatmap.dart` (2026-09-03) with the one thing the
/// card kept getting wrong: its HEIGHT. The strip used to be a hard-coded 16,
/// sized when the meta tier was 12pt; at 14 × 1.25 the label's line box bled
/// through the 4pt gap and into the grid's first cell row, and scaled text made
/// it worse. [heightFor] measures the strip from the style it will actually
/// paint in, so the card and the strip can never disagree about it again.
///
/// Positioning still comes from `logic/heatmap_month_labels.dart`, which shifts
/// colliding headers and drops the ones too narrow to label.
library;

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../../models/profile/dashboard.dart';
import '../../logic/heatmap_month_labels.dart';

class HeatmapMonthStrip extends StatelessWidget {
  const HeatmapMonthStrip({
    super.key,
    required this.headers,
    required this.cellSize,
    required this.gap,
    required this.gridWidth,
    required this.style,
    required this.height,
  });

  final List<HeatmapMonthHeader> headers;
  final double cellSize;
  final double gap;
  final double gridWidth;
  final TextStyle style;

  /// From [heightFor] — passed in rather than measured here so the day-label
  /// column can offset itself by the same number.
  final double height;

  /// The strip's line box at [scaler]: the label's scaled font size times its
  /// leading, rounded up to a whole pixel so the grid below never starts on a
  /// fraction of a row.
  static double heightFor(TextStyle style, TextScaler scaler) =>
      (scaler.scale(style.fontSize!) * (style.height ?? 1.25)).ceilToDouble();

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: height,
      width: gridWidth,
      child: Stack(
        children: [
          for (final box in layoutMonthLabels(
            headers: headers,
            cellSize: cellSize,
            gap: gap,
            gridWidth: gridWidth,
            style: style,
            locale: context.locale.toString(),
            textScaler: MediaQuery.textScalerOf(context),
          ))
            Positioned(
              top: 0,
              left: box.left,
              width: box.width,
              child: Text(
                box.month,
                maxLines: 1,
                softWrap: false,
                overflow: TextOverflow.clip,
                style: style,
              ),
            ),
        ],
      ),
    );
  }
}
