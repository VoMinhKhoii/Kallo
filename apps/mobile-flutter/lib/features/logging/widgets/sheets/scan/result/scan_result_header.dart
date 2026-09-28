import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../../../../shared/logic/macro_composition.dart';
import '../../../../../../shared/widgets/nutrition/composition_bar.dart';
import '../../../../../../theme/calm_tokens.dart';
import '../../../../../../theme/kallo_theme.dart';

/// The top of every scan result — a barcode product or a read label.
///
/// **Two leads on one row** (owner review, 2026-09-28): the name leads by
/// WEIGHT (page title, 28/600, two lines at most) and the calories by SIZE
/// (the card's one hero figure, 40/400). Everything under them is quiet: the
/// brand in Meta muted, then the calorie-share bar and one Meta-ink legend
/// line where each macro's colour lives on its food glyph only — the same
/// bar, glyphs and pigments as the meal cards the entry becomes.
class ScanResultHeader extends StatelessWidget {
  const ScanResultHeader({
    super.key,
    required this.name,
    required this.kcal,
    required this.protein,
    required this.carbs,
    required this.fat,
    this.subtitle,
  });

  final String name;

  /// The brand, or "From the label". Null hides the line.
  final String? subtitle;

  /// Values for the chosen amount; null reads "—" (unknown, never 0).
  final double? kcal;
  final double? protein;
  final double? carbs;
  final double? fat;

  static String _figure(double? value) {
    if (value == null) return '—';
    final rounded = (value * 10).round() / 10;
    return rounded == rounded.roundToDouble()
        ? rounded.round().toString()
        : rounded.toString();
  }

  @override
  Widget build(BuildContext context) {
    final grams = {'protein': protein, 'carbohydrate': carbs, 'fat': fat};
    final labels = {
      'protein': 'logging.barcode.protein'.tr(),
      'carbohydrate': 'logging.barcode.carbs'.tr(),
      'fat': 'logging.barcode.fat'.tr(),
    };
    final composition = compositionFromGrams((
      protein: protein,
      carbohydrate: carbs,
      fat: fat,
    ));

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const SizedBox(height: 10),
        Row(
          crossAxisAlignment: CrossAxisAlignment.baseline,
          textBaseline: TextBaseline.alphabetic,
          children: [
            Expanded(
              child: Text(
                name,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: kPageTitle(),
              ),
            ),
            const SizedBox(width: KalloSpacing.sp4),
            Text(
              kcal == null ? '—' : kcal!.round().toString(),
              style: dashHero(),
            ),
            const SizedBox(width: KalloSpacing.sp1),
            Text('kcal', style: dashMeta(color: kInk)),
          ],
        ),
        if (subtitle != null) ...[
          const SizedBox(height: KalloSpacing.sp1),
          Text(
            subtitle!,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: dashMeta(),
          ),
        ],
        const SizedBox(height: 14),
        CompositionBar(segments: composition.segments, height: 6),
        const SizedBox(height: 10),
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceEvenly,
          children: [
            for (final key in kCompositionKeys)
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(
                    kMacroIcons[key],
                    size: 14,
                    color: kCompositionColors[key],
                  ),
                  const SizedBox(width: 5),
                  Text(
                    '${labels[key]} ${_figure(grams[key])} g',
                    style: dashMeta(color: kInk, tabular: true),
                  ),
                ],
              ),
          ],
        ),
      ],
    );
  }
}
