/// Meal-related data models.
///
/// Ported from `lib/types/meal.ts`.
library;

import 'vessel.dart';

class MacroBreakdown {
  final double calories;
  final double protein;
  final double carbs;
  final double fat;

  const MacroBreakdown({
    required this.calories,
    required this.protein,
    required this.carbs,
    required this.fat,
  });

  factory MacroBreakdown.fromJson(Map<String, dynamic> json) => MacroBreakdown(
        calories: (json['calories'] as num).toDouble(),
        protein: (json['protein'] as num).toDouble(),
        carbs: (json['carbs'] as num).toDouble(),
        fat: (json['fat'] as num).toDouble(),
      );

  Map<String, dynamic> toJson() => {
        'calories': calories,
        'protein': protein,
        'carbs': carbs,
        'fat': fat,
      };

  MacroBreakdown copyWith({
    double? calories,
    double? protein,
    double? carbs,
    double? fat,
  }) =>
      MacroBreakdown(
        calories: calories ?? this.calories,
        protein: protein ?? this.protein,
        carbs: carbs ?? this.carbs,
        fat: fat ?? this.fat,
      );
}

class MealItem {
  final String id;
  final String name;
  final double quantity;
  final String unit;
  final MacroBreakdown macros;

  /// The vessel the AI assumed this dish was served in. Present on staged
  /// (unconfirmed) items only — the portion picker renders from it. Null when
  /// the pipeline couldn't resolve one, or when the payload predates the field.
  final ClientVessel? vessel;

  const MealItem({
    required this.id,
    required this.name,
    required this.quantity,
    required this.unit,
    required this.macros,
    this.vessel,
  });

  factory MealItem.fromJson(Map<String, dynamic> json) => MealItem(
        id: json['id'] as String,
        name: json['name'] as String,
        quantity: (json['quantity'] as num).toDouble(),
        unit: json['unit'] as String,
        macros: MacroBreakdown.fromJson(json['macros'] as Map<String, dynamic>),
        vessel: ClientVessel.fromJson(json['vessel'] as Map<String, dynamic>?),
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'quantity': quantity,
        'unit': unit,
        'macros': macros.toJson(),
        if (vessel != null) 'vessel': vessel!.toJson(),
      };

  /// [vessel] is only ever re-pointed to another tier, never cleared, so the
  /// plain `??` passthrough is the whole contract here.
  MealItem copyWith({
    String? id,
    String? name,
    double? quantity,
    String? unit,
    MacroBreakdown? macros,
    ClientVessel? vessel,
  }) =>
      MealItem(
        id: id ?? this.id,
        name: name ?? this.name,
        quantity: quantity ?? this.quantity,
        unit: unit ?? this.unit,
        macros: macros ?? this.macros,
        vessel: vessel ?? this.vessel,
      );
}

class ParsedMeal {
  final String mealName;
  final List<MealItem> items;
  final MacroBreakdown totalMacros;

  const ParsedMeal({
    required this.mealName,
    required this.items,
    required this.totalMacros,
  });

  factory ParsedMeal.fromJson(Map<String, dynamic> json) => ParsedMeal(
        mealName: json['mealName'] as String,
        items: (json['items'] as List<dynamic>)
            .map((e) => MealItem.fromJson(e as Map<String, dynamic>))
            .toList(),
        totalMacros:
            MacroBreakdown.fromJson(json['totalMacros'] as Map<String, dynamic>),
      );

  Map<String, dynamic> toJson() => {
        'mealName': mealName,
        'items': items.map((e) => e.toJson()).toList(),
        'totalMacros': totalMacros.toJson(),
      };

  ParsedMeal copyWith({
    String? mealName,
    List<MealItem>? items,
    MacroBreakdown? totalMacros,
  }) =>
      ParsedMeal(
        mealName: mealName ?? this.mealName,
        items: items ?? this.items,
        totalMacros: totalMacros ?? this.totalMacros,
      );
}

/// A user override of a dish's total cooked weight, sent to the server on confirm.
class MealQuantityEdit {
  final int mealItemOrder;
  final double newGrams;

  const MealQuantityEdit({
    required this.mealItemOrder,
    required this.newGrams,
  });

  factory MealQuantityEdit.fromJson(Map<String, dynamic> json) =>
      MealQuantityEdit(
        mealItemOrder: json['mealItemOrder'] as int,
        newGrams: (json['newGrams'] as num).toDouble(),
      );

  Map<String, dynamic> toJson() => {
        'mealItemOrder': mealItemOrder,
        'newGrams': newGrams,
      };

  MealQuantityEdit copyWith({
    int? mealItemOrder,
    double? newGrams,
  }) =>
      MealQuantityEdit(
        mealItemOrder: mealItemOrder ?? this.mealItemOrder,
        newGrams: newGrams ?? this.newGrams,
      );
}

enum ChatRole { user, assistant }

enum StreamingPhase {
  waiting,
  decomposing,
  matching,
  estimating,
  assembling,
  done,
}
