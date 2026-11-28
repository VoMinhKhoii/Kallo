import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../../theme/calm_tokens.dart';
import '../../../../theme/kallo_theme.dart';
import '../../../logic/macro_composition.dart';
import '../gauge_dial.dart';
import '../gauge_readout_type.dart';

/// A dial's glyph and its label share the row's tight-spacing rationale:
/// the glyph reads as part of the word at 2 as well as at 6, saving room in
/// every column for the Vietnamese labels.
const double kMacroIconGap = KalloSpacing.sp0_5; // 2

/// The label each dial wears, in the namespace every surface already reads.
const Map<String, String> kMacroLabelKey = {
  'protein': 'dashboard.protein',
  'carbohydrate': 'dashboard.carbs',
  'fat': 'dashboard.fat',
};

class MacroDial extends StatelessWidget {
  const MacroDial({
    super.key,
    required this.compositionKey,
    required this.current,
    required this.target,
    required this.atLeast,
    required this.radius,
    required this.isCompact,
    required this.readoutScale,
  });

  final String compositionKey;
  final int current;
  final int target;
  final bool atLeast;
  final double radius;
  final bool isCompact;
  final double? readoutScale;

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
            const SizedBox(width: kMacroIconGap),
            Flexible(
              child: FittedBox(
                fit: BoxFit.scaleDown,
                child: Text(
                  tr(kMacroLabelKey[compositionKey]!).toUpperCase(),
                  maxLines: 1,
                  style: dashEyebrow(),
                ),
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
          readoutScale: readoutScale,
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
