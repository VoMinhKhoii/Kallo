import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../../../../models/nutrition/ingredient.dart';
import '../../../../../../shared/widgets/list/grouped_list_card.dart';
import '../../../../../../shared/widgets/list/list_row.dart';
import '../../../../../../theme/calm_tokens.dart';
import '../../../../logic/manual/manual_amount.dart';
import '../../../../logic/manual/manual_display.dart';
import '../../../../logic/portion/portion_anchors.dart';
import '../../scan/result/amount/field.dart';
import '../../scan/result/amount/stepper.dart';
import '../manual_subtitle.dart';
import 'manual_vessel_ruler.dart';

/// The food page's card, read like the scan result's (owner review): what a
/// row is on the left, its value and control on the right.
///
/// - **Weighed** — the state the food's numbers are for, a fixed label. It
///   shows only when the food's card says raw or cooked; a canned or packaged
///   food has no state to weigh it in.
/// - **Amount** — "120 kcal / 100 g" under the label; − / + and the typed
///   grams, with the vessel those grams can honestly claim ("medium cut", or
///   "custom" off every vessel) under the figure.
/// - The vessel tape, for a food that has vessels.
class ManualAmountCard extends StatelessWidget {
  const ManualAmountCard({
    super.key,
    required this.food,
    required this.grams,
    required this.onGrams,
  });

  final IngredientSearchResult food;
  final double grams;
  final ValueChanged<double> onGrams;

  @override
  Widget build(BuildContext context) {
    final vessel = food.vessel;
    final anchors =
        vessel == null
            ? null
            : buildAnchors(vessel, context.locale.languageCode);
    final claimed =
        anchors == null ? null : claimedAnchor(anchors, grams.round());
    final state = food.stateLabel;
    double? step(int direction) => steppedManualGrams(grams, direction);

    return GroupedListCard(
      separatorInset: 0,
      children: [
        if (state != null)
          ListRow(
            label: 'logging.manualLogging.weighed'.tr(),
            trailing: Text(manualStateWord(state), style: dashBody()),
          ),
        ListRow(
          label: 'logging.manualLogging.amount'.tr(),
          subline: 'logging.manualLogging.kcalPer100g'.tr(
            namedArgs: {'kcal': formatKcal(food.per100g.caloriesKcal)},
          ),
          trailing: ScanAmountStepper(
            onDecrease: step(-1) == null ? null : () => onGrams(step(-1)!),
            onIncrease: step(1) == null ? null : () => onGrams(step(1)!),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                ScanAmountField(
                  amount: grams.round(),
                  unit: 'g',
                  onChanged:
                      (value) => onGrams(
                        value
                            .toDouble()
                            .clamp(manualGramsMin, manualGramsMax)
                            .toDouble(),
                      ),
                ),
                if (anchors != null)
                  Text(
                    claimed?.label ?? 'logging.manualLogging.customAmount'.tr(),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    // Caption tier: a note pinned under the figure inside the
                    // stepper's fixed 88pt middle, as on the approved canvas.
                    style: dashCaption(),
                  ),
              ],
            ),
          ),
        ),
        if (vessel != null && anchors != null)
          Padding(
            padding: const EdgeInsets.only(top: 8, bottom: 12),
            child: ManualVesselRuler(
              vessel: vessel,
              anchors: anchors,
              grams: grams.round(),
              onChanged: (value) => onGrams(value.toDouble()),
            ),
          ),
      ],
    );
  }
}
