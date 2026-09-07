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

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../models/social/circle.dart';
import 'feed_providers.dart';

/// Which post, in which feed. `scope` null is the combined friends feed.
typedef ThreadRef = ({String? scope, String shareId});

enum ThreadStatus {
  /// The feed has never resolved — first paint, or a cold deep link.
  loading,

  /// [ThreadView.entry] is non-null.
  ready,

  /// The feed settled without this share: deleted, or older than the pages
  /// loaded so far.
  missing,

  /// The feed failed and has no cached value to fall back on.
  failed,
}

@immutable
class ThreadView {
  const ThreadView(this.status, [this.entry]);

  final ThreadStatus status;
  final CircleFeedEntry? entry;

  @override
  bool operator ==(Object other) =>
      other is ThreadView &&
      other.status == status &&
      identical(other.entry, entry);

  @override
  int get hashCode => Object.hash(status, identityHashCode(entry));
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
      if (entry != null) return ThreadView(ThreadStatus.ready, entry);
      if (feed.isLoading) return const ThreadView(ThreadStatus.loading);
      if (feed.hasError) return const ThreadView(ThreadStatus.failed);
      return const ThreadView(ThreadStatus.missing);
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
