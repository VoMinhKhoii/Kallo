import '../../../../models/social/circle.dart';
import '../local_blocks.dart';

/// Rebase local interactions onto a fresh head, then resume from its cursor.
/// A retained tail may have backdated additions, deletions or privacy changes;
/// head overlap cannot establish that older rows are still authoritative.
SharedMealFeedPage mergeFeedRefresh(
  SharedMealFeedPage page,
  List<CircleFeedEntry> before,
  List<CircleFeedEntry> current,
) {
  final oldById = {for (final entry in before) entry.meal.shareId: entry};
  final latestById = {for (final entry in current) entry.meal.shareId: entry};
  final head =
      page.entries.map((entry) {
        final id = entry.meal.shareId;
        final old = oldById[id];
        final latest = latestById[id];
        // Do not roll back a heart/reply applied while the refresh was in flight.
        if (old == null || latest == null || identical(old, latest)) {
          return entry;
        }
        final rebased = CircleFeedEntry(
          friend: entry.friend,
          isSelf: entry.isSelf,
          meal: entry.meal,
          reactions:
              identical(old.reactions, latest.reactions)
                  ? entry.reactions
                  : latest.reactions,
          replies:
              identical(old.replies, latest.replies)
                  ? entry.replies
                  : latest.replies,
          repliesTotal:
              old.repliesTotal == latest.repliesTotal
                  ? entry.repliesTotal
                  : latest.repliesTotal,
        );
        // Locally patched replies may predate a block: keep their conservative
        // stamp rather than making stale content look newly authorized.
        carryStamp(latest, rebased);
        return rebased;
      }).toList();
  return SharedMealFeedPage(entries: head, nextCursor: page.nextCursor);
}
