/// The macro half of the overview: how consistent the macros were, and the
/// per-macro average/target row the pattern section renders.
///
/// Split from `nutrition.dart` for the file-size gate; re-exported from there,
/// so callers keep the one import.
library;

import 'nutrition_enums.dart';

class MacroConsistencySummary {
  final double averageConsistencyPct;
  final MacroKey? weakestMacro;

  const MacroConsistencySummary({
    required this.averageConsistencyPct,
    required this.weakestMacro,
  });

  factory MacroConsistencySummary.fromJson(Map<String, dynamic> json) =>
      MacroConsistencySummary(
        averageConsistencyPct:
            (json['averageConsistencyPct'] as num).toDouble(),
        weakestMacro:
            json['weakestMacro'] != null
                ? MacroKey.values.byName(json['weakestMacro'] as String)
                : null,
      );

  Map<String, dynamic> toJson() => {
    'averageConsistencyPct': averageConsistencyPct,
    'weakestMacro': weakestMacro?.name,
  };

  MacroConsistencySummary copyWith({
    double? averageConsistencyPct,
    MacroKey? Function()? weakestMacro,
  }) => MacroConsistencySummary(
    averageConsistencyPct: averageConsistencyPct ?? this.averageConsistencyPct,
    weakestMacro: weakestMacro != null ? weakestMacro() : this.weakestMacro,
  );
}

class MacroPattern {
  final String key; // MacroKey name or 'fiber'
  final String labelKey;
  final double averagePerDay;
  final double? target;
  final String unit;
  final double? consistencyPct;
  final NutrientType nutrientType;

  const MacroPattern({
    required this.key,
    required this.labelKey,
    required this.averagePerDay,
    required this.target,
    required this.unit,
    required this.consistencyPct,
    required this.nutrientType,
  });

  factory MacroPattern.fromJson(Map<String, dynamic> json) => MacroPattern(
    key: json['key'] as String,
    labelKey: json['labelKey'] as String,
    averagePerDay: (json['averagePerDay'] as num).toDouble(),
    target: (json['target'] as num?)?.toDouble(),
    unit: json['unit'] as String,
    consistencyPct: (json['consistencyPct'] as num?)?.toDouble(),
    nutrientType: NutrientType.values.byName(json['nutrientType'] as String),
  );

  Map<String, dynamic> toJson() => {
    'key': key,
    'labelKey': labelKey,
    'averagePerDay': averagePerDay,
    'target': target,
    'unit': unit,
    'consistencyPct': consistencyPct,
    'nutrientType': nutrientType.name,
  };

  MacroPattern copyWith({
    String? key,
    String? labelKey,
    double? averagePerDay,
    double? Function()? target,
    String? unit,
    double? Function()? consistencyPct,
    NutrientType? nutrientType,
  }) => MacroPattern(
    key: key ?? this.key,
    labelKey: labelKey ?? this.labelKey,
    averagePerDay: averagePerDay ?? this.averagePerDay,
    target: target != null ? target() : this.target,
    unit: unit ?? this.unit,
    consistencyPct:
        consistencyPct != null ? consistencyPct() : this.consistencyPct,
    nutrientType: nutrientType ?? this.nutrientType,
  );
}
