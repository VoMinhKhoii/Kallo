import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../shared/data/surface_cast.dart';
import '../../../shared/widgets/surface/kallo_screen.dart';
import '../../../shared/widgets/surface/scroll_separator.dart';
import '../../../theme/calm_tokens.dart';
import '../../../theme/kallo_theme.dart';
import '../data/chat_group_providers.dart';
import '../data/circle_providers.dart';
import '../data/feed_providers.dart';
import '../widgets/invite/add_friend_sheet.dart';
import '../widgets/invite/circle_add_menu.dart';
import '../widgets/invite/meal_invites.dart';
import '../widgets/feed/thread_feed.dart';
import '../widgets/switcher/view_switcher.dart';

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
      bottom: false,
      child: ScrollSeparator(
        // A large LEFT-aligned page title, not a centred header line (native
        // pass, 2026-08-31): 28/700 is the top of the header ramp, and the
        // iOS large-title idiom anchors it to the leading edge with the one
        // action opposite. The 44pt add control sits in the trailing slot, so
        // the title's optical baseline and the glyph's centre still agree.
        header: const Padding(
          padding: EdgeInsets.symmetric(horizontal: KalloSpacing.sp3),
          child: _CircleTitleRow(),
        ),
        child: ThreadFeed(
          scope: selected,
          onRefresh: () => _refresh(ref, selected),
          feed: feed,
          header: const Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              ViewSwitcher(),
              // MealInvitesSection collapses to nothing when there are no
              // invites, so it owns the gap above itself rather than having
              // one reserved here for a widget that usually is not there.
              MealInvitesSection(),
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
          // A group with no posts is a box nobody has climbed out of yet; the
          // friends wall is the capybara still looking for someone.
          emptyPose:
              selected == null ? SurfaceKind.empty : SurfaceKind.emptyAlt,
          showAddFriend: selected == null,
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

/// Page title 28/700 left, the add control 44pt right.
class _CircleTitleRow extends StatelessWidget {
  const _CircleTitleRow();

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: KalloSpacing.sp1),
    child: Row(
      children: [
        Expanded(child: Text(tr('groups.page.title'), style: kPageTitle())),
        const CircleAddMenu(),
      ],
    ),
  );
}
