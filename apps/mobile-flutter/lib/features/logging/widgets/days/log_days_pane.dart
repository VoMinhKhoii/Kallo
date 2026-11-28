import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../models/profile/heatmap.dart';
import '../../../../shared/widgets/feedback/kallo_refresh.dart';
import '../../../../shared/widgets/panes/pane_insets.dart';
import '../../../../shared/widgets/panes/pane_slot.dart';
import '../../data/days/day_list_provider.dart';
import '../../data/days/held_removals_provider.dart';
import '../../data/days/week_days_refresh.dart';
import '../../data/logging_providers.dart';
import '../../logic/days/log_calendar.dart';
import '../../logic/days/this_week.dart';
import 'log_day_row.dart';
import 'log_days_fill.dart';
import 'log_week_days.dart';
import 'log_week_header.dart';
import 'log_week_rings.dart';

/// The far pane of a two-pane Log: the back chevron and one week of calorie
/// rings, then that week's seven days as rows, Monday first. Tapping a day in
/// either selects it, and the feed beside it shows that day. The chevrons
/// page a week at a time, as far back as the 90-day heatmap covers.
///
/// The rows, and the rings of their days, read each day as the feed loads
/// it, so a row and the gauges beside it count the same meals the moment one
/// is saved. The heatmap fills a ring until its day arrives.
class LogDaysPane extends ConsumerStatefulWidget {
  const LogDaysPane({
    super.key,
    required this.userId,
    required this.today,
    required this.selectedDate,
    required this.calorieTarget,
    required this.onSelectDate,
    required this.onBack,
  });

  final String userId;
  final String today;
  final String selectedDate;
  final int calorieTarget;
  final ValueChanged<String> onSelectDate;
  final VoidCallback onBack;

  @override
  ConsumerState<LogDaysPane> createState() => _LogDaysPaneState();
}

class _LogDaysPaneState extends ConsumerState<LogDaysPane> {
  // Owned here: the feed beside this pane is a vertical scroll view too, and
  // both must not take the primary controller.
  final _controller = ScrollController();
  late DateTime _week = weekOf(widget.selectedDate);

  @override
  void didUpdateWidget(LogDaysPane old) {
    super.didUpdateWidget(old);
    // A day chosen from outside this pane brings its week with it.
    if (old.selectedDate != widget.selectedDate &&
        weekOf(widget.selectedDate) != _week) {
      _week = weekOf(widget.selectedDate);
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final days = ref.watch(loggingDayListProvider(widget.userId)).valueOrNull;
    final byDate = {
      for (final cell in days ?? <HeatmapCell>[]) cell.date: cell,
    };
    // The selected day is loaded by the feed beside this pane already.
    final selected =
        ref
            .watch(
              loggingDayProvider(
                LoggingDayArgs(widget.userId, widget.selectedDate),
              ),
            )
            .valueOrNull;

    final held = ref.watch(heldMealRemovalsProvider);
    final week = weekDates(_week);
    return LogWeekDays(
      userId: widget.userId,
      today: widget.today,
      selectedDate: widget.selectedDate,
      week: week,
      builder: (totals) {
        double? kcalFor(String date) {
          final loaded = totals[date];
          if (loaded != null) return loaded.kcal;
          if (date == widget.selectedDate && selected != null) {
            return DayTotals.of(selected, held: held).kcal;
          }
          return byDate[date]?.calories;
        }

        return _scroll(week, totals, days, byDate, kcalFor);
      },
    );
  }

  Widget _scroll(
    List<String> week,
    Map<String, DayTotals> totals,
    List<HeatmapCell>? days,
    Map<String, HeatmapCell> byDate,
    double? Function(String date) kcalFor,
  ) {
    // The window edge keeps 24, the fold 12: the rings and the rows' text
    // line up under the month's name.
    final edge = paneInsets(context, slot: PaneSlot.far, side: 24);
    final inset = EdgeInsets.fromLTRB(
      edge.left == 0 ? 12 : edge.left,
      0,
      edge.right == 0 ? 12 : edge.right,
      0,
    );
    return KalloRefreshableScroll(
      // Keeps the offset in the page's storage while a one-column window
      // unmounts this pane, so a fold out and back returns to the same place.
      key: const PageStorageKey('logging-days-pane'),
      controller: _controller,
      onRefresh:
          () => refreshDaysPane(ref, widget.userId, widget.selectedDate, week),
      slivers:
          (bottom) => [
            LogDaysFill(
              count: week.length,
              padding: inset.copyWith(bottom: bottom + 12),
              head: [
                SliverPadding(
                  // The back chevron's glyph, not its 44pt target, keeps the
                  // window edge's 12pt margin; the week chevrons sit over
                  // the last ring.
                  padding: EdgeInsets.fromLTRB(
                    edge.left == 0 ? 4 : 12,
                    0,
                    edge.right == 0 ? 4 : 12,
                    0,
                  ),
                  sliver: SliverToBoxAdapter(child: _header(days)),
                ),
                SliverPadding(
                  padding: inset.copyWith(top: 4, bottom: 16),
                  sliver: SliverToBoxAdapter(
                    child: LogWeekRings(
                      dates: week,
                      today: widget.today,
                      selectedDate: widget.selectedDate,
                      calorieTarget: widget.calorieTarget,
                      kcalFor: kcalFor,
                      onSelectDate: widget.onSelectDate,
                    ),
                  ),
                ),
              ],
              rows:
                  (height) => [
                    for (final date in week)
                      LogDayRow(
                        date: date,
                        today: widget.today,
                        totals: totals[date],
                        fallbackKcal: byDate[date]?.calories,
                        selected: date == widget.selectedDate,
                        isFuture: date.compareTo(widget.today) > 0,
                        minHeight: height,
                        onTap: () => widget.onSelectDate(date),
                      ),
                  ],
            ),
          ],
    );
  }

  Widget _header(List<HeatmapCell>? days) => LogWeekHeader(
    week: _week,
    onBack: widget.onBack,
    onPrevious:
        canShowPreviousWeek(_week, days)
            ? () => setState(() => _week = shiftWeek(_week, -1))
            : null,
    onNext:
        canShowNextWeek(_week, widget.today)
            ? () => setState(() => _week = shiftWeek(_week, 1))
            : null,
  );
}
