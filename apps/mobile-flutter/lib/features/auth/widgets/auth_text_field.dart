import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../theme/calm_tokens.dart';
import '../../../theme/kallo_colors.dart';
import '../../../theme/kallo_theme.dart';

/// The auth email / code field (native pass, 2026-08-31): a 52pt full-round
/// pill on the app's field metrics — white fill, hairline border, 18 left
/// inset, 17pt input text, and a 2px warm-accent border when focused. Above it
/// sits a 12/500 muted label; below it, the validation message.
///
/// Shape and metrics match [KalloTextField] and the app-level
/// [InputDecorationTheme] exactly. This keeps its own decoration rather than
/// wrapping that widget for one reason: an invalid field has to turn the
/// BORDER red, not just print red copy under it — "red on the affordance, not
/// the copy" (`mobile.md`) — and the shared field has no error state to drive.
class AuthTextField extends StatefulWidget {
  const AuthTextField({
    super.key,
    required this.controller,
    required this.label,
    required this.placeholder,
    this.keyboardType,
    this.textInputAction,
    this.autofillHints,
    this.inputFormatters,
    this.autofocus = false,
    this.onSubmitted,
    this.onChanged,
    this.enabled = true,
    this.errorText,
  });

  final TextEditingController controller;
  final String label;
  final String placeholder;

  final TextInputType? keyboardType;
  final TextInputAction? textInputAction;
  final Iterable<String>? autofillHints;
  final List<TextInputFormatter>? inputFormatters;
  final bool autofocus;
  final ValueChanged<String>? onSubmitted;
  final ValueChanged<String>? onChanged;
  final bool enabled;

  /// Per-field validation message. Null = valid/untouched.
  final String? errorText;

  @override
  State<AuthTextField> createState() => _AuthTextFieldState();
}

class _AuthTextFieldState extends State<AuthTextField> {
  final _focusNode = FocusNode();
  bool _focused = false;

  /// Field height — the app's pill metrics.
  static const double _height = 52;

  @override
  void initState() {
    super.initState();
    _focusNode.addListener(() {
      if (mounted) setState(() => _focused = _focusNode.hasFocus);
    });
  }

  @override
  void dispose() {
    _focusNode.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final hasError = widget.errorText != null;

    // Error → focus → resting, and the focused state is the one that gets the
    // 2px stroke: a field taking focus is the only moment the border is doing
    // more than outlining the pill.
    final Color borderColor;
    final double borderWidth;
    if (hasError) {
      borderColor = KalloColors.danger;
      borderWidth = _focused ? 2 : 1;
    } else if (_focused) {
      borderColor = KalloColors.accent40;
      borderWidth = 2;
    } else {
      borderColor = KalloColors.border;
      borderWidth = 1;
    }

    final inputStyle = dashBody();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(widget.label, style: dashMeta(weight: FontWeight.w500)),
        const SizedBox(height: KalloSpacing.sp1_5),
        AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          constraints: const BoxConstraints(minHeight: _height),
          decoration: BoxDecoration(
            color: kFieldFill,
            borderRadius: BorderRadius.circular(KalloRadii.input),
            border: Border.all(color: borderColor, width: borderWidth),
          ),
          child: TextField(
            controller: widget.controller,
            focusNode: _focusNode,
            enabled: widget.enabled,
            autofocus: widget.autofocus,
            keyboardType: widget.keyboardType,
            textInputAction: widget.textInputAction,
            autofillHints: widget.autofillHints,
            inputFormatters: widget.inputFormatters,
            onSubmitted: widget.onSubmitted,
            onChanged: widget.onChanged,
            autocorrect: false,
            cursorColor: KalloColors.text,
            style: inputStyle,
            decoration: InputDecoration(
              isDense: true,
              hintText: widget.placeholder,
              hintStyle: inputStyle.copyWith(color: kInkMuted),
              filled: false,
              border: InputBorder.none,
              enabledBorder: InputBorder.none,
              focusedBorder: InputBorder.none,
              disabledBorder: InputBorder.none,
              contentPadding: const EdgeInsets.symmetric(
                horizontal: 18,
                vertical: KalloSpacing.sp3_5,
              ),
            ),
          ),
        ),
        if (hasError) ...[
          const SizedBox(height: KalloSpacing.sp1_5),
          Text(widget.errorText!, style: dashMeta(color: KalloColors.danger)),
        ],
      ],
    );
  }
}
