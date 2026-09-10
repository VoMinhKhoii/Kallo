import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../shared/data/surface_cast.dart';
import '../../../../shared/widgets/feedback/kallo_refresh.dart';
import '../../../../shared/widgets/feedback/kallo_surface_state.dart';
import '../../../../shared/widgets/feedback/sliver_centered_state.dart';
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
    required this.onRefresh,
    required this.onRetry,
    required this.onAddFriend,
    this.scope,
    this.emptyTitleKey = 'groups.page.friendsEmptyTitle',
    this.emptyDescriptionKey = 'groups.page.friendsNoMealToday',
    this.emptyNamedArgs = const {},
    this.emptyPose = SurfaceKind.empty,
    this.showAddFriend = true,
    super.key,
  });

  final AsyncValue<SharedMealFeedState> feed;
  final Widget header;

  /// The pull-to-refresh refetch. It lives HERE rather than around this widget
  /// because the scroll view it must hold open is built in this file — the
  /// iOS control is a sliver, not a wrapper.
  final Future<void> Function() onRefresh;
  final VoidCallback onRetry;
  final VoidCallback onAddFriend;
  final String? scope;
  final String emptyTitleKey;
  final String emptyDescriptionKey;
  final Map<String, String> emptyNamedArgs;

  /// Which capybara stands on the empty wall: the friends scope gets the
  /// telescope (looking for someone), a group the box (nobody home yet).
  final SurfaceKind emptyPose;

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
        // The skeleton is top-anchored on purpose: it previews where the
        // first post's card lands, so it sits exactly where that card will —
        // which is why it goes down the CONTENT path and not the state one.
        loading:
            () => _contentScroll([
              header,
              const SizedBox(height: KalloSpacing.sp3),
              const CircleWallSkeleton(),
            ]),
        error:
            (_, __) => _stateScroll(
              CircleErrorCard(
                onRetry: onRetry,
                isRetrying: feed.isLoading,
              ),
            ),
        data: (state) => _dataList(context, state),
      ),
    );
  }

  /// The page's own inset. The side inset is the app-wide 12 on every sliver
  /// here; only the BOTTOM differs, and which sliver pays it is the whole
  /// distinction between the two helpers below.
  static EdgeInsets _pad(double top, double bottom) =>
      EdgeInsets.fromLTRB(KalloSpacing.sp3, top, KalloSpacing.sp3, bottom);

  /// The page's one scroll view holding FEED CONTENT: the refresh control,
  /// then [children] as a plain list under the header.
  ///
  /// The list pays the bottom inset, because the content is what has to clear
  /// the floating pill nav — without it the last post's action row sits under
  /// the bar. The inset is the bar's measured height, which the shell reports
  /// as the body's bottom padding.
  Widget _contentScroll(List<Widget> children) => KalloRefreshableScroll(
    onRefresh: onRefresh,
    slivers:
        (bottomInset) => [
          SliverPadding(
            padding: _pad(KalloSpacing.sp2, bottomInset),
            sliver: SliverList(delegate: SliverChildListDelegate(children)),
          ),
        ],
  );

  /// The same scroll view holding a SURFACE STATE — empty, failed — instead of
  /// feed content: the header stays at the top, and [state] takes the whole
  /// page under it and sits at the middle of that, because a state pinned to
  /// the header's underside with the page blank beneath reads as content still
  /// loading.
  ///
  /// The header list therefore pays NO bottom inset; the inset is paid inside
  /// the fill sliver instead, since a trailing spacer below a sliver that
  /// already fills the viewport lands below the fold and pushes nothing.
  Widget _stateScroll(Widget state) => KalloRefreshableScroll(
    onRefresh: onRefresh,
    slivers:
        (bottomInset) => [
          SliverPadding(
            padding: _pad(KalloSpacing.sp2, 0),
            sliver: SliverList(
              delegate: SliverChildListDelegate([header]),
            ),
          ),
          SliverCenteredState(
            padding: _pad(KalloSpacing.sp3, bottomInset),
            child: state,
          ),
        ],
  );

  Widget _dataList(BuildContext context, SharedMealFeedState state) {
    if (state.entries.isEmpty) {
      return _stateScroll(_empty());
    }
    final children = <Widget>[header];
    for (final day in groupEntriesByDay(state.entries)) {
      children.add(const SizedBox(height: KalloSpacing.sp3));
      children.add(
        FeedDayGroup(date: day.date, entries: day.entries, scope: scope),
      );
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
    return _contentScroll(children);
  }

  /// Nothing on the wall yet. "Add a friend" wears the black `cta` — the tier
  /// every surface state gives its one action, the one sanctioned use of it
  /// outside auth and the paywall.
  Widget _empty() => KalloSurfaceState(
    area: SurfaceArea.circle,
    kind: emptyPose,
    title: tr(emptyTitleKey, namedArgs: emptyNamedArgs),
    subtitle: tr(emptyDescriptionKey, namedArgs: emptyNamedArgs),
    action:
        showAddFriend
            ? KalloButton(
              title: tr('groups.page.addFriend'),
              variant: KalloButtonVariant.cta,
              onPressed: onAddFriend,
            )
            : null,
  );
}
