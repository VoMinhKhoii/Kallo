import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../router.dart';
import '../../../services/push/push_channel.dart';
import '../../circle/data/feed_providers.dart';
import '../../circle/logic/circle_thread_route.dart';

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
};

/// Types whose tap opens a specific chat group; everything else lands on the
/// circle surface, which is where the shares/friend events live.
const Set<String> kPushGroupTypes = {'group.added', 'chat.message'};

/// Where a tapped notification should land.
///
/// [groupId] non-null means "circle, scoped to that group" — the Flutter circle
/// screen selects a group through [circleSelectedViewProvider] rather than a
/// route of its own, so both cases share one path.
class PushDestination {
  const PushDestination({required this.path, this.groupId});

  final String path;
  final String? groupId;

  @override
  bool operator ==(Object other) =>
      other is PushDestination &&
      other.path == path &&
      other.groupId == groupId;

  @override
  int get hashCode => Object.hash(path, groupId);

  @override
  String toString() => 'PushDestination($path, groupId: $groupId)';
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
void routePushTap(ProviderContainer container, PushPayload payload) {
  final destination = pushDestinationFor(payload);
  if (destination == null) return;
  // Always assign: null means the combined feed, so a share or friend tap
  // after a group tap must not stay scoped to that earlier group.
  container.read(circleSelectedViewProvider.notifier).state =
      destination.groupId;
  // `go`, not `push`: a tap can arrive cold with no shell beneath it, and the
  // thread page's back action is `popOr` (`shell/nav/nav_actions.dart`), which
  // already falls back to `/circle` when there is nothing to pop.
  container.read(routerProvider).go(destination.path);
}

String? _stringAt(Map<String, dynamic> data, String key) {
  final value = data[key];
  if (value is! String || value.isEmpty) return null;
  return value;
}
