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

/// Full size on a 390pt screen; [MacroDialRow] shrinks it on narrower ones.
const double kMacroDialRadius = 44;

/// The embedded size — see [MacroDialRow.compact].
const double kCompactMacroDialRadius = 30;

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
          (constraints.maxWidth - KalloSpacing.sp2 * (count - 1)) / count;
      final radius = math.min(maxRadius, column / 2);
      return Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          for (var i = 0; i < count; i++) ...[
            if (i > 0) const SizedBox(width: KalloSpacing.sp2),
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
            const SizedBox(width: KalloSpacing.sp1_5),
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
        const SizedBox(height: KalloSpacing.sp0_5),
        GaugeDial(
          progress: target > 0 ? current / target : 0,
          radius: radius,
          fill: color,
          primary: GaugeLine(
            '${current}g',
            isCompact
                ? dashBody(weight: FontWeight.w500, tabular: true)
                : dashValue(),
          ),
          secondary: GaugeLine('/${target}g', dashMeta(tabular: true)),
        ),
      ],
    );
  }
}
