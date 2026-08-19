import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/widgets.dart';

import '../../../../../../models/nutrition_label.dart';
import '../../../../logic/label_review.dart';

/// The text controllers behind the review step's nutrient fields, and the
/// small rules that decide what each field shows.
///
/// Split from `label_review_step.dart`: the step composes the layout, this
/// keeps the fields and [LabelReviewState] in step with each other. Committing
/// an amount rescales every nutrient, so the controllers must be rewritten in
/// place rather than rebuilt — otherwise the caret jumps and a half-typed
/// figure is lost.
class LabelReviewFields {
  LabelReviewFields(this.review)
    : name = TextEditingController(text: review.productName),
      amount = TextEditingController(text: review.amountText);

  final LabelReviewState review;
  final TextEditingController name;
  final TextEditingController amount;
  final Map<String, TextEditingController> _nutrients = {};

  /// Created on demand and reused for the life of the step.
  TextEditingController nutrient(String key) => _nutrients.putIfAbsent(
    key,
    () => TextEditingController(text: review.nutrientText(key)),
  );

  /// Apply a new amount and push the rescaled values back into every field.
  void commitAmount(String value) {
    review.commitAmount(value);
    amount.text = review.amountText;
    for (final entry in _nutrients.entries) {
      final next = review.nutrientText(entry.key);
      if (entry.value.text != next) entry.value.text = next;
    }
  }

  /// A field is wrong if its text won't parse or lands out of range — or, once
  /// the user has asked to save, if it is required and still empty.
  bool hasError(String key, {required bool submitAttempted}) =>
      review.nutrientHasError(key) ||
      (submitAttempted &&
          requiredLabelNutrientKeys.contains(key) &&
          review.nutrientText(key).trim().isEmpty);

  /// 'g' / 'ml' verbatim; servings pluralize against the current amount.
  String get unitLabel =>
      review.unit == 'serving'
          ? plural('logging.labelScan.unit.serving', review.parsedAmount ?? 0)
          : 'logging.labelScan.unit.${review.unit}'.tr();

  void dispose() {
    name.dispose();
    amount.dispose();
    for (final controller in _nutrients.values) {
      controller.dispose();
    }
  }
}
