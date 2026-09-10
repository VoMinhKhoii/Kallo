import 'package:kallo_mobile/models/nutrition/nutrition.dart';

/// One sodium card, shaped by the caller: the target is 2000mg, so
/// [percentOfTarget] and [averagePerDay] are the test's to keep consistent
/// (or to leave deliberately inconsistent, when a case is about one of them).
NutrientCardData sodiumCard({
  double? averagePerDay,
  double? percentOfTarget,
  double confidence = 100,
  ConfidenceDisplayState displayState = ConfidenceDisplayState.normal,
  NutrientType nutrientType = NutrientType.ceiling,
  String labelKey = 'nutrition.nutrients.sodium',
}) => NutrientCardData(
  nutrient: NutritionNutrientKey.sodiumMg,
  labelKey: labelKey,
  group: NutrientGroup.mineral,
  averagePerDay: averagePerDay,
  target: 2000,
  targetSource: TargetSource.nasem,
  targetSourceLabelKey: 'nutrition.targetSources.nasem',
  unit: 'mg',
  percentOfTarget: percentOfTarget,
  confidence: confidence,
  displayState: displayState,
  nutrientType: nutrientType,
);
