import 'dart:math' as math;

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../../models/social/circle.dart';
import '../../../../theme/calm_tokens.dart';
import '../../../../theme/kallo_theme.dart';
import '../../logic/circle_thread_route.dart';
import '../replies/reply_row.dart';

/// The newest replies under a post in the feed, as a read-only teaser.
///
/// It replaced `ShareReplies` on 2026-09-07, when replying moved to its own
/// page (`screens/circle_thread_screen.dart`). Two things went with the
/// composer:
///
/// * **The composer itself.** Its only trigger was the post's reply glyph,
///   which now pushes the thread; keeping it would leave two differently
///   styled inputs for one action.
/// * **Depth.** The API ships up to 12 replies per share and this widget drew
///   all of them, so one chatty post could own a whole day card. With a page
///   to send people to, the card shows [_kPreviewCount] and links out.
const int _kPreviewCount = 2;

/// The "View all" line is a 17.5pt line of [dashMeta] inside a [KalloIcons.hit]
/// tap box, so it carries (44 − 17.5) / 2 ≈ 13pt of slack UNDER its ink. That
/// slack is paid out of this widget's own bottom gap — the same netting
/// `feed_day_group.dart` does with `_actionSlack` — so a full tap target does
/// not open a visible hole under the last reply: max(sp3 − 13, 0) = 0.
const double _kLinkSlack = 13;

class ReplyPreview extends StatelessWidget {
  const ReplyPreview({
    required this.entry,
    required this.scope,
    super.key,
  });

  final CircleFeedEntry entry;

  /// The feed this post was read from, carried into the thread URL.
  final String? scope;

  @override
  Widget build(BuildContext context) {
    final replies = entry.replies;
    // Nothing to show: the post keeps the action row as its last line.
    if (replies.isEmpty) return const SizedBox.shrink();

    final locale = context.locale.languageCode;
    final shown = replies.length <= _kPreviewCount
        ? replies
        : replies.sublist(replies.length - _kPreviewCount);
    final total = entry.repliesTotal;
    final showsLink = total > shown.length;

    // Top gap comes from the action row's tap slack above; this widget owns
    // the post's bottom gap whenever it renders anything — less whatever the
    // "View all" box already carries (see [_kLinkSlack]).
    return Padding(
      padding: EdgeInsets.only(
        bottom: showsLink
            ? math.max(KalloSpacing.sp3 - _kLinkSlack, 0)
            : KalloSpacing.sp3,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          for (final reply in shown) ...[
            ReplyRow(reply: reply, locale: locale),
            const SizedBox(height: KalloSpacing.sp3),
          ],
          if (showsLink)
            Semantics(
              button: true,
              child: GestureDetector(
                behavior: HitTestBehavior.opaque,
                onTap: () => openCircleThread(
                  context,
                  shareId: entry.meal.shareId,
                  scope: scope,
                ),
                // A real 44pt target, not vertical slack: this is the one
                // affordance in the card that leaves the page. The gap it
                // would open under the last reply is paid back above.
                child: ConstrainedBox(
                  constraints: const BoxConstraints(minHeight: KalloIcons.hit),
                  child: Align(
                    alignment: Alignment.centerLeft,
                    child: Text(
                      tr(
                        'groups.feed.viewAllReplies',
                        namedArgs: {'count': '$total'},
                      ),
                      style: dashMeta(),
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}
