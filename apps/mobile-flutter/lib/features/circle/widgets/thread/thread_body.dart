import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../../models/social/circle.dart';
import '../../../../shared/data/surface_cast.dart';
import '../../../../shared/widgets/feedback/kallo_surface_state.dart';
import '../../../../shared/widgets/list/grouped_list_card.dart';
import '../../../../theme/calm_tokens.dart';
import '../../../../theme/kallo_theme.dart';
import '../feed/feed_entry.dart';
import '../feed/reply_row.dart';

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
    required this.controller,
    required this.onReply,
    required this.dockHeight,
    super.key,
  });

  final CircleFeedEntry entry;
  final ScrollController controller;

  /// Focuses the page's composer.
  final VoidCallback onReply;

  /// How much the docked composer covers, so the last reply can clear it.
  final double dockHeight;

  @override
  Widget build(BuildContext context) {
    final locale = context.locale.languageCode;
    // The API ships the newest 12 replies per share and `appendReply` re-trims
    // to 12, so a long thread silently loses its oldest. Saying so here is
    // what keeps that from being invisible — there is no endpoint to page the
    // rest back in.
    final hidden = entry.repliesTotal - entry.replies.length;
    // Read HERE, not passed down: the keyboard inset and the dock's own lift
    // move on the same frame, and reading it in this subtree keeps the two in
    // step without rebuilding the screen.
    final reserve = dockHeight + MediaQuery.viewInsetsOf(context).bottom;

    return SingleChildScrollView(
      controller: controller,
      padding: EdgeInsets.fromLTRB(
        KalloSpacing.sp3,
        KalloSpacing.sp2,
        KalloSpacing.sp3,
        reserve + KalloSpacing.sp4,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          GroupedListCard(
            showSeparators: false,
            children: [
              Padding(
                padding: const EdgeInsets.symmetric(
                  vertical: KalloSpacing.sp3,
                ),
                child: FeedEntry(entry: entry, onReply: onReply),
              ),
            ],
          ),
          const SizedBox(height: KalloSpacing.sp4),
          if (entry.replies.isEmpty)
            KalloSurfaceState(
              area: SurfaceArea.circle,
              kind: SurfaceKind.empty,
              compact: true,
              title: tr('groups.feed.noReplies'),
              subtitle: tr('groups.feed.noRepliesBody'),
            )
          else ...[
            if (hidden > 0) ...[
              Text(
                tr(
                  'groups.feed.earlierReplies',
                  namedArgs: {'count': '$hidden'},
                ),
                style: dashMeta(),
              ),
              const SizedBox(height: KalloSpacing.sp3),
            ],
            for (final reply in entry.replies) ...[
              ReplyRow(reply: reply, locale: locale),
              const SizedBox(height: KalloSpacing.sp3),
            ],
          ],
        ],
      ),
    );
  }
}
