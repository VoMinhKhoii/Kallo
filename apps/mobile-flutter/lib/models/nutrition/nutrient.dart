/// One nutrient's identity and its per-period summary row, plus the summary
/// block that ranks those rows into "most consistent" / "needs attention".
///
/// Split from `nutrition.dart` for the file-size gate; re-exported from there,
/// so callers keep the one import.
library;

import 'macro_pattern.dart';
import 'nutrition_enums.dart';

class NutrientMeta {
  final NutritionNutrientKey key;
  final String dbColumn;
  final String labelKey;
  final String unit;
  final NutrientGroup group;

  const NutrientMeta({
    required this.key,
    required this.dbColumn,
    required this.labelKey,
    required this.unit,
    required this.group,
  });

  factory NutrientMeta.fromJson(Map<String, dynamic> json) => NutrientMeta(
    key: NutritionNutrientKey.values.byName(json['key'] as String),
    dbColumn: json['dbColumn'] as String,
    labelKey: json['labelKey'] as String,
    unit: json['unit'] as String,
    group: NutrientGroup.values.byName(json['group'] as String),
  );

  Map<String, dynamic> toJson() => {
    'key': key.name,
    'dbColumn': dbColumn,
    'labelKey': labelKey,
    'unit': unit,
    'group': group.name,
  };
}

class NutrientSummaryItem {
  final NutritionNutrientKey nutrient;
  final String labelKey;
  final double average;
  final String unit;
  final double? percentOfTarget;
  final double confidence;
  final NutritionStatus status;
  final String? applicability;
  final NutrientType nutrientType;

  const NutrientSummaryItem({
    required this.nutrient,
    required this.labelKey,
    required this.average,
    required this.unit,
    required this.percentOfTarget,
    required this.confidence,
    required this.status,
    this.applicability,
    required this.nutrientType,
  });

  factory NutrientSummaryItem.fromJson(
    Map<String, dynamic> json,
  ) => NutrientSummaryItem(
    nutrient: NutritionNutrientKey.values.byName(json['nutrient'] as String),
    labelKey: json['labelKey'] as String,
    average: (json['average'] as num).toDouble(),
    unit: json['unit'] as String,
    percentOfTarget: (json['percentOfTarget'] as num?)?.toDouble(),
    confidence: (json['confidence'] as num).toDouble(),
    status: nutritionStatusFromString(json['status'] as String),
    applicability: json['applicability'] as String?,
    nutrientType: NutrientType.values.byName(json['nutrientType'] as String),
  );

  Map<String, dynamic> toJson() => {
    'nutrient': nutrient.name,
    'labelKey': labelKey,
    'average': average,
    'unit': unit,
    'percentOfTarget': percentOfTarget,
    'confidence': confidence,
    'status': nutritionStatusToString(status),
    'applicability': applicability,
    'nutrientType': nutrientType.name,
  };

  NutrientSummaryItem copyWith({
    NutritionNutrientKey? nutrient,
    String? labelKey,
    double? average,
    String? unit,
    double? Function()? percentOfTarget,
    double? confidence,
    NutritionStatus? status,
    String? Function()? applicability,
    NutrientType? nutrientType,
  }) => NutrientSummaryItem(
    nutrient: nutrient ?? this.nutrient,
    labelKey: labelKey ?? this.labelKey,
    average: average ?? this.average,
    unit: unit ?? this.unit,
    percentOfTarget:
        percentOfTarget != null ? percentOfTarget() : this.percentOfTarget,
    confidence: confidence ?? this.confidence,
    status: status ?? this.status,
    applicability: applicability != null ? applicability() : this.applicability,
    nutrientType: nutrientType ?? this.nutrientType,
  );
}

class NutritionSummary {
  final List<NutrientSummaryItem> mostConsistent;
  final List<NutrientSummaryItem> needsAttention;
  final int limitedDataCount;
  final MacroConsistencySummary macroConsistency;

  const NutritionSummary({
    required this.mostConsistent,
    required this.needsAttention,
    required this.limitedDataCount,
    required this.macroConsistency,
  });

  factory NutritionSummary.fromJson(
    Map<String, dynamic> json,
  ) => NutritionSummary(
    mostConsistent:
        (json['mostConsistent'] as List<dynamic>)
            .map((e) => NutrientSummaryItem.fromJson(e as Map<String, dynamic>))
            .toList(),
    needsAttention:
        (json['needsAttention'] as List<dynamic>)
            .map((e) => NutrientSummaryItem.fromJson(e as Map<String, dynamic>))
            .toList(),
    limitedDataCount: json['limitedDataCount'] as int,
    macroConsistency: MacroConsistencySummary.fromJson(
      json['macroConsistency'] as Map<String, dynamic>,
    ),
  );

  Map<String, dynamic> toJson() => {
    'mostConsistent': mostConsistent.map((e) => e.toJson()).toList(),
    'needsAttention': needsAttention.map((e) => e.toJson()).toList(),
    'limitedDataCount': limitedDataCount,
    'macroConsistency': macroConsistency.toJson(),
  };
}
