import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../../shared/widgets/feedback/skeleton.dart';
import '../../../../theme/calm_tokens.dart';
import '../../../../theme/kallo_theme.dart';

/// The nutrition page's silhouette while the overview loads: the calorie card
/// with its chart, the macro rows, and one group of nutrient rows.
///
/// It mirrors the page it stands in for and nothing else. The old skeleton
/// still drew an editorial stack — a pull-quote, a background toggle, a
/// hairline-ruled header — from a layout the screen had already left behind, so
/// the load state promised a page that never arrived.
class NutritionSkeleton extends StatelessWidget {
  const NutritionSkeleton({super.key});

  static const double _gap = KalloSpacing.sp3;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: tr('nutrition.loading'),
      child: SkeletonPulse(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Section header + its meta.
            const Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                SkeletonBar(width: 88, height: 17, radius: 9999),
                SkeletonBar(width: 140, height: 12, radius: 9999),
              ],
            ),
            const SizedBox(height: _gap),
            // Calorie card: hero + scope switch, date span, chart.
            const _Card(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      SkeletonBar(width: 128, height: 40, radius: 9999),
                      SkeletonBar(width: 72, height: 12, radius: 9999),
                    ],
                  ),
                  SizedBox(height: 8),
                  SkeletonBar(width: 112, height: 12, radius: 9999),
                  SizedBox(height: _gap),
                  SkeletonBar(height: 140, radius: 12),
                ],
              ),
            ),
            const SizedBox(height: _gap),
            // Macro rows.
            _Card(child: _rows(3, leadingGlyph: true)),
            const SizedBox(height: _gap),
            const Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                SkeletonBar(width: 96, height: 17, radius: 9999),
                SkeletonBar(width: 76, height: 12, radius: 9999),
              ],
            ),
            const SizedBox(height: _gap),
            _Card(child: _rows(4, leadingGlyph: false)),
          ],
        ),
      ),
    );
  }

  /// A card of 56pt data rows: name + figure on one line, bar under them.
  Widget _rows(int count, {required bool leadingGlyph}) {
    return Column(
      children: [
        for (var i = 0; i < count; i++)
          SizedBox(
            height: 56,
            child: Row(
              children: [
                if (leadingGlyph) ...[
                  const SkeletonCircle(size: KalloIcons.size),
                  const SizedBox(width: _gap),
                ],
                const Expanded(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Row(
                        children: [
                          SkeletonBar(width: 64, height: 14, radius: 9999),
                          Spacer(),
                          SkeletonBar(width: 88, height: 12, radius: 9999),
                        ],
                      ),
                      SizedBox(height: KalloSpacing.sp1_5),
                      SkeletonBar(height: 3, radius: 9999),
                    ],
                  ),
                ),
              ],
            ),
          ),
      ],
    );
  }
}

/// The page's card shell — white, radius 22, no border and no shadow.
class _Card extends StatelessWidget {
  const _Card({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: KalloSpacing.sp4,
        vertical: KalloSpacing.sp3,
      ),
      decoration: BoxDecoration(
        color: kCardSurface,
        borderRadius: BorderRadius.circular(kCardRadius),
      ),
      child: child,
    );
  }
}
