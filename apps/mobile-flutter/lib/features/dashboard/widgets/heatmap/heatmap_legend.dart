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

  /// Matches the grid cell's `_cellRadius`.
  static const double _radius = 3;

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
          // Same two-part recipe the cell paints, read from the same place —
          // this swatch previously drew a flat fill inside an accent ring,
          // which is what the cell looked like BEFORE the aurora landed.
          _LegendItem(
            color: HeatmapCheat.fill,
            gradient: HeatmapCheat.gradient,
            label: '$t.cheatDay'.tr(),
          ),
          _LegendItem(
            color: HeatmapColors.scaleAt(HeatmapRamp.awaiting),
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
      HeatmapRamp.empty,
      HeatmapRamp.veryLight,
      HeatmapRamp.light,
      HeatmapRamp.nearlyFull,
      HeatmapRamp.onTarget,
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
  const _LegendItem({
    required this.color,
    required this.label,
    this.border,
    this.gradient,
  });

  final Color color;
  final Color? border;
  final Gradient? gradient;
  final String label;

  @override
  Widget build(BuildContext context) => Row(
    mainAxisSize: MainAxisSize.min,
    children: [
      _Swatch(color: color, border: border, gradient: gradient),
      const SizedBox(width: KalloSpacing.sp1_5),
      Text(label, style: dashMeta(color: kInkMuted)),
    ],
  );
}

class _Swatch extends StatelessWidget {
  const _Swatch({required this.color, this.border, this.gradient});

  final Color color;
  final Color? border;

  /// Washed over [color] rather than replacing it, exactly as the grid painter
  /// lays the cheat cell down: the wash is translucent and needs the base.
  final Gradient? gradient;

  @override
  Widget build(BuildContext context) {
    final radius = BorderRadius.circular(HeatmapLegend._radius);
    return Container(
      width: HeatmapLegend._swatch,
      height: HeatmapLegend._swatch,
      decoration: BoxDecoration(
        color: color,
        borderRadius: radius,
        border: border == null ? null : Border.all(color: border!),
      ),
      // TWO passes, exactly as `HeatmapGridPainter` lays the cheat cell down:
      // the base fill, then the wash over it. Not `BoxDecoration.gradient` —
      // that IGNORES `color`, so the 0.92 aurora would composite onto the card
      // instead of onto the warm base and the swatch would quietly stop
      // matching the cell it explains.
      foregroundDecoration:
          gradient == null
              ? null
              : BoxDecoration(gradient: gradient, borderRadius: radius),
    );
  }
}
