import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../features/dashboard/widgets/dashboard_tokens.dart';
import '../../../models/nutrition.dart';
import '../../../shared/widgets/target_progress_bar.dart';
import '../../../theme/nham_colors.dart';
import '../../../theme/nham_typography.dart';
import '../logic/helpers.dart';
import '../logic/rhythm_logic.dart';
import 'fade_in_down.dart';
import 'range_selector.dart';

/// RN port of `apps/mobile/src/components/nutrition/sections/daily-rhythm.tsx`.
class DailyRhythm extends StatelessWidget {
  const DailyRhythm({
    super.key,
    required this.macros,
    required this.resolvedRange,
    required this.onRangeChange,
    this.disabled = false,
  });

  final List<MacroPattern> macros;
  final String resolvedRange;
  final ValueChanged<NutritionRangeInput> onRangeChange;
  final bool disabled;

  @override
  Widget build(BuildContext context) {
    final locale = context.locale.languageCode;
    final calories = macros.where((m) => m.key == 'calories').firstOrNull;
    final composition = buildComposition(macros);
    final macroRows = orderedMacroRows(macros);

    return FadeInDown(
      duration: const Duration(milliseconds: 500),
      delay: const Duration(milliseconds: 100),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(kCardRadius),
              color: kCardSurface,
              boxShadow: const [kCardShadow],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Align(
                  alignment: Alignment.topCenter,
                  child: NutritionRangeSelector(
                    resolvedRange: resolvedRange,
                    onRangeChange: onRangeChange,
                    disabled: disabled,
                  ),
                ),
                const SizedBox(height: 20),
                // Calorie hero.
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text.rich(
                      TextSpan(
                        children: [
                          TextSpan(
                            text:
                                calories != null
                                    ? formatLocalizedNumber(
                                      calories.averagePerDay,
                                      locale,
                                    )
                                    : '—',
                            style: NhamTextStyles.serifMedium(
                              fontSize: 36,
                            ).copyWith(
                              height: 40 / 36,
                              letterSpacing: -0.7,
                              color: NhamColors.text,
                              fontFeatures: const [
                                FontFeature.tabularFigures(),
                              ],
                            ),
                          ),
                          const WidgetSpan(child: SizedBox(width: 8)),
                          TextSpan(
                            text: tr('nutrition.rhythm.calories'),
                            style: NhamTextStyles.sansRegular(
                              fontSize: 16,
                            ).copyWith(color: NhamColors.textMuted),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      tr('nutrition.rhythm.avgPerLoggedDay').toUpperCase(),
                      style: NhamTextStyles.sansRegular(fontSize: 12).copyWith(
                        letterSpacing: 2.2,
                        color: NhamColors.textMuted,
                      ),
                    ),
                  ],
                ),
                if (composition.totalKcal > 0) ...[
                  const SizedBox(height: 24),
                  _CompositionPill(
                    segments: composition.segments,
                    ariaLabel: tr('nutrition.rhythm.macroCompositionAria'),
                  ),
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 12,
                    runSpacing: 4,
                    children: [
                      for (final segment in composition.segments)
                        Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Container(
                              width: 6,
                              height: 6,
                              decoration: BoxDecoration(
                                color: kCompositionColors[segment.key],
                                shape: BoxShape.circle,
                              ),
                            ),
                            const SizedBox(width: 6),
                            Text(
                              '${kCompositionShort[segment.key]} ${segment.pct.round()}%',
                              style: NhamTextStyles.sansRegular(
                                fontSize: 11,
                              ).copyWith(
                                color: NhamColors.textMuted,
                                fontFeatures: const [
                                  FontFeature.tabularFigures(),
                                ],
                              ),
                            ),
                          ],
                        ),
                    ],
                  ),
                ],
                const SizedBox(height: 24),
                // Dashed top divider + macro rows.
                _DashedTopDivider(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      for (var i = 0; i < macroRows.length; i++) ...[
                        if (i > 0) const SizedBox(height: 12),
                        _MacroRow(
                          macro: macroRows[i],
                          locale: locale,
                          label: tr(macroRows[i].labelKey),
                          consistencyLabel: tr(
                            'nutrition.${consistencyLabelKey(macroRows[i].consistencyPct)}',
                          ),
                          barAriaLabel: tr(
                            'nutrition.rhythm.barAria',
                            namedArgs: {'macro': tr(macroRows[i].labelKey)},
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Dashed top border + 20px top padding wrapper (RN `border-t pt-5` dashed).
class _DashedTopDivider extends StatelessWidget {
  const _DashedTopDivider({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const SizedBox(
          height: 1,
          child: CustomPaint(painter: _DashedLinePainter()),
        ),
        Padding(padding: const EdgeInsets.only(top: 20), child: child),
      ],
    );
  }
}

class _DashedLinePainter extends CustomPainter {
  const _DashedLinePainter();

  @override
  void paint(Canvas canvas, Size size) {
    final paint =
        Paint()
          ..color = NhamColors.borderBiscotti40
          ..strokeWidth = 1;
    const dash = 4.0;
    const gap = 3.0;
    var x = 0.0;
    while (x < size.width) {
      canvas.drawLine(Offset(x, 0), Offset(x + dash, 0), paint);
      x += dash + gap;
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

/// The macro composition bar. Web animates each segment `scaleX 0→1` from the
/// left (transformOrigin:left, duration 0.6 delay 0.15 easeOut). Since segments
/// share the same left origin, scaling the whole group reproduces the "draw
/// out" effect while preserving each segment's relative width.
class _CompositionPill extends StatefulWidget {
  const _CompositionPill({required this.segments, required this.ariaLabel});

  final List<CompositionSegment> segments;
  final String ariaLabel;

  @override
  State<_CompositionPill> createState() => _CompositionPillState();
}

class _CompositionPillState extends State<_CompositionPill>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 600),
  );

  late final Animation<double> _scale = CurvedAnimation(
    parent: _controller,
    // Web framer-motion ease:'easeOut' = cubic-bezier(0, 0, 0.58, 1).
    curve: const Cubic(0.0, 0.0, 0.58, 1.0),
  );

  @override
  void initState() {
    super.initState();
    Future.delayed(const Duration(milliseconds: 150), () {
      if (mounted) _controller.forward();
    });
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: widget.ariaLabel,
      image: true,
      child: ClipRRect(
        borderRadius: BorderRadius.circular(9999),
        child: Container(
          height: 8,
          width: double.infinity,
          color: NhamColors.track,
          child: AnimatedBuilder(
            animation: _scale,
            builder:
                (context, child) => Align(
                  alignment: Alignment.centerLeft,
                  child: Transform.scale(
                    scaleX: _scale.value,
                    alignment: Alignment.centerLeft,
                    child: child,
                  ),
                ),
            // Proportional flex so the segments always fill the bar exactly —
            // fixed pixel widths summed to ~0.8% over (float rounding) and
            // overflowed the Row by a couple px.
            child: Row(
              children: [
                for (final segment in widget.segments)
                  if (segment.pct > 0)
                    Expanded(
                      flex: (segment.pct * 1000).round(),
                      child: Container(color: kCompositionColors[segment.key]),
                    ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _MacroRow extends StatelessWidget {
  const _MacroRow({
    required this.macro,
    required this.locale,
    required this.label,
    required this.consistencyLabel,
    required this.barAriaLabel,
  });

  final MacroPattern macro;
  final String locale;
  final String label;
  final String consistencyLabel;
  final String barAriaLabel;

  @override
  Widget build(BuildContext context) {
    final ratio =
        macro.target != null && macro.target! > 0
            ? macro.averagePerDay / macro.target!
            : null;
    final pctOfTarget = ratio == null ? null : ratio * 100;
    final showExceed = shouldShowExceed(macro.nutrientType, pctOfTarget);

    String figure;
    if (macro.target == null || macro.target! <= 0) {
      figure =
          '${formatLocalizedNumber(macro.averagePerDay, locale)} ${macro.unit}';
    } else {
      final pct = (macro.averagePerDay / macro.target! * 100).round();
      figure = showExceed && pct > 100 ? '+${pct - 100}%' : '$pct%';
    }

    return Row(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        SizedBox(
          width: 88,
          child: Text(
            label,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: NhamTextStyles.sansMedium(
              fontSize: 14,
            ).copyWith(color: NhamColors.text),
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: TargetProgressBar(
            percentOfTarget: pctOfTarget,
            showExceed: showExceed,
            duration: const Duration(milliseconds: 600),
            semanticLabel: barAriaLabel,
          ),
        ),
        const SizedBox(width: 12),
        Text(
          macro.target == null
              ? ''
              : '${formatLocalizedNumber(macro.target!, locale)} ${macro.unit}',
          style: NhamTextStyles.sansRegular(fontSize: 11).copyWith(
            color: NhamColors.textMuted,
            fontFeatures: const [FontFeature.tabularFigures()],
          ),
        ),
        const SizedBox(width: 12),
        SizedBox(
          width: 96,
          child: Align(
            alignment: Alignment.centerRight,
            child: FittedBox(
              fit: BoxFit.scaleDown,
              alignment: Alignment.centerRight,
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.baseline,
                textBaseline: TextBaseline.alphabetic,
                children: [
                  Text(
                    consistencyLabel,
                    style: NhamTextStyles.sansRegular(
                      fontSize: 12,
                    ).copyWith(color: NhamColors.text),
                  ),
                  const SizedBox(width: 6),
                  Text(
                    figure,
                    style: NhamTextStyles.sansRegular(fontSize: 11).copyWith(
                      color:
                          showExceed ? NhamColors.danger : NhamColors.textMuted,
                      fontFeatures: const [FontFeature.tabularFigures()],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }
}
