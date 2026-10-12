/// The food page's amount arithmetic — where it opens, how − / + step, the
/// range its vessel ruler spans — and the save contract's bounds the sheets
/// hold the meal to.
library;

import 'dart:math' as math;

import '../../../../models/nutrition/ingredient.dart';
import '../../../../models/nutrition/vessel.dart';
import '../portion/portion_anchors.dart';

/// The save contract's bounds on one item's grams (the floor is the amount
/// field's: whole grams, never 0).
const double manualGramsMin = 1;
const double manualGramsMax = 5000;

/// The most foods one manual meal holds — the save contract's cap.
const int maxManualItems = 30;

/// The longest meal name the save contract takes.
const int manualNameMaxLength = 200;

/// One − / + press.
const double manualGramStep = 10;

/// What a food's page opens at: its vessel's everyday tier (a medium cut, a
/// medium bowl, a regular cup), else 100 g — the figure its label is per.
double initialManualGrams(IngredientSearchResult food) {
  final vessel = food.vessel;
  if (vessel == null) return 100;
  final anchors = buildAnchors(vessel, 'en');
  final tier = switch (vessel) {
    PieceVessel(:final tier) => tier,
    ContainerVessel(:final tier) => tier,
  };
  return anchors[tier - 1].value.roundToDouble();
}

/// One press of − ([direction] -1) or + (1), landing on the next multiple of
/// [manualGramStep]: 147 steps to 140 or 150, never to 137 or 157, so a few
/// presses reach a round number. Null when the press would leave the range.
double? steppedManualGrams(double grams, int direction) {
  final next =
      direction < 0
          ? ((grams / manualGramStep).ceil() - 1) * manualGramStep
          : ((grams / manualGramStep).floor() + 1) * manualGramStep;
  if (next < manualGramStep || next > manualGramsMax) return null;
  return next;
}

/// The vessel ruler's span: 10 g up to half again past its largest vessel, so
/// the biggest silhouette sits inside the tape rather than at its very end.
({int min, int max}) manualRulerRange(List<PortionAnchor> anchors) => (
  min: math.min(10, (anchors.first.value / 2).floor()),
  max: (anchors.last.value * 1.5).round(),
);
