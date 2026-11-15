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

import 'package:flutter/material.dart';

import '../../../../theme/kallo_theme.dart';
import '../../../logic/text_fit/macro_readout_fit.dart';
import 'macro_dial.dart';
import '../../../logic/macro_composition.dart';

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
/// Tight gaps spare the label from scaling down further — the arcs already
/// shrink, and the 12px screen inset is the app-wide rhythm.
const double _gutter = KalloSpacing.sp1; // 4

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
      final fit =
          _isCompact
              ? macroReadoutFit(
                context,
                radius: radius,
                current: current,
                target: target,
                atLeast: atLeast,
              )
              : 1.0;
      return Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          for (var i = 0; i < count; i++) ...[
            if (i > 0) const SizedBox(width: _gutter),
            Expanded(
              child: MacroDial(
                compositionKey: kCompositionKeys[i],
                current: current[kCompositionKeys[i]] ?? 0,
                target: target[kCompositionKeys[i]] ?? 0,
                atLeast: atLeast.contains(kCompositionKeys[i]),
                radius: radius,
                isCompact: _isCompact,
                readoutScale: _isCompact ? fit : null,
              ),
            ),
          ],
        ],
      );
    },
  );
}
