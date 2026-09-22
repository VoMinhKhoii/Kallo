/// Reading ONE Circle post for the thread page, out of two sources.
///
/// FIRST the feed the page was opened from: `threadEntryProvider` picks its
/// entry out of `sharedMealFeedProvider(scope)` by share id. That is the
/// primary source and stays it, because it is the cache the optimistic writes
/// in `feed_mutations.dart` patch — a heart or a reply reaches this page on
/// the same frame it reaches the card behind it, with no second copy to keep
/// honest. It is also where a share's replies already arrive
/// (`lib/domain/social/shares/replies.ts`, the newest 12 per share plus a
/// total).
///
/// THEN, only once that feed has settled WITHOUT the post,
/// `sharedMealEntryProvider` fetches it by id
/// (`share_entry_provider.dart`, `GET /api/v1/groups/shares/<shareId>`). The
/// feed cache holds one page of one feed; a share notification opens
/// `/circle/<shareId>` with no scope, so a post older than page 1, or one
/// shared into a chat group by a non-friend, was never in it and the page
/// said "isn't here any more" about a post that exists.
///
/// The order matters in both directions: feed-first keeps the optimistic
/// writes authoritative and costs no request for the ordinary tap-a-card
/// case, and fallback-second means the fetch only ever runs for a post the
/// app genuinely does not have.
library;

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../models/social/circle.dart';
import '../logic/find_share_entry.dart';
import 'feed_providers.dart';
import 'share_entry_provider.dart';

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

/// No post to show yet, for any of three reasons.
///
/// The three share a supertype because every consumer treats them alike: the
/// screen has one arm for all of them and hands them to one widget, which is
/// then exhaustive over exactly the states it can be given — no dead
/// [ThreadReady] arm to write and no unreachable state to explain.
sealed class ThreadNotReady extends ThreadView {
  const ThreadNotReady();
}

/// The feed has never resolved — first paint, or a cold deep link.
class ThreadLoading extends ThreadNotReady {
  const ThreadLoading();
}

/// The feed settled without this share: deleted, or older than the pages
/// loaded so far.
class ThreadMissing extends ThreadNotReady {
  const ThreadMissing();
}

/// The feed failed and has no cached value to fall back on.
class ThreadFailed extends ThreadNotReady {
  const ThreadFailed();
}

/// One post for the thread page, out of the two sources this library's doc
/// explains — the feed first, the fetch by id only if it settles without it.
final threadEntryProvider = Provider.autoDispose.family<ThreadView, ThreadRef>((
  ref,
  key,
) {
  final fromFeed = ref.watch(
    sharedMealFeedProvider(key.scope).select((feed) {
      final entry = findShareEntry(feed.valueOrNull?.entries, key.shareId);
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
  // Missing is the ONLY state that earns a fetch: the feed has settled, with a
  // value, and this share is not in it. Loading and failed are the feed's own
  // answers about itself and belong to the feed — a fetch fired underneath a
  // still-loading feed would race it for a post it is about to deliver.
  if (fromFeed is! ThreadMissing) return fromFeed;

  final fetched = ref.watch(sharedMealEntryProvider(key.shareId));
  // The value FIRST here too, for the same reason as above: a successful reply
  // invalidates this provider to pick up the server's `repliesTotal`, and
  // AsyncLoading keeps the entry it had. Reading the flag first would drop the
  // page back to the skeleton for a frame — taking the composer, and any draft
  // in it, with it.
  if (fetched.hasValue) {
    final entry = fetched.valueOrNull;
    // Null is the server's 404: deleted, or not this viewer's to see. Both are
    // the gone state — the endpoint keeps them indistinguishable on purpose,
    // so it cannot be used to ask whether a share exists.
    return entry == null ? const ThreadMissing() : ThreadReady(entry);
  }
  return fetched.isLoading ? const ThreadLoading() : const ThreadFailed();
});

/// Refetch the post, from whichever of this library's two sources the page is
/// actually reading it out of.
///
/// One function rather than a policy per caller. Pull-to-refresh and the
/// error card's "Try again" are the same question — "get this post again" —
/// and they had drifted into two answers in `circle_thread_screen.dart`, each
/// with its own paragraph justifying it. A third caller (a notification tap, a
/// refetch after posting) would have picked one at random.
///
/// **Exactly one source, never both.** `sharedMealEntryProvider` is
/// `autoDispose` and is alive only because [threadEntryProvider] watched it,
/// which happens only down its `ThreadMissing` branch — so [WidgetRef.exists]
/// is an exact test for "this page is reading the fallback", and the two arms
/// below are the two sources rather than an optimisation.
///
/// Refreshing the feed as WELL would be actively wrong for a fallback post.
/// The feed does not carry it, so `findShareEntry` returns null and
/// [threadEntryProvider] answers `ThreadLoading` from the feed's own flag —
/// before it ever reaches the fallback still holding the post. The page drops
/// to the skeleton, which unmounts `ThreadComposer` and disposes the controller
/// with the user's draft in it. That is the same loss the `hasValue`-first
/// check above is written to prevent, arriving by the one door it does not
/// cover, and a pull-to-refresh on a notification-opened post is how you meet
/// it (found in review, 2026-09-22; pinned by the fallback test).
///
/// The feed keeps its own pull-to-refresh on the Circle tab, which is where
/// refreshing the feed belongs.
///
/// Known and accepted on the feed arm: `SharedMealFeedNotifier.build()` fetches
/// page 1 only, so invalidating the feed drops whatever `loadMore()` had
/// appended — including, if the post came in on a later page, this page's own
/// post. That is what invalidating a paginated provider does, and it is no
/// longer a draft-loss bug: `circle_thread_screen.dart` holds the post it has
/// already shown across a transient `ThreadLoading`, so the refetch happens
/// underneath a page that never goes blank.
///
/// `invalidate` keeps the provider's previous value under the new
/// `AsyncLoading`, so the post stays on screen and the composer stays mounted.
Future<void> refreshThread(WidgetRef ref, ThreadRef key) async {
  final byId = sharedMealEntryProvider(key.shareId);
  final feed = sharedMealFeedProvider(key.scope);
  // Two arms rather than one provider variable: the two have different value
  // types, so a ternary over them widens to `Object` and neither `invalidate`
  // nor `.future` will take it.
  //
  // Awaited, not fired and forgotten: a pull-to-refresh holds its inset open
  // for exactly as long as this runs, and that inset is the page's only "still
  // loading" signal. Errors are swallowed because the page already reports
  // them — a failed refresh keeps the value it had beside the error, and
  // `ThreadStates` owns the case where there is no value at all.
  try {
    if (ref.exists(byId)) {
      ref.invalidate(byId);
      await ref.read(byId.future);
    } else {
      ref.invalidate(feed);
      await ref.read(feed.future);
    }
  } catch (_) {}
}
