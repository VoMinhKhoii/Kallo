import 'package:flutter/material.dart';

import '../../../../theme/calm_tokens.dart';
import '../../../../theme/kallo_motion.dart';
import '../../../../theme/kallo_theme.dart';

/// The white pill that marks the selected segment of a [SegmentedStrip], and
/// the motion that carries it there.
///
/// Its own widget because it is its own model: an [AnimationController], a
/// two-phase curve and a from/to pair that nothing outside it reads. The strip
/// places it and tells it which segment is live; everything about HOW it gets
/// there is in here.
///
/// **The thumb pops, then travels.** One controller runs the gesture: scale
/// 1.0 → [peakScale] over [KalloMotion.press] on [KalloEase.press], then the
/// slide over [KalloMotion.emphasis] on [KalloEase.decelerate], the scale
/// easing back underneath it. Both are PAINT-time transforms over a
/// statically-sized thumb, so no frame of the travel runs layout — where this
/// moved the thumb with an `AnimatedAlign` inside a `LayoutBuilder` (a track
/// relayout per frame) and its callers cross-faded a per-segment
/// `AnimatedContainer` instead of moving anything at all, which is what read
/// as a jump.
class SegmentedThumb extends StatefulWidget {
  const SegmentedThumb({
    required this.activeIndex,
    required this.count,
    super.key,
  });

  /// Never negative here — a strip with nothing selected omits the thumb
  /// entirely rather than parking it on a segment the user did not choose.
  final int activeIndex;
  final int count;

  static const double peakScale = 1.04;

  @override
  State<SegmentedThumb> createState() => _SegmentedThumbState();
}

class _SegmentedThumbState extends State<SegmentedThumb>
    with SingleTickerProviderStateMixin {
  // KalloMotion.press (the pop) then KalloMotion.emphasis (the travel).
  static final Duration _total = KalloMotion.press + KalloMotion.emphasis;
  static final double _popEnd =
      KalloMotion.press.inMilliseconds / _total.inMilliseconds;

  late final AnimationController _c;
  late double _from, _to;

  @override
  void initState() {
    super.initState();
    _c = AnimationController(vsync: this, duration: _total, value: 1);
    _from = _to = widget.activeIndex.toDouble();
  }

  @override
  void didUpdateWidget(SegmentedThumb old) {
    super.didUpdateWidget(old);
    if (widget.activeIndex == old.activeIndex) return;
    // Start from wherever the thumb actually is, so a second tap mid-travel
    // continues rather than teleporting back to the previous segment.
    _from = _position;
    _to = widget.activeIndex.toDouble();
    _c.forward(from: 0);
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  double get _position {
    final t = _c.value;
    if (t <= _popEnd) return _from;
    final p = KalloEase.decelerate.transform((t - _popEnd) / (1 - _popEnd));
    return _from + (_to - _from) * p;
  }

  double get _scale {
    final t = _c.value;
    final phase = t <= _popEnd
        ? KalloEase.press.transform(t / _popEnd)
        : 1 - KalloEase.standard.transform((t - _popEnd) / (1 - _popEnd));
    return 1 + (SegmentedThumb.peakScale - 1) * phase;
  }

  /// Sized once (one segment wide); after that, paint-time transforms only.
  /// FractionalTranslation counts in units of the thumb's own width, so the
  /// segment index IS the offset — no pixel measurement, no layout.
  @override
  Widget build(BuildContext context) => Positioned.fill(
    child: FractionallySizedBox(
      alignment: Alignment.centerLeft,
      widthFactor: 1 / widget.count,
      child: AnimatedBuilder(
        animation: _c,
        builder: (context, child) => FractionalTranslation(
          translation: Offset(_position, 0),
          child: Transform.scale(scale: _scale, child: child),
        ),
        child: const DecoratedBox(
          decoration: BoxDecoration(
            color: kCardSurface,
            borderRadius: BorderRadius.all(Radius.circular(KalloRadii.pill)),
            boxShadow: [KalloShadows.sm],
          ),
        ),
      ),
    ),
  );
}
