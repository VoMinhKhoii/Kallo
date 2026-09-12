import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../../theme/calm_tokens.dart';
import '../../../../theme/kallo_theme.dart';
import '../../logic/dashboard_spacing.dart';
import '../../logic/heatmap_colors.dart';

/// The heatmap's key.
///
/// Split out of `adherence_heatmap.dart` (which is at its size ceiling) when
/// the scale stopped being a gradient: a continuous bar with only its two ends
/// named was the shape that let the old five-tier scale over-promise, since the
/// under-target half it implied could never actually paint. Discrete swatches
/// with words cannot make a claim the cells do not honour.
///
/// The ramp is one row — it IS a single idea, "how much of the goal" — and the
/// two off-ramp cells follow as their own named items.
class HeatmapLegend extends StatelessWidget {
  const HeatmapLegend({super.key});

  static const double _swatch = 12;

  @override
  Widget build(BuildContext context) {
    const t = 'dashboard.adherenceHeatmap';
    return Padding(
      padding: const EdgeInsets.only(top: DashboardSpacing.section),
      child: Wrap(
        spacing: KalloSpacing.sp3,
        runSpacing: DashboardSpacing.row,
        crossAxisAlignment: WrapCrossAlignment.center,
        children: [
          const _Ramp(),
          _LegendItem(color: HeatmapColors.over, label: '$t.overTarget'.tr()),
          _LegendItem(
            color: HeatmapColors.cheatFill,
            border: HeatmapColors.cheat,
            label: '$t.cheatDay'.tr(),
          ),
          _LegendItem(
            color: HeatmapColors.scaleAt(HeatmapColors.awaiting),
            border: kInkMuted,
            label: '$t.partial'.tr(),
          ),
        ],
      ),
    );
  }
}

/// "Chưa ghi ▁▂▃▄█ Đúng mục tiêu" — the ramp named at both ends, kept together
/// so it can only wrap as a unit and never strand a swatch on its own line.
class _Ramp extends StatelessWidget {
  const _Ramp();

  @override
  Widget build(BuildContext context) {
    const t = 'dashboard.adherenceHeatmap';
    const steps = [
      HeatmapColors.empty,
      HeatmapColors.veryLight,
      HeatmapColors.light,
      HeatmapColors.nearlyFull,
      HeatmapColors.onTarget,
    ];
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Text('$t.notLogged'.tr(), style: dashMeta(color: kInkMuted)),
        const SizedBox(width: KalloSpacing.sp2),
        for (final step in steps) ...[
          _Swatch(color: HeatmapColors.scaleAt(step)),
          const SizedBox(width: 3),
        ],
        const SizedBox(width: KalloSpacing.sp1),
        Text('$t.onTarget'.tr(), style: dashMeta(color: kInkMuted)),
      ],
    );
  }
}

class _LegendItem extends StatelessWidget {
  const _LegendItem({required this.color, required this.label, this.border});

  final Color color;
  final Color? border;
  final String label;

  @override
  Widget build(BuildContext context) => Row(
    mainAxisSize: MainAxisSize.min,
    children: [
      _Swatch(color: color, border: border),
      const SizedBox(width: KalloSpacing.sp1_5),
      Text(label, style: dashMeta(color: kInkMuted)),
    ],
  );
}

class _Swatch extends StatelessWidget {
  const _Swatch({required this.color, this.border});

  final Color color;
  final Color? border;

  @override
  Widget build(BuildContext context) => Container(
    width: HeatmapLegend._swatch,
    height: HeatmapLegend._swatch,
    decoration: BoxDecoration(
      color: color,
      borderRadius: BorderRadius.circular(3),
      border: border == null ? null : Border.all(color: border!),
    ),
  );
}
