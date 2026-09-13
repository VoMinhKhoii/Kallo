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
/// three off-ramp cells follow as their own named items, because none of them
/// is a step on that ramp. Every kind of cell the grid can paint is named here:
/// a key that omits one quietly reclassifies it as something else.
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
          // Each item asks the palette for the paint of the kind it names,
          // rather than assembling one from the raw tokens — assembling is what
          // let this key claim a flat ringed swatch while the cell it explains
          // drew a ringless wash.
          _LegendItem(
            paint: HeatmapCellPaints.tier(HeatmapTier.overTarget),
            label: '$t.overTarget'.tr(),
          ),
          _LegendItem(
            paint: HeatmapCellPaints.cheat,
            label: '$t.cheatDay'.tr(),
          ),
          _LegendItem(
            paint: HeatmapCellPaints.awaiting,
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
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Text('$t.notLogged'.tr(), style: dashMeta(color: kInkMuted)),
        const SizedBox(width: KalloSpacing.sp2),
        for (final swatch in heatmapLegendSwatches()) ...[
          _Swatch(paint: (fill: swatch, gradient: null, stroke: null)),
          const SizedBox(width: 3),
        ],
        const SizedBox(width: KalloSpacing.sp1),
        Text('$t.onTarget'.tr(), style: dashMeta(color: kInkMuted)),
      ],
    );
  }
}

class _LegendItem extends StatelessWidget {
  const _LegendItem({required this.paint, required this.label});

  final HeatmapCellPaint paint;
  final String label;

  @override
  Widget build(BuildContext context) => Row(
    mainAxisSize: MainAxisSize.min,
    children: [
      _Swatch(paint: paint),
      const SizedBox(width: KalloSpacing.sp1_5),
      Text(label, style: dashMeta(color: kInkMuted)),
    ],
  );
}

/// One cell, drawn as a widget instead of onto a canvas.
///
/// The two render paths cannot be shared — the grid is a [CustomPainter] — so
/// what is shared is the [HeatmapCellPaint] they both consume. A gradient here
/// is opaque and REPLACES the fill (`BoxDecoration` ignores `color` when
/// `gradient` is set), which is correct only because the cheat wash is
/// pre-composited in the palette; that is the same single pass the painter now
/// makes.
class _Swatch extends StatelessWidget {
  const _Swatch({required this.paint});

  final HeatmapCellPaint paint;

  @override
  Widget build(BuildContext context) {
    final stroke = paint.stroke;
    return Container(
      width: HeatmapLegend._swatch,
      height: HeatmapLegend._swatch,
      decoration: BoxDecoration(
        color: paint.fill,
        gradient: paint.gradient,
        borderRadius: BorderRadius.circular(heatmapCellRadius),
        border: stroke == null ? null : Border.all(color: stroke),
      ),
    );
  }
}
