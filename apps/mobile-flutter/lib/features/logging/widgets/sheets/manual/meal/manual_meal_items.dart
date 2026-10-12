import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../../../models/nutrition/ingredient.dart';
import '../../../../data/manual_log_providers.dart';
import '../../../../../../shared/widgets/list/grouped_list_card.dart';
import '../../../../../../shared/widgets/list/list_row.dart';
import '../../../../../../theme/calm_tokens.dart';
import '../../../../logic/manual/manual_display.dart';
import '../manual_food_row.dart';
import '../manual_subtitle.dart';

/// The plate: "4 ingredients", one card of what is in the meal (each row opens
/// its food page to change the amount or remove it), and "Add ingredient"
/// under it.
class ManualMealItems extends StatelessWidget {
  const ManualMealItems({
    super.key,
    required this.items,
    required this.onOpen,
    required this.onAdd,
    this.full = false,
  });

  final List<ManualLogItem> items;

  /// The plate holds as many foods as a meal may: "Add ingredient" is off and
  /// says why.
  final bool full;

  /// Null while saving.
  final ValueChanged<ManualLogItem>? onOpen;
  final VoidCallback? onAdd;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (items.isNotEmpty) ...[
          Padding(
            padding: const EdgeInsets.fromLTRB(4, 16, 4, 8),
            child: Text(
              'logging.manualLogging.ingredientCount'.plural(items.length),
              style: kGroupLabel(),
            ),
          ),
          GroupedListCard(
            separatorInset: 0,
            children: [for (final item in items) _row(item)],
          ),
        ],
        const SizedBox(height: 12),
        GroupedListCard(
          children: [
            ListRow(
              icon: LucideIcons.plus300,
              label: 'logging.manualLogging.addIngredient'.tr(),
              subline:
                  full
                      ? 'logging.manualLogging.mealFull'.tr(
                        namedArgs: {'count': '$maxManualItems'},
                      )
                      : null,
              onTap: onAdd,
              enabled: onAdd != null,
            ),
          ],
        ),
      ],
    );
  }

  Widget _row(ManualLogItem item) {
    final grams = '${formatGrams(item.grams ?? 0)} g';
    final open = onOpen;
    return ManualFoodRow(
      key: ValueKey(item.id),
      name: item.ingredient.namePrimary,
      nameMaxLines: 1,
      subtitle: mealSubtitle(item.ingredient, manualStateWord, grams),
      kcal: formatKcal(item.macros?.caloriesKcal),
      kcalUnitMuted: false,
      semanticLabel: '${item.ingredient.namePrimary}, $grams',
      onTap: open == null ? null : () => open(item),
    );
  }
}
