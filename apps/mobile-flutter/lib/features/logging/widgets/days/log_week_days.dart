import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/days/held_removals_provider.dart';
import '../../data/logging_providers.dart';
import '../../logic/days/this_week.dart';

/// Loads the days of the week on show for the rows under its rings, gently:
/// nothing before the pane's first frame, then at most two days in flight at
/// a time, newest first. Each day goes through the provider the feed reads, so a day
/// the person then taps is already there.
///
/// Mounted only in a two-pane window, so no other window asks for these.
class LogWeekDays extends ConsumerStatefulWidget {
  const LogWeekDays({
    super.key,
    required this.userId,
    required this.today,
    required this.selectedDate,
    required this.week,
    required this.builder,
  });

  final String userId;
  final String today;

  /// The day the feed beside the pane is showing. Its request is the feed's,
  /// and counts against [inFlight] while it runs.
  final String selectedDate;

  /// The week on show, Monday first. Its days up to [today] are loaded,
  /// newest first.
  final List<String> week;

  /// The totals of the days that arrived.
  final Widget Function(Map<String, DayTotals> totals) builder;

  /// Requests this pane keeps in flight at once.
  static const int inFlight = 2;

  @override
  ConsumerState<LogWeekDays> createState() => _LogWeekDaysState();
}

class _LogWeekDaysState extends ConsumerState<LogWeekDays> {
  final _admitted = <String>[];
  bool _started = false;
  bool _admitting = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) setState(() => _started = true);
    });
  }

  @override
  Widget build(BuildContext context) {
    final week = [
      for (final date in widget.week.reversed)
        if (date.compareTo(widget.today) <= 0) date,
    ];
    final held = ref.watch(heldMealRemovalsProvider);
    final totals = <String, DayTotals>{};
    var loading = 0;
    if (!_admitted.contains(widget.selectedDate) &&
        ref
            .watch(
              loggingDayProvider(
                LoggingDayArgs(widget.userId, widget.selectedDate),
              ),
            )
            .isLoading) {
      loading++;
    }
    for (final date in week.where(_admitted.contains)) {
      final day = ref.watch(
        loggingDayProvider(LoggingDayArgs(widget.userId, date)),
      );
      final value = day.valueOrNull;
      if (value != null) {
        totals[date] = DayTotals.of(value, held: held);
      } else if (!day.hasError) {
        loading++;
      }
    }
    final waiting = week.where((d) => !_admitted.contains(d)).toList();
    final room = LogWeekDays.inFlight - loading;
    if (_started && !_admitting && room > 0 && waiting.isNotEmpty) {
      // Not during this build: admitting one means watching it.
      _admitting = true;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        setState(() {
          _admitting = false;
          _admitted.addAll(waiting.take(room));
        });
      });
    }
    return widget.builder(totals);
  }
}
