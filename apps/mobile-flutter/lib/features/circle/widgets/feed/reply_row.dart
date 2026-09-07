import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../../models/social/circle.dart';
import '../../../../shared/widgets/avatar/profile_avatar.dart';
import '../../../../theme/calm_tokens.dart';
import '../../../../theme/kallo_theme.dart';
import '../../data/feed_time.dart';
import 'feed_rhythm.dart';

/// One reply: the avatar on the left, the reply itself in a pill on the right.
///
/// **The bubble (2026-09-07, user reference: Facebook / Threads comment
/// threads).** A reply used to be a bare paragraph indented under an avatar,
/// which is the same anatomy as the post above it — so a thread read as one
/// long column of posts rather than as a conversation. A fill that hugs its
/// own text says "somebody said this" at a glance, and says it in the shape
/// the two apps the user pointed at use.
///
/// **The name stays OUTSIDE the pill.** [dashName]'s own doc names this exact
/// case — "the Circle post author over the post text, a reply author over the
/// reply… this tier is for identity ONLY" — and the post at the top of a
/// thread sets its name on its own line the same way. Two type tiers inside
/// one container would also restate, one notch down, the wall that stepping
/// the name out of the body was introduced to fix. It keeps the pill's height
/// a pure function of the message, which is the only reason to draw a pill:
/// a one-word reply stays a one-word pill.
///
/// The fill is [kTrack] and the radius [KalloRadii.xxl] — the app's existing
/// bubble language (`features/logging/widgets/turn/sent_bubble.dart`), so the
/// app ends up with ONE bubble rather than two. It reads on both grounds this
/// row appears on: white inside a feed card, cream on the thread page.
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
              // Shrink-wrapped: the pill takes its text's width and wraps at
              // the column, so it never runs full-bleed behind a short reply.
              Align(
                alignment: Alignment.centerLeft,
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: KalloSpacing.sp3_5, // 14
                    vertical: KalloSpacing.sp2_5, // 10
                  ),
                  decoration: BoxDecoration(
                    color: kTrack,
                    // 18, not the card's 22: a reply is not a card, and 18 is
                    // what the app's other bubble already draws.
                    borderRadius: BorderRadius.circular(KalloRadii.xxl),
                  ),
                  child: Text(reply.body, style: dashBody()),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
