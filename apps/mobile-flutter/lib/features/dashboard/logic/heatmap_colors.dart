/// Vendored twin of `components/dashboard/progress/heatmap-colors.ts` (repo
/// root, the Next.js app) — keep the bands, the legend stops and the on-track
/// label set in sync with it.
///
/// Pure helper. The resolved light-theme hex values mirror
/// `KalloColors.heatmap*` exactly (the RN copy hardcodes the same hexes because
/// CSS `var(--…)` does not resolve outside the web).
library;

import 'dart:ui';

import '../../../theme/kallo_colors.dart';

/// One hue, five steps of opacity, plus one colour that is not on the scale at
/// all.
///
/// **Green says how much of the goal the day reached**, deepening to target and
/// stopping there. Within it more is better, monotonically, the way a
/// contribution graph reads — so a pale cell is unambiguously "ate less", never
/// "off target in some direction".
///
/// Over-target does NOT continue the ramp. If it did, a 60% day and a 150% day
/// would land on the same pale green while still faintly reading as "some
/// good", which is the exact ambiguity the ramp exists to avoid. Eating past
/// the goal is a different kind of day, so it gets a different colour.
abstract final class HeatmapColors {
  /// The one hue the scale is built from.
  static const Color scale = KalloColors.heatmapOnTarget; // #7ca368

  /// Over target — the one warm cell, ungraded on purpose. 120% and 200% are
  /// the same colour; the figure is a tap away.
  static const Color over = KalloColors.heatmapFar; // #d37b69

  /// Cheat days are neutral — a calm warm ring + fill instead of intensity
  /// grading (web `--kallo-cheat` / `--kallo-cheat-fill`), never red.
  static const Color cheat = KalloColors.accent; // #c9a87c
  static const Color cheatFill = Color(0xFFF3E6D2);

  /// The ramp, as alpha applied to [scale]. Ported from amicro's
  /// `dither-heatmap`, which paints one hex at five opacities rather than five
  /// hues — that is what lets an empty cell be the same material as a full one
  /// instead of a grey from a second palette.
  static const double onTarget = 1.0;
  static const double nearlyFull = 0.80;
  static const double light = 0.55;
  static const double veryLight = 0.30;

  /// Nothing logged, or outside the window. Not grey: the scale's own hue at a
  /// whisper, so the grid reads as one material.
  static const double empty = 0.08;

  /// A logged day under the gate that the user has NOT attested yet — the one
  /// cell that wants them to act, so it is the one cell with a ring.
  ///
  /// 0.16 rather than [empty]: at the 15px cell an iPhone SE draws, an 8%
  /// interior is indistinguishable from an empty cell and the 1px ring is the
  /// only difference. 0.16 still sits below [veryLight], so it reads as "less
  /// than the lowest real step" and adds no rung to the ladder.
  static const double awaiting = 0.16;

  static Color scaleAt(double opacity) => scale.withValues(alpha: opacity);
}

/// The two boundaries of the scale.
///
/// [gate] is deliberately the SAME number as the server's
/// `PARTIAL_DAY_FRACTION`: a day either reached 85% of its target or it did
/// not, and that one fact decides both whether the day counts toward trends and
/// where it lands on the ramp. Two numbers here would be two stories.
abstract final class HeatmapBands {
  /// At or above this fraction of target, the day is on target.
  static const double gate = 0.85;

  /// Above this, the day has gone past the goal and leaves the green ramp.
  static const double overTarget = 1.15;

  /// The label keys that count toward "% on track". The score reads this rather
  /// than re-deriving a threshold, so it can never drift from the colours on
  /// screen.
  static const Set<String> onTrackLabels = {'onTarget'};
}

/// Resolved fill + i18n label key for a cell's adherence [ratio]
/// (1.0 == exactly on target). Mirrors web `getHeatmapColor`.
///
/// The three sub-[HeatmapBands.gate] steps are reachable ONLY for a day the
/// user attested: the server nulls `ratio` on an unattested day under the gate,
/// so it never arrives here. A pale green cell therefore always means "the user
/// confirmed they ate this little", never "we are guessing".
({Color? bg, String labelKey}) getHeatmapColor(double? ratio) {
  if (ratio == null) return (bg: null, labelKey: 'noData');

  if (ratio > HeatmapBands.overTarget) {
    return (bg: HeatmapColors.over, labelKey: 'overTarget');
  }
  if (ratio >= HeatmapBands.gate) {
    return (
      bg: HeatmapColors.scaleAt(HeatmapColors.onTarget),
      labelKey: 'onTarget',
    );
  }
  if (ratio >= 0.65) {
    return (
      bg: HeatmapColors.scaleAt(HeatmapColors.nearlyFull),
      labelKey: 'nearlyFull',
    );
  }
  if (ratio >= 0.40) {
    return (bg: HeatmapColors.scaleAt(HeatmapColors.light), labelKey: 'light');
  }
  return (
    bg: HeatmapColors.scaleAt(HeatmapColors.veryLight),
    labelKey: 'veryLight',
  );
}
