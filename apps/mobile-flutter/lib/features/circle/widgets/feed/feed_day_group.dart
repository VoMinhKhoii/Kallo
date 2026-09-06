import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../../models/social/circle.dart';
import '../../../../shared/widgets/list/grouped_list_card.dart';
import '../../../../shared/widgets/typography/section_header_row.dart';
import '../../../../theme/kallo_theme.dart';
import '../../data/feed_time.dart';
import 'feed_entry.dart';

/// Avatar (32) + its gap (12): where the content column starts, and therefore
/// where a separator between two posts begins.
const double kContentRail = 44;

/// Vertical padding between a post and the card edge (12) versus between a
/// post and the separator under it (16) — the canvas' two card metrics.
const double _edgePad = KalloSpacing.sp3;
const double _innerPad = KalloSpacing.sp4;

/// The canvas pulls the action row's bottom margin in by 12 so a post's last
/// ink sits where the post visibly ends, instead of floating above the slack
/// its 44pt tap boxes carry. That pull is paid HERE rather than as a negative
/// margin on the row: Flutter clips hit-testing to a parent's box, so pulling
/// the row itself would take those 12pt off the targets too.
const double _actionSlack = KalloSpacing.sp3;

/// One day of the Circle feed: a 14/500 muted [GroupLabel] over a white
/// grouped card holding that day's posts (native pass, 2026-08-31).
///
/// Replaces the old label-plus-rule day separator and the loose posts under
/// it. The rule was doing a card's job — saying "these belong together" —
/// while the posts themselves sat on the canvas with nothing under them, so a
/// day read as a heading followed by three unhoused rows. Grouping the day
/// into the app's card anatomy says the same thing with the surface, and the
/// label drops to the quiet tier the rest of the app uses above a card.
class FeedDayGroup extends StatelessWidget {
  const FeedDayGroup({required this.date, required this.entries, super.key});

  final DateTime date;
  final List<CircleFeedEntry> entries;

  @override
  Widget build(BuildContext context) {
    final label = threadDayLabel(date, locale: context.locale.languageCode);
    final text = switch (label.kind) {
      ThreadDayLabelKind.today => tr('groups.wall.todayLabel'),
      ThreadDayLabelKind.yesterday => tr('groups.wall.yesterdayLabel'),
      ThreadDayLabelKind.date => label.dateLabel!,
    };

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        GroupLabel(text),
        const SizedBox(height: KalloSpacing.sp3),
        GroupedListCard(
          separatorInset: kContentRail,
          children: [
            for (var i = 0; i < entries.length; i++)
              Padding(
                key: ValueKey(entries[i].meal.shareId),
                padding: EdgeInsets.only(
                  top: i == 0 ? _edgePad : _innerPad,
                  bottom:
                      (i == entries.length - 1 ? _edgePad : _innerPad) -
                      _actionSlack,
                ),
                child: FeedEntry(entry: entries[i]),
              ),
          ],
        ),
      ],
    );
  }
}
