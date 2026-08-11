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

/// A round kcal gridline step giving ~3–5 lines across the data range, plus the
/// derived axis top. The axis always reaches at least 3000 kcal so the 2500 /
/// 3000 guides show, and grows past that if intake exceeds it.
MacroTrendAxis buildMacroTrendAxis(double maxY) {
  final axisTarget = maxY > 3000 ? maxY : 3000.0;
  final step = _niceStep(axisTarget);
  final maxLabel = (axisTarget / step).ceil() * step;
  return MacroTrendAxis(
    step: step,
    maxLabel: maxLabel,
    topY: maxLabel + step * 0.35,
  );
}

double _niceStep(double maxV) {
  const steps = [250.0, 500.0, 1000.0, 1500.0, 2000.0];
  // <= 6 so a ~3000 axis keeps a 500 step (shows 2500 and 3000), not 1000.
  for (final s in steps) {
    if (maxV / s <= 6) return s;
  }
  return 2500;
}
