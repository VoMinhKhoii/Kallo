import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../../models/profile/onboarding.dart';
import '../../../../shared/logic/tdee.dart';
import '../../../../theme/calm_tokens.dart';
import '../../../../theme/kallo_colors.dart';
import '../../../../theme/kallo_theme.dart';
import 'field_label.dart';

// Displayed High → Moderate → Low (default selection stays moderate_carb).
const List<String> _carbSplits = ['higher_carb', 'moderate_carb', 'lower_carb'];

/// The carb-split label plus the three macro-target cards (gap-2.5). Port of
/// `components/onboarding/body-metrics/carb-split-picker.tsx`.
class CarbSplitPicker extends StatelessWidget {
  const CarbSplitPicker({
    super.key,
    required this.value,
    required this.targetCalories,
    required this.onChange,
  });

  final String value;
  final double targetCalories;
  final ValueChanged<String> onChange;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        FieldLabel(tr('onboarding.bodyMetrics.carbSplit')),
        const SizedBox(height: KalloSpacing.sp2), // mb-2
        Column(
          children: [
            for (var i = 0; i < _carbSplits.length; i++) ...[
              if (i > 0) const SizedBox(height: KalloSpacing.sp2_5),
              _CarbCard(
                id: _carbSplits[i],
                active: value == _carbSplits[i],
                targetCalories: targetCalories,
                onTap: () => onChange(_carbSplits[i]),
              ),
            ],
          ],
        ),
      ],
    );
  }
}

class _CarbCard extends StatefulWidget {
  const _CarbCard({
    required this.id,
    required this.active,
    required this.targetCalories,
    required this.onTap,
  });

  final String id;
  final bool active;
  final double targetCalories;
  final VoidCallback onTap;

  @override
  State<_CarbCard> createState() => _CarbCardState();
}

class _CarbCardState extends State<_CarbCard> {
  bool _pressed = false;

  String get _label => switch (widget.id) {
    'moderate_carb' => tr('onboarding.bodyMetrics.moderateCarb'),
    'lower_carb' => tr('onboarding.bodyMetrics.lowerCarb'),
    _ => tr('onboarding.bodyMetrics.higherCarb'),
  };

  String get _desc => switch (widget.id) {
    'moderate_carb' => tr('onboarding.bodyMetrics.moderateCarbDescription'),
    'lower_carb' => tr('onboarding.bodyMetrics.lowerCarbDescription'),
    _ => tr('onboarding.bodyMetrics.higherCarbDescription'),
  };

  @override
  Widget build(BuildContext context) {
    final macros = calcMacroGrams(
      widget.targetCalories,
      carbSplitFromString(widget.id),
    );
    final active = widget.active;
    final grams = tr('onboarding.bodyMetrics.grams');
    final rows = <(String, num)>[
      (tr('onboarding.bodyMetrics.protein'), macros.proteinG.round()),
      (tr('onboarding.bodyMetrics.fat'), macros.fatG.round()),
      (tr('onboarding.bodyMetrics.carbs'), macros.carbsG.round()),
    ];

    final borderColor =
        active
            ? KalloColors.text.withValues(alpha: 0.3)
            : (_pressed ? KalloColors.accent50 : KalloColors.inputBorder);

    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTapDown: (_) => setState(() => _pressed = true),
      onTapUp: (_) => setState(() => _pressed = false),
      onTapCancel: () => setState(() => _pressed = false),
      onTap: widget.onTap,
      child: Container(
        clipBehavior: Clip.antiAlias,
        decoration: BoxDecoration(
          color: active ? KalloColors.hover : KalloColors.elev,
          borderRadius: BorderRadius.circular(
            KalloRadii.xxxl,
          ), // rounded-[22px]
          border: Border.all(color: borderColor),
          boxShadow:
              active
                  ? const [
                    // shadow-[0_10px_24px_rgba(201,168,124,0.14)]
                    BoxShadow(
                      color: Color(0x24C9A87C),
                      blurRadius: 24,
                      offset: Offset(0, 10),
                    ),
                  ]
                  : null,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Header band (px-3.5 py-2.5).
            Container(
              color:
                  active
                      ? KalloColors
                          .selectedSegment // #FBF2E6
                      : KalloColors.track, // #F5F4F0
              padding: const EdgeInsets.symmetric(
                horizontal: KalloSpacing.sp3_5, // px-3.5
                vertical: KalloSpacing.sp2_5, // py-2.5
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(_label, style: dashBody(weight: FontWeight.w500)),
                  const SizedBox(height: 2), // mt-0.5
                  Text(_desc, style: dashMeta()),
                ],
              ),
            ),
            // Body (px-3.5 py-3) — stacked P/F/C rows (space-y-1.5).
            Padding(
              padding: const EdgeInsets.symmetric(
                horizontal: KalloSpacing.sp3_5,
                vertical: KalloSpacing.sp3,
              ),
              child: Column(
                children: [
                  for (var i = 0; i < rows.length; i++) ...[
                    if (i > 0) const SizedBox(height: KalloSpacing.sp1_5),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(rows[i].$1.toUpperCase(), style: dashEyebrow()),
                        Text(
                          '${rows[i].$2}$grams',
                          style: dashBody(
                            weight: FontWeight.w500,
                            tabular: true,
                          ),
                        ),
                      ],
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
