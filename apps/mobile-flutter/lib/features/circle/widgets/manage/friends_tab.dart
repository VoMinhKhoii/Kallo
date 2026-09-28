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
import '../../data/local_blocks.dart';

/// The Friends tab: everyone in the viewer's circle, then — once someone has
/// been blocked — one quiet row into the blocked list.
///
/// Its states are the Circle's capybara: looking through the telescope when
/// there is no one yet (with the way to add someone), stuck in the jar when
/// the list failed (with a retry). A failed fetch never reads as "no friends".
///
/// **The blocked row survives every state.** It is the only way to the
/// blocked list, so neither a loading or empty circle, a failed friends fetch
/// nor a failed blocked count may take the way to unblock away.
class FriendsTab extends ConsumerWidget {
  const FriendsTab({super.key, required this.onOpenBlocked});

  /// Pushes the blocked list.
  final VoidCallback onOpenBlocked;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // Shown once someone is blocked, and when the count failed to load (the
    // list it opens carries its own retry).
    final blocked = ref.watch(blockedCircleUsersProvider);
    final blockedCount = blocked.valueOrNull?.length ?? 0;
    final blockedRow =
        blockedCount > 0 || blocked.hasError
            ? BlockedLinkRow(
              count: blocked.hasError ? null : blockedCount,
              onTap: onOpenBlocked,
            )
            : null;

    return ref
        .watch(visibleCircleFriendsProvider)
        .when(
          skipLoadingOnRefresh: true,
          loading: () => _loadingWith(blockedRow),
          error:
              (_, __) => _stateWith(
                blockedRow,
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
              return _stateWith(
                blockedRow,
                (height) => KalloSurfaceState(
                  area: SurfaceArea.circle,
                  kind: SurfaceKind.empty,
                  minHeight: height,
                  title: tr('groups.manage.friendsEmptyTitle'),
                  subtitle: tr('groups.manage.friendsEmptyBody'),
                  action: KalloButton(
                    variant: KalloButtonVariant.cta,
                    title: tr('groups.page.addFriend'),
                    onPressed: () => showAddFriendSheet(context),
                  ),
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

  /// The skeleton while friends load, with [blockedRow] (when there is one)
  /// under it: the two requests are independent, and a slow friends list
  /// must not hold back a blocked list that is already here.
  Widget _loadingWith(BlockedLinkRow? blockedRow) => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      const FriendListSkeleton(),
      if (blockedRow != null)
        Padding(
          padding: const EdgeInsets.fromLTRB(
            KalloSpacing.sp3,
            KalloSpacing.sp3,
            KalloSpacing.sp3,
            0,
          ),
          child: blockedRow,
        ),
    ],
  );

  /// A whole-tab [state], centred in what is left once [blockedRow] (when
  /// there is one) has its line under it.
  Widget _stateWith(
    BlockedLinkRow? blockedRow,
    Widget Function(double height) state,
  ) => ManageTabState(
    builder:
        (height) => Column(
          children: [
            state(blockedRow == null ? height : height - BlockedLinkRow.extent),
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
