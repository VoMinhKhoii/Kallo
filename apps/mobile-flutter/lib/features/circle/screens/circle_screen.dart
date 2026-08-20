import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../shared/widgets/sheet/kallo_sheet.dart';
import '../../../shared/widgets/surface/kallo_screen.dart';
import '../../../shared/widgets/surface/scroll_separator.dart';
import '../../../shell/header/app_header.dart';
import '../../../theme/calm_tokens.dart';
import '../../../theme/kallo_theme.dart';
import '../data/chat_group_providers.dart';
import '../data/circle_providers.dart';
import '../data/feed_providers.dart';
import '../widgets/invite/add_friend_sheet.dart';
import '../widgets/invite/circle_add_menu.dart';
import '../widgets/groups/group_info_sheet.dart';
import '../widgets/invite/meal_invites.dart';
import '../widgets/feed/thread_feed.dart';
import '../widgets/feed/view_switcher.dart';
import '../../../shared/widgets/feedback/kallo_refresh.dart';

Future<void> _showGroupInfoSheet(BuildContext context, String groupId) =>
    showNhamSheet<void>(
      context,
      isScrollControlled: true,
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
      child: ScrollSeparator(
        // Title on the header line, sans at Value 17 rather than the Lora
        // headline: at 17 its cap-height sits level with the 24pt hamburger
        // beside it, and the whole screen then runs on 12/14/17 — the three
        // sizes `mobile.md` locks a surface to, with none spent on chrome.
        header: Padding(
          padding: const EdgeInsets.symmetric(horizontal: KalloSpacing.sp3),
          child: AppHeader(
            trailing: const CircleAddMenu(),
            child: Text(
              tr('groups.page.title'),
              style: dashValue().copyWith(
                fontWeight: FontWeight.w600,
                letterSpacing: -0.3,
              ),
            ),
          ),
        ),
        child: KalloRefresh(
          onRefresh: () => _refresh(ref, selected),
          child: ThreadFeed(
            scope: selected,
            feed: feed,
            header: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const ViewSwitcher(),
                // MealInvitesSection collapses to nothing when there are no
                // invites, so it owns the gap above itself rather than having
                // one reserved here for a widget that usually is not there.
                const MealInvitesSection(),
                if (selected != null) ...[
                  const SizedBox(height: KalloSpacing.sp3),
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
        icon: const Icon(LucideIcons.info300, size: 18, color: kInkMuted),
      ),
    ],
  );
}
