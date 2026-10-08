/// The three macro dials — the same arc as the calorie dial, a third of the
/// size, in each macro's own pigment.
///
/// Replaces the labelled progress bars both the dock and the logging header
/// used to draw. A bar reads its value against a track that runs the full width
/// of the surface, which put three long horizontal rules beside a round dial and
/// made the two halves look unrelated. The dial repeats the calorie mark's
/// shape, so the section reads as one family of objects.
///
/// The glyph carries the identity: pigment alone cannot separate three arcs
/// this small, and the beef / wheat / droplet set is already the app's macro
/// vocabulary (Circle's feed draws the same three).
library;

import 'dart:math' as math;

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../theme/calm_tokens.dart';
import '../../../theme/kallo_theme.dart';
import '../../logic/macro_composition.dart';
import 'gauge_dial.dart';
import 'gauge_readout_type.dart';

/// Full size on a 390pt screen; [MacroDialRow] shrinks it on narrower ones.
const double kMacroDialRadius = 44;

/// The embedded size — see [MacroDialRow.compact].
///
/// 36, up from 30 (2026-09-27). The logging header hands each column ~78pt
/// whatever the dial's size, and at 30 the ring used 60 of it with "115g"
/// sitting ~1.5pt off the stroke. At 36 the figure clears it by ~5.4pt, it
/// stays full size at the 1.3 text-scale cap on a typical day, and the arcs
/// still end above the calorie dial's, so the header grows no taller. 38 was
/// measured too: the rings then nearly touch across the gutters.
const double kCompactMacroDialRadius = 36;

/// Between two dial columns.
///
/// Tighter than the 8 it started at, and load-bearing: at 8 a 390pt phone left
/// the fat label ~58pt for a word measuring ~58-62, so "CHẤT BÉO" ellipsized.
/// The gaps are the row's only slack — the arcs already shrink, the label is
/// the smallest size, and the 12px screen inset is the app-wide rhythm.
const double _gutter = KalloSpacing.sp1; // 4

/// A dial's glyph and its label. Same reason as [_gutter], and the biggest win
/// (per-column); the glyph reads as part of the word at 2 as well as at 6.
const double _iconGap = KalloSpacing.sp0_5; // 2

/// The width a row of three [radius] dials needs to draw them at that size —
/// what a surface subtracts before handing the rest to the calorie dial.
double macroDialRowWidth(double radius) =>
    kCompositionKeys.length * radius * 2 +
    (kCompositionKeys.length - 1) * _gutter;

/// What a header [width] wide can spare for the calorie dial beside a
/// compact macro row at full size, after the [gap] between them. The logging
/// header and its skeleton both size the calorie dial from this.
double calorieDialRoom(double width, {double gap = KalloSpacing.sp2}) =>
    width - gap - macroDialRowWidth(kCompactMacroDialRadius);

/// The label each dial wears, in the namespace every surface already reads.
const Map<String, String> _labelKey = {
  'protein': 'dashboard.protein',
  'carbohydrate': 'dashboard.carbs',
  'fat': 'dashboard.fat',
};

/// The row owns the keys, pigments, glyphs AND labels, so a surface hands over
/// two maps and nothing else — no caller can disagree about what "carbs" is.
class MacroDialRow extends StatelessWidget {
  const MacroDialRow({
    required this.current,
    required this.target,
    this.atLeast = const {},
    super.key,
  }) : maxRadius = kMacroDialRadius,
       _isCompact = false;

  /// The variant that sits beside `CalorieDial.compact` in a fixed header:
  /// a smaller radius, and the gram figure steps from the dial's pinned 17 to
  /// 14 so it still clears the mouth at the 1.3 text-scale cap.
  const MacroDialRow.compact({
    required this.current,
    required this.target,
    this.atLeast = const {},
    super.key,
  }) : maxRadius = kCompactMacroDialRadius,
       _isCompact = true;

  /// Grams eaten so far, keyed by [kCompositionKeys].
  final Map<String, int> current;

  /// Grams the day is aiming at, keyed by [kCompositionKeys].
  final Map<String, int> target;

  /// Keys whose [current] is a floor — a meal's unknown value was left out.
  final Set<String> atLeast;

  final double maxRadius;
  final bool _isCompact;

  @override
  Widget build(BuildContext context) => LayoutBuilder(
    builder: (context, constraints) {
      // Three columns and two gutters. On a narrow phone the dials shrink
      // rather than overflow — the arc holds its proportions at any size.
      final count = kCompositionKeys.length;
      final column = (constraints.maxWidth - _gutter * (count - 1)) / count;
      final radius = math.min(maxRadius, column / 2);
      return Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          for (var i = 0; i < count; i++) ...[
            if (i > 0) const SizedBox(width: _gutter),
            Expanded(
              child: _MacroDial(
                compositionKey: kCompositionKeys[i],
                current: current[kCompositionKeys[i]] ?? 0,
                target: target[kCompositionKeys[i]] ?? 0,
                atLeast: atLeast.contains(kCompositionKeys[i]),
                radius: radius,
                isCompact: _isCompact,
              ),
            ),
          ],
        ],
      );
    },
  );
}

class _MacroDial extends StatelessWidget {
  const _MacroDial({
    required this.compositionKey,
    required this.current,
    required this.target,
    required this.atLeast,
    required this.radius,
    required this.isCompact,
  });

  final String compositionKey;
  final int current;
  final int target;
  final bool atLeast;
  final double radius;
  final bool isCompact;

  @override
  Widget build(BuildContext context) {
    final color = kCompositionColors[compositionKey]!;

    return Column(
      children: [
        // The title sits on the arc, not floating above it: the dial is drawn
        // with no dead space over its stroke, so one tight gap binds them.
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(kMacroIcons[compositionKey]!, size: 14, color: color),
            const SizedBox(width: _iconGap),
            Flexible(
              child: Text(
                tr(_labelKey[compositionKey]!).toUpperCase(),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: dashEyebrow(),
              ),
            ),
          ],
        ),
        // The FULL-SIZE dial gets air here, the compact one does not: 2 on a
        // 44pt arc read as a label resting on the stroke — half the optical
        // room it buys on the compact arc, which looked right on device. 6
        // restores the same gap at the Today row's size.
        SizedBox(height: isCompact ? KalloSpacing.sp0_5 : KalloSpacing.sp1_5),
        GaugeDial(
          progress: target > 0 ? current / target : 0,
          radius: radius,
          fill: color,
          // Bare figures must stay inside the ring: on device (2026-09-01)
          // three-digit `202g` ran across the stroke on both surfaces.
          clampReadout: true,
          // The figure steps down with the radius; the denominator does not.
          // Holding `/140g` at one size across both variants is what makes the
          // pair read as a value over its target rather than as two numbers of
          // arbitrary weight — and it is the relationship the reference
          // screenshot measures (14 over 12 compact, 17 over 12 full).
          primary: GaugeLine(
            '${atLeast ? '≥' : ''}${current}g',
            isCompact ? gaugeCompactFigure() : gaugeFigure(),
          ),
          secondary: GaugeLine('/${target}g', gaugeDenominator()),
        ),
      ],
    );
  }
}
