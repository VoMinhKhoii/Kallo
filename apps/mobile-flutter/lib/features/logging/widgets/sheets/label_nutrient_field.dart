import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../../shared/widgets/nham_text.dart';
import '../../../../theme/nham_colors.dart';
import '../../../../theme/nham_theme.dart';
import '../../../../theme/nham_typography.dart';
import '../../logic/label_nutrients.dart';
import 'label_macro_identity.dart';

/// One editable nutrient: an optionally iconed label with a required mark, a
/// decimal field, and its unit either inside the field or beneath it.
///
/// Split from `label_nutrient_grid.dart` to keep both under the 200-line
/// widget limit.
class LabelNutrientField extends StatefulWidget {
  const LabelNutrientField({
    super.key,
    required this.definition,
    required this.identity,
    required this.isRequired,
    required this.stackedUnit,
    required this.value,
    required this.hasError,
    required this.enabled,
    required this.onChanged,
  });

  final LabelNutrientDefinition definition;

  /// Icon + colour for the four macros; null for everything else.
  final LabelMacroIdentity? identity;
  final bool isRequired;

  /// Put the unit under the field instead of inside it — the narrow columns.
  final bool stackedUnit;
  final String value;
  final bool hasError;
  final bool enabled;
  final ValueChanged<String> onChanged;

  @override
  State<LabelNutrientField> createState() => _LabelNutrientFieldState();
}

class _LabelNutrientFieldState extends State<LabelNutrientField> {
  late final TextEditingController _controller = TextEditingController(
    text: widget.value,
  );

  @override
  void didUpdateWidget(LabelNutrientField oldWidget) {
    super.didUpdateWidget(oldWidget);
    // The amount picker rewrites every field when an amount is committed.
    // Only adopt the new text when it really differs, so the caret doesn't
    // jump while the user is typing.
    if (widget.value != _controller.text) {
      _controller.value = TextEditingValue(
        text: widget.value,
        selection: TextSelection.collapsed(offset: widget.value.length),
      );
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final borderColor = widget.hasError
        ? NhamColors.danger
        : NhamColors.inputBorder;
    final identity = widget.identity;
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
              child: NhamText(
                'logging.labelScan.nutrients.${widget.definition.labelKey}'
                    .tr(),
                variant: NhamTextVariant.small,
                maxLines: 1,
                style: const TextStyle(color: NhamColors.textMuted),
              ),
            ),
            // The asterisk is what says "required" now that the sentence under
            // the button is gone.
            if (widget.isRequired)
              Text(
                ' *',
                style: NhamTextStyles.sansMedium(
                  fontSize: NhamFontSize.xs,
                ).copyWith(color: NhamColors.danger),
              ),
          ],
        ),
        const SizedBox(height: 4),
        TextField(
          controller: _controller,
          enabled: widget.enabled,
          keyboardType: const TextInputType.numberWithOptions(decimal: true),
          inputFormatters: [
            FilteringTextInputFormatter.allow(RegExp(r'[0-9.,]')),
          ],
          onChanged: widget.onChanged,
          style: NhamTextStyles.sansMedium(
            fontSize: NhamFontSize.sm,
          ).copyWith(color: NhamColors.text),
          cursorColor: NhamColors.accent,
          decoration: InputDecoration(
            isDense: true,
            filled: true,
            fillColor: NhamColors.elev,
            suffixText: widget.stackedUnit ? null : widget.definition.unit,
            suffixStyle: NhamTextStyles.sansRegular(
              fontSize: NhamFontSize.xs,
            ).copyWith(color: NhamColors.textMuted),
            contentPadding: const EdgeInsets.symmetric(
              horizontal: NhamSpacing.sp2,
              vertical: NhamSpacing.sp2,
            ),
            border: _border(borderColor),
            enabledBorder: _border(borderColor),
            focusedBorder: _border(
              widget.hasError ? NhamColors.danger : NhamColors.borderAccent40,
            ),
          ),
        ),
        if (widget.stackedUnit) ...[
          const SizedBox(height: 3),
          NhamText(
            widget.definition.unit,
            variant: NhamTextVariant.small,
            style: const TextStyle(color: NhamColors.textMuted),
          ),
        ],
      ],
    );
  }

  OutlineInputBorder _border(Color color) => OutlineInputBorder(
    borderRadius: BorderRadius.circular(NhamRadii.lg),
    borderSide: BorderSide(color: color),
  );
}
