import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../shared/widgets/nham_text.dart';
import '../../../theme/nham_colors.dart';
import '../../../theme/nham_theme.dart';
import '../../../theme/nham_typography.dart';
import '../logic/timeline_utils.dart';

/// Chip (collapsed) vs. week-strip (expanded) date picker. The expanded/chip
/// state is lifted to the parent so the header can hand the strip the full row.
///
/// Ported 1:1 from
/// `apps/mobile/src/components/logging/input/timeline-picker.tsx`.
class TimelinePicker extends StatefulWidget {
  const TimelinePicker({
    super.key,
    required this.dates,
    required this.today,
    required this.selectedDate,
    required this.onSelectDate,
    required this.expanded,
    required this.onExpandedChange,
  });

  final List<String> dates;
  final String today;
  final String selectedDate;
  final ValueChanged<String> onSelectDate;
  final bool expanded;
  final ValueChanged<bool> onExpandedChange;

  @override
  State<TimelinePicker> createState() => _TimelinePickerState();
}

// A large midpoint so the PageView can page many weeks into the past while the
// current week sits at a known index (weeks are unbounded backwards).
const int _kWeekPageBase = 5000;

class _TimelinePickerState extends State<TimelinePicker> {
  late String _visibleAnchor = _selectedAnchor;
  // The current week lives at [_kWeekPageBase]; each page back is one week
  // earlier, each page forward one later (capped at the current week).
  late final PageController _pageController =
      PageController(initialPage: _kWeekPageBase);

  String get _currentAnchor => widget.today;
  String get _selectedAnchor => widget.selectedDate.compareTo(_currentAnchor) > 0
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

  void _openStrip() {
    setState(() => _visibleAnchor = _selectedAnchor);
    // Jump the PageView to the selected week without animating the open.
    final page = _pageForAnchor(_selectedAnchor);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_pageController.hasClients) _pageController.jumpToPage(page);
    });
    widget.onExpandedChange(true);
  }

  void _selectDay(String date) {
    if (date != widget.selectedDate) {
      HapticFeedback.selectionClick();
      widget.onSelectDate(date);
    }
    widget.onExpandedChange(false);
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

    // The container morphs between the chip pill and the full-width strip,
    // mirroring the framer `layout` morph (motion.div, duration 0.28s,
    // cubic-bezier(0.16,1,0.3,1)) in mobile-timeline-picker.tsx:347-356.
    return LayoutBuilder(
        builder: (context, constraints) {
          final expanded = widget.expanded;
          return AnimatedContainer(
            duration: const Duration(milliseconds: 280),
            curve: const Cubic(0.16, 1, 0.3, 1),
            // Chip is a single row (44px); the expanded strip stacks
            // weekday + number + dot per cell and needs more height, else the
            // day cells overflow the 44px clamp (BOTTOM OVERFLOWED stripe).
            height: expanded ? 56 : 44,
            // chip: max-w-72 pill; strip: full width.
            width: expanded ? constraints.maxWidth : null,
            constraints: expanded
                ? null
                : const BoxConstraints(maxWidth: 288), // max-w-72
            padding: expanded
                ? EdgeInsets.zero
                : const EdgeInsets.symmetric(horizontal: NhamSpacing.sp4),
            decoration: BoxDecoration(
              color: expanded ? Colors.transparent : NhamColors.surface,
              borderRadius:
                  BorderRadius.circular(expanded ? 0 : NhamRadii.pill),
              border: expanded
                  ? const Border.fromBorderSide(BorderSide.none)
                  : Border.all(color: NhamColors.borderHalf), // border/50
            ),
            child: AnimatedSwitcher(
              duration: const Duration(milliseconds: 150),
              child: expanded
                  ? _buildStrip(locale, mealDates)
                  : _buildChipContent(locale, mealDates),
            ),
          );
        },
    );
  }

  Widget _buildChipContent(String locale, Set<String> mealDates) {
    final hasMeal = mealDates.contains(widget.selectedDate);
    final formatted = formatTimelineDayLabel(widget.selectedDate, locale);
    return _ChipButton(
      key: const ValueKey('chip-content'),
      label: formatted,
      hasMeal: hasMeal,
      onTap: _openStrip,
    );
  }

  Widget _buildStrip(String locale, Set<String> mealDates) {
    return Row(
      key: const ValueKey('strip-content'),
      children: [
        _NavButton(
          icon: Icons.chevron_left, // lucide ChevronLeft
          onTap: _scrollPrev,
          color: NhamColors.textMuted,
        ),
        const SizedBox(width: 4), // gap-1
        // Real week paging via PageView — swipe AND chevrons slide a full week
        // (the old hand-rolled carousel's transform was a constant and never
        // animated). Forward is capped at the current week (itemCount).
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
          icon: Icons.chevron_right, // lucide ChevronRight
          onTap: _canNavigateNext ? _scrollNext : null,
          color: _canNavigateNext
              ? NhamColors.textMuted
              : const Color(0x4D8B7355), // text-nham-text-muted/30
        ),
      ],
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

class _ChipButton extends StatefulWidget {
  const _ChipButton({
    super.key,
    required this.label,
    required this.hasMeal,
    required this.onTap,
  });

  final String label;
  final bool hasMeal;
  final VoidCallback onTap;

  @override
  State<_ChipButton> createState() => _ChipButtonState();
}

class _ChipButtonState extends State<_ChipButton> {
  @override
  Widget build(BuildContext context) {
    // The pill chrome (bg/border/radius/padding/maxWidth) is owned by the
    // morphing AnimatedContainer in the parent; this is only the chip's
    // content + tap target.
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: widget.onTap,
      child: SizedBox(
        height: 44,
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.calendar_today_outlined,
                size: 14, color: NhamColors.accent), // lucide Calendar
            const SizedBox(width: NhamSpacing.sp2), // gap-2
            Flexible(
              child: NhamText(
                widget.label,
                variant: NhamTextVariant.chipText,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(color: NhamColors.text),
              ),
            ),
            if (widget.hasMeal) ...[
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

    final labelColor = isSelected ? NhamColors.text : NhamColors.textMuted;

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

    // Web: future days are NOT dimmed/disabled — only the meal dot becomes an
    // empty 6x6 spacer (handled above). The cell stays full-opacity + tappable.
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
                NhamText(
                  dayName,
                  variant: NhamTextVariant.macroLabel,
                  style: NhamTextStyles.sansSemiBold(
                    fontSize: NhamFontSize.eyebrow,
                  ).copyWith(
                    letterSpacing: NhamTracking.tight,
                    color: labelColor,
                  ),
                ),
                const SizedBox(height: 2), // gap-0.5
                NhamText(
                  dayNum,
                  variant: NhamTextVariant.numInline,
                  style: TextStyle(fontSize: 13, color: labelColor),
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
