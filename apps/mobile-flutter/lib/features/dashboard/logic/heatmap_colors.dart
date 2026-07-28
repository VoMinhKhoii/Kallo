/// Vendored from the RN `lib/dashboard/logic/heatmap-colors.ts` — keep in sync.
///
/// Pure helper. The resolved light-theme hex values mirror
/// `NhamColors.heatmap*` exactly (the RN copy hardcodes the same hexes because
/// CSS `var(--…)` does not resolve outside the web).
library;

import 'dart:ui';

import '../../../theme/nham_colors.dart';

/// The diverging adherence scale, as hex strings (used by the SVG legend
/// gradient and as raw fills).
abstract final class HeatmapColors {
  static const Color onTarget = NhamColors.heatmapOnTarget; // #7ca368
  static const Color close = NhamColors.heatmapClose; // #a6c495
  static const Color slight = NhamColors.heatmapSlight; // #d4c9ad
  static const Color moderate = NhamColors.heatmapModerate; // #e09c84
  static const Color far = NhamColors.heatmapFar; // #d37b69

  /// Cheat days are neutral — a calm warm ring + fill instead of intensity
  /// grading (web `--nham-cheat` / `--nham-cheat-fill`), never red.
  static const Color cheat = NhamColors.accent; // #c9a87c
  static const Color cheatFill = Color(0xFFF3E6D2);
}

/// The band edges, as `|ratio - 1|`. The classifier below and the legend bar
/// both read these, so the bar can never again advertise a scale the cells
/// don't actually use.
///
/// Deliberately wide: two of the five colours read as red, so a narrow scale
/// painted an ordinary ±20% day as failure. Red starts at ±50% — "ate half or
/// double the target" — which is worth noticing.
abstract final class HeatmapBands {
  static const double onTarget = 0.10;
  static const double close = 0.20;
  static const double slight = 0.35;
  static const double moderate = 0.50;

  /// Where each band ENDS along a 0..1 "off target → on target" axis, for the
  /// legend. Derived from the edges above by mapping distance onto position
  /// (`1 - dist / moderate`) so every colour occupies its true share of the
  /// bar instead of an equal fifth.
  static const List<double> legendStops = [
    0.0, // far — everything past `moderate` collapses onto the left edge
    (moderate - slight) / moderate / 2, // moderate band's midpoint
    1 - (slight + close) / 2 / moderate, // slight band's midpoint
    1 - (close + onTarget) / 2 / moderate, // close band's midpoint
    1.0, // onTarget
  ];

  /// The score band for "% on track" — the top two tiers, green + light green.
  static const double onTrack = close;
}

/// Resolved fill + i18n label key for a cell's adherence [ratio]
/// (1.0 == exactly on target). Mirrors web `getHeatmapColor`.
({Color? bg, String labelKey}) getHeatmapColor(double? ratio) {
  if (ratio == null) return (bg: null, labelKey: 'noData');

  final dist = (ratio - 1.0).abs();
  if (dist <= HeatmapBands.onTarget) {
    return (bg: HeatmapColors.onTarget, labelKey: 'onTarget');
  }
  if (dist <= HeatmapBands.close) {
    return (bg: HeatmapColors.close, labelKey: 'close');
  }
  if (dist <= HeatmapBands.slight) {
    return (
      bg: HeatmapColors.slight,
      labelKey: ratio > 1 ? 'slightlyOver' : 'slightlyUnder',
    );
  }
  if (dist <= HeatmapBands.moderate) {
    return (
      bg: HeatmapColors.moderate,
      labelKey: ratio > 1 ? 'over' : 'under',
    );
  }
  return (
    bg: HeatmapColors.far,
    labelKey: ratio > 1 ? 'farOver' : 'farUnder',
  );
}
