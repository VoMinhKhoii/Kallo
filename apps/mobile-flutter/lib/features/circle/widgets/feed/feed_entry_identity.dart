import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../../models/social/circle.dart';
import '../../../../shared/widgets/nutrition/cheat_badge.dart';
import '../../../../theme/calm_tokens.dart';
import '../../../../theme/kallo_theme.dart';
import '../../../../shared/logic/display_format.dart';

/// A post's first line: who shared it, when, and what kind of meal it is.
///
/// Split out of [FeedEntry] when the cheat chip joined it — the row had grown
/// four independent rules about what appears beside a name, which is a concern
/// of its own and not something the post's layout should be carrying.
///
/// Everything that qualifies the post lives here, at the trailing edge and off
/// the reading path of the name and the meal text below. The meal's own
/// figures are [FeedNutrition]'s.
class FeedEntryIdentity extends StatelessWidget {
  const FeedEntryIdentity({
    required this.meal,
    required this.name,
    required this.sharedAt,
    super.key,
  });

  final CircleFeedMeal meal;

  /// Already resolved to "You" or the friend's label by the caller.
  final String name;

  final DateTime sharedAt;

  /// A split share as the fraction it actually was.
  static String _fraction(double factor) {
    if ((factor - 0.5).abs() < 0.001) return '½';
    if ((factor - 1 / 3).abs() < 0.001) return '⅓';
    if ((factor - 0.25).abs() < 0.001) return '¼';
    return '${(factor * 100).round()}%';
  }

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
          child: Wrap(
            crossAxisAlignment: WrapCrossAlignment.center,
            spacing: KalloSpacing.sp2,
            runSpacing: 3,
            children: [
              Text.rich(
                TextSpan(
                  children: [
                    TextSpan(
                      // 15/600 ink against the 14 muted timestamp beside it:
                      // the Threads relationship, where a bold author sits over
                      // regular body copy. Names are one of the three places
                      // semibold survives — identity, not a figure. One notch
                      // under the 16 post body so the two do not read as a wall.
                      text: name,
                      style: dashName(),
                    ),
                    // A backfilled (past-date) meal carries a sharedAt of
                    // "now", so its clock time describes when it was typed up
                    // rather than when it was eaten — hide it. Mirrors web
                    // `components/groups/feed-entry.tsx`.
                    if (!meal.isBackfilled)
                      TextSpan(
                        // A plain space, no dot: the name is bold ink and the
                        // time regular muted, so weight and colour already part
                        // them. A separator on top of that is punctuation doing
                        // work the type has done.
                        text:
                            ' ${formatLoggedTime(sharedAt, locale: context.locale.languageCode)}',
                        style: dashMeta(),
                      ),
                  ],
                ),
              ),
              if (meal.portionFactor < 1)
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: KalloSpacing.sp2,
                    vertical: 1,
                  ),
                  decoration: const BoxDecoration(
                    color: kTrack,
                    borderRadius: BorderRadius.all(Radius.circular(99)),
                  ),
                  child: Text(
                    tr(
                      'groups.feed.portion',
                      namedArgs: {'portion': _fraction(meal.portionFactor)},
                    ),
                    style: dashMeta(),
                  ),
                ),
            ],
          ),
        ),
        // A cheat occasion's figures were placed on a slider, not measured.
        // This and the `≈` on the calorie figure are the whole difference —
        // the post keeps the ordinary anatomy, because it is still a meal
        // someone ate.
        if (meal.isCheat) ...[
          const SizedBox(width: KalloSpacing.sp2),
          CheatBadge(label: 'logging.cheatMealCard.badge'.tr()),
        ],
      ],
    );
  }
}
