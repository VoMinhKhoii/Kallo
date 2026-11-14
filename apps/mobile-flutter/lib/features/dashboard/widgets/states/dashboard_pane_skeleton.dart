import 'package:flutter/widgets.dart';
import '../../../../shared/widgets/feedback/kallo_refresh.dart';
import '../../../../shared/widgets/feedback/skeleton.dart';
import '../../../../shared/widgets/panes/page_window.dart';
import '../../../../shared/widgets/panes/two_pane_scaffold.dart';
import '../../../../shell/window/window_layout.dart';
import '../../logic/dashboard_spacing.dart';
import 'card_skeletons.dart';

/// Loading previews the same independent panes as the loaded dashboard.
class DashboardPaneSkeleton extends StatelessWidget {
  const DashboardPaneSkeleton({super.key, required this.onRefresh});
  final Future<void> Function() onRefresh;
  @override
  Widget build(BuildContext context) {
    final layout = PageWindow.of(context);
    final nearLeft = layout.controlEdge == ControlEdge.left;
    Widget pane(bool near, List<Widget> children) => KalloRefreshableScroll(
      onRefresh: onRefresh,
      slivers:
          (bottom) => [
            SliverPadding(
              padding: EdgeInsets.fromLTRB(
                near == nearLeft ? 12 : 0,
                0,
                near == nearLeft ? 0 : 12,
                bottom,
              ),
              sliver: SliverList(delegate: SliverChildListDelegate(children)),
            ),
          ],
    );
    return TwoPaneScaffold(
      header: const SizedBox.shrink(),
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
