import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../models/profile/heatmap.dart';
import '../../../../services/auth/session_provider.dart';
import '../../../../services/http/api_client.dart';
import '../../logic/days/log_calendar.dart';
import '../logging_keys.dart';

/// The last 90 days, newest first, for the month calendar a two-pane Log
/// screen shows beside the feed.
///
/// Its own read of `/dashboard/heatmap?range=90d`, not Today's
/// `heatmapProvider`: that one follows the Consistency card's range toggle,
/// and a wide card asks it for the calendar year. 90 days pages the same
/// three months back on any date; the year range would stop at January 1.
///
/// Refreshed wherever the week strip's meal dates are, through
/// `invalidateMealSurfaces`, the feed's pull to refresh and the two Circle
/// paths that write a meal, so a logged, edited or deleted meal moves its
/// day's ring.
final loggingDayListProvider = FutureProvider.autoDispose
    .family<List<HeatmapCell>, String>((ref, userId) async {
      requireSignedInAs(ref, userId);
      // Held a minute after the calendar unmounts, as the meal dates are, so
      // a fold to the outer display and back does not refetch.
      final link = ref.keepAlive();
      Timer? timer;
      ref.onDispose(() => timer?.cancel());
      ref.onCancel(() {
        timer = Timer(const Duration(seconds: 60), link.close);
      });
      ref.onResume(() => timer?.cancel());

      final api = ref.watch(apiClientProvider);
      final tz = timezoneOffsetMinutes();
      final json = await api.get<Map<String, dynamic>>(
        '/api/v1/dashboard/heatmap?range=90d&tz=$tz',
      );
      return pastDays(HeatmapData.fromJson(json), todayDateString());
    });
