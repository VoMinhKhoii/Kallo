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
const double kCompactMacroDialRadius = 30;

/// Between two dial columns.
///
/// Tighter than the 8 it started at, and the tightening is load-bearing rather
/// than cosmetic: the row hands each column `(width - gutter * 2) / 3`, and on a
/// 390pt phone that left the fat label ~58pt for a word that measures ~58-62 —
/// so Vietnamese "CHẤT BÉO" ellipsized to "CHẤT B…" while "ĐẠM" and "CARB" fit.
/// The width has to come from somewhere, and the gaps are the only slack in the
/// row: the arcs already shrink to fit, the label is on the smallest size in the
/// system, and the screen inset is the app-wide 12px rhythm, which is not spare.
const double _gutter = KalloSpacing.sp1; // 4

/// A dial's glyph and its label. Same reason as [_gutter] — this is the biggest
/// single win of the three (it is per-column, not shared across the row) and the
/// glyph reads as part of the word at 2 just as well as at 6.
const double _iconGap = KalloSpacing.sp0_5; // 2

/// The label each dial wears, in the namespace every surface already reads.
const Map<String, String> _labelKey = {
  'protein': 'dashboard.protein',
  'carbohydrate': 'dashboard.carbs',
  'fat': 'dashboard.fat',
};

/// The row owns the keys, the pigments, the glyphs AND the labels, so a surface
/// that wants dials hands over two maps and nothing else. Every caller used to
/// spell the same three-row table itself, which is three chances to disagree
/// about what "carbs" is called.
class MacroDialRow extends StatelessWidget {
  const MacroDialRow({required this.current, required this.target, super.key})
    : maxRadius = kMacroDialRadius,
      _isCompact = false;

  /// The variant that sits beside `CalorieDial.compact` in a fixed header:
  /// two thirds of the radius, and the gram figure steps from Value 17 to Body
  /// 14 so it still clears the mouth at the 1.3 text-scale cap.
  const MacroDialRow.compact({
    required this.current,
    required this.target,
    super.key,
  }) : maxRadius = kCompactMacroDialRadius,
       _isCompact = true;

  /// Grams eaten so far, keyed by [kCompositionKeys].
  final Map<String, int> current;

  /// Grams the day is aiming at, keyed by [kCompositionKeys].
  final Map<String, int> target;

  final double maxRadius;
  final bool _isCompact;

  @override
  Widget build(BuildContext context) => LayoutBuilder(
    builder: (context, constraints) {
      // Three columns and two gutters. On a narrow phone the dials shrink
      // rather than overflow — the arc holds its proportions at any size.
      final count = kCompositionKeys.length;
      final column =
          (constraints.maxWidth - _gutter * (count - 1)) / count;
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
    required this.radius,
    required this.isCompact,
  });

  final String compositionKey;
  final int current;
  final int target;
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
        // The FULL-SIZE dial gets air here, the compact one does not. Both
        // gaps used to be 2, which on a 44pt arc reads as a label resting on
        // the stroke — proportionally half the room the same 2 buys on the
        // compact dial's 30pt arc, which is the one the reference screenshot
        // shows and which looked right on device. So the compact keeps 2, and
        // the Today row's dials get the 6 that restores the same optical gap
        // at their size.
        SizedBox(height: isCompact ? KalloSpacing.sp0_5 : KalloSpacing.sp1_5),
        GaugeDial(
          progress: target > 0 ? current / target : 0,
          radius: radius,
          fill: color,
          // Both lines here are bare figures, so they must stay inside the
          // ring: on device (2026-09-01) `202g` and `547g` ran across the
          // stroke on both sides once a macro reached three digits, on the
          // Today row and the Log header alike.
          clampReadout: true,
          // The figure steps down with the radius; the denominator does not.
          // Holding `/140g` at one size across both variants is what makes the
          // pair read as a value over its target rather than as two numbers of
          // arbitrary weight — and it is the relationship the reference
          // screenshot measures (14 over 12 compact, 17 over 12 full).
          primary: GaugeLine(
            '${current}g',
            isCompact ? gaugeCompactFigure() : gaugeFigure(),
          ),
          secondary: GaugeLine('/${target}g', gaugeDenominator()),
        ),
      ],
    );
  }
}
