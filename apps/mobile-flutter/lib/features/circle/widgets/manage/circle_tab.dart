import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../shared/data/surface_cast.dart';
import '../../../../shared/widgets/feedback/kallo_surface_state.dart';
import '../../../../shared/widgets/surface/kallo_button.dart';
import '../../../../theme/kallo_theme.dart';
import '../../data/chat_group_providers.dart';
import '../invite/circle_add_menu.dart' show showCreateGroupSheet;
import '../states/circle_error.dart';
import '../states/friend_list_skeleton.dart';
import '../states/manage_tab_state.dart';
import 'group_row.dart';

/// The Circle tab ("Nhóm"): every named group the viewer is in, each with
/// "Go to circle" and its `⋯`. Direct chats are not groups and do not list.
///
/// States: the capybara peeking out of a box when there are no groups yet
/// (with "Create group"), stuck in the jar when the list failed (with a
/// retry) — never an empty list that is really an error.
class CircleTab extends ConsumerWidget {
  const CircleTab({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final groupsAsync = ref.watch(chatGroupsProvider);
    return groupsAsync.when(
      skipLoadingOnRefresh: true,
      loading: () => const FriendListSkeleton(),
      error:
          (_, __) => ManageTabState(
            builder:
                (height) => CircleErrorCard(
                  minHeight: height,
                  title: tr('groups.manage.circleLoadError'),
                  onRetry: () => ref.invalidate(chatGroupsProvider),
                ),
          ),
      data: (all) {
        final groups = all.where((g) => g.kind == 'group').toList();
        if (groups.isEmpty) {
          return ManageTabState(
            builder:
                (height) => KalloSurfaceState(
                  area: SurfaceArea.circle,
                  kind: SurfaceKind.emptyAlt,
                  minHeight: height,
                  title: tr('groups.manage.circleEmptyTitle'),
                  subtitle: tr('groups.manage.circleEmptyBody'),
                  action: KalloButton(
                    variant: KalloButtonVariant.cta,
                    title: tr('groups.page.createGroup'),
                    onPressed: () => showCreateGroupSheet(context),
                  ),
                ),
          );
        }
        return ListView(
          padding: EdgeInsets.fromLTRB(
            KalloSpacing.sp3,
            KalloSpacing.sp2,
            KalloSpacing.sp3,
            KalloSpacing.sp8 + MediaQuery.viewPaddingOf(context).bottom,
          ),
          children: [
            for (final group in groups)
              GroupRow(key: ValueKey(group.id), group: group),
          ],
        );
      },
    );
  }
}
