import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../../models/social/circle.dart';
import '../../../../shared/widgets/surface/kallo_pressable.dart';
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

class ReplyPreview extends StatelessWidget {
  const ReplyPreview({required this.entry, this.scope, super.key});

  final CircleFeedEntry entry;

  /// The feed this post was read from, carried into the thread URL.
  final String? scope;

  @override
  Widget build(BuildContext context) {
    final replies = entry.replies;
    // Nothing to show: the post keeps the action row as its last line.
    if (replies.isEmpty) return const SizedBox.shrink();

    final locale = context.locale.languageCode;
    final shown =
        replies.length <= _kPreviewCount
            ? replies
            : replies.sublist(replies.length - _kPreviewCount);
    final total = entry.repliesTotal;
    final showsLink = total > shown.length;

    // Top gap comes from the action row's tap slack above; this widget owns
    // the post's bottom gap whenever it renders anything. With the link it
    // owes nothing: a 17.5pt line of [dashMeta] in a 44pt tap box already
    // carries ~13pt of slack under its ink, more than the sp3 the gap wants —
    // the same netting `feed_day_group.dart` does with `_actionSlack`.
    return Padding(
      padding: EdgeInsets.only(bottom: showsLink ? 0 : KalloSpacing.sp3),
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
              // A real 44pt target, not vertical slack: this is the one
              // affordance in the card that leaves the page. The gap it
              // would open under the last reply is paid back above.
              child: KalloPressable(
                onTap:
                    () => openCircleThread(
                      context,
                      shareId: entry.meal.shareId,
                      scope: scope,
                    ),
                constraints: const BoxConstraints(minHeight: KalloIcons.hit),
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
        ],
      ),
    );
  }
}
