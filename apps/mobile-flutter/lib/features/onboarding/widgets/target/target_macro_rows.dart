import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../../models/profile/onboarding.dart';
import '../../../../shared/logic/macro_composition.dart';
import '../../../../theme/calm_tokens.dart';
import '../../../../theme/kallo_theme.dart';

/// The three lines under the target card's macro bar: glyph, name, grams, share.
///
/// The percentage is recomputed from the ROUNDED grams rather than read off the
/// carb split's own ratio, so the figures agree with each other: a 30/35/35
/// split lands at 30 / 41 / 29 by calories once the grams are whole, and a row
/// claiming 35% beside a bar segment drawn at 41% is the kind of mismatch a
/// user notices and cannot explain.
class TargetMacroRows extends StatelessWidget {
  const TargetMacroRows({super.key, required this.macros});

  final MacroTargets macros;

  static const Map<String, String> _names = {
    'protein': 'onboarding.bodyMetrics.protein',
    'carbohydrate': 'onboarding.bodyMetrics.carbs',
    'fat': 'onboarding.bodyMetrics.fat',
  };

  Map<String, double> get _grams => {
        'protein': macros.proteinG,
        'carbohydrate': macros.carbsG,
        'fat': macros.fatG,
      };

  @override
  Widget build(BuildContext context) {
    final composition = compositionFromGrams((
      protein: macros.proteinG,
      carbohydrate: macros.carbsG,
      fat: macros.fatG,
    ));
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (final segment in composition.segments) ...[
          if (segment != composition.segments.first)
            const SizedBox(height: KalloSpacing.sp2),
          _row(segment.key, segment.pct),
        ],
      ],
    );
  }

  Widget _row(String key, double pct) => Row(
        children: [
          Icon(
            kMacroIcons[key],
            size: KalloIcons.tertiary,
            color: kCompositionColors[key],
          ),
          const SizedBox(width: KalloSpacing.sp2),
          Expanded(child: Text(tr(_names[key]!), style: dashBody())),
          Text(
            '${_grams[key]!.round()} ${tr('onboarding.bodyMetrics.grams')}',
            style: dashBody(tabular: true),
          ),
          const SizedBox(width: KalloSpacing.sp3),
          SizedBox(
            width: 36,
            child: Text(
              '${pct.round()}%',
              textAlign: TextAlign.end,
              style: dashMeta(tabular: true),
            ),
          ),
        ],
      );
}
