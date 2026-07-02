/// Skeleton loading primitives — a warm shimmer sweep over placeholder blocks.
///
/// Modern apps show the *shape* of the content while it loads (a skeleton),
/// not a centered spinner. These primitives draw warm-grey placeholder bars and
/// run one shared shimmer animation across them, so the dashboard's loading
/// state previews its own layout instead of a blank wait.
library;

import 'package:flutter/material.dart';

import '../../../theme/calm_tokens.dart';

const Color _skelBase = Color(0xFFE0D6C2); // warm placeholder grey
const Color _skelHi = Color(0xFFF1EADC); // shimmer highlight

/// Wraps [child] in a left-to-right shimmer sweep. Put a tree of [SkeletonBar] /
/// [SkeletonCircle] underneath and they all light up from the one controller.
class Shimmer extends StatefulWidget {
  const Shimmer({super.key, required this.child});
  final Widget child;

  @override
  State<Shimmer> createState() => _ShimmerState();
}

class _ShimmerState extends State<Shimmer> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1300),
  )..repeat();

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    // Honor reduced-motion: hold a static base tint, no sweep.
    if (MediaQuery.disableAnimationsOf(context)) return widget.child;
    return AnimatedBuilder(
      animation: _c,
      builder: (context, child) {
        final t = _c.value; // 0 → 1
        return ShaderMask(
          blendMode: BlendMode.srcATop,
          shaderCallback: (bounds) {
            final dx = bounds.width * (t * 2 - 1); // sweep -w → +w
            return LinearGradient(
              begin: Alignment.centerLeft,
              end: Alignment.centerRight,
              colors: const [_skelBase, _skelHi, _skelBase],
              stops: const [0.35, 0.5, 0.65],
              transform: _SlideGradient(dx),
            ).createShader(bounds);
          },
          child: child,
        );
      },
      child: widget.child,
    );
  }
}

/// Shifts a gradient horizontally by [dx] pixels (for the shimmer sweep).
class _SlideGradient extends GradientTransform {
  const _SlideGradient(this.dx);
  final double dx;
  @override
  Matrix4 transform(Rect bounds, {TextDirection? textDirection}) =>
      Matrix4.translationValues(dx, 0, 0);
}

/// A single placeholder bar. [widthFactor] (0–1) sizes it relative to its parent
/// when [width] is null.
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
        color: _skelBase,
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
          color: _skelBase,
          shape: BoxShape.circle,
        ),
      );
}

/// A white card matching the real dashboard cards, holding skeleton [children].
/// The shimmer wraps only the bars (not the card surface) so the white gaps
/// stay white and the bars read as distinct placeholders.
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
        child: Shimmer(
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
        child: Shimmer(
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

/// Inner placeholder rows for the Today card — hero + ring, three macro rows, a
/// divider gap, two meal rows. Mirrors the real card so the swap is calm. Used
/// inside a [SkeletonCard] (dashboard load) or directly under the card during a
/// per-day refetch.
List<Widget> todayCardSkeletonChildren() => [
      const Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                SkeletonBar(width: 140, height: 34, radius: 8),
                SizedBox(height: 8),
                SkeletonBar(width: 90, height: 12, radius: 4),
              ],
            ),
          ),
          SkeletonCircle(size: 84),
        ],
      ),
      const SizedBox(height: 22),
      for (var i = 0; i < 3; i++) ...[
        if (i > 0) const SizedBox(height: 12),
        const Row(
          children: [
            SkeletonBar(width: 56, height: 11, radius: 4),
            SizedBox(width: 12),
            Expanded(child: SkeletonBar(height: 8, radius: 4)),
            SizedBox(width: 12),
            SkeletonBar(width: 48, height: 11, radius: 4),
          ],
        ),
      ],
      const SizedBox(height: 22),
      const SkeletonBar(widthFactor: 0.7, height: 13, radius: 4),
      const SizedBox(height: 12),
      const SkeletonBar(widthFactor: 0.55, height: 13, radius: 4),
    ];

/// Inner placeholder rows for the Weight card — hero + stat, input field,
/// chart band.
List<Widget> weightCardSkeletonChildren() => const [
      Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SkeletonBar(width: 110, height: 34, radius: 8),
          SkeletonBar(width: 56, height: 22, radius: 6),
        ],
      ),
      SizedBox(height: 16),
      SkeletonBar(height: 52, radius: 14),
      SizedBox(height: 16),
      SkeletonBar(height: 96, radius: 10),
    ];

/// The Today card placeholder (header + card), under one shimmer.
class TodayCardSkeleton extends StatelessWidget {
  const TodayCardSkeleton({super.key});
  @override
  Widget build(BuildContext context) =>
      SkeletonCard(children: todayCardSkeletonChildren());
}

/// The Weight card placeholder (header + card), under one shimmer.
class WeightCardSkeleton extends StatelessWidget {
  const WeightCardSkeleton({super.key});
  @override
  Widget build(BuildContext context) =>
      SkeletonCard(children: weightCardSkeletonChildren());
}
