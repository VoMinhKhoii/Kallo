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
/// **An entry leaves only on the server's word**, never on a timer: a timer
/// cannot tell a refetch that landed from one that failed or never ran (the
/// app suspended), and dropping the entry then would bring the blocked
/// person's content back. It leaves when
///
///   - the viewer unblocks them here;
///   - a Circle fetch that STARTED after the block still shows them — the
///     server would not have served them if the block still stood, so it was
///     lifted elsewhere (another device) ([LocallyBlockedUsers.reconcileShown]);
///   - the blocked list, fetched after the block, no longer names them
///     ([LocallyBlockedUsers.reconcileBlocked]).
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

  void remove(String userId) => _lift([userId]);

  /// A fetch that started at [since] came back showing [shown]: anyone in it
  /// who was blocked before it started has been unblocked since.
  void reconcileShown(Iterable<String> shown, {required int since}) => _lift([
    for (final id in shown)
      if ((_blockedAt[id] ?? since + 1) <= since) id,
  ]);

  /// The blocked list, fetched from [since], names [blocked]: anyone blocked
  /// here before then who is missing from it has been unblocked since.
  void reconcileBlocked(Set<String> blocked, {required int since}) => _lift([
    for (final MapEntry(key: id, value: at) in _blockedAt.entries)
      if (at <= since && !blocked.contains(id)) id,
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
