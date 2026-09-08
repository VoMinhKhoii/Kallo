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

import '../../../shell/nav/nav_actions.dart';
import '../../../shared/widgets/chrome/page_header.dart';
// Re-exports `kallo_screen.dart`, so `Screen` still arrives with it.
import '../../../shared/widgets/surface/kallo_primitives.dart';
import '../../../shared/widgets/surface/scroll_separator.dart';
import '../../../theme/kallo_motion.dart';
import '../data/feed_providers.dart';
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

  /// What the dock currently covers, measured rather than assumed: the field
  /// grows to four lines with the draft, and a constant would leave the last
  /// reply behind it with no way to scroll it clear. A notifier, not state on
  /// this screen: only the body's tail reserve listens, so a grown dock
  /// rebuilds one padding rather than the page.
  final _dockHeight = ValueNotifier<double>(0);

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

  @override
  Widget build(BuildContext context) {
    final view = ref.watch(
      threadEntryProvider((scope: widget.scope, shareId: widget.shareId)),
    );
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
        overlay: switch (view) {
          ThreadReady(:final entry) => Align(
            alignment: Alignment.bottomCenter,
            child: ThreadComposer(
              shareId: widget.shareId,
              // `label`, not `displayName`: the field is nullable and a person
              // with no name set still has a handle to be addressed by — the
              // same fallback every other identity line in Circle uses.
              //
              // Nobody on your OWN post: `friend` is you there, so naming it
              // read "Reply to <your own handle>…". Null falls the composer
              // back to the bare "Reply…".
              authorName: entry.isSelf ? null : entry.friend.label,
              scope: widget.scope,
              focusNode: _focus,
              // Mounted only once the thread is readable, so the composer's
              // own first frame is the right one to focus on — a keyboard over
              // a skeleton would be a keyboard over nothing.
              autofocus: widget.autofocusComposer,
              onHeightChanged: (height) => _dockHeight.value = height,
              onPosted: _scrollToEnd,
            ),
          ),
          ThreadNotReady() => null,
        },
        child: switch (view) {
          ThreadReady(:final entry) => ThreadBody(
            entry: entry,
            scope: widget.scope,
            controller: _scroll,
            dockHeight: _dockHeight,
            onReply: _focus.requestFocus,
          ),
          // No dock in these states, so they owe the home indicator
          // themselves — `Screen(bottom: false)` above hands it to the dock.
          final ThreadNotReady notReady => ThreadStates(
            view: notReady,
            // The feed invalidate is enough: the page drops to loading, which
            // releases the autoDispose fallback, and it refetches when the
            // page comes back (pinned by the fallback test).
            onRetry: () => ref.invalidate(sharedMealFeedProvider(widget.scope)),
          ),
        },
      ),
    );
  }
}
