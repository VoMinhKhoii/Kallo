import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../models/social/chat_group.dart';
import '../../../../services/auth/session_provider.dart';
import '../../../../services/http/query.dart';
import '../../../../services/http/query_cache.dart';

final _lastListRefreshProvider = StateProvider<DateTime?>((ref) {
  ref.watch(signedInUserIdProvider);
  return null;
});

void recordGroupListFetch(Ref<Object?> ref) {
  ref.read(_lastListRefreshProvider.notifier).state =
      ref.read(queryNowProvider)();
}

/// Reconcile remote membership/activity changes at most once per freshness
/// window, rather than refetching the list after every circle is opened.
void refreshGroupListIfStale(Ref<Object?> ref, void Function() refresh) {
  final last = ref.read(_lastListRefreshProvider);
  if (last == null ||
      ref.read(queryNowProvider)().difference(last) < kQueryStaleTime) {
    return;
  }
  recordGroupListFetch(ref);
  refresh();
}

/// A server acknowledgement covers only the group-list snapshot that existed
/// before that request. A later list object may include newer unread posts.
class GroupReadReceipt {
  const GroupReadReceipt(this.snapshot, this.through);

  final ChatGroupIdentity snapshot;
  final DateTime through;
}

final groupReadReceiptProvider = StateProvider.autoDispose
    .family<GroupReadReceipt?, String>((ref, id) {
      ref.watch(signedInUserIdProvider);
      return null;
    });

bool groupHasUnread(ChatGroupIdentity group, GroupReadReceipt? receipt) {
  if (!group.unread) return false;
  if (receipt == null || !identical(group, receipt.snapshot)) return true;
  final messageAt = group.lastMessageAt;
  if (messageAt == null) return false;
  final parsed = DateTime.tryParse(messageAt);
  // A malformed timestamp cannot justify hiding a message's unread flag.
  return parsed == null || parsed.isAfter(receipt.through);
}
