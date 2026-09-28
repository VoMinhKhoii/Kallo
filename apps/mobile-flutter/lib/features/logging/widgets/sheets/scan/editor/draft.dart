import 'package:flutter/widgets.dart';

import '../../../../../../models/nutrition_label.dart';
import '../../../../logic/label/nutrients.dart';
import '../../../../logic/label/review.dart';
import '../../../../logic/scan/food.dart';
import '../../../../logic/scan/macro_fill.dart';

/// A food basis — what the values are per: 100 g, 100 ml, a serving, or the
/// source's own (a label's "per 180 ml").
typedef ScanBasis = ({double amount, String unit});

/// Why a typed figure cannot be saved.
enum ScanFieldIssue {
  /// Not a plain number ("-5", "1e3", "abc").
  notANumber,

  /// Above the nutrient's ceiling (the server's own bound).
  tooHigh,
}

/// The editor's working copy: one text controller per field, the chosen basis,
/// and the rules Save waits for. Kept apart from the widget so the sheet is
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
      } {
    for (final key in requiredLabelNutrientKeys) {
      _last[key] = fields[key]!.text;
      fields[key]!.addListener(() => _requiredChanged(key));
    }
    _fill();
  }

  final ScanFood source;
  final TextEditingController name;
  final Map<String, TextEditingController> fields;
  ScanBasis basis;

  /// The required field holding a figure worked out from the other three
  /// ([fillMissingMacro]) rather than typed — or null.
  String? filledKey;

  /// Required fields the user has typed in: never filled over, even blank.
  final Set<String> _typedIn = {};
  final Map<String, String> _last = {};
  bool _filling = false;

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

  /// What was typed, a decimal still being written ("12,") read as its whole
  /// part — so the field's error does not flash on every separator typed.
  /// Only after a digit: a lone "." stays, and is an error, not a blank.
  String _typed(String key) =>
      fields[key]!.text.trim().replaceFirst(RegExp(r'(?<=\d)[.,]$'), '');

  /// Blank is unknown (null); anything typed must parse and stay in range.
  double? valueOf(String key) => parseLabelDecimal(_typed(key));

  /// Why [key]'s figure cannot be saved, or null when it can (blank can).
  ScanFieldIssue? issueOf(String key) {
    final text = _typed(key);
    if (text.isEmpty) return null;
    final value = parseLabelDecimal(text);
    if (value == null) return ScanFieldIssue.notANumber;
    final max = labelNutrientsByKey[key]?.maximum;
    return max != null && value > max ? ScanFieldIssue.tooHigh : null;
  }

  bool hasError(String key) => issueOf(key) != null;

  void _requiredChanged(String key) {
    final text = fields[key]!.text;
    // A caret or selection move notifies too; only an edit counts.
    if (text == _last[key]) return;
    _last[key] = text;
    if (_filling) return;
    _typedIn.add(key);
    if (filledKey == key) filledKey = null;
    _fill();
  }

  /// With three of the four required figures typed, the fourth — if the user
  /// has not typed in it — is worked out and kept in step with the three. Once
  /// they no longer add up to one (one cleared, or malformed), it empties
  /// again rather than keep a figure nothing supports.
  void _fill() {
    final fill = fillMissingMacro({
      for (final key in requiredLabelNutrientKeys)
        key: key == filledKey || hasError(key) ? null : valueOf(key),
    });
    final target = fill?.key;
    if (fill != null &&
        !_typedIn.contains(target) &&
        (target == filledKey || fields[target]!.text.trim().isEmpty)) {
      _set(target!, formatLabelNumber(fill.value));
      filledKey = target;
    } else if (filledKey case final key?) {
      _set(key, '');
      filledKey = null;
    }
  }

  void _set(String key, String text) {
    _filling = true;
    fields[key]!.text = text;
    _filling = false;
  }

  /// Save's rule: a name, nothing malformed, and the four the log requires.
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
