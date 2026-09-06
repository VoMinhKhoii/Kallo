import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../../models/social/circle.dart';
import '../../../../shared/widgets/avatar/profile_avatar.dart';
import '../../../../theme/calm_tokens.dart';
import '../../../../theme/kallo_theme.dart';
import '../../data/feed_time.dart';

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
                    TextSpan(
                      text: name,
                      style: dashName(),
                    ),
                    TextSpan(
                      text:
                          ' ${formatElapsed(reply.createdAt, locale: locale)}',
                      style: dashMeta(),
                    ),
                  ],
                ),
              ),
              Text(reply.body, style: dashBody()),
            ],
          ),
        ),
      ],
    );
  }
}
