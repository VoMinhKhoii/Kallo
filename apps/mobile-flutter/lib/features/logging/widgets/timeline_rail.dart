import 'package:flutter/material.dart';

import '../../../theme/nham_colors.dart';

/// The shared feed timeline decoration drawn in the left gutter beside each
/// card: a vertical hairline (hidden on the last item) and an accent ring dot.
///
/// On the web mobile view the rail sits at `-left-4` (16px, line) and
/// `-left-5` (20px, dot) relative to the card, inside the feed's `pl-6` (24px)
/// left gutter (the `-left-10`/`-left-[43px]` values are the sm: desktop
/// positions). We reproduce the mobile pixel offsets with [Positioned] children
/// in a [Stack] that the card sits inside.
class TimelineRail extends StatelessWidget {
  const TimelineRail({
    super.key,
    required this.child,
    this.isLast = false,
    this.dotChild,
  });

  final Widget child;
  final bool isLast;

  /// Optional override for the dot (the streaming entry pulses it).
  final Widget? dotChild;

  @override
  Widget build(BuildContext context) {
    return Stack(
      clipBehavior: Clip.none,
      children: [
        // Vertical line: top 8 (top-2), bottom 0, width 1px, border/60.
        if (!isLast)
          const Positioned(
            top: 8,
            bottom: 0,
            left: -16, // mobile -left-4
            child: SizedBox(
              width: 1,
              child: ColoredBox(color: NhamColors.borderSoft),
            ),
          ),
        // Accent ring dot: top 8, h-2 w-2, 2px accent border, white fill.
        Positioned(
          top: 8,
          left: -20, // mobile -left-5
          child: dotChild ?? const _Dot(),
        ),
        child,
      ],
    );
  }
}

class _Dot extends StatelessWidget {
  const _Dot();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 8,
      height: 8,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: NhamColors.elev,
        border: Border.all(color: NhamColors.accent, width: 2),
      ),
    );
  }
}

/// The accent dot styled for re-use (e.g. the streaming entry's pulsing dot).
class TimelineDot extends StatelessWidget {
  const TimelineDot({super.key});

  @override
  Widget build(BuildContext context) => const _Dot();
}
