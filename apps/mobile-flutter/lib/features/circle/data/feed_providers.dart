/// Paginated Threads-style Circle feed providers and local cache splices.
library;

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../data/api_client.dart';
import '../../../data/query.dart';
import '../../../models/circle.dart';
import 'chat_group_providers.dart';

const Duration _feedRequestTimeout = Duration(seconds: 15);

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

/// The viewer's last-read marker for the combined friends feed.
final friendsReadMarkerProvider = FutureProvider.autoDispose<DateTime>((
  ref,
) async {
  final api = ref.watch(apiClientProvider);
  return runWithRetry(() async {
    final json = await api
        .get<Map<String, dynamic>>('/api/v1/groups/friends/read-marker')
        .timeout(_feedRequestTimeout);
    return DateTime.parse(json['lastReadAt'] as String);
  });
});

/// arg == null loads the combined friends feed; otherwise it loads one group.
final sharedMealFeedProvider = AsyncNotifierProvider.autoDispose
    .family<SharedMealFeedNotifier, SharedMealFeedState, String?>(
      SharedMealFeedNotifier.new,
    );

class SharedMealFeedNotifier
    extends AutoDisposeFamilyAsyncNotifier<SharedMealFeedState, String?> {
  String get _path =>
      arg == null
          ? '/api/v1/groups/friends/feed'
          : '/api/v1/chat-groups/${Uri.encodeComponent(arg!)}/feed';

  @override
  Future<SharedMealFeedState> build(String? arg) async {
    final page = await _fetchPage(before: null);
    if (arg == null) {
      ref.invalidate(friendsReadMarkerProvider);
    } else {
      ref.invalidate(chatGroupsProvider);
    }
    return SharedMealFeedState(
      entries: page.entries,
      nextCursor: page.nextCursor,
    );
  }

  Future<SharedMealFeedPage> _fetchPage({required String? before}) {
    final query =
        before == null ? '' : '?before=${Uri.encodeQueryComponent(before)}';
    final api = ref.read(apiClientProvider);
    return runWithRetry(() async {
      final json = await api
          .get<Map<String, dynamic>>('$_path$query')
          .timeout(_feedRequestTimeout);
      return SharedMealFeedPage.fromJson(json);
    });
  }

  Future<void> loadMore() async {
    final current = state.valueOrNull;
    if (!state.hasValue ||
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

CircleFeedEntry _copyEntry(
  CircleFeedEntry entry, {
  ShareReactions? reactions,
  List<ShareReply>? replies,
  int? repliesTotal,
}) => CircleFeedEntry(
  friend: entry.friend,
  isSelf: entry.isSelf,
  meal: entry.meal,
  reactions: reactions ?? entry.reactions,
  replies: replies ?? entry.replies,
  repliesTotal: repliesTotal ?? entry.repliesTotal,
);
