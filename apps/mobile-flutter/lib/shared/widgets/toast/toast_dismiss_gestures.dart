import 'package:flutter/widgets.dart';

/// The two gestures an iOS notification banner answers to, and the rules
/// behind them.
///
/// Its own file because the gestures are a whole concept with three
/// non-obvious rules, and [TopToast] is about arriving, dwelling and leaving.
/// Only the ACTION variant ever mounts this: a passive toast stays inside an
/// `IgnorePointer` so it can never eat the press meant for a button beneath
/// it, and it leaves on its own anyway.
class ToastDismissGestures extends StatefulWidget {
  const ToastDismissGestures({
    super.key,
    required this.child,
    required this.onHold,
    required this.onRelease,
    required this.onFlickAway,
  });

  final Widget child;

  /// A finger landed — stop the dwell so the toast cannot expire under it.
  final VoidCallback onHold;

  /// The LAST finger left. Not called while another is still down.
  final VoidCallback onRelease;

  /// An upward throw past [_flickAway].
  final VoidCallback onFlickAway;

  @override
  State<ToastDismissGestures> createState() => _ToastDismissGesturesState();
}

class _ToastDismissGesturesState extends State<ToastDismissGestures> {
  /// Upward flick velocity, in logical px/s, that counts as "throw it away".
  ///
  /// Private and local on purpose: a gesture-commit velocity is a different
  /// token family from `KalloMotion`'s durations and curves. The moment a
  /// second surface needs one it belongs beside
  /// `BackSwipe.minFlingWidthsPerSecond`, which exists precisely because this
  /// question was once answered twice in incompatible units.
  static const double _flickAway = 320;

  /// Fingers currently down. A second finger lifting must not restart the
  /// dwell while the first is still on the pill.
  int _fingers = 0;

  void _down(PointerDownEvent _) {
    _fingers++;
    widget.onHold();
  }

  /// Both `onPointerUp` AND `onPointerCancel` land here, and the cancel case
  /// is the one that matters. A cancelled pointer delivers no up event, so
  /// routing only `up` left the dwell cancelled forever: the toast pinned to
  /// the top of the screen, the future it completes never resolved, and the
  /// meal delete awaiting that future (`meal_actions.dart`) never fired — the
  /// row hidden locally and alive on the server until the next refetch.
  void _up(PointerEvent _) {
    if (_fingers > 0) _fingers--;
    if (_fingers > 0) return;
    widget.onRelease();
  }

  /// Upward throw dismisses, the way a notification banner does.
  ///
  /// Downward is ignored, but NOT — as an earlier comment claimed — to let a
  /// page scroll through. It cannot: `_RenderTheatre.hitTestChildren` stops at
  /// the first overlay child that reports a hit, so a touch on the pill never
  /// reaches the page at all. Ignoring downward simply declines to act on a
  /// gesture that is far more likely to be a mis-started scroll than an
  /// intent to dismiss.
  void _dragEnd(DragEndDetails d) {
    final v = d.primaryVelocity;
    if (v != null && v < -_flickAway) widget.onFlickAway();
  }

  @override
  Widget build(BuildContext context) => Listener(
    onPointerDown: _down,
    onPointerUp: _up,
    onPointerCancel: _up,
    child: GestureDetector(onVerticalDragEnd: _dragEnd, child: widget.child),
  );
}
