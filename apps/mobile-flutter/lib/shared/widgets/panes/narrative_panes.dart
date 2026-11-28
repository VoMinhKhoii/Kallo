import 'package:flutter/widgets.dart';

import '../../../shell/window/window_layout.dart';
import '../../../shell/window/window_layout_scope.dart';
import '../../../shell/window/window_regions.dart';

/// Narrative backgrounds stay full bleed while the task avoids the fold.
/// A one-column window shows [single]; a two-pane window places [far] and
/// [near] on either side of the fold, so no caller writes the branch itself.
class NarrativePanes extends StatelessWidget {
  const NarrativePanes({
    super.key,
    required this.far,
    required this.near,
    required this.single,
  });

  final Widget far;
  final Widget near;
  final Widget single;

  @override
  Widget build(BuildContext context) {
    final layout = WindowLayout.of(context);
    if (!layout.twoPane) return single;
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
