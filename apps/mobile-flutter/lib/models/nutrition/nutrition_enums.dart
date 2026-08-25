/// Nutrition enums and their wire-value extensions.
///
/// Split from `nutrition.dart` for the file-size gate; re-exported from there,
/// so callers keep the one import.
library;

enum NutritionRange { d1, d7, d30, d90 }

extension NutritionRangeValue on NutritionRange {
  String get value => switch (this) {
    NutritionRange.d1 => '1d',
    NutritionRange.d7 => '7d',
    NutritionRange.d30 => '30d',
    NutritionRange.d90 => '90d',
  };
}

/// Input range that may include 'auto'.
enum NutritionRangeInput { auto, d1, d7, d30, d90 }

extension NutritionRangeInputValue on NutritionRangeInput {
  String get value => switch (this) {
    NutritionRangeInput.auto => 'auto',
    NutritionRangeInput.d1 => '1d',
    NutritionRangeInput.d7 => '7d',
    NutritionRangeInput.d30 => '30d',
    NutritionRangeInput.d90 => '90d',
  };
}

enum BucketTimezone { local, utc }

/// Which day set the overview averages/series are scoped to.
enum NutritionDayScope { complete, all }

extension NutritionDayScopeValue on NutritionDayScope {
  String get value => switch (this) {
    NutritionDayScope.complete => 'complete',
    NutritionDayScope.all => 'all',
  };
}

enum TargetSource { vietnamRda, whoFao, nasem, unsupported }

TargetSource targetSourceFromString(String s) => switch (s) {
  'vietnam_rda' => TargetSource.vietnamRda,
  'who_fao' => TargetSource.whoFao,
  'nasem' => TargetSource.nasem,
  'unsupported' => TargetSource.unsupported,
  _ => throw ArgumentError('Unknown TargetSource: $s'),
};

String targetSourceToString(TargetSource s) => switch (s) {
  TargetSource.vietnamRda => 'vietnam_rda',
  TargetSource.whoFao => 'who_fao',
  TargetSource.nasem => 'nasem',
  TargetSource.unsupported => 'unsupported',
};

enum NutrientGroup { mineral, vitamin, other }

enum ConfidenceDisplayState {
  normal,
  limitedData,
  warningPoints,
  insufficientData,
}

ConfidenceDisplayState confidenceDisplayStateFromString(String s) =>
    switch (s) {
      'normal' => ConfidenceDisplayState.normal,
      'limited_data' => ConfidenceDisplayState.limitedData,
      'warning_points' => ConfidenceDisplayState.warningPoints,
      'insufficient_data' => ConfidenceDisplayState.insufficientData,
      _ => throw ArgumentError('Unknown ConfidenceDisplayState: $s'),
    };

String confidenceDisplayStateToString(ConfidenceDisplayState s) => switch (s) {
  ConfidenceDisplayState.normal => 'normal',
  ConfidenceDisplayState.limitedData => 'limited_data',
  ConfidenceDisplayState.warningPoints => 'warning_points',
  ConfidenceDisplayState.insufficientData => 'insufficient_data',
};

enum NutritionStatus { belowTarget, adequate, aboveTarget, limitedData }

NutritionStatus nutritionStatusFromString(String s) => switch (s) {
  'below_target' => NutritionStatus.belowTarget,
  'adequate' => NutritionStatus.adequate,
  'above_target' => NutritionStatus.aboveTarget,
  'limited_data' => NutritionStatus.limitedData,
  _ => throw ArgumentError('Unknown NutritionStatus: $s'),
};

String nutritionStatusToString(NutritionStatus s) => switch (s) {
  NutritionStatus.belowTarget => 'below_target',
  NutritionStatus.adequate => 'adequate',
  NutritionStatus.aboveTarget => 'above_target',
  NutritionStatus.limitedData => 'limited_data',
};

enum NutrientType { floor, ceiling, range }

/// All supported nutrient keys.
enum NutritionNutrientKey {
  fiberG,
  sodiumMg,
  calciumMg,
  ironMg,
  magnesiumMg,
  phosphorusMg,
  potassiumMg,
  zincMg,
  copperMcg,
  manganeseMg,
  betaCaroteneMcg,
  vitaminAMcg,
  vitaminDMcg,
  vitaminEMg,
  vitaminKMcg,
  vitaminCMg,
  vitaminB1Mg,
  vitaminB2Mg,
  vitaminPpMg,
  vitaminB5Mg,
  vitaminB6Mg,
  vitaminB9Mcg,
  vitaminB12Mcg,
  vitaminHMcg,
}

enum MacroKey { calories, protein, carbohydrate, fat }

enum MacroGoal { cutting, bulking, maintaining }

/// The `goal` column is a free-text CHECK on (cutting, bulking, maintaining).
/// Anything else — including null, and any value a future migration adds —
/// falls through to null, which every reader treats as counting up.
///
/// Lives beside the enum rather than inside one profile model: the dashboard
/// bundle and the logging profile arrive on different endpoints and must read
/// the same column the same way.
MacroGoal? macroGoalFromWire(String? value) => switch (value) {
  'cutting' => MacroGoal.cutting,
  'bulking' => MacroGoal.bulking,
  'maintaining' => MacroGoal.maintaining,
  _ => null,
};
