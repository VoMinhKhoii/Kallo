/// Paginated Threads-style Circle feed providers and local cache splices.
library;

import 'dart:async';

import 'package:flutter/widgets.dart' show AppLifecycleState, WidgetsBinding;
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../services/auth/session_provider.dart';
import '../../../services/http/api_client.dart';
import '../../../services/http/query.dart';
import '../../../services/http/query_cache.dart';
import '../../../models/http/api_error.dart';
import '../../../models/social/chat_group.dart';
import '../../../models/social/circle.dart';
import 'chat_group_providers.dart';
import 'circle_providers.dart' show kCirclePollInterval;
import 'local_blocks.dart';
import 'feed_refresh/feed_refresh.dart';
import 'read_state/group_read_state.dart';

const Duration _feedRequestTimeout = Duration(seconds: 15);
const Duration kSharedMealFeedCacheTime = Duration(minutes: 5);

class SharedMealFeedState {
  const SharedMealFeedState({
    required this.entries,
    required this.nextCursor,
    this.isLoadingMore = false,
  });

  final List<CircleFeedEntry> entries;
  final String? nextCursor;
  final bool isLoadingMore;
}

/// The selected Circle feed: null is the combined friends feed, otherwise a
/// named chat-group id.
final circleSelectedViewProvider = StateProvider<String?>((ref) => null);

/// The viewer's last-read marker for the combined friends feed, and when the
/// newest friend share they may see was made.
class FriendsReadMarker {
  const FriendsReadMarker(this.lastReadAt, {this.latestSharedAt});

  final DateTime lastReadAt;

  /// Catches a meal shared just now but eaten on an earlier day: the circle
  /// wall the unread dot otherwise reads holds only meals eaten today. Null
  /// when there is no such share, or from a server that does not send it.
  final DateTime? latestSharedAt;
}

final friendsReadMarkerProvider = FutureProvider.autoDispose<FriendsReadMarker>(
  (ref) async {
    // Refreshed on the wall's cadence: a past-day meal shared while Circle is
    // open reaches the unread dot only through latestSharedAt, never the wall.
    // Paused in the background, like the wall's own poll.
    final poll = Timer.periodic(kCirclePollInterval, (_) {
      final lifecycle = WidgetsBinding.instance.lifecycleState;
      if (lifecycle == null || lifecycle == AppLifecycleState.resumed) {
        ref.invalidateSelf();
      }
    });
    ref.onDispose(poll.cancel);
    final api = ref.watch(apiClientProvider);
    return runWithRetry(() async {
      final json = await api
          .get<Map<String, dynamic>>('/api/v1/groups/friends/read-marker')
          .timeout(_feedRequestTimeout);
      final latest = json['latestSharedAt'] as String?;
      return FriendsReadMarker(
        DateTime.parse(json['lastReadAt'] as String),
        latestSharedAt: latest == null ? null : DateTime.parse(latest),
      );
    });
  },
);

/// arg == null loads the combined friends feed; otherwise it loads one group.
final sharedMealFeedProvider = AsyncNotifierProvider.autoDispose
    .family<SharedMealFeedNotifier, SharedMealFeedState, String?>(
      SharedMealFeedNotifier.new,
    );

class SharedMealFeedNotifier
    extends AutoDisposeFamilyAsyncNotifier<SharedMealFeedState, String?> {
  int _generation = 0;
  DateTime? _loadedAt;
  Future<void>? _refreshing;
  void Function()? _releaseCache;

  String get _path =>
      arg == null
          ? '/api/v1/groups/friends/feed'
          : '/api/v1/chat-groups/${Uri.encodeComponent(arg!)}/feed';

  @override
  Future<SharedMealFeedState> build(String? arg) async {
    _generation++;
    ref.onDispose(() => _generation++);
    requireSignedIn(ref);
    var disposed = false;
    var active = true;
    ref.onDispose(() => disposed = true);
    ref.onCancel(() => active = false);
    ref.onResume(() {
      active = true;
      // Resume may run while a widget subscribes during build. Defer writes.
      scheduleMicrotask(() {
        if (!disposed &&
            active &&
            _loadedAt != null &&
            ref.read(queryNowProvider)().difference(_loadedAt!) >=
                kQueryStaleTime) {
          unawaited(refresh().catchError((Object _) {}));
        }
      });
    });
    _refreshing = null;
    _releaseCache = null;
    final snapshot = _groupSnapshot();
    final page = await _fetchPage(before: null);
    final result = SharedMealFeedState(
      entries: page.entries,
      nextCursor: page.nextCursor,
    );
    if (disposed) return result;

    _retain();
    _acceptReadReceipt(page, snapshot);
    return result;
  }

  ChatGroupIdentity? _groupSnapshot() =>
      arg == null || !ref.exists(chatGroupsProvider)
          ? null
          : ref
              .read(chatGroupsProvider)
              .valueOrNull
              ?.where((group) => group.id == arg)
              .firstOrNull;

  void _acceptReadReceipt(
    SharedMealFeedPage page,
    ChatGroupIdentity? snapshot,
  ) {
    if (arg == null) {
      ref.invalidate(friendsReadMarkerProvider);
    } else if (!page.hasReadReceipt) {
      // Compatibility with a server deployed before read receipts.
      ref.invalidate(chatGroupsProvider);
    } else if (snapshot != null && page.readThroughAt != null) {
      ref
          .read(groupReadReceiptProvider(arg!).notifier)
          .state = GroupReadReceipt(snapshot, page.readThroughAt!);
    }
    if (arg != null && page.hasReadReceipt) {
      refreshGroupListIfStale(ref, () => ref.invalidate(chatGroupsProvider));
    }
  }

  void _retain() {
    _loadedAt = ref.read(queryNowProvider)();
    final previous = _releaseCache;
    _releaseCache = retainQuery(ref, kSharedMealFeedCacheTime);
    previous?.call();
  }

  /// Refresh in place: keep posts visible, preserve an overlapping history
  /// tail, and never let an earlier page request overwrite the new head.
  Future<void> refresh() {
    if (_refreshing != null) return _refreshing!;
    if (state.isLoading) return Future.value();
    final before = state.valueOrNull;
    if (before == null) return Future.value();
    final generation = ++_generation;
    final snapshot = _groupSnapshot();
    final pending = _refreshPage(before, generation, snapshot);
    _refreshing = pending;
    return pending.whenComplete(() {
      if (identical(_refreshing, pending)) _refreshing = null;
    });
  }

  Future<void> _refreshPage(
    SharedMealFeedState before,
    int generation,
    ChatGroupIdentity? snapshot,
  ) async {
    try {
      final page = await _fetchPage(before: null);
      if (generation != _generation) return;
      final current = state.valueOrNull ?? before;
      final merged = mergeFeedRefresh(
        page,
        before.entries,
        current.entries,
        current.nextCursor,
      );
      state = AsyncData(
        SharedMealFeedState(
          entries: merged.entries,
          nextCursor: merged.nextCursor,
        ),
      );
      _retain();
      _acceptReadReceipt(page, snapshot);
    } catch (error, stack) {
      if (generation != _generation) return;
      if (error is ApiError && !error.retryable) {
        _releaseCache?.call();
        // AsyncNotifier errors inherit the previous value. Scrub protected
        // posts first, so other consumers cannot read them out of the error.
        state = const AsyncData(
          SharedMealFeedState(entries: [], nextCursor: null),
        );
        state = AsyncError(error, stack);
      } else {
        final current = state.valueOrNull ?? before;
        state = AsyncData(
          SharedMealFeedState(
            entries: current.entries,
            nextCursor: current.nextCursor,
          ),
        );
      }
      rethrow;
    }
  }

  Future<SharedMealFeedPage> _fetchPage({required String? before}) async {
    // Eaten order: this client day-groups by loggedAt. The server keeps share
    // order for builds that do not ask, which group by sharedAt.
    final query =
        '?order=eaten'
        '${before == null ? '' : '&before=${Uri.encodeQueryComponent(before)}'}';
    final api = ref.read(apiClientProvider);
    final since = ref.read(localBlocksProvider.notifier).generation;
    // Switching away must not abandon a request that will still hit the
    // server, then start a duplicate on return. Failed requests release this.
    final pending = ref.keepAlive();
    final page = await runWithRetry(() async {
      final json = await api
          .get<Map<String, dynamic>>('$_path$query')
          .timeout(_feedRequestTimeout);
      return SharedMealFeedPage.fromJson(json);
    }).whenComplete(pending.close);
    // When it was asked for, so a block landing meanwhile still hides the
    // people in it (`local_blocks.dart`).
    stampEntries(page.entries, since);
    return page;
  }

  Future<void> loadMore() async {
    final generation = _generation;
    final current = state.valueOrNull;
    if (!state.hasValue ||
        _refreshing != null ||
        current == null ||
        current.nextCursor == null ||
        current.isLoadingMore) {
      return;
    }

    state = AsyncData(
      SharedMealFeedState(
        entries: current.entries,
        nextCursor: current.nextCursor,
        isLoadingMore: true,
      ),
    );

    try {
      final page = await _fetchPage(before: current.nextCursor);
      if (generation != _generation) return;
      final latest = state.valueOrNull ?? current;
      final seen = <String>{};
      final entries = <CircleFeedEntry>[];
      for (final entry in [...latest.entries, ...page.entries]) {
        if (seen.add(entry.meal.shareId)) entries.add(entry);
      }
      state = AsyncData(
        SharedMealFeedState(entries: entries, nextCursor: page.nextCursor),
      );
    } catch (_) {
      if (generation != _generation) return;
      final latest = state.valueOrNull ?? current;
      state = AsyncData(
        SharedMealFeedState(
          entries: latest.entries,
          nextCursor: latest.nextCursor,
        ),
      );
      rethrow;
    }
  }

  void toggleReactionLocal(String shareId) {
    _mapShare(shareId, (entry) {
      final reactions = entry.reactions;
      final nextCount = reactions.count + (reactions.mine ? -1 : 1);
      return _copyEntry(
        entry,
        reactions: ShareReactions(
          count: nextCount < 0 ? 0 : nextCount,
          mine: !reactions.mine,
        ),
      );
    });
  }

  void applyReaction(String shareId, {required bool mine, required int count}) {
    _mapShare(
      shareId,
      (entry) => _copyEntry(
        entry,
        reactions: ShareReactions(count: count, mine: mine),
      ),
    );
  }

  void appendReply(String shareId, ShareReply reply) {
    _mapShare(shareId, (entry) {
      if (entry.replies.any((existing) => existing.id == reply.id)) {
        return entry;
      }
      final appended = [...entry.replies, reply];
      final replies =
          appended.length > 12
              ? appended.sublist(appended.length - 12)
              : appended;
      return _copyEntry(
        entry,
        replies: replies,
        repliesTotal: entry.repliesTotal + 1,
      );
    });
  }

  void _mapShare(
    String shareId,
    CircleFeedEntry Function(CircleFeedEntry entry) transform,
  ) {
    final current = state.valueOrNull;
    if (current == null) return;
    state = AsyncData(
      SharedMealFeedState(
        entries:
            current.entries
                .map(
                  (entry) =>
                      entry.meal.shareId == shareId ? transform(entry) : entry,
                )
                .toList(),
        nextCursor: current.nextCursor,
        isLoadingMore: current.isLoadingMore,
      ),
    );
  }
}

/// A patched copy keeps the original's fetch stamp (`local_blocks.dart`): a
/// heart or a reply on fresh content must not make it read as stale.
CircleFeedEntry _copyEntry(
  CircleFeedEntry entry, {
  ShareReactions? reactions,
  List<ShareReply>? replies,
  int? repliesTotal,
}) {
  final copy = CircleFeedEntry(
    friend: entry.friend,
    isSelf: entry.isSelf,
    meal: entry.meal,
    reactions: reactions ?? entry.reactions,
    replies: replies ?? entry.replies,
    repliesTotal: repliesTotal ?? entry.repliesTotal,
  );
  carryStamp(entry, copy);
  return copy;
}
