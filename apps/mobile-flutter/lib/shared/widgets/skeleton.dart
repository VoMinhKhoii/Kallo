/// Skeleton loading primitives — a calm fade-pulse over placeholder blocks.
///
/// These draw warm `KalloColors.track` placeholder bars and pulse them under one
/// shared controller, so a loading state previews its own shape. The pulse
/// (opacity 1.0↔0.5 on a 1000ms reversing controller, `cubic-bezier(0.4,0,0.6,1)`
/// ease — Flutter's take on Tailwind `animate-pulse`) matches the nutrition ref.
library;

import 'package:flutter/material.dart';

import '../../theme/calm_tokens.dart';
import '../../theme/kallo_colors.dart';

/// Marker letting a nested [SkeletonPulse] inherit an ancestor's pulse.
class _PulseScope extends InheritedWidget {
  const _PulseScope({required super.child});

  @override
  bool updateShouldNotify(_PulseScope oldWidget) => false;
}

/// Wraps [child] in a fade-pulse; a tree of [SkeletonBar] / [SkeletonCircle]
/// under it all pulse from one controller. Nested [SkeletonPulse]s collapse into
/// the outermost (inheriting its pulse), so one outer pulse keeps siblings in phase.
class SkeletonPulse extends StatefulWidget {
  const SkeletonPulse({super.key, required this.child});
  final Widget child;

  @override
  State<SkeletonPulse> createState() => _SkeletonPulseState();
}

class _SkeletonPulseState extends State<SkeletonPulse>
    with SingleTickerProviderStateMixin {
  // Created lazily so the reduced-motion and nested-in-_PulseScope paths (which
  // return early without rendering the pulse) never spin up a controller.
  AnimationController? _c;
  Animation<double>? _opacity;

  @override
  void dispose() {
    _c?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    // Honor reduced-motion: hold a static base tint, no pulse (and no scope).
    if (MediaQuery.disableAnimationsOf(context)) return widget.child;
    // An ancestor pulse already drives this subtree — reuse it, don't drift.
    if (context.dependOnInheritedWidgetOfExactType<_PulseScope>() != null) {
      return widget.child;
    }
    // Tailwind `animate-pulse`: opacity 1→.5→1, 2s, cubic-bezier(0.4,0,0.6,1),
    // infinite. A 1s reversing tween (1.0→0.5) with that ease gives the 2s loop.
    // Build can run repeatedly — memoize so the controller is made only once.
    final opacity = _opacity ??= Tween<double>(begin: 1.0, end: 0.5).animate(
      CurvedAnimation(
        parent: _c ??= AnimationController(
          vsync: this,
          duration: const Duration(milliseconds: 1000),
        )..repeat(reverse: true),
        curve: const Cubic(0.4, 0.0, 0.6, 1.0),
      ),
    );
    return _PulseScope(
      child: FadeTransition(opacity: opacity, child: widget.child),
    );
  }
}

/// A placeholder bar. [widthFactor] (0–1) sizes it to its parent when null [width].
class SkeletonBar extends StatelessWidget {
  const SkeletonBar({
    super.key,
    this.width,
    this.widthFactor,
    required this.height,
    this.radius = 6,
  });

  final double? width;
  final double? widthFactor;
  final double height;
  final double radius;

  @override
  Widget build(BuildContext context) {
    final bar = Container(
      width: width,
      height: height,
      decoration: BoxDecoration(
        color: KalloColors.track,
        borderRadius: BorderRadius.circular(radius),
      ),
    );
    if (width == null && widthFactor != null) {
      return FractionallySizedBox(
        alignment: Alignment.centerLeft,
        widthFactor: widthFactor,
        child: bar,
      );
    }
    return bar;
  }
}

class SkeletonCircle extends StatelessWidget {
  const SkeletonCircle({super.key, required this.size});
  final double size;

  @override
  Widget build(BuildContext context) => Container(
        width: size,
        height: size,
        decoration: const BoxDecoration(
          color: KalloColors.track,
          shape: BoxShape.circle,
        ),
      );
}

/// A white card matching the real dashboard cards, holding skeleton [children].
/// The pulse wraps only the bars (not the card surface) so white gaps stay white.
class SkeletonCard extends StatelessWidget {
  const SkeletonCard({super.key, required this.children});
  final List<Widget> children;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: kCardSurface,
          borderRadius: BorderRadius.circular(kCardRadius),
          boxShadow: kCardShadows,
        ),
        child: SkeletonPulse(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: children,
          ),
        ),
      );
}

/// An out-of-card eyebrow placeholder (matches the section headers).
class SkeletonHeader extends StatelessWidget {
  const SkeletonHeader({super.key});
  @override
  Widget build(BuildContext context) => const Padding(
        padding: EdgeInsets.only(bottom: 8),
        child: SkeletonPulse(
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              SkeletonBar(width: 120, height: 11, radius: 4),
              SkeletonBar(width: 52, height: 11, radius: 4),
            ],
          ),
        ),
      );
}
