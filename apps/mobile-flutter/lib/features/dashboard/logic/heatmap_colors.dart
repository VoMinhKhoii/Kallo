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

/// Resolved fill + i18n label key for a cell's adherence [ratio]
/// (1.0 == exactly on target). Mirrors web `getHeatmapColor`.
({Color? bg, String labelKey}) getHeatmapColor(double? ratio) {
  if (ratio == null) return (bg: null, labelKey: 'noData');

  // Bands are deliberately wide: two of the five colours read as red, so a
  // narrow scale painted an ordinary ±20% day as failure. Red now starts at
  // ±50% — "ate half or double the target" — which is worth noticing.
  final dist = (ratio - 1.0).abs();
  if (dist <= 0.1) return (bg: HeatmapColors.onTarget, labelKey: 'onTarget');
  if (dist <= 0.2) return (bg: HeatmapColors.close, labelKey: 'close');
  if (dist <= 0.35) {
    return (
      bg: HeatmapColors.slight,
      labelKey: ratio > 1 ? 'slightlyOver' : 'slightlyUnder',
    );
  }
  if (dist <= 0.5) {
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
