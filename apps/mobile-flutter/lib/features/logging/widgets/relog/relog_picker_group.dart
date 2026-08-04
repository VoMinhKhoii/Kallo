import 'package:flutter/material.dart';

import '../../../../models/relog.dart';
import '../../../../theme/calm_tokens.dart';
import '../../../../theme/nham_colors.dart';
import '../../../../theme/nham_theme.dart';
import 'relog_picker_option.dart';

/// One labelled group of the `/` picker — the dishes or the meals. Renders
/// nothing when empty, so a query that only matches dishes shows no meals
/// header.
///
/// The header is presentational: selection is by tap, so unlike the web's
/// keyboard-driven listbox there is no cursor that could land on it.
class RelogPickerGroup extends StatelessWidget {
  const RelogPickerGroup({
    super.key,
    required this.label,
    required this.candidates,
    required this.onSelect,
  });

  final String label;
  final List<RelogCandidate> candidates;
  final ValueChanged<RelogCandidate> onSelect;

  @override
  Widget build(BuildContext context) {
    if (candidates.isEmpty) return const SizedBox.shrink();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(
            NhamSpacing.sp2,
            NhamSpacing.sp2,
            NhamSpacing.sp2,
            NhamSpacing.sp1,
          ),
          // dashEyebrow does NOT upper-case — the transform lives at the call
          // site (the NhamText casing trap in the mobile design doc).
          //
          // Full white, not a translucent one: at 11px this is small text, and
          // white@70% on the band falls under 4.5:1. It still recedes from the
          // dish names, by size and letter-spacing rather than by opacity.
          child: Text(
            label.toUpperCase(),
            style: dashEyebrow(color: NhamColors.bandForeground),
          ),
        ),
        for (final candidate in candidates)
          RelogPickerOption(
            key: ValueKey(optionKey(candidate)),
            candidate: candidate,
            onSelect: () => onSelect(candidate),
          ),
      ],
    );
  }

  /// Stable identity for a row. A dish is identified by its source meal AND its
  /// item order — the same meal can contribute several dishes.
  static String optionKey(RelogCandidate candidate) => switch (candidate) {
    RelogDishCandidate(:final sourceMealId, :final mealItemOrder) =>
      'dish-$sourceMealId-$mealItemOrder',
    RelogMealCandidate(:final sourceMealId) => 'meal-$sourceMealId',
  };
}
