import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../../../models/social/circle.dart';
import '../../../../../shared/logic/display_format.dart';
import '../../../../../shared/widgets/nutrition/cheat_badge.dart';
import '../../../../../theme/calm_tokens.dart';
import '../../../../../theme/kallo_theme.dart';
import '../../../../logging/logic/format.dart';

/// A shared CHEAT meal's numbers, as its own kind of post.
///
/// Before this, a cheat occasion in the circle feed was indistinguishable from
/// a weighed bowl of phở: same composition bar, same exact kcal figure. That
/// misrepresented it twice — it claimed a precision the logger never had, and
/// it hid what the meal was actually made of.
///
/// What it takes to fix that turned out to be very little: the meal, the
/// badge, and an `≈` marking the figure as a placement rather than a
/// measurement.
///
/// Deliberately NOT carried over from the owner's own card: the composition
/// bar (a segmented bar reads as measured proportions, the exact impression
/// this undoes), the P/C/F line (same problem, one decimal place further in),
/// the alcohol figure, the slider recap, and the reassurance line. A post is
/// read at a glance in someone else's scroll — four stacked number lines and
/// two dot scales is a report, and nobody is auditing a friend's buffet. The
/// owner's own card still carries all of it, which is where it belongs.
/// Web twin: `cheat-post-body.tsx`.
class CheatPostBody extends StatelessWidget {
  const CheatPostBody({super.key, required this.meal});

  final CircleFeedMeal meal;

  @override
  Widget build(BuildContext context) {
    final locale = localeOf(context);
    final kcal = meal.caloriesKcal;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Capitalised the way MealBlock capitalises its title — this is one of
        // the meal-text paths that does not go through it.
        Text(capitalizeFirst(meal.rawInput), style: dashBody()),
        const SizedBox(height: KalloSpacing.sp2),
        // One row, so the post reads as "a cheat meal, about this many
        // calories" rather than as a stack of separate facts.
        Row(
          children: [
            CheatBadge(label: 'logging.cheatMealCard.badge'.tr()),
            const SizedBox(width: KalloSpacing.sp3),
            Flexible(
              child: Text(
                // The feed's own kcal formatter, not the owner card's: cheat
                // and precise posts share one list, so a raw 1234 beside a
                // localised 1.234 would read as two different apps.
                kcal == null ? '— kcal' : '≈ ${fmtKcal(kcal, locale: locale)}',
                style: dashValue(),
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ],
        ),
      ],
    );
  }
}
