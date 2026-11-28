import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../logic/days/this_week.dart';
import '../logging_keys.dart';
import '../logging_providers.dart';
import 'day_list_provider.dart';

/// A pull to refresh on the days pane of a two-pane Log: the heatmap, the
/// meal dates and the selected day, then the rest of [week] that is loaded.
Future<void> refreshDaysPane(
  WidgetRef ref,
  String userId,
  String selected,
  List<String> week,
) async {
  ref.invalidate(mealDatesProvider(userId));
  await Future.wait([
    ref.refresh(loggingDayListProvider(userId).future),
    ref
        .read(loggingDayProvider(LoggingDayArgs(userId, selected)).notifier)
        .refresh(),
  ]);
  await refreshLoadedWeekDays(ref, userId, selected, days: week);
}

/// Refetches this week's days that are already loaded, two at a time, for a
/// pull to refresh on a two-pane Log.
///
/// The rows under the rings, and the rings of their days, read each day
/// from the feed's own cache before the heatmap, so refreshing the heatmap
/// alone would leave a meal logged on another device out of them. [except]
/// is the day the caller refreshes itself. A day that fails keeps what it
/// showed.
Future<void> refreshLoadedWeekDays(
  WidgetRef ref,
  String userId,
  String except, {
  List<String>? days,
}) async {
  LoggingDayArgs args(String date) => LoggingDayArgs(userId, date);
  final loaded = [
    for (final date in days ?? thisWeekDays(todayDateString()))
      if (date != except && ref.exists(loggingDayProvider(args(date)))) date,
  ];
  Future<void> refetch(String date) async {
    try {
      await ref.read(loggingDayProvider(args(date)).notifier).refresh();
    } catch (_) {}
  }

  for (var i = 0; i < loaded.length; i += 2) {
    await Future.wait(loaded.skip(i).take(2).map(refetch));
  }
}
