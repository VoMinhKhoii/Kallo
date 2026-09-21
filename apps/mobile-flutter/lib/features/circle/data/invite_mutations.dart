/// Responding to a meal-share offer: accept it, take it as a cheat re-dial, or
/// dismiss it.
///
/// Split out of `circle_providers.dart`, which owns the Circle's queries and
/// its other mutations and had reached the 400-line ceiling. These three belong
/// together anyway: they are the three ways one `meal_share_invites` row can be
/// resolved, and they share the invalidation set that resolution implies.
library;

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../services/http/api_client.dart';
import '../../dashboard/data/dashboard_providers.dart'
    show
        dashboardBundleProvider,
        dashboardDayProvider,
        localTimezoneOffsetMinutes;
import '../../logging/data/logging_providers.dart' show loggingDayProvider;
import 'circle_providers.dart'
    show circleFeedProvider, mealShareInvitesProvider;

/// Local calendar date (YYYY-MM-DD). Still sent by [acceptMealShareInvite] for
/// wire compatibility with older servers; the current server ignores it and
/// stamps the copy at the source meal's instant instead.
String _todayLocalDate() {
  final now = DateTime.now();
  final mm = now.month.toString().padLeft(2, '0');
  final dd = now.day.toString().padLeft(2, '0');
  return '${now.year}-$mm-$dd';
}

/// Accept an invite (`POST /api/v1/groups/invites/accept`) — the scaled meal
/// lands at the SOURCE meal's instant, the same eating event seen from my
/// diary, so it may sit on an earlier day than today. `loggedDate` is still
/// sent for wire compatibility and ignored by the server. Invalidating the
/// `loggingDayProvider` FAMILY (rather than one day's instance) is what makes
/// the meal appear wherever it actually landed.
Future<void> acceptMealShareInvite(WidgetRef ref, String inviteId) async {
  final api = ref.read(apiClientProvider);
  await api.post<Map<String, dynamic>>('/api/v1/groups/invites/accept', {
    'inviteId': inviteId,
    'loggedDate': _todayLocalDate(),
    'timezoneOffset': localTimezoneOffsetMinutes(),
  });
  ref.invalidate(mealShareInvitesProvider);
  ref.invalidate(loggingDayProvider);
  // A newly-logged meal must also heal the dashboard's Today + week-strip ring,
  // which read off a separate bundle/day cache.
  ref.invalidate(dashboardBundleProvider);
  ref.invalidate(dashboardDayProvider);
  ref.invalidate(circleFeedProvider);
}

/// Take a CHEAT invite (`POST /api/v1/groups/invites/accept-cheat`).
///
/// Logs nothing. A cheat meal's numbers are slider positions, so copying them
/// would assert I ate exactly what my friend ate; instead this re-stages their
/// spec — seeded with their chosen amounts — as a pending analysis of mine,
/// and the caller routes to the logging feed where the slider card opens on
/// it. Returns the staged day (`loggedAt`) so the caller can land on it: the
/// card is stamped at the SOURCE meal's instant, which is usually not today.
///
/// Consumes the invite, hence the inbox invalidation.
Future<String> stageCheatMealShareInvite(WidgetRef ref, String inviteId) async {
  final api = ref.read(apiClientProvider);
  final json = await api.post<Map<String, dynamic>>(
    '/api/v1/groups/invites/accept-cheat',
    {'inviteId': inviteId},
  );
  ref.invalidate(mealShareInvitesProvider);
  // The staged card lives on the logging day, so that family must refetch. No
  // dashboard invalidation: nothing has been logged yet, and the ring must not
  // move until the recipient confirms their own amounts.
  ref.invalidate(loggingDayProvider);
  return json['loggedAt'] as String? ?? '';
}

/// Dismiss an invite (`POST /api/v1/groups/invites/dismiss`).
Future<void> dismissMealShareInvite(WidgetRef ref, String inviteId) async {
  final api = ref.read(apiClientProvider);
  await api.post<dynamic>('/api/v1/groups/invites/dismiss', {
    'inviteId': inviteId,
  });
  ref.invalidate(mealShareInvitesProvider);
}
