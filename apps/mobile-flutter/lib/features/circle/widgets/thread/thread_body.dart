import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

import '../../../../models/social/circle.dart';
import '../../../../shared/widgets/list/grouped_list_card.dart';
import '../../../../theme/calm_tokens.dart';
import '../../../../theme/kallo_theme.dart';
import '../feed/feed_day_group.dart' show kContentRail;
import '../feed/feed_entry.dart';
import '../replies/reply_row.dart';

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
                child: FeedEntry(
                  entry: entry,
                  scope: scope,
                  onReply: onReply,
                  openThread: false,
                ),
              ),
            ],
          ),
          if (entry.replies.isEmpty) ...[
            // One quiet line on the replies' own rail, not an illustrated
            // empty state: an empty thread is the ordinary case here, and a
            // cast with a headline under a single post says at the volume of
            // a problem that there is simply nothing here yet. It sits closer
            // to the post than the replies do — it belongs to that post
            // rather than standing in for a list.
            const SizedBox(height: KalloSpacing.sp3),
            Padding(
              padding: const EdgeInsets.only(left: _replyIndent),
              child: Text(tr('groups.feed.noReplies'), style: dashMeta()),
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
/// so they still move on the same frame.
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
    final insets =
        MediaQuery.viewInsetsOf(context).bottom +
        MediaQuery.paddingOf(context).bottom;
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
