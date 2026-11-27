import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/widgets.dart';

import '../../../../shared/logic/display_format.dart';
import '../../../../theme/calm_tokens.dart';
import '../../logic/days/log_calendar.dart';
import '../../logic/timeline_utils.dart';
import 'log_calendar_day.dart';

/// One month of days, Monday first, under a row of weekday initials. Days
/// before the 1st leave their cells empty so every date keeps its column.
class LogMonthGrid extends StatelessWidget {
  const LogMonthGrid({
    super.key,
    required this.month,
    required this.today,
    required this.selectedDate,
    required this.calorieTarget,
    required this.kcalFor,
    required this.onSelectDate,
  });

  final DateTime month;
  final String today;
  final String selectedDate;
  final int calorieTarget;

  /// The day's known total, or null when there is none to measure.
  final double? Function(String date) kcalFor;
  final ValueChanged<String> onSelectDate;

  @override
  Widget build(BuildContext context) {
    final locale = context.locale.toString();
    final cells = monthCells(month);
    final initial = DateFormat('EEEEE', locale);
    // 2026-11-02 is a Monday; the header needs only the weekday's shape.
    final weekdays = [
      for (var i = 0; i < 7; i++) initial.format(DateTime(2026, 11, 2 + i)),
    ];
    final rows = <Widget>[];
    for (var start = 0; start < cells.length; start += 7) {
      rows.add(
        Padding(
          padding: const EdgeInsets.only(top: 4),
          child: Row(
            children: [
              for (var i = start; i < start + 7; i++)
                Expanded(
                  child: Center(
                    child:
                        i < cells.length && cells[i] != null
                            ? _day(cells[i]!, locale)
                            : const SizedBox(height: LogCalendarDay.size),
                  ),
                ),
            ],
          ),
        ),
      );
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        ExcludeSemantics(
          child: Row(
            children: [
              for (final name in weekdays)
                Expanded(
                  child: Text(
                    name,
                    textAlign: TextAlign.center,
                    style: dashCaption(),
                  ),
                ),
            ],
          ),
        ),
        const SizedBox(height: 4),
        ...rows,
      ],
    );
  }

  Widget _day(String date, String locale) {
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
