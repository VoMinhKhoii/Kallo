import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../../models/logging/cheat.dart';
import '../../../../theme/calm_tokens.dart';
import '../../../../theme/kallo_colors.dart';
import '../../../../theme/kallo_theme.dart';
import '../../data/logging_models.dart';
import '../../logic/logging_spacing.dart';
import '../../logic/slider_nutrition.dart';
import 'cheat_slider_card.dart' show cheatSliderColor;

/// The expanded "you set" recap of a saved cheat meal: slider positions with
/// six-dot stop scales, the macro/kcal total, and the reassurance line.
class CheatMealExpandedDetails extends StatelessWidget {
  const CheatMealExpandedDetails({
    super.key,
    required this.meal,
    required this.macroLine,
    required this.caloriesApprox,
  });

  final PersistedMeal meal;
  final String macroLine;
  final String caloriesApprox;

  @override
  Widget build(BuildContext context) {
    final persisted = meal.cheatSliders;
    return Padding(
      padding: const EdgeInsets.only(top: LoggingSpacing.section),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Divider(height: 1, thickness: 1, color: KalloColors.borderFaint),
          const SizedBox(height: LoggingSpacing.section),
          if (persisted != null) ...[
            Text('logging.cheatMealCard.youSet'.tr(), style: dashMeta()),
            const SizedBox(height: KalloSpacing.sp2),
            for (final slider in persisted.spec.sliders)
              Padding(
                padding: const EdgeInsets.symmetric(
                  vertical: LoggingSpacing.row,
                ),
                child: _YouSetRow(
                  slider: slider,
                  level: persisted.levels[slider.key] ?? slider.defaultLevel,
                ),
              ),
            const SizedBox(height: LoggingSpacing.section),
            const Divider(
              height: 1,
              thickness: 1,
              color: KalloColors.borderFaint,
            ),
            const SizedBox(height: LoggingSpacing.section),
          ],
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'logging.cheatMealCard.total'.tr(), style: dashBody(tabular: true),),
              Flexible(
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Flexible(
                      child: Text(
                        macroLine, style: dashMeta(tabular: true),),
                    ),
                    const SizedBox(width: KalloSpacing.sp4),
                    Text(
                      caloriesApprox, style: dashValue(),),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: LoggingSpacing.section),
          Text(
            'logging.cheatMealCard.reassurance'.tr(),
            style: dashMeta().copyWith(fontStyle: FontStyle.italic),
          ),
        ],
      ),
    );
  }
}

/// One slider recap row: label, the six-dot stop scale, the anchor scenario.
class _YouSetRow extends StatelessWidget {
  const _YouSetRow({required this.slider, required this.level});

  final CheatSlider slider;
  final double level;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Text(
          slider.label,
          style: dashBody(),
        ),
        const SizedBox(width: KalloSpacing.sp2),
        _StopScale(level: level, color: cheatSliderColor(slider.key)),
        const SizedBox(width: KalloSpacing.sp3),
        Expanded(
          child: Text(
            activeAnchorLabel(slider, level),
            textAlign: TextAlign.right,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: dashMeta(),
          ),
        ),
      ],
    );
  }
}

/// Six dots filled up to the chosen stop — where on the scale the user landed.
class _StopScale extends StatelessWidget {
  const _StopScale({required this.level, required this.color});

  final double level;
  final Color color;

  @override
  Widget build(BuildContext context) {
    final filled = ((level / 2).round() + 1).clamp(1, 6);
    return ExcludeSemantics(
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          for (var i = 0; i < 6; i++)
            Padding(
              padding: EdgeInsets.only(left: i == 0 ? 0 : 2),
              child: Container(
                width: 6,
                height: 6,
                decoration: BoxDecoration(
                  color: i < filled ? color : Colors.transparent,
                  shape: BoxShape.circle,
                  border:
                      i < filled ? null : Border.all(color: KalloColors.border),
                ),
              ),
            ),
        ],
      ),
    );
  }
}
