import 'package:flutter/material.dart';

import '../../../theme/calm_tokens.dart';
import '../../../theme/kallo_colors.dart';
import '../../../theme/kallo_typography.dart';

/// The full-width text field (native pass, 2026-08-31): a 52pt full-round
/// pill — white fill, hairline border, 18 left inset, 17pt input text and a
/// 2px warm accent border when focused. Shape and metrics come from the
/// app-level [InputDecorationTheme]; this wrapper pins the height and text
/// style so call sites can't drift.
class KalloTextField extends StatelessWidget {
  const KalloTextField({
    super.key,
    this.controller,
    this.focusNode,
    this.hintText,
    this.keyboardType,
    this.textInputAction,
    this.obscureText = false,
    this.autofillHints,
    this.enabled = true,
    this.onChanged,
    this.onSubmitted,
    this.prefixIcon,
    this.suffixIcon,
  });

  final TextEditingController? controller;
  final FocusNode? focusNode;
  final String? hintText;
  final TextInputType? keyboardType;
  final TextInputAction? textInputAction;
  final bool obscureText;
  final Iterable<String>? autofillHints;
  final bool enabled;
  final ValueChanged<String>? onChanged;
  final ValueChanged<String>? onSubmitted;
  final Widget? prefixIcon;
  final Widget? suffixIcon;

  @override
  Widget build(BuildContext context) {
    return ConstrainedBox(
      constraints: const BoxConstraints(minHeight: 52),
      child: TextField(
        controller: controller,
        focusNode: focusNode,
        keyboardType: keyboardType,
        textInputAction: textInputAction,
        obscureText: obscureText,
        autofillHints: autofillHints,
        enabled: enabled,
        onChanged: onChanged,
        onSubmitted: onSubmitted,
        style: const TextStyle(
          fontFamily: KalloTextStyles.sansFamily,
          fontSize: 17,
          color: KalloColors.text,
        ),
        decoration: InputDecoration(
          hintText: hintText,
          hintStyle: const TextStyle(
            fontFamily: KalloTextStyles.sansFamily,
            fontSize: 17,
            color: kInkMuted,
          ),
          prefixIcon: prefixIcon,
          suffixIcon: suffixIcon,
        ),
      ),
    );
  }
}
