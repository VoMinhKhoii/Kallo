import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../router.dart';
import '../../../shell/launch/route_settled.dart';
import '../../../shell/nav/nav_actions.dart';
import '../../../services/push/push_channel.dart';
import '../../circle/data/feed_providers.dart';
import '../../circle/logic/circle_thread_route.dart';
import '../../logging/data/handoff_slots.dart';
import '../../../shared/logic/display_format.dart' show todayDateString;

/// Notification types the server emits (`docs/NOTIFICATIONS.md`, event catalog
/// v1). A payload carrying anything else — a reserved type, a future type this
/// build predates, junk — routes nowhere rather than guessing.
const Set<String> kPushNotificationTypes = {
  'friend.joined',
  'group.added',
  'share.invite',
  'share.invite_accepted',
  'share.reaction',
  'share.reply',
  'share.logged',
  'chat.message',
  ...kReminderTypes,
};

/// Meal reminders (docs/NOTIFICATIONS.md → "Reminders"): a tap, "Log a meal",
/// "Log more" and "Add to yesterday" all open the logging feed on the day the
/// reminder is about (`date`). The "close the day" buttons never reach Dart —
/// iOS answers them in the background (`AppDelegate.swift`).
const Set<String> kReminderTypes = {
  'reminder.checkpoint',
  'reminder.yesterday',
};

final RegExp _dayKey = RegExp(r'^\d{4}-\d{2}-\d{2}$');

/// Types whose tap opens a specific chat group; everything else lands on the
/// circle surface, which is where the shares/friend events live.
const Set<String> kPushGroupTypes = {'group.added', 'chat.message'};

/// Where a tapped notification should land.
///
/// [groupId] non-null means "circle, scoped to that group" — the Flutter circle
/// screen selects a group through [circleSelectedViewProvider] rather than a
/// route of its own, so both cases share one path.
///
/// [loggingDay] non-null means "the logging feed, on that day" — parked in
/// [pendingLoggingDayProvider] for the screen to claim, the handshake every
/// "open logging on day X" path uses.
class PushDestination {
  const PushDestination({required this.path, this.groupId, this.loggingDay});

  final String path;
  final String? groupId;
  final String? loggingDay;

  @override
  bool operator ==(Object other) =>
      other is PushDestination &&
      other.path == path &&
      other.groupId == groupId &&
      other.loggingDay == loggingDay;

  @override
  int get hashCode => Object.hash(path, groupId, loggingDay);

  @override
  String toString() =>
      'PushDestination($path, groupId: $groupId, loggingDay: $loggingDay)';
}

/// Resolve an APNs payload to a destination, or null when there is nothing
/// sensible to open.
///
/// The server spreads its flat string fields (`type`, `objectType`,
/// `objectId`, `targetType`, `targetId`) alongside `aps` at the top level of
/// the APNs payload — that is the one contract (see `lib/infra/push/apns.ts`),
/// so `payload` IS the data.
PushDestination? pushDestinationFor(PushPayload payload) {
  final data = payload;
  final type = _stringAt(data, 'type');
  if (type == null || !kPushNotificationTypes.contains(type)) return null;

  if (kReminderTypes.contains(type)) {
    // A missing or malformed day still opens logging — on today, the day a
    // reminder is almost always about. Resolved here, once.
    final day = _stringAt(data, 'date');
    return PushDestination(
      path: '/logging',
      loggingDay:
          day != null && _dayKey.hasMatch(day) ? day : todayDateString(),
    );
  }

  // A thread opens off the payload's OWN discriminant rather than a second
  // copy of which types carry one: the producers set `objectType: 'share'`
  // with the share id in `objectId` for exactly the reaction/reply/logged
  // events (`docs/NOTIFICATIONS.md`), and `share.invite` — the one share-
  // prefixed type without a thread — names an invite instead. A payload whose
  // object is missing or is not a share falls through to the feed.
  final objectId = _stringAt(data, 'objectId');
  if (_stringAt(data, 'objectType') == 'share' && objectId != null) {
    // groupId stays null: the thread page reads its post out of the combined
    // friends feed, so a tap must reset any group scope left by an earlier
    // one.
    return PushDestination(path: circleThreadLocation(shareId: objectId));
  }

  if (kPushGroupTypes.contains(type)) {
    final targetType = _stringAt(data, 'targetType');
    final targetId = _stringAt(data, 'targetId');
    // A group event without a usable target still belongs on circle — the user
    // tapped something, so land them somewhere real.
    if (targetId != null &&
        (targetType == null || targetType == 'chat_group')) {
      return PushDestination(path: '/circle', groupId: targetId);
    }
  }
  return const PushDestination(path: '/circle');
}

/// Navigate for a tapped notification. A payload with no destination is a
/// deliberate no-op.
///
/// A tap that launched the app is held until the first screen is decided
/// ([launchReadyProvider]). Before that the router may not have parsed a
/// location at all — `router.state` then throws "Bad state: No element"
/// (Sentry KALLO-MOBILE-3) — and while the splash holds `/`, the redirect
/// that leaves it would replace any stack built over it.
void routePushTap(ProviderContainer container, PushPayload payload) {
  final destination = pushDestinationFor(payload);
  if (destination == null) return;
  _whenReady(
    container.read(launchReadyProvider),
    () => _routeTo(container, destination),
  );
}

void _whenReady(ValueListenable<bool> ready, VoidCallback run) {
  if (ready.value) return run();
  void listener() {
    if (!ready.value) return;
    ready.removeListener(listener);
    run();
  }

  ready.addListener(listener);
}

void _routeTo(ProviderContainer container, PushDestination destination) {
  final day = destination.loggingDay;
  if (day != null) {
    // Park the day first so the screen lands on it even when it is already
    // open on another one. Like every "open logging" path (`openLogging`), a
    // shell branch the user is on stays underneath; Dashboard is seeded only
    // on a cold tap, so back always has somewhere to go.
    container.read(pendingLoggingDayProvider.notifier).state = day;
    pushOverShell(
      container.read(routerProvider),
      base: '/dashboard',
      path: '/logging',
    );
    return;
  }
  // Always assign: null means the combined feed, so a share or friend tap
  // after a group tap must not stay scoped to that earlier group.
  container.read(circleSelectedViewProvider.notifier).state =
      destination.groupId;
  // Circle is the branch every notification destination lives under, so it is
  // what goes down first on a cold tap — named HERE because which branch owns
  // a thread is this feature's knowledge, not the shell's.
  pushOverShell(
    container.read(routerProvider),
    base: '/circle',
    path: destination.path,
  );
}

String? _stringAt(Map<String, dynamic> data, String key) {
  final value = data[key];
  if (value is! String || value.isEmpty) return null;
  return value;
}
