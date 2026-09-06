import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../router.dart';
import '../../../services/push/push_channel.dart';
import '../../circle/data/feed_providers.dart';

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
/// The `data` map is flat strings. It may arrive nested under `data` (the FCM
/// message shape) or flattened alongside `aps` (how APNs delivers it), so both
/// are accepted.
PushDestination? pushDestinationFor(PushPayload payload) {
  final data = _dataOf(payload);
  final type = _stringAt(data, 'type');
  if (type == null || !kPushNotificationTypes.contains(type)) return null;

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
  final groupId = destination.groupId;
  if (groupId != null) {
    container.read(circleSelectedViewProvider.notifier).state = groupId;
  }
  container.read(routerProvider).go(destination.path);
}

Map<String, dynamic> _dataOf(PushPayload payload) {
  final nested = payload['data'];
  if (nested is Map) {
    return nested.map((key, value) => MapEntry(key.toString(), value));
  }
  return payload;
}

String? _stringAt(Map<String, dynamic> data, String key) {
  final value = data[key];
  if (value is! String || value.isEmpty) return null;
  return value;
}
