import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../models/social/circle.dart';
import '../../data/chat_group_providers.dart';
import '../../data/circle_providers.dart';
import '../../data/feed_providers.dart';
import '../../data/local_blocks.dart';
import '../../logic/group_flows.dart';
import 'circle_tab.dart';
import 'tab_faces.dart';
import 'tab_strip.dart';

/// The Circle's view switcher: underlined tabs — "All", then each group —
/// with the open tab's faces between its name and the underline, laid out
/// edge to edge by [TabStrip].
///
/// It replaced a row of filter chips plus a separate "name · N members · (i)"
/// line under them (approved canvas, 2026-09-29). The open tab now carries
/// who is in the view, and a second tap on it opens the group sheet (or, on
/// "All", the circle manager). Long-press a group tab for its menu.
class ViewSwitcher extends ConsumerStatefulWidget {
  const ViewSwitcher({super.key});

  @override
  ConsumerState<ViewSwitcher> createState() => _ViewSwitcherState();
}

/// Kept alive while scrolled off. The switcher is the first item of the
/// feed's lazily built list, so scrolling away used to unmount it: back at
/// the top it refetched its faces and replayed their entrance, and the open
/// tab's name climbed ~30pt under the finger on every return.
class _ViewSwitcherState extends ConsumerState<ViewSwitcher>
    with AutomaticKeepAliveClientMixin {
  @override
  bool get wantKeepAlive => true;

  @override
  Widget build(BuildContext context) {
    super.build(context);
    ref.listen(chatGroupsProvider, (_, next) {
      if (!next.hasValue || next.isLoading || next.hasError) return;
      final selected = ref.read(circleSelectedViewProvider);
      if (selected == null) return;
      final selectedStillExists = next.requireValue.any(
        (group) => group.kind == 'group' && group.id == selected,
      );
      if (!selectedStillExists) {
        ref.read(circleSelectedViewProvider.notifier).state = null;
      }
    });
    final groupsAsync = ref.watch(chatGroupsProvider);
    final groups =
        groupsAsync.valueOrNull
            ?.where((group) => group.kind == 'group')
            .toList() ??
        const [];
    if (groups.isEmpty && !groupsAsync.hasError) return const SizedBox.shrink();
    final selected = ref.watch(circleSelectedViewProvider);
    final blocks = ref.watch(localBlocksProvider);
    final allUnread = _allUnread(
      ref.watch(circleFeedProvider),
      ref.watch(friendsReadMarkerProvider),
      blocks,
    );
    final people = _openPeople(ref, selected);
    void select(String? id) =>
        ref.read(circleSelectedViewProvider.notifier).state = id;

    return Semantics(
      label: tr('groups.switcher.label'),
      child: TabStrip(
        selected:
            selected == null
                ? 0
                : 1 + groups.indexWhere((group) => group.id == selected),
        tabs: [
          CircleTab(
            label: tr('groups.switcher.all'),
            selected: selected == null,
            unread: allUnread,
            people: selected == null ? people : null,
            openHint: tr('groups.switcher.openCircleHint'),
            onTap:
                () =>
                    selected == null
                        ? openCircleManager(context)
                        : select(null),
          ),
          for (final group in groups)
            CircleTab(
              key: ValueKey(group.id),
              label: group.title,
              selected: selected == group.id,
              // A group's flag cannot say whose message it counts, so one
              // from a list fetched before a block waits for a fresh list.
              unread: group.unread && !blocks.predatesAnyBlock(group),
              people: selected == group.id ? people : null,
              openHint: tr('groups.switcher.openGroupHint'),
              onTap:
                  () =>
                      selected == group.id
                          ? showGroupInfoSheet(context, group.id)
                          : select(group.id),
              onLongPress:
                  (anchor) => openGroupTabMenu(
                    context,
                    groupId: group.id,
                    anchor: anchor,
                  ),
            ),
          if (groupsAsync.hasError)
            CircleTab(
              label: tr('groups.switcher.retry'),
              selected: false,
              unread: false,
              onTap: () => ref.invalidate(chatGroupsProvider),
            ),
        ],
      ),
    );
  }

  /// Who the open tab shows: the group's members, or — on "All" — the
  /// viewer's accepted friends. Empty until they load; the tab simply opens
  /// without faces rather than waiting on them.
  TabPeople _openPeople(WidgetRef ref, String? selected) {
    if (selected != null) {
      final members =
          ref.watch(chatGroupDetailProvider(selected)).valueOrNull?.members ??
          const [];
      return (faces: members, total: members.length);
    }
    final friends = <CircleProfile>[
      for (final friend
          in ref.watch(visibleCircleFriendsProvider).valueOrNull ?? const [])
        if (friend.isAccepted) friend.profile,
    ];
    return (faces: friends, total: friends.length);
  }

  bool _allUnread(
    AsyncValue<List<CircleFeedEntry>> ambient,
    AsyncValue<FriendsReadMarker> marker,
    LocalBlocks blocks,
  ) {
    if (!ambient.hasValue || !marker.hasValue) return false;
    // The polled wall keeps this live for meals eaten today; the marker adds
    // a meal shared now but eaten on an earlier day, which the wall never has.
    DateTime? latest = marker.requireValue.latestSharedAt;
    for (final entry in ambient.requireValue) {
      // Nor a post by someone the viewer has just blocked, from a frame
      // fetched before the block (`local_blocks.dart`).
      if (entry.isSelf || blocks.hides(entry.friend.userId, entry)) continue;
      final date = DateTime.tryParse(entry.meal.sharedAt);
      if (date != null && (latest == null || date.isAfter(latest))) {
        latest = date;
      }
    }
    return latest?.isAfter(marker.requireValue.lastReadAt) ?? false;
  }
}
