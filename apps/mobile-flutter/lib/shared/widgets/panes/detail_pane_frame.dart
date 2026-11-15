import 'package:flutter/material.dart';
import '../../../shell/window/window_layout.dart';
import '../../../shell/window/window_layout_scope.dart';
import '../../../shell/window/window_regions.dart';
import 'detail_pane.dart';

/// Keeps one route alive while its frame moves between a push and a pane.
class DetailPaneFrame extends StatefulWidget {
  const DetailPaneFrame({super.key, required this.child});
  final Widget child;

  @override
  State<DetailPaneFrame> createState() => _DetailPaneFrameState();
}

class _DetailPaneFrameState extends State<DetailPaneFrame> {
  final _content = GlobalKey();

  @override
  Widget build(BuildContext context) {
    final layout = WindowLayout.of(context);
    final child = KeyedSubtree(key: _content, child: widget.child);
    if (!layout.twoPane) return child;
    final pane = WindowRegions(layout).near;
    final media = MediaQuery.of(context);
    return Stack(
      children: [
        Positioned(
          left: pane.left,
          width: pane.width,
          top: 0,
          bottom: 0,
          child: WindowLayoutScope(
            layout: layout,
            child: DetailPane(
              child: MediaQuery(
                data: media.copyWith(
                  padding: media.padding.copyWith(left: 0, right: 0),
                  viewPadding: media.viewPadding.copyWith(left: 0, right: 0),
                ),
                // The screen reads the preserved layout and owns its top inset.
                child: child,
              ),
            ),
          ),
        ),
      ],
    );
  }
}
