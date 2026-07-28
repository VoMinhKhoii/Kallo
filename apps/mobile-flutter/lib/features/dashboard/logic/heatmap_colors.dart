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

/// The band edges, as `|ratio - 1|`. The classifier below, the legend bar and
/// the "% on track" score all read these, so none can drift from the others.
///
/// Deliberately wide AND asymmetric: two of the five colours read as red, so a
/// narrow symmetric scale painted an ordinary day as failure in both
/// directions.
abstract final class HeatmapBands {
  /// OVER target — eating more than planned is the signal worth keeping sharp.
  static const double onTargetOver = 0.10;
  static const double closeOver = 0.20;
  static const double slightOver = 0.35;
  static const double moderateOver = 0.50;

  /// UNDER target — deliberately more forgiving than the over side.
  ///
  /// The bands used to be symmetric, which read the two directions as equally
  /// bad. They are not. Eating 20% under target is a light day; eating 20%
  /// over is the thing a tracker exists to surface. More importantly, most
  /// under-target days are **under-LOGGED**, not under-eaten — a forgotten
  /// snack looks identical to a deficit — so punishing that side coloured
  /// ordinary days as failure and made the grid read as a wall of warm cells.
  static const double onTargetUnder = 0.20;
  static const double closeUnder = 0.30;
  static const double slightUnder = 0.40;
  static const double moderateUnder = 0.50;

  /// Gradient stops that render the legend as five EQUAL discrete segments,
  /// one per tier.
  ///
  /// Equal on purpose. A legend is a key — it names the vocabulary, it does not
  /// measure anything. Sizing the slices to the bands' widths in ratio space
  /// made the two warm tiers occupy nearly half the bar, which read as "most of
  /// your days are bad" before a single cell had been drawn. Nobody can read a
  /// band width off a 6px bar anyway.
  static const List<double> legendStops = [
    0.0, 0.2, // far
    0.2, 0.4, // moderate
    0.4, 0.6, // slight
    0.6, 0.8, // close
    0.8, 1.0, // onTarget
  ];

  /// The label keys that count toward "% on track" — green + light green.
  /// The score reads these rather than re-deriving a threshold, so it can
  /// never drift from the colours on screen.
  static const Set<String> onTrackLabels = {'onTarget', 'close'};
}

/// Resolved fill + i18n label key for a cell's adherence [ratio]
/// (1.0 == exactly on target). Mirrors web `getHeatmapColor`.
({Color? bg, String labelKey}) getHeatmapColor(double? ratio) {
  if (ratio == null) return (bg: null, labelKey: 'noData');

  final over = ratio > 1;
  final dist = (ratio - 1.0).abs();
  // Asymmetric on purpose — see HeatmapBands.onTargetUnder.
  final onTarget =
      over ? HeatmapBands.onTargetOver : HeatmapBands.onTargetUnder;
  final close = over ? HeatmapBands.closeOver : HeatmapBands.closeUnder;
  final slight = over ? HeatmapBands.slightOver : HeatmapBands.slightUnder;
  final moderate =
      over ? HeatmapBands.moderateOver : HeatmapBands.moderateUnder;

  if (dist <= onTarget) {
    return (bg: HeatmapColors.onTarget, labelKey: 'onTarget');
  }
  if (dist <= close) return (bg: HeatmapColors.close, labelKey: 'close');
  if (dist <= slight) {
    return (
      bg: HeatmapColors.slight,
      labelKey: over ? 'slightlyOver' : 'slightlyUnder',
    );
  }
  if (dist <= moderate) {
    return (bg: HeatmapColors.moderate, labelKey: over ? 'over' : 'under');
  }
  return (bg: HeatmapColors.far, labelKey: over ? 'farOver' : 'farUnder');
}
