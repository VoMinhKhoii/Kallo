import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../../theme/calm_tokens.dart';
import '../../../../theme/nham_colors.dart';
import '../../../../theme/nham_theme.dart';
import '../../logic/label_nutrients.dart';
import 'label_field_chrome.dart';
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
          if (i > 0) const SizedBox(width: NhamSpacing.sp3),
          Expanded(
            child: _MacroColumn(
              definition: definitions[i],
              controller: controllerFor(definitions[i].key),
              hasError: hasError(definitions[i].key),
              enabled: enabled,
              onChanged: (value) => onChanged(definitions[i].key, value),
            ),
          ),
        ],
      ],
    );
  }
}

class _MacroColumn extends StatefulWidget {
  const _MacroColumn({
    required this.definition,
    required this.controller,
    required this.hasError,
    required this.enabled,
    required this.onChanged,
  });

  final LabelNutrientDefinition definition;
  final TextEditingController controller;
  final bool hasError;
  final bool enabled;
  final ValueChanged<String> onChanged;

  @override
  State<_MacroColumn> createState() => _MacroColumnState();
}

class _MacroColumnState extends State<_MacroColumn> {
  final FocusNode _focus = FocusNode();

  @override
  void initState() {
    super.initState();
    _focus.addListener(() => setState(() {}));
  }

  @override
  void dispose() {
    _focus.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final identity = labelMacroIdentities[widget.definition.key];
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            if (identity != null) ...[
              Icon(identity.icon, size: 14, color: identity.color),
              const SizedBox(width: 5),
            ],
            Flexible(
              child: Text(
                'logging.labelScan.nutrients.${widget.definition.labelKey}'
                    .tr(),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: dashMeta(),
              ),
            ),
            // Required mark. The four figures a meal cannot be logged without
            // say so themselves; nothing under the button explains it.
            Text(' *', style: dashMeta(color: NhamColors.danger)),
          ],
        ),
        const SizedBox(height: NhamSpacing.sp1),
        Row(
          crossAxisAlignment: CrossAxisAlignment.baseline,
          textBaseline: TextBaseline.alphabetic,
          children: [
            Flexible(
              child: TextField(
                controller: widget.controller,
                focusNode: _focus,
                enabled: widget.enabled,
                keyboardType: const TextInputType.numberWithOptions(
                  decimal: true,
                ),
                inputFormatters: [
                  FilteringTextInputFormatter.allow(RegExp(r'[0-9.,]')),
                ],
                onChanged: widget.onChanged,
                cursorColor: NhamColors.accent,
                style: dashValue(
                  color: widget.hasError ? NhamColors.danger : kInk,
                ),
                decoration: labelFieldDecoration(
                  hintText: '0',
                  hintStyle: dashValue(color: NhamColors.placeholderMuted40),
                ),
              ),
            ),
            const SizedBox(width: 3),
            Text(widget.definition.unit, style: dashMeta()),
          ],
        ),
        const SizedBox(height: NhamSpacing.sp1),
        LabelFieldRule(hasError: widget.hasError, focused: _focus.hasFocus),
      ],
    );
  }
}
