/// Vendored twin of `lib/domain/dashboard/heatmap-range.ts` (repo root, the
/// Next.js app) — keep the minimum cell sizes and the gap table in sync with it.
///
/// Pure helper, no widgets.
library;

import '../../../models/profile/heatmap.dart';

/// Cell gap per range, in logical pixels. A denser range gets a tighter gap:
/// at 53 columns a 2px gutter eats more width than the cells it separates.
const Map<HeatmapRange, double> heatmapCellGap = {
  HeatmapRange.d30: 3,
  HeatmapRange.d90: 2,
  HeatmapRange.year: 1,
};

/// Columns each range draws.
const Map<HeatmapRange, int> heatmapWeekCount = {
  HeatmapRange.d30: 5,
  HeatmapRange.d90: 14,
  HeatmapRange.year: 53,
};

/// The smallest cell each range stays readable at.
const double _yearMinCell = 10;
const double _range90MinCell = 14;

/// The largest cell each range is allowed to grow to.
///
/// Without a ceiling the grid has only a floor, so on a tablet the 90-day
/// window inflates to ~51px tiles — a brick wall whose 2px gutters vanish,
/// showing no more data than a phone does. The ceiling is what makes extra
/// width buy HISTORY (a wider range) instead of bigger squares.
const Map<HeatmapRange, double> heatmapMaxCell = {
  HeatmapRange.d30: 32,
  HeatmapRange.d90: 24,
  HeatmapRange.year: 28,
};

double _cellSizeFor(double width, int columns, HeatmapRange range) {
  final gap = heatmapCellGap[range]!;
  final available = width - (columns - 1) * gap;
  return (available / columns).floorToDouble();
}

/// The widest range whose cells still read at [availableWidth].
///
/// Ported from the web so the two platforms cannot disagree about what a given
/// width should show. A phone never reaches the year threshold, so phone
/// rendering is unchanged; a tablet resolves to the year and gets ~4x the
/// history at a comfortable cell instead of the same 90 days blown up.
HeatmapRange chooseRenderedHeatmapRange({
  required HeatmapRange preferredRange,
  required double availableWidth,
}) {
  if (preferredRange == HeatmapRange.d30) return HeatmapRange.d30;

  final range90Cell = _cellSizeFor(
    availableWidth,
    heatmapWeekCount[HeatmapRange.d90]!,
    HeatmapRange.d90,
  );
  if (preferredRange == HeatmapRange.d90) {
    return range90Cell >= _range90MinCell ? HeatmapRange.d90 : HeatmapRange.d30;
  }

  final yearCell = _cellSizeFor(
    availableWidth,
    heatmapWeekCount[HeatmapRange.year]!,
    HeatmapRange.year,
  );
  if (yearCell >= _yearMinCell) return HeatmapRange.year;
  if (range90Cell >= _range90MinCell) return HeatmapRange.d90;
  return HeatmapRange.d30;
}

/// The range a grid of [columns] weeks is drawing.
///
/// Rendering reads this rather than the range the width resolved to: a wider
/// layout requests the year, but the 90-day grid is still on screen until that
/// request lands, and drawing 53 columns' data with 14 columns' gap (or the
/// reverse) is exactly the kind of one-frame mismatch nobody notices in review
/// and everybody notices on a device.
HeatmapRange heatmapRangeForColumns(int columns) {
  if (columns >= heatmapWeekCount[HeatmapRange.year]!) return HeatmapRange.year;
  if (columns > heatmapWeekCount[HeatmapRange.d30]!) return HeatmapRange.d90;
  return HeatmapRange.d30;
}

/// The gap between the weekday gutter and the first column. Lives here rather
/// than in the card because it is part of the grid's width arithmetic, and both
/// functions below have to subtract exactly what the card lays out.
const double heatmapDayLabelGutter = 4;

/// Width left for the cells once the weekday gutter is taken out.
double _gridWidth(double contentWidth, double dayLabelWidth) =>
    contentWidth - dayLabelWidth - heatmapDayLabelGutter;

/// The range a card of this width should ASK FOR.
HeatmapRange heatmapRangeForWidth({
  required double contentWidth,
  required double dayLabelWidth,
}) => chooseRenderedHeatmapRange(
  preferredRange: HeatmapRange.year,
  availableWidth: _gridWidth(contentWidth, dayLabelWidth),
);

/// Cell edge for the width the card was handed.
///
/// Clamped at BOTH ends. The floor keeps a narrow phone legible; the ceiling is
/// what stops a tablet inflating the 90-day grid into ~51px tiles whose gutters
/// vanish — extra width should buy history (a wider range, via
/// [heatmapRangeForWidth]), never bigger squares.
double heatmapCellSize({
  required double contentWidth,
  required double dayLabelWidth,
  required int numWeeks,
  required HeatmapRange range,
}) {
  if (numWeeks <= 0) return 10;
  final gap = heatmapCellGap[range]!;
  final available =
      _gridWidth(contentWidth, dayLabelWidth) - (numWeeks - 1) * gap;
  return (available / numWeeks).floorToDouble().clamp(
    10,
    heatmapMaxCell[range]!,
  );
}
