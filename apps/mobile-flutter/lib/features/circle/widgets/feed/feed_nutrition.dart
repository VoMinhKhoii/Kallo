import 'package:flutter/material.dart';

import '../../../../models/social/circle.dart';
import '../../../../shared/logic/macro_composition.dart';
import '../../../../shared/widgets/nutrition/composition_bar.dart';
import '../../../../theme/calm_tokens.dart';
import '../../../../theme/kallo_theme.dart';
import 'feed_rhythm.dart';

class FeedNutrition extends StatelessWidget {
  const FeedNutrition({required this.meal, super.key});

  final CircleFeedMeal meal;

  @override
  Widget build(BuildContext context) {
    final composition = compositionFromGrams(
      protein: meal.proteinG,
      carbohydrate: meal.carbohydrateG,
      fat: meal.fatG,
    );
    final kcal = meal.caloriesKcal;
    // Nothing measured at all — draw nothing rather than a row of dashes over
    // an empty bar.
    if (kcal == null && composition.totalKcal <= 0) return const SizedBox.shrink();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text.rich(
          TextSpan(
            // Unit stays at Meta so the figure carries the mass, not the word.
            style: dashMeta(),
            children: [
              TextSpan(
                text: kcal == null ? '—' : '${kcal.round()}',
                // Body, not Value: at 17 the figure outweighed the meal name
                // above it, which put the post's focus back on the number this
                // redesign had just taken it off. Medium weight and ink still
                // mark it as the figure.
                style: dashBody(weight: FontWeight.w500, tabular: true),
              ),
              const TextSpan(text: ' kcal'),
            ],
          ),
        ),
        if (composition.totalKcal > 0) ...[
          const SizedBox(height: kFeedTight),
          CompositionBar(
            segments: composition.segments,
            height: kFeedBarHeight,
            gap: kFeedBarGap,
            opacity: kFeedBarOpacity,
          ),
          const SizedBox(height: kFeedTight),
        ],
        _MacroScale(segments: composition.segments, meal: meal),
      ],
    );
  }
}

/// The macro figures, each centred under its own slice of the bar above.
///
/// The row mirrors the bar's flex weights and gutter exactly, so a label tracks
/// its segment as the split changes — the bar becomes its own legend and the
/// colour stops being encoded twice.
///
/// Two cases break that alignment, and both fall back to a plain left-aligned
/// run instead of misreporting: a macro with no value has no slice to sit
/// under, and a meal with no figures at all has no bar.
class _MacroScale extends StatelessWidget {
  const _MacroScale({required this.segments, required this.meal});

  final List<CompositionSegment> segments;
  final CircleFeedMeal meal;

  static String _grams(double? value) =>
      value == null ? '—' : '${value.round()}g';

  double? _gramsFor(String key) => switch (key) {
    'protein' => meal.proteinG,
    'carbohydrate' => meal.carbohydrateG,
    _ => meal.fatG,
  };

  String _labelFor(String key) => switch (key) {
    'protein' => 'P',
    'carbohydrate' => 'C',
    _ => 'F',
  };

  Widget _value(String key) => _MacroValue(
    icon: kMacroIcons[key]!,
    color: kCompositionColors[key]!,
    label: _labelFor(key),
    value: _grams(_gramsFor(key)),
  );

  @override
  Widget build(BuildContext context) {
    final visible = segments.where((segment) => segment.pct > 0).toList();
    if (visible.length != kCompositionKeys.length) {
      return Wrap(
        crossAxisAlignment: WrapCrossAlignment.center,
        spacing: KalloSpacing.sp3,
        runSpacing: kFeedTight,
        children: [for (final key in kCompositionKeys) _value(key)],
      );
    }
    return Row(
      children: [
        for (var i = 0; i < visible.length; i++) ...[
          if (i > 0) const SizedBox(width: kFeedBarGap),
          Expanded(
            flex: (visible[i].pct * 1000).round(),
            // A thin slice cannot hold its label at Meta. Scaling down beats
            // dropping the figure or letting it run into its neighbour — the
            // same trade `day_summary.dart` makes for its macro rows.
            child: FittedBox(
              fit: BoxFit.scaleDown,
              child: _value(visible[i].key),
            ),
          ),
        ],
      ],
    );
  }
}

/// One macro: its food glyph in the macro's own pigment, then the grams. The
/// glyph sits at 14 — the in-text-run exception to the app-wide 24 — because it
/// reads as punctuation inside the line, not as an icon beside it.
class _MacroValue extends StatelessWidget {
  const _MacroValue({
    required this.icon,
    required this.color,
    required this.label,
    required this.value,
  });

  final IconData icon;
  final Color color;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) => Row(
    mainAxisSize: MainAxisSize.min,
    children: [
      Icon(icon, size: 14, color: color),
      const SizedBox(width: KalloSpacing.sp1_5),
      // Ink, not muted. These are the post's actual data — muted at 12 put
      // them below the timestamp in prominence, which is backwards. Size still
      // separates them from the calorie figure, so colour need not as well.
      Text('$label $value', style: dashMeta(color: kInk, tabular: true)),
    ],
  );
}
