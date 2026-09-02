import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../../models/social/circle.dart';
import '../../../../shared/widgets/avatar/profile_avatar.dart';
import '../../../../theme/calm_tokens.dart';
import '../../../../theme/kallo_theme.dart';
import '../../../../shared/logic/display_format.dart';
import 'feed_entry_actions.dart';
import 'feed_nutrition.dart';
import 'feed_rhythm.dart';
import 'share_replies.dart';

/// One shared meal: who and when, the meal itself, its calories and macro
/// composition, then the action row.
class FeedEntry extends StatefulWidget {
  const FeedEntry({required this.entry, super.key});

  final CircleFeedEntry entry;

  @override
  State<FeedEntry> createState() => _FeedEntryState();
}

class _FeedEntryState extends State<FeedEntry> {
  /// Owned here rather than in [ShareReplies] because the trigger lives in the
  /// action row: the two are siblings, so their common parent holds the state.
  bool _replyOpen = false;

  String _fraction(double factor) {
    if ((factor - 0.5).abs() < 0.001) return '½';
    if ((factor - 1 / 3).abs() < 0.001) return '⅓';
    if ((factor - 0.25).abs() < 0.001) return '¼';
    return '${(factor * 100).round()}%';
  }

  @override
  Widget build(BuildContext context) {
    final entry = widget.entry;
    final meal = entry.meal;
    final name = entry.isSelf ? tr('groups.wall.you') : entry.friend.label;
    final sharedAt = DateTime.parse(meal.sharedAt);

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // 32, TOP-aligned (native pass, 2026-08-31): inside the day card the
        // disc is an identity marker beside the content column, not a second
        // column of its own, so it steps down one size and the separator
        // under the post starts where the text does.
        ProfileAvatarDisc(profile: entry.friend, size: 32),
        const SizedBox(width: KalloSpacing.sp3),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Wrap(
                crossAxisAlignment: WrapCrossAlignment.center,
                spacing: KalloSpacing.sp2,
                runSpacing: 3,
                children: [
                  Text.rich(
                    TextSpan(
                      children: [
                        TextSpan(
                          text: name,
                          // 15/600 ink against the 14 muted timestamp beside
                          // it: the Threads relationship, where a bold author
                          // sits over regular body copy. Names are one of the
                          // three places semibold survives — identity, not a
                          // figure. One notch under the 16 post body so the
                          // two do not read as a wall.
                          style: dashName(),
                        ),
                        // A backfilled (past-date) meal carries a sharedAt of
                        // "now", so its clock time describes when it was typed
                        // up rather than when it was eaten — hide it. Mirrors
                        // web `components/groups/feed-entry.tsx`.
                        if (!meal.isBackfilled)
                          TextSpan(
                            // A plain space, no dot: the name is bold ink and
                            // the time regular muted, so weight and colour
                            // already part them. A separator on top of that is
                            // punctuation doing work the type has done.
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
              const SizedBox(height: kFeedTight),
              // Meal text, calorie-share bar and macro legend are one block
              // now — the app-wide [MealBlock] anatomy, shared with Recent
              // meals and the logging card.
              FeedNutrition(meal: meal),
              // No gap: the action row's own tap slack supplies it.
              FeedEntryActions(
                entry: entry,
                onReply: () => setState(() => _replyOpen = true),
              ),
              ShareReplies(
                shareId: meal.shareId,
                replies: entry.replies,
                repliesTotal: entry.repliesTotal,
                open: _replyOpen,
                onClose: () {
                  if (mounted) setState(() => _replyOpen = false);
                },
              ),
            ],
          ),
        ),
      ],
    );
  }
}

/// Calories and macros on one line, over the stacked composition bar.
///
/// The calorie figure sits at Body in medium ink; its unit and the macro grams
/// stay at Meta, so the number carries the mass rather than the word without
/// outweighing the meal name above it. The bar splits by CALORIE share, so a
/// low-gram/high-energy fat slice reads at its true weight.
