import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../models/social/circle.dart';
import '../../../../theme/calm_tokens.dart';
import '../../../../theme/kallo_colors.dart';
import '../../../../theme/kallo_theme.dart';
import '../../data/chat_group_providers.dart';
import '../../data/circle_providers.dart';
import '../../data/feed_providers.dart';

class ViewSwitcher extends ConsumerWidget {
  const ViewSwitcher({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
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
    final ambient = ref.watch(circleFeedProvider);
    final marker = ref.watch(friendsReadMarkerProvider);
    final allUnread = _allUnread(ambient, marker);

    return Semantics(
      label: tr('groups.switcher.label'),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: Row(
          children: [
            _Pill(
              label: tr('groups.switcher.all'),
              selected: selected == null,
              unread: allUnread,
              onTap:
                  () =>
                      ref.read(circleSelectedViewProvider.notifier).state =
                          null,
            ),
            for (final group in groups) ...[
              const SizedBox(width: KalloSpacing.sp2),
              _Pill(
                label: group.title,
                selected: selected == group.id,
                unread: group.unread,
                onTap:
                    () =>
                        ref.read(circleSelectedViewProvider.notifier).state =
                            group.id,
              ),
            ],
            if (groupsAsync.hasError) ...[
              const SizedBox(width: KalloSpacing.sp2),
              _Pill(
                label: tr('groups.switcher.retry'),
                selected: false,
                unread: false,
                onTap: () => ref.invalidate(chatGroupsProvider),
              ),
            ],
          ],
        ),
      ),
    );
  }

  bool _allUnread(
    AsyncValue<List<CircleFeedEntry>> ambient,
    AsyncValue<DateTime> marker,
  ) {
    if (!ambient.hasValue || !marker.hasValue) return false;
    DateTime? latest;
    for (final entry in ambient.requireValue) {
      if (entry.isSelf) continue;
      final date = DateTime.tryParse(entry.meal.sharedAt);
      if (date != null && (latest == null || date.isAfter(latest))) {
        latest = date;
      }
    }
    return latest?.isAfter(marker.requireValue) ?? false;
  }
}

class _Pill extends StatelessWidget {
  const _Pill({
    required this.label,
    required this.selected,
    required this.unread,
    required this.onTap,
  });
  final String label;
  final bool selected;
  final bool unread;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Semantics(
    button: true,
    selected: selected,
    child: InkWell(
      borderRadius: BorderRadius.circular(999),
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(
          horizontal: KalloSpacing.sp4,
          vertical: KalloSpacing.sp2,
        ),
        decoration: BoxDecoration(
          color: selected ? KalloColors.accent10 : Colors.white,
          border: selected ? null : Border.all(color: kHairline),
          borderRadius: BorderRadius.circular(999),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (unread) ...[
              const ExcludeSemantics(
                child: DecoratedBox(
                  key: Key('circle-unread-dot'),
                  decoration: BoxDecoration(
                    color: kInk,
                    shape: BoxShape.circle,
                  ),
                  child: SizedBox.square(dimension: 7),
                ),
              ),
              const SizedBox(width: 7),
            ],
            Text(
              label,
              style: dashMeta(color: selected ? kInk : kInkMuted).copyWith(
                fontWeight: selected ? FontWeight.w500 : FontWeight.w400,
              ),
            ),
          ],
        ),
      ),
    ),
  );
}
