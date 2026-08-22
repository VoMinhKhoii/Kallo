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

import '../../../theme/calm_tokens.dart';
import '../../../theme/kallo_theme.dart';
import '../../logic/macro_composition.dart';
import 'gauge_dial.dart';

/// Full size on a 390pt screen; [MacroDialRow] shrinks it on narrower ones.
const double kMacroDialRadius = 44;

/// The embedded size — see [MacroDialRow.compact].
const double kCompactMacroDialRadius = 30;

class MacroDialData {
  const MacroDialData({
    required this.compositionKey,
    required this.label,
    required this.current,
    required this.target,
  });

  /// One of [kCompositionKeys] — picks the glyph and the pigment.
  final String compositionKey;
  final String label;
  final int current;
  final int target;
}

class MacroDialRow extends StatelessWidget {
  const MacroDialRow({required this.macros, super.key})
    : maxRadius = kMacroDialRadius,
      _headlineIsValue = true;

  /// The variant that sits beside `CalorieDial.compact` in a fixed header:
  /// two thirds of the radius, and the gram figure steps from Value 17 to Body
  /// 14 so it still clears the mouth at the 1.3 text-scale cap.
  const MacroDialRow.compact({required this.macros, super.key})
    : maxRadius = kCompactMacroDialRadius,
      _headlineIsValue = false;

  final List<MacroDialData> macros;
  final double maxRadius;
  final bool _headlineIsValue;

  @override
  Widget build(BuildContext context) => LayoutBuilder(
    builder: (context, constraints) {
      // Three columns and two gutters. On a narrow phone the dials shrink
      // rather than overflow — the arc holds its proportions at any size.
      final column =
          (constraints.maxWidth - KalloSpacing.sp2 * (macros.length - 1)) /
          macros.length;
      final radius = math.min(maxRadius, column / 2);
      return Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          for (var i = 0; i < macros.length; i++) ...[
            if (i > 0) const SizedBox(width: KalloSpacing.sp2),
            Expanded(
              child: _MacroDial(
                data: macros[i],
                radius: radius,
                headlineIsValue: _headlineIsValue,
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
    required this.data,
    required this.radius,
    required this.headlineIsValue,
  });

  final MacroDialData data;
  final double radius;
  final bool headlineIsValue;

  @override
  Widget build(BuildContext context) {
    final color = kCompositionColors[data.compositionKey]!;

    return Column(
      children: [
        // The title sits on the arc, not floating above it: the dial is drawn
        // with no dead space over its stroke, so one tight gap binds them.
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(kMacroIcons[data.compositionKey]!, size: 14, color: color),
            const SizedBox(width: KalloSpacing.sp1_5),
            Flexible(
              child: Text(
                data.label.toUpperCase(),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: dashEyebrow(),
              ),
            ),
          ],
        ),
        const SizedBox(height: KalloSpacing.sp0_5),
        GaugeDial(
          progress: data.target > 0 ? data.current / data.target : 0,
          radius: radius,
          fill: color,
          primary: GaugeLine(
            '${data.current}g',
            headlineIsValue
                ? dashValue()
                : dashBody(weight: FontWeight.w500, tabular: true),
          ),
          secondary: GaugeLine('/${data.target}g', dashMeta(tabular: true)),
        ),
      ],
    );
  }
}
