import 'package:flutter/widgets.dart';
import '../../../../../shared/widgets/feedback/skeleton.dart';
import '../../../../../shared/widgets/panes/two_pane_scaffold.dart';
import '../../../../../shared/widgets/surface/kallo_primitives.dart';

/// A loading silhouette in each pane, so profile loading promises the same
/// arrangement as the loaded day without pinning cards in a short window.
class LoggingPaneSkeleton extends StatelessWidget {
  const LoggingPaneSkeleton({super.key});

  @override
  Widget build(BuildContext context) => Screen(
    bounded: true,
    glow: true,
    bottom: false,
    child: SkeletonPulse(
      child: TwoPaneScaffold(
        header: const SizedBox(height: 44),
        far: const Padding(
          padding: EdgeInsets.only(left: 12),
          child: SingleChildScrollView(
            child: Column(
              children: [
                SkeletonBar(height: 48, radius: 10),
                SizedBox(height: 12),
                SkeletonBar(height: 240, radius: 22),
              ],
            ),
          ),
        ),
        near: ListView(
          padding: const EdgeInsets.only(right: 12),
          children: [
            for (var i = 0; i < 3; i++)
              const Padding(
                padding: EdgeInsets.only(bottom: 12),
                child: SkeletonBar(height: 96, radius: 16),
              ),
          ],
        ),
      ),
    ),
  );
}
