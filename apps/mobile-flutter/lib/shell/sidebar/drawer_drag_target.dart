import 'package:flutter/widgets.dart';

/// One horizontal-drag recognizer wired to the drawer controller, used twice:
/// once wrapping the page (where it loses to any nested horizontal gesture)
/// and once as the left-edge strip (where it wins).
///
/// Translucent and child-less by default so the edge copy lets taps and
/// vertical scrolling through to the page beneath it.
class DrawerDragTarget extends StatelessWidget {
  const DrawerDragTarget({
    super.key,
    required this.panelWidth,
    required this.onDown,
    required this.onUpdate,
    required this.onEnd,
    this.child,
  });

  final double panelWidth;
  final VoidCallback onDown;
  final void Function(double delta, double panelWidth) onUpdate;
  final ValueChanged<double> onEnd;
  final Widget? child;

  @override
  Widget build(BuildContext context) => GestureDetector(
    behavior: HitTestBehavior.translucent,
    onHorizontalDragDown: (_) => onDown(),
    onHorizontalDragUpdate: (d) => onUpdate(d.primaryDelta ?? 0, panelWidth),
    onHorizontalDragEnd: (d) => onEnd(d.primaryVelocity ?? 0),
    // An interrupted swipe (recognizer loses the arena) never fires dragEnd —
    // settle from rest so the drawer can't stick halfway.
    onHorizontalDragCancel: () => onEnd(0),
    child: child,
  );
}
