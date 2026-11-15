/// Three dials repeat the calorie mark; food glyphs distinguish their macros.
library;

import 'dart:math' as math;

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../theme/calm_tokens.dart';
import '../../../theme/kallo_theme.dart';
import '../../logic/macro_composition.dart';
import 'gauge_dial.dart';
import 'gauge_arc_geometry.dart';
import 'gauge_clear_area.dart';
import 'gauge_readout_line.dart';
import 'gauge_readout_type.dart';

/// Full size on a 390pt screen; [MacroDialRow] shrinks it on narrower ones.
const double kMacroDialRadius = 44;

/// At 36 the compact figures clear the stroke; 38 nearly joins the rings.
const double kCompactMacroDialRadius = 36;

/// Four-point gutters leave room for the Vietnamese fat label.
const double _gutter = KalloSpacing.sp1; // 4

/// The glyph reads as part of the word with a two-point gap.
const double _iconGap = KalloSpacing.sp0_5; // 2

/// Space reserved beside the calorie dial.
double macroDialRowWidth(double radius) =>
    kCompositionKeys.length * radius * 2 +
    (kCompositionKeys.length - 1) * _gutter;

/// Remaining width for the compact calorie dial and its skeleton.
double calorieDialRoom(double width, {double gap = KalloSpacing.sp2}) =>
    width - gap - macroDialRowWidth(kCompactMacroDialRadius);

const Map<String, String> _labelKey = {
  'protein': 'dashboard.protein',
  'carbohydrate': 'dashboard.carbs',
  'fat': 'dashboard.fat',
};

/// Owns macro keys, pigments and labels so callers cannot disagree.
class MacroDialRow extends StatelessWidget {
  const MacroDialRow({
    required this.current,
    required this.target,
    this.atLeast = const {},
    super.key,
  }) : maxRadius = kMacroDialRadius,
       _isCompact = false;

  /// Smaller figures clear the mouth beside `CalorieDial.compact`.
  const MacroDialRow.compact({
    required this.current,
    required this.target,
    this.atLeast = const {},
    super.key,
  }) : maxRadius = kCompactMacroDialRadius,
       _isCompact = true;

  final Map<String, int> current;

  final Map<String, int> target;

  /// Keys whose [current] is a floor — a meal's unknown value was left out.
  final Set<String> atLeast;

  final double maxRadius;
  final bool _isCompact;

  @override
  Widget build(BuildContext context) => LayoutBuilder(
    builder: (context, constraints) {
      final count = kCompositionKeys.length;
      final column = (constraints.maxWidth - _gutter * (count - 1)) / count;
      final radius = math.min(maxRadius, column / 2);
      var fit = 1.0;
      if (_isCompact) {
        final scaler = MediaQuery.textScalerOf(context);
        final primaryStyle = gaugeCompactFigure();
        final secondaryStyle = gaugeDenominator();
        final h1 =
            scaler.scale(primaryStyle.fontSize!) * (primaryStyle.height ?? 1);
        final h2 =
            scaler.scale(secondaryStyle.fontSize!) *
            (secondaryStyle.height ?? 1);
        final tip = gaugeTipOffset(radius);
        for (final key in kCompositionKeys) {
          final lines = [
            GaugeLine(
              '${atLeast.contains(key) ? '≥' : ''}${current[key] ?? 0}g',
              primaryStyle,
            ),
            GaugeLine('/${target[key] ?? 0}g', secondaryStyle),
          ];
          for (var i = 0; i < 2; i++) {
            final top = i == 0 ? tip - h2 / 2 - 2 - h1 : tip - h2 / 2;
            final width =
                2 *
                gaugeClearHalfWidthForBand(
                  radius,
                  top,
                  top + (i == 0 ? h1 : h2),
                );
            final wanted = gaugeLineWidth(context, lines[i]);
            if (wanted > width) {
              fit = math.min(
                fit,
                math.max(0, width - 2 * kGaugeReadoutClearMargin) / wanted,
              );
            }
          }
        }
      }
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
                readoutScale: _isCompact ? fit : null,
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
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(kMacroIcons[compositionKey]!, size: 14, color: color),
            const SizedBox(width: _iconGap),
            Flexible(
              child: FittedBox(
                fit: BoxFit.scaleDown,
                child: Text(
                  tr(_labelKey[compositionKey]!).toUpperCase(),
                  maxLines: 1,
                  style: dashEyebrow(),
                ),
              ),
            ),
          ],
        ),
        // Larger arcs need more optical room below the label.
        SizedBox(height: isCompact ? KalloSpacing.sp0_5 : KalloSpacing.sp1_5),
        GaugeDial(
          readoutScale: readoutScale,
          progress: target > 0 ? current / target : 0,
          radius: radius,
          fill: color,
          clampReadout: true,
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
