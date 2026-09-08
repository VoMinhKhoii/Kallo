/// Mutations that splice authoritative share state into every alive feed.
///
/// The feed caches are patched in place (optimistically, then with the
/// server's numbers). The thread page's SECOND source —
/// `sharedMealEntryProvider`, the post fetched by id when no loaded feed holds
/// it — is not patched but INVALIDATED on success: it is a plain read of one
/// endpoint, and refetching it is both simpler and honest about where its
/// numbers come from. Each invalidate is a no-op unless a thread page is
/// currently showing that post as a fetched entry.
library;

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:uuid/uuid.dart';

import '../../../services/http/api_client.dart';
import '../../../models/social/circle.dart';
import '../../dashboard/data/dashboard_providers.dart'
    show
        dashboardBundleProvider,
        dashboardDayProvider,
        localTimezoneOffsetMinutes;
import '../../logging/data/logging_keys.dart' show todayDateString;
import '../../logging/data/logging_providers.dart' show loggingDayProvider;
import 'chat_group_providers.dart';
import 'feed_providers.dart';
import 'share_entry_provider.dart';

const Duration _mutationTimeout = Duration(seconds: 15);

class _ReactionSnapshot {
  const _ReactionSnapshot({required this.mine, required this.count});

  final bool mine;
  final int count;
}

/// Every feed that is currently mounted and therefore owes a splice.
///
/// [from] is the CALLER's own scope, required by the signature because the
/// candidate set is otherwise built from what the Circle tab has selected —
/// which says nothing about where the mutation was fired from. A reply or a
/// heart from the thread page of a group post, with the tab still on the
/// friends feed (a cold deep link, any entry point that is not the tab), would
/// splice into no feed at all and the reply the user just wrote would vanish.
List<String?> _aliveFeedScopes(WidgetRef ref, {required String? from}) {
  final selected = ref.read(circleSelectedViewProvider);
  final groupIds =
      ref.read(chatGroupsProvider).valueOrNull?.map((group) => group.id) ??
      const <String>[];
  final candidates = <String?>{null, selected, from, ...groupIds};
  return candidates
      .where((scope) => ref.exists(sharedMealFeedProvider(scope)))
      .toList(growable: false);
}

Set<String?> _scopeUnion(WidgetRef ref, Iterable<String?> originalScopes) => {
  ...originalScopes,
  ..._aliveFeedScopes(ref, from: null),
};

SharedMealFeedNotifier _notifier(WidgetRef ref, String? scope) =>
    ref.read(sharedMealFeedProvider(scope).notifier);

_ReactionSnapshot? _reactionSnapshot(WidgetRef ref, String? scope, String id) {
  final entries = ref.read(sharedMealFeedProvider(scope)).valueOrNull?.entries;
  if (entries == null) return null;
  for (final entry in entries) {
    if (entry.meal.shareId == id) {
      return _ReactionSnapshot(
        mine: entry.reactions.mine,
        count: entry.reactions.count,
      );
    }
  }
  return null;
}

Future<void> toggleShareReaction(
  WidgetRef ref,
  String shareId, {
  String? scope,
}) async {
  final scopes = _aliveFeedScopes(ref, from: scope);
  final snapshots = <String?, _ReactionSnapshot?>{
    for (final scope in scopes) scope: _reactionSnapshot(ref, scope, shareId),
  };
  for (final scope in scopes) {
    _notifier(ref, scope).toggleReactionLocal(shareId);
  }

  try {
    final json = await ref
        .read(apiClientProvider)
        .post<Map<String, dynamic>>('/api/v1/groups/shares/reaction', {
          'shareId': shareId,
        })
        .timeout(_mutationTimeout);
    final mine = json['reacted'] as bool;
    final count = (json['count'] as num).toInt();
    for (final scope in _scopeUnion(ref, scopes)) {
      if (!ref.exists(sharedMealFeedProvider(scope))) continue;
      _notifier(ref, scope).applyReaction(shareId, mine: mine, count: count);
    }
    // Refetch, don't patch: a thread page reading this post out of the
    // single-share endpoint gets the new count the same way it got the old
    // one. ON SUCCESS ONLY — the rollback below has nothing to heal there,
    // because the optimistic toggle never touched that read in the first
    // place. Invalidating on failure would spend a request to re-fetch the
    // state the page is already showing.
    ref.invalidate(sharedMealEntryProvider(shareId));
  } catch (_) {
    for (final scope in _scopeUnion(ref, scopes)) {
      if (!ref.exists(sharedMealFeedProvider(scope))) continue;
      final snapshot = snapshots[scope];
      if (snapshot == null) continue;
      _notifier(
        ref,
        scope,
      ).applyReaction(shareId, mine: snapshot.mine, count: snapshot.count);
    }
    rethrow;
  }
}

Future<void> createShareReply(
  WidgetRef ref, {
  required String shareId,
  required String body,
  String? scope,
}) async {
  final scopes = _aliveFeedScopes(ref, from: scope);
  final replyId = const Uuid().v4();
  final json = await ref
      .read(apiClientProvider)
      .post<Map<String, dynamic>>('/api/v1/groups/shares/reply', {
        'shareId': shareId,
        'replyId': replyId,
        'body': body,
      })
      .timeout(_mutationTimeout);
  final reply = ShareReply.fromJson(json);
  for (final scope in scopes) {
    if (!ref.exists(sharedMealFeedProvider(scope))) continue;
    _notifier(ref, scope).appendReply(shareId, reply);
  }
  // A post opened from a notification is in no feed to append to — without
  // this the reply posts and the thread the author is looking at never shows
  // it. The refetch also brings the server's own `repliesTotal`.
  ref.invalidate(sharedMealEntryProvider(shareId));
}

Future<void> logSharedMeal(WidgetRef ref, String shareId) async {
  await ref
      .read(apiClientProvider)
      .post<Map<String, dynamic>>('/api/v1/groups/shares/log', {
        'shareId': shareId,
        'factor': 1,
        'loggedDate': todayDateString(),
        'timezoneOffset': localTimezoneOffsetMinutes(),
      })
      .timeout(_mutationTimeout);
  ref.invalidate(loggingDayProvider);
  // The copied meal lands in today's diary — the dashboard reads its ring off a
  // separate bundle/day cache, so heal it too or the Today + week-strip ring
  // keep the pre-log total.
  ref.invalidate(dashboardBundleProvider);
  ref.invalidate(dashboardDayProvider);
  // The entry carries no per-viewer "logged" flag today, so this changes
  // nothing on screen yet; it is here so the fetched copy is healed by the
  // same rule as the feed caches — whatever the server decides to say about a
  // share after it is logged arrives without a second place to remember.
  ref.invalidate(sharedMealEntryProvider(shareId));
}
