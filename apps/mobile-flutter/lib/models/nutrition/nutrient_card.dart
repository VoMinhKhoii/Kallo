/// The nutrient grid's card payload — a nutrient's average against its target,
/// the context metrics and source breakdown behind it, and the education card
/// that sits alongside.
///
/// Split from `nutrition.dart` for the file-size gate; re-exported from there,
/// so callers keep the one import.
library;

import 'nutrition_enums.dart';

class NutrientContextMetric {
  final NutritionNutrientKey key;
  final String labelKey;
  final double? averagePerDay;
  final String unit;

  const NutrientContextMetric({
    required this.key,
    required this.labelKey,
    required this.averagePerDay,
    required this.unit,
  });

  factory NutrientContextMetric.fromJson(Map<String, dynamic> json) =>
      NutrientContextMetric(
        key: NutritionNutrientKey.values.byName(json['key'] as String),
        labelKey: json['labelKey'] as String,
        averagePerDay: (json['averagePerDay'] as num?)?.toDouble(),
        unit: json['unit'] as String,
      );

  Map<String, dynamic> toJson() => {
    'key': key.name,
    'labelKey': labelKey,
    'averagePerDay': averagePerDay,
    'unit': unit,
  };
}

class SourceBreakdown {
  final double faoVietnamCalorieShare;
  final double? faoVietnamConfidence;
  final int? missingSodiumCondimentItems;

  const SourceBreakdown({
    required this.faoVietnamCalorieShare,
    required this.faoVietnamConfidence,
    this.missingSodiumCondimentItems,
  });

  factory SourceBreakdown.fromJson(
    Map<String, dynamic> json,
  ) => SourceBreakdown(
    faoVietnamCalorieShare: (json['faoVietnamCalorieShare'] as num).toDouble(),
    faoVietnamConfidence: (json['faoVietnamConfidence'] as num?)?.toDouble(),
    missingSodiumCondimentItems: json['missingSodiumCondimentItems'] as int?,
  );

  Map<String, dynamic> toJson() => {
    'faoVietnamCalorieShare': faoVietnamCalorieShare,
    'faoVietnamConfidence': faoVietnamConfidence,
    'missingSodiumCondimentItems': missingSodiumCondimentItems,
  };
}

class NutrientCardData {
  final NutritionNutrientKey nutrient;
  final String labelKey;
  final NutrientGroup group;
  final double? averagePerDay;
  final double? target;
  final TargetSource targetSource;
  final String targetSourceLabelKey;
  final String unit;
  final double? percentOfTarget;
  final double confidence;
  final ConfidenceDisplayState displayState;
  final NutrientType nutrientType;
  final String? caveatKey;
  final List<NutrientContextMetric>? contextMetrics;
  final SourceBreakdown? sourceBreakdown;

  const NutrientCardData({
    required this.nutrient,
    required this.labelKey,
    required this.group,
    required this.averagePerDay,
    required this.target,
    required this.targetSource,
    required this.targetSourceLabelKey,
    required this.unit,
    required this.percentOfTarget,
    required this.confidence,
    required this.displayState,
    required this.nutrientType,
    this.caveatKey,
    this.contextMetrics,
    this.sourceBreakdown,
  });

  factory NutrientCardData.fromJson(
    Map<String, dynamic> json,
  ) => NutrientCardData(
    nutrient: NutritionNutrientKey.values.byName(json['nutrient'] as String),
    labelKey: json['labelKey'] as String,
    group: NutrientGroup.values.byName(json['group'] as String),
    averagePerDay: (json['averagePerDay'] as num?)?.toDouble(),
    target: (json['target'] as num?)?.toDouble(),
    targetSource: targetSourceFromString(json['targetSource'] as String),
    targetSourceLabelKey: json['targetSourceLabelKey'] as String,
    unit: json['unit'] as String,
    percentOfTarget: (json['percentOfTarget'] as num?)?.toDouble(),
    confidence: (json['confidence'] as num).toDouble(),
    displayState: confidenceDisplayStateFromString(
      json['displayState'] as String,
    ),
    nutrientType: NutrientType.values.byName(json['nutrientType'] as String),
    caveatKey: json['caveatKey'] as String?,
    contextMetrics:
        (json['contextMetrics'] as List<dynamic>?)
            ?.map(
              (e) => NutrientContextMetric.fromJson(e as Map<String, dynamic>),
            )
            .toList(),
    sourceBreakdown:
        json['sourceBreakdown'] != null
            ? SourceBreakdown.fromJson(
              json['sourceBreakdown'] as Map<String, dynamic>,
            )
            : null,
  );

  Map<String, dynamic> toJson() => {
    'nutrient': nutrient.name,
    'labelKey': labelKey,
    'group': group.name,
    'averagePerDay': averagePerDay,
    'target': target,
    'targetSource': targetSourceToString(targetSource),
    'targetSourceLabelKey': targetSourceLabelKey,
    'unit': unit,
    'percentOfTarget': percentOfTarget,
    'confidence': confidence,
    'displayState': confidenceDisplayStateToString(displayState),
    'nutrientType': nutrientType.name,
    'caveatKey': caveatKey,
    'contextMetrics': contextMetrics?.map((e) => e.toJson()).toList(),
    'sourceBreakdown': sourceBreakdown?.toJson(),
  };

  NutrientCardData copyWith({
    NutritionNutrientKey? nutrient,
    String? labelKey,
    NutrientGroup? group,
    double? Function()? averagePerDay,
    double? Function()? target,
    TargetSource? targetSource,
    String? targetSourceLabelKey,
    String? unit,
    double? Function()? percentOfTarget,
    double? confidence,
    ConfidenceDisplayState? displayState,
    NutrientType? nutrientType,
    String? Function()? caveatKey,
    List<NutrientContextMetric>? Function()? contextMetrics,
    SourceBreakdown? Function()? sourceBreakdown,
  }) => NutrientCardData(
    nutrient: nutrient ?? this.nutrient,
    labelKey: labelKey ?? this.labelKey,
    group: group ?? this.group,
    averagePerDay: averagePerDay != null ? averagePerDay() : this.averagePerDay,
    target: target != null ? target() : this.target,
    targetSource: targetSource ?? this.targetSource,
    targetSourceLabelKey: targetSourceLabelKey ?? this.targetSourceLabelKey,
    unit: unit ?? this.unit,
    percentOfTarget:
        percentOfTarget != null ? percentOfTarget() : this.percentOfTarget,
    confidence: confidence ?? this.confidence,
    displayState: displayState ?? this.displayState,
    nutrientType: nutrientType ?? this.nutrientType,
    caveatKey: caveatKey != null ? caveatKey() : this.caveatKey,
    contextMetrics:
        contextMetrics != null ? contextMetrics() : this.contextMetrics,
    sourceBreakdown:
        sourceBreakdown != null ? sourceBreakdown() : this.sourceBreakdown,
  );
}

class EducationCardData {
  final String id;
  final String titleKey;
  final String bodyKey;

  const EducationCardData({
    required this.id,
    required this.titleKey,
    required this.bodyKey,
  });

  factory EducationCardData.fromJson(Map<String, dynamic> json) =>
      EducationCardData(
        id: json['id'] as String,
        titleKey: json['titleKey'] as String,
        bodyKey: json['bodyKey'] as String,
      );

  Map<String, dynamic> toJson() => {
    'id': id,
    'titleKey': titleKey,
    'bodyKey': bodyKey,
  };
}
