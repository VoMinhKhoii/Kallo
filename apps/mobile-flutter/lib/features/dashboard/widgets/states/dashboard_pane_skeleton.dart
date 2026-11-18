import '../../../../shared/widgets/panes/pane_insets.dart';
import '../../../../shared/widgets/panes/pane_slot.dart';
import 'package:flutter/widgets.dart';
import '../../../../shared/widgets/feedback/kallo_refresh.dart';
import '../../../../shared/widgets/feedback/skeleton.dart';
import '../../../../shared/widgets/panes/two_pane_scaffold.dart';
import '../../logic/dashboard_spacing.dart';
import 'card_skeletons.dart';
import 'dash_skeleton_header.dart';

/// Loading previews the same independent panes as the loaded dashboard.
/// A one-column window shows [single], the full-page silhouette.
class DashboardPaneSkeleton extends StatelessWidget {
  const DashboardPaneSkeleton({
    super.key,
    required this.onRefresh,
    required this.single,
  });
  final Future<void> Function() onRefresh;
  final Widget single;
  @override
  Widget build(BuildContext context) {
    Widget pane(bool near, List<Widget> children) => KalloRefreshableScroll(
      onRefresh: onRefresh,
      slivers:
          (bottom) => [
            SliverPadding(
              padding: paneInsets(
                context,
                slot: near ? PaneSlot.near : PaneSlot.far,
                bottom: bottom,
              ),
              sliver: SliverList(delegate: SliverChildListDelegate(children)),
            ),
          ],
    );
    return TwoPaneScaffold(
      single: single,
      far: pane(false, const [
        SkeletonBar(height: 72),
        SizedBox(height: DashboardSpacing.block),
        DashSkeletonHeader(),
        TodayCardSkeleton(),
      ]),
      near: pane(true, const [
        DashSkeletonHeader(),
        WeightCardSkeleton(),
        SizedBox(height: DashboardSpacing.block),
        DashSkeletonHeader(),
        SkeletonCard(children: [SkeletonBar(height: 120, radius: 10)]),
      ]),
    );
  }
}
