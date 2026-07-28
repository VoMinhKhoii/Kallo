import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../theme/calm_tokens.dart';
import '../../../theme/nham_colors.dart';
import '../../../theme/nham_theme.dart';
import '../logic/tdee.dart';

/// RN port of the web aggression `<input type=range>` (body-metrics.tsx).
/// 0.1–0.8, step 0.05, with the live `kg/wk · kcal/day` readout and low/high
/// end labels. The `goal` flips the kcal sign (deficit/surplus).
class AggressionSlider extends StatelessWidget {
  const AggressionSlider({
    super.key,
    required this.value,
    required this.onChange,
    required this.isCutting,
  });

  final double? value;
  final ValueChanged<double> onChange;

  /// When true, the kcal delta reads as a deficit ('−'); otherwise surplus ('+').
  final bool isCutting;

  @override
  Widget build(BuildContext context) {
    final aggressionKg = value ?? 0.5;
    final kcalDelta = (aggressionKg * aggressionKcalPerKg).round();
    final sign = isCutting ? '−' : '+'; // − or +

    return Container(
      padding: const EdgeInsets.all(NhamSpacing.sp4),
      decoration: BoxDecoration(
        color: NhamColors.elev,
        borderRadius: BorderRadius.circular(NhamRadii.containerLg),
        border: Border.all(color: NhamColors.inputBorder),
      ),
      child: Column(
        children: [
          // Readout: "0.50 kg/wk · −550 kcal/day"
          Text.rich(
            TextSpan(
              children: [
                TextSpan(
                  text: '${aggressionKg.toStringAsFixed(2)} '
                      '${tr('onboarding.bodyMetrics.weightUnit')}/wk',
                ),
                const TextSpan(
                  text: ' · ',
                  style: TextStyle(color: kInkMuted),
                ),
                TextSpan(
                  text: '$sign$kcalDelta ${tr('onboarding.bodyMetrics.perDay')}',
                ),
              ],
            ),
            textAlign: TextAlign.center,
            style: dashBody(weight: FontWeight.w500),
          ),
          const SizedBox(height: NhamSpacing.sp3),
          SliderTheme(
            data: SliderTheme.of(context).copyWith(
              activeTrackColor: NhamColors.accent,
              inactiveTrackColor: NhamColors.inputBorder,
              thumbColor: NhamColors.accent,
              overlayColor: NhamColors.accent20,
              trackHeight: 4,
              // Native `<input type=range accent-...>`: small round thumb, no
              // tick snapping visuals, tighter overlay.
              thumbShape: const RoundSliderThumbShape(enabledThumbRadius: 7),
              overlayShape: const RoundSliderOverlayShape(overlayRadius: 14),
              tickMarkShape: SliderTickMarkShape.noTickMark,
            ),
            child: Slider(
              min: 0.1,
              max: 0.8,
              divisions: 14, // (0.8 - 0.1) / 0.05
              value: aggressionKg.clamp(0.1, 0.8),
              onChanged: onChange,
            ),
          ),
          const SizedBox(height: NhamSpacing.sp3),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                tr('onboarding.bodyMetrics.aggressionLow'),
                style: dashMeta(),
              ),
              Text(
                tr('onboarding.bodyMetrics.aggressionHigh'),
                style: dashMeta(),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
