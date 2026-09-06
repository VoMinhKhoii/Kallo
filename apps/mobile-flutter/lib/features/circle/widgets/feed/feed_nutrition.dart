import 'package:flutter/material.dart';

import '../../../../shared/logic/display_format.dart';
import '../../../../features/logging/logic/format.dart';
import '../../../../models/social/circle.dart';
import '../../../../shared/logic/macro_composition.dart';
import '../../../../shared/widgets/nutrition/meal_block.dart';
import '../../../../theme/calm_tokens.dart';

/// The meal itself: its text, the calorie-share bar, and the macro legend.
///
/// Draws the shared [MealBlock] (native pass, 2026-08-31) rather than its own
/// stack — a friend's meal and one of your own are the same object, so they
/// have to read identically whether you are looking at the Circle feed or at
/// Recent meals. Circle's one documented difference is kcal placement: the
/// figure LEADS the legend row here, where an own meal puts it at the title's
/// right (a post's title line is already spoken for by the author and time).
///
/// The bar splits by CALORIE share, so a low-gram/high-energy fat slice reads
/// at its true weight.
class FeedNutrition extends StatelessWidget {
  const FeedNutrition({required this.meal, super.key});

  final CircleFeedMeal meal;

  static String _grams(double? value) =>
      value == null ? '—' : '${value.round()}g';

  static const Map<String, String> _prefixes = {
    'protein': 'P',
    'carbohydrate': 'C',
    'fat': 'F',
  };

  @override
  Widget build(BuildContext context) {
    // Spelled once: the bar and the figures under it read the same record.
    final macros = (
      protein: meal.proteinG,
      carbohydrate: meal.carbohydrateG,
      fat: meal.fatG,
    );
    final composition = compositionFromGrams(macros);
    final kcal = meal.caloriesKcal;
    final grams = <String, double?>{
      'protein': macros.protein,
      'carbohydrate': macros.carbohydrate,
      'fat': macros.fat,
    };

    // Nothing measured at all — the meal text alone, rather than a row of
    // dashes over an empty bar.
    if (kcal == null && composition.totalKcal <= 0) {
      return Text(meal.rawInput, style: dashBody());
    }

    return MealBlock(
      title: meal.rawInput,
      segments: composition.segments,
      gramLabels: {
        for (final key in kCompositionKeys)
          key: '${_prefixes[key]} ${_grams(grams[key])}',
      },
      kcalLabel:
          kcal == null
              ? '— kcal'
              : fmtKcal(kcal, locale: localeOf(context)),
      kcalPlacement: MealBlockKcal.legendLeading,
      // Four lines, not the block's default two: a Circle post carries text
      // somebody TYPED, in their own words, while Recent meals shows a name
      // this app generated. Clipping a friend's sentence loses the post.
      titleMaxLines: 4,
    );
  }
}
