import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../theme/calm_tokens.dart';
import '../../../theme/kallo_colors.dart';
import '../../../theme/kallo_theme.dart';
import '../../../shared/logic/tdee.dart';

/// Mirror of `components/onboarding/screen-body-metrics.tsx` aggression block.
///
/// 0.1–0.8 step 0.1, header row (bold label · {x.x} kg/week), dark-espresso
/// slider track (h-1.5), Low/Moderate/High labels, and a tinted #F5F4F0 box
/// reading the ~kcal/day deficit/surplus. Card: rounded-2xl, 1px #EAE7E0, p-4.
class AggressionSlider extends StatelessWidget {
  const AggressionSlider({
    super.key,
    required this.value,
    required this.onChange,
    required this.goal, // 'cutting' | 'bulking'
  });

  final double? value;
  final ValueChanged<double> onChange;
  final String goal;

  @override
  Widget build(BuildContext context) {
    final aggressionKg = value ?? 0.5;
    final kcalDelta = (aggressionKg * kAggressionKcalPerKg).round();
    final isCutting = goal == 'cutting';

    return Container(
      // rounded-2xl border #EAE7E0 bg white p-4
      padding: const EdgeInsets.all(KalloSpacing.sp4),
      decoration: BoxDecoration(
        color: const Color(0xFFFFFFFF),
        borderRadius: BorderRadius.circular(KalloRadii.containerLg),
        border: Border.all(color: KalloColors.inputBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Header row: bold 13 label (left) · {x.x} kg/week (right).
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                tr('onboarding.bodyMetrics.aggression'),
                style: dashBody(weight: FontWeight.w500),
              ),
              Text.rich(
                TextSpan(
                  children: [
                    TextSpan(text: aggressionKg.toStringAsFixed(1)),
                    TextSpan(
                      text: ' kg/week',
                      style: dashMeta(),
                    ),
                  ],
                ),
                style: dashBody(weight: FontWeight.w500, tabular: true),
              ),
            ],
          ),
          const SizedBox(height: 12), // mb-3
          // Slider: dark espresso filled track + thumb on #EAE7E0, h-1.5 (6px).
          SliderTheme(
            data: SliderTheme.of(context).copyWith(
              activeTrackColor: KalloColors.text,
              inactiveTrackColor: KalloColors.inputBorder,
              thumbColor: KalloColors.text,
              overlayColor: KalloColors.text40,
              trackHeight: 6,
              showValueIndicator: ShowValueIndicator.never,
            ),
            child: Slider(
              min: 0.1,
              max: 0.8,
              divisions: 7, // step 0.1 → 7 stops (0.1..0.8)
              value: aggressionKg.clamp(0.1, 0.8),
              onChanged: (v) => onChange((v * 10).round() / 10),
            ),
          ),
          const SizedBox(height: 10), // mt-2.5
          // Three end labels: Low (left), Moderate (center), High (right);
          // active band bolds + darkens to #2C2416.
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              _endLabel(
                tr('onboarding.bodyMetrics.aggressionLow'),
                active: aggressionKg <= 0.3,
              ),
              _endLabel(
                'Moderate',
                active: aggressionKg > 0.3 && aggressionKg <= 0.6,
              ),
              _endLabel(
                tr('onboarding.bodyMetrics.aggressionHigh'),
                active: aggressionKg > 0.6,
              ),
            ],
          ),
          const SizedBox(height: 12), // mt-3
          // Tinted deficit/surplus info box.
          Container(
            padding: const EdgeInsets.symmetric(
              horizontal: KalloSpacing.sp3,
              vertical: KalloSpacing.sp2,
            ),
            decoration: BoxDecoration(
              color: KalloColors.track, // bg-[#F5F4F0]
              borderRadius: BorderRadius.circular(KalloRadii.md), // rounded-lg
            ),
            child: Text.rich(
              TextSpan(
                children: [
                  const TextSpan(text: 'Translates to a '),
                  TextSpan(
                    text: '~$kcalDelta kcal/day',
                    style: dashMeta(color: kInk),
                  ),
                  TextSpan(text: ' ${isCutting ? 'deficit' : 'surplus'}.'),
                ],
              ),
              textAlign: TextAlign.center,
              style: dashMeta(),
            ),
          ),
        ],
      ),
    );
  }

  Widget _endLabel(String text, {required bool active}) => Text(
        text,
        style: dashMeta(color: active ? kInk : kInkMuted),
      );
}
