import 'package:flutter/widgets.dart';

import '../../../../../../models/nutrition_label.dart';
import '../../../../logic/label/nutrients.dart';
import '../../../../logic/label/review.dart';
import '../../../../logic/scan/scan_food.dart';

/// A food basis — what the values are per: 100 g, 100 ml, a serving, or the
/// source's own (a label's "per 180 ml").
typedef ScanBasis = ({double amount, String unit});

/// The editor's working copy: one text controller per field, the chosen basis,
/// and the rules Done waits for. Kept apart from the widget so the sheet is
/// layout only and the rules are testable.
class ScanEditorDraft {
  ScanEditorDraft(this.source)
    : name = TextEditingController(text: source.name),
      basis = (amount: source.basisAmount, unit: source.unit),
      fields = {
        for (final key in labelNutrientKeys)
          key: TextEditingController(
            text: switch (source.values[key]) {
              final v? => formatLabelNumber(v),
              null => '',
            },
          ),
      };

  final ScanFood source;
  final TextEditingController name;
  final Map<String, TextEditingController> fields;
  ScanBasis basis;

  /// The three bases always offered, plus the source's own when it differs.
  List<ScanBasis> get bases =>
      {
        (amount: 100.0, unit: 'g'),
        (amount: 100.0, unit: 'ml'),
        (amount: 1.0, unit: 'serving'),
        basis,
      }.toList();

  void listen(VoidCallback onChange) {
    name.addListener(onChange);
    for (final c in fields.values) {
      c.addListener(onChange);
    }
  }

  void dispose() {
    name.dispose();
    for (final c in fields.values) {
      c.dispose();
    }
  }

  /// Blank is unknown (null); anything typed must parse and stay in range.
  double? valueOf(String key) => parseLabelDecimal(fields[key]!.text.trim());

  bool hasError(String key) {
    final text = fields[key]!.text.trim();
    if (text.isEmpty) return false;
    final value = parseLabelDecimal(text);
    final max = labelNutrientsByKey[key]?.maximum;
    return value == null || (max != null && value > max);
  }

  /// Done's rule: a name, nothing malformed, and the four the log requires.
  bool get isValid {
    final trimmed = name.text.trim();
    if (trimmed.isEmpty || trimmed.length > 200) return false;
    if (labelNutrientKeys.any(hasError)) return false;
    return requiredLabelNutrientKeys.every((key) => valueOf(key) != null);
  }

  /// The edited food. The values are what the user typed FOR [basis] — a new
  /// basis relabels them, it never rescales them.
  ScanFood toFood() => source.copyWith(
    name: name.text.trim(),
    unit: basis.unit,
    basisAmount: basis.amount,
    values: {for (final key in labelNutrientKeys) key: valueOf(key)},
    edited: true,
  );
}
