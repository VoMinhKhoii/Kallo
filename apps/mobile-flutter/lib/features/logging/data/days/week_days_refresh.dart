import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../logic/days/this_week.dart';
import '../logging_keys.dart';
import '../logging_providers.dart';

/// Refetches this week's days that are already loaded, two at a time, for a
/// pull to refresh on a two-pane Log.
///
/// The rows under the calendar and the rings of their days read each day
/// from the feed's own cache before the heatmap, so refreshing the heatmap
/// alone would leave a meal logged on another device out of them. [except]
/// is the day the caller refreshes itself. A day that fails keeps what it
/// showed.
Future<void> refreshLoadedWeekDays(
  WidgetRef ref,
  String userId,
  String except,
) async {
  LoggingDayArgs args(String date) => LoggingDayArgs(userId, date);
  final loaded = [
    for (final date in thisWeekDays(todayDateString()))
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
