/// Blocking, unblocking and reporting in the Circle (App Store 1.2) — the data
/// layer only; the sheets and menu items that call these live with the UI.
///
/// A block ends the friendship and hides both people from each other
/// everywhere the server serves circle content: the friends list and feeds,
/// named-group feeds, a post opened by id, replies, hearts, group-chat
/// messages, chat previews and notifications. So a block or an unblock
/// invalidates every one of those caches, not just the friends list. Blocks
/// are per person: unblocking lifts only the viewer's own block — if the other
/// person also blocked the viewer, theirs stays in force.
///
/// Errors surface as [ApiError] for the caller to handle: 404 from
/// [unblockCircleUser] means the viewer never blocked this person, 404 from
/// [reportCircleContent] means the target is gone or not visible, and 429 is
/// the shared block/unblock (or report) rate limit.
library;

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../models/social/moderation.dart';
import '../../../services/http/api_client.dart';
import '../../../services/http/query.dart';
import 'chat_group_providers.dart'
    show chatGroupDetailProvider, chatGroupsProvider;
import 'circle_providers.dart'
    show circleFeedProvider, circleFriendsProvider, mealShareInvitesProvider;
import 'feed_providers.dart' show sharedMealFeedProvider;
import 'share_entry_provider.dart' show sharedMealEntryProvider;

const Duration _moderationRequestTimeout = Duration(seconds: 15);

/// The people the viewer has blocked, newest first — backs the "Blocked"
/// settings list. Only blocks the viewer placed; never who blocked them.
final blockedCircleUsersProvider =
    FutureProvider.autoDispose<List<BlockedCircleUser>>((ref) async {
      final api = ref.watch(apiClientProvider);
      return runWithRetry(() async {
        final json = await api
            .get<Map<String, dynamic>>('/api/v1/groups/friends/blocked')
            .timeout(_moderationRequestTimeout);
        final list = (json['blocked'] as List<dynamic>?) ?? const [];
        return list
            .map((e) => BlockedCircleUser.fromJson(e as Map<String, dynamic>))
            .toList(growable: false);
      });
    });

/// Everything a block or unblock can change for the viewer. Families are
/// invalidated whole: a block can remove posts, replies and messages from any
/// group feed or opened thread, and we do not know which ones are cached.
void _invalidateAfterBlockChange(WidgetRef ref) {
  ref.invalidate(blockedCircleUsersProvider);
  ref.invalidate(circleFriendsProvider);
  ref.invalidate(circleFeedProvider);
  ref.invalidate(sharedMealFeedProvider);
  ref.invalidate(sharedMealEntryProvider);
  ref.invalidate(chatGroupsProvider);
  ref.invalidate(chatGroupDetailProvider);
  ref.invalidate(mealShareInvitesProvider);
}

/// Block [userId] (`POST /api/v1/groups/friends/block`). Ends any connection;
/// both people stop seeing each other's content, including inside groups they
/// still share. Only the viewer can lift it, via [unblockCircleUser].
Future<void> blockCircleUser(WidgetRef ref, String userId) async {
  final api = ref.read(apiClientProvider);
  await api
      .post<dynamic>('/api/v1/groups/friends/block', {'targetUserId': userId})
      .timeout(_moderationRequestTimeout);
  _invalidateAfterBlockChange(ref);
}

/// Lift a block the viewer placed (`POST /api/v1/groups/friends/unblock`).
/// The connection is NOT restored — the pair must re-invite to reconnect.
Future<void> unblockCircleUser(WidgetRef ref, String userId) async {
  final api = ref.read(apiClientProvider);
  await api
      .post<dynamic>('/api/v1/groups/friends/unblock', {'targetUserId': userId})
      .timeout(_moderationRequestTimeout);
  _invalidateAfterBlockChange(ref);
}

/// Report a share, reply, chat message, chat group or profile
/// (`POST /api/v1/reports`). Returns the report id. Reporting the same target
/// twice returns the same id, so a retry is safe. The reported person is not
/// sent — the server derives it from the target. A blank [note] is omitted.
///
/// Changes nothing the viewer sees, so it invalidates nothing; to also hide
/// the person, follow with [blockCircleUser].
Future<String> reportCircleContent(
  WidgetRef ref, {
  required ReportTargetKind kind,
  required String targetId,
  required ReportReason reason,
  String? note,
}) async {
  final api = ref.read(apiClientProvider);
  final trimmedNote = note?.trim();
  final json = await api
      .post<Map<String, dynamic>>('/api/v1/reports', {
        'targetKind': kind.wire,
        'targetId': targetId,
        'reason': reason.wire,
        if (trimmedNote != null && trimmedNote.isNotEmpty) 'note': trimmedNote,
      })
      .timeout(_moderationRequestTimeout);
  return json['id'] as String;
}
