import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

import '../../../../models/social/circle.dart';
import '../../../../shared/data/surface_cast.dart';
import '../../../../shared/widgets/feedback/kallo_surface_state.dart';
import '../../../../shared/widgets/list/grouped_list_card.dart';
import '../../../../theme/kallo_theme.dart';
import '../../logic/circle_spacing.dart';
import '../feed/feed_entry.dart';
import '../replies/reply_row.dart';
import 'thread_dock_insets.dart';

/// Card pad (16) + the avatar rail (44): where the post's own content column
/// starts, and therefore where its heart glyph starts. Indenting the replies
/// by it puts a reply's avatar directly under that glyph, so the thread reads
/// as one column instead of a post with a wider column of answers beneath it.
const double _replyIndent = KalloSpacing.sp4 + kContentRail;

/// The thread page's scrolling content: the post, then its replies.
///
/// The post is drawn by the same [FeedEntry] the feed draws, in the same white
/// card — so arriving here reads as the post you tapped moving to the top of
/// its own page rather than as a second rendering of it. Its reply glyph is
/// re-pointed at this page's composer, so a post can never push the thread it
/// is already inside.
class ThreadBody extends StatelessWidget {
  const ThreadBody({
    required this.entry,
    required this.scope,
    required this.controller,
    required this.onReply,
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

  /// How much the docked composer covers, so the last reply can clear it.
  final ValueListenable<double> dockHeight;

  @override
  Widget build(BuildContext context) {
    final locale = context.locale.languageCode;

    // Built ONCE here, then handed to [_TailReserve] as a child: the keyboard
    // inset that sets the tail is read down there, so the 250ms ramp rebuilds
    // a padding rather than the post, every reply and all of their text.
    return _TailReserve(
      controller: controller,
      dockHeight: dockHeight,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          GroupedListCard(
            showSeparators: false,
            children: [
              Padding(
                // No bottom pad: the action row's 44pt boxes already carry
                // 13pt of slack under the glyph ink, exactly as the feed's
                // day card nets out in `feed_day_group.dart` (`_actionSlack`).
                padding: const EdgeInsets.only(top: KalloSpacing.sp3),
                // No `onOpen`: this page IS the thread, so the post is not
                // a tap target here — and its reply glyph is re-pointed at
                // this page's own composer.
                child: FeedEntry(entry: entry, scope: scope, onReply: onReply),
              ),
            ],
          ),
          if (entry.replies.isEmpty) ...[
            // The capybara is back (it was dropped for one muted line in
            // `40e1cbe`). A thread with no replies is not a post with a note
            // under it — it is a LIST with nothing in it, and the app answers
            // an empty list with its cast everywhere else, so the one surface
            // that answered with grey text read as the page having failed to
            // finish drawing. It is the `compact` state, which is the size
            // that belongs under a single post.
            //
            // `sp4`, not the line's `sp3`: 12 was measured for a text line
            // sitting close to the post it belongs to; a state of its own
            // stands off the card by the app's block rhythm.
            const SizedBox(height: KalloSpacing.sp4),
            // Full width, or the surface's centred cast and copy would sit
            // hard against the left edge under this start-aligned column.
            SizedBox(
              width: double.infinity,
              child: KalloSurfaceState(
                area: SurfaceArea.circle,
                kind: SurfaceKind.empty,
                compact: true,
                title: tr('groups.feed.noReplies'),
                subtitle: tr('groups.feed.noRepliesBody'),
              ),
            ),
          ] else ...[
            const SizedBox(height: KalloSpacing.sp4),
            Padding(
              padding: const EdgeInsets.only(left: _replyIndent),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  for (final reply in entry.replies) ...[
                    ReplyRow(reply: reply, locale: locale),
                    const SizedBox(height: KalloSpacing.sp3),
                  ],
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}

/// The scroll view and the room the last reply needs to clear the dock.
///
/// Its own widget so the keyboard's ramp and a grown dock rebuild THIS and
/// nothing else: the dock pays the keyboard and home-indicator insets itself
/// and reports only its own height, so the body owes all three — read here,
/// through the dock's own [threadDockInsets], so the two stay the same number
/// and still move on the same frame.
class _TailReserve extends StatelessWidget {
  const _TailReserve({
    required this.controller,
    required this.dockHeight,
    required this.child,
  });

  final ScrollController controller;
  final ValueListenable<double> dockHeight;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final insets = threadDockInsets(context);
    return ValueListenableBuilder<double>(
      valueListenable: dockHeight,
      child: child,
      builder:
          (context, dock, child) => SingleChildScrollView(
            controller: controller,
            padding: EdgeInsets.fromLTRB(
              KalloSpacing.sp3,
              KalloSpacing.sp2,
              KalloSpacing.sp3,
              dock + insets + KalloSpacing.sp4,
            ),
            child: child,
          ),
    );
  }
}
