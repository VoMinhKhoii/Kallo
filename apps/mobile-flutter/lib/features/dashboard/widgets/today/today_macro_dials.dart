/// The dock's three macro dials — the same arc as the calorie dial, a third of
/// the size, in each macro's own pigment.
///
/// Replaces the labelled progress bars this file used to hold. A bar reads its
/// value against a track that runs the full width of the card, which put three
/// long horizontal rules under a round dial and made the two halves of the card
/// look unrelated. The dial repeats the calorie mark's shape, so the section
/// reads as one family of objects.
///
/// The glyph carries the identity: pigment alone cannot separate three arcs
/// this small, and the beef / wheat / droplet set is already the app's macro
/// vocabulary (Circle's feed draws the same three).
library;

import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../../../shared/logic/macro_composition.dart';
import '../../../../shared/widgets/gauge/rounded_gauge_arc.dart';
import '../../../../theme/calm_tokens.dart';
import '../../../../theme/kallo_theme.dart';

/// Full size on a 390pt screen; [MacroDialRow] shrinks it on narrower ones.
const double kMacroDialRadius = 44;

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
  const MacroDialRow({required this.macros, super.key});

  final List<MacroDialData> macros;

  @override
  Widget build(BuildContext context) => LayoutBuilder(
    builder: (context, constraints) {
      // Three columns and two gutters. On a narrow phone the dials shrink
      // rather than overflow — the arc holds its proportions at any size.
      final column =
          (constraints.maxWidth - KalloSpacing.sp2 * (macros.length - 1)) /
          macros.length;
      final radius = math.min(kMacroDialRadius, column / 2);
      return Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          for (var i = 0; i < macros.length; i++) ...[
            if (i > 0) const SizedBox(width: KalloSpacing.sp2),
            Expanded(child: _MacroDial(data: macros[i], radius: radius)),
          ],
        ],
      );
    },
  );
}

class _MacroDial extends StatelessWidget {
  const _MacroDial({required this.data, required this.radius});

  final MacroDialData data;
  final double radius;

  @override
  Widget build(BuildContext context) {
    final valueStyle = dashValue();
    final targetStyle = dashMeta(tabular: true);
    final scaler = MediaQuery.textScalerOf(context);
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
        SizedBox(
          height: gaugeHeight(radius),
          child: Stack(
            alignment: Alignment.topCenter,
            children: [
              RoundedGaugeArc(
                progress: data.target > 0 ? data.current / data.target : 0,
                outerRadius: radius,
                fill: color,
              ),
              Positioned(
                top: readoutTopFor(
                  outerRadius: radius,
                  primaryHeight: gaugeLineHeight(valueStyle, scaler),
                  secondaryHeight: gaugeLineHeight(targetStyle, scaler),
                ),
                left: 0,
                right: 0,
                child: Column(
                  children: [
                    Text('${data.current}g', style: valueStyle),
                    const SizedBox(height: kGaugeReadoutGap),
                    Text('/${data.target}g', style: targetStyle),
                  ],
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
