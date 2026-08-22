import 'package:flutter/material.dart';

import '../../../../../theme/kallo_colors.dart';
import '../../../../../theme/kallo_theme.dart';
import '../../../../../shared/widgets/gauge/calorie_dial.dart';
import '../../../../../shared/widgets/gauge/macro_dial_row.dart';
import '../../../../../shared/widgets/gauge/rounded_gauge_arc.dart';
import '../../../logic/logging_spacing.dart';
import 'pulse.dart';

// ── Loading / error states ──────────────────────────────────────────────

/// Macro header skeleton: the dial row's own silhouette — one wide mark for
/// the calorie dial, three narrow ones for the macros, each a pill the height
/// the arc draws at.
///
/// Shaped like what it stands in for, so the header does not visibly change
/// layout when the day arrives. The tile grid this replaced matched nothing
/// that had ever rendered here.
class MacroSummarySkeleton extends StatelessWidget {
  const MacroSummarySkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    Widget pill(double width, double height) =>
        skeletonBar(width, height, KalloColors.track);

    return Pulse(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          pill(
            kCompactCalorieDialRadius * 2,
            gaugeHeight(kCompactCalorieDialRadius),
          ),
          const SizedBox(width: KalloSpacing.sp3),
          Expanded(
            child: Row(
              children: [
                for (var i = 0; i < 3; i++) ...[
                  if (i > 0) const SizedBox(width: KalloSpacing.sp2),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.center,
                      children: [
                        pill(44, 11),
                        const SizedBox(height: KalloSpacing.sp0_5),
                        pill(
                          kCompactMacroDialRadius * 2,
                          gaugeHeight(kCompactMacroDialRadius),
                        ),
                      ],
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Day-loading skeleton: 2 pulsing full-width ghost cards, each with a time
/// bar, a title bar, 3 text lines, and a hairline-topped totals row
/// (LoggingDaySkeleton).
class LoggingDaySkeleton extends StatelessWidget {
  const LoggingDaySkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    // The last ghost drops its trailing gap, the way the real list's separator
    // sits only BETWEEN cards — otherwise the skeleton is one block taller
    // than the day it stands in for, and the swap to real data jumps.
    Widget ghostCard(bool isLast) => Padding(
      padding: EdgeInsets.only(bottom: isLast ? 0 : LoggingSpacing.block),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          skeletonBar(64, 12, KalloColors.border70), // border/70 time bar
          const SizedBox(height: KalloSpacing.sp2), // mb-2
          Container(
            padding: const EdgeInsets.all(KalloSpacing.sp4), // p-5→16
            decoration: BoxDecoration(
              color: const Color(0x33F0EAE0), // bg-kallo-hover/20
              borderRadius: BorderRadius.circular(KalloRadii.containerLg), // 2xl
              border: Border.all(color: KalloColors.borderSoft), // /60
              boxShadow: const [KalloShadows.sm],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                LayoutBuilder(
                  builder:
                      (_, c) => skeletonBar(
                        c.maxWidth * 2 / 3,
                        20,
                        KalloColors.border70,
                      ),
                ),
                const SizedBox(height: KalloSpacing.sp4), // mb-4
                LayoutBuilder(
                  builder:
                      (_, c) =>
                          skeletonBar(c.maxWidth, 12, KalloColors.borderSoft),
                ),
                const SizedBox(height: KalloSpacing.sp2),
                LayoutBuilder(
                  builder:
                      (_, c) => skeletonBar(
                        c.maxWidth * 5 / 6,
                        12,
                        KalloColors.borderHalf,
                      ),
                ),
                const SizedBox(height: KalloSpacing.sp2),
                LayoutBuilder(
                  builder:
                      (_, c) => skeletonBar(
                        c.maxWidth * 3 / 5,
                        12,
                        KalloColors.borderBiscotti40,
                      ),
                ),
                const SizedBox(height: LoggingSpacing.section),
                const Divider(
                  height: 1,
                  thickness: 1,
                  color: KalloColors.borderHalf,
                ),
                const SizedBox(height: LoggingSpacing.section),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    skeletonBar(112, 12, KalloColors.borderHalf), // w-28
                    skeletonBar(64, 16, KalloColors.accent35), // accent/25
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );

    return Pulse(child: Column(children: [ghostCard(false), ghostCard(true)]));
  }
}
