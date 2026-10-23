import 'package:flutter/material.dart';

import '../../../theme/calm_tokens.dart';
import '../../logic/macro_composition.dart';

/// The row under a calorie-share bar: a 14px food glyph and a Caption gram
/// label per macro, spread across the full width. Optional [leading] /
/// [trailing] join the same distribution — a meal card's kcal figure rides in
/// one of them.
///
/// Shared by [MealBlock] and the meal edit sheet, so the legend under every bar
/// in the app is one spacing rule, not one per surface.
class MacroLegend extends StatelessWidget {
  const MacroLegend({
    super.key,
    required this.gramLabels,
    this.leading,
    this.trailing,
  });

  /// Gram label per macro key, in [kCompositionKeys] order where present —
  /// e.g. {'protein': 'P 28g', 'carbohydrate': 'C 52g', 'fat': 'F 9g'}.
  final Map<String, String> gramLabels;
  final Widget? leading;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    final entries = [
      for (final key in kCompositionKeys)
        if (gramLabels[key] != null) _entry(key, gramLabels[key]!),
    ];
    // Macros alone (the meal edit sheet): three equal columns, each figure
    // centred in its own, so the space either side of every figure is the
    // same and their positions never move with the numbers (the owner's
    // ruling: "left space of P must equal right space of P").
    if (leading == null && trailing == null && entries.length > 1) {
      return Row(
        children: [
          for (final entry in entries) Expanded(child: Center(child: entry)),
        ],
      );
    }
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        if (leading != null) leading!,
        ...entries,
        if (trailing != null) trailing!,
      ],
    );
  }

  Widget _entry(String key, String label) => Row(
    mainAxisSize: MainAxisSize.min,
    children: [
      Icon(kMacroIcons[key], size: 14, color: kCompositionColors[key]),
      const SizedBox(width: 4),
      // Caption, not Meta. This legend is three icon+figure pairs and a kcal
      // total on ONE line: at Meta it measured ~253pt of legend plus a ~70pt
      // kcal, which does not fit a 320pt phone's card. The tier exists for
      // exactly this — a compact component the secondary size visibly breaks.
      Text(label, style: dashCaption()),
    ],
  );
}
