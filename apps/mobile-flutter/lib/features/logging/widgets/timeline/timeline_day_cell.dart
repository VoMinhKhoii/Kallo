import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../../theme/calm_tokens.dart';
import '../../../../theme/kallo_colors.dart';
import '../../../../theme/kallo_motion.dart';
import '../../logic/timeline_utils.dart';

class TimelineWeekRow extends StatelessWidget {
  const TimelineWeekRow({
    super.key,
    required this.week,
    required this.today,
    required this.selectedDate,
    required this.mealDates,
    required this.locale,
    required this.onSelect,
  });

  final WeekStrip week;
  final String today;
  final String selectedDate;
  final Set<String> mealDates;
  final String locale;
  final ValueChanged<String> onSelect;

  @override
  Widget build(BuildContext context) {
    // ONE formatter for the row's seven cells. `DateFormat(pattern, locale)`
    // parses the pattern and looks up the locale's symbols on construction, so
    // building one per cell paid that seven times over — and, before the morph
    // stopped rebuilding its layers each frame, seven times per frame.
    final weekday = DateFormat('EEE', locale);

    return Row(
      children: [
        for (final date in week.days) ...[
          Expanded(
            child: TimelineDayCell(
              date: date,
              today: today,
              selectedDate: selectedDate,
              hasMeal: mealDates.contains(date),
              weekday: weekday,
              onSelect: onSelect,
            ),
          ),
          if (date != week.days.last) const SizedBox(width: 4),
        ],
      ],
    );
  }
}

class TimelineDayCell extends StatefulWidget {
  const TimelineDayCell({
    super.key,
    required this.date,
    required this.today,
    required this.selectedDate,
    required this.hasMeal,
    required this.weekday,
    required this.onSelect,
  });

  final String date;
  final String today;
  final String selectedDate;
  final bool hasMeal;

  /// The row's shared weekday formatter — see [TimelineWeekRow.build].
  final DateFormat weekday;
  final ValueChanged<String> onSelect;

  @override
  State<TimelineDayCell> createState() => TimelineDayCellState();
}

class TimelineDayCellState extends State<TimelineDayCell> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    final dateObj = dateStringToDate(widget.date);
    final isToday = widget.date == widget.today;
    final isSelected = widget.date == widget.selectedDate;
    final isFuture = widget.date.compareTo(widget.today) > 0;

    final dayName = widget.weekday.format(dateObj);
    final dayNum = dateObj.day.toString();

    Color? bg;
    if (isSelected) {
      bg = KalloColors.accent20; // bg-kallo-accent/20
    } else if (isToday) {
      bg = KalloColors.accent10; // bg-kallo-accent/10 (today, not selected)
    }
    // Non-selected hover/press affordance: bg-kallo-hover/40.
    if (_pressed && !isSelected) bg = KalloColors.hover40;

    final labelColor = isSelected ? kInk : kInkMuted;

    Widget dot;
    if (isFuture) {
      dot = const SizedBox(width: 6, height: 6);
    } else if (widget.hasMeal) {
      dot = Container(
        width: 6,
        height: 6,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: isSelected ? KalloColors.surface80 : KalloColors.accent,
        ),
      );
    } else {
      dot = Container(
        width: 6,
        height: 6,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          border: Border.all(color: KalloColors.borderFaint), // border/30
        ),
      );
    }

    return GestureDetector(
      onTapDown: (_) => setState(() => _pressed = true),
      onTapUp: (_) => setState(() => _pressed = false),
      onTapCancel: () => setState(() => _pressed = false),
      onTap: () => widget.onSelect(widget.date),
      child: AnimatedScale(
        scale: _pressed ? 0.97 : 1, // active:scale-[0.97]
        duration: const Duration(milliseconds: 150), // duration-150
        curve: Curves.easeOut,
        child: AnimatedContainer(
          duration: KalloMotion.press,
          curve: KalloEase.press,
          constraints: const BoxConstraints(minHeight: 44), // min-h-11
          padding: const EdgeInsets.symmetric(
              vertical: 4, horizontal: 2), // py-1 px-0.5
          decoration: BoxDecoration(
            color: bg,
            borderRadius: BorderRadius.circular(14.4), // rounded-[0.9rem]
          ),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(
                dayName,
                style: dashMeta(color: labelColor),
              ),
              const SizedBox(height: 2), // gap-0.5
              Text(
                dayNum,
                style: dashBody(
                  color: labelColor,
                  tabular: true,
                ),
              ),
              const SizedBox(height: 2),
              dot,
            ],
          ),
        ),
      ),
    );
  }
}
