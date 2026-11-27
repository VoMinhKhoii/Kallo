import 'package:flutter/widgets.dart';
import '../../../../../shared/widgets/feedback/skeleton.dart';
import '../../../../../shared/widgets/panes/two_pane_scaffold.dart';
import '../../../../../shared/widgets/surface/kallo_primitives.dart';

/// A loading silhouette in each pane, so profile loading promises the same
/// arrangement as the loaded day: the month and this week's rows in the far
/// pane, the title, the gauge row and the cards in the near one.
class LoggingPaneSkeleton extends StatelessWidget {
  const LoggingPaneSkeleton({super.key});

  @override
  Widget build(BuildContext context) => Screen(
    bounded: true,
    glow: true,
    bottom: false,
    child: SkeletonPulse(
      // Two-pane windows only: logging_screen mounts its own one-column
      // silhouette, outside this Screen, everywhere else.
      child: TwoPaneScaffold(
        single: null,
        far: const Padding(
          padding: EdgeInsets.fromLTRB(24, 0, 12, 0),
          child: SingleChildScrollView(
            child: Column(
              children: [
                SizedBox(height: 12),
                SkeletonBar(height: 20, radius: 10),
                SizedBox(height: 24),
                SkeletonBar(height: 260, radius: 22),
                SizedBox(height: 16),
                SkeletonBar(height: 60, radius: 14),
              ],
            ),
          ),
        ),
        near: ListView(
          padding: const EdgeInsets.only(right: 12),
          children: [
            const SizedBox(height: 12),
            const SkeletonBar(width: 160, height: 20, radius: 10),
            const SizedBox(height: 24),
            const SkeletonBar(height: 88, radius: 22),
            const SizedBox(height: 12),
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
