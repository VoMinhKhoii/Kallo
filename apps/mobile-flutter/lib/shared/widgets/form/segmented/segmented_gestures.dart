import 'dart:math' as math;

import 'package:flutter/widgets.dart';

/// Reads a finger on a [SegmentedStrip] the way `UISegmentedControl` does
/// (the touch rules Flutter's Cupertino port measured from the system
/// control):
///
/// - A tap on another segment chooses it.
/// - A finger that comes down on the THUMB holds it ([onHold]); dragging then
///   slides it across segments ([onSlide]), and letting go chooses where it
///   is. Nothing is chosen while the finger is still down.
/// - A finger anywhere else marks the segment under it as pressed
///   ([onPressed]). Sliding off to another segment moves the mark, and
///   sliding well clear of the control drops it, so lifting there does nothing.
///
/// Reports only; the strip owns what each one looks like.
class SegmentedGestures extends StatefulWidget {
  const SegmentedGestures({
    required this.count,
    required this.thumb,
    required this.onPressed,
    required this.onHold,
    required this.onSlide,
    required this.onSelect,
    required this.child,
    super.key,
  });

  final int count;

  /// The segment the thumb is on; -1 when there is none.
  final int thumb;
  final ValueChanged<int?> onPressed;
  final ValueChanged<bool> onHold;
  final ValueChanged<int> onSlide;
  final ValueChanged<int> onSelect;
  final Widget child;

  /// How far outside the control (squared, in points) a finger may stray
  /// before its press is dropped — the port's estimate, 50pt.
  static const double _strayLimit = 50.0 * 50.0;

  @override
  State<SegmentedGestures> createState() => _SegmentedGesturesState();
}

class _SegmentedGesturesState extends State<SegmentedGestures> {
  bool _onThumb = false;
  int? _pressed;

  int _segmentAt(Offset p) {
    final width = context.size!.width;
    return (p.dx / width * widget.count).floor().clamp(0, widget.count - 1);
  }

  bool _strayed(Offset p) {
    final size = context.size!;
    final dx = math.max(0.0, (p.dx - size.width / 2).abs() - size.width / 2);
    final dy = math.max(0.0, (p.dy - size.height / 2).abs() - size.height / 2);
    return dx * dx + dy * dy > SegmentedGestures._strayLimit;
  }

  void _press(int? i) {
    _pressed = i;
    widget.onPressed(i);
  }

  void _down(DragDownDetails d) {
    final i = _segmentAt(d.localPosition);
    _onThumb = i == widget.thumb;
    _press(i);
    if (_onThumb) widget.onHold(true);
  }

  void _update(DragUpdateDetails d) {
    final i = _segmentAt(d.localPosition);
    if (_onThumb) {
      _press(i);
      widget.onSlide(i);
    } else {
      _press(_strayed(d.localPosition) ? null : i);
    }
  }

  void _end(DragEndDetails _) {
    if (_onThumb) {
      widget.onHold(false);
      widget.onSelect(widget.thumb);
    } else if (_pressed != null) {
      widget.onSelect(_pressed!);
    }
    _reset();
  }

  /// Also how a tap arrives: the tap wins the arena, which cancels the drag
  /// before [_tapUp] runs.
  void _cancel() {
    if (_onThumb) widget.onHold(false);
    _reset();
  }

  void _reset() {
    _onThumb = false;
    _press(null);
  }

  void _tapUp(TapUpDetails d) {
    _press(null);
    widget.onSelect(_segmentAt(d.localPosition));
  }

  @override
  Widget build(BuildContext context) => GestureDetector(
    behavior: HitTestBehavior.opaque,
    onTapUp: _tapUp,
    onHorizontalDragDown: _down,
    onHorizontalDragUpdate: _update,
    onHorizontalDragEnd: _end,
    onHorizontalDragCancel: _cancel,
    child: widget.child,
  );
}
