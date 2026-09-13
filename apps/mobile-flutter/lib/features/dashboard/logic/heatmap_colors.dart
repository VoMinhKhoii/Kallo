/// Vendored twin of `components/dashboard/progress/heatmap-colors.ts` (repo
/// root, the Next.js app) — keep the bands, the legend stops and the on-track
/// label set in sync with it.
///
/// Pure helper. The resolved light-theme hex values mirror
/// `KalloColors.heatmap*` exactly (the RN copy hardcodes the same hexes because
/// CSS `var(--…)` does not resolve outside the web).
library;

import 'package:flutter/painting.dart';

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
/// Where a day's ratio lands. The colour and the i18n key are both DERIVED from
/// this, so the two can never disagree — the on-track score asks for a tier, not
/// for a string that happens to spell one.
enum HeatmapTier { onTarget, nearlyFull, light, veryLight, overTarget, noData }

abstract final class HeatmapColors {
  /// The one hue the scale is built from.
  static const Color scale = KalloColors.heatmapOnTarget; // #7ca368

  /// Over target — the one warm cell, ungraded on purpose. 120% and 200% are
  /// the same colour; the figure is a tap away.
  static const Color over = KalloColors.heatmapFar; // #d37b69

  static Color scaleAt(double opacity) => scale.withValues(alpha: opacity);
}

/// The corner radius every cell and every legend swatch draws.
///
/// Here rather than private to each painting site: the grid and the key are
/// two surfaces drawing one shape, and a constant repeated in both with a
/// "keep these in sync" comment is precisely how the cheat cell and its swatch
/// drifted apart.
const double heatmapCellRadius = 3;

/// One cell's paint: a flat fill, optionally a ring around it.
///
/// [fill] is a [Gradient] only for the cheat day — the grid's one gradient.
typedef HeatmapCellPaint = ({Color fill, Gradient? gradient, Color? stroke});

/// What each kind of cell is painted with — the single definition the grid
/// painter AND the legend both read.
///
/// This exists because sharing the COLOURS was not enough. The cheat swatch
/// once drew a flat fill inside an accent ring while the cell drew a ringless
/// wash: both read the same palette, and still disagreed, because each
/// assembled its own recipe from the parts. What drifts is the assembly, so the
/// assembly is what has to be shared. Anything with a legend entry belongs
/// here; nothing else should build a cell's appearance from the raw tokens.
abstract final class HeatmapCellPaints {
  /// The cheat day — neutral, not a miss: it intentionally exceeds target, so
  /// it is never the warm over-target cell and never red.
  ///
  /// The aurora's two hues poured VERTICALLY, deliberately not
  /// `KalloGradients.brandSweep` — that is diagonal at full opacity and belongs
  /// to the tab bar's `+`, the app's one always-present create affordance.
  /// Sharing it would put the create gesture's signature on a history cell.
  ///
  /// The 0.92 wash is PRE-COMPOSITED onto `#F3E6D2` rather than layered over it
  /// at paint time. Blending at a fixed alpha is affine in the colour, so
  /// interpolating-then-blending and blending-then-interpolating are the same
  /// image — and collapsing it to one opaque gradient removes the two-pass
  /// recipe each surface previously had to reproduce correctly from a comment.
  ///
  /// Being the grid's only gradient is what lets this cell drop the ring and
  /// centre dot it used to need: nothing else here shimmers.
  static final HeatmapCellPaint cheat = (
    fill: const Color(0xFFF3E6D2),
    gradient: LinearGradient(
      begin: Alignment.topCenter,
      end: Alignment.bottomCenter,
      colors: [
        Color.alphaBlend(
          KalloColors.brandApricot.withValues(alpha: 0.92),
          const Color(0xFFF3E6D2),
        ),
        Color.alphaBlend(
          KalloColors.brandLilac.withValues(alpha: 0.92),
          const Color(0xFFF3E6D2),
        ),
      ],
    ),
    stroke: null,
  );

  /// A logged day under the gate that the user has NOT attested — the one cell
  /// that wants them to act, so the one cell with a ring.
  static final HeatmapCellPaint awaiting = (
    fill: HeatmapColors.scaleAt(HeatmapRamp.awaiting),
    gradient: null,
    stroke: KalloColors.textMuted,
  );

  /// Unlogged, future and out-of-range alike. The user does not need to tell
  /// them apart — none is a reading — and collapsing them keeps the empty state
  /// one material instead of several greys.
  static final HeatmapCellPaint empty = (
    fill: HeatmapColors.scaleAt(HeatmapRamp.empty),
    gradient: null,
    stroke: null,
  );

  /// A graded day. [HeatmapTier.noData] has nothing to grade, so it falls back
  /// to [empty]'s fill.
  static HeatmapCellPaint tier(HeatmapTier tier) => (
    fill: heatmapTierColor(tier) ?? empty.fill,
    gradient: null,
    stroke: null,
  );
}

/// The ramp, as alpha applied to [HeatmapColors.scale]. Ported from amicro's
/// `dither-heatmap`, which paints one hex at five opacities rather than five
/// hues — that is what lets an empty cell be the same material as a full one
/// instead of a grey from a second palette.
///
/// Separate from [HeatmapColors] because these are opacities, not colours, and
/// mirrors the web twin's `HEATMAP_RAMP`.
abstract final class HeatmapRamp {
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
}

/// Where a cell's adherence [ratio] lands (1.0 == exactly on target). Mirrors
/// web `heatmapTierFor`.
///
/// The three sub-[HeatmapBands.gate] steps are reachable ONLY for a day the
/// user attested: the server nulls `ratio` on an unattested day under the gate,
/// so it never arrives here. A pale green cell therefore always means "the user
/// confirmed they ate this little", never "we are guessing".
HeatmapTier heatmapTierFor(double? ratio) {
  if (ratio == null) return HeatmapTier.noData;
  if (ratio > HeatmapBands.overTarget) return HeatmapTier.overTarget;
  if (ratio >= HeatmapBands.gate) return HeatmapTier.onTarget;
  if (ratio >= 0.65) return HeatmapTier.nearlyFull;
  if (ratio >= 0.40) return HeatmapTier.light;
  return HeatmapTier.veryLight;
}

/// The fill a tier paints, or null when there is nothing to grade.
Color? heatmapTierColor(HeatmapTier tier) => switch (tier) {
  HeatmapTier.noData => null,
  HeatmapTier.overTarget => HeatmapColors.over,
  HeatmapTier.onTarget => HeatmapColors.scaleAt(HeatmapRamp.onTarget),
  HeatmapTier.nearlyFull => HeatmapColors.scaleAt(HeatmapRamp.nearlyFull),
  HeatmapTier.light => HeatmapColors.scaleAt(HeatmapRamp.light),
  HeatmapTier.veryLight => HeatmapColors.scaleAt(HeatmapRamp.veryLight),
};

/// The legend's ramp swatches, palest first. Mirrors web
/// `heatmapLegendSwatches`.
///
/// A discrete set, not a gradient bar: a continuous bar named only at its two
/// ends is what let the old five-tier scale over-promise, since the
/// under-target half it implied could never paint.
List<Color> heatmapLegendSwatches() =>
    const [
      HeatmapRamp.empty,
      HeatmapRamp.veryLight,
      HeatmapRamp.light,
      HeatmapRamp.nearlyFull,
      HeatmapRamp.onTarget,
    ].map(HeatmapColors.scaleAt).toList();
