import 'package:flutter/material.dart';

import '../../../../shared/logic/display_format.dart';
import '../../../../shared/logic/macro_composition.dart';
import '../../../../shared/widgets/nutrition/composition_bar.dart';
import '../../../../shared/widgets/nutrition/macro_legend.dart';
import '../../../../theme/calm_tokens.dart';
import '../../../../theme/kallo_theme.dart';
import '../../logic/format.dart';
import '../../logic/meal_edit/meal_edit_draft.dart';

/// The whole meal at the top of the edit sheet: its calories as the sheet's
/// one Hero figure, then the calorie-share bar and the macro legend under it —
/// the same bar and legend the meal's card closes on, so the sheet reads as
/// that card opened up.
///
/// Sans, not the Lora serif: the serif is the dashboard greeting's alone, and
/// a number is never the editorial moment.
class MealEditSummary extends StatelessWidget {
  const MealEditSummary({super.key, required this.totals});

  final EditTotals totals;

  @override
  Widget build(BuildContext context) {
    final locale = localeOf(context);
    final composition = compositionFromGrams((
      protein: totals.protein,
      carbohydrate: totals.carbs,
      fat: totals.fat,
    ));
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          crossAxisAlignment: CrossAxisAlignment.baseline,
          textBaseline: TextBaseline.alphabetic,
          children: [
            Text(fmtKcalValue(totals.kcal, locale: locale), style: dashHero()),
            const SizedBox(width: 4),
            Text('kcal', style: dashMeta()),
          ],
        ),
        const SizedBox(height: KalloSpacing.sp4),
        CompositionBar.compact(segments: composition.segments),
        const SizedBox(height: 6),
        MacroLegend(
          gramLabels: {
            if (totals.protein != null) 'protein': 'P ${fmtG(totals.protein)}',
            if (totals.carbs != null) 'carbohydrate': 'C ${fmtG(totals.carbs)}',
            if (totals.fat != null) 'fat': 'F ${fmtG(totals.fat)}',
          },
        ),
      ],
    );
  }
}
