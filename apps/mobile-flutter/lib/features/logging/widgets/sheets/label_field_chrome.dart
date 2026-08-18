import 'package:flutter/material.dart';

import '../../../../theme/nham_colors.dart';

/// Borderless input chrome for the label sheet.
///
/// The app theme sets `filled: true` and an `OutlineInputBorder` on
/// `enabledBorder`, so a field paints its own box unless every border slot AND
/// `filled` are cleared — the trap documented in the design system's mobile
/// notes. This is the one place that clearing lives, so the sheet's fields all
/// read as typography with a hairline under them rather than as boxes.
InputDecoration labelFieldDecoration({
  String? hintText,
  TextStyle? hintStyle,
  Widget? suffix,
}) => InputDecoration(
  isDense: true,
  filled: false,
  contentPadding: EdgeInsets.zero,
  border: InputBorder.none,
  enabledBorder: InputBorder.none,
  focusedBorder: InputBorder.none,
  disabledBorder: InputBorder.none,
  hintText: hintText,
  hintStyle: hintStyle,
  suffix: suffix,
);

/// The hairline a field sits on. Carries the field's state — accent while
/// focused, danger when the value is wrong or missing — so a field needs no
/// box of its own to show it.
class LabelFieldRule extends StatelessWidget {
  const LabelFieldRule({
    super.key,
    this.hasError = false,
    this.focused = false,
  });

  final bool hasError;
  final bool focused;

  @override
  Widget build(BuildContext context) {
    final color = hasError
        ? NhamColors.danger
        : focused
        ? NhamColors.accent
        : NhamColors.border;
    return AnimatedContainer(
      duration: const Duration(milliseconds: 140),
      height: hasError || focused ? 1.5 : 1,
      color: color,
    );
  }
}
