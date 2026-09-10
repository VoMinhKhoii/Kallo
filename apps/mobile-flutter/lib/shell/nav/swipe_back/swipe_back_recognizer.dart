import 'package:flutter/gestures.dart';

/// A horizontal drag recognizer that only ever competes for a drag heading
/// BACK — rightward in LTR, leftward in RTL.
///
/// A back gesture is one-directional, so saying that to the gesture arena is
/// free protection: the recognizer rejects itself on the first move that goes
/// the other way (or that is more vertical than horizontal), and the pointer is
/// handed straight back to whatever else wanted it. Without this a plain
/// [HorizontalDragGestureRecognizer] would win an uncontested leftward drag and
/// then do nothing with it.
///
/// The rejection is decided on the FIRST move past [kTouchSlop], not on every
/// move: once a drag has been accepted as a back gesture the user is allowed to
/// drag it back and forth without the recognizer bailing out mid-flight.
class SwipeBackDragRecognizer extends HorizontalDragGestureRecognizer {
  SwipeBackDragRecognizer({super.debugOwner, required this.isRightToLeft});

  /// Which way "back" points. Read at pointer-down rather than stored, so a
  /// locale switch mid-session cannot leave it stale.
  final bool Function() isRightToLeft;

  final Map<int, Offset> _origins = <int, Offset>{};
  final Set<int> _decided = <int>{};

  @override
  void addAllowedPointer(PointerDownEvent event) {
    _origins[event.pointer] = event.position;
    _decided.remove(event.pointer);
    super.addAllowedPointer(event);
  }

  @override
  void handleEvent(PointerEvent event) {
    if (event is PointerMoveEvent && !_decided.contains(event.pointer)) {
      final origin = _origins[event.pointer];
      if (origin != null) {
        final delta = event.position - origin;
        if (delta.distance >= kTouchSlop) {
          _decided.add(event.pointer);
          final back = isRightToLeft() ? -delta.dx : delta.dx;
          if (back <= 0 || delta.dx.abs() <= delta.dy.abs()) {
            resolve(GestureDisposition.rejected);
            stopTrackingPointer(event.pointer);
            _forget(event.pointer);
            return;
          }
        }
      }
    }
    if (event is PointerUpEvent || event is PointerCancelEvent) {
      _forget(event.pointer);
    }
    super.handleEvent(event);
  }

  void _forget(int pointer) {
    _origins.remove(pointer);
    _decided.remove(pointer);
  }

  @override
  void dispose() {
    _origins.clear();
    _decided.clear();
    super.dispose();
  }

  @override
  String get debugDescription => 'swipe back';
}
