import 'package:flutter/material.dart';

import '../../../../models/logging/meal.dart';
import '../../../../theme/kallo_motion.dart';
import '../composer/entrances.dart';
import 'meal_entry_dish_line.dart';
import '../portion/portion_assumption_line.dart';

/// One dish inside an unconfirmed [MealEntry]: the name + macros row (with the
/// +/- steppers in edit mode) and, underneath it, the quiet portion-assumption
/// line whenever the pipeline resolved a vessel for the dish.
///
/// The assumption line is a SIBLING of the row, not part of it — it must stay
/// outside the edit-mode wash, exactly as `meal-entry.tsx` renders the picker
/// outside `MealEntryItem`.
class MealEntryItemRow extends StatelessWidget {
  const MealEntryItemRow({
    super.key,
    required this.item,
    required this.index,
    required this.editing,
    required this.revealing,
    required this.animateIn,
    required this.onChange,
    required this.onAdjustPortion,
  });

  final MealItem item;

  /// Position in the list — drives the entrance stagger.
  final int index;

  final bool editing;

  /// True on the streaming-reveal morph's first mount.
  final bool revealing;

  /// Whether this row is arriving for the first time. False for a card restored
  /// from the server, which is only being scrolled back to.
  final bool animateIn;

  final void Function(String itemId, double delta) onChange;

  /// Opens the portion picker for this dish.
  final ValueChanged<MealItem> onAdjustPortion;

  @override
  Widget build(BuildContext context) {
    final vessel = item.vessel;
    final dishLine = MealEntryDishLine(
      item: item,
      editing: editing,
      onChange: onChange,
    );
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // The entrance wraps the dish row ONLY. Web puts the stagger on
        // `MealEntryItem` and renders the portion trigger outside that motion
        // div, so the assumption line does not slide in with the row.
        //
        // Web: each item enters opacity 0→1, x:-8→0, staggered index*0.05s
        // (meal-entry-item.tsx:32-35). On the reveal the rows were already on
        // screen in the streaming card — crossfade in place, don't re-enter.
        // A card restored from the server has always been there — it is only
        // scrolling back into view. The feed recycles its cards, so a fresh
        // _EntranceState was being built and replayed every time one came back,
        // spinning up an AnimationController and an Opacity saveLayer per row
        // and waterfalling an hour-old meal in again.
        if (!animateIn)
          dishLine
        else if (revealing)
          FadeIn(duration: KalloMotion.press, child: dishLine)
        else
          FadeInLeft(
            offset: 8,
            delay: KalloMotion.stagger * index,
            child: dishLine,
          ),
        if (vessel != null)
          PortionAssumptionLine(
            vessel: vessel,
            grams: item.quantity.round(),
            onTap: () => onAdjustPortion(item),
          ),
      ],
    );
  }
}
