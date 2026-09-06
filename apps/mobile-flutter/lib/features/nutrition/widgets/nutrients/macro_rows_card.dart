import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../../models/nutrition/nutrition.dart';
import '../../../../shared/logic/macro_composition.dart';
import '../../../../shared/widgets/list/grouped_list_card.dart';
import '../../logic/helpers.dart';
import 'nutrient_row.dart';

/// Protein / Carbs / Fat as grouped rows under the calorie card.
///
/// They used to be a wrapped legend INSIDE that card — an icon, a short name
/// and a gram figure, with no target beside it — which made the card's own
/// colour key and the day's macro pattern the same three items. Split out,
/// each macro gets the row every other number in the app gets: its name, its
/// average against its target, and a bar in its own pigment (identity here,
/// not status — the pigment is what ties the row to its band in the chart
/// above).
class MacroRowsCard extends StatelessWidget {
  const MacroRowsCard({super.key, required this.macros});

  final List<MacroPattern> macros;

  @override
  Widget build(BuildContext context) {
    final locale = context.locale.languageCode;
    final rows = <Widget>[];
    for (final (index, key) in kCompositionKeys.indexed) {
      final macro = macros.where((m) => m.key == key).firstOrNull;
      if (macro == null) continue;
      final target = macro.target;
      rows.add(
        NutrientRow(
          label: tr(macro.labelKey),
          value: _figure(macro, locale),
          percentOfTarget:
              target != null && target > 0
                  ? macro.averagePerDay / target * 100
                  : null,
          fillColor: kCompositionColors[key]!,
          icon: kMacroIcons[key],
          iconColor: kCompositionColors[key],
          barDelay: Duration(milliseconds: 60 * index),
        ),
      );
    }
    if (rows.isEmpty) return const SizedBox.shrink();
    // No hairlines: every row ends in a full-width bar whose grey track starts
    // at the same 36pt inset the separator did — the two were collinear, so
    // the line was a second divider drawn on top of one that was already
    // there. A macro with no target still draws its bar (empty fill), so the
    // card has no bar-less row that would need the line back.
    return GroupedListCard(showSeparators: false, children: rows);
  }

  /// "125 / 138 g avg" — the qualifier rides on the row because this card
  /// carries no header of its own; it belongs to the Calories section above.
  String _figure(MacroPattern macro, String locale) {
    final avg = formatLocalizedNumber(macro.averagePerDay, locale);
    final target = macro.target;
    final figure =
        target != null
            ? '$avg / ${formatLocalizedNumber(target, locale)} ${macro.unit}'
            : '$avg ${macro.unit}';
    return tr('nutrition.rhythm.avgValue', namedArgs: {'value': figure});
  }
}
