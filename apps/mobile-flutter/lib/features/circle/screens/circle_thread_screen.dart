/// One Circle post and its replies, on their own page.
///
/// Replaces the inline composer that used to open inside a feed card: a
/// conversation was read and written in the few points left at the bottom of
/// a post. It is pushed over the tab shell as a [CupertinoPage] (see
/// `router.dart`), so it arrives with the iOS slide and swipes back onto the
/// feed's untouched scroll position.
///
/// It does not fetch. There is no single-share endpoint, so the page reads its
/// post out of the feed it was opened from — see `data/thread_providers.dart`
/// for why that is the better half of the trade.
library;

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../shared/data/surface_cast.dart';
import '../../../shared/widgets/chrome/page_header.dart';
import '../../../shared/widgets/feedback/kallo_surface_state.dart';
import '../../../shared/widgets/surface/kallo_screen.dart';
import '../../../shared/widgets/surface/scroll_separator.dart';
import '../../../theme/kallo_motion.dart';
import '../../../theme/kallo_theme.dart';
import '../data/feed_providers.dart';
import '../data/thread_providers.dart';
import '../widgets/states/circle_error.dart';
import '../widgets/states/circle_skeleton.dart';
import '../widgets/thread/thread_body.dart';
import '../widgets/thread/thread_composer.dart';

/// What the docked composer covers at rest — one line of [dashBody] in its
/// 44pt row plus the dock's own padding. The body reserves this much tail so
/// the last reply can be scrolled clear of it.
const double _kDockHeight = 76;

class CircleThreadScreen extends ConsumerStatefulWidget {
  const CircleThreadScreen({required this.shareId, this.scope, super.key});

  final String shareId;

  /// Which feed the post was read from — null is the combined friends feed.
  final String? scope;

  @override
  ConsumerState<CircleThreadScreen> createState() => _CircleThreadScreenState();
}

class _CircleThreadScreenState extends ConsumerState<CircleThreadScreen> {
  final _focus = FocusNode();
  final _scroll = ScrollController();

  @override
  void dispose() {
    _focus.dispose();
    _scroll.dispose();
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
        header: const Padding(
          padding: EdgeInsets.symmetric(horizontal: KalloSpacing.sp3),
          child: _ThreadHeader(),
        ),
        // `overlay`, not part of `child`: a multiline TextField builds a real
        // depth-0 Scrollable, and a composer inside the body would drive the
        // header's hairline as the user typed with the page still at the top.
        // ScrollSeparator documents this exact trap.
        overlay: view.status == ThreadStatus.ready
            ? Align(
                alignment: Alignment.bottomCenter,
                child: ThreadComposer(
                  shareId: widget.shareId,
                  focusNode: _focus,
                  onPosted: _scrollToEnd,
                ),
              )
            : null,
        child: switch (view.status) {
          ThreadStatus.loading => const SingleChildScrollView(
            padding: EdgeInsets.all(KalloSpacing.sp3),
            child: CircleWallSkeleton(),
          ),
          ThreadStatus.failed => SingleChildScrollView(
            padding: const EdgeInsets.all(KalloSpacing.sp3),
            child: CircleErrorCard(
              onRetry: () =>
                  ref.invalidate(sharedMealFeedProvider(widget.scope)),
            ),
          ),
          // Never auto-pop: a screen that closes itself under the user's thumb
          // reads as a crash. Say what happened and offer the way back.
          ThreadStatus.missing => KalloSurfaceState(
            area: SurfaceArea.circle,
            kind: SurfaceKind.empty,
            title: tr('groups.feed.threadGone'),
            subtitle: tr('groups.feed.threadGoneBody'),
          ),
          ThreadStatus.ready => ThreadBody(
            entry: view.entry!,
            controller: _scroll,
            dockHeight: _kDockHeight,
            onReply: _focus.requestFocus,
          ),
        },
      ),
    );
  }
}

class _ThreadHeader extends StatelessWidget {
  const _ThreadHeader();

  @override
  Widget build(BuildContext context) =>
      PageHeader(title: tr('groups.feed.threadTitle'));
}
