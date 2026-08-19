import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../../../../theme/calm_tokens.dart';
import '../../../../../../theme/nham_colors.dart';
import '../../../../../../theme/nham_theme.dart';

/// Every editable value on the label review sheet.
///
/// One widget rather than five near-copies: the calorie hero, the three
/// macros, each micronutrient, the product name and the amount differ only in
/// text style, label and unit — the focus lifecycle, the borderless chrome and
/// the state-carrying rule were identical in all of them.
///
/// Borderless is not a style preference but a fight with the app theme, which
/// sets `filled: true` and an `OutlineInputBorder` on `enabledBorder`; every
/// border slot AND `filled` must be cleared or the field paints its own box
/// inside ours. Clearing it once, here, is the point of the widget.
class LabelField extends StatefulWidget {
  const LabelField({
    super.key,
    required this.controller,
    required this.textStyle,
    required this.onChanged,
    this.label,
    this.unit,
    this.hint,
    this.numeric = true,
    this.hasError = false,
    this.enabled = true,
    this.errorText,
    this.onCommit,
  });

  final TextEditingController controller;

  /// Sets the field's rank: hero for calories, value for a macro or the
  /// amount, body for a micronutrient or the name. Colour is applied here so
  /// an error is red without every caller remembering to.
  final TextStyle textStyle;

  final ValueChanged<String> onChanged;

  /// The row above the field — see [LabelFieldLabel].
  final Widget? label;

  /// Rendered after the value, never converted.
  final String? unit;

  final String? hint;

  /// Decimal keyboard and digit-only input. False for the product name.
  final bool numeric;

  final bool hasError;
  final bool enabled;

  /// Shown under the rule while [hasError].
  final String? errorText;

  /// Called when editing finishes or focus leaves — the amount field rescales
  /// every other value, which must not happen on each keystroke.
  final ValueChanged<String>? onCommit;

  @override
  State<LabelField> createState() => _LabelFieldState();
}

class _LabelFieldState extends State<LabelField> {
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
    final commit = widget.onCommit;
    final ruleColor =
        widget.hasError
            ? NhamColors.danger
            : _focus.hasFocus
            ? NhamColors.accent
            : NhamColors.border;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (widget.label != null) ...[
          widget.label!,
          const SizedBox(height: NhamSpacing.sp1),
        ],
        Row(
          crossAxisAlignment: CrossAxisAlignment.baseline,
          textBaseline: TextBaseline.alphabetic,
          children: [
            Flexible(
              child: TextField(
                controller: widget.controller,
                focusNode: _focus,
                enabled: widget.enabled,
                keyboardType:
                    widget.numeric
                        ? const TextInputType.numberWithOptions(decimal: true)
                        : TextInputType.text,
                inputFormatters:
                    widget.numeric
                        ? [
                          FilteringTextInputFormatter.allow(RegExp(r'[0-9.,]')),
                        ]
                        : null,
                onChanged: widget.onChanged,
                onEditingComplete:
                    commit == null
                        ? null
                        : () => commit(widget.controller.text),
                onTapOutside:
                    commit == null
                        ? null
                        : (_) => commit(widget.controller.text),
                cursorColor: NhamColors.accent,
                style: widget.textStyle.copyWith(
                  color: widget.hasError ? NhamColors.danger : kInk,
                ),
                decoration: InputDecoration(
                  isDense: true,
                  filled: false,
                  contentPadding: EdgeInsets.zero,
                  border: InputBorder.none,
                  enabledBorder: InputBorder.none,
                  focusedBorder: InputBorder.none,
                  disabledBorder: InputBorder.none,
                  hintText: widget.hint,
                  hintStyle: widget.textStyle.copyWith(
                    color: NhamColors.placeholderMuted40,
                  ),
                ),
              ),
            ),
            if (widget.unit != null) ...[
              const SizedBox(width: 4),
              Text(widget.unit!, style: dashMeta()),
            ],
          ],
        ),
        const SizedBox(height: NhamSpacing.sp1),
        // The rule carries focus and error state, so the field needs no box.
        AnimatedContainer(
          duration: const Duration(milliseconds: 140),
          height: widget.hasError || _focus.hasFocus ? 1.5 : 1,
          color: ruleColor,
        ),
        if (widget.hasError && widget.errorText != null) ...[
          const SizedBox(height: NhamSpacing.sp1),
          Text(widget.errorText!, style: dashMeta(color: NhamColors.danger)),
        ],
      ],
    );
  }
}
