import 'package:flutter/widgets.dart';

import 'drag.dart';

/// The gestures every sheet has and a [ScanPanel] — a sheet drawn inside the
/// scan screen rather than pushed as a route — would otherwise lack:
///
/// - **Drag down to dismiss**, from the header or the dock, or from the body
///   once its scroll is at the top (the pull carries on as the sheet's).
/// - **Tap outside to dismiss**, over the frozen frame above the sheet. With
///   the keyboard up that first tap only puts the keyboard away, as it does
///   on the sheet itself.
/// - **Tap the sheet to put the keyboard away**: the number pad has no return
///   key of its own.
/// - **Swipe right to go back** on a second level ([onBack]).
///
/// Buttons, fields and scrollables inside win their own taps and drags: they
/// sit deeper in the hit test, so they enter the gesture arena first.
class ScanPanelGestures extends StatefulWidget {
  const ScanPanelGestures({
    super.key,
    required this.child,
    this.onDismiss,
    this.onBack,
  });

  /// The sheet surface. It must hit-test only its own area, so a tap above
  /// it falls through to the outside catcher.
  final Widget child;

  /// Closes the sheet; null while it may not close (a save in flight).
  final VoidCallback? onDismiss;

  /// A second level's way back to the first.
  final VoidCallback? onBack;

  @override
  State<ScanPanelGestures> createState() => _ScanPanelGesturesState();
}

class _ScanPanelGesturesState extends State<ScanPanelGestures>
    with SingleTickerProviderStateMixin {
  // Built in initState, not lazily: a panel never dragged would otherwise
  // build its ticker for the first time in `dispose`, off a dead element.
  late final ScanPanelDrag _drag;

  @override
  void initState() {
    super.initState();
    _drag = ScanPanelDrag(vsync: this);
  }

  @override
  void dispose() {
    _drag.dispose();
    super.dispose();
  }

  void _unfocus() => FocusManager.instance.primaryFocus?.unfocus();

  void _tapOutside() {
    if (MediaQuery.viewInsetsOf(context).bottom > 0) return _unfocus();
    widget.onDismiss?.call();
  }

  void _endDown(DragEndDetails d) =>
      _drag.endDown(d.velocity.pixelsPerSecond.dy, widget.onDismiss);

  void _endBack(DragEndDetails d) => _drag.endBack(
    d.velocity.pixelsPerSecond.dx,
    context.size?.width ?? MediaQuery.sizeOf(context).width,
    widget.onBack,
  );

  /// The body's scroll at its top, still pulled down: the pull is the
  /// sheet's. Pushed back up, the sheet returns before the body scrolls on.
  /// Only a finger counts (`dragDetails`) — a fling coasting home does not.
  bool _onScroll(ScrollNotification n) {
    if (widget.onDismiss == null || n.metrics.axis != Axis.vertical) {
      return false;
    }
    if (n is OverscrollNotification && n.dragDetails != null) {
      if (n.overscroll < 0 || _drag.isPulledDown) _drag.down(-n.overscroll);
    } else if (n is ScrollUpdateNotification &&
        n.dragDetails != null &&
        _drag.isPulledDown) {
      _drag.down(-(n.scrollDelta ?? 0));
    } else if (n is ScrollEndNotification) {
      _drag.endDown(
        n.dragDetails?.velocity.pixelsPerSecond.dy ?? 0,
        widget.onDismiss,
      );
    }
    return false;
  }

  @override
  Widget build(BuildContext context) {
    final canDismiss = widget.onDismiss != null;
    final canGoBack = widget.onBack != null;
    return Stack(
      fit: StackFit.expand,
      children: [
        Positioned.fill(
          child: GestureDetector(
            behavior: HitTestBehavior.opaque,
            // Every gesture here repeats a header control (close, back),
            // which is what a screen reader uses; announced as well, these
            // swallowed the header's labels into one merged node.
            excludeFromSemantics: true,
            onTap: _tapOutside,
          ),
        ),
        ValueListenableBuilder<Offset>(
          valueListenable: _drag.offset,
          builder:
              (context, offset, child) =>
                  Transform.translate(offset: offset, child: child),
          child: NotificationListener<ScrollNotification>(
            onNotification: _onScroll,
            child: GestureDetector(
              excludeFromSemantics: true,
              onTap: _unfocus,
              onVerticalDragStart: canDismiss ? (_) => _unfocus() : null,
              onVerticalDragUpdate:
                  canDismiss ? (d) => _drag.down(d.delta.dy) : null,
              onVerticalDragEnd: canDismiss ? _endDown : null,
              onHorizontalDragUpdate:
                  canGoBack ? (d) => _drag.back(d.delta.dx) : null,
              onHorizontalDragEnd: canGoBack ? _endBack : null,
              child: widget.child,
            ),
          ),
        ),
      ],
    );
  }
}
