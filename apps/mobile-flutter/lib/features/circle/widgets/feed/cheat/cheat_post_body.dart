import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../../../models/social/circle.dart';
import '../../../../../shared/logic/display_format.dart';
import '../../../../../shared/widgets/nutrition/cheat_badge.dart';
import '../../../../../theme/calm_tokens.dart';
import '../../../../../theme/kallo_theme.dart';
import '../../../../logging/logic/format.dart';
import 'cheat_slider_recap.dart';

/// A shared CHEAT meal's numbers, as its own kind of post.
///
/// Before this, a cheat occasion in the circle feed was indistinguishable from
/// a weighed bowl of phở: same composition bar, same exact kcal figure. That
/// misrepresented it twice — it claimed a precision the logger never had, and
/// it hid what the meal was actually made of.
///
/// So this carries the owner card's vocabulary across: the badge, the `≈` that
/// marks the figure as a placement rather than a measurement, the alcohol the
/// P/C/F line structurally cannot hold, and where the sliders ended up.
///
/// Deliberately NOT carried: the composition bar (a segmented bar reads as
/// measured proportions, the very impression this undoes) and the reassurance
/// line (that is the logger reassuring themselves, not something a friend
/// should read on someone else's post). Web twin: `cheat-post-body.tsx`.
class CheatPostBody extends StatelessWidget {
  const CheatPostBody({super.key, required this.meal});

  final CircleFeedMeal meal;

  @override
  Widget build(BuildContext context) {
    final locale = localeOf(context);
    final kcal = meal.caloriesKcal;
    final alcohol = meal.alcoholG;
    final recap = meal.cheatRecap;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        CheatBadge(label: 'logging.cheatMealCard.badge'.tr()),
        const SizedBox(height: KalloSpacing.sp2),
        // Capitalised the way MealBlock capitalises its title — this is one of
        // the meal-text paths that does not go through it.
        Text(capitalizeFirst(meal.rawInput), style: dashBody()),
        const SizedBox(height: KalloSpacing.sp1),
        Text(
          // The feed's own kcal formatter, not the owner card's: cheat and
          // precise posts share one list, so a raw 1234 beside a localised
          // 1.234 would read as two different apps.
          kcal == null ? '— kcal' : '≈ ${fmtKcal(kcal, locale: locale)}',
          style: dashBody(),
        ),
        Text(_macroLine(), style: dashMeta()),
        if (alcohol != null && alcohol > 0)
          Text(
            'groups.feed.alcohol'.tr(
              namedArgs: {'grams': alcohol.round().toString()},
            ),
            style: dashMeta(),
          ),
        if (recap != null && recap.isNotEmpty) ...[
          const SizedBox(height: KalloSpacing.sp2),
          CheatSliderRecap(rows: recap),
        ],
      ],
    );
  }

  String _macroLine() {
    String g(double? value) => value == null ? '—' : '${value.round()}g';
    return 'P: ${g(meal.proteinG)}  C: ${g(meal.carbohydrateG)}  F: ${g(meal.fatG)}';
  }
}
