import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../models/nutrition.dart';
import '../../../theme/nham_colors.dart';
import '../../../theme/nham_typography.dart';
import '../logic/helpers.dart';
import '../logic/status.dart';
import 'nutrient_detail.dart';

/// RN port of `apps/mobile/src/components/nutrition/rows/nutrient-row.tsx`
/// (expandable). lucide `ChevronRight` → `Icons.chevron_right`.
class NutrientRow extends StatefulWidget {
  const NutrientRow({super.key, required this.card});

  final NutrientCardData card;

  @override
  State<NutrientRow> createState() => _NutrientRowState();
}

class _NutrientRowState extends State<NutrientRow> {
  bool _open = false;
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    final card = widget.card;
    final label = tr(card.labelKey);
    final isLimited =
        card.displayState == ConfidenceDisplayState.limitedData ||
            card.displayState == ConfidenceDisplayState.insufficientData;
    final hasNoTarget = card.percentOfTarget == null;
    final dotColor = isLimited || hasNoTarget
        ? NhamColors.stone
        : kStatusColors[statusKeyFor(card)]!;

    final showExceed = shouldShowExceed(card.nutrientType, card.percentOfTarget);

    String figure;
    if (card.displayState == ConfidenceDisplayState.insufficientData) {
      figure = tr('nutrition.steady.limited');
    } else if (card.percentOfTarget == null) {
      figure = tr('nutrition.steady.noTarget');
    } else if (showExceed && card.percentOfTarget! > 100) {
      figure = '+${(card.percentOfTarget! - 100).round()}%';
    } else {
      figure = tr('nutrition.steady.percent',
          namedArgs: {'value': card.percentOfTarget!.round().toString()});
    }

    final figureColor = showExceed
        ? NhamColors.danger
        : isLimited
            ? NhamColors.textMuted
            : NhamColors.text;

    return DecoratedBox(
      decoration: const BoxDecoration(
        border: Border(
          bottom: BorderSide(color: NhamColors.borderBiscotti40),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTapDown: (_) => setState(() => _pressed = true),
            onTapUp: (_) => setState(() => _pressed = false),
            onTapCancel: () => setState(() => _pressed = false),
            onTap: () => setState(() => _open = !_open),
            child: ColoredBox(
              color: _pressed ? NhamColors.hover40 : Colors.transparent,
              child: Padding(
                padding: const EdgeInsets.symmetric(
                  horizontal: 16,
                  vertical: 12,
                ),
                child: Row(
                  children: [
                    Container(
                      width: 6,
                      height: 6,
                      decoration: BoxDecoration(
                        color: dotColor,
                        shape: BoxShape.circle,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        label,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: NhamTextStyles.sansRegular(fontSize: 14)
                            .copyWith(color: NhamColors.text),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Text(
                      figure,
                      style: NhamTextStyles.sansRegular(fontSize: 12).copyWith(
                        color: figureColor,
                        fontFeatures: const [FontFeature.tabularFigures()],
                      ),
                    ),
                    const SizedBox(width: 12),
                    AnimatedRotation(
                      turns: _open ? 0.25 : 0,
                      duration: const Duration(milliseconds: 200),
                      child: const Icon(
                        Icons.chevron_right,
                        size: 16,
                        color: NhamColors.stone,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
          // Web height/opacity collapse, duration 0.28. AnimatedSize reflows the
          // list as the detail mounts; the panel fades over the same window.
          AnimatedSize(
            duration: const Duration(milliseconds: 280),
            // Web ease:[0.22, 1, 0.36, 1] — expo-out style.
            curve: const Cubic(0.22, 1.0, 0.36, 1.0),
            alignment: Alignment.topCenter,
            child: _open
                ? Padding(
                    padding:
                        const EdgeInsets.fromLTRB(16, 0, 16, 16),
                    child: _FadeIn(child: NutrientDetail(card: card)),
                  )
                : const SizedBox(width: double.infinity),
          ),
        ],
      ),
    );
  }
}

/// One-shot fade-in mirroring Reanimated `FadeIn.duration(280)`.
class _FadeIn extends StatefulWidget {
  const _FadeIn({required this.child});

  final Widget child;

  @override
  State<_FadeIn> createState() => _FadeInState();
}

class _FadeInState extends State<_FadeIn>
    with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 280),
  )..forward();

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) =>
      FadeTransition(opacity: _c, child: widget.child);
}
