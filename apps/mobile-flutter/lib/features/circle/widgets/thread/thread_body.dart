import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../../models/social/circle.dart';
import '../../../../shared/data/surface_cast.dart';
import '../../../../shared/widgets/feedback/kallo_surface_state.dart';
import '../../../../shared/widgets/list/grouped_list_card.dart';
import '../../../../theme/calm_tokens.dart';
import '../../../../theme/kallo_theme.dart';
import '../feed/feed_entry.dart';
import '../replies/reply_row.dart';

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
                // ~13pt of slack under the glyph ink, exactly as the feed's
                // day card nets out in `feed_day_group.dart` (`_actionSlack`).
                padding: const EdgeInsets.only(top: KalloSpacing.sp3),
                child: FeedEntry(entry: entry, onReply: onReply),
              ),
            ],
          ),
          const SizedBox(height: KalloSpacing.sp4),
          if (entry.replies.isEmpty)
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
            )
          else ...[
            if (hidden > 0) ...[
              Text(
                plural(
                  'groups.feed.earlierReplies',
                  hidden,
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

/// The scroll view and the room the last reply needs to clear the dock.
///
/// Its own widget so the keyboard's ramp rebuilds THIS and nothing else: the
/// dock lifts itself by `viewInsets` and reports only its own height, so the
/// body owes both — read here, so the two still move on the same frame.
class _TailReserve extends StatelessWidget {
  const _TailReserve({
    required this.controller,
    required this.dockHeight,
    required this.child,
  });

  final ScrollController controller;
  final double dockHeight;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final reserve = dockHeight + MediaQuery.viewInsetsOf(context).bottom;
    return SingleChildScrollView(
      controller: controller,
      padding: EdgeInsets.fromLTRB(
        KalloSpacing.sp3,
        KalloSpacing.sp2,
        KalloSpacing.sp3,
        reserve + KalloSpacing.sp4,
      ),
      child: child,
    );
  }
}
