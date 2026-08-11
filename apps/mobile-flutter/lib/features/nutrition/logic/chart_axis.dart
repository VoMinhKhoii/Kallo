/// Pure kcal-axis math for the macro trend chart. Mirror of web
/// `buildMacroTrendAxis` in `components/nutrition/sections/macro-trend-utils.ts`
/// (keep in sync).
library;

class MacroTrendAxis {
  const MacroTrendAxis({
    required this.step,
    required this.maxLabel,
    required this.topY,
  });

  /// Gridline interval, in kcal.
  final double step;

  /// The highest labelled gridline.
  final double maxLabel;

  /// Axis ceiling, with headroom so the top label isn't clipped.
  final double topY;
}

/// A round kcal gridline step giving ~3–6 lines across the data range, plus the
/// derived axis top.
///
/// Scales to the data. A fixed 3000 kcal ceiling used to keep the axis identical
/// across ranges, but a month averaging 1400 then drew every bar inside the
/// bottom third under half a chart of empty grid — comparability across ranges
/// nobody was making, paid for in the resolution of the one chart on screen.
MacroTrendAxis buildMacroTrendAxis(double maxY) {
  final axisTarget = maxY > 1 ? maxY : 1.0;
  final step = _niceStep(axisTarget);
  final maxLabel = (axisTarget / step).ceil() * step;
  return MacroTrendAxis(
    step: step,
    maxLabel: maxLabel,
    topY: maxLabel + step * 0.35,
  );
}

double _niceStep(double maxV) {
  // First step that keeps the gridlines under seven. 100 floors the scale so a
  // near-empty chart doesn't label in tens.
  const steps = [100.0, 250.0, 500.0, 1000.0, 2000.0];
  for (final s in steps) {
    if (maxV / s <= 6) return s;
  }
  return 2500;
}
