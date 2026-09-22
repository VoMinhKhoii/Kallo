/// One Circle post and its replies, on their own page.
///
/// Replaces the inline composer that used to open inside a feed card: a
/// conversation was read and written in the few points left at the bottom of
/// a post. It is pushed over the tab shell as a [CupertinoPage] (see
/// `router.dart`), so it arrives with the iOS slide and swipes back onto the
/// feed's untouched scroll position.
///
/// The post arrives behind `threadEntryProvider`, which reads two sources in
/// order — see `data/thread_providers.dart`.
library;

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../models/social/circle.dart';
import '../../../shell/nav/nav_actions.dart';
import '../../../shared/widgets/chrome/page_header.dart';
// Re-exports `kallo_screen.dart`, so `Screen` still arrives with it.
import '../../../shared/widgets/surface/kallo_primitives.dart';
import '../../../shared/widgets/surface/scroll_separator.dart';
import '../../../theme/kallo_motion.dart';
import '../data/thread_providers.dart';
import '../widgets/thread/thread_body.dart';
import '../widgets/thread/thread_composer.dart';
import '../widgets/thread/thread_states.dart';

class CircleThreadScreen extends ConsumerStatefulWidget {
  const CircleThreadScreen({
    required this.shareId,
    this.scope,
    this.autofocusComposer = false,
    super.key,
  });

  final String shareId;

  /// Which feed the post was read from — null is the combined friends feed.
  final String? scope;

  /// Opens the keyboard on arrival. Set by `?compose=1`, which the post's
  /// reply glyph appends: tapping it used to raise the inline composer, and a
  /// page that arrives with the field cold loses that gesture. Reading it out
  /// of the URL rather than out of a callback keeps a deep link honest too.
  final bool autofocusComposer;

  @override
  ConsumerState<CircleThreadScreen> createState() => _CircleThreadScreenState();
}

class _CircleThreadScreenState extends ConsumerState<CircleThreadScreen> {
  final _focus = FocusNode();
  final _scroll = ScrollController();

  /// Which post, in which feed — the key both the view and the refetch read.
  ThreadRef get _ref => (scope: widget.scope, shareId: widget.shareId);

  /// What the dock currently covers, measured rather than assumed: the field
  /// grows to four lines with the draft, and a constant would leave the last
  /// reply behind it with no way to scroll it clear. A notifier, not state on
  /// this screen: only the body's tail reserve listens, so a grown dock
  /// rebuilds one padding rather than the page.
  final _dockHeight = ValueNotifier<double>(0);

  /// The last post this page actually showed, held so a refetch underneath it
  /// does not blank the page — see the rule documented in [build].
  ///
  /// Stored WITH the thread it belongs to. `MaterialPage` in `router.dart`
  /// carries no key, so `Navigator` updates the existing route in place when
  /// this page is asked for a different share (a notification tapped while
  /// already reading a thread): the widget's `shareId` changes under a state
  /// that is kept. A bare entry would then be shown for the new thread while it
  /// loads — post A on screen over a dock that already posts to B (caught in
  /// review, 2026-09-22).
  ({ThreadRef ref, CircleFeedEntry entry})? _lastReady;

  @override
  void dispose() {
    _focus.dispose();
    _scroll.dispose();
    _dockHeight.dispose();
    super.dispose();
  }

  /// Rides the new reply into view once the list has laid it out.
  void _scrollToEnd() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted || !_scroll.hasClients) return;
      _scroll.animateTo(
        _scroll.position.maxScrollExtent,
        duration: KalloMotion.scrollTo,
        curve: KalloEase.standard,
      );
    });
  }

  /// The post and its replies, plus the pull that refetches them.
  Widget _body(CircleFeedEntry post) => ThreadBody(
    entry: post,
    scope: widget.scope,
    controller: _scroll,
    dockHeight: _dockHeight,
    onReply: _focus.requestFocus,
    onRefresh: () => refreshThread(ref, _ref),
  );

  /// The reply dock, which exists only while there is a post to reply to.
  Widget _dock(CircleFeedEntry post) => Align(
    alignment: Alignment.bottomCenter,
    child: ThreadComposer(
      // Keyed so a share swapped in under a kept state gets a FRESH composer
      // rather than the previous thread's draft in a field now addressed to
      // this one. The same identity change as the held post above, from the
      // other side.
      //
      // The SHARE, not the whole [ThreadRef]: a draft belongs to the post it
      // answers, and `createShareReply` addresses it by `shareId` — `scope`
      // only picks which feed cache the optimistic splice patches, and is read
      // live at submit, so a scope change needs no fresh state. Keying on the
      // ref would throw a draft away when the same post is opened from another
      // feed, which is a loss with nothing bought.
      key: ValueKey(widget.shareId),
      shareId: widget.shareId,
      // `label`, not `displayName`: the field is nullable and a person with no
      // name set still has a handle to be addressed by — the same fallback
      // every other identity line in Circle uses.
      //
      // Nobody on your OWN post: `friend` is you there, so naming it read
      // "Reply to <your own handle>…". Null falls the composer back to the
      // bare "Reply…".
      authorName: post.isSelf ? null : post.friend.label,
      scope: widget.scope,
      focusNode: _focus,
      // Mounted only once the thread is readable, so the composer's own first
      // frame is the right one to focus on — a keyboard over a skeleton would
      // be a keyboard over nothing.
      autofocus: widget.autofocusComposer,
      onHeightChanged: (height) => _dockHeight.value = height,
      onPosted: _scrollToEnd,
    ),
  );

  @override
  Widget build(BuildContext context) {
    final view = ref.watch(threadEntryProvider(_ref));
    // A page that has shown a post does not go blank while it refetches one.
    //
    // `threadEntryProvider` answers `ThreadLoading` whenever the feed is in
    // flight or has stopped carrying this post, and swapping in [ThreadStates]
    // for that unmounts [ThreadComposer] — disposing the controller with the
    // user's draft in it. Two ways in, found in review a day apart: a
    // fallback-sourced post whose feed got invalidated (fixed at the caller in
    // `9e00da8`), and a post on page 2+ whose feed reset to page 1 under it,
    // since `SharedMealFeedNotifier.build()` refetches only the first page. A
    // third would land the same way, so the rule belongs here rather than in a
    // third branch of `refreshThread`.
    //
    // `ThreadMissing` is NEVER masked. It is the one settled answer ABOUT THE
    // POST — the server said 404, which is "deleted, or not yours to see" — so
    // a post that is genuinely gone still reaches the gone state and this
    // cannot turn into "the page never admits the post is gone".
    //
    // `ThreadFailed` IS masked once a post has been shown, which the first cut
    // of this rule got wrong (caught in review, 2026-09-22): the cold by-id
    // fetch that replaces a page-2 post can fail with a transport error, and
    // answering that by tearing the page down destroys a draft over a train
    // going into a tunnel. It says nothing about whether the post exists — as
    // `ThreadStates` itself puts it, a transport failure is not a deleted post.
    // Keeping the content and staying quiet is also exactly what a failed pull
    // on the Circle feed does (`circle_screen.dart`, `_refresh`), so the two
    // surfaces answer a failed refresh the same way. With NOTHING held, it
    // still shows its retry — that is the cold-load case the state is for.
    //
    // Page and dock come out of ONE switch, built where the post is a non-null
    // local: "there is a post to show" and "there is a state to show instead"
    // are a single decision, so they cannot drift apart, and no arm has to
    // recover the post with a `!` or the state with a cast.
    if (view is ThreadReady) _lastReady = (ref: _ref, entry: view.entry);
    // Structural rather than a `didUpdateWidget` reset: a held post that does
    // not belong to the thread being shown cannot be reached at all, whatever
    // the lifecycle does. [ThreadRef] is a record, so this is value equality.
    final last = _lastReady;
    final held = last != null && last.ref == _ref ? last.entry : null;
    final (Widget body, Widget? dock) = switch (view) {
      ThreadReady(:final entry) => (_body(entry), _dock(entry)),
      // Two arms rather than `ThreadLoading() || ThreadFailed() when …`: the
      // formatter breaks that across lines so the guard reads as if it bound
      // to the second pattern alone. `ThreadMissing` is deliberately not here.
      ThreadLoading() when held != null => (_body(held), _dock(held)),
      ThreadFailed() when held != null => (_body(held), _dock(held)),
      // No dock in these states, so they owe the home indicator themselves —
      // `Screen(bottom: false)` below hands it to the dock.
      final ThreadNotReady notReady => (
        ThreadStates(
          view: notReady,
          // The same refetch the pull uses: "Try again" and a pull down are one
          // question, and two policies for it had already drifted apart here.
          // `refreshThread` owns both.
          onRetry: () => refreshThread(ref, _ref),
        ),
        null,
      ),
    };
    return Screen(
      // The dock pays the home indicator itself, so the page must not also
      // reserve it — that would float the composer above the edge.
      bottom: false,
      child: ScrollSeparator(
        header: PageHeader(
          title: tr('groups.feed.threadTitle'),
          // A cold entry (deep link, notification) has no shell beneath this
          // page; fall back to the tab the thread belongs to.
          onBack: () => popOr(context, (router) => router.go('/circle')),
        ),
        // `overlay`, not part of `child`: a multiline TextField builds a real
        // depth-0 Scrollable, and a composer inside the body would drive the
        // header's hairline as the user typed with the page still at the top.
        // ScrollSeparator documents this exact trap.
        overlay: dock,
        child: body,
      ),
    );
  }
}
