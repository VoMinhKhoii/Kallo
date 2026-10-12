import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../../../models/nutrition/ingredient.dart';
import '../../../../../../shared/widgets/list/grouped_list_card.dart';
import '../../../../../../theme/calm_tokens.dart';
import '../../../../../../theme/kallo_colors.dart';
import '../../../../../../theme/kallo_theme.dart';
import '../../../../logic/manual/manual_display.dart';
import '../manual_food_row.dart';
import '../manual_subtitle.dart';

/// The add sheet's list (approved canvas, G2): "Recent" before typing,
/// "Results for “q”" after, with "per 100 g" over the calorie column, and one
/// flat card of foods — the Vietnamese name, then "Raw · English name".
///
/// A food already in the meal says so in place ("Raw · 150 g in meal" and a
/// check), and opens its page to change the amount rather than adding it twice.
class ManualSearchResults extends StatelessWidget {
  const ManualSearchResults({
    super.key,
    required this.query,
    required this.resultsAsync,
    required this.itemFor,
    required this.onPick,
  });

  final String query;
  final AsyncValue<List<IngredientSearchResult>> resultsAsync;

  /// The meal's item for a food id, when that food is already in it.
  final ManualLogItem? Function(String ingredientId) itemFor;
  final ValueChanged<IngredientSearchResult> onPick;

  @override
  Widget build(BuildContext context) {
    final recents = query.isEmpty;
    return ListView(
      keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
      padding: EdgeInsets.only(
        bottom: MediaQuery.viewPaddingOf(context).bottom + KalloSpacing.sp4,
      ),
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(4, 16, 4, 8),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.baseline,
            textBaseline: TextBaseline.alphabetic,
            children: [
              Expanded(
                child: Text(
                  recents
                      ? 'logging.manualLogging.recent'.tr()
                      : 'logging.manualLogging.resultsFor'.tr(
                        namedArgs: {'query': query},
                      ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: kGroupLabel(),
                ),
              ),
              const SizedBox(width: KalloSpacing.sp3),
              Text('logging.manualLogging.per100g'.tr(), style: kGroupLabel()),
            ],
          ),
        ),
        resultsAsync.when(
          loading: () => _message('logging.manualLogging.searching'.tr()),
          error: (_, __) => _message('errors.internal'.tr(), error: true),
          data: (results) {
            if (results.isEmpty) {
              return _message(
                (recents
                        ? 'logging.manualLogging.recentsHint'
                        : 'logging.manualLogging.noResults')
                    .tr(),
              );
            }
            return GroupedListCard(
              separatorInset: 0,
              children: [for (final result in results) _row(result)],
            );
          },
        ),
      ],
    );
  }

  Widget _row(IngredientSearchResult result) {
    final item = itemFor(result.id);
    final inMeal =
        item == null
            ? null
            : 'logging.manualLogging.inMeal'.tr(
              namedArgs: {'grams': formatGrams(item.grams)},
            );
    return ManualFoodRow(
      key: ValueKey(result.id),
      name: result.namePrimary,
      subtitle:
          inMeal == null
              ? searchSubtitle(result, manualStateWord)
              : mealSubtitle(result, manualStateWord, inMeal),
      kcal: formatKcal(result.per100g.caloriesKcal),
      added: item != null,
      addedLabel: 'logging.manualLogging.added'.tr(),
      semanticLabel: [
        result.namePrimary,
        if (result.englishName != null) result.englishName!,
        '${formatKcal(result.per100g.caloriesKcal)} kcal / 100 g',
        if (inMeal != null) inMeal,
      ].join(', '),
      onTap: () => onPick(result),
    );
  }

  Widget _message(String text, {bool error = false}) => Padding(
    padding: const EdgeInsets.symmetric(vertical: KalloSpacing.sp6),
    child: Text(
      text,
      textAlign: TextAlign.center,
      style: dashMeta(color: error ? KalloColors.danger : kInkMuted),
    ),
  );
}
