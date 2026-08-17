import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../../shared/widgets/nham_text.dart';
import '../../../../theme/nham_colors.dart';
import '../../../../theme/nham_theme.dart';
import '../../../../theme/nham_typography.dart';
import '../../logic/label_nutrients.dart';

/// Two-column grid of editable nutrient fields.
///
/// Port of `components/logging/input/ocr-nutrient-grid.tsx`. The macros are
/// rendered as required; micronutrients only appear for values the scan
/// actually returned, matching the web's filter.
class LabelNutrientGrid extends StatelessWidget {
  const LabelNutrientGrid({
    super.key,
    required this.definitions,
    required this.required_,
    required this.textFor,
    required this.hasError,
    required this.onChanged,
    this.enabled = true,
  });

  final List<LabelNutrientDefinition> definitions;

  /// Marks every field in this grid as required (the macro grid).
  final bool required_;

  final String Function(String key) textFor;
  final bool Function(String key) hasError;
  final void Function(String key, String value) onChanged;
  final bool enabled;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        // One column on a narrow phone, two everywhere else: a field plus its
        // unit suffix is unreadable much below 160pt of column.
        final columns = constraints.maxWidth < 320 ? 1 : 2;
        final itemWidth =
            (constraints.maxWidth - NhamSpacing.sp2 * (columns - 1)) / columns;
        return Wrap(
          spacing: NhamSpacing.sp2,
          runSpacing: NhamSpacing.sp2,
          children: [
            for (final definition in definitions)
              SizedBox(
                width: itemWidth,
                child: _NutrientField(
                  definition: definition,
                  isRequired: required_,
                  value: textFor(definition.key),
                  hasError: hasError(definition.key),
                  enabled: enabled,
                  onChanged: (value) => onChanged(definition.key, value),
                ),
              ),
          ],
        );
      },
    );
  }
}

class _NutrientField extends StatefulWidget {
  const _NutrientField({
    required this.definition,
    required this.isRequired,
    required this.value,
    required this.hasError,
    required this.enabled,
    required this.onChanged,
  });

  final LabelNutrientDefinition definition;
  final bool isRequired;
  final String value;
  final bool hasError;
  final bool enabled;
  final ValueChanged<String> onChanged;

  @override
  State<_NutrientField> createState() => _NutrientFieldState();
}

class _NutrientFieldState extends State<_NutrientField> {
  late final TextEditingController _controller = TextEditingController(
    text: widget.value,
  );

  @override
  void didUpdateWidget(_NutrientField oldWidget) {
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
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        NhamText(
          'logging.labelScan.nutrients.${widget.definition.labelKey}'.tr(),
          variant: NhamTextVariant.small,
          maxLines: 1,
          style: const TextStyle(color: NhamColors.textMuted),
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
            hintText: widget.isRequired ? '0' : null,
            hintStyle: NhamTextStyles.sansRegular(
              fontSize: NhamFontSize.sm,
            ).copyWith(color: NhamColors.placeholderMuted40),
            suffixText: widget.definition.unit,
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
      ],
    );
  }

  OutlineInputBorder _border(Color color) => OutlineInputBorder(
    borderRadius: BorderRadius.circular(NhamRadii.lg),
    borderSide: BorderSide(color: color),
  );
}
