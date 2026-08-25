import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../theme/kallo_colors.dart';
import '../../../../theme/kallo_motion.dart';
import '../../../../theme/kallo_theme.dart';
import '../../logic/timeline_utils.dart';
import 'timeline_day_cell.dart';

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
    required this.expanded,
    required this.onSelectDate,
    required this.onClose,
  });

  final List<String> dates;
  final String today;
  final String selectedDate;

  /// Whether the picker is currently showing this strip.
  ///
  /// The strip stays mounted even while collapsed (that is what keeps the morph
  /// from re-inflating a PageView mid-animation), so it has to be TOLD when it
  /// comes back into view — see [_TimelineStripState.didUpdateWidget].
  final bool expanded;
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
      duration: KalloMotion.page,
      curve: KalloEase.decelerate,
    );
  }

  void _scrollNext() {
    if (!_canNavigateNext) return;
    _pageController.nextPage(
      duration: KalloMotion.page,
      curve: KalloEase.decelerate,
    );
  }

  /// Membership lookup for the "has a meal" dot, rebuilt only when the list
  /// behind it actually changes. It is O(every date the user has ever logged),
  /// and it used to be rebuilt inside the morph's animation builder — i.e.
  /// once per frame, for the whole 340ms, growing with the age of the account.
  late Set<String> _mealDates = widget.dates.toSet();

  @override
  void didUpdateWidget(TimelineStrip old) {
    super.didUpdateWidget(old);
    if (!identical(old.dates, widget.dates)) {
      _mealDates = widget.dates.toSet();
    }
    // Re-anchor on the way back into view, and whenever the day changes under
    // the strip while it is hidden (the under-logged-yesterday prompt and a
    // meal composed on another tab both do that).
    //
    // This used to happen for free: the picker destroyed this widget on every
    // collapse, so re-opening re-ran the `late` initialisers below. Keeping it
    // mounted is what stopped the morph tearing down a PageView mid-animation,
    // but it also stopped the re-anchor — leaving the strip on whatever week
    // the user had last paged to, with the selected day nowhere on screen.
    final reopened = widget.expanded && !old.expanded;
    if (reopened || widget.selectedDate != old.selectedDate) {
      _reanchor();
    }
  }

  /// Put the pager back on the week holding the selected day.
  ///
  /// Deferred: [didUpdateWidget] runs before this frame's layout, and a
  /// PageController cannot jump until its viewport has one.
  void _reanchor() {
    final anchor = _selectedAnchor;
    final page = _pageForAnchor(anchor);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted || !_pageController.hasClients) return;
      if (_pageController.page?.round() == page) return;
      _pageController.jumpToPage(page);
      if (_visibleAnchor != anchor) setState(() => _visibleAnchor = anchor);
    });
  }

  @override
  Widget build(BuildContext context) {
    final locale = context.locale.toString();

    return SizedBox(
      height: 56,
      child: Row(
        children: [
          _NavButton(
            icon: LucideIcons.chevronLeft300,
            onTap: _scrollPrev,
            color: KalloColors.textMuted,
          ),
          const SizedBox(width: 4), // gap-1
          Expanded(
            child: PageView.builder(
              controller: _pageController,
              onPageChanged: _onPageChanged,
              itemCount: _kWeekPageBase + 1,
              itemBuilder: (context, page) {
                final week = buildCenteredStripFromAnchor(_anchorForPage(page));
                return TimelineWeekRow(
                  week: week,
                  today: widget.today,
                  selectedDate: widget.selectedDate,
                  mealDates: _mealDates,
                  locale: locale,
                  onSelect: _selectDay,
                );
              },
            ),
          ),
          const SizedBox(width: 4),
          _NavButton(
            icon: LucideIcons.chevronRight300,
            onTap: _canNavigateNext ? _scrollNext : null,
            color: _canNavigateNext
                ? KalloColors.textMuted
                : const Color(0x4D6E6D66), // text-kallo-text-muted/30
          ),
        ],
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
            color: _pressed ? KalloColors.hover40 : Colors.transparent,
            borderRadius: BorderRadius.circular(KalloRadii.pill),
          ),
          child: Icon(widget.icon, size: 16, color: widget.color),
        ),
      ),
    );
  }
}
