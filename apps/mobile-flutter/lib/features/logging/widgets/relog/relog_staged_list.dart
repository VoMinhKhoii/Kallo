import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../../models/ingredient.dart' show IngredientMacrosPer100g;
import '../../../../models/relog.dart';
import '../../../../theme/calm_tokens.dart';
import '../../../../theme/nham_colors.dart';
import '../../../../theme/nham_theme.dart';
import '../../logic/format.dart';
import '../../logic/logging_spacing.dart';
import 'relog_staged_row.dart';

/// The staged picks, shown above the composer field inside its card.
///
/// The picks also live as tinted text INSIDE the field — this list is the
/// running tally and the place to remove one, not a second source of truth.
/// The totals line reuses the manual-logging layout so the two read as one
/// system.
class RelogStagedList extends StatelessWidget {
  const RelogStagedList({
    super.key,
    required this.entries,
    required this.totals,
    required this.onRemove,
    this.disabled = false,
  });

  final List<RelogStagedEntry> entries;
  final IngredientMacrosPer100g totals;
  final ValueChanged<String> onRemove;
  final bool disabled;

  @override
  Widget build(BuildContext context) {
    if (entries.isEmpty) return const SizedBox.shrink();
    // Unknown calories mean there is nothing honest to total — say nothing
    // rather than showing a figure that silently treats unknown as zero.
    final hasTotals = totals.caloriesKcal != null;

    return Padding(
      padding: const EdgeInsets.only(bottom: LoggingSpacing.block),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          for (final entry in entries)
            RelogStagedRow(
              key: ValueKey(entry.stageId),
              entry: entry,
              disabled: disabled,
              onRemove: () => onRemove(entry.stageId),
            ),
          if (hasTotals) ...[
            const SizedBox(height: LoggingSpacing.row),
            const Divider(
              height: 1,
              thickness: 1,
              color: NhamColors.borderFaint,
            ),
            Padding(
              padding: const EdgeInsets.only(top: LoggingSpacing.section),
              child: Row(
                children: [
                  Expanded(
                    child: Text('logging.relog.total'.tr(), style: dashMeta()),
                  ),
                  Text(
                    'logging.relog.totalMacros'.tr(
                      namedArgs: {
                        'protein': fmtMacroValue(totals.proteinG),
                        'carbs': fmtMacroValue(totals.carbohydrateG),
                        'fat': fmtMacroValue(totals.fatG),
                      },
                    ),
                    style: dashMeta(tabular: true),
                  ),
                  const SizedBox(width: NhamSpacing.sp2),
                  Text(
                    'logging.relog.totalKcal'.tr(
                      namedArgs: {'kcal': fmtKcalValue(totals.caloriesKcal)},
                    ),
                    maxLines: 1,
                    softWrap: false,
                    style: dashBody(weight: FontWeight.w500, tabular: true),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}
