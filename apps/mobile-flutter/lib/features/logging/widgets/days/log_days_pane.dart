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
import 'log_month_grid.dart';
import 'log_month_header.dart';
import 'log_week_days.dart';

/// The far pane of a two-pane Log: the back chevron and one month of calorie
/// rings, then this week's days. Tapping a day in either selects it, and the
/// feed beside it shows that day.
///
/// The rings read the 90-day heatmap. This week's rows, and the rings of
/// their days, read each day as the feed loads it, so a row and the gauges
/// beside it count the same meals the moment one is saved.
class LogDaysPane extends ConsumerStatefulWidget {
  const LogDaysPane({
    super.key,
    required this.userId,
    required this.today,
    required this.selectedDate,
    required this.calorieTarget,
    required this.onSelectDate,
    required this.onBack,
    this.variant = LogDayRowVariant.plain,
  });

  final String userId;
  final String today;
  final String selectedDate;
  final int calorieTarget;
  final ValueChanged<String> onSelectDate;
  final VoidCallback onBack;
  final LogDayRowVariant variant;

  @override
  ConsumerState<LogDaysPane> createState() => _LogDaysPaneState();
}

class _LogDaysPaneState extends ConsumerState<LogDaysPane> {
  // Owned here: the feed beside this pane is a vertical scroll view too, and
  // both must not take the primary controller.
  final _controller = ScrollController();
  late DateTime _month = monthOf(widget.selectedDate);

  @override
  void didUpdateWidget(LogDaysPane old) {
    super.didUpdateWidget(old);
    // A day picked in another month (a row of this week that began in the
    // last one) brings its month with it.
    if (old.selectedDate != widget.selectedDate &&
        monthOf(widget.selectedDate) != _month) {
      _month = monthOf(widget.selectedDate);
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _refresh() async {
    ref.invalidate(mealDatesProvider(widget.userId));
    final day = LoggingDayArgs(widget.userId, widget.selectedDate);
    await Future.wait([
      ref.refresh(loggingDayListProvider(widget.userId).future),
      ref.read(loggingDayProvider(day).notifier).refresh(),
    ]);
    await refreshLoadedWeekDays(ref, widget.userId, widget.selectedDate);
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
    return LogWeekDays(
      userId: widget.userId,
      today: widget.today,
      selectedDate: widget.selectedDate,
      builder: (week, totals) {
        double? kcalFor(String date) {
          final loaded = totals[date];
          if (loaded != null) return loaded.kcal;
          if (date == widget.selectedDate && selected != null) {
            return DayTotals.of(selected, held: held).kcal;
          }
          return byDate[date]?.calories;
        }

        return _scroll(context, week, totals, days, byDate, kcalFor);
      },
    );
  }

  Widget _scroll(
    BuildContext context,
    List<String> week,
    Map<String, DayTotals> totals,
    List<HeatmapCell>? days,
    Map<String, HeatmapCell> byDate,
    double? Function(String date) kcalFor,
  ) {
    // The window edge keeps 24, the fold 12: the calendar's days and the
    // rows' text line up under the month's name.
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
      onRefresh: _refresh,
      slivers:
          (bottom) => [
            SliverPadding(
              // The back chevron's glyph, not its 44pt target, keeps the
              // window edge's 12pt margin; the month chevrons sit over the
              // grid's last column.
              padding: EdgeInsets.fromLTRB(
                edge.left == 0 ? 4 : 12,
                0,
                edge.right == 0 ? 4 : 12,
                0,
              ),
              sliver: SliverToBoxAdapter(
                child: LogMonthHeader(
                  month: _month,
                  onBack: widget.onBack,
                  onPrevious:
                      canShowPreviousMonth(_month, days)
                          ? () =>
                              setState(() => _month = shiftMonth(_month, -1))
                          : null,
                  onNext:
                      canShowNextMonth(_month, widget.today)
                          ? () => setState(() => _month = shiftMonth(_month, 1))
                          : null,
                ),
              ),
            ),
            SliverPadding(
              padding: inset.copyWith(bottom: bottom + 12),
              sliver: SliverList.list(
                children: [
                  const SizedBox(height: 4),
                  LogMonthGrid(
                    month: _month,
                    today: widget.today,
                    selectedDate: widget.selectedDate,
                    calorieTarget: widget.calorieTarget,
                    kcalFor: kcalFor,
                    onSelectDate: widget.onSelectDate,
                  ),
                  const SizedBox(height: 16),
                  for (final date in week)
                    LogDayRow(
                      date: date,
                      today: widget.today,
                      totals: totals[date],
                      fallbackKcal: byDate[date]?.calories,
                      selected: date == widget.selectedDate,
                      variant: widget.variant,
                      onTap: () => widget.onSelectDate(date),
                    ),
                ],
              ),
            ),
          ],
    );
  }
}
