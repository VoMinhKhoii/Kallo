import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

import '../../../../models/social/circle.dart';
import '../../../../shared/data/surface_cast.dart';
import '../../../../shared/widgets/feedback/kallo_refresh.dart';
import '../../../../shared/widgets/feedback/kallo_surface_state.dart';
import '../../../../shared/widgets/feedback/sliver_centered_state.dart';
import '../../../../shared/widgets/list/grouped_list_card.dart';
import '../../../../theme/kallo_theme.dart';
import '../feed/feed_entry.dart';
import '../replies/reply_row.dart';
import 'thread_dock_insets.dart';

/// Where a reply's avatar starts: the post card's own horizontal padding, so
/// the disc lands directly under the POST AUTHOR's disc.
///
/// It used to be `sp4 + kContentRail` (60) — under the post's content column,
/// and therefore under its heart glyph rather than under its face. That put the
/// people answering a post a whole avatar-rail to the right of the person who
/// made it, which read as a nested sub-thread. Aligned, the page is one column
/// of faces down the left edge, and the post is told apart from the replies by
/// its card and its larger disc instead (2026-09-22).
const double kReplyIndent = KalloSpacing.sp4;

/// The thread page's scrolling content: the post, then its replies.
///
/// The post is drawn by the same [FeedEntry] the feed draws, in the same white
/// card — so arriving here reads as the post you tapped moving to the top of
/// its own page rather than as a second rendering of it. Its reply glyph is
/// re-pointed at this page's composer, so a post can never push the thread it
/// is already inside.
///
/// A [CustomScrollView] since 2026-09-22, via [KalloRefreshableScroll]: the
/// app's pull-to-refresh is a sliver ([CupertinoSliverRefreshControl]), so a
/// page that wants it cannot be a [SingleChildScrollView]. That conversion is
/// also what lets the empty state centre itself — see [SliverCenteredState].
class ThreadBody extends StatelessWidget {
  const ThreadBody({
    required this.entry,
    required this.scope,
    required this.controller,
    required this.onReply,
    required this.onRefresh,
    required this.dockHeight,
    super.key,
  });

  final CircleFeedEntry entry;

  /// The feed the post was read from, so a heart tapped here lands in THAT
  /// feed's cache even when the Circle tab has another one selected.
  final String? scope;

  final ScrollController controller;

  /// Focuses the page's composer.
  final VoidCallback onReply;

  /// Refetches the post and its replies. Awaited by the refresh control, which
  /// holds the list open for exactly as long as it runs.
  final Future<void> Function() onRefresh;

  /// How much the docked composer covers, so the last reply can clear it.
  final ValueListenable<double> dockHeight;

  @override
  Widget build(BuildContext context) {
    return KalloRefreshableScroll(
      controller: controller,
      onRefresh: onRefresh,
      // The builder's bottom inset is ignored on purpose: this is a pushed
      // route, so `MediaQuery.padding.bottom` is the home indicator rather
      // than the shell's pill nav — and the dock already pays it, through the
      // same `threadDockInsets` [ThreadDockTail] reads.
      slivers:
          (_) => [
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(
                KalloSpacing.sp3,
                KalloSpacing.sp2,
                KalloSpacing.sp3,
                0,
              ),
              sliver: SliverToBoxAdapter(
                child: GroupedListCard(
                  showSeparators: false,
                  children: [
                    Padding(
                      // No bottom pad: the action row's 44pt boxes already
                      // carry 13pt of slack under the glyph ink, exactly as the
                      // feed's day card nets out in `feed_day_group.dart`
                      // (`_actionSlack`).
                      padding: const EdgeInsets.only(top: KalloSpacing.sp3),
                      // No `onOpen`: this page IS the thread, so the post is
                      // not a tap target here — and its reply glyph is
                      // re-pointed at this page's own composer.
                      child: FeedEntry(
                        entry: entry,
                        scope: scope,
                        onReply: onReply,
                      ),
                    ),
                  ],
                ),
              ),
            ),
            if (entry.replies.isEmpty)
              _EmptySliver(dockHeight: dockHeight)
            else
              _RepliesSliver(
                replies: entry.replies,
                locale: context.locale.languageCode,
                dockHeight: dockHeight,
              ),
          ],
    );
  }
}

/// A thread with no replies yet, centred in what is left of the page.
///
/// The capybara is back (it was dropped for one muted line in `40e1cbe`). A
/// thread with no replies is not a post with a note under it — it is a LIST
/// with nothing in it, and the app answers an empty list with its cast
/// everywhere else, so the one surface that answered with grey text read as the
/// page having failed to finish drawing. It is the `compact` state, which is
/// the size that belongs under a single post.
///
/// Centred rather than tucked under the card since 2026-09-22: pinned there it
/// left the bottom two thirds of the page blank, which reads as content still
/// loading. [SliverCenteredState] measures what the post card left over, so the
/// state sits in the middle of the void it is explaining.
class _EmptySliver extends StatelessWidget {
  const _EmptySliver({required this.dockHeight});

  final ValueListenable<double> dockHeight;

  @override
  Widget build(BuildContext context) => SliverCenteredState(
    padding: const EdgeInsets.symmetric(horizontal: KalloSpacing.sp3),
    child: ThreadDockTail(
      dockHeight: dockHeight,
      // No `extra` here, unlike the replies: this state is CENTRED, and a
      // break under it is a break the centring then has to split — the
      // capybara would sit half of it above true middle. The gap it needs from
      // the card is the half of the void above it.
      child: KalloSurfaceState(
        area: SurfaceArea.circle,
        kind: SurfaceKind.empty,
        compact: true,
        title: tr('groups.feed.noReplies'),
        subtitle: tr('groups.feed.noRepliesBody'),
      ),
    ),
  );
}

/// The replies, on the post author's own rail — see [kReplyIndent].
class _RepliesSliver extends StatelessWidget {
  const _RepliesSliver({
    required this.replies,
    required this.locale,
    required this.dockHeight,
  });

  final List<ShareReply> replies;
  final String locale;
  final ValueListenable<double> dockHeight;

  @override
  Widget build(BuildContext context) => SliverPadding(
    padding: const EdgeInsets.only(
      left: KalloSpacing.sp3 + kReplyIndent,
      right: KalloSpacing.sp3,
      top: KalloSpacing.sp4,
    ),
    sliver: SliverToBoxAdapter(
      child: ThreadDockTail(
        dockHeight: dockHeight,
        extra: KalloSpacing.sp4,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          spacing: KalloSpacing.sp3,
          children: [
            for (final reply in replies) ReplyRow(reply: reply, locale: locale),
          ],
        ),
      ),
    ),
  );
}
