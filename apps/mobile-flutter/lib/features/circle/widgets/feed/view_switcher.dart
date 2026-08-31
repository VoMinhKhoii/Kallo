import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../models/social/circle.dart';
import '../../../../theme/calm_tokens.dart';
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

/// Threads-style filter chip (native pass, 2026-08-31): a 36pt visual pill
/// centred in a 44pt tap target, 14pt label.
///
/// Selection is a FILL, not a tint: [kTrack] for the chosen chip, white +
/// hairline for the rest. The old accent@10 wash put the tan accent on a text
/// control, which the button system now reserves for rings and chart strokes;
/// the track surface says "this one is the group you are reading" using the
/// same recessed neutral the app uses for every other selected segment.
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

  /// Visual pill height; the target around it is 44 (iOS minimum).
  static const double _visual = 36;

  @override
  Widget build(BuildContext context) => Semantics(
    button: true,
    selected: selected,
    child: GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: onTap,
      child: SizedBox(
        height: KalloIcons.hit,
        child: Center(
          child: Container(
            height: _visual,
            padding: const EdgeInsets.symmetric(horizontal: KalloSpacing.sp4),
            decoration: BoxDecoration(
              color: selected ? kTrack : kCardSurface,
              border: selected ? null : Border.all(color: kHairline),
              borderRadius: BorderRadius.circular(KalloRadii.pill),
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
                  style: dashBody(
                    weight: selected ? FontWeight.w500 : FontWeight.w400,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    ),
  );
}
