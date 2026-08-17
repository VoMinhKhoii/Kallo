import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../theme/calm_tokens.dart';
import '../../../../theme/kallo_theme.dart';
import '../../data/feed_providers.dart';
import '../../data/feed_time.dart';
import '../states/circle_error.dart';
import '../states/circle_skeleton.dart';
import 'feed_entry.dart';

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

  Widget _list(Widget body) => ListView(
    physics: const AlwaysScrollableScrollPhysics(),
    padding: const EdgeInsets.fromLTRB(
      KalloSpacing.sp3,
      KalloSpacing.sp2,
      KalloSpacing.sp3,
      KalloSpacing.sp8,
    ),
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
    final children = <Widget>[header, const SizedBox(height: KalloSpacing.sp3)];
    String? previousDay;
    for (final entry in state.entries) {
      final date = DateTime.parse(entry.meal.sharedAt);
      final day = threadDayKey(date);
      if (day != previousDay) children.add(_DaySeparator(date: date));
      children.add(
        Padding(
          key: ValueKey(entry.meal.shareId),
          padding: const EdgeInsets.symmetric(vertical: KalloSpacing.sp4),
          child: FeedEntry(entry: entry),
        ),
      );
      children.add(const Divider(height: 1, thickness: 1, color: kHairline));
      previousDay = day;
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
      padding: const EdgeInsets.fromLTRB(
        KalloSpacing.sp3,
        KalloSpacing.sp2,
        KalloSpacing.sp3,
        KalloSpacing.sp8,
      ),
      children: children,
    );
  }
}

class _DaySeparator extends StatelessWidget {
  const _DaySeparator({required this.date});
  final DateTime date;

  @override
  Widget build(BuildContext context) {
    final label = threadDayLabel(date, locale: context.locale.languageCode);
    final text = switch (label.kind) {
      ThreadDayLabelKind.today => tr('groups.wall.todayLabel'),
      ThreadDayLabelKind.yesterday => tr('groups.wall.yesterdayLabel'),
      ThreadDayLabelKind.date => label.dateLabel!,
    };
    return Padding(
      padding: const EdgeInsets.only(top: KalloSpacing.sp4),
      child: Row(
        children: [
          const Expanded(child: Divider(color: kHairline)),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: KalloSpacing.sp2),
            child: Text(text, style: dashMeta()),
          ),
          const Expanded(child: Divider(color: kHairline)),
        ],
      ),
    );
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
          const SizedBox(height: KalloSpacing.sp3),
          TextButton.icon(
            onPressed: onAdd,
            icon: const Icon(LucideIcons.userPlus300, size: 16),
            label: Text(tr('groups.page.addFriend')),
          ),
        ],
      ],
    ),
  );
}
