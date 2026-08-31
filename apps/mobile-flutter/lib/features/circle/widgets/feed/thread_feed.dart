import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../models/social/circle.dart';
import '../../../../shared/widgets/surface/kallo_primitives.dart';
import '../../../../theme/calm_tokens.dart';
import '../../../../theme/kallo_theme.dart';
import '../../data/feed_providers.dart';
import '../../data/feed_time.dart';
import '../states/circle_error.dart';
import '../states/circle_skeleton.dart';
import 'feed_day_group.dart';

class ThreadFeed extends ConsumerWidget {
  const ThreadFeed({
    required this.feed,
    required this.header,
    required this.onRetry,
    required this.onAddFriend,
    this.scope,
    this.emptyTitleKey = 'groups.page.friendsEmptyTitle',
    this.emptyDescriptionKey = 'groups.page.friendsNoMealToday',
    this.emptyNamedArgs = const {},
    this.showAddFriend = true,
    super.key,
  });

  final AsyncValue<SharedMealFeedState> feed;
  final Widget header;
  final VoidCallback onRetry;
  final VoidCallback onAddFriend;
  final String? scope;
  final String emptyTitleKey;
  final String emptyDescriptionKey;
  final Map<String, String> emptyNamedArgs;
  final bool showAddFriend;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return NotificationListener<ScrollNotification>(
      onNotification: (notification) {
        if (notification.metrics.axis == Axis.vertical &&
            notification.depth == 0 &&
            notification.metrics.extentAfter < 400) {
          ref.read(sharedMealFeedProvider(scope).notifier).loadMore();
        }
        return false;
      },
      child: feed.when(
        loading: () => _list(const CircleWallSkeleton()),
        error:
            (_, __) => _list(
              CircleErrorCard(onRetry: onRetry, isRetrying: feed.isLoading),
            ),
        data: (state) => _dataList(context, state),
      ),
    );
  }

  /// The page's scroll padding. The bottom clears the floating pill nav —
  /// without [kNavClearance] the last post's action row sits under it.
  static const EdgeInsets _pagePadding = EdgeInsets.fromLTRB(
    KalloSpacing.sp3,
    KalloSpacing.sp2,
    KalloSpacing.sp3,
    kNavClearance,
  );

  Widget _list(Widget body) => ListView(
    physics: const AlwaysScrollableScrollPhysics(),
    padding: _pagePadding,
    children: [header, const SizedBox(height: KalloSpacing.sp3), body],
  );

  Widget _dataList(BuildContext context, SharedMealFeedState state) {
    if (state.entries.isEmpty) {
      return _list(
        _EmptyState(
          onAdd: onAddFriend,
          titleKey: emptyTitleKey,
          descriptionKey: emptyDescriptionKey,
          namedArgs: emptyNamedArgs,
          showAdd: showAddFriend,
        ),
      );
    }
    final children = <Widget>[header];
    for (final day in _byDay(state.entries)) {
      children.add(const SizedBox(height: KalloSpacing.sp3));
      children.add(FeedDayGroup(date: day.date, entries: day.entries));
    }
    if (state.isLoadingMore) {
      children.add(
        Padding(
          padding: const EdgeInsets.all(KalloSpacing.sp2),
          child: Text(
            tr('groups.wall.loadingMore'),
            textAlign: TextAlign.center,
            style: dashMeta(),
          ),
        ),
      );
    }
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: _pagePadding,
      children: children,
    );
  }

  /// Consecutive runs of entries sharing a day key, in feed order. A run, not
  /// a bucket: the feed is already sorted, and grouping by key would silently
  /// reorder a day that arrived split across two pages.
  static List<({DateTime date, List<CircleFeedEntry> entries})> _byDay(
    List<CircleFeedEntry> entries,
  ) {
    final days = <({DateTime date, List<CircleFeedEntry> entries})>[];
    String? previous;
    for (final entry in entries) {
      final date = DateTime.parse(entry.meal.sharedAt);
      final key = threadDayKey(date);
      if (key != previous) {
        days.add((date: date, entries: <CircleFeedEntry>[]));
        previous = key;
      }
      days.last.entries.add(entry);
    }
    return days;
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState({
    required this.onAdd,
    required this.titleKey,
    required this.descriptionKey,
    required this.namedArgs,
    required this.showAdd,
  });
  final VoidCallback onAdd;
  final String titleKey;
  final String descriptionKey;
  final Map<String, String> namedArgs;
  final bool showAdd;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: KalloSpacing.sp10),
    child: Column(
      children: [
        const Icon(LucideIcons.users300, color: kInkMuted, size: 24),
        const SizedBox(height: KalloSpacing.sp3),
        Text(
          tr(titleKey, namedArgs: namedArgs),
          style: dashBody(weight: FontWeight.w500),
        ),
        const SizedBox(height: KalloSpacing.sp1),
        Text(
          tr(descriptionKey, namedArgs: namedArgs),
          textAlign: TextAlign.center,
          style: dashMeta(),
        ),
        if (showAdd) ...[
          const SizedBox(height: KalloSpacing.sp4),
          // The one action, in the quiet tier: an empty circle is not an
          // error, so it gets a white-and-hairline button rather than a
          // filled one competing with the feed that is about to fill in.
          KalloButton(
            title: tr('groups.page.addFriend'),
            variant: KalloButtonVariant.secondary,
            onPressed: onAdd,
          ),
        ],
      ],
    ),
  );
}
