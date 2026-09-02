import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../theme/calm_tokens.dart';
import '../../../theme/kallo_colors.dart';
import '../../../theme/kallo_theme.dart';

/// The auth email/password field (native pass, 2026-08-31): a 52pt full-round
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
    this.obscureText = false,
    this.keyboardType,
    this.textInputAction,
    this.autofillHints,
    this.onSubmitted,
    this.onChanged,
    this.enabled = true,
    this.errorText,
  });

  final TextEditingController controller;
  final String label;
  final String placeholder;

  /// Whether this is a password field (drives the reveal toggle).
  final bool obscureText;
  final TextInputType? keyboardType;
  final TextInputAction? textInputAction;
  final Iterable<String>? autofillHints;
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
  bool _reveal = false;

  /// Field height and the reveal toggle's target — the app's pill metrics.
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

    final isPassword = widget.obscureText;
    final inputStyle = dashBody();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(widget.label, style: dashMeta(weight: FontWeight.w500)),
        const SizedBox(height: KalloSpacing.sp1_5),
        AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          constraints: const BoxConstraints(minHeight: _height),
          // The reveal toggle needs a 44pt box of its own, so a password field
          // trades the right inset for it rather than padding both.
          padding: EdgeInsets.only(right: isPassword ? KalloSpacing.sp1 : 0),
          decoration: BoxDecoration(
            color: kFieldFill,
            borderRadius: BorderRadius.circular(KalloRadii.input),
            border: Border.all(color: borderColor, width: borderWidth),
          ),
          child: Row(
            children: [
              Expanded(
                child: TextField(
                  controller: widget.controller,
                  focusNode: _focusNode,
                  enabled: widget.enabled,
                  obscureText: isPassword && !_reveal,
                  keyboardType: widget.keyboardType,
                  textInputAction: widget.textInputAction,
                  autofillHints: widget.autofillHints,
                  onSubmitted: widget.onSubmitted,
                  onChanged: widget.onChanged,
                  autocorrect: false,
                  enableSuggestions: !isPassword,
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
              if (isPassword)
                _RevealToggle(
                  revealed: _reveal,
                  onTap: () => setState(() => _reveal = !_reveal),
                ),
            ],
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

/// Eye / EyeOff reveal toggle — the app-wide 24pt glyph in a 44pt target,
/// sitting inside the pill's right edge.
class _RevealToggle extends StatefulWidget {
  const _RevealToggle({required this.revealed, required this.onTap});

  final bool revealed;
  final VoidCallback onTap;

  @override
  State<_RevealToggle> createState() => _RevealToggleState();
}

class _RevealToggleState extends State<_RevealToggle> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      toggled: widget.revealed,
      label: tr(widget.revealed ? 'auth.hidePassword' : 'auth.showPassword'),
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTapDown: (_) => setState(() => _pressed = true),
        onTapUp: (_) => setState(() => _pressed = false),
        onTapCancel: () => setState(() => _pressed = false),
        onTap: widget.onTap,
        child: SizedBox.square(
          dimension: KalloIcons.hit,
          child: Icon(
            widget.revealed ? LucideIcons.eyeOff300 : LucideIcons.eye300,
            size: KalloIcons.size,
            color: _pressed ? kInk : kInkMuted,
          ),
        ),
      ),
    );
  }
}
