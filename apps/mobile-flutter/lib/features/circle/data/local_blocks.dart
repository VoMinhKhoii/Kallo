/// Who the viewer has JUST blocked, and when that stops mattering.
///
/// A block invalidates every Circle cache, but each keeps its old value until
/// its refetch returns (so a refresh never blanks a page), and until then the
/// blocked person's posts, replies, thread and invites would stay on screen
/// and live: a heart or a reply sent to them is refused, and the long-press
/// would offer the same block again. The feed, the thread page, its replies,
/// the invites and the long-press read [locallyBlockedUserIdsProvider] to drop
/// that content the moment the block lands.
///
/// **An entry leaves only when the server shows the person again**: a
/// Circle fetch — feed page, post by id, invites — that STARTED after the
/// block and still has them in it ([LocallyBlockedUsers.reconcileShown]).
/// Nothing weaker counts:
///
///   - not a timer, which cannot tell a refetch that landed from one that
///     failed or never ran (the app suspended);
///   - not an unblock, here or elsewhere, nor the blocked list dropping them:
///     unblocking never restores the friendship the block deleted, and the
///     other person may block back, so "no longer blocked" is not "visible
///     again" — lifting on it would re-expose whatever stale content a failed
///     refetch left cached. An unblock here invalidates every Circle cache,
///     and the first fetch that does show them lifts the entry.
///
/// Until then an entry costs nothing: every fresh answer already leaves the
/// person out, so the filter only repeats the server. Per account: the set
/// resets when the signed-in user changes.
library;

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../models/social/circle.dart';
import '../../../services/auth/session_provider.dart';

final locallyBlockedUserIdsProvider =
    NotifierProvider<LocallyBlockedUsers, Set<String>>(LocallyBlockedUsers.new);

class LocallyBlockedUsers extends Notifier<Set<String>> {
  /// When each entry landed, on [generation]'s clock.
  final Map<String, int> _blockedAt = {};
  int _clock = 0;

  /// Read by a fetch as it STARTS and handed back to a reconcile when it
  /// succeeds, so an answer is only ever weighed against blocks placed before
  /// it was asked for. A counter rather than wall time: nothing about it can
  /// run backwards or tie.
  int get generation => _clock;

  @override
  Set<String> build() {
    ref.watch(currentSessionProvider.select((session) => session?.user.id));
    _blockedAt.clear();
    return const <String>{};
  }

  void add(String userId) {
    _blockedAt[userId] = ++_clock;
    state = {...state, userId};
  }

  /// A fetch that started at [since] came back showing [shown]: anyone in it
  /// who was blocked before it started is visible to the viewer again.
  void reconcileShown(Iterable<String> shown, {required int since}) => _lift([
    for (final id in shown)
      if ((_blockedAt[id] ?? since + 1) <= since) id,
  ]);

  void _lift(List<String> ids) {
    final lifted = ids.where(_blockedAt.containsKey).toList();
    if (lifted.isEmpty) return;
    lifted.forEach(_blockedAt.remove);
    state = {...state}..removeAll(lifted);
  }
}

/// The other people a Circle post shows: its author and its repliers.
Iterable<String> peopleShownIn(Iterable<CircleFeedEntry> entries) sync* {
  for (final entry in entries) {
    if (!entry.isSelf) yield entry.friend.userId;
    for (final reply in entry.replies) {
      if (!reply.isSelf) yield reply.author.userId;
    }
  }
}
