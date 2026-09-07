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
import 'package:go_router/go_router.dart';

import '../../../shared/data/surface_cast.dart';
import '../../../shared/widgets/chrome/page_header.dart';
import '../../../shared/widgets/feedback/kallo_surface_state.dart';
// Re-exports `kallo_screen.dart`, so `Screen` still arrives with it.
import '../../../shared/widgets/surface/kallo_primitives.dart';
import '../../../shared/widgets/surface/scroll_separator.dart';
import '../../../theme/kallo_motion.dart';
import '../../../theme/kallo_theme.dart';
import '../data/feed_providers.dart';
import '../data/thread_providers.dart';
import '../widgets/states/circle_error.dart';
import '../widgets/states/circle_skeleton.dart';
import '../widgets/thread/thread_body.dart';
import '../widgets/thread/thread_composer.dart';

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
  /// reply behind it with no way to scroll it clear.
  double _dockHeight = 0;
  bool _autofocused = false;

  void _dockHeightChanged(double height) {
    if (!mounted || height == _dockHeight) return;
    setState(() => _dockHeight = height);
  }

  /// Once, on the first frame the thread is actually readable — focusing a
  /// composer that is still behind a skeleton raises a keyboard over nothing.
  void _autofocusOnce() {
    if (_autofocused) return;
    _autofocused = true;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _focus.requestFocus();
    });
  }

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
    if (widget.autofocusComposer && view.status == ThreadStatus.ready) {
      _autofocusOnce();
    }
    final safeBottom = MediaQuery.paddingOf(context).bottom;

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
        overlay:
            view.status == ThreadStatus.ready
                ? Align(
                  alignment: Alignment.bottomCenter,
                  child: ThreadComposer(
                    shareId: widget.shareId,
                    scope: widget.scope,
                    focusNode: _focus,
                    onHeightChanged: _dockHeightChanged,
                    onPosted: _scrollToEnd,
                  ),
                )
                : null,
        child: switch (view.status) {
          // No dock in these states, so the page owes the home indicator
          // itself — `Screen(bottom: false)` above hands it to the composer.
          ThreadStatus.loading => SingleChildScrollView(
            padding: EdgeInsets.fromLTRB(
              KalloSpacing.sp3,
              KalloSpacing.sp3,
              KalloSpacing.sp3,
              KalloSpacing.sp3 + safeBottom,
            ),
            child: const CircleWallSkeleton(),
          ),
          ThreadStatus.failed => SingleChildScrollView(
            padding: EdgeInsets.fromLTRB(
              KalloSpacing.sp3,
              KalloSpacing.sp3,
              KalloSpacing.sp3,
              KalloSpacing.sp3 + safeBottom,
            ),
            child: CircleErrorCard(
              onRetry:
                  () => ref.invalidate(sharedMealFeedProvider(widget.scope)),
            ),
          ),
          // Never auto-pop: a screen that closes itself under the user's thumb
          // reads as a crash. Say what happened and offer the way back.
          ThreadStatus.missing => SingleChildScrollView(
            padding: EdgeInsets.fromLTRB(
              KalloSpacing.sp3,
              KalloSpacing.sp3,
              KalloSpacing.sp3,
              KalloSpacing.sp3 + safeBottom,
            ),
            child: KalloSurfaceState(
              area: SurfaceArea.circle,
              kind: SurfaceKind.empty,
              title: tr('groups.feed.threadGone'),
              subtitle: tr('groups.feed.threadGoneBody'),
              // The way back, said once: without it this state is a dead end
              // on a small screen, where the header can scroll out of reach.
              action: KalloButton(
                title: tr('common.back'),
                variant: KalloButtonVariant.cta,
                onPressed: () => Navigator.of(context).maybePop(),
              ),
            ),
          ),
          ThreadStatus.ready => ThreadBody(
            entry: view.entry!,
            controller: _scroll,
            dockHeight: _dockHeight,
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
  Widget build(BuildContext context) => PageHeader(
    title: tr('groups.feed.threadTitle'),
    // A cold entry (deep link, notification) has no shell beneath this page,
    // so `maybePop` is a no-op and the chevron does nothing. Fall back to the
    // tab this thread belongs to rather than leaving the user stuck.
    onBack:
        () =>
            Navigator.of(context).canPop()
                ? Navigator.of(context).pop()
                : GoRouter.of(context).go('/circle'),
  );
}
