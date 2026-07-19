import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../models/circle.dart';
import '../../../theme/calm_tokens.dart';
import '../../../theme/nham_theme.dart';
import '../data/feed_time.dart';
import '../../../shared/widgets/profile_avatar.dart';
import 'feed_entry_actions.dart';
import 'share_replies.dart';

class FeedEntry extends StatelessWidget {
  const FeedEntry({required this.entry, super.key});

  final CircleFeedEntry entry;

  String _macro(double? value) =>
      value == null ? tr('groups.wall.na') : '${value.round()}g';

  String _calories(double? value) =>
      value == null ? tr('groups.wall.na') : '${value.round()} kcal';

  String _fraction(double factor) {
    if ((factor - 0.5).abs() < 0.001) return '½';
    if ((factor - 1 / 3).abs() < 0.001) return '⅓';
    if ((factor - 0.25).abs() < 0.001) return '¼';
    return '${(factor * 100).round()}%';
  }

  @override
  Widget build(BuildContext context) {
    final meal = entry.meal;
    final name = entry.isSelf ? tr('groups.wall.you') : entry.friend.label;
    final sharedAt = DateTime.parse(meal.sharedAt);
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        ProfileAvatarDisc(profile: entry.friend, size: 36),
        const SizedBox(width: NhamSpacing.sp3),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Wrap(
                crossAxisAlignment: WrapCrossAlignment.center,
                spacing: NhamSpacing.sp2,
                runSpacing: 3,
                children: [
                  Text(name, style: dashBody(weight: FontWeight.w500)),
                  Text(
                    formatElapsed(
                      sharedAt,
                      locale: context.locale.languageCode,
                    ),
                    style: dashMeta(),
                  ),
                  if (meal.portionFactor < 1)
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: NhamSpacing.sp2,
                        vertical: 1,
                      ),
                      decoration: BoxDecoration(
                        color: kTrack,
                        borderRadius: BorderRadius.circular(99),
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
              const SizedBox(height: 3),
              Text(meal.rawInput, style: dashBody(weight: FontWeight.w500)),
              const SizedBox(height: 10),
              Row(
                children: [
                  Expanded(
                    child: Text(
                      'P: ${_macro(meal.proteinG)}  '
                      'C: ${_macro(meal.carbohydrateG)}  '
                      'F: ${_macro(meal.fatG)}',
                      style: dashMeta(tabular: true),
                    ),
                  ),
                  const SizedBox(width: NhamSpacing.sp2),
                  Text(
                    _calories(meal.caloriesKcal),
                    style: dashBody(weight: FontWeight.w500, tabular: true),
                  ),
                ],
              ),
              const SizedBox(height: 6),
              FeedEntryActions(entry: entry),
              ShareReplies(
                shareId: meal.shareId,
                replies: entry.replies,
                repliesTotal: entry.repliesTotal,
              ),
            ],
          ),
        ),
      ],
    );
  }
}
