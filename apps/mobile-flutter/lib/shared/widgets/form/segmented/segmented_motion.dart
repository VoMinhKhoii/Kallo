import 'package:flutter/physics.dart';
import 'package:flutter/widgets.dart';

/// The two springs behind a [SegmentedStrip]'s thumb: where it is, and how
/// big it is.
///
/// Both are `UISegmentedControl`'s own, as measured for Flutter's Cupertino
/// port (`cupertino/sliding_segmented_control.dart`, Flutter 3.44: stiffness
/// 503.551, damping 44.8799, the thumb held at 95%). A new target restarts the
/// spring from wherever the thumb is, at rest, so a second tap mid-slide
/// carries on rather than jumping. The slide starts on the frame of the
/// change: iOS has no beat before the thumb moves.
///
/// The spring is critically damped, so the thumb never lands past its
/// segment and swings back.
class SegmentedMotion extends StatefulWidget {
  const SegmentedMotion({
    required this.index,
    required this.held,
    required this.builder,
    super.key,
  });

  /// The segment the thumb is on or sliding to. Never negative.
  final int index;

  /// A finger is on the thumb: it shrinks to [heldScale] until let go.
  final bool held;

  /// [position] counts in segments (1.5 is halfway between the second and
  /// third); [scale] is 1 at rest.
  final Widget Function(BuildContext context, double position, double scale)
  builder;

  static const double heldScale = 0.95;

  static const SpringDescription spring = SpringDescription(
    mass: 1,
    stiffness: 503.551,
    damping: 44.8799,
  );

  /// Long enough for [spring] to come to rest — UIKit's fixed 0.412s.
  static const Duration settle = Duration(milliseconds: 412);

  @override
  State<SegmentedMotion> createState() => _SegmentedMotionState();
}

class _SegmentedMotionState extends State<SegmentedMotion>
    with TickerProviderStateMixin {
  // Unbounded: each runs a 0 → 1 spring, and the controller must not clamp
  // the last float step of one.
  late final _slide = AnimationController.unbounded(vsync: this, value: 1);
  late final _press = AnimationController.unbounded(vsync: this, value: 1);
  late double _from, _to;
  double _scaleFrom = 1, _scaleTo = 1;

  @override
  void initState() {
    super.initState();
    _from = _to = widget.index.toDouble();
  }

  @override
  void didUpdateWidget(SegmentedMotion old) {
    super.didUpdateWidget(old);
    if (widget.index != old.index) {
      _from = _position;
      _to = widget.index.toDouble();
      _run(_slide);
    }
    if (widget.held != old.held) {
      _scaleFrom = _scale;
      _scaleTo = widget.held ? SegmentedMotion.heldScale : 1;
      _run(_press);
    }
  }

  void _run(AnimationController c) {
    c.value = 0;
    c.animateWith(SpringSimulation(SegmentedMotion.spring, 0, 1, 0));
  }

  double get _position => _from + (_to - _from) * _slide.value;
  double get _scale => _scaleFrom + (_scaleTo - _scaleFrom) * _press.value;

  @override
  void dispose() {
    _slide.dispose();
    _press.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AnimatedBuilder(
    animation: Listenable.merge([_slide, _press]),
    builder: (context, _) => widget.builder(context, _position, _scale),
  );
}
