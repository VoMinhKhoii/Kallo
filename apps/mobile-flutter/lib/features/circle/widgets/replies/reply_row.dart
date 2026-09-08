import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../../models/social/circle.dart';
import '../../../../shared/widgets/avatar/profile_avatar.dart';
import '../../../../theme/calm_tokens.dart';
import '../../../../theme/kallo_theme.dart';
import '../../data/feed_time.dart';
import '../feed/feed_rhythm.dart';

/// One reply: the avatar on the left, the author line and the reply body in
/// the content column beside it.
///
/// **A reply reuses the post's anatomy (2026-09-08).** Name row, then the body
/// at [dashBody] under a [kFeedTight] gap — exactly how [FeedEntry] sets its
/// meal text under its own author line. Same tiers, same gap, same left edge,
/// so a thread reads as one column of writing where the post and the replies
/// to it are the same kind of thing, told apart by the avatar and the indent
/// rather than by a change of surface.
///
/// It wore a [kTrack] pill for one day (2026-09-07, chasing Facebook/Threads
/// comment bubbles). The user asked for it back as plain text: those apps put
/// a bubble around a comment because the comment is ALL there is, while here
/// the reply sits under a meal card that is already a surface — a fill inside
/// a fill, on the cream thread page a third one. The name/body relationship
/// the pill was drawn to carry is carried by the type on its own.
class ReplyRow extends StatelessWidget {
  const ReplyRow({required this.reply, required this.locale, super.key});

  final ShareReply reply;
  final String locale;

  @override
  Widget build(BuildContext context) {
    final name = reply.isSelf ? tr('groups.wall.you') : reply.author.label;
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        ProfileAvatarDisc(profile: reply.author, size: 28),
        const SizedBox(width: KalloSpacing.sp2),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text.rich(
                TextSpan(
                  children: [
                    // Same identity line as a post: a reply reuses the meal
                    // anatomy, so its author should not read heavier than the
                    // author of the thing being replied to.
                    TextSpan(text: name, style: dashName()),
                    TextSpan(
                      text:
                          ' ${formatElapsed(reply.createdAt, locale: locale)}',
                      style: dashMeta(),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: kFeedTight),
              Text(reply.body, style: dashBody()),
            ],
          ),
        ),
      ],
    );
  }
}
