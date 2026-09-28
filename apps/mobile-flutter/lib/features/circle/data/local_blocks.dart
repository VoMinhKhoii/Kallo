/// Hiding a just-blocked person's content that is still in the caches.
///
/// A block invalidates every Circle cache, but each keeps its old value until
/// its refetch returns (so a refresh never blanks a page) — and keeps it for
/// good if the refetch fails. Until then the blocked person's posts, replies,
/// thread, offers and unread dot would stay on screen and live: a heart or a
/// reply sent to them is refused, an offer can only fail to accept.
///
/// **Each cached value is judged by when it was fetched.** Every Circle fetch
/// stamps what it returns ([stampFetched]) with [LocallyBlockedUsers.generation]
/// as it was when the request STARTED, and every block records the generation
/// it landed at. A value hides a person exactly when it was fetched before
/// that person was blocked ([LocalBlocks.hides]):
///
///   - a stale value — a refetch still in flight, one that failed, one the
///     app never got to run — keeps its old stamp, so it stays hidden however
///     long it lingers;
///   - a value fetched after the block is the server's own answer and is
///     shown as it came. If it has the person in it, the block was lifted and
///     the server says they are visible there — in that cache, and only that
///     one: a group feed that shows them lifts nothing in a friends feed whose
///     refetch failed.
///
/// So nothing is ever "lifted", and no signal (a timer, an unblock, the
/// blocked list) has to be trusted to mean "visible again". Per account: the
/// blocks reset when the signed-in user changes.
library;

import 'dart:math' show max;

import 'package:flutter/foundation.dart' show immutable;
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../models/social/circle.dart';
import '../../../services/auth/session_provider.dart';
import 'circle_providers.dart'
    show circleFriendsProvider, mealShareInvitesProvider;

final localBlocksProvider = NotifierProvider<LocallyBlockedUsers, LocalBlocks>(
  LocallyBlockedUsers.new,
);

/// The generation each fetched value was asked for at. An [Expando] so the
/// stamp rides on the value itself without the models knowing about it.
final Expando<int> _fetchedAt = Expando<int>('fetchedAt');

/// Stamp [values] as fetched by a request that started at generation [since].
void stampFetched(Iterable<Object> values, int since) {
  for (final value in values) {
    _fetchedAt[value] = since;
  }
}

/// Stamp feed entries and their replies.
void stampEntries(Iterable<CircleFeedEntry> entries, int since) {
  for (final entry in entries) {
    stampFetched([entry, ...entry.replies], since);
  }
}

/// Give [copy] the stamp of the value it was patched from, so an optimistic
/// patch (a heart, a reply) never makes fresh content look stale.
void carryStamp(Object from, Object copy) {
  final at = _fetchedAt[from];
  if (at != null) _fetchedAt[copy] = at;
}

/// Who the viewer has blocked this session, and at which generation.
@immutable
class LocalBlocks {
  const LocalBlocks([this._blockedAt = const {}]);

  final Map<String, int> _blockedAt;

  /// Whether [content], by [userId], was fetched before [userId] was blocked.
  /// Unstamped content counts as fetched before any block.
  bool hides(String userId, Object content) {
    final blockedAt = _blockedAt[userId];
    if (blockedAt == null) return false;
    return (_fetchedAt[content] ?? 0) < blockedAt;
  }

  /// Whether [content] was fetched before the latest block — for a value
  /// that cannot say which person it counts (a group's unread flag), and so
  /// is not trusted until a fresh one arrives.
  bool predatesAnyBlock(Object content) =>
      _blockedAt.isNotEmpty &&
      (_fetchedAt[content] ?? 0) < _blockedAt.values.reduce(max);
}

class LocallyBlockedUsers extends Notifier<LocalBlocks> {
  int _clock = 0;

  /// Read by a fetch as it starts and handed to [stampFetched].
  int get generation => _clock;

  @override
  LocalBlocks build() {
    ref.watch(currentSessionProvider.select((session) => session?.user.id));
    return const LocalBlocks();
  }

  /// [userId] was blocked just now: every value fetched before this hides them.
  void add(String userId) {
    _clock += 1;
    state = LocalBlocks({...state._blockedAt, userId: _clock});
  }
}

/// [entry] as the viewer sees it after a block: without replies by anyone
/// blocked since it was fetched, and with a reply total it can vouch for.
///
/// The server leaves a blocked author out of both the replies and the total,
/// so a retained entry must not show a count its thread cannot back up. But
/// [CircleFeedEntry.replies] is only the newest dozen: when it holds every
/// reply, the total is exact after dropping the hidden ones; when it does
/// not, older replies by a blocked person may still be counted, so the total
/// falls back to what is on screen until a fresh fetch says otherwise.
/// An entry fetched after every block is returned as it is.
CircleFeedEntry withoutBlockedReplies(
  LocalBlocks blocks,
  CircleFeedEntry entry,
) {
  if (!blocks.predatesAnyBlock(entry)) return entry;
  final kept = [
    for (final reply in entry.replies)
      if (!blocks.hides(reply.author.userId, reply)) reply,
  ];
  final complete = entry.repliesTotal <= entry.replies.length;
  final total =
      complete
          ? max(0, entry.repliesTotal - (entry.replies.length - kept.length))
          : kept.length;
  if (kept.length == entry.replies.length && total == entry.repliesTotal) {
    return entry;
  }
  final copy = CircleFeedEntry(
    friend: entry.friend,
    isSelf: entry.isSelf,
    meal: entry.meal,
    reactions: entry.reactions,
    replies: kept,
    repliesTotal: total,
  );
  carryStamp(entry, copy);
  return copy;
}

// ---------------------------------------------------------------------------
// What the viewer sees: the cached lists without a just-blocked person.
// Loading and error pass through unchanged; a retry still invalidates the
// underlying provider.
// ---------------------------------------------------------------------------

/// [circleFriendsProvider] without anyone blocked since it was fetched. Every
/// friends list — Edit circle, the Settings count, the share and group
/// pickers — reads this, so a person blocked from a post never keeps a live
/// row (Report, Block, Remove) while the refetch runs.
final visibleCircleFriendsProvider =
    Provider.autoDispose<AsyncValue<List<CircleMember>>>((ref) {
      final blocks = ref.watch(localBlocksProvider);
      return ref
          .watch(circleFriendsProvider)
          .whenData(
            (all) => [
              for (final member in all)
                if (!blocks.hides(member.profile.userId, member)) member,
            ],
          );
    });

/// [mealShareInvitesProvider] minus offers from anyone just blocked. The inbox
/// AND the Circle tab badge read this, so the badge never promises an offer
/// the inbox hides.
final visibleMealShareInvitesProvider =
    Provider.autoDispose<AsyncValue<List<MealShareInvite>>>((ref) {
      final blocks = ref.watch(localBlocksProvider);
      return ref
          .watch(mealShareInvitesProvider)
          .whenData(
            (all) => [
              for (final invite in all)
                if (!blocks.hides(invite.from.userId, invite)) invite,
            ],
          );
    });
