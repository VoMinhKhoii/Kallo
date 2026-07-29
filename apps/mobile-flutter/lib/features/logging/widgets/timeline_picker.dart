import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:flutter/services.dart';

import '../../../shell/app_header.dart';
import '../../../theme/calm_tokens.dart';
import '../../../theme/nham_colors.dart';
import '../../../theme/nham_theme.dart';
import '../logic/timeline_utils.dart';

/// The collapsed date pill that lives in the app header. Tapping it asks the
/// parent to open the [TimelineStrip] as a dropdown overlay — the chip itself
/// never changes size, so the feed below never shifts.
class TimelineChip extends StatefulWidget {
  const TimelineChip({
    super.key,
    required this.dates,
    required this.selectedDate,
    required this.onTap,
  });

  final List<String> dates;
  final String selectedDate;
  final VoidCallback onTap;

  @override
  State<TimelineChip> createState() => _TimelineChipState();
}

class _TimelineChipState extends State<TimelineChip> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    final locale = context.locale.toString();
    final hasMeal = widget.dates.contains(widget.selectedDate);
    final formatted = formatTimelineDayLabel(widget.selectedDate, locale);

    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTapDown: (_) => setState(() => _pressed = true),
      onTapUp: (_) => setState(() => _pressed = false),
      onTapCancel: () => setState(() => _pressed = false),
      onTap: widget.onTap,
      child: AnimatedScale(
        scale: _pressed ? 0.96 : 1,
        duration: const Duration(milliseconds: 150),
        curve: Curves.easeOut,
        child: Container(
          height: 44,
          constraints: const BoxConstraints(maxWidth: 288), // max-w-72
          padding: const EdgeInsets.symmetric(horizontal: NhamSpacing.sp4),
          decoration: BoxDecoration(
            color: NhamColors.surface,
            borderRadius: BorderRadius.circular(NhamRadii.pill),
            border: Border.all(color: NhamColors.borderHalf), // border/50
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(LucideIcons.calendar,
                  size: 14, color: NhamColors.textMuted),
              const SizedBox(width: NhamSpacing.sp2), // gap-2
              Flexible(
                child: Text(
                  formatted,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: dashMeta().merge(const TextStyle(color: kInk)),
                ),
              ),
              if (hasMeal) ...[
                const SizedBox(width: NhamSpacing.sp2),
                Container(
                  width: 6,
                  height: 6,
                  decoration: const BoxDecoration(
                    shape: BoxShape.circle,
                    color: NhamColors.accent,
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

/// Morphs the date chip IN PLACE into the week strip (and back), at a fixed
/// height so the feed below never shifts. One controller drives a buttery
/// cross-dissolve (chip fades/shrinks out as the strip fades/scales in) on a
/// single easeOutCubic curve. Tapping the chip expands; the parent collapses on
/// any outside tap (the scrim) or a day selection.
class DateMorph extends StatefulWidget {
  const DateMorph({
    super.key,
    required this.dates,
    required this.today,
    required this.selectedDate,
    required this.expanded,
    required this.onSelectDate,
    required this.onExpand,
    required this.onCollapse,
  });

  final List<String> dates;
  final String today;
  final String selectedDate;
  final bool expanded;
  final ValueChanged<String> onSelectDate;
  final VoidCallback onExpand;
  final VoidCallback onCollapse;

  @override
  State<DateMorph> createState() => _DateMorphState();
}

class _DateMorphState extends State<DateMorph>
    with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 340),
    value: widget.expanded ? 1 : 0,
  );

  @override
  void didUpdateWidget(DateMorph old) {
    super.didUpdateWidget(old);
    if (widget.expanded != old.expanded) {
      if (widget.expanded) {
        _c.forward();
      } else {
        _c.reverse();
      }
    }
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    // Fixed height = the expanded strip's height, so morphing never pushes the
    // feed; the collapsed chip just centers in it.
    return SizedBox(
      height: 56,
      child: AnimatedBuilder(
        animation: _c,
        builder: (context, _) {
          final t = Curves.easeOutCubic.transform(_c.value);
          final chipOpacity = (1 - t * 1.6).clamp(0.0, 1.0);
          final stripOpacity = ((t - 0.25) / 0.75).clamp(0.0, 1.0);
          return Stack(
            alignment: Alignment.center,
            children: [
              // Collapsed layer: hamburger + centered chip + mirror spacer.
              // The hamburger lives here, so it fades out as the strip expands.
              if (t < 1)
                Opacity(
                  opacity: chipOpacity,
                  child: IgnorePointer(
                    ignoring: widget.expanded,
                    child: Row(
                      children: [
                        const AppMenuButton(),
                        Expanded(
                          child: Center(
                            child: Transform.scale(
                              scale: 1 - t * 0.04, // shrink as it hands off
                              child: TimelineChip(
                                dates: widget.dates,
                                selectedDate: widget.selectedDate,
                                onTap: widget.onExpand,
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(width: 44, height: 44),
                      ],
                    ),
                  ),
                ),
              // Expanded layer: the week strip, FULL header width.
              if (t > 0)
                Opacity(
                  opacity: stripOpacity,
                  child: IgnorePointer(
                    ignoring: !widget.expanded,
                    child: Transform.scale(
                      scale: 0.96 + 0.04 * t, // settle in from 0.96 → 1
                      child: TimelineStrip(
                        dates: widget.dates,
                        today: widget.today,
                        selectedDate: widget.selectedDate,
                        onSelectDate: widget.onSelectDate,
                        onClose: widget.onCollapse,
                      ),
                    ),
                  ),
                ),
            ],
          );
        },
      ),
    );
  }
}

// A large midpoint so the PageView can page many weeks into the past while the
// current week sits at a known index (weeks are unbounded backwards).
const int _kWeekPageBase = 5000;

/// The expanded week strip, shown as a dropdown overlay below the header. Real
/// week paging via [PageView] (swipe + chevrons). Selecting a day reports it and
/// asks the parent to close.
class TimelineStrip extends StatefulWidget {
  const TimelineStrip({
    super.key,
    required this.dates,
    required this.today,
    required this.selectedDate,
    required this.onSelectDate,
    required this.onClose,
  });

  final List<String> dates;
  final String today;
  final String selectedDate;
  final ValueChanged<String> onSelectDate;
  final VoidCallback onClose;

  @override
  State<TimelineStrip> createState() => _TimelineStripState();
}

class _TimelineStripState extends State<TimelineStrip> {
  late String _visibleAnchor = _selectedAnchor;
  late final PageController _pageController =
      PageController(initialPage: _pageForAnchor(_selectedAnchor));

  String get _currentAnchor => widget.today;
  String get _selectedAnchor =>
      widget.selectedDate.compareTo(_currentAnchor) > 0
          ? _currentAnchor
          : widget.selectedDate;

  bool get _canNavigateNext => _visibleAnchor.compareTo(_currentAnchor) < 0;

  String _anchorForPage(int page) =>
      addDays(_currentAnchor, (page - _kWeekPageBase) * 7);

  int _pageForAnchor(String anchor) {
    final base = dateStringToDate(_currentAnchor);
    final target = dateStringToDate(anchor);
    final weeks = (target.difference(base).inDays / 7).round();
    return _kWeekPageBase + weeks;
  }

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  void _selectDay(String date) {
    if (date != widget.selectedDate) {
      HapticFeedback.selectionClick();
      widget.onSelectDate(date);
    }
    widget.onClose();
  }

  void _onPageChanged(int page) {
    final anchor = _anchorForPage(page);
    if (anchor != _visibleAnchor) {
      HapticFeedback.selectionClick();
      setState(() => _visibleAnchor = anchor);
    }
  }

  void _scrollPrev() {
    _pageController.previousPage(
      duration: const Duration(milliseconds: 280),
      curve: const Cubic(0.16, 1, 0.3, 1),
    );
  }

  void _scrollNext() {
    if (!_canNavigateNext) return;
    _pageController.nextPage(
      duration: const Duration(milliseconds: 280),
      curve: const Cubic(0.16, 1, 0.3, 1),
    );
  }

  @override
  Widget build(BuildContext context) {
    final locale = context.locale.toString();
    final mealDates = widget.dates.toSet();

    return SizedBox(
      height: 56,
      child: Row(
        children: [
          _NavButton(
            icon: LucideIcons.chevronLeft,
            onTap: _scrollPrev,
            color: NhamColors.textMuted,
          ),
          const SizedBox(width: 4), // gap-1
          Expanded(
            child: PageView.builder(
              controller: _pageController,
              onPageChanged: _onPageChanged,
              itemCount: _kWeekPageBase + 1,
              itemBuilder: (context, page) {
                final week = buildCenteredStripFromAnchor(_anchorForPage(page));
                return _WeekRow(
                  week: week,
                  today: widget.today,
                  selectedDate: widget.selectedDate,
                  mealDates: mealDates,
                  locale: locale,
                  onSelect: _selectDay,
                );
              },
            ),
          ),
          const SizedBox(width: 4),
          _NavButton(
            icon: LucideIcons.chevronRight,
            onTap: _canNavigateNext ? _scrollNext : null,
            color: _canNavigateNext
                ? NhamColors.textMuted
                : const Color(0x4D6E6D66), // text-nham-text-muted/30
          ),
        ],
      ),
    );
  }
}

class _WeekRow extends StatelessWidget {
  const _WeekRow({
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
    return Row(
      children: [
        for (final date in week.days) ...[
          Expanded(
            child: _DayCell(
              date: date,
              today: today,
              selectedDate: selectedDate,
              hasMeal: mealDates.contains(date),
              locale: locale,
              onSelect: onSelect,
            ),
          ),
          if (date != week.days.last) const SizedBox(width: 4),
        ],
      ],
    );
  }
}

class _NavButton extends StatefulWidget {
  const _NavButton({required this.icon, required this.color, this.onTap});

  final IconData icon;
  final Color color;
  final VoidCallback? onTap;

  @override
  State<_NavButton> createState() => _NavButtonState();
}

class _NavButtonState extends State<_NavButton> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    final enabled = widget.onTap != null;
    return GestureDetector(
      onTapDown: enabled ? (_) => setState(() => _pressed = true) : null,
      onTapUp: enabled ? (_) => setState(() => _pressed = false) : null,
      onTapCancel: enabled ? () => setState(() => _pressed = false) : null,
      onTap: widget.onTap,
      child: AnimatedScale(
        scale: _pressed ? 0.96 : 1,
        duration: const Duration(milliseconds: 150), // duration-150
        curve: Curves.easeOut,
        child: Container(
          width: 36, // w-9
          height: 40, // h-10
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: _pressed ? NhamColors.hover40 : Colors.transparent,
            borderRadius: BorderRadius.circular(NhamRadii.pill),
          ),
          child: Icon(widget.icon, size: 16, color: widget.color),
        ),
      ),
    );
  }
}

class _DayCell extends StatefulWidget {
  const _DayCell({
    required this.date,
    required this.today,
    required this.selectedDate,
    required this.hasMeal,
    required this.locale,
    required this.onSelect,
  });

  final String date;
  final String today;
  final String selectedDate;
  final bool hasMeal;
  final String locale;
  final ValueChanged<String> onSelect;

  @override
  State<_DayCell> createState() => _DayCellState();
}

class _DayCellState extends State<_DayCell> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    final dateObj = dateStringToDate(widget.date);
    final isToday = widget.date == widget.today;
    final isSelected = widget.date == widget.selectedDate;
    final isFuture = widget.date.compareTo(widget.today) > 0;

    final dayName = DateFormat('EEE', widget.locale).format(dateObj);
    final dayNum = dateObj.day.toString();

    Color? bg;
    if (isSelected) {
      bg = NhamColors.accent20; // bg-nham-accent/20
    } else if (isToday) {
      bg = NhamColors.accent10; // bg-nham-accent/10 (today, not selected)
    }
    // Non-selected hover/press affordance: bg-nham-hover/40.
    if (_pressed && !isSelected) bg = NhamColors.hover40;

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
          color: isSelected ? NhamColors.surface80 : NhamColors.accent,
        ),
      );
    } else {
      dot = Container(
        width: 6,
        height: 6,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          border: Border.all(color: NhamColors.borderFaint), // border/30
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
          duration: const Duration(milliseconds: 150),
          curve: Curves.easeOut,
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
                  weight: FontWeight.w500,
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
