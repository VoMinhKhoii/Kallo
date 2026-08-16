import 'package:flutter/material.dart';

import '../../theme/kallo_colors.dart';

/// RN port of `apps/mobile/src/components/shared/target-progress-bar.tsx`.
///
/// A 4px (h-1) track with an animated fill (width 0 → clamp(pct, 0, 100)%) and a
/// fixed end-tick marking the 100% target. The fill animates with a cubic-out
/// ease over [duration], staggered by [delay].
class TargetProgressBar extends StatefulWidget {
  const TargetProgressBar({
    super.key,
    required this.percentOfTarget,
    required this.showExceed,
    this.duration = const Duration(milliseconds: 700),
    this.delay = Duration.zero,
    this.semanticLabel,
    this.fillColor,
  });

  /// Current percent toward target (0..100+); null when no target is set.
  final double? percentOfTarget;

  /// Whether to switch to the danger color (e.g. ceiling exceeded).
  final bool showExceed;

  /// Fill animation duration.
  final Duration duration;

  /// Fill animation delay — staggers the fill after the row enters.
  final Duration delay;

  final String? semanticLabel;

  /// Overrides the resting fill color (e.g. emerald on an on-target card). The
  /// exceed (danger) and no-value (stone) colors still take precedence.
  final Color? fillColor;

  @override
  State<TargetProgressBar> createState() => _TargetProgressBarState();
}

class _TargetProgressBarState extends State<TargetProgressBar>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: widget.duration,
  );
  late Animation<double> _fill = _buildAnimation();

  bool get _hasValue => widget.percentOfTarget != null;

  double get _targetFill {
    if (!_hasValue) return 0;
    return widget.percentOfTarget!.clamp(0, 100).toDouble();
  }

  Animation<double> _buildAnimation() {
    return Tween<double>(begin: 0, end: _targetFill).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeOutCubic),
    );
  }

  void _run() {
    _controller.reset();
    _fill = _buildAnimation();
    if (widget.delay == Duration.zero) {
      _controller.forward();
    } else {
      Future.delayed(widget.delay, () {
        if (mounted) _controller.forward();
      });
    }
  }

  @override
  void initState() {
    super.initState();
    _run();
  }

  @override
  void didUpdateWidget(TargetProgressBar oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.percentOfTarget != widget.percentOfTarget) {
      _controller.duration = widget.duration;
      _run();
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final fillColor = !_hasValue
        ? KalloColors.stone50
        : widget.showExceed
            ? KalloColors.offTarget
            : widget.fillColor ?? KalloColors.text;

    final bar = LayoutBuilder(
      builder: (context, constraints) {
        final fullWidth = constraints.maxWidth;
        return SizedBox(
          // h-1 track lives in a row that also carries the -3px-offset tick;
          // 7px tall covers the tick that sits 3px above the 4px track.
          height: 7,
          child: Stack(
            clipBehavior: Clip.none,
            children: [
              // Track — vertically centered 4px rounded bar.
              Positioned.fill(
                child: Center(
                  child: Container(
                    height: 4,
                    decoration: BoxDecoration(
                      color: KalloColors.track,
                      borderRadius: BorderRadius.circular(9999),
                    ),
                  ),
                ),
              ),
              // Animated fill.
              Positioned.fill(
                child: Center(
                  child: AnimatedBuilder(
                    animation: _fill,
                    builder: (context, child) {
                      return Align(
                        alignment: Alignment.centerLeft,
                        child: Container(
                          height: 4,
                          width: fullWidth * (_fill.value / 100),
                          decoration: BoxDecoration(
                            color: fillColor,
                            borderRadius: BorderRadius.circular(9999),
                          ),
                        ),
                      );
                    },
                  ),
                ),
              ),
              // End-tick at the 100% mark: 1px wide, 7px tall, sits at top -3.
              if (_hasValue)
                Positioned(
                  right: 0,
                  top: 0,
                  width: 1,
                  height: 7,
                  child: ColoredBox(
                    color: widget.showExceed
                        ? KalloColors.offTarget70
                        : KalloColors.stone70,
                  ),
                ),
            ],
          ),
        );
      },
    );

    if (widget.semanticLabel == null) return bar;
    return Semantics(
      label: widget.semanticLabel,
      value: _hasValue ? '${_targetFill.round()}%' : null,
      child: bar,
    );
  }
}
