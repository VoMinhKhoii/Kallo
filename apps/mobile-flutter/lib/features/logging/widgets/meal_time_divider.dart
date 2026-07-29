import 'package:flutter/material.dart';

import '../../../theme/calm_tokens.dart';
import '../../../theme/nham_colors.dart';
import '../../../theme/nham_theme.dart';

/// Centered time divider that sits on top of a meal card: a hairline, the time
/// (── 1:04 AM ──), and a hairline — replacing the old left-rail time label.
///
/// Shared by every card in the feed, saved or not. A persisted card passes its
/// `loggedAt`; an unconfirmed one passes the moment it was entered, so the feed
/// reads as one continuous timeline instead of losing its rhythm at the card
/// the user is currently working on.
class MealTimeDivider extends StatelessWidget {
  const MealTimeDivider({super.key, required this.time});

  final String time;

  @override
  Widget build(BuildContext context) {
    const line = Expanded(
      child: Divider(
        color: NhamColors.borderFaint,
        height: 1,
        thickness: 1,
      ),
    );
    return Row(
      children: [
        line,
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: NhamSpacing.sp3),
          child: Text(time, style: dashMeta(),),
        ),
        line,
      ],
    );
  }
}
