/// How much of a [ScanFood] is being logged: a count of servings, a count of
/// packs, or a custom amount in the food's unit. Pure, so the result card's
/// Portion and Amount rows are unit-testable without a widget.
library;

import 'dart:math' as math;

import 'scan_food.dart';

/// The most one entry may log, in the food's unit — the server's
/// `MAX_FOOD_ITEM_GRAMS` (`lib/barcode/constants.ts`), so a large-but-valid
/// pack is never silently clipped.
const int maxScanAmount = 100000;

/// The most servings — or packs — one entry holds.
const int maxServings = 99;

/// One press of a custom amount's − / +, in g or ml. Fine enough to land on a
/// real portion; typing covers anything finer.
const int customStep = 10;

/// A size as a pack prints it: whole numbers drop the ".0", and a litre or a
/// kilo or more reads L / kg — "100 ml", "1 L", "1.5 kg". Unit words are the
/// same in both languages.
String formatSize(num value, String unit) {
  String trim(num v) {
    final rounded = (v * 10).round() / 10;
    return rounded == rounded.roundToDouble()
        ? rounded.round().toString()
        : rounded.toString();
  }

  if (value >= 1000 && (unit == 'ml' || unit == 'g')) {
    return '${trim(value / 1000)} ${unit == 'ml' ? 'L' : 'kg'}';
  }
  return '${trim(value)} $unit';
}

enum ScanPortion { serving, pack, custom }

/// The portions [food] can be logged by, in menu order: serving and pack only
/// when the source gives their size; custom always — except for a food whose
/// only unit IS "serving", where a custom amount would just be a serving count.
List<ScanPortion> portionsFor(ScanFood food) => [
  if (food.servingSize != null) ScanPortion.serving,
  if (food.packageSize != null) ScanPortion.pack,
  if (food.unit != 'serving' || food.servingSize == null) ScanPortion.custom,
];

/// One press of the custom amount's − / +: 10 g or ml; a whole serving when
/// the unit is servings.
double customStepFor(String unit) =>
    unit == 'serving' ? 1 : customStep.toDouble();

class ScanAmount {
  const ScanAmount({
    required this.portion,
    required this.custom,
    this.servings = 1,
    this.packs = 1,
  });

  /// One serving when the food has one, else its pack, else its basis (100 g
  /// or ml, or one serving).
  factory ScanAmount.initial(ScanFood food) {
    final portions = portionsFor(food);
    return ScanAmount(
      portion: portions.first,
      custom: _clamp(food.servingSize ?? food.packageSize ?? food.basisAmount),
    );
  }

  final ScanPortion portion;
  final int servings;
  final int packs;

  /// The custom amount, in the food's unit.
  final double custom;

  static double _clamp(double amount) =>
      math.min(math.max(amount, 1), maxScanAmount.toDouble());

  /// The amount this selection logs, in [food]'s unit.
  double resolve(ScanFood food) => _clamp(switch (portion) {
    ScanPortion.serving => servings * (food.servingSize ?? food.basisAmount),
    ScanPortion.pack => packs * (food.packageSize ?? food.basisAmount),
    ScanPortion.custom => custom,
  });

  /// The most servings or packs of [size] one entry holds: [maxServings],
  /// or fewer when that many would pass [maxScanAmount] — so the count on
  /// screen is always the amount logged (99 packs of 2 kg would not be).
  static int _maxCount(double? size) =>
      size == null || size <= 0
          ? maxServings
          : math.max(1, math.min(maxServings, (maxScanAmount / size).floor()));

  /// The − / + of the Amount row for the current portion.
  ScanAmount stepped(ScanFood food, int direction) => switch (portion) {
    ScanPortion.serving => copyWith(
      servings: (servings + direction).clamp(1, _maxCount(food.servingSize)),
    ),
    ScanPortion.pack => copyWith(
      packs: (packs + direction).clamp(1, _maxCount(food.packageSize)),
    ),
    ScanPortion.custom => copyWith(
      custom: _clamp(custom + direction * customStepFor(food.unit)),
    ),
  };

  bool canStep(ScanFood food, int direction) => switch (portion) {
    ScanPortion.serving =>
      direction < 0 ? servings > 1 : servings < _maxCount(food.servingSize),
    ScanPortion.pack =>
      direction < 0 ? packs > 1 : packs < _maxCount(food.packageSize),
    ScanPortion.custom => direction < 0 ? custom > 1 : custom < maxScanAmount,
  };

  /// A typed or ruler-picked custom amount, kept inside the log's limits.
  ScanAmount withCustom(double amount) =>
      copyWith(portion: ScanPortion.custom, custom: _clamp(amount));

  /// Switch portion, carrying the current amount into custom so "Custom"
  /// starts from what was on screen rather than jumping.
  ScanAmount withPortion(ScanPortion next, ScanFood food) =>
      next == ScanPortion.custom && portion != ScanPortion.custom
          ? copyWith(portion: next, custom: resolve(food))
          : copyWith(portion: next);

  ScanAmount copyWith({
    ScanPortion? portion,
    int? servings,
    int? packs,
    double? custom,
  }) => ScanAmount(
    portion: portion ?? this.portion,
    servings: servings ?? this.servings,
    packs: packs ?? this.packs,
    custom: custom ?? this.custom,
  );
}

/// The amount chosen for [before], when it still means the same for [after]
/// — an edit that kept the unit and the serving and pack sizes; else null, so
/// the result starts again from one serving.
ScanAmount? carryAmount(ScanAmount? amount, ScanFood before, ScanFood after) =>
    amount != null &&
            before.unit == after.unit &&
            before.servingSize == after.servingSize &&
            before.packageSize == after.packageSize
        ? amount
        : null;
