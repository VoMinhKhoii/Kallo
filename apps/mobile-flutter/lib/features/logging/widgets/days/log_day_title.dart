import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/widgets.dart';

import '../../../../theme/calm_tokens.dart';
import '../../logic/timeline_utils.dart';

/// The day's title over the gauges in a two-pane Log: "Today" or the day's
/// name, then its date in muted meta ("Today  Wed, Nov 18").
class LogDayTitle extends StatelessWidget {
  const LogDayTitle({super.key, required this.date, required this.today});

  final String date;
  final String today;

  @override
  Widget build(BuildContext context) {
    final locale = context.locale.toString();
    final day = dateStringToDate(date);
    final name =
        date == today
            ? tr('logging.timelineSidebar.todayLabel')
            : date == addDays(today, -1)
            ? tr('logging.timelineSidebar.yesterdayLabel')
            : DateFormat.EEEE(locale).format(day);
    final sameYear = day.year == dateStringToDate(today).year;
    final full = (sameYear
            ? DateFormat.MMMEd(locale)
            : DateFormat.yMMMEd(locale))
        .format(day);
    return Container(
      height: 44,
      alignment: Alignment.centerLeft,
      child: Semantics(
        header: true,
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.baseline,
          textBaseline: TextBaseline.alphabetic,
          children: [
            Text(name, style: kSectionHeader()),
            const SizedBox(width: 8),
            Flexible(
              child: Text(
                full,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: dashMeta(),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
