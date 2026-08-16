import 'package:flutter/material.dart';

import '../../../../theme/kallo_colors.dart';
import '../../../../theme/kallo_theme.dart';
import '../../logic/logging_spacing.dart';
import 'pulse.dart';

// ── Loading / error states ──────────────────────────────────────────────

/// Macro header skeleton: a 2-col grid of 4 rounded-2xl border/50 bg-hover/25
/// tiles, each with a label bar + accent/25 value bar (MacroSummarySkeleton).
class MacroSummarySkeleton extends StatelessWidget {
  const MacroSummarySkeleton({super.key});

  static const _labelWidths = [64.0, 52.0, 58.0, 48.0];

  @override
  Widget build(BuildContext context) {
    Widget tile(int i) => Container(
      padding: const EdgeInsets.all(KalloSpacing.sp3), // p-3
      decoration: BoxDecoration(
        color: const Color(0x40F0EAE0), // bg-kallo-hover/25
        borderRadius: BorderRadius.circular(KalloRadii.containerLg), // 2xl
        border: Border.all(color: KalloColors.borderHalf), // border/50
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          skeletonBar(_labelWidths[i], 12, KalloColors.border70), // border/70
          const SizedBox(height: KalloSpacing.sp2), // mb-2
          skeletonBar(64, 20, KalloColors.track), // h-5 w-16 track skeleton pill
        ],
      ),
    );

    return Pulse(
      child: Column(
        children: [
          Row(
            children: [
              Expanded(child: tile(0)),
              const SizedBox(width: KalloSpacing.sp3), // gap-3
              Expanded(child: tile(1)),
            ],
          ),
          const SizedBox(height: KalloSpacing.sp3),
          Row(
            children: [
              Expanded(child: tile(2)),
              const SizedBox(width: KalloSpacing.sp3),
              Expanded(child: tile(3)),
            ],
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
