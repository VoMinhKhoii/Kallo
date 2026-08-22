import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../../theme/calm_tokens.dart';
import '../../../../theme/kallo_theme.dart';
import '../../data/feed_time.dart';


/// Avatar (36) + its gap (12): where the content column starts.
const double kContentRail = 48;

class DaySeparator extends StatelessWidget {
  const DaySeparator({required this.date, super.key});
  final DateTime date;

  @override
  Widget build(BuildContext context) {
    final label = threadDayLabel(date, locale: context.locale.languageCode);
    final text = switch (label.kind) {
      ThreadDayLabelKind.today => tr('groups.wall.todayLabel'),
      ThreadDayLabelKind.yesterday => tr('groups.wall.yesterdayLabel'),
      ThreadDayLabelKind.date => label.dateLabel!,
    };
    // Label first, then one rule running out to the edge. Two rules around a
    // centred label read as a chapter break; a day is a heading, and this is a
    // feed where several people share the same day.
    return Padding(
      padding: const EdgeInsets.only(top: KalloSpacing.sp3),
      child: Row(
        children: [
          Text(text, style: dashMeta(weight: FontWeight.w500)),
          const SizedBox(width: KalloSpacing.sp2_5),
          const Expanded(child: Divider(color: kHairline)),
        ],
      ),
    );
  }
}
