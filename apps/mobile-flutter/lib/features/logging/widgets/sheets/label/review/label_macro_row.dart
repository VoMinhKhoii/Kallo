import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../../../../theme/calm_tokens.dart';
import '../../../../../../theme/kallo_theme.dart';
import '../../../../logic/label/nutrients.dart';
import 'label_field.dart';
import 'label_field_label.dart';
import 'label_macro_identity.dart';

/// Protein / carbs / fat as three equal columns under the calorie hero.
///
/// Fixed columns rather than a packed row, for the reason `macro_trio.dart`
/// gives: packed left-to-right the columns drift with the digits and the block
/// reads ragged. Each carries the nutrition page's icon and colour, so the
/// colour IS the key — no swatch or legend to decode.
class LabelMacroRow extends StatelessWidget {
  const LabelMacroRow({
    super.key,
    required this.definitions,
    required this.controllerFor,
    required this.hasError,
    required this.onChanged,
    this.enabled = true,
  });

  final List<LabelNutrientDefinition> definitions;
  final TextEditingController Function(String key) controllerFor;
  final bool Function(String key) hasError;
  final void Function(String key, String value) onChanged;
  final bool enabled;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (var i = 0; i < definitions.length; i++) ...[
          if (i > 0) const SizedBox(width: KalloSpacing.sp3),
          Expanded(child: _column(definitions[i])),
        ],
      ],
    );
  }

  Widget _column(LabelNutrientDefinition definition) {
    final identity = labelMacroIdentities[definition.key];
    return LabelField(
      controller: controllerFor(definition.key),
      textStyle: dashValue(),
      hint: '0',
      unit: definition.unit,
      hasError: hasError(definition.key),
      enabled: enabled,
      onChanged: (value) => onChanged(definition.key, value),
      label: LabelFieldLabel(
        text: 'logging.labelScan.nutrients.${definition.labelKey}'.tr(),
        icon: identity?.icon,
        iconColor: identity?.color,
        isRequired: true,
      ),
    );
  }
}
