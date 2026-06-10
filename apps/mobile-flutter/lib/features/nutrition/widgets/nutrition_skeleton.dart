import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../theme/nham_colors.dart';

/// Single-column loading skeleton mirroring the mobile editorial stack.
/// RN port of `apps/mobile/src/components/nutrition/states/nutrition-skeleton.tsx`.
class NutritionSkeleton extends StatefulWidget {
  const NutritionSkeleton({super.key});

  @override
  State<NutritionSkeleton> createState() => _NutritionSkeletonState();
}

class _NutritionSkeletonState extends State<NutritionSkeleton>
    with SingleTickerProviderStateMixin {
  // Tailwind `animate-pulse`: opacity 1→.5→1, 2s, cubic-bezier(0.4,0,0.6,1),
  // infinite. A 1s reversing tween (1.0→0.5) with that ease gives the 2s loop.
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1000),
  )..repeat(reverse: true);

  late final Animation<double> _opacity = Tween<double>(
    begin: 1.0,
    end: 0.5,
  ).animate(
    CurvedAnimation(
      parent: _controller,
      curve: const Cubic(0.4, 0.0, 0.6, 1.0),
    ),
  );

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: tr('nutrition.loading'),
      child: FadeTransition(
        opacity: _opacity,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Editorial header.
            Container(
              padding: const EdgeInsets.only(bottom: 20),
              decoration: const BoxDecoration(
                border: Border(
                  bottom: BorderSide(color: NhamColors.borderHalf),
                ),
              ),
              child: const Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [_Bar(w: 128), SizedBox(height: 8), _Bar(w: 176)],
              ),
            ),
            const SizedBox(height: 48),

            // Daily rhythm card.
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(24),
                border: Border.all(color: NhamColors.borderSoft),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    crossAxisAlignment: CrossAxisAlignment.center,
                    children: [_Bar(w: 128, h: 40), _Bar(w: 120, h: 8)],
                  ),
                  const SizedBox(height: 20),
                  for (var i = 0; i < 4; i++) ...[
                    if (i > 0) const SizedBox(height: 12),
                    const Row(
                      crossAxisAlignment: CrossAxisAlignment.center,
                      children: [
                        _Bar(w: 64),
                        SizedBox(width: 12),
                        Expanded(child: _Bar(h: 4)),
                        SizedBox(width: 12),
                        _Bar(w: 44),
                      ],
                    ),
                  ],
                ],
              ),
            ),
            const SizedBox(height: 48),

            // Steady list.
            ClipRRect(
              borderRadius: BorderRadius.circular(16),
              child: DecoratedBox(
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: NhamColors.borderHalf),
                ),
                child: Column(
                  children: [
                    for (var i = 0; i < 5; i++)
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 16,
                          vertical: 12,
                        ),
                        decoration: const BoxDecoration(
                          border: Border(
                            bottom: BorderSide(color: NhamColors.borderFaint),
                          ),
                        ),
                        child: const Row(
                          crossAxisAlignment: CrossAxisAlignment.center,
                          children: [
                            _Dot(),
                            SizedBox(width: 12),
                            Expanded(child: _Bar(h: 12)),
                            SizedBox(width: 12),
                            _Bar(w: 44),
                          ],
                        ),
                      ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 48),

            // Background toggle.
            const Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [_Bar(w: 128), _Bar(w: 80)],
            ),
            const SizedBox(height: 48),

            // Pull-quote.
            IntrinsicHeight(
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Container(width: 3, color: NhamColors.accent30),
                  const SizedBox(width: 20),
                  const Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        _Bar(w: 96),
                        SizedBox(height: 8),
                        _Bar(),
                        SizedBox(height: 8),
                        _Bar(widthFactor: 0.8),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Bar extends StatelessWidget {
  const _Bar({this.w, this.h = 12, this.widthFactor});

  final double? w;
  final double h;
  final double? widthFactor;

  @override
  Widget build(BuildContext context) {
    final bar = Container(
      width: w,
      height: h,
      decoration: BoxDecoration(
        color: NhamColors.track,
        borderRadius: BorderRadius.circular(9999),
      ),
    );
    if (widthFactor != null) {
      return FractionallySizedBox(
        alignment: Alignment.centerLeft,
        widthFactor: widthFactor,
        child: bar,
      );
    }
    return bar;
  }
}

class _Dot extends StatelessWidget {
  const _Dot();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 6,
      height: 6,
      decoration: const BoxDecoration(
        color: NhamColors.track,
        shape: BoxShape.circle,
      ),
    );
  }
}
