import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../theme/calm_tokens.dart';
import '../../../theme/nham_colors.dart';
import '../../../theme/nham_theme.dart';

/// The auth email/password field, matching web `components/auth/form-input.tsx`.
///
/// Layout (`space-y-1.5` = 6px stack):
///   • Label: `block font-medium text-[#2C2416] text-xs tracking-wide`
///     (DM Sans w500, 12px, ~0.6px tracking).
///   • Input: `w-full rounded-xl border bg-white px-4 py-3 text-[#2C2416]
///     text-sm placeholder:text-[#B0A695] transition-all duration-200`.
///       resting border `#E8D5B5/60`; focus border `#C9A87C` + a 2px ring
///       `#C9A87C/10`. Error state: border `red-400`, focus `red-500`, ring
///       `red-500/10`.
///   • Password fields render an Eye/EyeOff toggle at `right-3` (12px),
///     vertically centered, `#8B7355/50` → `#8B7355` on press.
///   • Error message below: `text-red-500 text-xs` (12px).
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

  /// Per-field validation message (zod). Null = valid/untouched.
  final String? errorText;

  @override
  State<AuthTextField> createState() => _AuthTextFieldState();
}

class _AuthTextFieldState extends State<AuthTextField> {
  final _focusNode = FocusNode();
  bool _focused = false;
  bool _reveal = false;

  // Tailwind red-400 / red-500 used for the error border + message.
  static const Color _red400 = Color(0xFFF87171);
  static const Color _red500 = Color(0xFFEF4444);
  static const Color _placeholder = Color(0xFFB0A695);

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

    // Border + ring resolve from error → focus → resting, mirroring the web's
    // class precedence.
    final Color borderColor;
    final Color? ringColor;
    if (hasError) {
      borderColor = _focused ? _red500 : _red400;
      ringColor = _focused ? _red500.withValues(alpha: 0.10) : null;
    } else if (_focused) {
      borderColor = NhamColors.accent;
      ringColor = NhamColors.accent.withValues(alpha: 0.10);
    } else {
      borderColor = NhamColors.borderSoft; // #E8D5B5 @ 60%
      ringColor = null;
    }

    final isPassword = widget.obscureText;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Label.
        Text(
          widget.label,
          style: dashMeta(),
        ),
        const SizedBox(height: 6), // space-y-1.5
        // Input (with optional focus ring drawn as a boxShadow).
        AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          decoration: BoxDecoration(
            color: NhamColors.elev,
            borderRadius: BorderRadius.circular(NhamRadii.buttonXl),
            border: Border.all(color: borderColor),
            boxShadow: ringColor == null
                ? null
                : [
                    // focus:ring-2 → a 2px ring around the border.
                    BoxShadow(color: ringColor, spreadRadius: 2),
                  ],
          ),
          child: Stack(
            alignment: Alignment.centerRight,
            children: [
              TextField(
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
                cursorColor: NhamColors.text,
                style: dashBody(),
                decoration: InputDecoration(
                  isDense: true,
                  hintText: widget.placeholder,
                  hintStyle: dashBody(color: _placeholder),
                  filled: false,
                  border: InputBorder.none,
                  enabledBorder: InputBorder.none,
                  focusedBorder: InputBorder.none,
                  disabledBorder: InputBorder.none,
                  // px-4 py-3; reserve room on the right for the eye toggle.
                  contentPadding: EdgeInsets.only(
                    left: NhamSpacing.sp4,
                    right: isPassword ? 40 : NhamSpacing.sp4,
                    top: NhamSpacing.sp3,
                    bottom: NhamSpacing.sp3,
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
          const SizedBox(height: 6), // space-y-1.5
          Text(
            widget.errorText!,
            style: dashMeta(color: _red500),
          ),
        ],
      ],
    );
  }
}

/// Eye / EyeOff reveal toggle pinned `right-3` (12px), `#8B7355/50` resting,
/// `#8B7355` while pressed (replicating `hover:text-[#8B7355]`).
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
    final color =
        _pressed ? NhamColors.textMuted : NhamColors.textMuted.withValues(alpha: 0.5);
    return Padding(
      padding: const EdgeInsets.only(right: 12), // right-3
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTapDown: (_) => setState(() => _pressed = true),
        onTapUp: (_) => setState(() => _pressed = false),
        onTapCancel: () => setState(() => _pressed = false),
        onTap: widget.onTap,
        child: Icon(
          widget.revealed ? LucideIcons.eyeOff : LucideIcons.eye,
          size: 16,
          color: color,
        ),
      ),
    );
  }
}
