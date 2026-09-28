import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../shared/data/surface_cast.dart';
import '../../../../shared/widgets/feedback/kallo_surface_state.dart';
import '../../../../shared/widgets/surface/kallo_button.dart';
import '../../../../theme/kallo_theme.dart';
import '../../data/circle_providers.dart';
import '../../data/moderation_mutations.dart';
import '../invite/add_friend_sheet.dart';
import '../states/circle_error.dart';
import '../states/friend_list_skeleton.dart';
import '../states/manage_tab_state.dart';
import 'blocked_link_row.dart';
import 'friend_row.dart';
import 'manage_list.dart';

/// The Friends tab: everyone in the viewer's circle, then — only once someone
/// has been blocked — one quiet row into the blocked list.
///
/// Its states are the Circle's capybara: looking through the telescope when
/// there is no one yet (with the way to add someone), stuck in the jar when
/// the list failed (with a retry). A failed fetch never reads as "no friends".
class FriendsTab extends ConsumerWidget {
  const FriendsTab({super.key, required this.onOpenBlocked});

  /// Pushes the blocked list.
  final VoidCallback onOpenBlocked;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final friendsAsync = ref.watch(circleFriendsProvider);
    // Shown once someone is blocked — and ALSO when the count failed to load:
    // this row is the only way to the blocked list, and that page carries its
    // own retry, so an error must not quietly take the way to unblock away.
    final blocked = ref.watch(blockedCircleUsersProvider);
    final blockedCount = blocked.valueOrNull?.length ?? 0;
    final blockedRow =
        blockedCount > 0 || blocked.hasError
            ? BlockedLinkRow(
              count: blocked.hasError ? null : blockedCount,
              onTap: onOpenBlocked,
            )
            : null;

    return friendsAsync.when(
      skipLoadingOnRefresh: true,
      loading: () => const FriendListSkeleton(),
      error:
          (_, __) => ManageTabState(
            builder:
                (height) => CircleErrorCard(
                  minHeight: height,
                  onRetry: () => ref.invalidate(circleFriendsProvider),
                ),
          ),
      data: (members) {
        final friends = [
          for (final member in members)
            if (member.isAccepted) member.profile,
        ];
        if (friends.isEmpty) {
          return ManageTabState(
            builder:
                (height) => Column(
                  children: [
                    KalloSurfaceState(
                      area: SurfaceArea.circle,
                      kind: SurfaceKind.empty,
                      // Centred in what is left once the blocked row has its
                      // line under it.
                      minHeight:
                          blockedRow == null
                              ? height
                              : height - BlockedLinkRow.extent,
                      title: tr('groups.manage.friendsEmptyTitle'),
                      subtitle: tr('groups.manage.friendsEmptyBody'),
                      action: KalloButton(
                        variant: KalloButtonVariant.cta,
                        title: tr('groups.page.addFriend'),
                        onPressed: () => showAddFriendSheet(context),
                      ),
                    ),
                    // Someone who blocked their only friend still needs the
                    // way back to them.
                    if (blockedRow != null)
                      Padding(
                        padding: const EdgeInsets.symmetric(
                          horizontal: KalloSpacing.sp3,
                        ),
                        child: blockedRow,
                      ),
                  ],
                ),
          );
        }
        return ManageList(
          children: [
            for (final friend in friends)
              FriendRow(key: ValueKey(friend.userId), profile: friend),
            if (blockedRow != null) ...[
              const SizedBox(height: KalloSpacing.sp3),
              blockedRow,
            ],
          ],
        );
      },
    );
  }
}
