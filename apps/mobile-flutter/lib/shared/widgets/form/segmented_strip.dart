import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../theme/calm_tokens.dart';
import '../../../theme/kallo_colors.dart';
import '../../../theme/kallo_motion.dart';
import '../../../theme/kallo_theme.dart';
import 'option_strip.dart' show OptionStripItem;

/// The one mode-switch primitive — every segmented control draws through it,
/// via [OptionStrip.segmented] or directly.
///
/// **A rounded RECTANGLE, not a pill**: the beige [KalloColors.hover] track at
/// radius 12 under a white radius-8 thumb — the barcode amount switch's look,
/// promoted. The capsule the scan toggle used read as a second, unrelated
/// control on the same sheet. 36pt visual inside a 44pt tap target, two
/// layers, because a 44pt track makes a three-way picker button-tall.
///
/// **The thumb pops, then travels.** One controller runs the gesture: scale
/// 1.0 → 1.04 over [KalloMotion.press] on [KalloEase.press], then the slide
/// over [KalloMotion.emphasis] on [KalloEase.decelerate], the scale easing
/// back underneath it. Both are PAINT-time transforms over a statically-sized
/// thumb, so no frame of the travel runs layout — where this moved the thumb
/// with an `AnimatedAlign` inside a `LayoutBuilder` (a track relayout per
/// frame) and its callers cross-faded a per-segment `AnimatedContainer`
/// instead of moving anything at all, which is what read as a jump.
class SegmentedStrip extends StatefulWidget {
  const SegmentedStrip({
    super.key,
    required this.options,
    required this.activeIndex,
    required this.onChange,
  });

  final List<OptionStripItem> options;

  /// -1 when nothing is selected — the thumb is absent, not parked on a
  /// segment the user did not choose.
  final int activeIndex;
  final ValueChanged<String> onChange;

  static const double height = 36, target = 44, inset = 3;
  static const double thumbPeakScale = 1.04;

  @override
  State<SegmentedStrip> createState() => _SegmentedStripState();
}

class _SegmentedStripState extends State<SegmentedStrip>
    with SingleTickerProviderStateMixin {
  // KalloMotion.press (the pop) then KalloMotion.emphasis (the travel).
  static final Duration _total = KalloMotion.press + KalloMotion.emphasis;
  static final double _popEnd = KalloMotion.press.inMilliseconds /
      _total.inMilliseconds;

  // Built in initState, not lazily: a strip that never renders a thumb
  // (activeIndex -1) would otherwise first touch `_c` inside dispose().
  late final AnimationController _c;
  late double _from, _to;

  @override
  void initState() {
    super.initState();
    _c = AnimationController(vsync: this, duration: _total, value: 1);
    _from = _to = widget.activeIndex.toDouble();
  }

  @override
  void didUpdateWidget(SegmentedStrip old) {
    super.didUpdateWidget(old);
    if (widget.activeIndex == old.activeIndex) return;
    // Start from wherever the thumb actually is, so a second tap mid-travel
    // continues rather than teleporting back to the previous segment.
    _from = widget.activeIndex < 0 || old.activeIndex < 0 ? _to : _position;
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
    return 1 + (SegmentedStrip.thumbPeakScale - 1) * phase;
  }

  void _select(int index) {
    if (index == widget.activeIndex) return;
    HapticFeedback.selectionClick();
    widget.onChange(widget.options[index].value);
  }

  @override
  Widget build(BuildContext context) => SizedBox(
    height: SegmentedStrip.target,
    child: Stack(
      alignment: Alignment.center,
      children: [
        SizedBox(height: SegmentedStrip.height, child: _track()),
        // The tap layer spans the full 44 above the track, so a thumb tapped
        // near its top or bottom edge still registers.
        Row(
          children: [
            for (var i = 0; i < widget.options.length; i++)
              Expanded(child: _tapTarget(i)),
          ],
        ),
      ],
    ),
  );

  Widget _tapTarget(int i) => Semantics(
    button: true,
    selected: i == widget.activeIndex,
    excludeSemantics: true,
    label: widget.options[i].label,
    onTap: () => _select(i),
    child: GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: () => _select(i),
      child: const SizedBox(height: SegmentedStrip.target),
    ),
  );

  Widget _track() => Container(
    padding: const EdgeInsets.all(SegmentedStrip.inset),
    decoration: BoxDecoration(
      color: KalloColors.hover,
      borderRadius: BorderRadius.circular(KalloRadii.buttonXl),
    ),
    child: Stack(
      children: [
        if (widget.activeIndex >= 0) _thumb(),
        Row(
          children: [
            for (var i = 0; i < widget.options.length; i++)
              Expanded(child: _label(i)),
          ],
        ),
      ],
    ),
  );

  /// Sized once (one segment wide); after that, paint-time transforms only.
  /// FractionalTranslation counts in units of the thumb's own width, so the
  /// segment index IS the offset — no pixel measurement, no layout.
  Widget _thumb() => Positioned.fill(
    child: FractionallySizedBox(
      alignment: Alignment.centerLeft,
      widthFactor: 1 / widget.options.length,
      child: AnimatedBuilder(
        animation: _c,
        builder: (context, child) => FractionalTranslation(
          translation: Offset(_position, 0),
          child: Transform.scale(scale: _scale, child: child),
        ),
        child: const DecoratedBox(
          decoration: BoxDecoration(
            color: kCardSurface,
            borderRadius: BorderRadius.all(Radius.circular(KalloRadii.md)),
            boxShadow: [KalloShadows.sm],
          ),
        ),
      ),
    ),
  );

  /// Ink on the active segment, muted beside it — colour marks the selection,
  /// never weight. Only the colour animates, so the paragraph repaints rather
  /// than re-measuring; [FittedBox] shrinks the longest label at the top of
  /// the Dynamic Type range instead of clipping it.
  Widget _label(int i) => Center(
    child: TweenAnimationBuilder<Color?>(
      duration: KalloMotion.quick,
      curve: KalloEase.standard,
      tween: ColorTween(end: i == widget.activeIndex ? kInk : kInkMuted),
      builder: (context, color, child) => FittedBox(
        fit: BoxFit.scaleDown,
        child: Text(
          widget.options[i].label,
          maxLines: 1,
          softWrap: false,
          style: dashBody(color: color ?? kInkMuted),
        ),
      ),
    ),
  );
}
