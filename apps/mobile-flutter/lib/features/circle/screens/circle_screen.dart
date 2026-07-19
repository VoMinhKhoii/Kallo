import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../shared/widgets/widgets.dart';
import '../../../shell/app_header.dart';
import '../../../theme/calm_tokens.dart';
import '../../../theme/nham_colors.dart';
import '../../../theme/nham_theme.dart';
import '../../../theme/nham_typography.dart';
import '../data/chat_group_providers.dart';
import '../data/circle_providers.dart';
import '../data/feed_providers.dart';
import '../widgets/add_friend_sheet.dart';
import '../widgets/circle_add_menu.dart';
import '../widgets/group_info_sheet.dart';
import '../widgets/meal_invites.dart';
import '../widgets/thread_feed.dart';
import '../widgets/view_switcher.dart';

Future<void> _showGroupInfoSheet(BuildContext context, String groupId) =>
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => GroupInfoSheet(groupId: groupId),
    );

class CircleScreen extends ConsumerWidget {
  const CircleScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    ref.watch(circleFeedProvider);
    final selected = ref.watch(circleSelectedViewProvider);
    final feed = ref.watch(sharedMealFeedProvider(selected));
    final group =
        selected == null
            ? null
            : ref.watch(chatGroupDetailProvider(selected)).valueOrNull;
    final name =
        group?.name ??
        ref
            .watch(chatGroupsProvider)
            .valueOrNull
            ?.where((item) => item.id == selected)
            .firstOrNull
            ?.title ??
        '';
    return Screen(
      child: Column(
        children: [
          const Padding(
            padding: EdgeInsets.symmetric(horizontal: NhamSpacing.sp3),
            child: AppHeader(),
          ),
          Expanded(
            child: RefreshIndicator(
              color: NhamColors.accent,
              backgroundColor: NhamColors.elev,
              onRefresh: () => _refresh(ref, selected),
              child: ThreadFeed(
                scope: selected,
                feed: feed,
                header: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const _Header(),
                    const SizedBox(height: NhamSpacing.sp3),
                    const ViewSwitcher(),
                    const SizedBox(height: NhamSpacing.sp3),
                    const MealInvitesSection(),
                    if (selected != null) ...[
                      const SizedBox(height: NhamSpacing.sp3),
                      _GroupHeader(
                        groupId: selected,
                        name: name,
                        count: group?.members.length,
                      ),
                    ],
                  ],
                ),
                onRetry: () => ref.invalidate(sharedMealFeedProvider(selected)),
                onAddFriend: () => showAddFriendSheet(context),
                emptyTitleKey:
                    selected == null
                        ? 'groups.page.friendsEmptyTitle'
                        : 'groups.page.groupNoActivity',
                emptyDescriptionKey:
                    selected == null
                        ? 'groups.page.friendsNoMealToday'
                        : 'groups.page.groupNoActivity',
                emptyNamedArgs: {'name': name},
                showAddFriend: selected == null,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _refresh(WidgetRef ref, String? selected) async {
    ref.invalidate(sharedMealFeedProvider(selected));
    ref.invalidate(mealShareInvitesProvider);
    ref.invalidate(circleFeedProvider);
    if (selected != null) {
      ref.invalidate(chatGroupsProvider);
      ref.invalidate(chatGroupDetailProvider(selected));
    }
    try {
      await ref.read(sharedMealFeedProvider(selected).future);
    } catch (_) {}
  }
}

class _Header extends StatelessWidget {
  const _Header();
  @override
  Widget build(BuildContext context) => Row(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Expanded(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              tr('groups.page.title'),
              style: NhamTextStyles.serifRegular(
                fontSize: NhamFontSize.h3,
              ).copyWith(
                color: NhamColors.text,
                letterSpacing: NhamTracking.tight,
              ),
            ),
            const SizedBox(height: NhamSpacing.sp1),
            Text(
              tr('groups.page.subtitle'),
              style: NhamTextStyles.sansRegular(
                fontSize: NhamFontSize.sm,
              ).copyWith(color: NhamColors.textMuted),
            ),
          ],
        ),
      ),
      const CircleAddMenu(),
    ],
  );
}

class _GroupHeader extends StatelessWidget {
  const _GroupHeader({
    required this.groupId,
    required this.name,
    required this.count,
  });
  final String groupId;
  final String name;
  final int? count;
  @override
  Widget build(BuildContext context) => Row(
    children: [
      Expanded(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(name, style: dashBody(weight: FontWeight.w500)),
            if (count != null)
              Text(
                tr('groups.info.memberCount', namedArgs: {'count': '$count'}),
                style: dashMeta(),
              ),
          ],
        ),
      ),
      IconButton(
        tooltip: tr('groups.info.title'),
        onPressed: () => _showGroupInfoSheet(context, groupId),
        icon: const Icon(LucideIcons.info, size: 18, color: kInkMuted),
      ),
    ],
  );
}
