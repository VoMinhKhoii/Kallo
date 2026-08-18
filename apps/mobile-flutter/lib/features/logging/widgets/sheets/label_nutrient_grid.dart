import 'package:flutter/material.dart';

import '../../../../theme/nham_theme.dart';
import '../../logic/label_nutrients.dart';
import 'label_macro_identity.dart';
import 'label_nutrient_field.dart';

/// How a group of nutrient fields is laid out.
enum LabelGridLayout {
  /// Calories on their own full-width row, then protein/carbs/fat sharing one.
  /// Reserved for the four required macros — the only ones that carry an icon
  /// and a colour.
  macros,

  /// Two columns that wrap, for the two dozen optional micronutrients.
  micronutrients,
}

/// Editable nutrient fields for the label review step.
///
/// Port of `components/logging/input/ocr-nutrient-grid.tsx`. Micronutrients
/// appear only for values the scan actually returned, matching the web's
/// filter; the macros are always shown and always required.
class LabelNutrientGrid extends StatelessWidget {
  const LabelNutrientGrid({
    super.key,
    required this.definitions,
    required this.layout,
    required this.textFor,
    required this.hasError,
    required this.onChanged,
    this.enabled = true,
    this.showMissing = false,
  });

  final List<LabelNutrientDefinition> definitions;
  final LabelGridLayout layout;

  final String Function(String key) textFor;
  final bool Function(String key) hasError;
  final void Function(String key, String value) onChanged;
  final bool enabled;

  /// Set once the user has tried to save: a required field left empty then
  /// shows its error instead of waiting silently. Before that first attempt an
  /// untouched form is not scolded.
  final bool showMissing;

  bool get _required => layout == LabelGridLayout.macros;

  bool _isMissing(String key) =>
      _required && showMissing && textFor(key).trim().isEmpty;

  Widget _field(LabelNutrientDefinition definition, {required bool stacked}) =>
      LabelNutrientField(
        definition: definition,
        identity: labelMacroIdentities[definition.key],
        isRequired: _required,
        stackedUnit: stacked,
        value: textFor(definition.key),
        hasError: hasError(definition.key) || _isMissing(definition.key),
        enabled: enabled,
        onChanged: (value) => onChanged(definition.key, value),
      );

  @override
  Widget build(BuildContext context) {
    if (layout == LabelGridLayout.macros) {
      final calories = definitions.firstWhere((d) => d.key == 'calories');
      final rest = definitions.where((d) => d.key != 'calories').toList();
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _field(calories, stacked: false),
          const SizedBox(height: NhamSpacing.sp2),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              for (var i = 0; i < rest.length; i++) ...[
                if (i > 0) const SizedBox(width: NhamSpacing.sp2),
                // Three across a 375pt screen leaves ~105pt per field, so the
                // unit sits under the input rather than inside it.
                Expanded(child: _field(rest[i], stacked: true)),
              ],
            ],
          ),
        ],
      );
    }

    return LayoutBuilder(
      builder: (context, constraints) {
        final itemWidth = (constraints.maxWidth - NhamSpacing.sp2) / 2;
        return Wrap(
          spacing: NhamSpacing.sp2,
          runSpacing: NhamSpacing.sp2,
          children: [
            for (final definition in definitions)
              SizedBox(
                width: itemWidth,
                child: _field(definition, stacked: false),
              ),
          ],
        );
      },
    );
  }
}
