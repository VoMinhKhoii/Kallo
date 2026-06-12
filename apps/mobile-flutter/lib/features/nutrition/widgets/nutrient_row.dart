import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../models/nutrition.dart';
import '../../../theme/nham_colors.dart';
import '../../../theme/nham_typography.dart';
import '../logic/helpers.dart';
import '../logic/status.dart';
import '../screens/nutrient_detail_screen.dart';

/// A steady / background nutrient row. Tapping now PUSHES the real detail route
/// (Cupertino swipe-back, selection haptic) instead of inline-expanding into a
/// duplicate bar — the detail screen carries the sparkline + full food rows the
/// row hint promises ("tap a row to see its trend, foods, and any caveats").
class NutrientRow extends StatefulWidget {
  const NutrientRow({super.key, required this.card});

  final NutrientCardData card;

  @override
  State<NutrientRow> createState() => _NutrientRowState();
}

class _NutrientRowState extends State<NutrientRow> {
  bool _pressed = false;

  void _open() {
    HapticFeedback.selectionClick();
    Navigator.of(context).push(
      CupertinoPageRoute<void>(
        builder: (_) => NutrientDetailScreen(card: widget.card),
      ),
    );
  }

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
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTapDown: (_) => setState(() => _pressed = true),
        onTapUp: (_) => setState(() => _pressed = false),
        onTapCancel: () => setState(() => _pressed = false),
        onTap: _open,
        child: ColoredBox(
          color: _pressed ? NhamColors.hover40 : Colors.transparent,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
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
                const Icon(
                  LucideIcons.chevronRight,
                  size: 16,
                  color: NhamColors.stone,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
