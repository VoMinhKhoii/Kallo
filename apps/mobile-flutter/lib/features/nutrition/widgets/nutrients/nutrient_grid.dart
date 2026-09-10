import 'package:flutter/material.dart';

import '../../../../models/nutrition/nutrition.dart';
import '../../../../theme/kallo_theme.dart';
import 'nutrient_grid_card.dart';

/// One nutrient group (Vitamins, Minerals) as a 2-column grid of cards.
///
/// Replaced `NutrientRowsCard` on 2026-09-07 — see [NutrientGridCard] for why
/// the grid came back, and `components/nutrition/sections/nutrient-grid.tsx`
/// for the web layout this matches.
///
/// A `Wrap` rather than a `GridView`: the grid lives inside the nutrition
/// page's single scroll view, and a nested scrollable would have to be told to
/// shrink-wrap and never scroll — a `GridView` pretending to be a layout.
class NutrientGrid extends StatelessWidget {
  const NutrientGrid({super.key, required this.cards});

  final List<NutrientCardData> cards;

  /// The gutter between two cells, horizontally and vertically.
  static const double _gutter = KalloSpacing.sp3;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        // Two columns, splitting whatever the page's insets left over. Derived
        // rather than fixed, so the grid holds on a narrow phone and on a
        // tablet alike.
        final cellWidth = (constraints.maxWidth - _gutter) / 2;
        return Wrap(
          spacing: _gutter,
          runSpacing: _gutter,
          children: [
            for (final (index, card) in cards.indexed)
              SizedBox(
                width: cellWidth,
                child: NutrientGridCard(
                  card: card,
                  // Stagger by ROW, not by cell: NutrientBar spends the delay
                  // inside one 1s interval clamped at 0.5, so at 60ms per cell
                  // everything from the ninth on shared a single start.
                  barDelay: Duration(milliseconds: 60 * (index ~/ 2)),
                ),
              ),
          ],
        );
      },
    );
  }
}
