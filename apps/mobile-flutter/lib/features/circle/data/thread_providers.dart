/// Reading ONE Circle post out of a feed the app already has.
///
/// There is no `GET /shares/:id` — the server ships a share's replies only as
/// part of a feed page (`lib/domain/social/shares/replies.ts`, the newest 12
/// per share plus a total). So the thread page does not fetch: it watches the
/// feed it was opened from and picks its entry out by share id. The upside is
/// that `appendReply` / `applyReaction` optimistic writes
/// (`feed_mutations.dart`) reach the page on the same frame they reach the
/// card behind it, with no second cache to keep honest.
library;

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../models/social/circle.dart';
import 'feed_providers.dart';

/// Which post, in which feed. `scope` null is the combined friends feed.
typedef ThreadRef = ({String? scope, String shareId});

/// One post out of a live feed, or why it is not there.
///
/// Sealed rather than an enum-plus-nullable-entry: the switch in the screen is
/// exhaustive by construction, and "ready implies an entry" is a type rather
/// than a force-unwrap at the consumer.
sealed class ThreadView {
  const ThreadView();
}

/// The post is on screen.
///
/// [entry] compares by IDENTITY: `_mapShare` returns the SAME instance for
/// entries it did not touch, so a heart tapped on another post yields a view
/// equal to its predecessor and `select` never rebuilds this page.
class ThreadReady extends ThreadView {
  const ThreadReady(this.entry);

  final CircleFeedEntry entry;

  @override
  bool operator ==(Object other) =>
      other is ThreadReady && identical(other.entry, entry);

  @override
  int get hashCode => identityHashCode(entry);
}

/// The feed has never resolved — first paint, or a cold deep link.
class ThreadLoading extends ThreadView {
  const ThreadLoading();
}

/// The feed settled without this share: deleted, or older than the pages
/// loaded so far.
class ThreadMissing extends ThreadView {
  const ThreadMissing();
}

/// The feed failed and has no cached value to fall back on.
class ThreadFailed extends ThreadView {
  const ThreadFailed();
}

/// One post out of the live feed [ThreadRef.scope], by share id.
///
/// Selected rather than watched whole: `_mapShare` returns the SAME instance
/// for entries it did not touch, so a heart tapped on another post yields a
/// [ThreadView] equal to its predecessor and this page never rebuilds for it.
final threadEntryProvider = Provider.autoDispose.family<ThreadView, ThreadRef>((
  ref,
  key,
) {
  return ref.watch(
    sharedMealFeedProvider(key.scope).select((feed) {
      final entry = _find(feed.valueOrNull?.entries, key.shareId);
      // The entry FIRST, then the async flags. A pull-to-refresh puts the feed
      // into AsyncLoading while it keeps its previous value, and a failed
      // refresh keeps that value beside an error — in both the post is still
      // on screen and has to stay there. Reporting `missing` during a refresh
      // window would flash the gone state at someone mid-read.
      if (entry != null) return ThreadReady(entry);
      if (feed.isLoading) return const ThreadLoading();
      if (feed.hasError) return const ThreadFailed();
      return const ThreadMissing();
    }),
  );
});

/// A plain loop, not `firstWhereOrNull` — `collection` is not a dependency of
/// this app (same reason `feed_mutations.dart` hand-rolls its lookups).
CircleFeedEntry? _find(List<CircleFeedEntry>? entries, String shareId) {
  for (final entry in entries ?? const <CircleFeedEntry>[]) {
    if (entry.meal.shareId == shareId) return entry;
  }
  return null;
}
