import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../models/relog.dart';
import '../../../../theme/calm_tokens.dart';
import '../../../../theme/nham_theme.dart';
import '../../logic/format.dart';
import '../../logic/logging_spacing.dart';
import '../meal_action_icon_button.dart';

/// One staged pick: the name, then its macro split and calories, then remove.
///
/// A MEAL stays a SINGLE row rather than exploding into its dishes, so removing
/// it is one tap and the list keeps the shape it was picked in.
class RelogStagedRow extends StatelessWidget {
  const RelogStagedRow({
    super.key,
    required this.entry,
    required this.onRemove,
    this.disabled = false,
  });

  final RelogStagedEntry entry;
  final VoidCallback onRemove;
  final bool disabled;

  @override
  Widget build(BuildContext context) {
    final summary = entry.summary;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: LoggingSpacing.row),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  entry.label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: dashBody(),
                ),
                Text(
                  'logging.relog.macroSplit'.tr(
                    namedArgs: {
                      'protein': fmtMacroValue(summary.proteinG),
                      'carbs': fmtMacroValue(summary.carbohydrateG),
                      'fat': fmtMacroValue(summary.fatG),
                    },
                  ),
                  style: dashMeta(tabular: true),
                ),
              ],
            ),
          ),
          const SizedBox(width: NhamSpacing.sp2),
          Text(
            'logging.relog.rowKcal'.tr(
              namedArgs: {'kcal': fmtKcalValue(summary.caloriesKcal)},
            ),
            maxLines: 1,
            softWrap: false,
            style: dashMeta(tabular: true),
          ),
          MealActionIconButton(
            icon: LucideIcons.x300,
            label: 'logging.relog.removeStaged'.tr(
              namedArgs: {'name': entry.label},
            ),
            onTap: disabled ? null : onRemove,
          ),
        ],
      ),
    );
  }
}
