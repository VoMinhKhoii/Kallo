import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../models/social/moderation.dart';
import '../../../shared/data/surface_cast.dart';
import '../../../shared/widgets/avatar/profile_avatar.dart';
import '../../../shared/widgets/chrome/inline_nav_bar.dart';
import '../../../shared/widgets/feedback/kallo_surface_state.dart';
import '../../../shared/widgets/surface/kallo_primitives.dart';
import '../../../shared/widgets/surface/kallo_small_button.dart';
import '../../../theme/kallo_theme.dart';
import '../data/moderation_mutations.dart';
import '../logic/moderation_flows.dart';
import '../widgets/manage/manage_list.dart';
import '../widgets/manage/manage_row.dart';
import '../widgets/states/circle_error.dart';
import '../widgets/states/friend_list_skeleton.dart';
import '../widgets/states/manage_tab_state.dart';

/// The people the viewer has blocked, each with a solid-ink "Bỏ chặn" — the
/// one rare action on these lists, so the one filled button.
///
/// Reached from the "Blocked (n)" row at the foot of the Friends tab.
/// Unblocking does not restore the friendship; the confirm says so.
class BlockedPeopleScreen extends ConsumerWidget {
  const BlockedPeopleScreen({super.key, required this.parentTitle});

  /// The page this was pushed from, for the back label.
  final String parentTitle;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Screen(
      bottom: false,
      child: Column(
        children: [
          InlineNavBar(
            title: tr('groups.manage.blockedTitle'),
            parentTitle: parentTitle,
          ),
          Expanded(
            child: ref
                .watch(blockedCircleUsersProvider)
                .when(
                  skipLoadingOnRefresh: true,
                  loading: () => const FriendListSkeleton(),
                  error: (_, __) => _error(ref),
                  data:
                      (blocked) =>
                          blocked.isEmpty
                              ? _empty(context)
                              : ManageList(
                                children: [
                                  for (final entry in blocked)
                                    _BlockedRow(
                                      key: ValueKey(entry.profile.userId),
                                      entry: entry,
                                    ),
                                ],
                              ),
                ),
          ),
        ],
      ),
    );
  }

  Widget _error(WidgetRef ref) => ManageTabState(
    builder:
        (height) => CircleErrorCard(
          minHeight: height,
          title: tr('groups.manage.blockedLoadError'),
          onRetry: () => ref.invalidate(blockedCircleUsersProvider),
        ),
  );

  /// Reached when the last person was just unblocked: the list empties under
  /// the viewer, so the one action takes them back.
  Widget _empty(BuildContext context) => ManageTabState(
    builder:
        (height) => KalloSurfaceState(
          area: SurfaceArea.circle,
          kind: SurfaceKind.empty,
          minHeight: height,
          title: tr('groups.manage.blockedEmptyTitle'),
          subtitle: tr('groups.manage.blockedEmptyBody'),
          action: KalloButton(
            variant: KalloButtonVariant.cta,
            title: tr('common.back'),
            onPressed: () => Navigator.of(context).maybePop(),
          ),
        ),
  );
}

class _BlockedRow extends ConsumerStatefulWidget {
  const _BlockedRow({super.key, required this.entry});

  final BlockedCircleUser entry;

  @override
  ConsumerState<_BlockedRow> createState() => _BlockedRowState();
}

class _BlockedRowState extends ConsumerState<_BlockedRow> {
  /// True from the tap until the unblock flow ends. The row stays on screen
  /// until the list refetches, so without this a second tap during a slow
  /// request would send a second unblock — which the server answers 404 once
  /// the first has landed, toasting a failure for an unblock that worked.
  bool _busy = false;

  Future<void> _unblock() async {
    setState(() => _busy = true);
    try {
      await unblockFlow(context, ref, widget.entry.profile);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final profile = widget.entry.profile;
    return ManageRow(
      leading: ProfileAvatarDisc(profile: profile, size: ManageRow.disc),
      title: profile.label,
      trailing: [
        const SizedBox(width: KalloSpacing.sp2),
        KalloSmallButton(
          label: tr('groups.manage.unblock'),
          variant: KalloSmallButtonVariant.ink,
          onPressed: _busy ? null : _unblock,
        ),
      ],
    );
  }
}
