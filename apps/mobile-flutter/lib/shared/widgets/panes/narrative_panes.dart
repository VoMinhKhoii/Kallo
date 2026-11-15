import 'package:flutter/widgets.dart';

import '../../../shell/window/window_layout.dart';
import '../../../shell/window/window_layout_scope.dart';
import '../../../shell/window/window_regions.dart';

/// Narrative backgrounds stay full bleed while the task avoids the fold.
/// Callers choose the single-column layout; this frame places the two panes.
class NarrativePanes extends StatelessWidget {
  const NarrativePanes({super.key, required this.far, required this.near});

  final Widget far;
  final Widget near;

  @override
  Widget build(BuildContext context) {
    final layout = WindowLayout.of(context);
    final regions = WindowRegions(layout);
    final farRect = regions.far;
    return Stack(
      children: [
        for (final pane in [(farRect, far), (regions.near, near)])
          Positioned(
            left: pane.$1.left,
            width: pane.$1.width,
            top: 0,
            bottom: 0,
            child: ClipRect(
              child: MediaQuery.removePadding(
                context: context,
                removeLeft: true,
                removeRight: true,
                child: MediaQuery.removeViewPadding(
                  context: context,
                  removeLeft: true,
                  removeRight: true,
                  child: WindowLayoutScope(layout: layout, child: pane.$2),
                ),
              ),
            ),
          ),
      ],
    );
  }
}
