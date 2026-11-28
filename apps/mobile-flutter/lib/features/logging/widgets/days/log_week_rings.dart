import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/widgets.dart';

import '../../../../shared/logic/display_format.dart';
import '../../../../theme/calm_tokens.dart';
import '../../logic/days/log_calendar.dart';
import '../../logic/timeline_utils.dart';
import 'log_calendar_day.dart';

/// One week of calorie rings, Monday first, each under its weekday's name.
class LogWeekRings extends StatelessWidget {
  const LogWeekRings({
    super.key,
    required this.dates,
    required this.today,
    required this.selectedDate,
    required this.calorieTarget,
    required this.kcalFor,
    required this.onSelectDate,
  });

  /// The week's seven days, Monday first.
  final List<String> dates;
  final String today;
  final String selectedDate;
  final int calorieTarget;

  /// The day's known total, or null when there is none to measure.
  final double? Function(String date) kcalFor;
  final ValueChanged<String> onSelectDate;

  @override
  Widget build(BuildContext context) {
    final locale = context.locale.toString();
    final days = [for (final date in dates) dateStringToDate(date)];
    // "Mon" where every name fits inside its day's cell, "M" where one does
    // not. Measured, not assumed: Vietnamese writes "Th 2", and large text
    // widens them all.
    final short = [for (final d in days) DateFormat.E(locale).format(d)];
    final names =
        short.every((name) => _fits(context, name))
            ? short
            : [for (final d in days) DateFormat('EEEEE', locale).format(d)];
    return Row(
      children: [
        for (var i = 0; i < dates.length; i++)
          Expanded(child: Center(child: _day(dates[i], names[i], locale))),
      ],
    );
  }

  bool _fits(BuildContext context, String name) {
    final painter = TextPainter(
      text: TextSpan(text: name, style: dashCaption()),
      textDirection: Directionality.of(context),
      textScaler: MediaQuery.textScalerOf(context),
      maxLines: 1,
    )..layout();
    final width = painter.width;
    painter.dispose();
    return width <= LogCalendarDay.width - 8;
  }

  Widget _day(String date, String weekday, String locale) {
    final kcal = kcalFor(date);
    final measure = measureDay(kcal, calorieTarget);
    final isFuture = date.compareTo(today) > 0;
    final name = DateFormat.MMMMEEEEd(locale).format(dateStringToDate(date));
    final label = [
      if (date == today) tr('logging.timelineSidebar.todayLabel'),
      name,
      if (!isFuture && kcal != null && kcal > 0)
        tr(
          'logging.days.kcal',
          namedArgs: {'kcal': formatCount(kcal.round(), locale)},
        ),
      if (!isFuture && measure != null && kcal! > 0)
        tr(measure.met ? 'logging.days.targetMet' : 'logging.days.belowTarget'),
    ].join(', ');
    return LogCalendarDay(
      weekday: weekday,
      day: dateStringToDate(date).day,
      measure: measure,
      isToday: date == today,
      isSelected: date == selectedDate,
      isFuture: isFuture,
      semanticsLabel: label,
      onTap: () => onSelectDate(date),
    );
  }
}
