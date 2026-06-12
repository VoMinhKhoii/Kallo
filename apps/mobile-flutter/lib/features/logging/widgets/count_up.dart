import 'package:flutter/material.dart';

import '../../../shared/widgets/nham_text.dart';

/// Counts a number up from [from] to [value] over [duration] on first build
/// (and re-counts whenever [value] changes), formatting each frame with [format].
///
/// Used by the streaming-reveal morph so the totals row settles into place
/// instead of popping — the emotional peak of the analysis landing.
class CountUpText extends StatefulWidget {
  const CountUpText({
    super.key,
    required this.value,
    required this.format,
    this.from = 0,
    this.duration = const Duration(milliseconds: 600),
    this.curve = Curves.easeOut,
    this.variant = NhamTextVariant.body,
    this.style,
    this.enabled = true,
  });

  final double value;
  final String Function(double) format;
  final double from;
  final Duration duration;
  final Curve curve;
  final NhamTextVariant variant;
  final TextStyle? style;

  /// When false the value renders directly with no animation (reduced motion /
  /// non-reveal contexts).
  final bool enabled;

  @override
  State<CountUpText> createState() => _CountUpTextState();
}

class _CountUpTextState extends State<CountUpText>
    with SingleTickerProviderStateMixin {
  late final AnimationController _c =
      AnimationController(vsync: this, duration: widget.duration);
  late Animation<double> _anim = _build(widget.from, widget.value);

  Animation<double> _build(double from, double to) =>
      Tween<double>(begin: from, end: to)
          .chain(CurveTween(curve: widget.curve))
          .animate(_c);

  @override
  void initState() {
    super.initState();
    if (widget.enabled) {
      _c.forward();
    } else {
      _c.value = 1;
    }
  }

  @override
  void didUpdateWidget(CountUpText old) {
    super.didUpdateWidget(old);
    if (old.value != widget.value) {
      _anim = _build(_anim.value, widget.value);
      _c
        ..reset()
        ..forward();
    }
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (!widget.enabled) {
      return NhamText(widget.format(widget.value),
          variant: widget.variant, style: widget.style);
    }
    return AnimatedBuilder(
      animation: _anim,
      builder: (context, _) => NhamText(
        widget.format(_anim.value),
        variant: widget.variant,
        style: widget.style,
      ),
    );
  }
}
