import '../../../../models/social/circle.dart';
import '../local_blocks.dart';

/// Preserve a loaded history tail only when the refreshed head overlaps it.
/// With no overlap there may be an unloaded gap, so use the server's cursor.
SharedMealFeedPage mergeFeedRefresh(
  SharedMealFeedPage page,
  List<CircleFeedEntry> before,
  List<CircleFeedEntry> current,
  String? currentCursor,
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
  final anchor =
      head.isEmpty
          ? -1
          : current.indexWhere(
            (entry) => entry.meal.shareId == head.last.meal.shareId,
          );
  if (page.nextCursor == null || anchor < 0) {
    return SharedMealFeedPage(entries: head, nextCursor: page.nextCursor);
  }
  final seen = head.map((entry) => entry.meal.shareId).toSet();
  return SharedMealFeedPage(
    entries: [
      ...head,
      for (final entry in current.skip(anchor + 1))
        if (seen.add(entry.meal.shareId)) entry,
    ],
    nextCursor: currentCursor,
  );
}
